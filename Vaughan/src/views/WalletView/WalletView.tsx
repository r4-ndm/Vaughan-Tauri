import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  NetworkSelector,
  AccountSelector,
  BalanceDisplay,
  TokenList,
  ActionButtons,
  DappSelector,
} from '../../components';
import { TauriService } from '../../services/tauri';
import { useApprovalPolling, ApprovalRequest } from '../../hooks/useApprovalPolling';
import { ConnectionApproval } from '../../components/ApprovalModal/ConnectionApproval';
import { TransactionApproval } from '../../components/ApprovalModal/TransactionApproval';
import { WhitelistedDapp } from '../../utils/whitelistedDapps';

interface DappConnection {
  window_label: string;
  origin: string;
  name: string | null;
  icon: string | null;
  accounts: string[];
  connected_at: number;
  last_activity: number;
}

/**
 * WalletView - Main Wallet Screen
 * 
 * The primary view of the wallet application.
 * Displays balance, tokens, and primary actions.
 */
export function WalletView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentApproval, setCurrentApproval] = useState<ApprovalRequest | null>(null);
  const [connectedDapps, setConnectedDapps] = useState<DappConnection[]>([]);
  const [showDapps, setShowDapps] = useState(false);
  const [showDappSelector, setShowDappSelector] = useState(false);

  // Poll for approval requests
  useApprovalPolling({
    enabled: !loading,
    onApprovalDetected: (approval) => {
      console.log('[WalletView] Approval detected:', approval);
      setCurrentApproval(approval);
    },
    onError: (error) => {
      console.error('[WalletView] Approval polling error:', error);
    },
  });

  // Load connected dApps
  const loadConnectedDapps = async () => {
    try {
      const dapps = await invoke<DappConnection[]>('get_connected_dapps');
      setConnectedDapps(dapps);
      console.log('[WalletView] Connected dApps:', dapps);
    } catch (err) {
      console.error('[WalletView] Failed to load connected dApps:', err);
    }
  };

  // Check wallet state on mount
  useEffect(() => {
    const checkWallet = async () => {
      try {
        const exists = await TauriService.walletExists();
        if (!exists) {
          navigate('/setup', { replace: true });
          return;
        }

        const locked = await TauriService.isWalletLocked();
        if (locked) {
          navigate('/unlock', { replace: true });
          return;
        }

        setLoading(false);
        loadConnectedDapps();
      } catch (err) {
        console.error('Failed to check wallet:', err);
        navigate('/setup', { replace: true });
      }
    };

    checkWallet();
  }, [navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading wallet...</p>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    navigate('/send');
  };

  const handleReceive = () => {
    navigate('/receive');
  };

  const handleDappBrowser = () => {
    // Open dApp selector modal
    setShowDappSelector(true);
  };

  const handleDappSelect = async (dapp: WhitelistedDapp) => {
    try {
      console.log('Opening dApp:', dapp.name, dapp.url);
      
      // Close selector modal
      setShowDappSelector(false);
      
      // Open dApp with capabilities-enabled window
      const windowLabel = await invoke('open_dapp_window', { 
        url: dapp.url,
        title: dapp.name
      });
      
      console.log(`${dapp.name} opened in window:`, windowLabel);
    } catch (err) {
      console.error(`Failed to open ${dapp.name}:`, err);
      alert(`Failed to open ${dapp.name}: ${err}`);
    }
  };



  /**
   * Handle approval
   */
  const handleApprove = async (id: string): Promise<void> => {
    try {
      console.log('[WalletView] Approving request:', id);
      await invoke('respond_to_approval', { 
        response: { 
          id, 
          approved: true,
          data: null
        } 
      });
      console.log('[WalletView] Approval sent successfully');
      
      // Close modal immediately after approval
      setCurrentApproval(null);
      
      // Reload connected dApps to show new connection (don't await, do in background)
      loadConnectedDapps().catch(err => {
        console.error('[WalletView] Failed to reload connected dApps:', err);
      });
    } catch (err) {
      console.error('[WalletView] Failed to approve:', err);
      // Re-throw so ConnectionApproval can show the error
      throw err;
    }
  };

  /**
   * Handle rejection
   */
  const handleReject = async (id: string): Promise<void> => {
    try {
      console.log('[WalletView] Rejecting request:', id);
      await invoke('respond_to_approval', { 
        response: { 
          id, 
          approved: false,
          data: null
        } 
      });
      console.log('[WalletView] Rejection sent successfully');
      
      // Close modal immediately after rejection
      setCurrentApproval(null);
    } catch (err) {
      console.error('[WalletView] Failed to reject:', err);
      // Re-throw so ConnectionApproval can show the error
      throw err;
    }
  };

  /**
   * Close approval modal
   */
  const handleCloseApproval = () => {
    setCurrentApproval(null);
  };

  /**
   * Disconnect from a dApp
   */
  const handleDisconnect = async (origin: string) => {
    try {
      console.log('[WalletView] Disconnecting from:', origin);
      await invoke('disconnect_dapp_by_origin', { origin });
      // Reload connected dApps to update the list
      await loadConnectedDapps();
    } catch (err) {
      console.error('[WalletView] Failed to disconnect:', err);
      alert(`Failed to disconnect: ${err}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <h1 className="text-xl font-bold text-gradient">
              Vaughan
            </h1>

            {/* Network & Account Selectors */}
            <div className="flex items-center gap-3">
              <NetworkSelector />
              <AccountSelector />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Balance Display */}
          <section className="card">
            <BalanceDisplay />
          </section>

          {/* Action Buttons */}
          <section>
            <ActionButtons
              onSend={handleSend}
              onReceive={handleReceive}
            />
            
            {/* dApp Browser Button */}
            <div className="mt-4">
              <button
                onClick={handleDappBrowser}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                🌐 Open dApps
              </button>
            </div>
          </section>

          {/* Token List */}
          <section className="card">
            <h2 className="text-lg font-semibold mb-4 text-slate-100">
              Assets
            </h2>
            <TokenList />
          </section>

          {/* Connected dApps */}
          {connectedDapps.length > 0 && (
            <section className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-100">
                  Connected dApps ({connectedDapps.length})
                </h2>
                <button
                  onClick={() => setShowDapps(!showDapps)}
                  className="text-sm text-primary-400 hover:text-primary-300"
                >
                  {showDapps ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showDapps && (
                <div className="space-y-3">
                  {connectedDapps.map((dapp) => (
                    <div
                      key={`${dapp.window_label}-${dapp.origin}`}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {dapp.icon && (
                            <img src={dapp.icon} alt="" className="w-6 h-6 rounded" />
                          )}
                          <div>
                            <p className="font-medium text-slate-100">
                              {dapp.name || 'Unknown dApp'}
                            </p>
                            <p className="text-sm text-slate-400">
                              {dapp.origin}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Connected: {new Date(dapp.connected_at * 1000).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDisconnect(dapp.origin)}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* Approval Modals */}
      {currentApproval && currentApproval.request_type.type === 'connection' && (
        <ConnectionApproval
          id={currentApproval.id}
          origin={currentApproval.request_type.origin}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={handleCloseApproval}
        />
      )}

      {currentApproval && currentApproval.request_type.type === 'transaction' && (
        <TransactionApproval
          id={currentApproval.id}
          origin={currentApproval.request_type.origin}
          from={currentApproval.request_type.from}
          to={currentApproval.request_type.to}
          value={currentApproval.request_type.value}
          gasLimit={currentApproval.request_type.gasLimit}
          gasPrice={currentApproval.request_type.gasPrice}
          data={currentApproval.request_type.data}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={handleCloseApproval}
        />
      )}

      {/* dApp Selector Modal */}
      {showDappSelector && (
        <DappSelector
          onSelect={handleDappSelect}
          onClose={() => setShowDappSelector(false)}
        />
      )}
    </div>
  );
}
