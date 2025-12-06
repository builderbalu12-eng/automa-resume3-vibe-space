import { ResumeData, User } from "@/types";

export interface AppSettings {
  geminiApiKey: string;
  customInstructions: string;
  resumeContentSections: string[];
}

export const DEFAULT_IMMUTABLE_SECTIONS = ["Experience", "Education", "Skills"];

export const SUGGESTED_SECTIONS = [
  "Professional Summary",
  "Leadership Experience",
  "Key Accomplishments",
  "Certifications",
  "Technical Stack",
  "Open Source Contributions",
  "Presentations and Speaking Engagements",
  "Patents and Innovations",
  "Soft Skills Summary",
  "Career Highlights",
  "Core Competencies",
  "Testimonials or Recommendations",
  "Freelance or Consulting Projects",
  "Teaching Experience",
  "Research Interests",
  "Performance Metrics and KPIs",
  "Exhibitions",
  "Sales Achievements",
  "Policy Work",
  "Course Projects",
];

const STORAGE_KEYS = {
  USER_ID: "resumematch_user_id",
  MASTER_RESUME: "resumematch_master_resume",
  AUTH_TOKEN: "resumematch_auth_token",
  GEMINI_API_KEY: "resumematch_gemini_key",
  LAST_SYNC: "resumematch_last_sync",
  APP_SETTINGS: "resumematch_settings",
};

export async function saveToStorage(key: string, value: any): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [key]: JSON.stringify(value) }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } else {
    // Fallback to localStorage in web app
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export async function getFromStorage(key: string): Promise<any> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const value = result[key];
          resolve(value ? JSON.parse(value) : null);
        }
      });
    });
  } else {
    // Fallback to localStorage in web app
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }
}

export async function removeFromStorage(key: string): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } else {
    // Fallback to localStorage in web app
    localStorage.removeItem(key);
  }
}

export async function getUserId(): Promise<string | null> {
  return getFromStorage(STORAGE_KEYS.USER_ID);
}

export async function setUserId(userId: string): Promise<void> {
  return saveToStorage(STORAGE_KEYS.USER_ID, userId);
}

export async function getMasterResume(): Promise<ResumeData | null> {
  console.log("[Storage] Attempting to get master resume...");

  // Try to get from chrome.storage.sync first (extension context, works across extension pages)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    try {
      const result = await new Promise<ResumeData | null>((resolve, reject) => {
        chrome.storage.sync.get([STORAGE_KEYS.MASTER_RESUME], (syncResult) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[Storage] Chrome runtime error when reading from sync:",
              chrome.runtime.lastError.message,
            );
            reject(chrome.runtime.lastError);
          } else {
            const value = syncResult[STORAGE_KEYS.MASTER_RESUME];
            console.log(
              `[Storage] chrome.storage.sync result for key "${STORAGE_KEYS.MASTER_RESUME}":`,
              value ? `Found (${typeof value})` : "NOT FOUND",
            );
            if (value) {
              try {
                const resume =
                  typeof value === "string" ? JSON.parse(value) : value;
                console.log(
                  `[Storage] ✓ Resume parsed from chrome.storage.sync: ${resume.contact?.name}`,
                );
                resolve(resume);
              } catch (e) {
                console.warn(
                  "[Storage] Failed to parse chrome.storage resume:",
                  e,
                );
                resolve(null);
              }
            } else {
              console.warn(
                "[Storage] chrome.storage.sync has no value for MASTER_RESUME key",
              );
              resolve(null);
            }
          }
        });
      });

      if (result) {
        return result;
      }
    } catch (e) {
      console.warn(
        "[Storage] Failed to get from chrome.storage.sync:",
        e instanceof Error ? e.message : String(e),
      );
    }
  } else {
    console.warn("[Storage] chrome.storage.sync not available in this context");
  }

  // Fallback to localStorage (web app context)
  try {
    console.log("[Storage] Trying localStorage as fallback...");
    const stored = localStorage.getItem(STORAGE_KEYS.MASTER_RESUME);
    if (stored) {
      const resume = JSON.parse(stored);
      console.log(
        `[Storage] ✓ Resume retrieved from localStorage: ${resume.contact?.name}`,
      );

      // NOTE: Do NOT sync from localStorage to chrome.storage here
      // This could cause old data to be re-synced and overwrite newer data
      // chrome.storage.sync is the source of truth for the extension
      // If it's empty, the extension should show "No Master Resume" instead

      return resume;
    } else {
      console.warn("[Storage] localStorage has no MASTER_RESUME");
    }
  } catch (e) {
    console.warn(
      "[Storage] Failed to get from localStorage:",
      e instanceof Error ? e.message : String(e),
    );
  }

  console.error("[Storage] ✗ No master resume found in any storage");
  return null;
}

