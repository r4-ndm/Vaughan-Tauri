import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { TauriService } from '../../services/tauri';
import { validatePassword, validateMnemonic } from '../../utils/validation';

/**
 * ImportWalletView - Wallet Import Flow
 * 
 * Import existing wallet using recovery phrase:
 * 1. Enter mnemonic
 * 2. Set password
 * 3. Choose account count
 * 4. Success
 */
export function ImportWalletView() {
  const navigate = useNavigate();

  // Form state
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountCount, setAccountCount] = useState(1);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importedAddresses, setImportedAddresses] = useState<string[]>([]);

  // Validation errors
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Handle import
  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate mnemonic
    if (!validateMnemonic(mnemonic)) {
      setMnemonicError('Invalid recovery phrase (must be 12 or 24 words)');
      return;
    }
    setMnemonicError(null);

    // Validate password
    if (!validatePassword(password)) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordError(null);

    try {
      setLoading(true);
      setError(null);

      // Import wallet
      const addresses = await TauriService.importWallet({
        mnemonic: mnemonic.trim(),
        password,
        account_count: accountCount,
      });

      setImportedAddresses(addresses);
      setSuccess(true);
    } catch (err) {
      console.error('Failed to import wallet:', err);
      setError(TauriService.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Navigate to wallet
  const handleComplete = async () => {
    try {
      // Load accounts from the imported wallet
      const accounts = await TauriService.getAccounts();
      
      if (accounts.length > 0) {
        // Set the first account as active
        await TauriService.setActiveAccount(accounts[0].address);
      }
      
      // Navigate to wallet view
      navigate('/wallet', { replace: true });
    } catch (err) {
      console.error('Failed to load accounts:', err);
      // Still navigate, let WalletView handle the error
      navigate('/wallet', { replace: true });
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-3xl font-bold mb-2">Wallet Imported!</h2>
          <p className="text-slate-400">
            Successfully imported {importedAddresses.length} account{importedAddresses.length > 1 ? 's' : ''}
          </p>

          {/* Imported Addresses */}
          <div className="bg-slate-900 p-4 rounded-lg space-y-2">
            {importedAddresses.map((address, index) => (
              <div key={address} className="text-left">
                <div className="text-xs text-slate-500">Account {index + 1}</div>
                <div className="text-sm text-slate-300 font-mono break-all">
                  {address}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleComplete}
            className="btn btn-primary w-full"
          >
            Open Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/setup')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Import Wallet</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleImport} className="card space-y-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">📥</div>
            <h2 className="text-2xl font-bold mb-2">Restore Your Wallet</h2>
            <p className="text-slate-400">
              Enter your recovery phrase to restore your wallet
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Recovery Phrase */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Recovery Phrase
            </label>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter your 12 or 24 word recovery phrase"
              rows={4}
              className={`input ${mnemonicError ? 'border-red-500' : ''}`}
              required
            />
            {mnemonicError && (
              <p className="text-red-400 text-xs mt-1">{mnemonicError}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Separate words with spaces
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className={`input ${passwordError ? 'border-red-500' : ''}`}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              This will encrypt your wallet
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className={`input ${passwordError ? 'border-red-500' : ''}`}
              required
            />
            {passwordError && (
              <p className="text-red-400 text-xs mt-1">{passwordError}</p>
            )}
          </div>

          {/* Account Count */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Number of Accounts to Import
            </label>
            <input
              type="number"
              value={accountCount}
              onChange={(e) => setAccountCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              min={1}
              max={10}
              className="input"
            />
            <p className="text-xs text-slate-500 mt-1">
              Import 1-10 accounts (you can add more later)
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Importing Wallet...' : 'Import Wallet'}
          </button>

          {/* Security Notice */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-xl">🔒</div>
              <div className="flex-1 text-sm text-slate-400">
                Your recovery phrase is never sent over the network.
                It's used locally to restore your wallet.
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
