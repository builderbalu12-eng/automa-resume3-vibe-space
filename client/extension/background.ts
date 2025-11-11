// Store page data for popup to access
let pageData: {
  pageHTML: string;
  pageURL: string;
} | null = null;

// Log when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Background] ResumeMatch Pro extension installed");
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

    // Open the popup after a short delay to ensure it can fetch the data
    console.log("[Background] Opening popup...");
    setTimeout(() => {
      chrome.action.openPopup().catch((error) => {
        console.warn("[Background] Could not open popup:", error.message);
      });
    }, 200);
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
    console.log("[Background] Downloading:", filename);
    chrome.downloads.download({
      url,
      filename,
      saveAs: false,
    });
    sendResponse({ success: true });
  }

  return true; // Keep channel open for async responses
});
