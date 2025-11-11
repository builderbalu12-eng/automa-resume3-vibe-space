// Store page data for popup to access
let pageData: {
  pageHTML: string;
  pageURL: string;
} | null = null;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    // Check if tab is a job posting site
    const jobSites = [
      "linkedin.com",
      "indeed.com",
      "naukri.com",
      "monster.com",
      "glassdoor.com",
      "dice.com",
      "ziprecruiter.com",
      "builtin.com",
      "techcrunch.com",
      "careers",
    ];

    const isJobSite = jobSites.some((site) => tab.url?.includes(site));

    if (isJobSite && tab.id) {
      // Update extension badge to indicate it's a job site
      chrome.action.setBadgeText({ text: "✓", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#6633ff", tabId });

      // Inject the button
      chrome.tabs.sendMessage(tabId, { action: "injectButton" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(
            "[Background] Could not inject button:",
            chrome.runtime.lastError.message,
          );
        } else {
          console.log("[Background] Button injected successfully");
        }
      });
    }
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeJob") {
    console.log("[Background] Received analyzeJob from content script", {
      htmlLength: request.pageHTML?.length,
      url: request.pageURL,
    });
    // Store page data from content script
    pageData = {
      pageHTML: request.pageHTML,
      pageURL: request.pageURL,
    };
    sendResponse({ success: true });

    // Open the popup - with a small delay to ensure it can fetch the data
    setTimeout(() => {
      chrome.action.openPopup().catch((error) => {
        console.warn("[Background] Could not open popup:", error.message);
      });
    }, 100);
  } else if (request.action === "getPageData") {
    console.log(
      "[Background] Popup requesting page data:",
      pageData ? `Available (${pageData.pageHTML.length} chars)` : "None",
    );
    // Popup requesting stored page data
    sendResponse({ pageData });
  } else if (request.action === "clearPageData") {
    console.log("[Background] Clearing page data");
    pageData = null;
    sendResponse({ success: true });
  } else if (request.action === "downloadResume") {
    const { url, filename } = request;
    chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });
    sendResponse({ success: true });
  }

  return true; // Keep channel open for async responses
});

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("ResumeMatch Pro extension installed");
});
