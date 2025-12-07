import {
  extractJobDescriptionFromDOM,
  createJobExtractionButton,
} from "@/utils/jobExtractor";

let injectedButton = false;

// Listen for messages from the web app via window.postMessage
// This allows the web app (localhost) to communicate with the extension
window.addEventListener("message", (event) => {
  // Only accept messages from our web app
  if (event.source !== window) return;
  if (event.data.source !== "resumematch-web-app") return;

  console.log(
    "[Content Script] Received message from web app:",
    event.data.action,
  );

  if (event.data.action === "saveSettings") {
    console.log(
      "[Content Script] Web app requesting to save settings:",
      event.data.settings,
    );

    // Relay to background script
    chrome.runtime.sendMessage(
      {
        action: "saveSettings",
        settings: event.data.settings,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Content Script] Error relaying saveSettings to background:",
            chrome.runtime.lastError.message,
          );
        } else {
          console.log(
            "[Content Script] ✓ Settings relayed to background script successfully",
            response,
          );
        }
      },
    );
  }
});

function injectButton() {
  // Prevent duplicate buttons
  if (injectedButton) {
    console.log("[Content Script] Button already injected, skipping");
    return;
  }

  // Check if button already exists
  if (document.getElementById("resumematch-extract-btn")) {
    console.log("[Content Script] Button element already exists");
    injectedButton = true;
    return;
  }

  try {
    const button = createJobExtractionButton();
    document.body.appendChild(button);
    injectedButton = true;

    console.log(
      "[Content Script] Button injected successfully at",
      new Date().toISOString(),
    );

    button.addEventListener("click", async () => {
      console.log("[Content Script] Button clicked");
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
        console.log("[Content Script] Page URL:", pageURL);

        // Send to background service worker to store and open popup
        chrome.runtime.sendMessage(
          {
            action: "analyzeJob",
            pageHTML: pageHTML,
            pageURL: pageURL,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Content Script] Error sending message:",
                chrome.runtime.lastError.message,
              );
              alert(
                `Error: ${chrome.runtime.lastError.message}. Please try again.`,
              );
              button.textContent = "Analyse";
              button.disabled = false;
            } else if (response?.success) {
              console.log("[Content Script] Message sent successfully");
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
              console.error("[Content Script] No success response");
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
  } catch (error) {
    console.error("[Content Script] Error creating button:", error);
  }
}

// Inject button when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectButton);
} else {
  // DOM already loaded
  setTimeout(injectButton, 100);
}

// Also inject on dynamically loaded content
const observer = new MutationObserver(() => {
  if (!injectedButton && !document.getElementById("resumematch-extract-btn")) {
    injectButton();
  }
});

// Start observing after a short delay
setTimeout(() => {
  observer.observe(document.body, {
    childList: true,
    subtree: false,
    attributes: false,
  });
}, 500);

// Listen for messages from background or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[Content Script] Received message:", request.action);

  if (request.action === "getResume") {
    // Send resume from chrome.storage.sync
    console.log("[Content Script] getResume requested");
    chrome.storage.sync.get(["resumematch_master_resume"], (result) => {
      try {
        const resumeData = result["resumematch_master_resume"];
        if (resumeData) {
          const parsed =
            typeof resumeData === "string"
              ? JSON.parse(resumeData)
              : resumeData;
          console.log(
            "[Content Script] Sending resume from chrome.storage:",
            parsed.contact?.name,
          );
          sendResponse({ resume: parsed });
        } else {
          // Try localStorage as fallback
          const localResume = localStorage.getItem("resumematch_master_resume");
          if (localResume) {
            const parsed = JSON.parse(localResume);
            console.log(
              "[Content Script] Sending resume from localStorage:",
              parsed.contact?.name,
            );
            sendResponse({ resume: parsed });
          } else {
            console.warn("[Content Script] No resume found");
            sendResponse({ resume: null });
          }
        }
      } catch (e) {
        console.error("[Content Script] Error getting resume:", e);
        sendResponse({ resume: null, error: (e as Error).message });
      }
    });
    return true; // Will respond asynchronously
  } else if (request.action === "injectButton") {
    console.log("[Content Script] Received inject button request");
    injectButton();
    sendResponse({ success: true });
  } else if (request.action === "analyzeCurrentPage") {
    console.log("[Content Script] Received analyzeCurrentPage request");
    try {
      const pageHTML = document.documentElement.outerHTML;
      const pageURL = window.location.href;
      chrome.runtime.sendMessage(
        { action: "analyzeJob", pageHTML, pageURL },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Content Script] Error forwarding analyzeJob:",
              chrome.runtime.lastError.message,
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            sendResponse({ success: Boolean(response?.success) });
          }
        },
      );
    } catch (e) {
      console.error("[Content Script] Failed to capture page:", e);
      sendResponse({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return true; // async response
  } else if (request.action === "syncApplications") {
    console.log("[Content Script] Syncing applications to localStorage");
    try {
      const apps = Array.isArray(request.apps) ? request.apps : [];
      localStorage.setItem("resumematch_applications", JSON.stringify(apps));
      sendResponse({ success: true });
    } catch (e) {
      console.error("[Content Script] Failed to sync applications:", e);
      sendResponse({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return true;
  } else if (request.action === "saveSettings") {
    console.log(
      "[Content Script] Received saveSettings request, relaying to background script",
    );
    try {
      // Relay the settings to the background script
      chrome.runtime.sendMessage(
        {
          action: "saveSettings",
          settings: request.settings,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Content Script] Error relaying saveSettings:",
              chrome.runtime.lastError.message,
            );
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            console.log(
              "[Content Script] ✓ Settings relayed successfully to background script",
            );
            sendResponse(response || { success: true });
          }
        },
      );
    } catch (e) {
      console.error("[Content Script] Failed to relay settings:", e);
      sendResponse({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return true; // async response
  }
});
