/**
 * WalletConnect Modal Component
 * 
 * Displays QR code and connection status for WalletConnect
 */

// import { QRCodeSVG } from 'qrcode.react'; // Unused - WalletConnect removed
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface WalletConnectModalProps {
  /** WalletConnect URI for QR code */
  uri: string;
  /** Whether connection is in progress */
  connecting: boolean;
  /** dApp URL being connected to */
  dappUrl?: string;
  /** Callback to close modal */
  onClose: () => void;
}

export function WalletConnectModal({
  connecting,
  dappUrl,
  onClose,
}: WalletConnectModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            Connect with WalletConnect
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info */}
          <div className="mb-6">
            <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-4">
              <p className="text-yellow-100 text-sm font-medium mb-2">
                ⚠️ This dApp blocks iframe embedding
              </p>
              <p className="text-yellow-200 text-xs">
                Due to Content Security Policy (CSP), this dApp cannot be loaded in an iframe.
              </p>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              To use this dApp with Vaughan Wallet:
            </p>
            {dappUrl && (
              <p className="text-blue-400 text-sm mt-2 break-all font-mono bg-gray-900 p-2 rounded">
                {dappUrl}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-white font-medium mb-3">📱 Connection Steps:</h3>
            <ol className="text-gray-300 text-sm space-y-3 list-decimal list-inside">
              <li>
                <span className="font-medium text-white">Open the dApp</span>
                <br />
                <span className="text-gray-400 text-xs ml-5">Copy the URL above and open it in your browser</span>
              </li>
              <li>
                <span className="font-medium text-white">Click "Connect Wallet"</span>
                <br />
                <span className="text-gray-400 text-xs ml-5">Look for the wallet connection button</span>
              </li>
              <li>
                <span className="font-medium text-white">Select "WalletConnect"</span>
                <br />
                <span className="text-gray-400 text-xs ml-5">Choose WalletConnect from the wallet options</span>
              </li>
              <li>
                <span className="font-medium text-white">Scan QR code</span>
                <br />
                <span className="text-gray-400 text-xs ml-5">The dApp will show a QR code - Vaughan will detect it automatically</span>
              </li>
              <li>
                <span className="font-medium text-white">Approve connection</span>
                <br />
                <span className="text-gray-400 text-xs ml-5">Vaughan will prompt you to approve the connection</span>
              </li>
            </ol>
          </div>

          {/* Status */}
          {connecting ? (
            <div className="flex items-center justify-center gap-2 text-blue-400 py-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
              <span className="text-sm">Waiting for dApp to initiate connection...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-3">
              <span className="text-sm">Ready to receive WalletConnect requests</span>
            </div>
          )}

          {/* URL Copy */}
          <div className="mt-4">
            <button
              onClick={() => {
                if (dappUrl) {
                  navigator.clipboard.writeText(dappUrl);
                }
              }}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              📋 Copy dApp URL
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-900 rounded-b-lg">
          <p className="text-gray-400 text-xs text-center">
            WalletConnect provides secure, encrypted connections between your wallet and dApps
          </p>
        </div>
      </div>
    </div>
  );
}
