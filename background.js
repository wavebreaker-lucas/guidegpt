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
    broadcastUpdate();
  } else if (message.action === "setRecordingState") {
    isRecording = message.isRecording;
    broadcastUpdate();
  } else if (message.action === "getState") {
    sendResponse({ isRecording: isRecording, steps: steps });
  }
});

function broadcastUpdate() {
  // Broadcast the updated state to all tabs and the side panel
  const updateMessage = { action: "updateSteps", steps: steps, isRecording: isRecording };
  
  chrome.runtime.sendMessage(updateMessage);
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, updateMessage);
    });
  });
}