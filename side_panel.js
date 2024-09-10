let steps = [];
let isRecording = false;

document.getElementById("startRecording").addEventListener("click", startRecording);
document.getElementById("stopRecording").addEventListener("click", stopRecording);

function sendMessageIfValid(message, callback) {
  if (chrome.runtime && chrome.runtime.id) {
    chrome.runtime.sendMessage(message, callback);
  } else {
    console.error("Extension context invalid");
  }
}

function sendMessageWithRetry(message, callback, maxRetries = 3, delay = 1000) {
  let retries = 0;

  function attemptSend() {
    sendMessageIfValid(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
        if (retries < maxRetries) {
          retries++;
          setTimeout(attemptSend, delay);
        } else {
          console.error("Max retries reached. Message failed.");
          callback(null); // Call the callback with null to indicate failure
        }
      } else {
        callback(response);
      }
    });
  }

  attemptSend();
}

function startRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: true }, (response) => {
    if (response !== null) {
      isRecording = true;
      updateUI();
    } else {
      console.error("Failed to start recording");
    }
  });
}

function stopRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: false }, (response) => {
    if (response !== null) {
      isRecording = false;
      updateUI();
    } else {
      console.error("Failed to stop recording");
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateSteps") {
    steps = message.steps;
    isRecording = message.isRecording;
    updateStepList();
    updateRecordingUI();
  }
});

function updateStepList() {
  const stepList = document.getElementById("stepList");
  
  // Only update new steps
  const currentStepCount = stepList.children.length;
  const fragment = document.createDocumentFragment();

  for (let i = currentStepCount; i < steps.length; i++) {
    const step = steps[i];
    const stepElement = createStepElement(step, i);
    fragment.appendChild(stepElement);

    // Process the screenshot and update the image asynchronously
    processScreenshot(step).then(processedScreenshot => {
      const img = stepElement.querySelector('img');
      img.src = processedScreenshot;
    });
  }

  stepList.appendChild(fragment);
}

function createStepElement(step, index) {
  const stepElement = document.createElement("div");
  stepElement.className = "step";

  const img = document.createElement("img");
  img.src = step.screenshot; // Display the screenshot immediately
  img.alt = `Step ${index + 1} screenshot`;
  stepElement.appendChild(img);

  const info = document.createElement("div");
  info.className = "step-info";
  info.textContent = `Step ${index + 1}: Click at (${step.x}, ${step.y}) - ${new URL(step.url).hostname}`;
  stepElement.appendChild(info);

  return stepElement;
}

function addRedCircle(img, x, y) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  ctx.beginPath();
  ctx.arc(x, y, 20, 0, 2 * Math.PI);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;
  ctx.stroke();

  return canvas.toDataURL();
}

function processScreenshot(step) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const processedScreenshot = addRedCircle(img, step.x, step.y);
      resolve(processedScreenshot);
    };
    img.src = step.screenshot;
  });
}

function updateRecordingUI() {
  document.getElementById("startRecording").style.display = isRecording ? "none" : "block";
  document.getElementById("stopRecording").style.display = isRecording ? "block" : "none";
}

function updateUI() {
  sendMessageWithRetry({ action: "getState" }, (response) => {
    if (response !== null) {
      isRecording = response.isRecording;
      steps = response.steps;
      updateStepList();
      updateRecordingUI();
    } else {
      console.error("Failed to get state");
    }
  });
}

// Initialize the side panel
updateUI();