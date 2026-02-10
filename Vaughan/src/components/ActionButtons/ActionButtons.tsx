import { 
  PaperAirplaneIcon, 
  QrCodeIcon, 
  GlobeAltIcon 
} from '@heroicons/react/24/outline';

/**
 * ActionButtons Component
 * 
 * Displays primary action buttons for the wallet.
 * - Send: Send tokens to another address
 * - Receive: Show QR code to receive tokens
 * - dApp Browser: Open dApp browser
 */

interface ActionButtonsProps {
  onSend?: () => void;
  onReceive?: () => void;
  onDappBrowser?: () => void;
}

export function ActionButtons({ 
  onSend, 
  onReceive, 
  onDappBrowser 
}: ActionButtonsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Send Button */}
      <button
        onClick={onSend}
        className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
      >
        <div className="w-12 h-12 rounded-full bg-primary-500/20 group-hover:bg-primary-500/30 flex items-center justify-center transition-colors">
          <PaperAirplaneIcon className="w-6 h-6 text-primary-400" />
        </div>
        <span className="text-sm font-medium text-slate-100">Send</span>
      </button>

      {/* Receive Button */}
      <button
        onClick={onReceive}
        className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
      >
        <div className="w-12 h-12 rounded-full bg-green-500/20 group-hover:bg-green-500/30 flex items-center justify-center transition-colors">
          <QrCodeIcon className="w-6 h-6 text-green-400" />
        </div>
        <span className="text-sm font-medium text-slate-100">Receive</span>
      </button>

      {/* dApp Browser Button */}
      <button
        onClick={onDappBrowser}
        className="flex flex-col items-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
      >
        <div className="w-12 h-12 rounded-full bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center transition-colors">
          <GlobeAltIcon className="w-6 h-6 text-purple-400" />
        </div>
        <span className="text-sm font-medium text-slate-100">dApps</span>
      </button>
    </div>
  );
}
