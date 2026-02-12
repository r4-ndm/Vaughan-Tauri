/**
 * Approval Queue Module
 * 
 * Manages user approval requests for dApp operations
 * Implements queue with timeout and cancellation support
 * 
 * **PHASE 3.4 UPDATE**: Approvals are now window-specific to support
 * proper routing of approval responses to the correct dApp window.
 */

use crate::error::WalletError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, oneshot};

/// Approval request ID
pub type ApprovalId = String;

/// Approval request type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ApprovalRequestType {
    /// Connection request
    Connection {
        origin: String,
    },
    /// Transaction request
    Transaction {
        origin: String,
        from: String,
        to: String,
        value: String,
        gas_limit: Option<u64>,
        gas_price: Option<String>,
        data: Option<String>,
    },
    /// Message signing request
    PersonalSign {
        origin: String,
        address: String,
        message: String,
    },
    /// Typed data signing request (EIP-712)
    SignTypedData {
        origin: String,
        address: String,
        typed_data: String,
    },
    /// Watch asset request (EIP-747)
    WatchAsset {
        origin: String,
        asset_type: String,
        address: String,
        symbol: String,
        decimals: u64,
        image: Option<String>,
    },
    /// Network switch request
    SwitchNetwork {
        origin: String,
        chain_id: u64,
    },
    /// Add network request
    AddNetwork {
        origin: String,
        chain_id: u64,
        chain_name: String,
        rpc_url: String,
        block_explorer_url: Option<String>,
    },
}

/// Approval request
#[derive(Debug, Clone, Serialize)]
pub struct ApprovalRequest {
    /// Unique request ID
    pub id: ApprovalId,
    /// Window label (for routing responses)
    pub window_label: String,
    /// Request type and data
    pub request_type: ApprovalRequestType,
    /// When the request was created
    pub created_at: u64,
    /// Request timeout (5 minutes)
    #[serde(skip)]
    pub timeout: Duration,
}

/// Approval response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalResponse {
    /// Request ID
    pub id: ApprovalId,
    /// Was approved?
    pub approved: bool,
    /// Optional data (e.g., password for transactions)
    pub data: Option<serde_json::Value>,
}

/// Pending approval with response channel
struct PendingApproval {
    request: ApprovalRequest,
    created: Instant,
    response_tx: oneshot::Sender<ApprovalResponse>,
}

/// Approval queue manager
#[derive(Clone)]
pub struct ApprovalQueue {
    /// Pending approvals
    pending: Arc<Mutex<HashMap<ApprovalId, PendingApproval>>>,
}

impl ApprovalQueue {
    /// Create new approval queue
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Add approval request to queue
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier (for routing responses)
    /// * `request_type` - Type of approval request
    ///
    /// # Returns
    ///
    /// * `Ok((id, receiver))` - Request ID and response receiver
    /// * `Err(WalletError)` - If queue is full or other error
    pub async fn add_request(
        &self,
        window_label: String,
        request_type: ApprovalRequestType,
    ) -> Result<(ApprovalId, oneshot::Receiver<ApprovalResponse>), WalletError> {
        let mut pending = self.pending.lock().await;

        // Check queue size (max 10 pending)
        if pending.len() >= 10 {
            return Err(WalletError::Custom(
                "Approval queue is full".to_string(),
            ));
        }

        // Generate unique ID
        let id = uuid::Uuid::new_v4().to_string();

        // Create request
        let request = ApprovalRequest {
            id: id.clone(),
            window_label,
            request_type,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            timeout: Duration::from_secs(300), // 5 minutes
        };

        // Create response channel
        let (tx, rx) = oneshot::channel();

        // Add to pending
        pending.insert(
            id.clone(),
            PendingApproval {
                request,
                created: Instant::now(),
                response_tx: tx,
            },
        );

        Ok((id, rx))
    }

    /// Get pending approval request
    ///
    /// # Arguments
    ///
    /// * `id` - Request ID
    ///
    /// # Returns
    ///
    /// * `Some(ApprovalRequest)` - Request found
    /// * `None` - Request not found
    pub async fn get_request(&self, id: &str) -> Option<ApprovalRequest> {
        let pending = self.pending.lock().await;
        pending.get(id).map(|p| p.request.clone())
    }

