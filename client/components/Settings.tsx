import React, { useState, useEffect } from "react";
import { X, Save, Eye, EyeOff, Plus, Lock } from "lucide-react";
import {
  getSettings,
  setSettings,
  AppSettings,
  DEFAULT_IMMUTABLE_SECTIONS,
  SUGGESTED_SECTIONS,
} from "@/utils/storage";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettingsState] = useState<AppSettings>({
    geminiApiKey: "",
    customInstructions: "",
    resumeContentSections: [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [showProcessingMessage, setShowProcessingMessage] = useState(false);

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
    setShowProcessingMessage(false);

    try {
      if (!settings.geminiApiKey.trim()) {
        setError("Please enter a Gemini API key");
        setIsSaving(false);
        return;
      }

      console.log("[Settings] Saving settings:", settings);

      // Save to local storage first
      await setSettings(settings);
      console.log("[Settings] Settings saved to local storage");

      // Try to save to chrome.storage.sync via the extension content script
      // The web app is on localhost, so it needs the content script to relay messages
      if (typeof chrome !== "undefined" && chrome.runtime) {
        try {
          console.log(
            "[Settings] Attempting to save settings to chrome.storage via extension...",
          );

          // Try to send directly first (in case we're in an extension context)
          const sendViaExtension = (): Promise<boolean> => {
            return new Promise((resolve) => {
              try {
                chrome.runtime.sendMessage(
                  {
                    action: "saveSettings",
                    settings: settings,
                  },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      console.warn(
                        "[Settings] Direct extension call not available:",
                        chrome.runtime.lastError?.message,
                      );
                      resolve(false);
                    } else if (response?.success) {
                      console.log(
                        "[Settings] ✓ Settings saved to chrome.storage.sync via extension",
                      );
                      resolve(true);
                    } else {
                      console.warn(
                        "[Settings] Extension returned unsuccessful response:",
                        response,
                      );
                      resolve(false);
                    }
                  },
                );
              } catch (e) {
                console.warn("[Settings] Direct extension call failed:", e);
                resolve(false);
              }
            });
          };

          const success = await sendViaExtension();
          if (!success) {
            console.log(
              "[Settings] Direct extension call didn't work (expected for web app context)",
            );
          }
        } catch (e) {
          console.warn(
            "[Settings] Could not save to chrome.storage via extension:",
            e,
          );
        }
      } else {
        console.log("[Settings] chrome.runtime not available - running in web-only mode");
      }

      setSaveSuccess(true);

      // Show processing message if user added custom sections
      if (settings.resumeContentSections.length > 0) {
        setShowProcessingMessage(true);
      }

      setTimeout(() => {
        setSaveSuccess(false);
        setShowProcessingMessage(false);
        onClose();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();

      if (
        !settings.resumeContentSections.includes(newTag) &&
        !DEFAULT_IMMUTABLE_SECTIONS.includes(newTag)
      ) {
        setSettingsState({
          ...settings,
          resumeContentSections: [...settings.resumeContentSections, newTag],
        });
      }
      setTagInput("");
    }
  };

  const handleQuickAdd = (section: string) => {
    if (!settings.resumeContentSections.includes(section)) {
      setSettingsState({
        ...settings,
        resumeContentSections: [...settings.resumeContentSections, section],
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSettingsState({
      ...settings,
      resumeContentSections: settings.resumeContentSections.filter(
        (tag) => tag !== tagToRemove,
      ),
    });
  };

  // Get suggested sections that haven't been added yet
  const availableSuggestions = SUGGESTED_SECTIONS.filter(
    (section) =>
      !settings.resumeContentSections.includes(section) &&
      !DEFAULT_IMMUTABLE_SECTIONS.includes(section),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
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

          {/* Resume Content Sections */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-3">
                Resume Sections to Include
              </label>

              {/* Default Immutable Sections */}
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Always Included (Required)
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_IMMUTABLE_SECTIONS.map((section) => (
                    <div
                      key={section}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary/15 text-primary text-sm font-medium border border-primary/30"
                    >
                      <Lock className="h-3 w-3" />
                      {section}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Added Sections */}
              {settings.resumeContentSections.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Added Sections ({settings.resumeContentSections.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {settings.resumeContentSections.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20 hover:bg-primary/15 transition-colors"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="text-primary/70 hover:text-primary transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag Input */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-3">
                  Type a section name and press Enter to add a custom section
                </p>
                <div className="relative">
                  <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background focus-within:ring-2 focus-within:ring-primary">
                    <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Add custom section..."
                      className="flex-1 bg-transparent text-foreground text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Suggested Sections */}
              {availableSuggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Quick Add Suggestions (Click to add)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableSuggestions.map((section) => (
                      <button
                        key={section}
                        onClick={() => handleQuickAdd(section)}
                        className="px-3 py-1.5 rounded-full bg-muted text-foreground text-xs font-medium border border-border hover:bg-muted/80 hover:border-primary/50 transition-all cursor-pointer"
                      >
                        + {section}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Message */}
          {settings.resumeContentSections.length > 0 && (
            <div className="p-4 rounded-lg bg-blue-600/10 border border-blue-600/20">
              <p className="text-xs text-blue-600 font-medium">
                💡 We will process the resume if your uploaded resume has
                potential content related to the added sections.
              </p>
            </div>
          )}

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

          {showProcessingMessage && (
            <div className="p-3 rounded-lg bg-amber-600/10 border border-amber-600/20">
              <p className="text-sm text-amber-600">
                ⚠️ We will process the resume if your uploaded resume has
                potential content related to the added sections.
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
