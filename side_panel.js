let steps = [];
let startRecord = false;
let isRecording = false;
let isPausing = false;
let isAuthenticated = false;

document.getElementById("startRecording").addEventListener("click", startRecording);
document.getElementById("finishRecording").addEventListener("click", finishRecording);
document.getElementById("pauseRecording").addEventListener("click", pauseRecording);
document.getElementById("continueRecording").addEventListener("click", continueRecording);
document.getElementById("loginWithGoogle").addEventListener("click", loginWithGoogle);

function loginWithGoogle() {
  // Simulate Google login
  isAuthenticated = true;
  updateAuthUI(); // Update the UI after login
}

function updateAuthUI() {
  if (isAuthenticated) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("controls").style.display = "block";
    document.getElementById("stepList").style.display = "block";
    document.getElementById("exportOptions").style.display = "block";
    updateRecordingUI();
  } else {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("controls").style.display = "none";
    document.getElementById("stepList").style.display = "none";
    document.getElementById("exportOptions").style.display = "none";
  }
}

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
      startRecord = true;
      isRecording = true;
      updateUI();
    } else {
      console.error("Failed to start recording");
    }
  });
}

function pauseRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: false }, (response) => {
    if (response !== null) {
      isRecording = false;
      isPausing = true;
      updateUI();
    } else {
      console.error("Failed to stop recording");
    }
  });
}

function continueRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: true }, (response) => {
    if (response !== null) {
      isRecording = true;
      isPausing = false;
      updateUI();
    } else {
      console.error("Failed to stop recording");
    }
  });
}

