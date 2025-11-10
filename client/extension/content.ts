import {
  extractJobDescriptionFromDOM,
  createJobExtractionButton,
} from "@/utils/jobExtractor";
import { saveToStorage } from "@/utils/storage";

let injectedButton = false;

function getPageHTML(): string {
  return document.documentElement.outerHTML;
}

function getPageText(): string {
  // Get all visible text from the page
  return document.body.innerText;
}

function getEnrichedPageContent(): string {
  // Combine various content sources to create a richer analysis document
  const parts: string[] = [];

  // Get page title
  const title = document.title;
  if (title) parts.push(`Page Title: ${title}`);

  // Get all visible text from page (this is what Gemini will analyze)
  const pageText = document.body.innerText || "";

  // Get specific job-related sections with Naukri-specific support
  const jobSectionSelectors = [
    // Naukri specific
    ".job-desc",
    ".jdMainSection",
    ".jobsectionwrap",
    "[data-cy='job-description']",
    // Generic selectors
    ".job-description",
    "[class*='description']",
    "[class*='job']",
    "main",
    "article",
    "[role='main']",
    ".job-post",
    ".posting",
    ".position",
  ];

  let jobContent = "";
  // Try each selector and get the first one with substantial content
  for (const selector of jobSectionSelectors) {
    try {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 100) {
        jobContent = text;
        break;
      }
    } catch (e) {
      // Skip invalid selectors
      continue;
    }
  }

  // Combine content - prefer job content, fall back to full page text
  if (jobContent && jobContent.length > 100) {
    parts.push("=== JOB POSTING CONTENT ===");
    parts.push(jobContent);
  } else if (pageText && pageText.length > 100) {
    parts.push("=== PAGE CONTENT ===");
    // For Naukri and similar sites, include more of the page if we can't find specific job section
    parts.push(pageText.substring(0, 15000)); // Increased limit for better content
  }

  // Add meta information
  const url = window.location.href;
  const hostname = window.location.hostname;
  if (url) parts.push(`\nURL: ${url}`);
  if (hostname) parts.push(`Site: ${hostname}`);

  return parts.join("\n\n");
}

function injectButton() {
  if (injectedButton) return;

  const button = createJobExtractionButton();
  document.body.appendChild(button);
  injectedButton = true;

  button.addEventListener("click", async () => {
    button.textContent = "⏳ Analyzing...";
    button.disabled = true;

    try {
      // Capture the full page HTML
      const pageHTML = document.documentElement.outerHTML;
      const pageURL = window.location.href;

      console.log(
        "[Content Script] Captured page HTML, length:",
        pageHTML.length,
      );

      // Send HTML directly to popup via message (don't store anything)
      chrome.runtime.sendMessage(
        {
          action: "analyzeJob",
          pageHTML: pageHTML,
          pageURL: pageURL,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Content Script] Message send error:",
              chrome.runtime.lastError.message,
            );
            alert(
              `Error: ${chrome.runtime.lastError.message}. Please try again.`,
            );
            button.textContent = "Analyse";
            button.disabled = false;
          } else if (response?.success) {
            console.log("[Content Script] Popup received HTML successfully");
            // Show success feedback
            button.textContent = "✓ Analyzed! Opening...";
            button.style.background =
              "linear-gradient(135deg, #10b981 0%, #059669 100%)";

            // Reset button after a delay
            setTimeout(() => {
              button.textContent = "Analyse";
              button.disabled = false;
              button.style.background =
                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
            }, 2000);
          } else {
            console.error(
              "[Content Script] Popup did not process HTML:",
              response,
            );
            alert("Failed to process page. Please try again.");
            button.textContent = "Analyse";
            button.disabled = false;
          }
        },
      );
    } catch (error) {
      console.error("[Content Script] Error analyzing page:", error);
      alert(
        `Failed to analyze page: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      button.textContent = "Analyse";
      button.disabled = false;
    }
  });
}

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectButton);
} else {
  injectButton();
}

// Also inject on dynamically loaded content
const observer = new MutationObserver(() => {
  if (!injectedButton) {
    injectButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
});

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getResume") {
    // Send resume from localhost localStorage to popup
    try {
      const resumeKey = "resumematch_master_resume";
      const resumeData = localStorage.getItem(resumeKey);
      if (resumeData) {
        const parsed = JSON.parse(resumeData);
        console.log(
          "[Content Script] Sending resume to popup:",
          parsed.contact?.name,
        );
        sendResponse({ resume: parsed });
      } else {
        console.warn("[Content Script] No resume in localhost localStorage");
        sendResponse({ resume: null });
      }
    } catch (e) {
      console.error("[Content Script] Error getting resume:", e);
      sendResponse({ resume: null, error: (e as Error).message });
    }
  } else if (request.action === "injectButton") {
    injectButton();
    sendResponse({ success: true });
  }
});
