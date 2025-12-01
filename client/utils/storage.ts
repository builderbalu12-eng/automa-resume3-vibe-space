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
  // Try to get from chrome.storage.sync first (extension context, works across extension pages)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    try {
      const result = await new Promise<ResumeData | null>((resolve, reject) => {
        chrome.storage.sync.get([STORAGE_KEYS.MASTER_RESUME], (syncResult) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            const value = syncResult[STORAGE_KEYS.MASTER_RESUME];
            if (value) {
              try {
                const resume =
                  typeof value === "string" ? JSON.parse(value) : value;
                resolve(resume);
              } catch (e) {
                console.warn("Failed to parse chrome.storage resume:", e);
                resolve(null);
              }
            } else {
              resolve(null);
            }
          }
        });
      });

      if (result) {
        console.log("Master resume retrieved from chrome.storage.sync");
        return result;
      }
    } catch (e) {
      console.warn("Failed to get from chrome.storage.sync:", e);
    }
  }

  // Fallback to localStorage (web app context)
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MASTER_RESUME);
    if (stored) {
      const resume = JSON.parse(stored);
      console.log("Master resume retrieved from localStorage");
      // Sync to chrome.storage if available
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.sync
      ) {
        try {
          await setMasterResume(resume);
        } catch (e) {
          console.warn("Could not sync to chrome.storage:", e);
        }
      }
      return resume;
    }
  } catch (e) {
    console.warn("Failed to get from localStorage:", e);
  }

  console.log("No master resume found in any storage");
  return null;
}

export async function setMasterResume(resume: ResumeData): Promise<void> {
  // Save to localStorage first (works in all contexts)
  localStorage.setItem(STORAGE_KEYS.MASTER_RESUME, JSON.stringify(resume));
  console.log("Master resume saved to localStorage");

  // Also save to chrome.storage.sync if available (for extension popup access)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    return new Promise<void>((resolve) => {
      chrome.storage.sync.set(
        { [STORAGE_KEYS.MASTER_RESUME]: JSON.stringify(resume) },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Error saving to chrome.storage:",
              chrome.runtime.lastError,
            );
            // Still resolve even if chrome.storage fails, localStorage is saved
            resolve();
          } else {
            console.log("Master resume saved to chrome.storage.sync");
            resolve();
          }
        },
      );
    });
  }
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
  if (typeof chrome !== "undefined" && chrome.storage) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } else {
    // Fallback to localStorage
    keys.forEach((key) => localStorage.removeItem(key as string));
  }
}

export async function getSettings(): Promise<AppSettings | null> {
  try {
    // Try to get from chrome.storage.sync first (extension context)
    if (typeof chrome !== "undefined" && chrome.storage) {
      try {
        const stored = await getFromStorage(STORAGE_KEYS.APP_SETTINGS);
        if (stored) {
          console.log("[Storage] Settings loaded from chrome.storage.sync");
          return stored as AppSettings;
        }
      } catch (e) {
        console.warn("[Storage] Failed to get from chrome.storage.sync:", e);
      }
    }

    // Fallback: try localStorage (for web app context)
    try {
      const localValue = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      if (localValue) {
        const parsed = JSON.parse(localValue);
        console.log("[Storage] Settings loaded from localStorage");

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
      }
    } catch (e) {
      console.warn("[Storage] Failed to get from localStorage:", e);
    }

    console.warn("[Storage] No settings found in any storage");
    return null;
  } catch (err) {
    console.error("[Storage] Error getting settings:", err);
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
