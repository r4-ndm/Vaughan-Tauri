use std::convert::Infallible;
use std::net::SocketAddr;
use std::collections::HashMap;
use std::sync::Mutex;
use hyper::{Body, Request, Response, Server, StatusCode};
use hyper::service::{make_service_fn, service_fn};
use url::Url;
use http::header::{HeaderName, HeaderValue};
use tracing::{info, error, warn};
use lazy_static::lazy_static;

lazy_static! {
    static ref LAST_TARGET_URL: Mutex<Option<String>> = Mutex::new(None);
}

/// Starts the HTTP proxy server on 127.0.0.1:8765
/// This proxy fetches dApp content and strips CSP headers to allow Tauri IPC.
pub async fn start_proxy_server() {
    let addr = SocketAddr::from(([127, 0, 0, 1], 8765));

    let make_svc = make_service_fn(|_conn| async {
        Ok::<_, Infallible>(service_fn(handle_proxy_request))
    });

    let server = Server::bind(&addr).serve(make_svc);

    info!("✅ Proxy server starting on http://{}", addr);

    if let Err(e) = server.await {
        error!("❌ Proxy server error: {}", e);
    }
}

async fn handle_proxy_request(req: Request<Body>) -> Result<Response<Body>, Infallible> {
    // Parse the query parameters to find the target URL
    let params: HashMap<String, String> = req
        .uri()
        .query()
        .map(|v| url::form_urlencoded::parse(v.as_bytes()).into_owned().collect())
        .unwrap_or_default();

    // Primary: explicit ?url=... param
    let mut target_url_opt: Option<String> = params.get("url").cloned();

    // Update global last-target if we have an explicit URL
    if let Some(ref url) = target_url_opt {
        if let Ok(mut guard) = LAST_TARGET_URL.lock() {
            *guard = Some(url.clone());
        }
    }

    // Fallback for asset/API requests: derive from last seen target URL
    if target_url_opt.is_none() {
        if let Ok(guard) = LAST_TARGET_URL.lock() {
            if let Some(ref base_url) = *guard {
                if let Ok(mut base) = Url::parse(base_url) {
                    base.set_path(req.uri().path());
                    target_url_opt = Some(base.to_string());
                }
            }
        }
    }

    let target_url = match target_url_opt {
        Some(url) => url,
        None => {
            return Ok(Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(Body::from("Missing 'url' parameter"))
                .unwrap());
        }
    };

    info!("[Proxy] Intercepting request for: {}", target_url);

    // Validate the target URL
    let url = match Url::parse(&target_url) {
        Ok(u) => u,
        Err(e) => {
            return Ok(Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(Body::from(format!("Invalid URL: {}", e)))
                .unwrap());
        }
    };

    // Forward the request using reqwest
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .unwrap();

    let resp = match client.get(url.as_str()).send().await {
        Ok(r) => r,
        Err(e) => {
            error!("[Proxy] Failed to fetch {}: {}", target_url, e);
            return Ok(Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from(format!("Failed to fetch: {}", e)))
                .unwrap());
        }
    };

    // Build the response
    let status = resp.status();
    let mut builder = Response::builder().status(status.as_u16());

    // Copy allowlisted headers (strip CSP and X-Frame-Options)
    let headers = builder.headers_mut().unwrap();
    for (name, value) in resp.headers().iter() {
        let name_str = name.as_str().to_lowercase();
        if name_str == "content-security-policy" || name_str == "x-frame-options" {
            warn!("[Proxy] Stripping header: {}", name_str);
            continue;
        }

        // Convert header name and value from reqwest/http-1 into http-0.2 types used by hyper
        let name_owned = match HeaderName::from_bytes(name.as_str().as_bytes()) {
            Ok(n) => n,
            Err(_) => {
                warn!("[Proxy] Skipping header with invalid name: {}", name_str);
                continue;
            }
        };

        let hv = match value.to_str() {
            Ok(val_str) => match HeaderValue::from_str(val_str) {
                Ok(hv) => hv,
                Err(_) => {
                    warn!("[Proxy] Skipping header with invalid value: {}", name_str);
                    continue;
                }
            },
            Err(_) => {
                warn!("[Proxy] Skipping non-UTF8 header value for: {}", name_str);
                continue;
            }
        };

        headers.insert(name_owned, hv);
    }

    // Always allow cross-origin for our own proxy context
    headers.insert("Access-Control-Allow-Origin", HeaderValue::from_static("*"));

    // Stream the body
    let body_bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(e) => {
            error!("[Proxy] Failed to read body: {}", e);
            return Ok(Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Failed to read response body"))
                .unwrap());
        }
    };

    Ok(builder.body(Body::from(body_bytes)).unwrap())
}
