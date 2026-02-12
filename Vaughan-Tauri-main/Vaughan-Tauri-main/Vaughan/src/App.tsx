import { Routes, Route, Navigate } from 'react-router-dom';
import {
  SetupView,
  CreateWalletView,
  ImportWalletView,
  UnlockWalletView,
  WalletView,
  SendView,
  ReceiveView,
  DappBrowserView,
  DappBrowserHybrid,
  DappBrowserDirect,
  DappBrowserSimple,
} from './views';
import { useExternalWindowBridge } from './hooks/useExternalWindowBridge';

/**
 * Vaughan Wallet - Phase 2 Frontend Development
 * 
 * Main application with routing between all views.
 * 
 * Flow:
 * 1. Start at /setup (detects wallet state)
 * 2. If no wallet → /create or /import
 * 3. If locked → /unlock
 * 4. If unlocked → / (main wallet)
 */
function App() {
  // Setup bridge for external window communication
  useExternalWindowBridge();

  return (
    <Routes>
      {/* Setup Flow */}
      <Route path="/setup" element={<SetupView />} />
      <Route path="/create" element={<CreateWalletView />} />
      <Route path="/import" element={<ImportWalletView />} />
      <Route path="/unlock" element={<UnlockWalletView />} />

      {/* Main Wallet */}
      <Route path="/wallet" element={<WalletView />} />
      <Route path="/send" element={<SendView />} />
      <Route path="/receive" element={<ReceiveView />} />
      
      {/* dApp Browser */}
      <Route path="/dapp" element={<DappBrowserView />} />
      <Route path="/dapp-hybrid" element={<DappBrowserHybrid />} />
      <Route path="/dapp-direct" element={<DappBrowserDirect />} />
      <Route path="/dapp-simple" element={<DappBrowserSimple />} />

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}

export default App;
