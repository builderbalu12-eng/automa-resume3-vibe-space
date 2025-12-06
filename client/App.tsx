import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { Dashboard } from "./pages/Dashboard";
import { UploadResume } from "./pages/UploadResume";
import { TailorResume } from "./pages/TailorResume";
import { History } from "./pages/History";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { NotFound } from "./pages/NotFound";
import { Settings } from "./components/Settings";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        {/* Settings Button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="fixed top-4 right-4 z-40 p-2 rounded-lg bg-muted hover:bg-muted/80 border border-border transition-colors"
          title="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>

        {/* Settings Modal */}
        <Settings
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadResume />} />
          <Route path="/tailor" element={<TailorResume />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
