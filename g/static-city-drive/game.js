/*
  Static City Drive
  Original low-poly browser driving game.
  No external copyrighted GTA assets are used.
  No external art assets are required; all geometry and UI are procedurally drawn.
*/
(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const minimap = document.getElementById("minimap");
  const mapCtx = minimap.getContext("2d", { alpha: false });
  const playfield = document.querySelector(".playfield");

  const startOverlay = document.getElementById("startOverlay");
  const helpOverlay = document.getElementById("helpOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverTitle = document.getElementById("gameOverTitle");
  const gameOverMessage = document.getElementById("gameOverMessage");
  const startButton = document.getElementById("startButton");
  const startHelpButton = document.getElementById("startHelpButton");
  const restartButton = document.getElementById("restartButton");
  const gameOverHelpButton = document.getElementById("gameOverHelpButton");
  const closeHelpButton = document.getElementById("closeHelpButton");
  const lockChip = document.getElementById("lockChip");
  const statusRibbon = document.getElementById("statusRibbon");

  const scoreValue = document.getElementById("scoreValue");
  const packageValue = document.getElementById("packageValue");
  const timeValue = document.getElementById("timeValue");
  const wantedValue = document.getElementById("wantedValue");
  const healthValue = document.getElementById("healthValue");
  const bestValue = document.getElementById("bestValue");
  const goalValue = document.getElementById("goalValue");
  const lawValue = document.getElementById("lawValue");
  const hintValue = document.getElementById("hintValue");

  const WORLD = { width: 2400, height: 2400 };
  const VIEW = { width: 1280, height: 720 };
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const KEYS = Object.create(null);
  const STORAGE_KEY = "static-city-drive-best-score";
  const PACKAGE_TOTAL = 10;
  const CAMERA_HEIGHT = 260;
  const CAMERA_BACK = 200;
  const CAMERA_PITCH = -0.88;
  const FOV = 780;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const city = buildCity();
  const game = createGameState();

  function createGameState() {
    return {
      running: false,
      bestScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
      score: 0,
      time: 0,
      packagesCollected: 0,
      wanted: 0,
      health: 3,
      messages: [],
      bullets: [],
      cops: [],
      particles: [],
      lastTime: 0,
      helpVisible: false,
      cursorLocked: false,
      mouseSteer: 0,
      statusText: "Click the road view to lock the mouse.",
      statusTimer: 0,
      player: {
        x: 180,
        y: 300,
        angle: 0,
        speed: 0,
        vx: 0,
        vy: 0,
        width: 42,
        length: 76,
        hitCooldown: 0,
        empCooldown: 0,
      },
      packages: [],
      trafficProps: buildTrafficProps(),
    };
  }

  function setStatus(text, duration) {
    game.statusText = text;
    game.statusTimer = duration || 0;
    statusRibbon.textContent = text;
  }

  function refreshLockUi() {
    playfield.classList.toggle("locked", game.cursorLocked);
    lockChip.classList.toggle("live", game.cursorLocked);
    lockChip.textContent = game.cursorLocked ? "Mouse locked" : "Mouse free";
  }

  function buildCity() {
    const roads = [];
    const buildings = [];
    const lamps = [];
    const markers = [];
    const roadWidth = 120;
    const block = 300;

    for (let x = 0; x <= WORLD.width; x += block) {
      roads.push({ x: x - roadWidth / 2, y: 0, w: roadWidth, h: WORLD.height, tone: x / block % 2 });
    }
    for (let y = 0; y <= WORLD.height; y += block) {
      roads.push({ x: 0, y: y - roadWidth / 2, w: WORLD.width, h: roadWidth, tone: y / block % 2 });
    }

    for (let gx = 0; gx < 7; gx += 1) {
      for (let gy = 0; gy < 7; gy += 1) {
        const baseX = 150 + gx * block;
        const baseY = 150 + gy * block;
        const w = rand(110, 170);
        const h = rand(110, 170);
        buildings.push({
          x: baseX - w / 2,
          y: baseY - h / 2,
          w,
          h,
          z: rand(90, 210),
          color: pickBuildingColor(gx, gy),
        });
      }
    }

    for (let x = 60; x < WORLD.width; x += 180) {
      for (let y = 60; y < WORLD.height; y += 180) {
        if (isRoadPointRaw(x, y, block, roadWidth)) {
          lamps.push({ x, y, z: 48 });
          if ((x + y) % 360 === 0) {
            markers.push({ x: x + 30, y: y - 26, type: "cone" });
          }
        }
      }
    }

    return { roads, buildings, lamps, markers, roadWidth, block };
  }

  function buildTrafficProps() {
    const props = [];
    for (let i = 0; i < 24; i += 1) {
      const x = rand(100, WORLD.width - 100);
      const y = rand(100, WORLD.height - 100);
      if (!isRoadPointRaw(x, y, 300, 120)) {
        continue;
      }
      props.push({
        x: x + rand(-20, 20),
        y: y + rand(-20, 20),
        size: rand(8, 18),
        type: i % 2 === 0 ? "barrel" : "barrier",
      });
    }
    return props;
  }

  function pickBuildingColor(gx, gy) {
    const palette = ["#3a4658", "#465369", "#2f3948", "#4d596f"];
    return palette[(gx + gy) % palette.length];
  }

  function isRoadPointRaw(x, y, block, roadWidth) {
    const mx = x % block;
    const my = y % block;
    return (
      mx < roadWidth * 0.5 ||
      mx > block - roadWidth * 0.5 ||
      my < roadWidth * 0.5 ||
      my > block - roadWidth * 0.5
    );
  }

  function pointHitsBuilding(x, y, margin) {
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) {
        return b;
      }
    }
    return null;
  }

  function worldToCamera(wx, wy, wz, cam) {
    const dx = wx - cam.x;
    const dy = wy - cam.y;
    const dz = wz - cam.z;
    const cosYaw = Math.cos(-cam.angle);
    const sinYaw = Math.sin(-cam.angle);
    const x1 = dx * cosYaw - dy * sinYaw;
    const z1 = dx * sinYaw + dy * cosYaw;
    const cosPitch = Math.cos(CAMERA_PITCH);
    const sinPitch = Math.sin(CAMERA_PITCH);
    const y2 = dz * cosPitch - z1 * sinPitch;
    const z2 = dz * sinPitch + z1 * cosPitch;
    return { x: x1, y: y2, z: z2 };
  }

  function projectPoint(wx, wy, wz, cam) {
    const p = worldToCamera(wx, wy, wz, cam);
    if (p.z <= 8) return null;
    return {
      x: VIEW.width * 0.5 + (p.x * FOV) / p.z,
      y: VIEW.height * 0.57 + (p.y * FOV) / p.z,
      z: p.z,
    };
  }

  function createCamera() {
    const p = game.player;
    return {
      x: p.x - Math.sin(p.angle) * CAMERA_BACK,
      y: p.y - Math.cos(p.angle) * CAMERA_BACK,
      z: CAMERA_HEIGHT,
      angle: p.angle,
    };
  }

  function spawnPackages() {
    const spots = [
      [300, 1200], [570, 300], [900, 600], [1200, 1500], [1800, 300],
      [2100, 900], [1500, 2100], [900, 2100], [300, 1800], [2100, 2100],
    ];
    game.packages = spots.map((spot) => ({
      x: spot[0],
      y: spot[1],
      z: 0,
      collected: false,
      pulse: rand(0, Math.PI * 2),
    }));
  }

  function resetGame() {
    game.running = false;
    game.score = 0;
    game.time = 0;
    game.packagesCollected = 0;
    game.wanted = 0;
    game.health = 3;
    game.messages.length = 0;
    game.bullets.length = 0;
    game.cops.length = 0;
    game.particles.length = 0;
    game.lastTime = 0;
    game.player.x = 180;
    game.player.y = 300;
    game.player.angle = 0;
    game.player.speed = 0;
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.hitCooldown = 0;
    game.player.empCooldown = 0;
    game.mouseSteer = 0;
    spawnPackages();
    updateHud();
    lawValue.textContent = "Keep moving. No police yet.";
    hintValue.textContent = "Boost on straight roads. Brake before turns.";
    goalValue.textContent = "Next package: ready";
    setStatus("Click the road view to lock the mouse.", 0);
  }

  function updateHud() {
    scoreValue.textContent = String(Math.floor(game.score));
    packageValue.textContent = game.packagesCollected + " / " + PACKAGE_TOTAL;
    timeValue.textContent = game.time.toFixed(1) + "s";
    wantedValue.textContent = "★".repeat(game.wanted) || "0";
    healthValue.textContent = String(game.health);
    bestValue.textContent = String(Math.max(game.bestScore, Math.floor(game.score)));
  }

  function spawnCop() {
    const offset = rand(120, 190);
    const side = Math.random() < 0.5 ? -1 : 1;
    game.cops.push({
      x: clamp(game.player.x + side * offset, 80, WORLD.width - 80),
      y: clamp(game.player.y + rand(120, 220), 80, WORLD.height - 80),
      angle: game.player.angle + Math.PI,
      speed: 0,
      stun: 0,
      touchCooldown: 0,
      width: 40,
      length: 72,
    });
  }

  function syncPoliceCount() {
    while (game.cops.length < game.wanted) spawnCop();
    if (game.cops.length > game.wanted) game.cops.length = game.wanted;
  }

  function setWanted(level) {
    const next = clamp(level, 0, 3);
    if (next === game.wanted) return;
    game.wanted = next;
    syncPoliceCount();
    const labels = ["City calm.", "One patrol on you.", "Two patrols active.", "Full heat. Three patrols active."];
    lawValue.textContent = labels[next];
    const status = ["No heat yet.", "Wanted level up. Patrol incoming.", "City alert escalated. Two patrols active.", "Maximum heat. Survive the shutdown."][next];
    setStatus(status, 3.2);
  }

  function getNextPackage() {
    for (let i = 0; i < game.packages.length; i += 1) {
      if (!game.packages[i].collected) return game.packages[i];
    }
    return null;
  }

  function burstParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      game.particles.push({
        x, y, z: rand(8, 36), vx: rand(-90, 90), vy: rand(-90, 90), vz: rand(10, 80), life: rand(0.4, 0.95), color,
      });
    }
  }

  function moveVehicle(vehicle, delta, margin) {
    const nextX = vehicle.x + vehicle.vx * delta;
    const nextY = vehicle.y + vehicle.vy * delta;
    const boundedX = clamp(nextX, margin, WORLD.width - margin);
    const boundedY = clamp(nextY, margin, WORLD.height - margin);
    if (pointHitsBuilding(boundedX, boundedY, margin)) {
      vehicle.speed *= -0.18;
      if (vehicle === game.player) {
        burstParticles(vehicle.x, vehicle.y, "#ff9c6f", 12);
        setStatus("Wall impact. Brake before tighter turns.", 1.8);
      }
      return;
    }
    vehicle.x = boundedX;
    vehicle.y = boundedY;
  }

  function startGame() {
    resetGame();
    game.running = true;
    startOverlay.classList.remove("active");
    gameOverOverlay.classList.remove("active");
    requestPointerLock();
    setStatus("Package run live. Follow the arrow to the first pickup.", 3.4);
  }

  function endGame(victory) {
    game.running = false;
    game.bestScore = Math.max(game.bestScore, Math.floor(game.score));
    localStorage.setItem(STORAGE_KEY, String(game.bestScore));
    updateHud();
    gameOverTitle.textContent = victory ? "Run Complete" : "Busted";
    gameOverMessage.textContent = victory
      ? "You collected all 10 packages in " + game.time.toFixed(1) + " seconds with a score of " + Math.floor(game.score) + "."
      : "You were stopped after " + game.packagesCollected + " packages. Score: " + Math.floor(game.score) + ".";
    gameOverOverlay.classList.add("active");
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round((rect.width * VIEW.height) / VIEW.width * DPR);
    ctx.setTransform(canvas.width / VIEW.width, 0, 0, canvas.height / VIEW.height, 0, 0);
  }

  function handleInput(delta) {
    const p = game.player;
    const accelerate = KEYS.KeyW || KEYS.ArrowUp;
    const reverse = KEYS.KeyS || KEYS.ArrowDown;
    const left = KEYS.KeyA || KEYS.ArrowLeft;
    const right = KEYS.KeyD || KEYS.ArrowRight;
    const braking = KEYS.Space;
    const boosting = KEYS.ShiftLeft || KEYS.ShiftRight;
    let accel = 0;
    if (accelerate) accel += boosting ? 160 : 110;
    if (reverse) accel -= 90;
    p.speed += accel * delta;
    p.speed *= braking ? 0.9 : 0.986;
    p.speed = clamp(p.speed, -80, boosting ? 300 : 220);
    if (Math.abs(p.speed) > 4) {
      const keySteer = (left ? 1 : 0) - (right ? 1 : 0);
      const mouseSteer = game.cursorLocked ? clamp(game.mouseSteer, -1.2, 1.2) : 0;
      const steer = keySteer + mouseSteer;
      p.angle += (steer * delta * 1.8 * clamp(Math.abs(p.speed) / 120, 0.4, 1.4)) * (p.speed >= 0 ? 1 : -1);
    }
    game.mouseSteer *= game.cursorLocked ? 0.74 : 0.5;
    p.vx = Math.sin(p.angle) * p.speed;
    p.vy = Math.cos(p.angle) * p.speed;
    moveVehicle(p, delta, 16);
    if (boosting && accelerate) game.score += delta * 16;
    if (p.empCooldown > 0) p.empCooldown -= delta;
    if (p.hitCooldown > 0) p.hitCooldown -= delta;
    if (game.statusTimer > 0) {
      game.statusTimer -= delta;
      if (game.statusTimer <= 0) {
        setStatus(game.cursorLocked ? "Mouse locked. Stay smooth through corners." : "Click the road view to lock the mouse.", 0);
      }
    }
    hintValue.textContent = Math.abs(p.speed) > 210 ? "You are flying. Brake sooner for intersections." : game.cursorLocked ? "Mouse steering active. Small movements work best." : "Click the road view for mouse steering.";
  }

  function updatePackages(delta) {
    const target = getNextPackage();
    if (!target) return;
    target.pulse += delta * 5;
    const distance = Math.hypot(target.x - game.player.x, target.y - game.player.y);
    goalValue.textContent = "Next package: " + distance.toFixed(0) + "m";
    if (distance < 50) {
      target.collected = true;
      game.packagesCollected += 1;
      game.score += 400 + Math.max(0, 220 - game.time * 2);
      burstParticles(target.x, target.y, "#ffd567", 18);
      setStatus("Package secured. Move to the next glow.", 2.4);
      setWanted(game.packagesCollected >= 9 ? 3 : game.packagesCollected >= 6 ? 2 : game.packagesCollected >= 3 ? 1 : 0);
      if (game.packagesCollected >= PACKAGE_TOTAL) endGame(true);
    }
  }

  function updatePolice(delta) {
    const p = game.player;
    for (let i = 0; i < game.cops.length; i += 1) {
      const cop = game.cops[i];
      if (cop.stun > 0) {
        cop.stun -= delta;
        cop.speed *= 0.92;
        continue;
      }
      const dx = p.x - cop.x;
      const dy = p.y - cop.y;
      const targetAngle = Math.atan2(dx, dy);
      let diff = targetAngle - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += clamp(diff, -1.8 * delta, 1.8 * delta);
      cop.speed = clamp(cop.speed + delta * (90 + game.wanted * 30), 0, 180 + game.wanted * 35);
      cop.vx = Math.sin(cop.angle) * cop.speed;
      cop.vy = Math.cos(cop.angle) * cop.speed;
      moveVehicle(cop, delta, 16);
      if (cop.touchCooldown > 0) cop.touchCooldown -= delta;
      const hitDistance = Math.hypot(cop.x - p.x, cop.y - p.y);
      if (hitDistance < 56 && p.hitCooldown <= 0 && cop.touchCooldown <= 0) {
        p.hitCooldown = 1.2;
        cop.touchCooldown = 1.2;
        game.health -= 1;
        game.score = Math.max(0, game.score - 120);
        burstParticles(p.x, p.y, "#ff7961", 20);
        setStatus("Police ram landed. Hull integrity down.", 1.8);
        if (game.health <= 0) {
          endGame(false);
          return;
        }
      }
    }
  }

  function fireEmp() {
    const p = game.player;
    if (p.empCooldown > 0 || !game.running) return;
    p.empCooldown = 1.1;
    setStatus("EMP pulse fired.", 1.1);
    game.bullets.push({ x: p.x + Math.sin(p.angle) * 34, y: p.y + Math.cos(p.angle) * 34, angle: p.angle, life: 1.2, speed: 360 });
  }

  function updateBullets(delta) {
    for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = game.bullets[i];
      bullet.life -= delta;
      bullet.x += Math.sin(bullet.angle) * bullet.speed * delta;
      bullet.y += Math.cos(bullet.angle) * bullet.speed * delta;
      if (bullet.life <= 0 || bullet.x < 0 || bullet.x > WORLD.width || bullet.y < 0 || bullet.y > WORLD.height || pointHitsBuilding(bullet.x, bullet.y, 6)) {
        game.bullets.splice(i, 1);
        continue;
      }
      for (let c = 0; c < game.cops.length; c += 1) {
        const cop = game.cops[c];
        if (Math.hypot(cop.x - bullet.x, cop.y - bullet.y) < 44) {
          cop.stun = 2.2;
          cop.speed *= 0.2;
          burstParticles(cop.x, cop.y, "#6ec5ff", 14);
          game.score += 120;
          setStatus("Patrol disabled for a moment.", 1.5);
          game.bullets.splice(i, 1);
          break;
        }
      }
    }
  }

  function updateParticles(delta) {
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vz -= 100 * delta;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  function update(delta) {
    game.time += delta;
    game.score += delta * (40 + game.packagesCollected * 3 + game.wanted * 2);
    handleInput(delta);
    updatePackages(delta);
    updatePolice(delta);
    updateBullets(delta);
    updateParticles(delta);
    updateHud();
  }

  function draw() {
    const cam = createCamera();
    drawSky();
    drawGround(cam);
    drawWorldObjects(cam);
    drawSpeedLines();
    drawHudArrow();
    drawMinimap();
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, "#87b9ff");
    grad.addColorStop(0.48, "#dce7ff");
    grad.addColorStop(0.49, "#546171");
    grad.addColorStop(1, "#1f2530");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawGround(cam) {
    const horizon = VIEW.height * 0.49;
    ctx.fillStyle = "#2a313c";
    ctx.fillRect(0, horizon, VIEW.width, VIEW.height - horizon);
    for (let i = 0; i < city.roads.length; i += 1) {
      const road = city.roads[i];
      drawGroundRect(cam, road.x, road.y, road.w, road.h, road.tone ? "#4f5965" : "#555f6c");
    }
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      drawGroundRect(cam, b.x - 20, b.y - 20, b.w + 40, b.h + 40, "#7f858d");
    }
    drawRoadLines(cam);
  }

  function drawGroundRect(cam, x, y, w, h, fill) {
    const p1 = projectPoint(x, y, 0, cam);
    const p2 = projectPoint(x + w, y, 0, cam);
    const p3 = projectPoint(x + w, y + h, 0, cam);
    const p4 = projectPoint(x, y + h, 0, cam);
    if (!p1 || !p2 || !p3 || !p4) return;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoadLines(cam) {
    for (let x = 0; x <= WORLD.width; x += city.block) {
      for (let y = 0; y < WORLD.height; y += 90) {
        drawGroundRect(cam, x - 4, y + 24, 8, 42, "#e7ce73");
      }
    }
    for (let y = 0; y <= WORLD.height; y += city.block) {
      for (let x = 0; x < WORLD.width; x += 90) {
        drawGroundRect(cam, x + 24, y - 4, 42, 8, "#e7ce73");
      }
    }
  }

  function drawWorldObjects(cam) {
    const items = [];
    for (let i = 0; i < city.buildings.length; i += 1) items.push({ type: "building", ref: city.buildings[i], depth: Math.hypot(city.buildings[i].x - cam.x, city.buildings[i].y - cam.y) });
    for (let i = 0; i < city.lamps.length; i += 1) items.push({ type: "lamp", ref: city.lamps[i], depth: Math.hypot(city.lamps[i].x - cam.x, city.lamps[i].y - cam.y) });
    for (let i = 0; i < city.markers.length; i += 1) items.push({ type: "marker", ref: city.markers[i], depth: Math.hypot(city.markers[i].x - cam.x, city.markers[i].y - cam.y) });
    for (let i = 0; i < game.trafficProps.length; i += 1) items.push({ type: "prop", ref: game.trafficProps[i], depth: Math.hypot(game.trafficProps[i].x - cam.x, game.trafficProps[i].y - cam.y) });
    for (let i = 0; i < game.packages.length; i += 1) if (!game.packages[i].collected) items.push({ type: "package", ref: game.packages[i], depth: Math.hypot(game.packages[i].x - cam.x, game.packages[i].y - cam.y) });
    for (let i = 0; i < game.cops.length; i += 1) items.push({ type: "cop", ref: game.cops[i], depth: Math.hypot(game.cops[i].x - cam.x, game.cops[i].y - cam.y) });
    for (let i = 0; i < game.bullets.length; i += 1) items.push({ type: "bullet", ref: game.bullets[i], depth: Math.hypot(game.bullets[i].x - cam.x, game.bullets[i].y - cam.y) });
    for (let i = 0; i < game.particles.length; i += 1) items.push({ type: "particle", ref: game.particles[i], depth: Math.hypot(game.particles[i].x - cam.x, game.particles[i].y - cam.y) });
    items.push({ type: "player", ref: game.player, depth: Math.hypot(game.player.x - cam.x, game.player.y - cam.y) });
    items.sort((a, b) => b.depth - a.depth);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.type === "building") drawBuilding(cam, item.ref);
      if (item.type === "lamp") drawLamp(cam, item.ref);
      if (item.type === "marker") drawMarker(cam, item.ref);
      if (item.type === "prop") drawProp(cam, item.ref);
      if (item.type === "package") drawPackage(cam, item.ref);
      if (item.type === "cop") drawCar(cam, item.ref, "#4d83ff", true);
      if (item.type === "player") drawCar(cam, item.ref, "#ff7b57", false);
      if (item.type === "bullet") drawBullet(cam, item.ref);
      if (item.type === "particle") drawParticle(cam, item.ref);
    }
  }

  function drawBuilding(cam, b) {
    const base = [projectPoint(b.x, b.y, 0, cam), projectPoint(b.x + b.w, b.y, 0, cam), projectPoint(b.x + b.w, b.y + b.h, 0, cam), projectPoint(b.x, b.y + b.h, 0, cam)];
    const top = [projectPoint(b.x, b.y, b.z, cam), projectPoint(b.x + b.w, b.y, b.z, cam), projectPoint(b.x + b.w, b.y + b.h, b.z, cam), projectPoint(b.x, b.y + b.h, b.z, cam)];
    if (base.includes(null) || top.includes(null)) return;
    drawQuad(base, b.color);
    drawQuad([base[0], base[1], top[1], top[0]], shadeColor(b.color, -18));
    drawQuad([base[1], base[2], top[2], top[1]], shadeColor(b.color, -32));
    drawQuad([base[2], base[3], top[3], top[2]], shadeColor(b.color, -10));
    drawQuad(top, shadeColor(b.color, 18));
  }

  function drawQuad(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function shadeColor(hex, amt) {
    const num = parseInt(hex.slice(1), 16);
    const r = clamp((num >> 16) + amt, 0, 255);
    const g = clamp(((num >> 8) & 255) + amt, 0, 255);
    const b = clamp((num & 255) + amt, 0, 255);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function drawLamp(cam, lamp) {
    const base = projectPoint(lamp.x, lamp.y, 0, cam);
    const top = projectPoint(lamp.x, lamp.y, lamp.z, cam);
    const glow = projectPoint(lamp.x, lamp.y, lamp.z + 10, cam);
    if (!base || !top || !glow) return;
    ctx.strokeStyle = "#424a54";
    ctx.lineWidth = Math.max(1, 7 / top.z);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    const radius = clamp(32 / glow.z * 40, 1.5, 12);
    ctx.fillStyle = "#ffd567";
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMarker(cam, marker) {
    const p = projectPoint(marker.x, marker.y, 0, cam);
    const tip = projectPoint(marker.x, marker.y, 18, cam);
    if (!p || !tip) return;
    ctx.fillStyle = "#ff8f47";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 10, p.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawProp(cam, prop) {
    const p = projectPoint(prop.x, prop.y, 0, cam);
    const top = projectPoint(prop.x, prop.y, prop.type === "barrel" ? 16 : 10, cam);
    if (!p || !top) return;
    const size = clamp(220 / p.z, 4, 18);
    ctx.fillStyle = prop.type === "barrel" ? "#d36547" : "#d8d8d8";
    ctx.fillRect(p.x - size * 0.5, top.y, size, p.y - top.y + size * 0.2);
  }

  function drawPackage(cam, pkg) {
    const bob = 12 + Math.sin(pkg.pulse) * 8;
    const base = projectPoint(pkg.x, pkg.y, bob, cam);
    if (!base) return;
    const glow = clamp(420 / base.z, 4, 30);
    const grad = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, glow * 1.8);
    grad.addColorStop(0, "rgba(255, 245, 180, 0.95)");
    grad.addColorStop(1, "rgba(255, 213, 103, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(base.x, base.y, glow * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd567";
    ctx.fillRect(base.x - glow * 0.6, base.y - glow * 0.6, glow * 1.2, glow * 1.2);
  }

  function drawCar(cam, car, color, police) {
    const front = { x: car.x + Math.sin(car.angle) * car.length * 0.5, y: car.y + Math.cos(car.angle) * car.length * 0.5 };
    const back = { x: car.x - Math.sin(car.angle) * car.length * 0.5, y: car.y - Math.cos(car.angle) * car.length * 0.5 };
    const sideX = Math.cos(car.angle) * car.width * 0.5;
    const sideY = -Math.sin(car.angle) * car.width * 0.5;
    const body = [projectPoint(front.x - sideX, front.y - sideY, 12, cam), projectPoint(front.x + sideX, front.y + sideY, 12, cam), projectPoint(back.x + sideX, back.y + sideY, 12, cam), projectPoint(back.x - sideX, back.y - sideY, 12, cam)];
    const roof = [projectPoint(front.x - sideX * 0.75, front.y - sideY * 0.75, 26, cam), projectPoint(front.x + sideX * 0.75, front.y + sideY * 0.75, 26, cam), projectPoint(back.x + sideX * 0.55, back.y + sideY * 0.55, 26, cam), projectPoint(back.x - sideX * 0.55, back.y - sideY * 0.55, 26, cam)];
    if (body.includes(null) || roof.includes(null)) return;
    drawQuad(body, color);
    drawQuad(roof, police ? "#c2e6ff" : "#f8d7c9");
    drawQuad([body[0], body[1], roof[1], roof[0]], shadeColor(color, -20));
    drawQuad([body[1], body[2], roof[2], roof[1]], shadeColor(color, -30));
    drawQuad([body[2], body[3], roof[3], roof[2]], shadeColor(color, -10));
    if (police) {
      const light = projectPoint(car.x, car.y, 30, cam);
      if (light) {
        ctx.fillStyle = car.stun > 0 ? "#6ec5ff" : game.time % 0.4 < 0.2 ? "#ff5d5d" : "#6ec5ff";
        ctx.fillRect(light.x - 5, light.y - 2, 10, 4);
      }
    }
  }

  function drawBullet(cam, bullet) {
    const p = projectPoint(bullet.x, bullet.y, 12, cam);
    if (!p) return;
    const size = clamp(160 / p.z, 2, 9);
    ctx.fillStyle = "#6ec5ff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticle(cam, particle) {
    const p = projectPoint(particle.x, particle.y, particle.z, cam);
    if (!p) return;
    const size = clamp(120 / p.z, 1, 6) * particle.life;
    ctx.globalAlpha = clamp(particle.life, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
    ctx.globalAlpha = 1;
  }

  function drawHudArrow() {
    const pkg = getNextPackage();
    if (!pkg) return;
    const dx = pkg.x - game.player.x;
    const dy = pkg.y - game.player.y;
    const targetAngle = Math.atan2(dx, dy);
    const relative = targetAngle - game.player.angle;
    ctx.save();
    ctx.translate(VIEW.width - 90, 84);
    ctx.rotate(relative);
    ctx.fillStyle = "#ffd567";
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(16, 18);
    ctx.lineTo(0, 10);
    ctx.lineTo(-16, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSpeedLines() {
    const intensity = clamp((Math.abs(game.player.speed) - 120) / 180, 0, 1);
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalAlpha = intensity * 0.28;
    ctx.strokeStyle = "rgba(190, 230, 255, 0.7)";
    for (let i = 0; i < 14; i += 1) {
      const x = (i / 13) * VIEW.width;
      ctx.beginPath();
      ctx.moveTo(x, VIEW.height * 0.72);
      ctx.lineTo(x + Math.sin(game.time * 4 + i) * 14, VIEW.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMinimap() {
    mapCtx.fillStyle = "#0c1118";
    mapCtx.fillRect(0, 0, minimap.width, minimap.height);
    mapCtx.strokeStyle = "rgba(255,255,255,0.08)";
    mapCtx.strokeRect(10, 10, 200, 200);
    const scaleX = 200 / WORLD.width;
    const scaleY = 200 / WORLD.height;
    mapCtx.fillStyle = "#263243";
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      mapCtx.fillRect(10 + b.x * scaleX, 10 + b.y * scaleY, b.w * scaleX, b.h * scaleY);
    }
    mapCtx.fillStyle = "#ffd567";
    for (let i = 0; i < game.packages.length; i += 1) {
      const pkg = game.packages[i];
      if (!pkg.collected) mapCtx.fillRect(10 + pkg.x * scaleX - 3, 10 + pkg.y * scaleY - 3, 6, 6);
    }
    mapCtx.fillStyle = "#4d83ff";
    for (let i = 0; i < game.cops.length; i += 1) {
      const cop = game.cops[i];
      mapCtx.fillRect(10 + cop.x * scaleX - 3, 10 + cop.y * scaleY - 3, 6, 6);
    }
    const px = 10 + game.player.x * scaleX;
    const py = 10 + game.player.y * scaleY;
    mapCtx.fillStyle = "#ff7b57";
    mapCtx.beginPath();
    mapCtx.arc(px, py, 5, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = "#ffffff";
    mapCtx.beginPath();
    mapCtx.moveTo(px, py);
    mapCtx.lineTo(px + Math.sin(game.player.angle) * 12, py + Math.cos(game.player.angle) * 12);
    mapCtx.stroke();
  }

  function frame(timestamp) {
    if (game.running) {
      if (!game.lastTime) game.lastTime = timestamp;
      const delta = Math.min((timestamp - game.lastTime) / 1000, 0.033);
      game.lastTime = timestamp;
      update(delta);
    }
    draw();
    requestAnimationFrame(frame);
  }

  function toggleHelp(force) {
    game.helpVisible = typeof force === "boolean" ? force : !game.helpVisible;
    helpOverlay.classList.toggle("active", game.helpVisible);
    if (game.helpVisible) {
      setStatus("Help open. Close it to resume the run.", 0);
    } else if (game.running) {
      setStatus(game.cursorLocked ? "Back in the run. Keep moving." : "Click the road view to lock the mouse.", 1.5);
    }
  }

  function requestPointerLock() {
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  }

  function resetCar() {
    game.player.x = 180;
    game.player.y = 300;
    game.player.angle = 0;
    game.player.speed = 0;
    setStatus("Car reset to the depot.", 1.6);
  }

  window.addEventListener("keydown", function (event) {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","Space","ShiftLeft","ShiftRight","KeyR","KeyF","KeyH"].includes(event.code)) event.preventDefault();
    KEYS[event.code] = true;
    if (event.code === "KeyR") {
      resetCar();
    }
    if (event.code === "KeyF") fireEmp();
    if (event.code === "KeyH") toggleHelp();
    if (event.code === "Escape" && document.pointerLockElement === canvas) {
      document.exitPointerLock();
      setStatus("Mouse released.", 1.2);
    }
  });

  window.addEventListener("keyup", function (event) {
    KEYS[event.code] = false;
  });

  window.addEventListener("resize", resizeCanvas);
  startButton.addEventListener("click", startGame);
  startHelpButton.addEventListener("click", function () {
    toggleHelp(true);
  });
  restartButton.addEventListener("click", startGame);
  gameOverHelpButton.addEventListener("click", function () {
    toggleHelp(true);
  });
  closeHelpButton.addEventListener("click", function () {
    toggleHelp(false);
  });
  canvas.addEventListener("click", function () {
    requestPointerLock();
  });
  document.addEventListener("pointerlockchange", function () {
    game.cursorLocked = document.pointerLockElement === canvas;
    refreshLockUi();
    if (game.cursorLocked) {
      setStatus("Mouse locked. Use gentle movement to steer.", 2);
    } else if (game.running) {
      setStatus("Mouse free. Click the road view to lock again.", 0);
    }
  });
  document.addEventListener("mousemove", function (event) {
    if (!game.cursorLocked) return;
    game.mouseSteer = clamp(game.mouseSteer + event.movementX * 0.009, -1.4, 1.4);
  });

  resizeCanvas();
  resetGame();
  refreshLockUi();
  draw();
  requestAnimationFrame(frame);
})();
