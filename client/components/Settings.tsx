import React, { useState, useEffect } from "react";
import { X, Save, Eye, EyeOff } from "lucide-react";
import { getSettings, setSettings, AppSettings } from "@/utils/storage";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettingsState] = useState<AppSettings>({
    geminiApiKey: "",
    customInstructions: "",
    resumeContentPreferences: {
      includeCertifications: true,
      includeAchievements: true,
      includePublications: true,
      includeHobbies: true,
      includeProjects: true,
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const saved = await getSettings();
      if (saved) {
        setSettingsState(saved);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      setError("Failed to load settings");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      if (!settings.geminiApiKey.trim()) {
        setError("Please enter a Gemini API key");
        setIsSaving(false);
        return;
      }

      await setSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferenceChange = (
    key: keyof AppSettings["resumeContentPreferences"],
  ) => {
    setSettingsState({
      ...settings,
      resumeContentPreferences: {
        ...settings.resumeContentPreferences,
        [key]: !settings.resumeContentPreferences[key],
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* API Key Section */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              Gemini API Key
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Get your free API key from{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google AI Studio
              </a>
            </p>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={settings.geminiApiKey}
                onChange={(e) =>
                  setSettingsState({
                    ...settings,
                    geminiApiKey: e.target.value,
                  })
                }
                placeholder="Enter your Gemini API key..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Custom Instructions */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              Custom Instructions
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Add custom guidelines for resume tailoring (optional)
            </p>
            <textarea
              value={settings.customInstructions}
              onChange={(e) =>
                setSettingsState({
                  ...settings,
                  customInstructions: e.target.value,
                })
              }
              placeholder="E.g., Prioritize cloud technologies, highlight leadership experience..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={4}
            />
          </div>

          {/* Resume Content Preferences */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              What to Include in Tailored Resumes
            </label>
            <div className="space-y-3">
              {[
                {
                  key: "includeCertifications",
                  label: "Certifications",
                  description: "Include relevant certifications",
                },
                {
                  key: "includeAchievements",
                  label: "Achievements",
                  description: "Include awards and achievements",
                },
                {
                  key: "includePublications",
                  label: "Publications",
                  description: "Include research/article publications",
                },
                {
                  key: "includeProjects",
                  label: "Projects",
                  description: "Include side projects and portfolios",
                },
                {
                  key: "includeHobbies",
                  label: "Hobbies & Interests",
                  description: "Include personal interests",
                },
              ].map((pref) => (
                <div key={pref.key} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={pref.key}
                    checked={
                      settings.resumeContentPreferences[
                        pref.key as keyof AppSettings["resumeContentPreferences"]
                      ]
                    }
                    onChange={() =>
                      handlePreferenceChange(
                        pref.key as keyof AppSettings["resumeContentPreferences"],
                      )
                    }
                    className="mt-1 w-4 h-4 rounded border-border accent-primary"
                  />
                  <label htmlFor={pref.key} className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">{pref.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {pref.description}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-lg bg-green-600/10 border border-green-600/20">
              <p className="text-sm text-green-600">
                ✓ Settings saved successfully!
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:shadow-glow transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
