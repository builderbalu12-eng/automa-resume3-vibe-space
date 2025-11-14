import { getMasterResume, setMasterResume } from "@/utils/storage";
import { analyzeJobAndTailorResume, isJobPostingPage } from "@/services/gemini";
import { downloadResume } from "@/services/resumeGenerator";
import { ResumeData, JobDescription, ATSScore } from "@/types";

interface PopupState {
  masterResume: ResumeData | null;
  pageHTML: string | null;
  jobData: JobDescription | null;
  tailoredResume: ResumeData | null;
  atsScore: ATSScore | null;
  isJobPosting?: boolean | null;
  omittedSections?: string[] | null;
}

let state: PopupState = {
  masterResume: null,
  pageHTML: null,
  jobData: null,
  tailoredResume: null,
  atsScore: null,
  isJobPosting: null,
  omittedSections: null,
};

console.log("[Popup] Script loaded at", new Date().toISOString());

const statusEl = document.getElementById("status");
const jobInfoEl = document.getElementById("job-info");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const buttonsEl = document.getElementById("buttons");
const mainContentEl = document.getElementById("main-content");

const tailorBtn = document.getElementById(
  "tailor-btn",
) as HTMLButtonElement | null;
const downloadBtn = document.getElementById(
  "download-btn",
) as HTMLButtonElement | null;
const dashboardLink = document.getElementById(
  "dashboard-link",
) as HTMLAnchorElement | null;
const customAnalyseBtn = document.getElementById(
  "custom-analyse-btn",
) as HTMLButtonElement | null;

console.log("[Popup] DOM elements found:", {
  statusEl: !!statusEl,
  jobInfoEl: !!jobInfoEl,
  loadingEl: !!loadingEl,
  errorEl: !!errorEl,
  successEl: !!successEl,
  buttonsEl: !!buttonsEl,
  tailorBtn: !!tailorBtn,
  downloadBtn: !!downloadBtn,
});

// Helper to get resume from localhost tabs
async function getResumeFromLocalhost(): Promise<ResumeData | null> {
  return new Promise((resolve) => {
    try {
      console.log("[Popup] Searching for localhost tabs...");
      chrome.tabs.query({ url: "http://localhost:*/*" }, (tabs) => {
        if (!tabs.length) {
          console.log("[Popup] No localhost tabs found");
          resolve(null);
          return;
        }

        console.log("[Popup] Found", tabs.length, "localhost tab(s)");
        const tab = tabs[0];

        chrome.tabs.sendMessage(
          tab.id!,
          { action: "getResume" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[Popup] Could not reach localhost tab:",
                chrome.runtime.lastError?.message,
              );
              resolve(null);
            } else if (response?.resume) {
              console.log(
                "[Popup] Got resume from localhost:",
                response.resume.contact?.name,
              );
              resolve(response.resume);
            } else {
              console.warn("[Popup] No resume in localhost response");
              resolve(null);
            }
          },
        );
      });
    } catch (e) {
      console.warn("[Popup] Error querying localhost tabs:", e);
      resolve(null);
    }
  });
}

// Load master resume on popup open
async function loadMasterResume(): Promise<ResumeData | null> {
  try {
    console.log("[Popup] Loading master resume...");

    // Try 1: Get from chrome.storage.sync (works across extension contexts)
    let resume = await getMasterResume();
    if (resume) {
      console.log(
        "[Popup] ✓ Resume found in chrome.storage.sync:",
        resume.contact?.name,
      );
      state.masterResume = resume;
      return resume;
    }

    console.log(
      "[Popup] Resume not in chrome.storage.sync, trying localhost...",
    );

    // Try 2: Get from localhost tab if available
    resume = await getResumeFromLocalhost();
    if (resume) {
      console.log("[Popup] ✓ Resume found on localhost:", resume.contact?.name);
      state.masterResume = resume;

      // Save to chrome.storage for future use
      try {
        await setMasterResume(resume);
        console.log("[Popup] ✓ Resume cached to chrome.storage.sync");
      } catch (e) {
        console.warn("[Popup] Could not cache resume:", e);
      }

      return resume;
    }

    console.warn("[Popup] Resume not found in any storage");
    return null;
  } catch (error) {
    console.error("[Popup] Error loading resume:", error);
    return null;
  }
}

