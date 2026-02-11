import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { QRCodeSVG } from 'qrcode.react';
import { TauriService } from '../../services/tauri';

/**
 * ReceiveView - QR Code Display
 * 
 * Displays the current account address as a QR code for receiving funds.
 */
export function ReceiveView() {
  const navigate = useNavigate();
  const [address, setAddress] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current account address
  useEffect(() => {
    const loadAddress = async () => {
      try {
        setLoading(true);
        setError(null);
        const accounts = await TauriService.getAccounts();
        
        if (accounts.length === 0) {
          setError('No accounts found');
          return;
        }

        // Get the first account (active account)
        setAddress(accounts[0].address);
      } catch (err) {
        console.error('Failed to load address:', err);
        setError(TauriService.getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadAddress();
  }, []);

  // Copy address to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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
            <h1 className="text-xl font-bold">Receive</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="card text-center space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
              <p className="text-slate-400 mt-4">Loading address...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="btn btn-secondary mt-6"
              >
                Back to Wallet
              </button>
            </div>
          )}

          {/* Success State */}
          {!loading && !error && address && (
            <>
              {/* Title */}
              <div>
                <h2 className="text-2xl font-bold mb-2">Receive Funds</h2>
                <p className="text-slate-400">
                  Scan this QR code or copy the address below
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center py-6">
                <div className="bg-white p-6 rounded-2xl shadow-xl">
                  <QRCodeSVG
                    value={address}
                    size={256}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <p className="text-sm text-slate-400 font-medium">
                  Your Address
                </p>
                <div className="bg-slate-900 p-4 rounded-lg">
                  <p className="text-sm text-slate-300 font-mono break-all">
                    {address}
                  </p>
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
                      <span>Copy Address</span>
                    </>
                  )}
                </button>
              </div>

              {/* Warning */}
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-left">
                <p className="text-yellow-400 text-sm">
                  <strong>⚠️ Important:</strong> Only send assets from the same network.
                  Sending from a different network may result in permanent loss of funds.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
