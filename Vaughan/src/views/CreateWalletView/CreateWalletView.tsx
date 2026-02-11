import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { TauriService } from '../../services/tauri';
import { validatePassword } from '../../utils/validation';

/**
 * CreateWalletView - Wallet Creation Flow
 * 
 * Multi-step process:
 * 1. Set password
 * 2. Choose word count (12 or 24)
 * 3. Display mnemonic (BACKUP CRITICAL)
 * 4. Confirm backup
 * 5. Success
 */
export function CreateWalletView() {
  const navigate = useNavigate();

  // Step state
  const [step, setStep] = useState<'password' | 'mnemonic' | 'confirm' | 'success'>('password');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [mnemonic, setMnemonic] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation errors
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Step 1: Set Password
  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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

      // Create wallet
      const mnemonicPhrase = await TauriService.createWallet({
        password,
        word_count: wordCount,
      });

      setMnemonic(mnemonicPhrase);
      setStep('mnemonic');
    } catch (err) {
      console.error('Failed to create wallet:', err);
      setError(TauriService.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Copy mnemonic to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Confirm backup
  const handleConfirm = () => {
    if (!confirmed) {
      setError('Please confirm that you have backed up your recovery phrase');
      return;
    }
    setStep('success');
  };

  // Navigate to wallet
  const handleComplete = async () => {
    try {
      // Load accounts from the newly created wallet
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            {step === 'password' && (
              <button
                onClick={() => navigate('/setup')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold">Create New Wallet</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Step 1: Password */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="card space-y-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🔐</div>
              <h2 className="text-2xl font-bold mb-2">Set Your Password</h2>
              <p className="text-slate-400">
                This password encrypts your wallet. Choose a strong password.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Word Count */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Recovery Phrase Length
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWordCount(12)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    wordCount === 12
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="font-bold text-lg">12 Words</div>
                  <div className="text-xs text-slate-400">Standard</div>
                </button>
                <button
                  type="button"
                  onClick={() => setWordCount(24)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    wordCount === 24
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="font-bold text-lg">24 Words</div>
                  <div className="text-xs text-slate-400">Extra Secure</div>
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={`input ${passwordError ? 'border-red-500' : ''}`}
                required
              />
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Creating Wallet...' : 'Create Wallet'}
            </button>
          </form>
        )}

        {/* Step 2: Mnemonic Display */}
        {step === 'mnemonic' && (
          <div className="card space-y-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">📝</div>
              <h2 className="text-2xl font-bold mb-2">Backup Your Recovery Phrase</h2>
              <p className="text-slate-400">
                Write down these {wordCount} words in order. Keep them safe and secret.
              </p>
            </div>

            {/* Warning */}
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                <strong>⚠️ Critical:</strong> Anyone with this phrase can access your funds.
                Never share it. Store it offline in a secure location.
              </p>
            </div>

            {/* Mnemonic Grid */}
            <div className="bg-slate-900 p-6 rounded-lg">
              <div className="grid grid-cols-3 gap-3">
                {mnemonic.split(' ').map((word, index) => (
                  <div
                    key={index}
                    className="bg-slate-800 p-3 rounded-lg text-center"
                  >
                    <div className="text-xs text-slate-500 mb-1">{index + 1}</div>
                    <div className="font-mono font-semibold">{word}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-5 h-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="w-5 h-5" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>

            {/* Next Button */}
            <button
              onClick={() => setStep('confirm')}
              className="btn btn-primary w-full"
            >
              I've Backed It Up
            </button>
          </div>
        )}

        {/* Step 3: Confirm Backup */}
        {step === 'confirm' && (
          <div className="card space-y-6">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold mb-2">Confirm Backup</h2>
              <p className="text-slate-400">
                Make sure you've safely stored your recovery phrase
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Confirmation Checklist */}
            <div className="space-y-4">
              <label className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium mb-1">
                    I have written down my recovery phrase
                  </div>
                  <div className="text-sm text-slate-400">
                    I understand that if I lose it, I will lose access to my funds
                  </div>
                </div>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('mnemonic')}
                className="btn btn-secondary flex-1"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={!confirmed}
                className="btn btn-primary flex-1"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="card text-center space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold mb-2">Wallet Created!</h2>
            <p className="text-slate-400 text-lg">
              Your wallet is ready to use
            </p>
            <button
              onClick={handleComplete}
              className="btn btn-primary w-full"
            >
              Open Wallet
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