// Request page data from background service worker
async function getPageDataFromBackground(): Promise<void> {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 8; // Increased attempts for reliability

    const tryGetData = () => {
      attempts++;
      console.log(
        `[Popup] Requesting page data from background (attempt ${attempts}/${maxAttempts})`,
      );

      chrome.runtime.sendMessage({ action: "getPageData" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Popup] Message error:",
            chrome.runtime.lastError.message,
          );
          if (attempts < maxAttempts) {
            setTimeout(tryGetData, 150);
          } else {
            console.warn(
              "[Popup] Failed to get page data after",
              maxAttempts,
              "attempts",
            );
            resolve();
          }
        } else if (response?.pageData?.pageHTML) {
          console.log(
            "[Popup] ✓ Received page data from background:",
            response.pageData.pageHTML.length,
            "chars",
          );
          state.pageHTML = response.pageData.pageHTML;
          resolve();
        } else {
          console.log("[Popup] No page data in response yet");
          if (attempts < maxAttempts) {
            setTimeout(tryGetData, 150);
          } else {
            console.warn("[Popup] Page data not available");
            resolve();
          }
        }
      });
    };

    tryGetData();
  });
}

// Initialize on popup open
async function init() {
  try {
    console.log("[Popup] Initializing extension popup...");

    // Load master resume (this is important)
    const resume = await loadMasterResume();

    // Get page data from background service worker
    await getPageDataFromBackground();

    // Update UI with current state
    updateUI();
  } catch (error) {
    console.error("[Popup] Initialization error:", error);
    updateUI();
  }
}

function updateUI() {
  // Hide everything first
  statusEl?.classList.add("hidden");
  jobInfoEl?.classList.add("hidden");
  loadingEl?.classList.add("hidden");
  errorEl?.classList.add("hidden");
  successEl?.classList.add("hidden");
  buttonsEl?.classList.add("hidden");

  if (!state.masterResume) {
    // Show error if no master resume
    if (statusEl) {
      statusEl.classList.remove("hidden");
      const statusIcon = statusEl.querySelector(".status-icon");
      const statusText = statusEl.querySelector(".status-text");
      if (statusIcon) statusIcon.textContent = "⚠️";
      if (statusText) {
        statusText.innerHTML =
          "<strong>No Master Resume</strong><span>Upload your resume on the dashboard first</span>";
      }
    }

    if (dashboardLink) {
      dashboardLink.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({
          url: chrome.runtime.getURL("../index.html"),
        });
      };
    }
    return;
  }

  // If page HTML was received but not analyzed yet
  if (state.pageHTML && !state.jobData) {
    if (statusEl) {
      statusEl.classList.remove("hidden");
      const statusIcon = statusEl.querySelector(".status-icon");
      const statusText = statusEl.querySelector(".status-text");

      if (state.isJobPosting === false) {
        if (statusIcon) statusIcon.textContent = "ℹ️";
        if (statusText) {
          statusText.innerHTML =
            "<strong>No Job Posting Found</strong><span>Use CustomAnalyse on a job page or open a specific job</span>";
        }
        if (buttonsEl) buttonsEl.classList.add("hidden");
      } else {
        if (statusIcon) statusIcon.textContent = "📄";
        if (statusText) {
          statusText.innerHTML =
            "<strong>Job Posting Detected</strong><span>Click below to analyze and tailor your resume</span>";
        }
        if (buttonsEl) buttonsEl.classList.remove("hidden");

        // Show tailor button
        if (tailorBtn) {
          tailorBtn.textContent = "⚡ Analyze & Tailor Resume";
          tailorBtn.disabled = false;
          tailorBtn.style.opacity = "1";
        }
      }
    }
    return;
  }

  // Show results if job has been analyzed
  if (state.jobData && state.tailoredResume && state.atsScore) {
    if (statusEl) {
      statusEl.classList.remove("hidden");
      const statusIcon = statusEl.querySelector(".status-icon");
      const statusText = statusEl.querySelector(".status-text");
      if (statusIcon) statusIcon.textContent = "✅";
      if (statusText) {
        statusText.innerHTML = `<strong>Resume Tailored</strong><span>${state.jobData.title} at ${state.jobData.company}</span>`;
      }
    }

    if (jobInfoEl) {
      jobInfoEl.classList.remove("hidden");
      const jobTitleEl = document.getElementById("job-title");
      const jobCompanyEl = document.getElementById("job-company");
      const atsScoreEl = document.getElementById("ats-score");
      const summaryEl = document.getElementById("summary");

      if (jobTitleEl) jobTitleEl.textContent = state.jobData.title || "Unknown";
      if (jobCompanyEl)
        jobCompanyEl.textContent = state.jobData.company || "Unknown";
      if (atsScoreEl) atsScoreEl.textContent = `${state.atsScore.score || 0}%`;
      if (summaryEl) {
        summaryEl.innerHTML = `<div style="font-size: 12px; line-height: 1.4; color: #666;">Key Skills Matched: ${state.atsScore.keywordMatches.slice(0, 3).join(", ") || "—"}</div>`;
      }
    }

    if (buttonsEl) buttonsEl.classList.remove("hidden");

    // Show download button
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.style.opacity = "1";
    }
    return;
  }

  // Default: no job posting
  if (statusEl) {
    statusEl.classList.remove("hidden");
    const statusIcon = statusEl.querySelector(".status-icon");
    const statusText = statusEl.querySelector(".status-text");
    if (statusIcon) statusIcon.textContent = "ℹ️";
    if (statusText) {
      statusText.innerHTML =
        "<strong>No Job Posting Found</strong><span>Click the 'Analyse' button on a job posting page</span>";
    }
  }
}