async function submitDataToDatabase() {
  try {
    const project = createProjectData(); // Collects and structures the project data
    const response = await fetch('https://us-central1-matapass-716cc.cloudfunctions.net/readFirestore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(project)
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    console.log('Project created successfully');
  } catch (error) {
    console.error('Error creating project:', error);
  }
}

function createProjectData() {
  console.log('steps', steps);
  var newid  = 'id-' + Math.random().toString(36).substr(2, 9);
  return {
    id: newid,  // Generate or assign a unique ID
    title: 'Project Title',
    subtitle: 'Project Subtitle',
    author: 'matapass Guest',
    authorId: 'TOyVEd848YMEx1gMA8m3kFKcvQ73',
    steps: steps.map(step => (
      step.type === 'click'
        ? {
          runtimeType: step.type,
          //runtimeType must be declared, as have to be clearify for @freezed
          clickStep: {
            screenshotUrl: step.screenshot,
            viewportWidth: step.viewportWidth,
            viewportHeight: step.viewportHeight,
            createdTime: step.timestamp,
            pageX: step.pageX,
            pageY: step.pageY,
            scrollX: step.scrollX,
            scrollY: step.scrollY,
            iframeX: step.x,
            iframeY: step.y,
            innerText: step.target.innerText
          }
        } : step.type === 'navigate' ?
          {
            runtimeType: step.type,
            navigateStep: {
              targetUrl: step.url,
              createdTime: step.timestamp,
              innerText: step.message,
            }
          } : {
            runtimeType: step.type,
            clickStep: {
              screenshotUrl: step.screenshot,
              viewportWidth: step.viewportWidth,
              viewportHeight: step.viewportHeight,
              createdTime: step.timestamp,
              pageX: step.pageX,
              pageY: step.pageY,
              scrollX: step.scrollX,
              scrollY: step.scrollY,
              iframeX: step.x,
              iframeY: step.y,
              innerText: step.target.innerText
            }
          }
    )),
    createdTime: new Date().toISOString()
  };
}

async function finishRecording() {
  sendMessageWithRetry({ action: "setRecordingState", isRecording: false }, async (response) => {
    if (response !== null) {
      const stepsData = steps.map(step => ({
        ...step,
        coordinates: step.coordinates || { x: 0, y: 0 } // Default if not present
      }));
      const encodedStepsData = encodeURIComponent(JSON.stringify(stepsData));
      const newUrl = `recorded_step.html?data=${encodedStepsData}`;
      chrome.tabs.create({ url: newUrl }, () => {
        isRecording = false;
        isPausing = false;
      });
      await submitDataToDatabase();
      window.close();
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
  //for creating a first step which mention the website in
  //TODO web tab change step add (with TextStep Element)

  for (let i = currentStepCount; i < steps.length; i++) {
    const step = steps[i];

    console.log('steps[i]', steps[i]);

    if (currentStepCount === 0 && isRecording) {
      const firstFragment = document.createDocumentFragment();
      const firstStep = step;
      const firstElement = createFirstStepElement(firstStep, i);
      firstFragment.appendChild(firstElement);
      stepList.appendChild(firstFragment);
    }
    const stepElement = createStepElement(step, i);
    fragment.appendChild(stepElement);
  }
  stepList.appendChild(fragment);
  stepList.scrollTop = stepList.scrollHeight;
}

function createFirstStepElement(step, index) {
  const stepElement = document.createElement("div");
  stepElement.className = "step";
  const info = document.createElement("div");
  info.className = "step-info";

  info.textContent = `Step ${index + 1} : Navigate to ${new URL(step.url)}`;

  stepElement.appendChild(info);

  return stepElement;
}
//For creating the first step instruction: navigated to ... website


function createStepElement(step, index) {
  const stepElement = document.createElement("div");
  stepElement.className = "step";


  function imageCreate() {
    const img = document.createElement("img");
    img.src = step.screenshot; // Display the screenshot immediately
    img.alt = `Step ${index + 1} screenshot`;
    stepElement.appendChild(img);
    // Process the screenshot and update the image asynchronously
    processScreenshot(step).then(processedScreenshot => {
      const img = stepElement.querySelector('img');
      img.src = processedScreenshot;
    });
  }

  const info = document.createElement("div");
  info.className = "step-info";
  var innerText = step.target['innerText'];
  var updatedText = innerText.replace(/\n/g, ' ');

  if (step.type === 'iframeInteraction') {
    imageCreate();
    info.textContent = `Step ${index + 1}: Iframe interaction at (${step.x}, ${step.y}) - ${new URL(step.url).hostname}`;
  } else if (step.type === 'keydown') {
    info.textContent = `Step ${index + 1}: Press ${step.key}`;
  } else if (step.type === 'visibilitychange') {
    info.textContent = `Step ${index + 1}: Press Tab {${step.title}}`;
  } else {
    imageCreate();
    if (step.target['tagName'] === 'HTML') {
      info.textContent = `Step ${index + 1}: ${step.type} here `;
    } else if (step.target['tagName'] === 'DIV') {
      info.textContent = `Step ${index + 1}: ${step.type} here `;
    } else if (updatedText === "") {
      info.textContent = `Step ${index + 1}: Click here"`;
    }
    else {
      info.textContent = `Step ${index + 1}: ${step.type} "${updatedText}"`;
    }
    // Process the screenshot and update the image asynchronously
    processScreenshot(step).then(processedScreenshot => {
      const img = stepElement.querySelector('img');
      img.src = processedScreenshot;
    });
  }

  stepElement.appendChild(info);

  return stepElement;
}

function addRedCircle(img, step) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;

  const scaleX = img.width / step.viewportWidth;
  const scaleY = img.height / step.viewportHeight;

  console.log('step`', step);
  let x, y;

  if (step.type === 'iframeInteraction') {
    x = (step.iframePosition.x + step.pageX - step.scrollX) * scaleX;
    y = (step.iframePosition.y + step.pageY - step.scrollY) * scaleY;
  } else {
    x = (step.pageX - step.scrollX) * scaleX;
    y = (step.pageY - step.scrollY) * scaleY;

  }

  // Zoom parameters
  const zoomFactor = 4; // Adjust this value to change the zoom level
  const zoomedWidth = canvas.width / zoomFactor;
  const zoomedHeight = canvas.height / zoomFactor;

  // Calculate the top-left corner of the zoomed area
  let sx = x - zoomedWidth / 2;
  let sy = y - zoomedHeight / 2;

  // Adjust if the zoomed area goes out of bounds
  sx = Math.max(0, Math.min(sx, img.width - zoomedWidth));
  sy = Math.max(0, Math.min(sy, img.height - zoomedHeight));

  // Draw the zoomed image
  ctx.drawImage(img, sx, sy, zoomedWidth, zoomedHeight, 0, 0, canvas.width, canvas.height);

  // Recalculate the circle position based on the zoom
  const circleX = (x - sx) * (canvas.width / zoomedWidth);
  const circleY = (y - sy) * (canvas.height / zoomedHeight);

  // Ensure the circle is always visible
  const circleRadius = 200;
  const adjustedCircleX = Math.max(circleRadius, Math.min(circleX, canvas.width - circleRadius));
  const adjustedCircleY = Math.max(circleRadius, Math.min(circleY, canvas.height - circleRadius));

  // Draw the red circle
  ctx.beginPath();
  ctx.arc(adjustedCircleX, adjustedCircleY, circleRadius, 0, 2 * Math.PI);
  ctx.strokeStyle = "red";
  ctx.fillStyle = "rgba(255, 0, 0, 0.1)"; // Set the fill color (red with transparency)
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.stroke();

  return {
    processedImage: canvas.toDataURL(),
    coordinates: { x, y }
  };
}

function processScreenshot(step) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { processedImage, coordinates } = addRedCircle(img, step);
      step.coordinates = coordinates; // Store the coordinates in the step
      resolve(processedImage);
    };
    img.src = step.screenshot;
  });
}
startRecord, isRecording, isPausing
function updateRecordingUI() {
  document.getElementById("startRecording").style.display = !startRecord && !isRecording ? "block" : "none";
  document.getElementById("finishRecording").style.display = startRecord ? "block" : "none";
  document.getElementById("pauseRecording").style.display = startRecord && isRecording && !isPausing ? "block" : "none";
  document.getElementById("continueRecording").style.display = startRecord && !isRecording && isPausing ? "block" : "none";
}

function updateUI() {
  if (isAuthenticated) { }
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
updateAuthUI();
updateUI();
