// WebSocket Server Implementation
// File: src-tauri/src/lib.rs (lines 265-370)
// 
// This code runs when the Vaughan wallet app starts.
// It creates a WebSocket server on localhost:8766 that accepts
// connections from provider scripts injected into dApp windows.

println!("🔌 Starting WebSocket server...");
let app_handle = app.handle().clone();

tauri::async_runtime::spawn(async move {
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;
    use futures_util::{StreamExt, SinkExt};
    
    match TcpListener::bind("127.0.0.1:8766").await {
        Ok(listener) => {
            println!("✅ WebSocket server started on ws://127.0.0.1:8766");
            
            // Accept connections loop
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        println!("[WebSocket] New connection from: {}", addr);
                        let app_handle_clone = app_handle.clone();
                        
                        // Spawn handler for this connection
                        tokio::spawn(async move {
                            // Get state from app handle
                            let state = app_handle_clone.state::<state::VaughanState>();
                            let state_ref: &state::VaughanState = &*state;
                            
                            // Upgrade TCP to WebSocket
                            match accept_async(stream).await {
                                Ok(ws_stream) => {
                                    // Split into read and write streams
                                    let (mut write, mut read) = ws_stream.split();
                                    
                                    // Process messages
                                    while let Some(msg_result) = read.next().await {
                                        match msg_result {
                                            Ok(msg) => {
                                                if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                                                    println!("[WebSocket] Received: {}", text);
                                                    
                                                    // Parse JSON-RPC request
                                                    match serde_json::from_str::<serde_json::Value>(&text) {
                                                        Ok(request) => {
                                                            let id = request["id"].clone();
                                                            let method = request["method"].as_str().unwrap_or("");
                                                            let params = request["params"].as_array().cloned().unwrap_or_default();
                                                            
                                                            // Process request using existing RPC handler
                                                            // Use "websocket" as window_label and "external" as origin
                                                            let result = dapp::rpc_handler::handle_request(
                                                                state_ref,
                                                                "websocket",
                                                                "external",
                                                                method,
                                                                params
                                                            ).await;
                                                            
                                                            // Build response
                                                            let response = match result {
                                                                Ok(value) => serde_json::json!({
                                                                    "id": id,
                                                                    "jsonrpc": "2.0",
                                                                    "result": value
                                                                }),
                                                                Err(e) => serde_json::json!({
                                                                    "id": id,
                                                                    "jsonrpc": "2.0",
                                                                    "error": {
                                                                        "code": -32000,
                                                                        "message": e.to_string()
                                                                    }
                                                                })
                                                            };
                                                            
                                                            println!("[WebSocket] Response: {}", response);
                                                            
                                                            // Send response
                                                            let _ = write.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                response.to_string()
                                                            )).await;
                                                        }
                                                        Err(e) => {
                                                            println!("[WebSocket] Failed to parse request: {}", e);
                                                            let error_response = serde_json::json!({
                                                                "id": null,
                                                                "jsonrpc": "2.0",
                                                                "error": {
                                                                    "code": -32700,
                                                                    "message": "Parse error"
                                                                }
                                                            });
                                                            let _ = write.send(tokio_tungstenite::tungstenite::Message::Text(
                                                                error_response.to_string()
                                                            )).await;
                                                        }
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                println!("[WebSocket] Error receiving message: {}", e);
                                                break;
                                            }
                                        }
                                    }
                                    
                                    println!("[WebSocket] Connection closed: {}", addr);
                                }
                                Err(e) => {
                                    println!("[WebSocket] Failed to accept connection: {}", e);
                                }
                            }
                        });
                    }
                    Err(e) => {
                        eprintln!("[WebSocket] Failed to accept connection: {}", e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("❌ Failed to start WebSocket server: {}", e);
        }
    }
});
