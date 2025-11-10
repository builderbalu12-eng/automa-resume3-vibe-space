import { getMasterResume, getFromStorage } from "@/utils/storage";
import {
  tailorResumeForJob,
  calculateATSScore,
  extractJobRequirements,
  parseJobFromHTML,
  isJobPostingPage,
} from "@/services/gemini";
import { saveApplication } from "@/services/mongodb";
import { downloadResume, generateResumeDocx } from "@/services/resumeGenerator";
import { ResumeData, JobDescription, ApplicationRecord } from "@/types";

interface PopupState {
  masterResume: ResumeData | null;
  jobData: JobDescription | null;
  tailoredResume: ResumeData | null;
  atsScore: number;
  jobDescription: JobDescription | null;
}

let state: PopupState = {
  masterResume: null,
  jobData: null,
  tailoredResume: null,
  atsScore: 0,
  jobDescription: null,
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
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement | null;
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
});

// Helper to get data from chrome.storage.sync
async function getFromStorageSync(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.sync
    ) {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          const value = result[key];
          // Handle both stringified and direct JSON objects
          if (typeof value === "string") {
            try {
              resolve(JSON.parse(value));
            } catch (e) {
              resolve(value);
            }
          } else {
            resolve(value || null);
          }
        }
      });
    } else {
      reject(new Error("chrome.storage.sync not available"));
    }
  });
}

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

// Initialize
async function init() {
  try {
    console.log("[Popup] Initializing extension popup...");

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
    }

    state.masterResume = resume;

    // Get job data from storage (captured by content script when Analyse button was clicked)
    let pageText: string | null = null;
    let basicJobData: JobDescription | null = null;

    try {
      pageText = await getFromStorageSync("currentPageText");
      console.log(
        "[Popup] Page text retrieved:",
        pageText ? `${pageText.length} chars` : "None",
      );
    } catch (e) {
      console.warn("[Popup] Could not get page text:", e);
    }

    try {
      basicJobData = await getFromStorageSync("currentJobData");
      console.log(
        "[Popup] Basic job data retrieved:",
        basicJobData ? "Yes" : "No",
      );
    } catch (e) {
      console.warn("[Popup] Could not get job data:", e);
    }

    if (pageText && pageText.length > 0) {
      try {
        console.log("[Popup] Checking if page is a job posting...");
        // Convert text to simple HTML format for Gemini analysis
        const htmlContent = `<html><body>${pageText.substring(0, 10000).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`;

        // First, check if this page actually contains a job posting
        const isJobPosting = await isJobPostingPage(htmlContent);

        if (isJobPosting) {
          console.log(
            "[Popup] Page detected as job posting. Parsing details...",
          );
          // Parse using Gemini to extract job details
          const parsedJobData = await parseJobFromHTML(htmlContent);

          if (parsedJobData) {
            state.jobData = parsedJobData;
            console.log(
              "[Popup] Successfully parsed job data from page:",
              state.jobData.title,
            );
          } else {
            console.log(
              "[Popup] Job parsing returned null - likely not a valid job posting",
            );
            // Fallback to basic job data if Gemini parsing fails
            if (basicJobData) {
              state.jobData = basicJobData;
              console.log(
                "[Popup] Using fallback job data from DOM extraction",
              );
            }
          }
        } else {
          console.log(
            "[Popup] Page is not a job posting. Checking basic DOM extraction...",
          );
          // Page is not recognized as a job posting, try basic extraction as fallback
          if (basicJobData) {
            state.jobData = basicJobData;
            console.log("[Popup] Using basic job data from DOM extraction");
          } else {
            console.log(
              "[Popup] No job posting detected and no DOM data found",
            );
          }
        }
      } catch (error) {
        console.error("[Popup] Error in job detection flow:", error);
        // Fallback to basic job data if error occurs
        if (basicJobData) {
          state.jobData = basicJobData;
          console.log(
            "[Popup] Error occurred, using fallback job data from DOM extraction",
          );
        }
      }
    } else if (basicJobData) {
      // Fallback if no page text was captured
      state.jobData = basicJobData;
      console.log("[Popup] Using basic job data from content script");
    } else {
      console.log("[Popup] No job data or page text found in storage");
    }

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

    dashboardLink.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({
        url: chrome.runtime.getURL("../index.html"),
      });
    };
    return;
  }

  // Show job info if available
  if (state.jobData) {
    jobInfoEl.classList.remove("hidden");
    const jobTitleEl = document.getElementById("job-title");
    const jobCompanyEl = document.getElementById("job-company");
    if (jobTitleEl) jobTitleEl.textContent = state.jobData.title || "Unknown";
    if (jobCompanyEl)
      jobCompanyEl.textContent = state.jobData.company || "Unknown";

    // Show buttons
    buttonsEl.classList.remove("hidden");
    statusEl.classList.remove("hidden");
    const statusIcon = statusEl.querySelector(".status-icon")!;
    const statusText = statusEl.querySelector(".status-text")!;
    statusIcon.textContent = "✓";
    statusText.innerHTML =
      "<strong>Ready to Tailor</strong><span>Click below to optimize your resume for this job</span>";
  } else {
    // Show status for non-job pages
    statusEl.classList.remove("hidden");
    const statusIcon = statusEl.querySelector(".status-icon")!;
    const statusText = statusEl.querySelector(".status-text")!;
    statusIcon.textContent = "ℹ️";
    statusText.innerHTML =
      "<strong>No Job Posting Found</strong><span>Open this extension on a job posting page</span>";
  }
}

