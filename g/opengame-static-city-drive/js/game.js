document.addEventListener('DOMContentLoaded', () => {
    const gameCanvas = document.getElementById('gameCanvas');
    const miniMap = document.getElementById('miniMap');
    const ctx = gameCanvas.getContext('2d');
    const miniCtx = miniMap.getContext('2d');

    const startButton = document.getElementById('start-button');
    const helpButton = document.getElementById('help-button');
    const resumeButton = document.getElementById('resume-button');
    const restartButton = document.getElementById('restart-button');
    const restartGameOverButton = document.getElementById('restart-game-over-button');
    const restartVictoryButton = document.getElementById('restart-victory-button');
    
    const titleScreen = document.getElementById('title-screen');
    const pauseOverlay = document.getElementById('pause-overlay');
    const gameOverScreen = document.getElementById('game-over-screen');
    const victoryScreen = document.getElementById('victory-screen');

    const scoreDisplay = document.getElementById('score');
    const levelDisplay = document.getElementById('level');
    const healthDisplay = document.getElementById('health');
    const packagesCollectedDisplay = document.getElementById('packagesCollected');
    const timerDisplay = document.getElementById('timer');
    const wantedLevelDisplay = document.getElementById('wantedLevel');
    const policeHitsDisplay = document.getElementById('policeHits');

    let gameInterval;
    let animationFrame;
    let packagesCollected = 0;
    let score = 0;
    let level = 1;
    let health = 3;
    let wantedLevel = 0;
    let policeHits = 0;
    let isGamePaused = false;
    let soundEnabled = true;

    const carWidth = 20;
    const carHeight = 40;
    const worldBounds = { x: gameCanvas.width, y: gameCanvas.height };
    
    // Player car object
    const playerCar = {
        x: gameCanvas.width / 2,
        y: gameCanvas.height / 2,
        width: carWidth,
        height: carHeight,
        angle: 0,
        speed: 0,
        maxSpeed: 5,
        acceleration: 0.1,
        friction: 0.98,
        rotationSpeed: 0.03,
        isBoosting: false
    };

    // Package collection
    const packages = [];
    for (let i = 0; i < 10; i++) {
        packages.push(
            createPackage()
        );
    }

    // Police cars array
    let policeCars = [];

    function createPackage() {
        return {
            x: Math.random() * (worldBounds.x - 20) + 10,
            y: Math.random() * (worldBounds.y - 20) + 10,
            width: 10,
            height: 10
        };
    }

    function createPoliceCar() {
        const spawnPoints = [
            { x: 50, y: 50 },
            { x: worldBounds.x - 50, y: 50 },
            { x: 50, y: worldBounds.y - 50 },
            { x: worldBounds.x - 50, y: worldBounds.y - 50 }
        ];
        const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

        return {
            ...spawnPoint,
            width: carWidth,
            height: carHeight,
            angle: 0,
            speed: 2,
            maxSpeed: 3,
            acceleration: 0.05,
            friction: 0.98,
            rotationSpeed: 0.02
        };
    }

    function resetGame() {
        playerCar.x = gameCanvas.width / 2;
        playerCar.y = gameCanvas.height / 2;
        playerCar.angle = 0;
        playerCar.speed = 0;
        playerCar.isBoosting = false;
        packagesCollected = 0;
        score = 0;
        level = 1;
        health = 3;
        wantedLevel = 0;
        policeHits = 0;
        policeCars = [];

        // Reset package locations
        for (let i = 0; i < packages.length; i++) {
            packages[i] = createPackage();
        }
    }

    function startGame() {
        titleScreen.style.display = 'none';
        pauseOverlay.style.display = 'none';
        gameOverScreen.style.display = 'none';
        victoryScreen.style.display = 'none';
        isGamePaused = false;

        resetGame();
        updateHUD();
        gameInterval = setInterval(update, 16);
    }

    function restartGame() {
        clearInterval(gameInterval);
        cancelAnimationFrame(animationFrame);
        startGame();
    }

    function showHelp() {
        alert(`Controls:
- Arrow Keys: Drive
- Space: Boost
- P: Pause/Resume
- H: Show Help`);
    }

    function updateHUD() {
        scoreDisplay.innerText = `Score: ${score}`;
        levelDisplay.innerText = `Level: ${level}`;
        healthDisplay.innerText = `Health: ${health}`;
        packagesCollectedDisplay.innerText = `Packages Collected: ${packagesCollected}`;
        timerDisplay.innerText = `Time: ${Math.floor(gameInterval / 1000)}s`;
        wantedLevelDisplay.innerText = `Wanted Level: ${wantedLevel}`;
        policeHitsDisplay.innerText = `Police Hits: ${policeHits}`;
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        const button = document.getElementById('audio-toggle');
        button.innerText = soundEnabled ? 'Sound On' : 'Sound Off';
    }

    function drawCar(ctx, car) {
        ctx.save();
        ctx.translate(car.x + car.width / 2, car.y + car.height / 2);
        ctx.rotate(car.angle);
        ctx.fillStyle = 'red';
        ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
        ctx.restore();
    }

    function drawWorld(ctx) {
        // Draw roads and buildings
        ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        ctx.fillStyle = 'gray';
        for (let x = 0; x < worldBounds.x; x += 100) {
            for (let y = 0; y < worldBounds.y; y += 100) {
                // Draw roads
                if (x % 200 === 0 || y % 200 === 0) {
                    ctx.fillRect(x, y, 100, 100);
                }
            }
        }
    }

    function checkCollision(carA, carB) {
        const dx = carA.x + carA.width / 2 - (carB.x + carB.width / 2);
        const dy = carA.y + carA.height / 2 - (carB.y + carB.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (carA.width + carB.width) / 2;
    }

    function update() {
        if (isGamePaused) return;

        // Update player
        if (playerCar.isBoosting) {
            playerCar.speed += playerCar.acceleration * 1.5;
        } else {
            playerCar.speed += playerCar.acceleration;
        }
        playerCar.speed *= playerCar.friction;

        if (playerCar.speed > playerCar.maxSpeed) {
            playerCar.speed = playerCar.maxSpeed;
        }

        // Player movement
        const currX = playerCar.x + Math.cos(playerCar.angle) * playerCar.speed;
        const currY = playerCar.y + Math.sin(playerCar.angle) * playerCar.speed;

        // Check for world bounds collision
        if (currX > 0 && currX < worldBounds.x - carWidth && 
            currY > 0 && currY < worldBounds.y - carHeight) {
            playerCar.x = currX;
            playerCar.y = currY;
        }

        // Check for building collision (simple rectangular bounds)
        if ((playerCar.x >= gameCanvas.width / 2 - 50 && playerCar.x <= gameCanvas.width / 2 + 50) ||
            (playerCar.y >= gameCanvas.height / 2 - 50 && playerCar.y <= gameCanvas.height / 2 + 50)) {
            // If collision detected, prevent movement
            playerCar.x = prevX;
            playerCar.y = prevY;
        }

        // Handle police cars
        for (let i = 0; i < policeCars.length; i++) {
            const policeCar = policeCars[i];
            const angleToPlayer = Math.atan2(playerCar.y - policeCar.y, playerCar.x - policeCar.x);
            policeCar.angle = angleToPlayer;
            policeCar.speed += policeCar.acceleration;
            policeCar.speed *= policeCar.friction;
            if (policeCar.speed > policeCar.maxSpeed) {
                policeCar.speed = policeCar.maxSpeed;
            }
            policeCar.x += Math.cos(policeCar.angle) * policeCar.speed;
            policeCar.y += Math.sin(policeCar.angle) * policeCar.speed;

            // Check for collision with player
            if (checkCollision(playerCar, policeCar)) {
                health -= 1;
                policeHits += 1;
                policeCars.splice(i, 1);
                i--;

                if (health <= 0) {
                    gameOver();
                }
            }
        }

        // Check for package collection
        for (let i = 0; i < packages.length; i++) {
            const packageItem = packages[i];
            if (checkCollision(playerCar, packageItem)) {
                packagesCollected++;
                score += 10;
                packages.splice(i, 1);

                // Spawn new police cars after collecting a certain number of packages
                if (packagesCollected % 3 === 0) {
                    for (let j = 0; j < wantedLevel + 2; j++) {
                        const policeCar = createPoliceCar();
                        policeCars.push(policeCar);
                    }
                    wantedLevel++;
                }

                // Add new package to replace collected one
                packages.push(createPackage());
            }
        }

        // Check for win condition
        if (packagesCollected >= 10) {
            victory();
        }
    }

    function gameOver() {
        clearInterval(gameInterval);
        cancelAnimationFrame(animationFrame);
        gameOverScreen.style.display = 'block';
    }

    function victory() {
        clearInterval(gameInterval);
        cancelAnimationFrame(animationFrame);
        victoryScreen.style.display = 'block';
    }

    // Set up event listeners for controls
    document.addEventListener('keydown', (event) => {
        switch(event.key) {
            case 'ArrowUp':
                playerCar.isBoosting = true;
                break;
            case 'ArrowLeft':
                playerCar.angle -= playerCar.rotationSpeed;
                break;
            case 'ArrowRight':
                playerCar.angle += playerCar.rotationSpeed;
                break;
            case ' ':
                // Boost
                if (playerCar.speed < 0) playerCar.speed = 0;
                else playerCar.speed = Math.min(playerCar.maxSpeed, playerCar.speed + 1);
                break;
            case 'p':
            case 'P':
                isGamePaused = !isGamePaused;
                pauseOverlay.style.display = isGamePaused ? 'block' : 'none';
                break;
        }
    });

    document.addEventListener('keyup', (event) => {
        playerCar.isBoosting = false;
    });

    startButton.addEventListener('click', startGame);
    helpButton.addEventListener('click', showHelp);
    resumeButton.addEventListener('click', () => {
        isGamePaused = false;
        pauseOverlay.style.display = 'none';
    });
    restartButton.addEventListener('click', restartGame);
    restartGameOverButton.addEventListener('click', restartGame);
    restartVictoryButton.addEventListener('click', restartGame);

    const audioToggleButton = document.getElementById('audio-toggle');
    if (audioToggleButton) {
        audioToggleButton.addEventListener('click', toggleSound);
    }

    // Animation loop for drawing
    function animate() {
        animationFrame = requestAnimationFrame(animate);
        drawWorld(ctx);

        // Draw player and police cars with depth shading (fake 3D effect)
        ctx.fillStyle = 'black';
        for (let i = 0; i < policeCars.length; i++) {
            drawCar(ctx, policeCars[i]);
        }
        drawCar(ctx, playerCar);

        // Draw packages
        ctx.fillStyle = 'yellow';
        for (let i = 0; i < packages.length; i++) {
            const packageItem = packages[i];
            ctx.fillRect(packageItem.x, packageItem.y, packageItem.width, packageItem.height);
        }

        updateHUD();
    }

    // Start the animation loop
    animate();
});