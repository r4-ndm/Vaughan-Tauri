///! WebSocket Server for dApp Communication
///!
///! Provides secure WebSocket (WSS) server with dynamic port assignment

use tokio::net::TcpListener;
use futures_util::{StreamExt, SinkExt};
use tokio_tungstenite::accept_async;
use tauri::Manager;
use crate::state::VaughanState;
use crate::dapp;
use crate::dapp::logging::*;
use native_tls::{Identity, TlsAcceptor};
use tokio_native_tls::TlsAcceptor as TokioTlsAcceptor;

/// Find available port in range
///
/// # Arguments
///
/// * `start` - Start of port range
/// * `end` - End of port range (inclusive)
///
/// # Returns
///
/// * `Some(port)` - Available port found
/// * `None` - No available ports in range
///
/// # Example
///
/// ```rust,no_run
/// # use vaughan::dapp::websocket::find_available_port;
/// # async fn example() {
/// let port = find_available_port(8766, 8800).await;
/// if let Some(port) = port {
///     println!("Found available port: {}", port);
/// }
/// # }
/// ```
pub async fn find_available_port(start: u16, end: u16) -> Option<u16> {
    for port in start..=end {
        if TcpListener::bind(("127.0.0.1", port)).await.is_ok() {
            return Some(port);
        }
    }
    None
}

/// Start secure WebSocket (WSS) server on available port
///
/// # Arguments
///
/// * `app_handle` - Tauri app handle for state access
///
/// # Returns
///
/// * `Ok(port)` - Server started successfully on port
/// * `Err(String)` - Failed to start server
///
/// # Example
///
/// ```rust,no_run
/// # use vaughan::dapp::websocket::start_websocket_server;
/// # async fn example(app: tauri::AppHandle) -> Result<(), String> {
/// let port = start_websocket_server(app).await?;
/// println!("WebSocket server running on port {}", port);
/// # Ok(())
/// # }
/// ```
pub async fn start_websocket_server(app_handle: tauri::AppHandle) -> Result<u16, String> {
    // Generate or load certificate
    eprintln!("[WSS] Setting up secure WebSocket server...");
    let (cert_pem, key_pem) = crate::dapp::cert::get_or_generate_cert()?;
    
    // Parse PEM certificates
    let cert_parsed = pem::parse(&cert_pem)
        .map_err(|e| format!("Failed to parse certificate PEM: {}", e))?;
    
    let key_parsed = pem::parse(&key_pem)
        .map_err(|e| format!("Failed to parse key PEM: {}", e))?;
    
    // Create identity from PEM (native-tls expects PEM format directly)
    let identity = Identity::from_pkcs8(cert_pem.as_bytes(), key_pem.as_bytes())
        .map_err(|e| format!("Failed to create identity: {}", e))?;
    
    // Create TLS acceptor
    let tls_acceptor = TlsAcceptor::new(identity)
        .map_err(|e| format!("Failed to create TLS acceptor: {}", e))?;
    let tls_acceptor = TokioTlsAcceptor::from(tls_acceptor);
    
    // Try to find available port in range
    let port = find_available_port(8766, 8800).await
        .ok_or("No available ports in range 8766-8800")?;
    
    // Bind to the port
    let listener = TcpListener::bind(("127.0.0.1", port))
        .await
        .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;
    
    eprintln!("[WSS] Secure WebSocket server started on port {}", port);
    log_websocket_startup(port);
    
    // Store port in state
    {
        let state = app_handle.state::<VaughanState>();
        state.set_websocket_port(port).await;
    }
    
    // Start accepting connections
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    let addr_str = addr.to_string();
                    let app_handle_clone = app_handle.clone();
                    let tls_acceptor_clone = tls_acceptor.clone();
                    
                    tokio::spawn(async move {
                        // Wrap stream with TLS
                        match tls_acceptor_clone.accept(stream).await {
                            Ok(tls_stream) => {
                                handle_connection(app_handle_clone, tls_stream, addr_str).await;
                            }
                            Err(e) => {
                                log_websocket_error(&addr_str, &format!("TLS handshake failed: {}", e));
                            }
                        }
                    });
                }
                Err(e) => {
                    log_websocket_error("listener", &format!("Error accepting connection: {}", e));
                }
            }
        }
    });
    
    Ok(port)
}

