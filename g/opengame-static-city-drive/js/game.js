document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const miniMap = document.getElementById("miniMap");
  const miniCtx = miniMap.getContext("2d");

  const ui = {
    title: document.getElementById("title-screen"),
    help: document.getElementById("help-overlay"),
    pause: document.getElementById("pause-overlay"),
    gameOver: document.getElementById("game-over-screen"),
    victory: document.getElementById("victory-screen"),
    startButton: document.getElementById("start-button"),
    helpButton: document.getElementById("help-button"),
    closeHelpButton: document.getElementById("close-help-button"),
    resumeButton: document.getElementById("resume-button"),
    restartButton: document.getElementById("restart-button"),
    restartGameOverButton: document.getElementById("restart-game-over-button"),
    restartVictoryButton: document.getElementById("restart-victory-button"),
    audioButton: document.getElementById("audio-toggle"),
    packages: document.getElementById("packagesCollected"),
    score: document.getElementById("score"),
    timer: document.getElementById("timer"),
    wanted: document.getElementById("wantedLevel"),
    health: document.getElementById("health"),
    policeHits: document.getElementById("policeHits"),
    pulse: document.getElementById("level"),
    status: document.getElementById("statusText"),
    gameOverCopy: document.getElementById("game-over-copy"),
    victoryCopy: document.getElementById("victory-copy")
  };

  const world = {
    width: 2400,
    height: 2400,
    roadSpacing: 240,
    roadWidth: 104,
    packageGoal: 10,
    pulseRadius: 220
  };

  const state = {
    running: false,
    paused: false,
    soundEnabled: true,
    frame: 0,
    startTime: 0,
    elapsed: 0,
    pulseCooldown: 0,
    score: 0,
    packagesCollected: 0,
    policeHits: 0,
    health: 3,
    policeUnlocked: false,
    keys: Object.create(null),
    packages: [],
    police: [],
    buildings: [],
    props: [],
    camera: { x: 0, y: 0 }
  };

  const player = {
    x: world.width * 0.5,
    y: world.height * 0.5,
    angle: -Math.PI / 2,
    speed: 0,
    maxSpeed: 360,
    turnSpeed: 2.7,
    accel: 320,
    brake: 420,
    friction: 0.92,
    radius: 18
  };

  function resizeCanvas() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function toggleScreen(node, active) {
    node.classList.toggle("active", active);
  }

  function closeAllScreens() {
    [ui.title, ui.help, ui.pause, ui.gameOver, ui.victory].forEach((node) => toggleScreen(node, false));
  }

  function resetPlayer() {
    player.x = world.width * 0.5;
    player.y = world.height * 0.5;
    player.angle = -Math.PI / 2;
    player.speed = 0;
  }

  function pointOnRoad() {
    const horizontal = Math.random() < 0.5;
    if (horizontal) {
      const row = 0.5 + Math.floor(Math.random() * ((world.height / world.roadSpacing) - 1));
      return {
        x: 80 + Math.random() * (world.width - 160),
        y: row * world.roadSpacing
      };
    }
    const column = 0.5 + Math.floor(Math.random() * ((world.width / world.roadSpacing) - 1));
    return {
      x: column * world.roadSpacing,
      y: 80 + Math.random() * (world.height - 160)
    };
  }

  function buildCity() {
    state.buildings = [];
    state.props = [];
    for (let gx = 0; gx < world.width; gx += world.roadSpacing) {
      for (let gy = 0; gy < world.height; gy += world.roadSpacing) {
        const blockX = gx + world.roadWidth * 0.5 + 16;
        const blockY = gy + world.roadWidth * 0.5 + 16;
        const size = world.roadSpacing - world.roadWidth - 32;
        if (blockX + size < world.width && blockY + size < world.height) {
          state.buildings.push({ x: blockX, y: blockY, w: size, h: size, hue: 16 + ((gx + gy) % 50) });
        }
        const lightX = gx + world.roadWidth * 0.5 - 12;
        const lightY = gy + world.roadWidth * 0.5 - 12;
        state.props.push({ x: lightX, y: lightY, type: "light" });
      }
    }
  }

  function spawnPackages() {
    state.packages = [];
    for (let i = 0; i < world.packageGoal; i += 1) {
      const point = pointOnRoad();
      state.packages.push({ x: point.x, y: point.y, radius: 13, pulse: Math.random() * Math.PI * 2, collected: false });
    }
  }

  function spawnPolice(count) {
    for (let i = 0; i < count; i += 1) {
      const point = pointOnRoad();
      state.police.push({
        x: point.x,
        y: point.y,
        angle: Math.random() * Math.PI * 2,
        speed: 110 + Math.random() * 35,
        radius: 16,
        stun: 0
      });
    }
  }

  function startRun() {
    closeAllScreens();
    state.running = true;
    state.paused = false;
    state.frame = performance.now();
    state.startTime = performance.now();
    state.elapsed = 0;
    state.pulseCooldown = 0;
    state.score = 0;
    state.packagesCollected = 0;
    state.policeHits = 0;
    state.health = 3;
    state.policeUnlocked = false;
    state.police = [];
    buildCity();
    spawnPackages();
    resetPlayer();
    updateHud("Grab the first package and build speed.");
    requestAnimationFrame(loop);
  }

  function pauseRun(showOverlay) {
    state.paused = true;
    if (showOverlay) toggleScreen(ui.pause, true);
  }

  function resumeRun() {
    state.paused = false;
    toggleScreen(ui.pause, false);
    state.frame = performance.now();
    requestAnimationFrame(loop);
  }

  function restartRun() {
    closeAllScreens();
    startRun();
  }

  function setAudioEnabled(enabled) {
    state.soundEnabled = enabled;
    ui.audioButton.textContent = `Sound: ${enabled ? "On" : "Off"}`;
  }

  function playSound(kind) {
    if (!state.soundEnabled) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!playSound.ctx) playSound.ctx = new AudioCtx();
    const audioCtx = playSound.ctx;
    const now = audioCtx.currentTime;

    function tone(freq, duration, gainValue, type) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    if (kind === "package") {
      tone(520, 0.12, 0.05, "triangle");
      tone(780, 0.2, 0.04, "sine");
    } else if (kind === "hit") {
      tone(180, 0.18, 0.06, "square");
    } else if (kind === "pulse") {
      tone(260, 0.18, 0.05, "sawtooth");
      tone(390, 0.26, 0.03, "triangle");
    } else if (kind === "win") {
      tone(660, 0.12, 0.04, "triangle");
      tone(880, 0.22, 0.04, "triangle");
    }
  }

  function updateHud(statusOverride) {
    const wanted = state.packagesCollected < 3 ? "Cold" : state.packagesCollected < 6 ? "Warm" : "Hot";
    const pulseReady = state.pulseCooldown <= 0 ? "Ready" : `${state.pulseCooldown.toFixed(1)}s`;
    ui.packages.textContent = `${state.packagesCollected} / ${world.packageGoal}`;
    ui.score.textContent = `${Math.round(state.score)}`;
    ui.timer.textContent = `${state.elapsed.toFixed(1)}s`;
    ui.wanted.textContent = wanted;
    ui.health.textContent = `${Math.max(0, state.health)} / 3`;
    ui.policeHits.textContent = `${state.policeHits} / 3`;
    ui.pulse.textContent = pulseReady;
    ui.status.textContent = statusOverride || (state.policeUnlocked ? "Police are active. Use the pulse tool if you get boxed in." : "City is quiet. Collect 3 packages to trigger the chase.");
  }

  function isOnRoad(x, y) {
    const modX = x % world.roadSpacing;
    const modY = y % world.roadSpacing;
    const half = world.roadWidth * 0.5;
    return modX < half || modX > world.roadSpacing - half || modY < half || modY > world.roadSpacing - half;
  }

  function clampPlayerToWorld() {
    player.x = Math.max(player.radius + 24, Math.min(world.width - player.radius - 24, player.x));
    player.y = Math.max(player.radius + 24, Math.min(world.height - player.radius - 24, player.y));
  }

  function updatePlayer(dt) {
    const throttle = state.keys.ArrowUp || state.keys.KeyW;
    const reverse = state.keys.ArrowDown || state.keys.KeyS;
    const left = state.keys.ArrowLeft || state.keys.KeyA;
    const right = state.keys.ArrowRight || state.keys.KeyD;
    const braking = state.keys.Space;
    const boosting = state.keys.ShiftLeft || state.keys.ShiftRight;

    if (left) player.angle -= player.turnSpeed * dt * (0.65 + Math.min(1, Math.abs(player.speed) / 160));
    if (right) player.angle += player.turnSpeed * dt * (0.65 + Math.min(1, Math.abs(player.speed) / 160));

    const maxSpeed = boosting ? player.maxSpeed * 1.34 : player.maxSpeed;
    if (throttle) player.speed += player.accel * dt;
    if (reverse) player.speed -= player.accel * 0.65 * dt;
    if (braking) player.speed *= 0.85;
    player.speed *= player.friction;
    player.speed = Math.max(-140, Math.min(maxSpeed, player.speed));

    const prevX = player.x;
    const prevY = player.y;
    player.x += Math.cos(player.angle) * player.speed * dt;
    player.y += Math.sin(player.angle) * player.speed * dt;
    clampPlayerToWorld();

    if (!isOnRoad(player.x, player.y)) {
      player.x = prevX;
      player.y = prevY;
      player.speed *= 0.45;
    }
  }

  function usePulse() {
    if (state.pulseCooldown > 0) return;
    state.pulseCooldown = 5;
    for (const cruiser of state.police) {
      const dx = cruiser.x - player.x;
      const dy = cruiser.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < world.pulseRadius) {
        const force = (world.pulseRadius - distance) / world.pulseRadius;
        cruiser.x += (dx / (distance || 1)) * 120 * force;
        cruiser.y += (dy / (distance || 1)) * 120 * force;
        cruiser.stun = 1.1;
      }
    }
    updateHud("Pulse fired. Nearby police shoved back.");
    playSound("pulse");
  }

  function updatePolice(dt) {
    for (const cruiser of state.police) {
      if (cruiser.stun > 0) {
        cruiser.stun -= dt;
        continue;
      }
      const targetAngle = Math.atan2(player.y - cruiser.y, player.x - cruiser.x);
      const diff = Math.atan2(Math.sin(targetAngle - cruiser.angle), Math.cos(targetAngle - cruiser.angle));
      cruiser.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const moveSpeed = cruiser.speed + state.packagesCollected * 7;
      cruiser.x += Math.cos(cruiser.angle) * moveSpeed * dt;
      cruiser.y += Math.sin(cruiser.angle) * moveSpeed * dt;
      cruiser.x = Math.max(cruiser.radius + 12, Math.min(world.width - cruiser.radius - 12, cruiser.x));
      cruiser.y = Math.max(cruiser.radius + 12, Math.min(world.height - cruiser.radius - 12, cruiser.y));
    }
  }

  function updatePackages(dt) {
    for (const pkg of state.packages) {
      pkg.pulse += dt * 4;
      if (pkg.collected) continue;
      const distance = Math.hypot(pkg.x - player.x, pkg.y - player.y);
      if (distance < player.radius + pkg.radius + 4) {
        pkg.collected = true;
        state.packagesCollected += 1;
        state.score += 125 + (state.packagesCollected * 30);
        if (state.packagesCollected === 3 && !state.policeUnlocked) {
          state.policeUnlocked = true;
          spawnPolice(2);
          updateHud("Police scanners lit up. The chase is on.");
        } else if (state.policeUnlocked && state.packagesCollected < world.packageGoal) {
          spawnPolice(1);
          updateHud("Pickup secured. More police dropped into the city.");
        }
        playSound("package");
      }
    }
  }

  function checkPoliceCollisions() {
    for (const cruiser of state.police) {
      const distance = Math.hypot(cruiser.x - player.x, cruiser.y - player.y);
      if (distance < cruiser.radius + player.radius + 4) {
        state.policeHits += 1;
        state.health -= 1;
        cruiser.stun = 1.2;
        cruiser.x -= Math.cos(cruiser.angle) * 45;
        cruiser.y -= Math.sin(cruiser.angle) * 45;
        player.speed *= -0.25;
        updateHud("Police contact. Keep moving.");
        playSound("hit");
        if (state.health <= 0) {
          endGame(false);
          return;
        }
      }
    }
  }

  function endGame(victory) {
    state.running = false;
    state.paused = false;
    if (victory) {
      ui.victoryCopy.textContent = `All ${world.packageGoal} packages secured in ${state.elapsed.toFixed(1)} seconds. Final score ${Math.round(state.score)}.`;
      toggleScreen(ui.victory, true);
      playSound("win");
    } else {
      ui.gameOverCopy.textContent = `You lasted ${state.elapsed.toFixed(1)} seconds and delivered ${state.packagesCollected} packages.`;
      toggleScreen(ui.gameOver, true);
    }
  }

  function updateCamera() {
    state.camera.x = player.x - (canvas.width / window.devicePixelRatio) * 0.5;
    state.camera.y = player.y - (canvas.height / window.devicePixelRatio) * 0.58;
    state.camera.x = Math.max(0, Math.min(world.width - canvas.width / window.devicePixelRatio, state.camera.x));
    state.camera.y = Math.max(0, Math.min(world.height - canvas.height / window.devicePixelRatio, state.camera.y));
  }

  function worldToScreen(x, y) {
    return { x: x - state.camera.x, y: y - state.camera.y };
  }

  function drawCity() {
    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0a111a";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(0, -20);
    for (let x = 0; x <= world.width; x += world.roadSpacing) {
      const screen = worldToScreen(x, 0);
      ctx.fillStyle = "#1d2636";
      ctx.fillRect(screen.x - world.roadWidth * 0.5, -100, world.roadWidth, height + 220);
    }
    for (let y = 0; y <= world.height; y += world.roadSpacing) {
      const screen = worldToScreen(0, y);
      ctx.fillStyle = "#1d2636";
      ctx.fillRect(-100, screen.y - world.roadWidth * 0.5, width + 220, world.roadWidth);
    }

    ctx.strokeStyle = "rgba(255, 225, 95, 0.42)";
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 24]);
    for (let x = world.roadSpacing * 0.5; x <= world.width; x += world.roadSpacing) {
      const screen = worldToScreen(x, 0);
      ctx.beginPath();
      ctx.moveTo(screen.x, -100);
      ctx.lineTo(screen.x, height + 120);
      ctx.stroke();
    }
    for (let y = world.roadSpacing * 0.5; y <= world.height; y += world.roadSpacing) {
      const screen = worldToScreen(0, y);
      ctx.beginPath();
      ctx.moveTo(-100, screen.y);
      ctx.lineTo(width + 120, screen.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const building of state.buildings) {
      const screen = worldToScreen(building.x, building.y);
      if (screen.x > width || screen.y > height || screen.x + building.w < 0 || screen.y + building.h < 0) continue;
      ctx.fillStyle = `hsl(${building.hue}, 18%, 16%)`;
      ctx.fillRect(screen.x, screen.y, building.w, building.h);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(screen.x + 10, screen.y + 10, building.w - 20, 12);
    }

    for (const prop of state.props) {
      const screen = worldToScreen(prop.x, prop.y);
      if (screen.x < -20 || screen.y < -20 || screen.x > width + 20 || screen.y > height + 20) continue;
      ctx.fillStyle = "#98aec9";
      ctx.fillRect(screen.x, screen.y, 4, 18);
      ctx.fillStyle = "rgba(255, 216, 110, 0.85)";
      ctx.beginPath();
      ctx.arc(screen.x + 2, screen.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPackage(pkg) {
    if (pkg.collected) return;
    const screen = worldToScreen(pkg.x, pkg.y);
    const glow = 10 + Math.sin(pkg.pulse) * 4;
    ctx.fillStyle = "rgba(126, 230, 255, 0.16)";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, pkg.radius + glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd86e";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, pkg.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCar(entity, color) {
    const screen = worldToScreen(entity.x, entity.y);
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(entity.angle);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-14, -8, 34, 18);
    ctx.fillStyle = color;
    ctx.fillRect(-15, -10, 30, 20);
    ctx.fillStyle = "#dbeeff";
    ctx.fillRect(-11, -7, 22, 6);
    ctx.fillStyle = "#11161f";
    ctx.fillRect(-14, -12, 7, 4);
    ctx.fillRect(7, -12, 7, 4);
    ctx.fillRect(-14, 8, 7, 4);
    ctx.fillRect(7, 8, 7, 4);
    ctx.restore();
  }

  function drawTargetArrow() {
    const next = state.packages.find((pkg) => !pkg.collected);
    if (!next) return;
    const angle = Math.atan2(next.y - player.y, next.x - player.x);
    const width = canvas.width / window.devicePixelRatio;
    ctx.save();
    ctx.translate(width - 80, 90);
    ctx.rotate(angle - player.angle);
    ctx.fillStyle = "rgba(126, 230, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 16);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPulseRing() {
    if (state.pulseCooldown > 4.7) {
      const screen = worldToScreen(player.x, player.y);
      const alpha = (5 - state.pulseCooldown) / 0.3;
      ctx.strokeStyle = `rgba(126, 230, 255, ${Math.max(0, alpha)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, world.pulseRadius * (1 - alpha * 0.45), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMiniMap() {
    miniCtx.clearRect(0, 0, miniMap.width, miniMap.height);
    miniCtx.fillStyle = "#0a111a";
    miniCtx.fillRect(0, 0, miniMap.width, miniMap.height);
    miniCtx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let x = 0; x <= world.width; x += world.roadSpacing) {
      const px = (x / world.width) * miniMap.width;
      miniCtx.beginPath();
      miniCtx.moveTo(px, 0);
      miniCtx.lineTo(px, miniMap.height);
      miniCtx.stroke();
    }
    for (let y = 0; y <= world.height; y += world.roadSpacing) {
      const py = (y / world.height) * miniMap.height;
      miniCtx.beginPath();
      miniCtx.moveTo(0, py);
      miniCtx.lineTo(miniMap.width, py);
      miniCtx.stroke();
    }
    for (const pkg of state.packages) {
      if (pkg.collected) continue;
      miniCtx.fillStyle = "#ffd86e";
      miniCtx.fillRect((pkg.x / world.width) * miniMap.width - 2, (pkg.y / world.height) * miniMap.height - 2, 4, 4);
    }
    for (const cruiser of state.police) {
      miniCtx.fillStyle = "#ff73c5";
      miniCtx.fillRect((cruiser.x / world.width) * miniMap.width - 2, (cruiser.y / world.height) * miniMap.height - 2, 5, 5);
    }
    miniCtx.fillStyle = "#7ee6ff";
    miniCtx.beginPath();
    miniCtx.arc((player.x / world.width) * miniMap.width, (player.y / world.height) * miniMap.height, 4, 0, Math.PI * 2);
    miniCtx.fill();
  }

  function loop(now) {
    if (!state.running || state.paused) return;
    const dt = Math.min(0.033, (now - state.frame) / 1000 || 0.016);
    state.frame = now;
    state.elapsed = (now - state.startTime) / 1000;
    state.pulseCooldown = Math.max(0, state.pulseCooldown - dt);

    updatePlayer(dt);
    updatePolice(dt);
    updatePackages(dt);
    checkPoliceCollisions();
    updateCamera();

    drawCity();
    for (const pkg of state.packages) drawPackage(pkg);
    for (const cruiser of state.police) drawCar(cruiser, cruiser.stun > 0 ? "#f4a8d2" : "#ff73c5");
    drawCar(player, "#7ee6ff");
    drawPulseRing();
    drawTargetArrow();
    drawMiniMap();
    updateHud();

    if (state.packagesCollected >= world.packageGoal) {
      endGame(true);
      return;
    }

    requestAnimationFrame(loop);
  }

  ui.startButton.addEventListener("click", startRun);
  ui.helpButton.addEventListener("click", () => toggleScreen(ui.help, true));
  ui.closeHelpButton.addEventListener("click", () => toggleScreen(ui.help, false));
  ui.resumeButton.addEventListener("click", resumeRun);
  ui.restartButton.addEventListener("click", restartRun);
  ui.restartGameOverButton.addEventListener("click", restartRun);
  ui.restartVictoryButton.addEventListener("click", restartRun);
  ui.audioButton.addEventListener("click", () => setAudioEnabled(!state.soundEnabled));

  document.addEventListener("keydown", (event) => {
    state.keys[event.code] = true;
    if (event.code === "KeyP" && state.running) {
      if (state.paused) resumeRun();
      else pauseRun(true);
    }
    if (event.code === "KeyR" && state.running) {
      resetPlayer();
      updateHud("Car reset to center route.");
    }
    if (event.code === "KeyF" && state.running && !state.paused) {
      usePulse();
    }
    if (event.code === "Escape") {
      toggleScreen(ui.help, false);
    }
  });

  document.addEventListener("keyup", (event) => {
    state.keys[event.code] = false;
  });

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  buildCity();
  spawnPackages();
  resetPlayer();
  drawCity();
  for (const pkg of state.packages) drawPackage(pkg);
  drawCar(player, "#7ee6ff");
  drawMiniMap();
  updateHud("Press start when you are ready.");
});
