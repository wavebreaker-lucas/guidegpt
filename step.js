let displayedSteps = [];
let isDragging = false;
let draggable = false;

document.getElementById('fetchDataButton').addEventListener('click', async () => {
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
});
function createProjectData() {
    console.log('displayedSteps', displayedSteps);
    return {
        id: 'unique-project-id',  // Generate or assign a unique ID
        title: 'Project Title',
        subtitle: 'Project Subtitle',
        author: 'John Chong',
        authorId: 'pK07huTGEJUMOylbMBmvZSuPYCu2',
        steps: displayedSteps.map(step => (
            step.type === 'click'
                ? {
                    stepType: step.type,
                    targetUrl: step.url,
                    screenshotUrl: step.screenshot,
                    viewportWidth: step.viewportWidth,
                    viewportHeight: step.viewportHeight,
                    createdTime: step.timestamp,
                    pageX: step.pageX,
                    pageY: step.pageY,
                    scrollX: step.scrollX,
                    scrollY: step.scrollY,
                    iframeX: step.x,
                    iframeY: step.coordinates.y,
                    innerText: step.target.innerText
                } : step.type === 'Navigate' ?
                    {
                        stepType: step.type,
                        targetUrl: step.url,
                        createdTime: step.timestamp,
                        innerText: step.message,
                    } : {
                        stepType: step.type,
                        targetUrl: step.url,
                        screenshotUrl: step.screenshot,
                        viewportWidth: step.viewportWidth,
                        viewportHeight: step.viewportHeight,
                        createdTime: step.timestamp,
                        pageX: step.pageX,
                        pageY: step.pageY,
                        scrollX: step.scrollX,
                        scrollY: step.scrollY,
                        iframeX: step.coordinates.x,
                        iframeY: step.coordinates.y,
                        innerText: step.target.innerText
                    }
        )),
        createdTime: new Date().toISOString()
    };
}

function displaySteps(steps) {
    const stepsContainer = document.getElementById('stepsContainer');
    stepsContainer.innerHTML = ''; // Clear previous steps
    steps.forEach((step, index) => {
        displayedSteps.push(step);
        const stepElement = document.createElement('div');
        stepElement.className = 'step';

        const stepNumber = document.createElement('span');
        stepNumber.className = 'step-number';
        stepNumber.textContent = index + 1;

        const textElement = document.createElement('p');
        textElement.style.display = 'inline';
        stepElement.appendChild(stepNumber);
        textElement.innerHTML += `${step.type} at `;

        if (index == 0) {
            const stepUrl = document.createElement('span');
            stepUrl.className = 'step-url';
            stepUrl.textContent = step.url;
            textElement.appendChild(stepUrl);
        } else {
            const innerText = document.createElement('span');
            innerText.textContent = step.target.innerText.replace(/\n/g, ' ');
            textElement.appendChild(innerText);
        }

        textElement.ondblclick = () => {
            textElement.contentEditable = true;
            textElement.focus();
            textElement.onblur = () => {
                textElement.contentEditable = false;
            };
        };
        stepElement.appendChild(textElement);

        if (step.screenshot) {
            const img = new Image();
            img.src = step.screenshot;
            img.style.position = 'relative';

            img.onload = () => {
                const [canvas, coordinates, enableDragging] = createCanvasWithCircle(img, step);
                stepElement.appendChild(canvas);
                stepElement.appendChild(coordinates);
            };
        }

        const editButton = createEditButton();
        stepElement.appendChild(editButton);

        stepsContainer.appendChild(stepElement);
    });
}

function createCanvasWithCircle(img, step) {
    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.position = 'relative';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = '100%';

    const scaleX = img.width / step.viewportWidth;
    const scaleY = img.height / step.viewportHeight;

    let circleX, circleY;
    if (step.type === 'iframeInteraction') {
        circleX = (step.iframePosition.x + step.pageX - step.scrollX) * scaleX;
        circleY = (step.iframePosition.y + step.pageY - step.scrollY) * scaleY;
    } else {
        circleX = (step.pageX - step.scrollX) * scaleX;
        circleY = (step.pageY - step.scrollY) * scaleY;
    }

    const circleRadius = 50;

    const coordinates = document.createElement('p');
    updateCoordinates();

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        ctx.beginPath();
        ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = "red";
        ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.stroke();
    }

    function isInCircle(x, y) {
        const dx = x - circleX;
        const dy = y - circleY;
        return dx * dx + dy * dy <= circleRadius * circleRadius;
    }

    function updateCoordinates() {
        coordinates.textContent = `Circle Position: (${Math.round(circleX)}, ${Math.round(circleY)})`;
    }

    canvas.addEventListener('mousedown', (e) => {
        if (!draggable) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        if (isInCircle(mouseX, mouseY)) {
            isDragging = true;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            circleX = (e.clientX - rect.left) * scaleX;
            circleY = (e.clientY - rect.top) * scaleY;
            draw();
            updateCoordinates();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    draw();

    const penButton = document.createElement('button');
    penButton.className = 'pen-button';
    penButton.innerHTML = '✏️';
    penButton.onclick = () => {
        if (draggable) {
            draggable = false;
            penButton.innerHTML = '✏️';
        } else {
            draggable = true;
            penButton.innerHTML = '✔️';
            enableDragging();
        }
    };
    canvasWrapper.appendChild(canvas);
    canvasWrapper.appendChild(penButton);

    canvasWrapper.addEventListener('mouseenter', () => {
        penButton.style.display = 'block';
    });

    canvasWrapper.addEventListener('mouseleave', () => {
        penButton.style.display = 'none';
    });

    function enableDragging() {
        draggable = true;
        setTimeout(() => {
            draggable = false;
        }, 5000);
    }

    return [canvasWrapper, coordinates, enableDragging];
}

function createEditButton() {
    const editButton = document.createElement('div');
    editButton.className = 'edit-button';
    editButton.textContent = 'Edit';

    const dropdown = document.createElement('div');
    dropdown.className = 'edit-dropdown';

    const options = ['Edit', 'Remove', 'Reorder', 'Blur'];
    options.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.textContent = option;
        optionElement.onclick = () => alert(`${option} clicked!`);
        dropdown.appendChild(optionElement);
    });

    editButton.onclick = () => {
        dropdown.style.display = dropdown.style.display === 'inline-flex' ? 'none' : 'inline-flex';
    };

    editButton.appendChild(dropdown);
    return editButton;
}

document.addEventListener('DOMContentLoaded', getStepsFromUrl);

function getStepsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const data = params.get('data');
    if (data) {
        try {
            const steps = JSON.parse(decodeURIComponent(data));
            displaySteps(steps);
        } catch (error) {
            console.error('Failed to parse steps data', error);
        }
    }
}