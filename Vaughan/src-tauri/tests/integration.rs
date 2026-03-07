mod common;

use vaughan_lib::state::VaughanState;
use common::mock_rpc::MockRpcServer;

#[tokio::test]
async fn test_network_switch_with_mock() {
    // Setup mock server
    let server = MockRpcServer::start().await;
    
    // Mock chain ID response (e.g. for PulseChain Testnet V4 = 943)
    server.mock_chain_id(943).await;
    
    // Initialize state
    let state = VaughanState::new().await.unwrap();
    
    // Switch to mock network
    let mock_network_id = "mock-network";
    let mock_rpc_url = server.uri();
    
    state.switch_network(mock_network_id, &mock_rpc_url, 943).await.unwrap();
    
    // Verify state
    assert_eq!(state.current_network_id().await.unwrap(), mock_network_id);
    
    // Verify adapter creation
    let adapter = state.current_adapter().await.unwrap();
    assert_eq!(adapter.chain_id(), 943);
}
