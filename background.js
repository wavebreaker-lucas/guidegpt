let steps = [];
let isRecording = false;

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      // After injecting the content script, send the current state
      chrome.tabs.sendMessage(tabId, { 
        action: "initState", 
        isRecording: isRecording, 
        steps: steps 
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "captureScreenshot") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      sendResponse({ screenshotUrl: dataUrl });
    });
    return true;
  } else if (message.action === "addStep") {
    steps.push(message.step);
    // Broadcast the updated steps to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: "updateSteps", steps: steps });
      });
    });
  } else if (message.action === "setRecordingState") {
    isRecording = message.isRecording;
  } else if (message.action === "getState") {
    sendResponse({ isRecording: isRecording, steps: steps });
  }
});