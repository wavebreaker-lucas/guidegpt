function displaySteps(steps) {
    const stepsContainer = document.getElementById('stepsContainer');
    steps.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = 'step';

        const textElement = document.createElement('p');
        textElement.textContent = `Step ${index + 1}: ${step.type} at ${step.url}`;
        stepElement.appendChild(textElement);

        if (step.screenshot) {
            const img = new Image();
            img.src = step.screenshot;
            img.onload = () => {
                const [canvas, coordinates] = createCanvasWithCircle(img, step);
                stepElement.appendChild(canvas);
                stepElement.appendChild(coordinates);
            };
        }

        stepsContainer.appendChild(stepElement);
    });
}

function createCanvasWithCircle(img, step) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;
    canvas.style.width = '100%';

    let circleX = 150;
    let circleY = 150;
    const circleRadius = 50;
    let isDragging = false;

    // Create a paragraph to display coordinates
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
    return [canvas, coordinates];
}

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

document.addEventListener('DOMContentLoaded', getStepsFromUrl);