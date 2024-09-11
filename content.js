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
  console.log("Click listener added");

  setupIframeListeners();
  console.log("Iframe listeners set up");
}

function setupIframeListeners() {
  document.addEventListener('click', handleIframeInteraction, true);
  document.addEventListener('focus', handleIframeInteraction, true);
}

function handleIframeInteraction(event) {
  if (!isRecording || isProcessingClick) return;

  const iframe = event.target.closest('iframe');
  if (iframe) {
    isProcessingClick = true;
    const step = {
      type: 'iframeInteraction',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      iframeSource: iframe.src,
      interactionType: event.type
    };

    sendMessageWithRetry({ action: "addStep", step: step }, (response) => {
      console.log("Iframe interaction step added:", response);
    });

    // Capture screenshot after a short delay
    setTimeout(() => {
      sendMessageWithRetry({ action: "captureVisibleTab" }, (response) => {
        if (response.error) {
          console.error("Error capturing screenshot for iframe interaction:", response.error);
        } else {
          step.screenshot = response.dataUrl;
          sendMessageWithRetry({ action: "updateStep", step: step }, (updateResponse) => {
            console.log("Iframe interaction step updated with screenshot:", updateResponse);
            isProcessingClick = false;
          });
        }
      });
    }, 500);
  }
}

async function handleClick(event) {
  console.log("Click event detected");
  console.log("isRecording:", isRecording);
  console.log("isProcessingClick:", isProcessingClick);
  
  if (!event.isTrusted || !isRecording || isProcessingClick || event.clientX === undefined || event.clientY === undefined) {
    console.log("Skipping this event.");
    return;
  }
  
  console.log("Processing click");
  isProcessingClick = true;

  const isLink = event.target && (event.target.tagName === 'A' || event.target.closest('a'));
  let targetHref = '';
  if (isLink) {
    event.preventDefault();
    const linkElement = event.target.tagName === 'A' ? event.target : event.target.closest('a');
    targetHref = linkElement ? linkElement.href : '';
  }

  const rect = event.target ? event.target.getBoundingClientRect() : { left: 0, top: 0 };
  const step = {
    type: 'click',
    x: event.clientX + window.pageXOffset,
    y: event.clientY + window.pageYOffset,
    frameX: rect.left + window.pageXOffset,
    frameY: rect.top + window.pageYOffset,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    target: event.target ? {
      tagName: event.target.tagName || '',
      id: event.target.id || '',
      className: event.target.className || '',
      innerText: event.target.innerText || '',
      href: targetHref
    } : {}
  };

  console.log("Step details:", step);

  document.body.style.pointerEvents = 'none';

  try {
    // Capture screenshot immediately
    await new Promise((resolve, reject) => {
      sendMessageWithRetry({ 
        action: "captureVisibleTab"
      }, (response) => {
        console.log("Capture response:", response);
        if (response.error) {
          console.error("Error capturing screenshot:", response.error);
          reject(response.error);
        } else if (!response.dataUrl) {
          console.error("Screenshot capture failed: No dataUrl received");
          reject(new Error("No screenshot data received"));
        } else {
          step.screenshot = response.dataUrl;
          console.log("Screenshot captured successfully");
          resolve();
        }
      });
    });

    // Add the step with the screenshot
    await new Promise((resolve, reject) => {
      sendMessageWithRetry({ action: "addStep", step: step }, (addStepResponse) => {
        console.log("Add step response:", addStepResponse);
        if (addStepResponse.error) {
          console.error("Error adding step:", addStepResponse.error);
          reject(addStepResponse.error);
        } else {
          console.log("Step added successfully with screenshot");
          resolve();
        }
      });
    });

  } catch (error) {
    console.error("Error processing click or capturing screenshot:", error);
  } finally {
    document.body.style.pointerEvents = '';
    isProcessingClick = false;
    if (isLink && targetHref) {
      window.location.href = targetHref; // Navigate after processing
    }
  }
}

initializeContentScript();