tailorBtn.addEventListener("click", async () => {
  if (!state.masterResume || !state.jobData) {
    console.error("Missing data for tailoring:", {
      hasResume: !!state.masterResume,
      hasJobData: !!state.jobData,
    });
    return;
  }

  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");
  tailorBtn.disabled = true;

  try {
    console.log("Starting resume tailoring...");

    // Extract job requirements
    console.log("Extracting job requirements from description...");
    state.jobDescription = await extractJobRequirements(
      state.jobData.description,
    );
    console.log("Job requirements extracted");

    // Tailor resume
    console.log("Tailoring resume for job...");
    state.tailoredResume = await tailorResumeForJob(
      state.masterResume,
      state.jobDescription,
    );
    console.log("Resume tailored successfully");

    // Calculate ATS score
    console.log("Calculating ATS score...");
    const atsScoreData = await calculateATSScore(
      state.tailoredResume,
      state.jobDescription,
    );
    state.atsScore = atsScoreData.score;
    console.log("ATS score calculated:", state.atsScore);

    loadingEl.classList.add("hidden");
    successEl.classList.remove("hidden");
    successEl.textContent = `✓ Resume tailored! ATS Score: ${state.atsScore}%`;
    downloadBtn.disabled = false;
    saveBtn.disabled = false;
    tailorBtn.textContent = "⚡ Tailor Again";
    tailorBtn.disabled = false;
  } catch (error) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Tailoring error:", error);
    errorEl.textContent = `✗ Error: ${errorMsg}`;
    tailorBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!state.tailoredResume || !state.jobData) return;

  downloadBtn.disabled = true;
  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  try {
    // Generate and download the resume
    const blob = await generateResumeDocx(
      state.tailoredResume,
      state.jobData.company,
      state.jobData.title,
    );
    const url = URL.createObjectURL(blob);

    const today = new Date().toISOString().split("T")[0];
    const filename = `Resume_${state.jobData.company}_${state.jobData.title}_${today}.docx`;

    // Use Chrome downloads API
    chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });

    successEl.classList.remove("hidden");
    successEl.textContent = "✓ Resume downloaded!";
    downloadBtn.disabled = false;
  } catch (error) {
    errorEl.classList.remove("hidden");
    errorEl.textContent = `✗ Download failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    downloadBtn.disabled = false;
  }
});

saveBtn.addEventListener("click", async () => {
  if (!state.tailoredResume || !state.jobData || !state.masterResume) return;

  saveBtn.disabled = true;
  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  try {
    const application: ApplicationRecord = {
      userId: "current-user",
      jobTitle: state.jobData.title,
      company: state.jobData.company,
      jobUrl: state.jobData.url,
      jobDescription: state.jobData,
      originalResume: state.masterResume,
      tailoredResume: state.tailoredResume,
      atsScore: state.atsScore,
      matchPercentage: state.atsScore,
      appliedDate: new Date(),
      status: "applied",
    };

    await saveApplication(application);
    successEl.classList.remove("hidden");
    successEl.textContent = "✓ Application saved to your history!";
    saveBtn.disabled = false;
  } catch (error) {
    errorEl.classList.remove("hidden");
    errorEl.textContent = `✗ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    saveBtn.disabled = false;
  }
});

// Start initialization
init();
