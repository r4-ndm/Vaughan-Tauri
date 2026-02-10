///! HTTP Proxy Server for dApp Content
///!
///! This proxy server fetches external dApp content and:
///! 1. Strips CSP headers (allows script injection)
///! 2. Injects provider script into HTML
///! 3. Adds permissive CORS headers
///! 4. Serves content to Tauri WebView
///!
///! **Security Note**: This bypasses website security policies.
///! Only use for development/testing purposes.

use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use reqwest;
use serde::Deserialize;
use std::net::SocketAddr;
use tokio::task::JoinHandle;

/// Proxy query parameters
#[derive(Debug, Deserialize)]
pub struct ProxyParams {
    /// Target URL to proxy
    url: String,
}

/// Start the HTTP proxy server
///
/// Starts a local HTTP server on port 8765 that proxies external dApp content.
///
/// # Returns
///
/// * `JoinHandle` - Server task handle (for shutdown)
///
/// # Example
///
/// ```rust
/// let server_handle = start_proxy_server().await;
/// // Server running on http://localhost:8765
/// ```
pub async fn start_proxy_server() -> JoinHandle<()> {
    tokio::spawn(async {
        let app = Router::new()
            .route("/proxy", get(proxy_handler))
            .route("/health", get(health_handler));

        let addr = SocketAddr::from(([127, 0, 0, 1], 8765));
        eprintln!("[Proxy] Starting HTTP proxy server on {}", addr);

        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .expect("Failed to bind proxy server");

        eprintln!("[Proxy] Server listening on http://{}", addr);

        axum::serve(listener, app)
            .await
            .expect("Failed to start proxy server");
    })
}

/// Health check endpoint
async fn health_handler() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".parse().unwrap());
    headers.insert(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, OPTIONS".parse().unwrap());
    
    (headers, "OK")
}

/// Proxy handler - fetches external content and modifies it
///
/// # Query Parameters
///
/// * `url` - Target URL to proxy
///
/// # Process
///
/// 1. Fetch content from target URL
/// 2. Strip CSP headers
/// 3. Inject provider script (HTML only)
/// 4. Return modified content
///
/// # Security
///
/// **WARNING**: This bypasses Content Security Policy!
/// Only use for development/testing.
async fn proxy_handler(Query(params): Query<ProxyParams>) -> Response {
    eprintln!("[Proxy] Proxying request for: {}", params.url);

    // Fetch external content
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .unwrap();

    let response = match client.get(&params.url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            eprintln!("[Proxy] Failed to fetch {}: {}", params.url, e);
            return (
                StatusCode::BAD_GATEWAY,
                format!("Failed to fetch content: {}", e),
            )
                .into_response();
        }
    };

    // Get content type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/html")
        .to_string();

    eprintln!("[Proxy] Content-Type: {}", content_type);

    // Get response body
    let body = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(e) => {
            eprintln!("[Proxy] Failed to read body: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to read content: {}", e),
            )
                .into_response();
        }
    };

    // Only modify HTML content
    let (final_body, final_content_type) = if content_type.contains("text/html") {
        let html = String::from_utf8_lossy(&body);
        let modified = inject_provider_script(&html);
        (modified.into_bytes(), content_type)
    } else {
        (body.to_vec(), content_type)
    };

    eprintln!("[Proxy] Serving {} bytes", final_body.len());

    // Build response with permissive headers (NO CSP!)
    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, final_content_type.parse().unwrap());
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".parse().unwrap());
    headers.insert(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, PUT, DELETE, OPTIONS".parse().unwrap());
    headers.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, "*".parse().unwrap());
    headers.insert(header::ACCESS_CONTROL_ALLOW_CREDENTIALS, "true".parse().unwrap());
    // Explicitly do NOT include any CSP headers!
    // Remove any CSP that might have been set

    (headers, final_body).into_response()
}

/// Inject provider script into HTML
///
/// Finds `</head>` tag and injects provider script before it.
///
/// # Arguments
///
/// * `html` - Original HTML content
///
/// # Returns
///
/// * Modified HTML with provider script injected
fn inject_provider_script(html: &str) -> String {
    // Provider script for iframe mode (works with localhost origin)
    let provider_script = include_str!("../../../src/provider/provider-inject.js");

    // Inject before </head>
    if let Some(pos) = html.find("</head>") {
        let mut modified = String::with_capacity(html.len() + provider_script.len() + 100);
        modified.push_str(&html[..pos]);
        modified.push_str("<script>");
        modified.push_str(provider_script);
        modified.push_str("</script>");
        modified.push_str(&html[pos..]);
        modified
    } else {
        // No </head> tag, inject at start of <body> or beginning
        if let Some(pos) = html.find("<body") {
            let mut modified = String::with_capacity(html.len() + provider_script.len() + 100);
            // Find end of <body> tag
            if let Some(end_pos) = html[pos..].find('>') {
                let body_end = pos + end_pos + 1;
                modified.push_str(&html[..body_end]);
                modified.push_str("<script>");
                modified.push_str(provider_script);
                modified.push_str("</script>");
                modified.push_str(&html[body_end..]);
                modified
            } else {
                html.to_string()
            }
        } else {
            // No <head> or <body>, prepend script
            let mut modified = String::with_capacity(html.len() + provider_script.len() + 100);
            modified.push_str("<script>");
            modified.push_str(provider_script);
            modified.push_str("</script>");
            modified.push_str(html);
            modified
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_provider_script() {
        let html = r#"
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <h1>Hello</h1>
</body>
</html>
"#;

        let modified = inject_provider_script(html);
        assert!(modified.contains("<script>"));
        assert!(modified.contains("</script>"));
        assert!(modified.contains("VaughanProvider") || modified.contains("window.ethereum"));
    }

    #[test]
    fn test_inject_no_head() {
        let html = r#"<body><h1>Hello</h1></body>"#;
        let modified = inject_provider_script(html);
        assert!(modified.contains("<script>"));
    }
}
