import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { WalletService, ActivityService } from "./services/tauri";
import Unlock from "./pages/Unlock";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import { SendConfirmView } from "./views/SendView";
import Receive from "./pages/Receive";
import DApps from "./pages/DApps";
import Settings from "./pages/Settings";
import { HistoryView } from "./views/HistoryView";

function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const exists = await WalletService.walletExists();
        if (!cancelled) {
          navigate(exists ? "/unlock" : "/onboarding", { replace: true });
        }
      } catch (error) {
        console.error("Failed to check wallet:", error);
        if (!cancelled) {
          navigate("/onboarding", { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <img src="/vaughan-logo.png" alt="VAUGHAN" className="w-full max-w-md mb-8 select-none" draggable={false} />
      <div className="bg-card p-6 border border-border max-w-sm w-full">
        <p className="text-muted-foreground text-center mb-6">Secure, Fast, Private.</p>
        <p className="text-center text-sm text-muted-foreground">
          {loading ? "Checking wallet…" : "Redirecting…"}
        </p>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    const report = () => ActivityService.reportActivity();
    window.addEventListener("click", report);
    window.addEventListener("keydown", report);
    window.addEventListener("focus", report);
    return () => {
      window.removeEventListener("click", report);
      window.removeEventListener("keydown", report);
      window.removeEventListener("focus", report);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/unlock" element={<Unlock />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/send-confirm" element={<SendConfirmView />} />
      <Route path="/receive" element={<Receive />} />
      <Route path="/dapps" element={<DApps />} />
      <Route path="/history" element={<HistoryView />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}

export default App;