export async function setMasterResume(resume: ResumeData): Promise<void> {
  const resumeJson = JSON.stringify(resume);
  const resumeSize = new Blob([resumeJson]).size;

  console.log(
    `[Storage] Setting master resume for: ${resume.contact.name}, Size: ${(resumeSize / 1024).toFixed(2)}KB`,
  );

  // Save to localStorage first (works in all contexts)
  try {
    localStorage.setItem(STORAGE_KEYS.MASTER_RESUME, resumeJson);
    console.log(
      `[Storage] Resume saved to localStorage (${(resumeSize / 1024).toFixed(2)}KB)`,
    );
  } catch (e) {
    console.warn("[Storage] Failed to save to localStorage:", e);
  }

  // Also save to chrome.storage.sync if available (for extension popup access)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    return new Promise<void>((resolve) => {
      // Check size before saving (chrome.storage.sync has ~5MB limit per item)
      if (resumeSize > 4 * 1024 * 1024) {
        // 4MB safety threshold
        console.warn(
          `[Storage] Resume too large for chrome.storage.sync: ${(resumeSize / 1024).toFixed(2)}KB`,
        );
        // Still resolve - localStorage is saved which is the fallback
        resolve();
        return;
      }

      // IMPORTANT: Use chrome.storage.sync.set() with force flag to overwrite old data
      // We do NOT use remove() first because it creates a race condition
      // set() will automatically overwrite the existing value
      console.log(
        `[Storage] Saving resume to chrome.storage.sync (will overwrite existing data)...`,
      );

      chrome.storage.sync.set(
        { [STORAGE_KEYS.MASTER_RESUME]: resumeJson },
        () => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Storage] Error saving resume to chrome.storage.sync:",
              chrome.runtime.lastError.message,
            );
            // Log the error but still resolve since localStorage is saved
            resolve();
          } else {
            console.log(
              `[Storage] ✓ Resume successfully saved to chrome.storage.sync (${(resumeSize / 1024).toFixed(2)}KB)`,
            );

            // Verify the data was actually written
            chrome.storage.sync.get([STORAGE_KEYS.MASTER_RESUME], (result) => {
              const savedData = result[STORAGE_KEYS.MASTER_RESUME];
              if (savedData) {
                try {
                  const savedResume =
                    typeof savedData === "string"
                      ? JSON.parse(savedData)
                      : savedData;
                  console.log(
                    `[Storage] ✓ Verification: chrome.storage.sync now contains resume for: ${savedResume.contact?.name}`,
                  );
                } catch (e) {
                  console.warn("[Storage] Could not verify saved data:", e);
                }
              } else {
                console.warn(
                  "[Storage] WARNING: Data was not found after saving!",
                );
              }
              resolve();
            });
          }
        },
      );
    });
  }

  // If chrome.storage is not available, just resolve (localStorage is enough)
  return Promise.resolve();
}

export async function getAuthToken(): Promise<string | null> {
  return getFromStorage(STORAGE_KEYS.AUTH_TOKEN);
}

export async function setAuthToken(token: string): Promise<void> {
  return saveToStorage(STORAGE_KEYS.AUTH_TOKEN, token);
}

export async function getGeminiApiKey(): Promise<string | null> {
  return getFromStorage(STORAGE_KEYS.GEMINI_API_KEY);
}

export async function setGeminiApiKey(key: string): Promise<void> {
  return saveToStorage(STORAGE_KEYS.GEMINI_API_KEY, key);
}

export async function clearAllStorage(): Promise<void> {
  const keys = Object.values(STORAGE_KEYS);

  // Clear localStorage
  keys.forEach((key) => localStorage.removeItem(key as string));
  console.log("[Storage] All data cleared from localStorage");

  if (typeof chrome !== "undefined" && chrome.storage) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Storage] Error clearing chrome.storage.sync:",
            chrome.runtime.lastError.message,
          );
          reject(chrome.runtime.lastError);
        } else {
          console.log("[Storage] ✓ All data cleared from chrome.storage.sync");
          resolve();
        }
      });
    });
  }
}

