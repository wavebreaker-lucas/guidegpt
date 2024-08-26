let isRecording = false;
let steps = [];

function initializeContentScript() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "initState") {
      isRecording = message.isRecording;
      steps = message.steps;
    } else if (message.action === "startRecording") {
      isRecording = true;
      chrome.runtime.sendMessage({ action: "setRecordingState", isRecording: true });
      sendResponse({ status: "Recording started" });
    } else if (message.action === "stopRecording") {
      isRecording = false;
      chrome.runtime.sendMessage({ action: "setRecordingState", isRecording: false });
      sendResponse({ status: "Recording stopped" });
    } else if (message.action === "getRecordingStatus") {
      chrome.runtime.sendMessage({ action: "getState" }, (response) => {
        sendResponse({ isRecording: response.isRecording, steps: response.steps });
      });
      return true; // Indicates that the response is sent asynchronously
    } else if (message.action === "updateSteps") {
      steps = message.steps;
    }
  });

  document.addEventListener("click", (event) => {
    if (!isRecording) return;

    const step = {
      x: event.clientX,
      y: event.clientY,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    chrome.runtime.sendMessage({ action: "captureScreenshot" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }

      step.screenshot = response.screenshotUrl;
      chrome.runtime.sendMessage({ action: "addStep", step: step });
    });
  });
}

initializeContentScript();