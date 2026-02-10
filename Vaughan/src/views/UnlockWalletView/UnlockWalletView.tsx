import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TauriService } from '../../services/tauri';

/**
 * UnlockWalletView - Wallet Unlock Screen
 * 
 * Prompts user to enter password to unlock their wallet.
 */
export function UnlockWalletView() {
  const navigate = useNavigate();

  // Form state
  const [password, setPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle unlock
  const handleUnlock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!password) {
      setError('Password is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Unlock wallet
      console.log('🔓 Unlocking wallet...');
      await TauriService.unlockWallet(password);
      console.log('✅ Wallet unlocked');

      // Load accounts and set first as active
      console.log('📋 Loading accounts...');
      const accounts = await TauriService.getAccounts();
      console.log('✅ Accounts loaded:', accounts);
      
      if (accounts.length > 0) {
        console.log('🎯 Setting active account:', accounts[0].address);
        await TauriService.setActiveAccount(accounts[0].address);
        console.log('✅ Active account set');
      } else {
        console.warn('⚠️ No accounts found after unlock');
      }

      // Navigate to main view
      console.log('🚀 Navigating to wallet view');
      navigate('/wallet', { replace: true });
    } catch (err) {
      console.error('❌ Failed to unlock wallet:', err);
      setError(TauriService.getErrorMessage(err));
      setPassword(''); // Clear password on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="card max-w-md w-full">
        <form onSubmit={handleUnlock} className="space-y-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
            <p className="text-slate-400">
              Enter your password to unlock your wallet
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="input"
              autoFocus
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Unlocking...' : 'Unlock Wallet'}
          </button>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-sm text-slate-500">
              Forgot your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/setup')}
                className="text-primary-400 hover:text-primary-300"
              >
                Restore from recovery phrase
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
