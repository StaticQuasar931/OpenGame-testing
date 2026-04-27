(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const gameOverMessage = document.getElementById("gameOverMessage");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const boostValue = document.getElementById("boostValue");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");

  const WORLD = { width: 1280, height: 720 };
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  const STORAGE_KEY = "neon-rift-3d-best";
  const FOV = 560;
  const CAMERA_Z = -6;
  const keys = Object.create(null);
  const rand = (min, max) => min + Math.random() * (max - min);

  const player = {
    x: 0,
    y: 0,
    radius: 0.9,
    trail: [],
  };

  let running = false;
  let score = 0;
  let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  let elapsed = 0;
  let distance = 0;
  let speed = 18;
  let boost = 1;
  let lastTime = 0;
  let spawnTimer = 0;
  let shards = [];
  let orbs = [];
  let sparks = [];
  let stars = createStars(120);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round((rect.width * WORLD.height) / WORLD.width * DPR);
    ctx.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
  }

  function createStars(count) {
    const output = [];
    for (let i = 0; i < count; i += 1) {
      output.push({
        x: rand(-28, 28),
        y: rand(-16, 16),
        z: rand(4, 120),
        size: rand(0.6, 1.8),
      });
    }
    return output;
  }

  function project(x, y, z) {
    const dz = z - CAMERA_Z;
    if (dz <= 0.25) {
      return null;
    }
    const scale = FOV / dz;
    return {
      x: WORLD.width * 0.5 + x * scale,
      y: WORLD.height * 0.5 - y * scale,
      scale,
    };
  }

  function resetGame() {
    running = false;
    score = 0;
    elapsed = 0;
    distance = 0;
    speed = 18;
    boost = 1;
    spawnTimer = 0.2;
    lastTime = 0;
    player.x = 0;
    player.y = 0;
    player.trail.length = 0;
    shards = [];
    orbs = [];
    sparks = [];
    stars = createStars(120);
    updateHud();
  }

  function startGame() {
    resetGame();
    running = true;
    startOverlay.classList.remove("active");
    gameOverOverlay.classList.remove("active");
  }

  function updateHud() {
    scoreValue.textContent = String(Math.floor(score));
    bestValue.textContent = String(bestScore);
    boostValue.textContent = boost.toFixed(1) + "x";
  }

  function endGame() {
    running = false;
    bestScore = Math.max(bestScore, Math.floor(score));
    localStorage.setItem(STORAGE_KEY, String(bestScore));
    updateHud();
    gameOverMessage.textContent =
      "You scored " + Math.floor(score) + " after flying " + distance.toFixed(0) + " meters.";
    gameOverOverlay.classList.add("active");
  }

  function spawnShard() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const laneBias = rand(-7.5, 7.5);
    const baseX = laneBias + side * rand(1.6, 5.6);
    const baseY = rand(-4.8, 4.8);
    const size = rand(0.8, 2.2);
    shards.push({
      x: baseX,
      y: baseY,
      z: rand(90, 132),
      size,
      rot: rand(0, Math.PI * 2),
      spin: rand(-2.4, 2.4),
      dx: rand(-0.5, 0.5),
      dy: rand(-0.35, 0.35),
      color: Math.random() < 0.55 ? "#ff69c4" : "#78d4ff",
    });
  }

  function spawnOrb() {
    orbs.push({
      x: rand(-5.6, 5.6),
      y: rand(-3.6, 3.6),
      z: rand(88, 124),
      radius: rand(0.45, 0.8),
      pulse: rand(0, Math.PI * 2),
    });
  }

  function emitSparks(x, y, amount, color) {
    for (let i = 0; i < amount; i += 1) {
      sparks.push({
        x,
        y,
        z: rand(6, 16),
        vx: rand(-4, 4),
        vy: rand(-4, 4),
        vz: rand(-6, 2),
        life: rand(0.4, 0.8),
        size: rand(0.06, 0.14),
        color,
      });
    }
  }

  function inputAxis(positiveA, positiveB, negativeA, negativeB) {
    return (keys[positiveA] || keys[positiveB] ? 1 : 0) - (keys[negativeA] || keys[negativeB] ? 1 : 0);
  }

  function update(delta) {
    elapsed += delta;
    boost = Math.min(3.5, 1 + elapsed * 0.03);
    const isBursting = Boolean(keys.ShiftLeft || keys.ShiftRight);
    const burstBonus = isBursting ? 8 : 0;
    speed = Math.min(40, 18 + elapsed * 1.5 + burstBonus);

    const moveX = inputAxis("ArrowRight", "KeyD", "ArrowLeft", "KeyA");
    const moveY = inputAxis("ArrowUp", "KeyW", "ArrowDown", "KeyS");
    const moveScale = delta * (isBursting ? 9 : 6.5);
    player.x += moveX * moveScale;
    player.y += moveY * moveScale;
    player.x = Math.max(-7.2, Math.min(7.2, player.x));
    player.y = Math.max(-4.5, Math.min(4.5, player.y));

    distance += speed * delta * 8;
    score += delta * 70 * boost + (isBursting ? delta * 22 : 0);

    player.trail.unshift({
      x: player.x,
      y: player.y,
      z: 4.4,
      life: 0.32,
    });
    if (player.trail.length > 18) {
      player.trail.pop();
    }
    for (let i = player.trail.length - 1; i >= 0; i -= 1) {
      player.trail[i].life -= delta;
      if (player.trail[i].life <= 0) {
        player.trail.splice(i, 1);
      }
    }

    spawnTimer -= delta;
    const targetGap = Math.max(0.18, 0.62 - elapsed * 0.015);
    while (spawnTimer <= 0) {
      spawnShard();
      if (Math.random() < 0.4 + Math.min(0.25, elapsed * 0.01)) {
        spawnShard();
      }
      if (Math.random() < 0.45) {
        spawnOrb();
      }
      spawnTimer += targetGap;
    }

    for (let i = stars.length - 1; i >= 0; i -= 1) {
      const star = stars[i];
      star.z -= speed * delta * 1.8;
      if (star.z < 1) {
        star.x = rand(-28, 28);
        star.y = rand(-16, 16);
        star.z = rand(90, 120);
        star.size = rand(0.6, 1.8);
      }
    }

    for (let i = shards.length - 1; i >= 0; i -= 1) {
      const shard = shards[i];
      shard.z -= speed * delta;
      shard.rot += shard.spin * delta;
      shard.x += shard.dx * delta;
      shard.y += shard.dy * delta;

      const dx = shard.x - player.x;
      const dy = shard.y - player.y;
      if (shard.z < 6.5 && Math.hypot(dx, dy) < player.radius + shard.size * 0.55) {
        emitSparks(player.x, player.y, 18, shard.color);
        endGame();
        return;
      }

      if (shard.z < 1) {
        shards.splice(i, 1);
      }
    }

    for (let i = orbs.length - 1; i >= 0; i -= 1) {
      const orb = orbs[i];
      orb.z -= speed * delta * 1.02;
      orb.pulse += delta * 4;

      const dx = orb.x - player.x;
      const dy = orb.y - player.y;
      if (orb.z < 6.5 && Math.hypot(dx, dy) < player.radius + orb.radius) {
        score += 180 * boost;
        emitSparks(orb.x, orb.y, 10, "#ffd46b");
        orbs.splice(i, 1);
        continue;
      }

      if (orb.z < 1) {
        orbs.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.life -= delta;
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.z += spark.vz * delta;
      if (spark.life <= 0) {
        sparks.splice(i, 1);
      }
    }

    updateHud();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    sky.addColorStop(0, "#09111d");
    sky.addColorStop(1, "#030409");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    const glow = ctx.createRadialGradient(WORLD.width * 0.5, WORLD.height * 0.26, 40, WORLD.width * 0.5, WORLD.height * 0.5, 520);
    glow.addColorStop(0, "rgba(120, 212, 255, 0.12)");
    glow.addColorStop(1, "rgba(120, 212, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  function drawStars() {
    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      const projected = project(star.x, star.y, star.z);
      if (!projected) {
        continue;
      }
      const size = Math.max(0.6, star.size * projected.scale * 0.02);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(projected.x, projected.y, size, size);
    }
  }

  function drawTunnel() {
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 16; ring += 1) {
      const z = 16 + ring * 8 - (distance * 0.06 % 8);
      const topLeft = project(-8, 5.4, z);
      const topRight = project(8, 5.4, z);
      const bottomRight = project(8, -5.4, z);
      const bottomLeft = project(-8, -5.4, z);
      if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
        continue;
      }
      ctx.strokeStyle = ring % 2 === 0 ? "rgba(120,212,255,0.22)" : "rgba(255,105,196,0.18)";
      ctx.beginPath();
      ctx.moveTo(topLeft.x, topLeft.y);
      ctx.lineTo(topRight.x, topRight.y);
      ctx.lineTo(bottomRight.x, bottomRight.y);
      ctx.lineTo(bottomLeft.x, bottomLeft.y);
      ctx.closePath();
      ctx.stroke();
    }

    for (let rail = -1; rail <= 1; rail += 2) {
      ctx.strokeStyle = rail < 0 ? "rgba(255,105,196,0.26)" : "rgba(120,212,255,0.26)";
      ctx.beginPath();
      let started = false;
      for (let z = 4; z <= 128; z += 4) {
        const p = project(rail * 8, rail > 0 ? 5.2 : -5.2, z);
        if (!p) {
          continue;
        }
        if (!started) {
          ctx.moveTo(p.x, p.y);
          started = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
  }

  function drawDiamond(x, y, size, rotation, fill, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.7, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawShards() {
    const sorted = shards.slice().sort((a, b) => b.z - a.z);
    for (let i = 0; i < sorted.length; i += 1) {
      const shard = sorted[i];
      const projected = project(shard.x, shard.y, shard.z);
      if (!projected) {
        continue;
      }
      const size = shard.size * projected.scale * 0.85;
      drawDiamond(projected.x, projected.y, size, shard.rot, shard.color, 0.95);
      drawDiamond(projected.x, projected.y, size * 1.55, -shard.rot * 0.45, shard.color, 0.14);
    }
  }

  function drawOrbs() {
    for (let i = 0; i < orbs.length; i += 1) {
      const orb = orbs[i];
      const projected = project(orb.x, orb.y, orb.z);
      if (!projected) {
        continue;
      }
      const radius = orb.radius * projected.scale;
      const pulse = 1 + Math.sin(orb.pulse) * 0.12;
      const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius * 2.2);
      gradient.addColorStop(0, "rgba(255, 245, 190, 0.96)");
      gradient.addColorStop(0.4, "rgba(255, 212, 107, 0.85)");
      gradient.addColorStop(1, "rgba(255, 212, 107, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius * 2.2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffd46b";
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    for (let i = player.trail.length - 1; i >= 0; i -= 1) {
      const trail = player.trail[i];
      const projected = project(trail.x, trail.y, trail.z + i * 0.14);
      if (!projected) {
        continue;
      }
      const size = projected.scale * 0.18;
      ctx.fillStyle = "rgba(120, 212, 255, " + Math.max(0, trail.life * 1.8).toFixed(3) + ")";
      ctx.fillRect(projected.x - size, projected.y - size, size * 2, size * 2);
    }

    const projected = project(player.x, player.y, 5.4);
    if (!projected) {
      return;
    }

    const shipWidth = 72;
    const shipHeight = 26;
    ctx.save();
    ctx.translate(projected.x, projected.y);
    ctx.fillStyle = "rgba(120, 212, 255, 0.22)";
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(shipWidth * 0.56, 0);
    ctx.lineTo(0, shipHeight);
    ctx.lineTo(-shipWidth * 0.56, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#eef6ff";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(24, 0);
    ctx.lineTo(0, 20);
    ctx.lineTo(-24, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#78d4ff";
    ctx.fillRect(-10, -5, 20, 10);
    ctx.fillStyle = "#ff69c4";
    ctx.fillRect(-34, -4, 12, 8);
    ctx.fillRect(22, -4, 12, 8);
    ctx.restore();
  }

  function drawSparks() {
    for (let i = 0; i < sparks.length; i += 1) {
      const spark = sparks[i];
      const projected = project(spark.x, spark.y, Math.max(1.2, spark.z));
      if (!projected) {
        continue;
      }
      const size = spark.size * projected.scale;
      ctx.fillStyle = spark.color.replace(")", ", " + Math.max(0, spark.life).toFixed(3) + ")");
    }
  }

  function drawSparksFallback() {
    for (let i = 0; i < sparks.length; i += 1) {
      const spark = sparks[i];
      const projected = project(spark.x, spark.y, Math.max(1.2, spark.z));
      if (!projected) {
        continue;
      }
      const size = Math.max(1.5, spark.size * projected.scale * 4);
      const alpha = Math.max(0, spark.life);
      ctx.fillStyle = spark.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(projected.x - size * 0.5, projected.y - size * 0.5, size, size);
      ctx.globalAlpha = 1;
    }
  }

  function drawDepthBars() {
    const intensity = Math.min(1, elapsed / 40);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(26, WORLD.height - 42, 220, 14);
    ctx.fillStyle = "rgba(120,212,255,0.92)";
    ctx.fillRect(26, WORLD.height - 42, 220 * Math.min(1, boost / 3.5), 14);
    ctx.fillStyle = "#d8e6ff";
    ctx.font = "13px Segoe UI";
    ctx.fillText("Rift charge", 28, WORLD.height - 48);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(WORLD.width - 246, WORLD.height - 42, 220, 14);
    ctx.fillStyle = "rgba(255,105,196,0.88)";
    ctx.fillRect(WORLD.width - 246, WORLD.height - 42, 220 * intensity, 14);
    ctx.fillStyle = "#d8e6ff";
    ctx.fillText("Danger", WORLD.width - 244, WORLD.height - 48);
  }

  function draw() {
    drawBackground();
    drawStars();
    drawTunnel();
    drawShards();
    drawOrbs();
    drawPlayer();
    drawSparksFallback();
    drawDepthBars();
  }

  function frame(timestamp) {
    if (running) {
      if (!lastTime) {
        lastTime = timestamp;
      }
      const delta = Math.min((timestamp - lastTime) / 1000, 0.033);
      lastTime = timestamp;
      update(delta);
    }
    draw();
    requestAnimationFrame(frame);
  }

  function handleKey(event, pressed) {
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
        "ShiftLeft",
        "ShiftRight",
        "Space",
      ].includes(event.code)
    ) {
      event.preventDefault();
    }
    keys[event.code] = pressed;
    if (!pressed && event.code === "Space" && !running) {
      startGame();
    }
  }

  window.addEventListener("keydown", function (event) {
    handleKey(event, true);
  });

  window.addEventListener("keyup", function (event) {
    handleKey(event, false);
  });

  window.addEventListener("resize", resizeCanvas);
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);

  resizeCanvas();
  updateHud();
  draw();
  requestAnimationFrame(frame);
})();