/// Handle individual WebSocket connection
async fn handle_connection<S>(
    app_handle: tauri::AppHandle,
    stream: S,
    addr: String,
) where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    // Get state from app handle
    let state = app_handle.state::<VaughanState>();
    let state_ref: &VaughanState = &*state;
    
    // Track connection opened
    state_ref.health_monitor.connection_opened();
    log_websocket_connection(&addr, "external");
    
    match accept_async(stream).await {
        Ok(ws_stream) => {
            let (mut write, mut read) = ws_stream.split();
            
            while let Some(msg_result) = read.next().await {
                match msg_result {
                    Ok(msg) => {
                        if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                            // Track message processed
                            state_ref.health_monitor.message_processed();
                            
                            // Parse JSON-RPC request
                            match serde_json::from_str::<serde_json::Value>(&text) {
                                Ok(request) => {
                                    let id = request["id"].as_u64().unwrap_or(0);
                                    let method = request["method"].as_str().unwrap_or("");
                                    let params = request["params"].as_array().cloned().unwrap_or_default();
                                    
                                    // Extract window metadata (sent by provider script)
                                    let window_label = request["_window_label"].as_str().unwrap_or("websocket");
                                    let origin = request["_origin"].as_str().unwrap_or("external");
                                    
                                    log_rpc_request_start(method, origin, id);
                                    let start = std::time::Instant::now();
                                    
                                    // Process request using existing RPC handler
                                    let result = dapp::rpc_handler::handle_request(
                                        state_ref,
                                        window_label,
                                        origin,
                                        method,
                                        params
                                    ).await;
                                    
                                    let duration_ms = start.elapsed().as_millis() as u64;
                                    
                                    // Record profiling data
                                    state_ref.profiler.record(method.to_string(), duration_ms).await;
                                    
                                    // Build response
                                    let response = match result {
                                        Ok(value) => {
                                            log_rpc_request_success(method, "external", id, duration_ms);
                                            serde_json::json!({
                                                "id": id,
                                                "jsonrpc": "2.0",
                                                "result": value
                                            })
                                        }
                                        Err(e) => {
                                            // Track error
                                            state_ref.health_monitor.error_occurred();
                                            log_rpc_request_error(method, "external", id, &e.to_string());
                                            
                                            serde_json::json!({
                                                "id": id,
                                                "jsonrpc": "2.0",
                                                "error": {
                                                    "code": -32000,
                                                    "message": e.to_string()
                                                }
                                            })
                                        }
                                    };
                                    
                                    // Send response
                                    let response_text = serde_json::to_string(&response).unwrap();
                                    
                                    if let Err(e) = write.send(
                                        tokio_tungstenite::tungstenite::Message::Text(response_text)
                                    ).await {
                                        log_websocket_error(&addr, &format!("Error sending response: {}", e));
                                        state_ref.health_monitor.error_occurred();
                                        break;
                                    }
                                }
                                Err(e) => {
                                    log_websocket_error(&addr, &format!("Error parsing request: {}", e));
                                    state_ref.health_monitor.error_occurred();
                                    
                                    // Send error response
                                    let error_response = serde_json::json!({
                                        "id": null,
                                        "jsonrpc": "2.0",
                                        "error": {
                                            "code": -32700,
                                            "message": "Parse error"
                                        }
                                    });
                                    
                                    let _ = write.send(
                                        tokio_tungstenite::tungstenite::Message::Text(
                                            serde_json::to_string(&error_response).unwrap()
                                        )
                                    ).await;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log_websocket_error(&addr, &format!("Error receiving message: {}", e));
                        state_ref.health_monitor.error_occurred();
                        break;
                    }
                }
            }
            
            log_websocket_disconnection(&addr, "external", "normal");
        }
        Err(e) => {
            log_websocket_error(&addr, &format!("Error during WebSocket handshake: {}", e));
            state_ref.health_monitor.error_occurred();
        }
    }
    
    // Track connection closed
    state_ref.health_monitor.connection_closed();
}
