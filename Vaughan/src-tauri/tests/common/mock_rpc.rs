use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, body_string_contains};
use serde_json::json;

pub struct MockRpcServer {
    server: MockServer,
}

impl MockRpcServer {
    pub async fn start() -> Self {
        let server = MockServer::start().await;
        Self { server }
    }

    pub fn uri(&self) -> String {
        self.server.uri()
    }

    /// Mock eth_chainId response
    pub async fn mock_chain_id(&self, chain_id: u64) {
        let response = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": format!("0x{:x}", chain_id)
        });

        Mock::given(method("POST"))
            .and(body_string_contains("eth_chainId"))
            .respond_with(ResponseTemplate::new(200).set_body_json(response))
            .mount(&self.server)
            .await;
    }
}
