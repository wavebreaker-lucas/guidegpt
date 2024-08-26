function initializeContentScript() {
  let isRecording = false;
  let steps = [];

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startRecording") {
      isRecording = true;
      steps = [];
      sendResponse({ status: "Recording started" });
    } else if (message.action === "stopRecording") {
      isRecording = false;
      sendResponse({ status: "Recording stopped", steps: steps });
    } else if (message.action === "getRecordingStatus") {
      sendResponse({ isRecording: isRecording, steps: steps });
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
      steps.push(step);
      chrome.runtime.sendMessage({ action: "updateSteps", steps: steps });
    });
  });
}

initializeContentScript();