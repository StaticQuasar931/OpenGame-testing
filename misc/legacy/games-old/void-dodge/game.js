(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverMessage = document.getElementById("gameOverMessage");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");

  const STORAGE_KEY = "void-dodge-best-score";
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const WORLD = { width: 960, height: 540 };
  const keys = Object.create(null);

  let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let lastFrameTime = 0;
  let running = false;
  let elapsed = 0;
  let spawnTimer = 0;
  let intensity = 1;
  let particles = [];
  let obstacles = [];

  const player = {
    size: 24,
    x: WORLD.width / 2,
    y: WORLD.height - 68,
    speed: 330,
    trail: [],
  };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round((rect.width * WORLD.height) / WORLD.width * DPR);
    ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
  }

  function resetGame() {
    player.x = WORLD.width / 2;
    player.y = WORLD.height - 68;
    player.trail.length = 0;
    obstacles = [];
    particles = [];
    elapsed = 0;
    spawnTimer = 0;
    intensity = 1;
    lastFrameTime = 0;
    updateScore(0);
  }

  function startGame() {
    resetGame();
    running = true;
    startOverlay.classList.remove("active");
    gameOverOverlay.classList.remove("active");
  }

  function endGame() {
    running = false;
    bestScore = Math.max(bestScore, Math.floor(elapsed * 10));
    localStorage.setItem(STORAGE_KEY, String(bestScore));
    bestValue.textContent = String(bestScore);
    gameOverMessage.textContent =
      "You scored " + Math.floor(elapsed * 10) + " and survived " + elapsed.toFixed(1) + " seconds.";
    gameOverOverlay.classList.add("active");
  }

  function updateScore(value) {
    scoreValue.textContent = String(Math.floor(value));
    bestValue.textContent = String(bestScore);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isPressed(code) {
    return Boolean(keys[code]);
  }

  function spawnObstacle() {
    const width = 22 + Math.random() * 30;
    const height = 18 + Math.random() * 50;
    const speed = 170 + Math.random() * 90 + intensity * 35;
    const sway = (Math.random() - 0.5) * (20 + intensity * 7);
    obstacles.push({
      x: Math.random() * (WORLD.width - width),
      y: -height - Math.random() * 120,
      width,
      height,
      speed,
      sway,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function addBurst(x, y) {
    for (let i = 0; i < 12; i += 1) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 240,
        vy: (Math.random() - 0.5) * 240,
        life: 0.45 + Math.random() * 0.3,
        radius: 2 + Math.random() * 3,
      });
    }
  }

  function update(delta) {
    elapsed += delta;
    intensity = 1 + elapsed * 0.08;
    spawnTimer -= delta;

    const horizontal =
      (isPressed("ArrowRight") || isPressed("KeyD") ? 1 : 0) -
      (isPressed("ArrowLeft") || isPressed("KeyA") ? 1 : 0);
    const vertical =
      (isPressed("ArrowDown") || isPressed("KeyS") ? 1 : 0) -
      (isPressed("ArrowUp") || isPressed("KeyW") ? 1 : 0);

    if (horizontal !== 0 || vertical !== 0) {
      const magnitude = Math.hypot(horizontal, vertical) || 1;
      player.x += (horizontal / magnitude) * player.speed * delta;
      player.y += (vertical / magnitude) * player.speed * delta;
    }

    player.x = clamp(player.x, 18, WORLD.width - player.size - 18);
    player.y = clamp(player.y, 18, WORLD.height - player.size - 18);
    player.trail.unshift({ x: player.x + player.size / 2, y: player.y + player.size / 2, life: 0.28 });
    if (player.trail.length > 14) {
      player.trail.pop();
    }

    for (let i = player.trail.length - 1; i >= 0; i -= 1) {
      player.trail[i].life -= delta;
      if (player.trail[i].life <= 0) {
        player.trail.splice(i, 1);
      }
    }

    const minSpawnGap = Math.max(0.16, 0.65 - elapsed * 0.018);
    while (spawnTimer <= 0) {
      spawnObstacle();
      if (Math.random() < Math.min(0.45, elapsed * 0.02)) {
        spawnObstacle();
      }
      spawnTimer += minSpawnGap;
    }

    for (let i = obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = obstacles[i];
      obstacle.phase += delta * 2;
      obstacle.x += Math.sin(obstacle.phase) * obstacle.sway * delta;
      obstacle.y += obstacle.speed * delta;
      obstacle.x = clamp(obstacle.x, 0, WORLD.width - obstacle.width);

      if (
        player.x < obstacle.x + obstacle.width &&
        player.x + player.size > obstacle.x &&
        player.y < obstacle.y + obstacle.height &&
        player.y + player.size > obstacle.y
      ) {
        addBurst(player.x + player.size / 2, player.y + player.size / 2);
        endGame();
        return;
      }

      if (obstacle.y > WORLD.height + obstacle.height) {
        obstacles.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      if (particle.life <= 0) {
        particles.splice(i, 1);
      }
    }

    updateScore(elapsed * 10);
  }

  function drawBackground() {
    ctx.fillStyle = "#070b11";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    gradient.addColorStop(0, "rgba(125, 134, 255, 0.16)");
    gradient.addColorStop(1, "rgba(8, 12, 20, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.strokeStyle = "rgba(125, 134, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, WORLD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(WORLD.width, y + 0.5);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    for (let i = 0; i < player.trail.length; i += 1) {
      const trail = player.trail[i];
      ctx.fillStyle = "rgba(121, 242, 255, " + (trail.life * 0.65).toFixed(3) + ")";
      ctx.fillRect(trail.x - 9, trail.y - 9, 18, 18);
    }

    const glow = ctx.createRadialGradient(
      player.x + player.size / 2,
      player.y + player.size / 2,
      2,
      player.x + player.size / 2,
      player.y + player.size / 2,
      28
    );
    glow.addColorStop(0, "rgba(121, 242, 255, 0.4)");
    glow.addColorStop(1, "rgba(121, 242, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(player.x - 22, player.y - 22, player.size + 44, player.size + 44);

    ctx.fillStyle = "#79f2ff";
    ctx.fillRect(player.x, player.y, player.size, player.size);
  }

  function drawObstacles() {
    for (let i = 0; i < obstacles.length; i += 1) {
      const obstacle = obstacles[i];
      ctx.fillStyle = "#ff6f91";
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, 4);
    }
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 111, 145, " + Math.max(0, particle.life).toFixed(3) + ")";
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIntensity() {
    ctx.fillStyle = "rgba(10, 14, 24, 0.72)";
    ctx.fillRect(20, WORLD.height - 44, 180, 18);
    ctx.fillStyle = "rgba(121, 242, 255, 0.9)";
    ctx.fillRect(20, WORLD.height - 44, Math.min(180, 35 + elapsed * 7), 18);
    ctx.fillStyle = "#dfe6ff";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Threat level", 24, WORLD.height - 50);
  }

  function draw() {
    drawBackground();
    drawObstacles();
    drawParticles();
    drawPlayer();
    drawIntensity();
  }

  function frame(timestamp) {
    if (running) {
      if (lastFrameTime === 0) {
        lastFrameTime = timestamp;
      }
      const delta = Math.min((timestamp - lastFrameTime) / 1000, 0.033);
      lastFrameTime = timestamp;
      update(delta);
    }

    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener("keydown", function (event) {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
      ].includes(event.code)
    ) {
      event.preventDefault();
    }
    keys[event.code] = true;
    if (!running && event.code === "Space" && gameOverOverlay.classList.contains("active")) {
      startGame();
    }
  });

  window.addEventListener("keyup", function (event) {
    keys[event.code] = false;
  });

  window.addEventListener("resize", resizeCanvas);
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);

  resizeCanvas();
  updateScore(0);
  draw();
  requestAnimationFrame(frame);
})();
