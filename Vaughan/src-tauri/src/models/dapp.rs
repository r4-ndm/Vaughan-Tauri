use std::time::{SystemTime, UNIX_EPOCH};
use alloy::primitives::Address;
use serde::{Deserialize, Serialize};
use specta::Type;

/// Type alias for session key (window_label is now part of the key)
/// This ensures sessions are isolated per window
pub type SessionKey = (String, String);

/// dApp origin (e.g., "https://app.uniswap.org")
pub type DappOrigin = String;

/// dApp connection information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DappConnection {
    /// Window label (unique per window)
    pub window_label: String,

    /// dApp origin (e.g., "https://app.uniswap.org")
    pub origin: String,

    /// dApp name (if provided)
    pub name: Option<String>,

    /// dApp icon URL (if provided)
    pub icon: Option<String>,

    /// Connected accounts (addresses the dApp can see)
    pub accounts: Vec<Address>,

    /// Connection timestamp (Unix timestamp)
    pub connected_at: u64,

    /// Last activity timestamp (Unix timestamp)
    pub last_activity: u64,

    /// Auto-approved connection (wallet opened the dApp)
    pub auto_approved: bool,
}

/// dApp connection shape for IPC/TypeScript (accounts as string list).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DappConnectionExport {
    pub window_label: String,
    pub origin: String,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub accounts: Vec<String>,
    pub connected_at: u64,
    pub last_activity: u64,
    pub auto_approved: bool,
}

impl From<DappConnection> for DappConnectionExport {
    fn from(c: DappConnection) -> Self {
        Self {
            window_label: c.window_label,
            origin: c.origin,
            name: c.name,
            icon: c.icon,
            accounts: c.accounts.iter().map(|a| format!("{:?}", a)).collect(),
            connected_at: c.connected_at,
            last_activity: c.last_activity,
            auto_approved: c.auto_approved,
        }
    }
}

impl DappConnection {
    pub fn new(
        window_label: String,
        origin: String,
        name: Option<String>,
        icon: Option<String>,
        accounts: Vec<Address>,
    ) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            window_label,
            origin,
            name,
            icon,
            accounts,
            connected_at: now,
            last_activity: now,
            auto_approved: false, // Default to false, explicitly set when opening dApp from wallet
        }
    }
}
