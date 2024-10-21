let steps = [];
let isRecording = false;

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));

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
      }).catch((error) => console.error("Error sending initState:", error));
    }).catch((error) => console.error("Error executing script:", error));
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "captureScreenshot":
      chrome.tabs.captureVisibleTab(
        sender.tab.windowId,
        { format: "png", quality: 50 },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error("Error capturing screenshot:", chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ screenshotUrl: dataUrl });
          }
        }
      );
      return true; // Indicates that the response is sent asynchronously

    case "captureVisibleTab":
      chrome.tabs.captureVisibleTab(
        sender.tab.windowId,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error("Error capturing visible tab:", chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl: dataUrl });
          }
        }
      );
      return true; // Indicates that the response is sent asynchronously

    case "addStep":
      if (message.step.type === "iframeInteraction") {
        // Handle iframe interaction step
        const iframeStep = {
          ...message.step,
          frameId: sender.frameId,
          tabId: sender.tab.id
        };
        steps.push(iframeStep);
      } else {
        // Handle regular step
        steps.push(message.step);
      }
      broadcastUpdate();
      sendResponse({ success: true });
      break;

    case "setRecordingState":
      isRecording = message.isRecording;
      broadcastUpdate();
      sendResponse({ success: true });
      break;

    case "getState":
      sendResponse({ isRecording: isRecording, steps: steps });
      break;

    default:
      console.warn("Unknown message action:", message.action);
      sendResponse({ error: "Unknown action" });
  }
});

// Handle external messages (e.g., from Flutter web app)
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log("Received external message:", request);
    console.log("Message type:", typeof request);
    console.log("Sender:", sender);
    
    let parsedRequest = request;
    if (typeof request === 'string') {
      try {
        parsedRequest = JSON.parse(request);
      } catch (e) {
        console.error("Error parsing request:", e);
        sendResponse({status: "Error", error: "Invalid JSON"});
        return;
      }
    }
    
    console.log("Parsed request:", parsedRequest);
    const action = parsedRequest.action;
    console.log("Action:", action);
    
    if (action === "openSidePanel") {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.sidePanel.open({tabId: tabs[0].id})
            .then(() => {
              console.log("Side panel opened successfully");
              sendResponse({status: "Success", message: "Side panel opened"});
            })
            .catch((error) => {
              console.error("Error opening side panel:", error);
              sendResponse({status: "Error", error: error.message});
            });
        } else {
          console.warn("No active tab found");
          sendResponse({status: "Error", error: "No active tab found"});
        }
      });

      return true; // Indicates that the response is sent asynchronously
    } else {
      console.warn("Unknown action:", action);
      sendResponse({status: "Error", error: "Unknown action"});
    }
  }
);

function broadcastUpdate() {
  // Broadcast the updated state to all tabs and the side panel
  const updateMessage = { action: "updateSteps", steps: steps, isRecording: isRecording };
  
  chrome.runtime.sendMessage(updateMessage).catch((error) => 
    console.error("Error broadcasting to side panel:", error)
  );
  
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, updateMessage).catch((error) => {
        // Ignore errors for inactive tabs
        if (error.message !== "The message port closed before a response was received.") {
          console.error(`Error broadcasting to tab ${tab.id}:`, error);
        }
      });
    });
  });
}