    /// Get all pending approval requests
    ///
    /// # Returns
    ///
    /// * `Vec<ApprovalRequest>` - All pending requests
    pub async fn get_all_requests(&self) -> Vec<ApprovalRequest> {
        let pending = self.pending.lock().await;
        pending.values().map(|p| p.request.clone()).collect()
    }

    /// Respond to approval request
    ///
    /// # Arguments
    ///
    /// * `response` - Approval response
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Response sent
    /// * `Err(WalletError)` - If request not found or already responded
    pub async fn respond(&self, response: ApprovalResponse) -> Result<(), WalletError> {
        let mut pending = self.pending.lock().await;

        match pending.remove(&response.id) {
            Some(approval) => {
                // Send response (ignore if receiver dropped)
                let _ = approval.response_tx.send(response);
                Ok(())
            }
            None => Err(WalletError::Custom(
                "Approval request not found".to_string(),
            )),
        }
    }

    /// Cancel approval request
    ///
    /// # Arguments
    ///
    /// * `id` - Request ID
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Request cancelled
    /// * `Err(WalletError)` - If request not found
    pub async fn cancel(&self, id: &str) -> Result<(), WalletError> {
        let mut pending = self.pending.lock().await;

        match pending.remove(id) {
            Some(approval) => {
                // Send rejection
                let _ = approval.response_tx.send(ApprovalResponse {
                    id: id.to_string(),
                    approved: false,
                    data: None,
                });
                Ok(())
            }
            None => Err(WalletError::Custom(
                "Approval request not found".to_string(),
            )),
        }
    }

    /// Clean up expired requests
    ///
    /// Removes requests older than timeout
    pub async fn cleanup_expired(&self) {
        let mut pending = self.pending.lock().await;

        // Find expired requests
        let expired: Vec<String> = pending
            .iter()
            .filter(|(_, approval)| approval.created.elapsed() > approval.request.timeout)
            .map(|(id, _)| id.clone())
            .collect();

        // Remove expired requests
        for id in expired {
            if let Some(approval) = pending.remove(&id) {
                // Send timeout response
                let _ = approval.response_tx.send(ApprovalResponse {
                    id,
                    approved: false,
                    data: Some(serde_json::json!({ "error": "Request timeout" })),
                });
            }
        }
    }

    /// Clear all pending requests
    ///
    /// Useful for cleanup/reset
    pub async fn clear_all(&self) {
        let mut pending = self.pending.lock().await;
        
        // Send rejection to all pending requests
        for (id, approval) in pending.drain() {
            let _ = approval.response_tx.send(ApprovalResponse {
                id,
                approved: false,
                data: Some(serde_json::json!({ "error": "Queue cleared" })),
            });
        }
    }

    /// Clear all pending requests for a specific window
    ///
    /// Called when window is closed
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    pub async fn clear_for_window(&self, window_label: &str) {
        let mut pending = self.pending.lock().await;

        // Find requests for this window
        let to_remove: Vec<String> = pending
            .iter()
            .filter(|(_, approval)| approval.request.window_label == window_label)
            .map(|(id, _)| id.clone())
            .collect();

        // Remove and reject them
        for id in to_remove {
            if let Some(approval) = pending.remove(&id) {
                let _ = approval.response_tx.send(ApprovalResponse {
                    id,
                    approved: false,
                    data: Some(serde_json::json!({ "error": "Window closed" })),
                });
            }
        }
    }

    /// Get all pending requests for a specific window
    ///
    /// # Arguments
    ///
    /// * `window_label` - Window identifier
    ///
    /// # Returns
    ///
    /// * `Vec<ApprovalRequest>` - Requests for this window
    pub async fn get_requests_for_window(&self, window_label: &str) -> Vec<ApprovalRequest> {
        let pending = self.pending.lock().await;
        pending
            .values()
            .filter(|approval| approval.request.window_label == window_label)
            .map(|approval| approval.request.clone())
            .collect()
    }
}

impl Default for ApprovalQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_add_and_get_request() {
        let queue = ApprovalQueue::new();
        let window_label = "dapp-window-1".to_string();

        let request_type = ApprovalRequestType::Connection {
            origin: "https://app.pulsex.com".to_string(),
        };

        let (id, _rx) = queue.add_request(window_label.clone(), request_type.clone()).await.unwrap();

