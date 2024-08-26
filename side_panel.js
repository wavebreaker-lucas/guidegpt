let steps = [];
let isRecording = false;

document.getElementById("startRecording").addEventListener("click", startRecording);
document.getElementById("stopRecording").addEventListener("click", stopRecording);

function startRecording() {
  chrome.runtime.sendMessage({ action: "setRecordingState", isRecording: true }, () => {
    isRecording = true;
    updateUI();
  });
}

function stopRecording() {
  chrome.runtime.sendMessage({ action: "setRecordingState", isRecording: false }, () => {
    isRecording = false;
    updateUI();
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

async function updateStepList() {
  const stepList = document.getElementById("stepList");
  
  // Only update new steps
  const currentStepCount = stepList.children.length;
  for (let i = currentStepCount; i < steps.length; i++) {
    const step = steps[i];
    const stepElement = document.createElement("div");
    stepElement.className = "step";

    const img = document.createElement("img");
    img.src = step.screenshot; // Display the screenshot immediately
    stepElement.appendChild(img);

    const info = document.createElement("div");
    info.className = "step-info";
    info.textContent = `Step ${i + 1}: Click at (${step.x}, ${step.y}) - ${step.url}`;
    stepElement.appendChild(info);

    stepList.appendChild(stepElement);

    // Process the screenshot and update the image asynchronously
    processScreenshot(step).then(processedScreenshot => {
      img.src = processedScreenshot;
    });
  }
}

function addRedCircle(img, x, y) {
  return new Promise((resolve) => {
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

    resolve(canvas.toDataURL());
  });
}

async function processScreenshot(step) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const processedScreenshot = await addRedCircle(img, step.x, step.y);
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
  chrome.runtime.sendMessage({ action: "getState" }, (response) => {
    isRecording = response.isRecording;
    steps = response.steps;
    updateStepList();
    updateRecordingUI();
  });
}

// Initialize the side panel
updateUI();