import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
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
  const [loading, setLoading] = useState(false);

  const handleGetStarted = async () => {
    setLoading(true);
    try {
      const exists = await invoke("wallet_exists");
      if (exists) {
        navigate("/unlock");
      } else {
        navigate("/onboarding");
      }
    } catch (error) {
      console.error("Failed to check wallet:", error);
      navigate("/onboarding");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <img src="/vaughan-logo.png" alt="VAUGHAN" className="w-full max-w-md mb-8 select-none" draggable={false} />
      <div className="bg-card p-6 border border-border max-w-sm w-full">
        <p className="text-muted-foreground text-center mb-6">Secure, Fast, Private.</p>
        <button
          onClick={handleGetStarted}
          disabled={loading}
          className="w-full vaughan-btn text-center disabled:opacity-50"
        >
          {loading ? "Checking..." : "Get Started"}
        </button>
      </div>
    </div>
  );
}

function App() {
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
