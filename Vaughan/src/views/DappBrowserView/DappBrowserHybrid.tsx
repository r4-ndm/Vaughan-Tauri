/**
 * DappBrowserHybrid Component
 * 
 * ⚠️ DEPRECATED - Legacy component, not actively used
 * Use DappBrowserSimple instead (WebSocket-based, CSP bypass)
 * 
 * This component relied on WalletConnect which was removed during cleanup.
 * Kept for reference only.
 */

export function DappBrowserHybrid() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
      <div className="text-center max-w-md p-8">
        <h1 className="text-2xl font-bold mb-4">⚠️ Deprecated Component</h1>
        <p className="text-slate-400 mb-4">
          This dApp browser implementation is deprecated.
        </p>
        <p className="text-slate-400">
          Please use the main dApp browser which uses WebSocket-based provider injection with CSP bypass.
        </p>
      </div>
    </div>
  );
}
