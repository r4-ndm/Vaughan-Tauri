import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TauriService } from '../../services/tauri';

/**
 * SetupView - Wallet State Detection
 * 
 * Detects the current wallet state and routes to the appropriate view:
 * - No wallet → /create or /import
 * - Wallet locked → /unlock
 * - Wallet unlocked → / (main wallet view)
 */
export function SetupView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkWalletState = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if wallet exists
        const exists = await TauriService.walletExists();

        if (!exists) {
          // No wallet - show welcome screen
          return;
        }

        // Wallet exists - check if locked
        const locked = await TauriService.isWalletLocked();

        if (locked) {
          // Wallet locked - redirect to unlock
          navigate('/unlock', { replace: true });
        } else {
          // Wallet unlocked - redirect to main view
          navigate('/wallet', { replace: true });
        }
      } catch (err) {
        console.error('Failed to check wallet state:', err);
        setError(TauriService.getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    checkWalletState();
  }, [navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Checking wallet status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary w-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Welcome screen (no wallet exists)
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gradient mb-4">
            Vaughan Wallet
          </h1>
          <p className="text-xl text-slate-400">
            Your secure, multi-chain Ethereum wallet
          </p>
        </div>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Create New Wallet */}
          <button
            onClick={() => navigate('/create')}
            className="card hover:border-primary-500 transition-all duration-200 text-left group"
          >
            <div className="text-4xl mb-4">🆕</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary-400 transition-colors">
              Create New Wallet
            </h3>
            <p className="text-slate-400 text-sm">
              Generate a new wallet with a secure recovery phrase
            </p>
          </button>

          {/* Import Existing Wallet */}
          <button
            onClick={() => navigate('/import')}
            className="card hover:border-primary-500 transition-all duration-200 text-left group"
          >
            <div className="text-4xl mb-4">📥</div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary-400 transition-colors">
              Import Wallet
            </h3>
            <p className="text-slate-400 text-sm">
              Restore your wallet using a recovery phrase
            </p>
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-12 card bg-slate-800/50 border-slate-700">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔒</div>
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Security First</h4>
              <p className="text-sm text-slate-400">
                Your private keys are encrypted and stored securely in your system's keychain.
                Vaughan never sends your keys over the network.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
