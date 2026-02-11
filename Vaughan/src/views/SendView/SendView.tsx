import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { TauriService } from '../../services/tauri';
import { 
  validateAddress, 
  validateAmount, 
  validateGasLimit, 
  validateGasPrice 
} from '../../utils/validation';

/**
 * SendView - Transaction Form
 * 
 * Allows users to send tokens to another address.
 * Includes validation, gas estimation, and transaction confirmation.
 */
export function SendView() {
  const navigate = useNavigate();

  // Form state
  const [fromAddress, setFromAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasLimit, setGasLimit] = useState('21000');
  const [gasPrice, setGasPrice] = useState('');
  const [password, setPassword] = useState('');
  const [symbol, setSymbol] = useState('ETH');

  // UI state
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Validation errors
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [gasLimitError, setGasLimitError] = useState<string | null>(null);
  const [gasPriceError, setGasPriceError] = useState<string | null>(null);

  // Load current account on mount
  useEffect(() => {
    const loadAccount = async () => {
      try {
        // Get network info for symbol
        const networkInfo = await TauriService.getNetworkInfo();
        setSymbol(networkInfo.native_token.symbol);

        // Get current account
        const accounts = await TauriService.getAccounts();
        if (accounts.length > 0) {
          setFromAddress(accounts[0].address);
        }
      } catch (err) {
        console.error('Failed to load account:', err);
      }
    };
    loadAccount();
  }, []);

  // Estimate gas
  const handleEstimateGas = async () => {
    if (!validateAddress(recipient)) {
      setError('Invalid recipient address');
      return;
    }

    if (!validateAmount(amount)) {
      setError('Invalid amount');
      return;
    }

    try {
      setEstimating(true);
      setError(null);

      const estimate = await TauriService.estimateGasSimple();
      setGasLimit(estimate.gas_limit.toString());
      setGasPrice(estimate.gas_price_gwei);
    } catch (err) {
      console.error('Gas estimation failed:', err);
      setError('Failed to estimate gas');
    } finally {
      setEstimating(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    let isValid = true;

    // Validate recipient
    if (!validateAddress(recipient)) {
      setRecipientError('Invalid Ethereum address');
      isValid = false;
    } else {
      setRecipientError(null);
    }

    // Validate amount
    if (!validateAmount(amount)) {
      setAmountError('Invalid amount');
      isValid = false;
    } else {
      setAmountError(null);
    }

    // Validate gas limit
    if (!validateGasLimit(gasLimit)) {
      setGasLimitError('Invalid gas limit (21000 - 10,000,000)');
      isValid = false;
    } else {
      setGasLimitError(null);
    }

    // Validate gas price
    if (!validateGasPrice(gasPrice)) {
      setGasPriceError('Invalid gas price (0.1 - 1000 Gwei)');
      isValid = false;
    } else {
      setGasPriceError(null);
    }

    // Validate password
    if (!password || password.length === 0) {
      setError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  // Handle send
  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Send transaction using the simplified API
      const result = await TauriService.sendTransaction({
        from: fromAddress,
        to: recipient,
        amount,
        gas_limit: parseInt(gasLimit),
        gas_price_gwei: gasPrice,
        password,
      });

      setTxHash(result.tx_hash);
      setSuccess(true);

      // Reset form and navigate back after 3 seconds
      setTimeout(() => {
        navigate('/wallet');
      }, 3000);
    } catch (err) {
      console.error('Transaction failed:', err);
      setError(TauriService.getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success && txHash) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Transaction Sent!</h2>
          <p className="text-slate-400 mb-4">
            Your transaction has been submitted to the network.
          </p>
          <div className="bg-slate-900 p-4 rounded-lg mb-6">
            <p className="text-xs text-slate-500 mb-1">Transaction Hash</p>
            <p className="text-sm text-slate-300 font-mono break-all">{txHash}</p>
          </div>
          <button
            onClick={() => navigate('/wallet')}
            className="btn btn-primary w-full"
          >
            Back to Wallet
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
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">Send Transaction</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSend} className="card space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className={`input ${recipientError ? 'border-red-500' : ''}`}
            />
            {recipientError && (
              <p className="text-red-400 text-xs mt-1">{recipientError}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Amount ({symbol})
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className={`input ${amountError ? 'border-red-500' : ''}`}
            />
            {amountError && (
              <p className="text-red-400 text-xs mt-1">{amountError}</p>
            )}
          </div>

          {/* Gas Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">Gas Settings</h3>
              <button
                type="button"
                onClick={handleEstimateGas}
                disabled={estimating}
                className="text-sm text-primary-400 hover:text-primary-300 disabled:opacity-50"
              >
                {estimating ? 'Estimating...' : 'Estimate Gas'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Gas Limit */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Gas Limit
                </label>
                <input
                  type="text"
                  value={gasLimit}
                  onChange={(e) => setGasLimit(e.target.value)}
                  placeholder="21000"
                  className={`input ${gasLimitError ? 'border-red-500' : ''}`}
                />
                {gasLimitError && (
                  <p className="text-red-400 text-xs mt-1">{gasLimitError}</p>
                )}
              </div>

              {/* Gas Price */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Gas Price (Gwei)
                </label>
                <input
                  type="text"
                  value={gasPrice}
                  onChange={(e) => setGasPrice(e.target.value)}
                  placeholder="20"
                  className={`input ${gasPriceError ? 'border-red-500' : ''}`}
                />
                {gasPriceError && (
                  <p className="text-red-400 text-xs mt-1">{gasPriceError}</p>
                )}
              </div>
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
              placeholder="Enter your password"
              className="input"
            />
            <p className="text-xs text-slate-500 mt-1">
              Required to sign the transaction
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Sending...' : 'Send Transaction'}
          </button>
        </form>
      </main>
    </div>
  );
}