export async function forceSyncMasterResume(resume: ResumeData): Promise<void> {
  console.log("[Storage] Force syncing master resume to all storage...");

  // First, completely clear the old data
  const resumeJson = JSON.stringify(resume);
  localStorage.setItem(STORAGE_KEYS.MASTER_RESUME, resumeJson);
  console.log("[Storage] Resume cleared and re-saved to localStorage");

  // Then save to chrome.storage with explicit overwrite
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    return new Promise<void>((resolve) => {
      // Step 1: Remove any old data first
      chrome.storage.sync.remove([STORAGE_KEYS.MASTER_RESUME], () => {
        console.log("[Storage] Old resume removed from chrome.storage.sync");

        // Step 2: Wait a tiny bit to ensure remove completes
        setTimeout(() => {
          // Step 3: Save the new data
          chrome.storage.sync.set(
            { [STORAGE_KEYS.MASTER_RESUME]: resumeJson },
            () => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[Storage] Error in force sync:",
                  chrome.runtime.lastError.message,
                );
                resolve();
                return;
              }

              console.log("[Storage] ✓ Resume saved in force sync");

              // Step 4: Verify it was written
              chrome.storage.sync.get(
                [STORAGE_KEYS.MASTER_RESUME],
                (result) => {
                  const savedData = result[STORAGE_KEYS.MASTER_RESUME];
                  if (savedData) {
                    try {
                      const savedResume =
                        typeof savedData === "string"
                          ? JSON.parse(savedData)
                          : savedData;
                      console.log(
                        `[Storage] ✓ Force sync verified: chrome.storage.sync now contains: ${savedResume.contact?.name}`,
                      );
                    } catch (e) {
                      console.error(
                        "[Storage] Could not verify force sync:",
                        e,
                      );
                    }
                  } else {
                    console.error(
                      "[Storage] Force sync FAILED - data not found after save!",
                    );
                  }
                  resolve();
                },
              );
            },
          );
        }, 100); // Small delay to ensure remove completes
      });
    });
  }

  return Promise.resolve();
}

export async function getSettings(): Promise<AppSettings | null> {
  try {
    console.log("[Storage] getSettings() called");
    console.log("[Storage] Looking for key:", STORAGE_KEYS.APP_SETTINGS);

    // Try to get from chrome.storage.sync first (extension context)
    if (typeof chrome !== "undefined" && chrome.storage) {
      console.log("[Storage] chrome.storage available, attempting to read...");
      try {
        // Direct read from chrome.storage.sync for debugging
        const directResult = await new Promise<any>((resolve) => {
          chrome.storage.sync.get([STORAGE_KEYS.APP_SETTINGS], (result) => {
            console.log(
              "[Storage] Direct chrome.storage.sync.get result:",
              result,
            );
            resolve(result);
          });
        });

        if (directResult && directResult[STORAGE_KEYS.APP_SETTINGS]) {
          const value = directResult[STORAGE_KEYS.APP_SETTINGS];
          console.log(
            "[Storage] Found value in chrome.storage.sync (raw):",
            value,
          );

          const parsed = typeof value === "string" ? JSON.parse(value) : value;
          console.log(
            "[Storage] ✓ Settings loaded and parsed from chrome.storage.sync:",
            parsed,
          );
          return parsed as AppSettings;
        } else {
          console.warn(
            "[Storage] chrome.storage.sync.get returned empty result for key:",
            STORAGE_KEYS.APP_SETTINGS,
          );
        }
      } catch (e) {
        console.error("[Storage] Error reading from chrome.storage.sync:", e);
      }
    } else {
      console.warn("[Storage] chrome.storage not available in this context");
    }

    // Fallback: try localStorage (for web app context)
    console.log("[Storage] Trying localStorage as fallback...");
    try {
      const localValue = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      if (localValue) {
        const parsed = JSON.parse(localValue);
        console.log("[Storage] ✓ Settings loaded from localStorage:", parsed);

        // Try to sync to chrome.storage if available
        if (typeof chrome !== "undefined" && chrome.storage) {
          try {
            await saveToStorage(STORAGE_KEYS.APP_SETTINGS, parsed);
            console.log("[Storage] Settings synced to chrome.storage.sync");
          } catch (e) {
            console.warn("[Storage] Could not sync to chrome.storage:", e);
          }
        }

        return parsed as AppSettings;
      } else {
        console.warn("[Storage] localStorage also doesn't have the key");
      }
    } catch (e) {
      console.warn("[Storage] Error reading from localStorage:", e);
    }

    console.error("[Storage] No settings found in any storage!");
    return null;
  } catch (err) {
    console.error("[Storage] Fatal error in getSettings():", err);
    return null;
  }
}

export async function setSettings(settings: AppSettings): Promise<void> {
  try {
    // Save to chrome.storage.sync if available
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        await saveToStorage(STORAGE_KEYS.APP_SETTINGS, settings);
        console.log("[Storage] Settings saved to chrome.storage.sync");
      } catch (e) {
        console.warn("[Storage] Failed to save to chrome.storage.sync:", e);
      }
    }

    // Also save to localStorage for web app context
    try {
      localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
      console.log("[Storage] Settings saved to localStorage");
    } catch (e) {
      console.warn("[Storage] Failed to save to localStorage:", e);
    }
  } catch (err) {
    console.error("[Storage] Error saving settings:", err);
    throw err;
  }
}

export async function getApiKeyFromSettings(): Promise<string | null> {
  try {
    const settings = await getSettings();
    return settings?.geminiApiKey || null;
  } catch (err) {
    console.error("Error getting API key from settings:", err);
    return null;
  }
}