        let request = queue.get_request(&id).await.unwrap();
        assert_eq!(request.id, id);
        assert_eq!(request.window_label, window_label);
    }

    #[tokio::test]
    async fn test_respond_to_request() {
        let queue = ApprovalQueue::new();
        let window_label = "dapp-window-1".to_string();

        let request_type = ApprovalRequestType::Connection {
            origin: "https://app.pulsex.com".to_string(),
        };

        let (id, rx) = queue.add_request(window_label, request_type).await.unwrap();

        // Respond in background
        let queue_clone = queue.clone();
        let id_clone = id.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            let _result = queue_clone
                .respond(ApprovalResponse {
                    id: id_clone,
                    approved: true,
                    data: None,
                })
                .await;
        });

        // Wait for response
        let response = rx.await.unwrap();
        assert_eq!(response.id, id);
        assert!(response.approved);
    }

    #[tokio::test]
    async fn test_cancel_request() {
        let queue = ApprovalQueue::new();
        let window_label = "dapp-window-1".to_string();

        let request_type = ApprovalRequestType::Connection {
            origin: "https://app.pulsex.com".to_string(),
        };

        let (id, rx) = queue.add_request(window_label, request_type).await.unwrap();

        // Cancel request
        queue.cancel(&id).await.unwrap();

        // Should receive rejection
        let response = rx.await.unwrap();
        assert_eq!(response.id, id);
        assert!(!response.approved);
    }

    #[tokio::test]
    async fn test_queue_limit() {
        let queue = ApprovalQueue::new();
        let window_label = "dapp-window-1".to_string();

        // Add 10 requests (max)
        for _ in 0..10 {
            let request_type = ApprovalRequestType::Connection {
                origin: "https://app.pulsex.com".to_string(),
            };
            queue.add_request(window_label.clone(), request_type).await.unwrap();
        }

        // 11th should fail
        let request_type = ApprovalRequestType::Connection {
            origin: "https://app.pulsex.com".to_string(),
        };
        let result = queue.add_request(window_label, request_type).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_clear_for_window() {
        let queue = ApprovalQueue::new();
        let window1 = "dapp-window-1".to_string();
        let window2 = "dapp-window-2".to_string();

        // Add requests for two windows
        let request_type = ApprovalRequestType::Connection {
            origin: "https://app.pulsex.com".to_string(),
        };

        let (id1, rx1) = queue.add_request(window1.clone(), request_type.clone()).await.unwrap();
        let (id2, rx2) = queue.add_request(window1.clone(), request_type.clone()).await.unwrap();
        let (id3, _rx3) = queue.add_request(window2.clone(), request_type.clone()).await.unwrap();

        // Should have 3 requests
        assert_eq!(queue.get_all_requests().await.len(), 3);

        // Clear window 1
        queue.clear_for_window(&window1).await;

        // Should have 1 request left (window 2)
        assert_eq!(queue.get_all_requests().await.len(), 1);

        // Window 1 requests should be rejected
        let response1 = rx1.await.unwrap();
        assert!(!response1.approved);
        let response2 = rx2.await.unwrap();
        assert!(!response2.approved);

        // Window 2 request should still exist
        assert!(queue.get_request(&id3).await.is_some());
    }

    #[tokio::test]
    async fn test_get_requests_for_window() {
        let queue = ApprovalQueue::new();
        let window1 = "dapp-window-1".to_string();
        let window2 = "dapp-window-2".to_string();

        let request_type = ApprovalRequestType::Connection {
            origin: "https://app.pulsex.com".to_string(),
        };

        // Add requests for two windows
        queue.add_request(window1.clone(), request_type.clone()).await.unwrap();
        queue.add_request(window1.clone(), request_type.clone()).await.unwrap();
        queue.add_request(window2.clone(), request_type.clone()).await.unwrap();

        // Get requests for window 1
        let window1_requests = queue.get_requests_for_window(&window1).await;
        assert_eq!(window1_requests.len(), 2);
        assert!(window1_requests.iter().all(|r| r.window_label == window1));

        // Get requests for window 2
        let window2_requests = queue.get_requests_for_window(&window2).await;
        assert_eq!(window2_requests.len(), 1);
        assert!(window2_requests.iter().all(|r| r.window_label == window2));
    }
}
