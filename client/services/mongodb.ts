import { User, ResumeData, ApplicationRecord } from "@/types";
import {
  saveToStorage,
  getFromStorage,
  setMasterResume,
  getMasterResume,
} from "@/utils/storage";

const STORAGE_KEYS = {
  USER_DATA: "resumematch_user_data",
  APPLICATIONS: "resumematch_applications",
};

export async function saveUser(userData: User): Promise<User> {
  try {
    await saveToStorage(STORAGE_KEYS.USER_DATA, userData);
    return userData;
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}

export async function getUser(): Promise<User | null> {
  try {
    return await getFromStorage(STORAGE_KEYS.USER_DATA);
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export async function getUserResume(): Promise<ResumeData | null> {
  try {
    return await getMasterResume();
  } catch (error) {
    console.error("Error fetching resume:", error);
    return null;
  }
}

export async function saveResume(resume: ResumeData): Promise<ResumeData> {
  try {
    await setMasterResume(resume);
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw error;
  }
}

export async function saveApplication(
  application: ApplicationRecord,
): Promise<ApplicationRecord> {
  try {
    const applications = await getApplicationHistory();
    const newApplication: ApplicationRecord = {
      ...application,
      id: `app_${Date.now()}`,
    };
    applications.push(newApplication);
    await saveToStorage(STORAGE_KEYS.APPLICATIONS, applications);
    return newApplication;
  } catch (error) {
    console.error("Error saving application:", error);
    throw error;
  }
}

export async function getApplicationHistory(): Promise<ApplicationRecord[]> {
  try {
    // Read from our storage helper first (localStorage or chrome.storage.sync)
    let localHistory: any = await getFromStorage(STORAGE_KEYS.APPLICATIONS);

    // Parse if stringified once or twice
    for (let i = 0; i < 2 && typeof localHistory === "string"; i++) {
      try {
        localHistory = JSON.parse(localHistory);
      } catch {
        break;
      }
    }

    let localArray: ApplicationRecord[] = [];
    if (Array.isArray(localHistory))
      localArray = localHistory as ApplicationRecord[];
    else if (localHistory && typeof localHistory === "object")
      localArray = [localHistory as ApplicationRecord];

    // Also try to read directly from chrome.storage.sync if available (extension context)
    let extArray: ApplicationRecord[] = [];
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      try {
        const extRaw: any = await new Promise((resolve) => {
          chrome.storage.sync.get([STORAGE_KEYS.APPLICATIONS], (res) => {
            resolve(res[STORAGE_KEYS.APPLICATIONS] ?? null);
          });
        });
        let extHistory = extRaw;
        for (let i = 0; i < 2 && typeof extHistory === "string"; i++) {
          try {
            extHistory = JSON.parse(extHistory);
          } catch {
            break;
          }
        }
        if (Array.isArray(extHistory))
          extArray = extHistory as ApplicationRecord[];
        else if (extHistory && typeof extHistory === "object")
          extArray = [extHistory as ApplicationRecord];
      } catch (e) {
        // ignore
      }
    }

    // Merge and dedupe by a stable key
    const byKey = new Map<string, ApplicationRecord>();
    const makeKey = (a: any) =>
      `${a.id || a._id || ""}|${a.jobTitle || ""}|${a.company || ""}|${a.appliedDate || ""}`;

    [...localArray, ...extArray].forEach((a) => {
      if (!a) return;
      const k = makeKey(a);
      byKey.set(k, a);
    });

    const combined = Array.from(byKey.values());

    // Persist back to unify format so future reads are stable
    try {
      await saveToStorage(STORAGE_KEYS.APPLICATIONS, combined);
    } catch {}

    return combined;
  } catch (error) {
    console.error("Error fetching application history:", error);
    return [];
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationRecord["status"],
): Promise<ApplicationRecord> {
  try {
    const applications = await getApplicationHistory();
    const applicationIndex = applications.findIndex(
      (app) => app.id === applicationId,
    );
    if (applicationIndex === -1) {
      throw new Error("Application not found");
    }
    applications[applicationIndex].status = status;
    applications[applicationIndex].updatedAt = new Date();
    await saveToStorage(STORAGE_KEYS.APPLICATIONS, applications);
    return applications[applicationIndex];
  } catch (error) {
    console.error("Error updating application status:", error);
    throw error;
  }
}