if (tailorBtn) {
  tailorBtn.addEventListener("click", async () => {
    if (!state.masterResume || !state.pageHTML) {
      console.error("[Popup] Missing data for tailoring:", {
        hasResume: !!state.masterResume,
        hasPageHTML: !!state.pageHTML,
      });
      return;
    }

    if (loadingEl) loadingEl.classList.remove("hidden");
    if (errorEl) errorEl.classList.add("hidden");
    if (successEl) successEl.classList.add("hidden");
    if (tailorBtn) tailorBtn.disabled = true;

    try {
      console.log("[Popup] Starting job analysis and resume tailoring...");

      // Call unified Gemini function
      const result = await analyzeJobAndTailorResume(
        state.pageHTML,
        state.masterResume,
      );

      console.log("[Popup] ✓ Job analysis complete:", result.jobData.title);

      // Update state with results
      state.jobData = result.jobData;
      state.tailoredResume = result.tailoredResume;
      state.atsScore = result.atsScore;
      state.omittedSections = result.omittedSections || null;

      if (loadingEl) loadingEl.classList.add("hidden");
      if (successEl) {
        successEl.classList.remove("hidden");
        successEl.textContent = `✓ Resume tailored! ATS Score: ${state.atsScore.score}%`;
      }

      // If some requested sections were omitted, show a message
      if (state.omittedSections && state.omittedSections.length) {
        if (errorEl) {
          errorEl.classList.remove("hidden");
          errorEl.textContent = `Some requested sections had no content and were not included: ${state.omittedSections.join(", ")}`;
        }
      }

      // Persist application to extension storage so web app history reflects it
      try {
        const appRecord = {
          userId: "current-user",
          jobTitle: state.jobData.title || "Unknown",
          company: state.jobData.company || "Unknown",
          jobUrl: undefined,
          jobDescription: state.jobData,
          originalResume: state.masterResume,
          tailoredResume: state.tailoredResume,
          atsScore: state.atsScore.score || 0,
          matchPercentage:
            state.atsScore.matchPercentage || state.atsScore.score || 0,
          appliedDate: new Date().toISOString(),
          status: "applied",
          createdAt: new Date().toISOString(),
        };

        // Read existing applications
        chrome.storage.sync.get(["resumematch_applications"], (res) => {
          try {
            const existing = res["resumematch_applications"];
            let apps = [];
            if (existing) {
              apps =
                typeof existing === "string" ? JSON.parse(existing) : existing;
            }
            apps.push(appRecord);
            // Save back as stringified JSON for compatibility with web app
            chrome.storage.sync.set(
              { resumematch_applications: JSON.stringify(apps) },
              () => {
                if (chrome.runtime.lastError) {
                  console.warn(
                    "[Popup] Failed to save application to chrome.storage.sync:",
                    chrome.runtime.lastError,
                  );
                } else {
                  console.log(
                    "[Popup] Application saved to chrome.storage.sync",
                  );
                }
              },
            );

            // Also mirror to localStorage so the web app preview reads it without extension context
            try {
              localStorage.setItem(
                "resumematch_applications",
                JSON.stringify(apps),
              );
              console.log("[Popup] Application mirrored to localStorage");
            } catch (e) {
              console.warn("[Popup] Could not write to localStorage:", e);
            }

            // Try to sync applications to any open tabs (including the web app) via content scripts
            try {
              chrome.tabs.query({}, (tabs) => {
                tabs.forEach((tab) => {
                  if (!tab.id) return;
                  chrome.tabs.sendMessage(
                    tab.id,
                    { action: "syncApplications", apps },
                    () => {
                      if (chrome.runtime.lastError) {
                        // Silently ignore if no content script is injected on a tab
                        return;
                      }
                    },
                  );
                });
              });
            } catch (e) {
              console.warn(
                "[Popup] Could not broadcast applications to tabs:",
                e,
              );
            }
          } catch (e) {
            console.error("[Popup] Error persisting application:", e);
          }
        });
      } catch (e) {
        console.warn("[Popup] Could not persist application:", e);
      }

      // Update UI to show results
      updateUI();
    } catch (error) {
      if (loadingEl) loadingEl.classList.add("hidden");
      if (errorEl) {
        errorEl.classList.remove("hidden");
        const errorMsg = error instanceof Error ? error.message : String(error);
        const transient =
          /overload|503|temporarily unavailable|rate limit|server error/i.test(
            errorMsg,
          );
        if (transient) {
          // Show a friendly retry UI for transient AI errors
          errorEl.innerHTML = `✗ Temporary service error: ${errorMsg}. The AI service may be overloaded — please try again in a few seconds. <button id="retry-tailor" class="btn">Retry</button>`;
          // Attach retry handler
          setTimeout(() => {
            const retryBtn = document.getElementById("retry-tailor");
            if (retryBtn) {
              retryBtn.addEventListener("click", () => {
                if (tailorBtn) {
                  tailorBtn.click();
                }
              });
            }
          }, 50);
        } else {
          errorEl.textContent = `✗ Error: ${errorMsg}`;
        }
      }
      console.error("[Popup] Tailoring error:", error);
      if (tailorBtn) tailorBtn.disabled = false;
    }
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    if (!state.tailoredResume || !state.jobData) return;

    if (downloadBtn) downloadBtn.disabled = true;
    if (errorEl) errorEl.classList.add("hidden");
    if (successEl) successEl.classList.add("hidden");

    try {
      console.log("[Popup] Downloading tailored resume as DOCX...");

      // Download as DOCX
      await downloadResume(
        state.tailoredResume,
        state.jobData.company,
        state.jobData.title,
      );

      if (successEl) {
        successEl.classList.remove("hidden");
        successEl.textContent = "✓ Resume downloaded as DOCX!";
      }
      if (downloadBtn) downloadBtn.disabled = false;
    } catch (error) {
      if (errorEl) {
        errorEl.classList.remove("hidden");
        errorEl.textContent = `✗ Download failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
      console.error("[Popup] Download error:", error);
      if (downloadBtn) downloadBtn.disabled = false;
    }
  });
}

if (customAnalyseBtn) {
  customAnalyseBtn.addEventListener("click", async () => {
    try {
      if (customAnalyseBtn) {
        customAnalyseBtn.disabled = true;
        customAnalyseBtn.textContent = "⏳ Analyzing current page...";
      }

      const getActiveTab = (): Promise<chrome.tabs.Tab | null> =>
        new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs && tabs.length ? tabs[0] : null);
          });
        });

      const execCapture = (
        tabId: number,
      ): Promise<{ html: string; url: string } | null> =>
        new Promise((resolve) => {
          try {
            chrome.scripting.executeScript(
              {
                target: { tabId },
                func: () => ({
                  html: document.documentElement.outerHTML,
                  url: location.href,
                }),
              },
              (results: any) => {
                if (chrome.runtime.lastError) {
                  console.warn(
                    "[Popup] executeScript error:",
                    chrome.runtime.lastError.message,
                  );
                  resolve(null);
                } else {
                  resolve(
                    results && results[0] && results[0].result
                      ? results[0].result
                      : null,
                  );
                }
              },
            );
          } catch (e) {
            console.warn("[Popup] executeScript threw:", e);
            resolve(null);
          }
        });

      const tab = await getActiveTab();
      if (!tab?.id) throw new Error("No active tab found");

      const payload = await execCapture(tab.id);
      if (!payload?.html) throw new Error("Could not capture page content");

      state.pageHTML = payload.html;
      state.isJobPosting = null;

      // Store in background (optional) so re-opened popup can fetch
      chrome.runtime.sendMessage(
        { action: "analyzeJob", pageHTML: payload.html, pageURL: payload.url },
        () => {},
      );

      // Try detecting if it's a job page (best-effort)
      try {
        state.isJobPosting = await isJobPostingPage(payload.html);
      } catch (e) {
        console.warn("[Popup] Job detection failed or not configured:", e);
        state.isJobPosting = null; // fall back to default behavior
      }

      updateUI();
    } catch (error) {
      console.error("[Popup] CustomAnalyse error:", error);
      if (errorEl) {
        errorEl.classList.remove("hidden");
        errorEl.textContent = `✗ Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    } finally {
      if (customAnalyseBtn) {
        customAnalyseBtn.disabled = false;
        customAnalyseBtn.textContent = "CustomAnaylse for current page";
      }
    }
  });
}

// Start initialization when popup opens
console.log("[Popup] Starting initialization...");
init();
