// Use 'var' instead of 'let' for these global variables
var isRecording = false;
var steps = [];
var isProcessingClick = false;

function sendMessageWithRetry(message, callback, maxRetries = 3, delay = 1000) {
  let retries = 0;

  function attemptSend() {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
        if (retries < maxRetries) {
          retries++;
          setTimeout(attemptSend, delay);
        } else {
          console.error("Max retries reached. Message failed.");
          callback({ error: "Max retries reached" });
        }
      } else {
        callback(response);
      }
    });
  }

  attemptSend();
}

function initializeContentScript() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message:", message);
    switch (message.action) {
      case "initState":
        isRecording = message.isRecording;
        steps = message.steps;
        sendResponse({ success: true });
        break;
      case "startRecording":
        isRecording = true;
        sendMessageWithRetry({ action: "setRecordingState", isRecording: true }, (response) => {
          sendResponse({ status: response.error ? "Failed to start recording" : "Recording started" });
        });
        return true;
      case "stopRecording":
        isRecording = false;
        sendMessageWithRetry({ action: "setRecordingState", isRecording: false }, (response) => {
          sendResponse({ status: response.error ? "Failed to stop recording" : "Recording stopped" });
        });
        return true;
      case "getRecordingStatus":
        sendMessageWithRetry({ action: "getState" }, (response) => {
          if (response.error) {
            sendResponse({ error: "Failed to get recording status" });
          } else {
            sendResponse({ isRecording: response.isRecording, steps: response.steps });
          }
        });
        return true;
      case "updateSteps":
        steps = message.steps;
        isRecording = message.isRecording; // Update isRecording based on the message
        sendResponse({ success: true });
        break;
      default:
        console.warn("Unknown message action:", message.action);
        sendResponse({ error: "Unknown action" });
    }
  });

  document.addEventListener("click", handleClick, true);
}

async function handleClick(event) {
  console.log("Click event detected");
  console.log("isRecording:", isRecording);
  console.log("isProcessingClick:", isProcessingClick);
  
  if (!isRecording || isProcessingClick) {
    console.log("Not recording or already processing click");
    return;
  }
  
  console.log("Processing click");
  isProcessingClick = true;

  const isLink = event.target.tagName === 'A' || event.target.closest('a');
  let targetHref = '';
  if (isLink) {
    event.preventDefault();
    const linkElement = event.target.tagName === 'A' ? event.target : event.target.closest('a');
    targetHref = linkElement.href;
  }

  const step = {
    x: event.clientX,
    y: event.clientY,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    target: {
      tagName: event.target.tagName,
      id: event.target.id,
      className: event.target.className,
      innerText: event.target.innerText,
      href: targetHref
    }
  };

  console.log("Step details:", step);

  document.body.style.pointerEvents = 'none';

  try {
    await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay

    await new Promise((resolve, reject) => {
      sendMessageWithRetry({ 
        action: "captureVisibleTab"
      }, (response) => {
        console.log("Capture response:", response);
        if (response.error) {
          console.error("Error capturing screenshot:", response.error);
          reject(response.error);
        } else {
          step.screenshot = response.dataUrl;
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      sendMessageWithRetry({ action: "addStep", step: step }, (addStepResponse) => {
        console.log("Add step response:", addStepResponse);
        if (addStepResponse.error) {
          console.error("Error adding step:", addStepResponse.error);
          reject(addStepResponse.error);
        } else {
          console.log("Step added successfully");
          resolve();
        }
      });
    });

  } catch (error) {
    console.error("Error processing click:", error);
  } finally {
    document.body.style.pointerEvents = '';
    isProcessingClick = false;
    if (isLink && targetHref) {
      window.location.href = targetHref; // Navigate after processing
    }
  }
}

initializeContentScript();