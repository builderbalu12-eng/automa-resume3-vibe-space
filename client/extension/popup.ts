import { getMasterResume } from "@/utils/storage";
import { analyzeJobAndTailorResume } from "@/services/gemini";
import { downloadResumePDF } from "@/services/resumeGenerator";
import { ResumeData, JobDescription, ATSScore } from "@/types";

interface PopupState {
  masterResume: ResumeData | null;
  pageHTML: string | null;
  jobData: JobDescription | null;
  tailoredResume: ResumeData | null;
  atsScore: ATSScore | null;
}

let state: PopupState = {
  masterResume: null,
  pageHTML: null,
  jobData: null,
  tailoredResume: null,
  atsScore: null,
};

console.log("[Popup] Script loaded, querying DOM elements...");

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

// Helper to request resume from content script on localhost
async function getResumeFromLocalhost(): Promise<any> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ url: "http://localhost:*/*" }, (tabs) => {
        if (!tabs.length) {
          console.log("[Popup] No localhost tabs found");
          resolve(null);
          return;
        }

        const tab = tabs[0];
        chrome.tabs.sendMessage(
          tab.id!,
          { action: "getResume" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[Popup] Could not reach content script:",
                chrome.runtime.lastError?.message || "Unknown error",
              );
              resolve(null);
            } else {
              console.log(
                "[Popup] Got resume from localhost:",
                response?.resume ? "YES" : "NO",
              );
              resolve(response?.resume || null);
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
async function loadMasterResume() {
  try {
    console.log("[Popup] Loading master resume...");

    // Get master resume from browser storage
    let resume = await getMasterResume();
    console.log(
      "[Popup] Master resume loaded:",
      resume ? "YES (Found)" : "NO (Not found)",
    );

    // If not found in chrome.storage, try to get from localhost content script
    if (!resume) {
      console.log("[Popup] Attempting to get resume from localhost...");
      resume = await getResumeFromLocalhost();
      console.log(
        "[Popup] Master resume from localhost:",
        resume ? "YES (Found)" : "NO (Not found)",
      );

      // If found, save it to chrome.storage for future use
      if (resume) {
        try {
          await new Promise<void>((resolve) => {
            chrome.storage.sync.set(
              { resumematch_master_resume: JSON.stringify(resume) },
              () => {
                if (!chrome.runtime.lastError) {
                  console.log("[Popup] Cached resume in chrome.storage.sync");
                }
                resolve();
              },
            );
          });
        } catch (e) {
          console.warn("[Popup] Could not cache resume:", e);
        }
      }
    }

    if (resume) {
      console.log("[Popup] Resume name:", resume.contact?.name);
      state.masterResume = resume;
    }

    return resume;
  } catch (error) {
    console.error("[Popup] Error loading resume:", error);
    return null;
  }
}

// Request page data from background service worker
async function getPageDataFromBackground(): Promise<void> {
  return new Promise((resolve) => {
    // Try multiple times in case data hasn't arrived yet
    let attempts = 0;
    const maxAttempts = 5;

    const tryGetData = () => {
      attempts++;
      console.log(
        `[Popup] Requesting page data from background (attempt ${attempts})`,
      );

      chrome.runtime.sendMessage({ action: "getPageData" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Popup] Message error:",
            chrome.runtime.lastError.message,
          );
          if (attempts < maxAttempts) {
            setTimeout(tryGetData, 200);
          } else {
            resolve();
          }
        } else if (response?.pageData?.pageHTML) {
          console.log(
            "[Popup] Received page data from background:",
            response.pageData.pageHTML.length,
            "chars",
          );
          state.pageHTML = response.pageData.pageHTML;
          resolve();
        } else {
          console.log("[Popup] No page data available yet");
          if (attempts < maxAttempts) {
            setTimeout(tryGetData, 200);
          } else {
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

    // Load master resume on open
    const resume = await loadMasterResume();

    // Get page data from background service worker if available
    await getPageDataFromBackground();

    // Show initial UI
    updateUI();
  } catch (error) {
    console.error("Initialization error:", error);
    updateUI();
  }
}

function updateUI() {
  // Hide everything first
  statusEl.classList.add("hidden");
  jobInfoEl.classList.add("hidden");
  loadingEl.classList.add("hidden");
  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");
  buttonsEl.classList.add("hidden");

  if (!state.masterResume) {
    // Show error if no master resume
    statusEl.classList.remove("hidden");
    const statusIcon = statusEl.querySelector(".status-icon")!;
    const statusText = statusEl.querySelector(".status-text")!;
    statusIcon.textContent = "⚠️";
    statusText.innerHTML =
      "<strong>No Master Resume</strong><span>Upload your resume on the dashboard first</span>";

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
    statusEl.classList.remove("hidden");
    const statusIcon = statusEl.querySelector(".status-icon")!;
    const statusText = statusEl.querySelector(".status-text")!;
    statusIcon.textContent = "📄";
    statusText.innerHTML =
      "<strong>Job Posting Detected</strong><span>Click below to analyze and tailor your resume</span>";

    buttonsEl.classList.remove("hidden");
    // Show tailor button
    if (tailorBtn) {
      tailorBtn.textContent = "⚡ Analyze & Tailor Resume";
      tailorBtn.disabled = false;
    }
    return;
  }

  // Show results if job has been analyzed
  if (state.jobData && state.tailoredResume && state.atsScore) {
    statusEl.classList.remove("hidden");
    const statusIcon = statusEl.querySelector(".status-icon")!;
    const statusText = statusEl.querySelector(".status-text")!;
    statusIcon.textContent = "✅";
    statusText.innerHTML = `<strong>Resume Tailored</strong><span>${state.jobData.title} at ${state.jobData.company}</span>`;

    jobInfoEl.classList.remove("hidden");
    const jobTitleEl = document.getElementById("job-title");
    const jobCompanyEl = document.getElementById("job-company");
    const atsScoreEl = document.getElementById("ats-score");
    const summaryEl = document.getElementById("summary");

    if (jobTitleEl) jobTitleEl.textContent = state.jobData.title || "Unknown";
    if (jobCompanyEl)
      jobCompanyEl.textContent = state.jobData.company || "Unknown";
    if (atsScoreEl) atsScoreEl.textContent = `${state.atsScore.score || 0}%`;
    if (summaryEl)
      summaryEl.innerHTML = `<div style="font-size: 12px; line-height: 1.4; color: #666;">Key Skills Matched: ${state.atsScore.keywordMatches.slice(0, 3).join(", ") || "—"}</div>`;

    buttonsEl.classList.remove("hidden");
    // Show download button
    if (downloadBtn) {
      downloadBtn.disabled = false;
    }
    return;
  }

  // Default: no job posting
  statusEl.classList.remove("hidden");
  const statusIcon = statusEl.querySelector(".status-icon")!;
  const statusText = statusEl.querySelector(".status-text")!;
  statusIcon.textContent = "ℹ️";
  statusText.innerHTML =
    "<strong>No Job Posting Found</strong><span>Open this extension on a job posting page</span>";
}

if (tailorBtn) {
  tailorBtn.addEventListener("click", async () => {
    if (!state.masterResume || !state.pageHTML) {
      console.error("Missing data for tailoring:", {
        hasResume: !!state.masterResume,
        hasPageHTML: !!state.pageHTML,
      });
      return;
    }

    loadingEl.classList.remove("hidden");
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");
    tailorBtn.disabled = true;

    try {
      console.log("[Popup] Starting job analysis and resume tailoring...");

      // Call unified Gemini function
      const result = await analyzeJobAndTailorResume(
        state.pageHTML,
        state.masterResume,
      );

      console.log("[Popup] Job analysis complete:", result.jobData.title);

      // Update state with results
      state.jobData = result.jobData;
      state.tailoredResume = result.tailoredResume;
      state.atsScore = result.atsScore;

      loadingEl.classList.add("hidden");
      successEl.classList.remove("hidden");
      successEl.textContent = `✓ Resume tailored! ATS Score: ${state.atsScore.score}%`;

      // Update UI to show results
      updateUI();
    } catch (error) {
      loadingEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error("[Popup] Tailoring error:", error);
      errorEl.textContent = `✗ Error: ${errorMsg}`;
      tailorBtn.disabled = false;
    }
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    if (!state.tailoredResume || !state.jobData) return;

    downloadBtn.disabled = true;
    errorEl.classList.add("hidden");
    successEl.classList.add("hidden");

    try {
      // Download as PDF
      await downloadResumePDF(
        state.tailoredResume,
        state.jobData.company,
        state.jobData.title,
      );

      successEl.classList.remove("hidden");
      successEl.textContent = "✓ Resume downloaded as PDF!";
      downloadBtn.disabled = false;
    } catch (error) {
      errorEl.classList.remove("hidden");
      errorEl.textContent = `✗ Download failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      downloadBtn.disabled = false;
    }
  });
}

// Start initialization
init();
