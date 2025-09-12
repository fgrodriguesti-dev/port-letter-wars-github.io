let player;
let enemies = [];
let bullets = [];
let stars = [];
let abilities = [];
let orbs = [];
let falling = [];

let playerImg;

// === NOVO: imagens dos inimigos (a..z sem f), cada letra tem [normal, alt] ===
let enemyImgs = {};       // { 'a': [imgA, imgA1], ... }
let enemyLetters = [];    // ['a','b',...,'z'] sem 'f'

// === DIFICULDADE / BALANCE ===
const BULLET_DAMAGE = 1;
const EXPLOSION_DAMAGE = 1;
const ORB_DAMAGE = 3;
const ORB_HIT_COOLDOWN = 0.2;  // s: tempo entre acertos do mesmo orb
const NORMAL_SIZE = 48;
const BOSS_SIZE = 64;
const BOSS_HP = 150;
const SAFE_SPAWN_DIST = 100;

const DIFF_SPAWN_DECAY = 0.05; // -5% no intervalo por round
const DIFF_SPAWN_MIN = 0.25;   // mínimo 0.25s entre spawns
const DIFF_SPEED_SCALE = 0.06; // +6% de velocidade por round

// === Chefes por abates ===
let killsTotal = 0;
let killsSinceBoss = 0;
let spawnBossNext = false;

let gameState = "menu"; // menu / playing / levelup / gameover / paused
let choices = [];
let levelUpBoxes = []; // caixas clicáveis do level up

let roundTime = 120;
let roundTimer = roundTime;
let spawnTimer = 0;
let fireTimer = 0;
let fallingTimer = 15;

let roundNumber = 1;

let isMobile = false;
let joystick = { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0 };

/* Botão de pause/play no HUD */
let pauseButton = { x: 0, y: 0, w: 50, h: 50 };

let allAbilities = {
  1: "Tiro '-' (mais rápido por nível)",
  2: "Tiro '+' (mais rápido por nível)",
  3: "Orb 🌀 orbitando (raio/velocidade sobem)",
  4: "Bomba '!' caída (intervalo menor por nível)",
  5: "Velocidade do jogador (+spd por nível)",
  6: "Taxa de tiro (intervalo menor por nível)",
  7: "Tiros penetram (mais acertos por nível)",
  8: "Explosão ao matar (raio maior por nível)",
  9: "Tiros laterais (ângulo maior por nível)"
};

function preload() {
  playerImg = loadImage("player.png");

  // Carrega inimigos: a..z exceto f, com variações X.png e X1.png
  const letters = "abcdefghijklmnopqrstuvwxyz".split("").filter(l => l !== "f");
  enemyLetters = letters.slice();
  for (let l of letters) {
    const img0 = loadImage(`enemys/${l}.png`);
    const img1 = loadImage(`enemys/${l}1.png`);
    enemyImgs[l] = [img0, img1];
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  resetGame();
  isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function resetGame() {
  player = {
    x: width / 2,
    y: height / 2,
    speed: 200,
    xp: 0,
    level: 1,
    size: 20,
    hp: 5,
    baseFireRate: 0.5,
    fireRate: 0.5
  };
  enemies = [];
  bullets = [];
  stars = [];
  abilities = [];
  orbs = [];
  falling = [];
  gameState = "menu";
  roundTimer = roundTime;
  spawnTimer = 0;
  fireTimer = 0;
  fallingTimer = 15;
  roundNumber = 1;

  killsTotal = 0;
  killsSinceBoss = 0;
  spawnBossNext = false;
}

function draw() {
  background(30);

  if (isMobile && windowHeight > windowWidth) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text("Por favor, vire o dispositivo na horizontal 📱↔️", width / 2, height / 2);
    return;
  }

  if (!playerImg) {
    fill(255);
    textAlign(CENTER);
    textSize(24);
    text("Carregando imagem...", width / 2, height / 2);
    return;
  }

  if (gameState === "menu") {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(isMobile ? 32 : 24);
    text("LETTER WARS \nClique/toque para começar", width / 2, height / 2);
    return;
  }

  if (gameState === "gameover") {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(isMobile ? 32 : 24);
    text("GAME OVER\nClique/toque para tentar novamente", width / 2, height / 2);
    text("Level alcançado: " + player.level, width / 2, height / 2 + (isMobile ? 80 : 50));
    return;
  }

  if (gameState === "levelup") {
    drawGame();     // mantém a cena congelada
    drawLevelUp();  // overlay de escolhas (clicável)
    return;
  }

  if (gameState === "paused") {
    drawGame();
    drawPauseOverlay(); // overlay translúcido
    return;
  }

  if (gameState === "playing") {
    updateGame();
    drawGame();
    if (isMobile) drawJoystick();
  }
}

function getSpawnInterval() {
  // diminui ~5% por round até um mínimo
  const factor = Math.max(0, 1 - DIFF_SPAWN_DECAY * (roundNumber - 1));
  return max(DIFF_SPAWN_MIN, 1 * factor);
}

function getSpeedScale() {
  // aumenta ~6% por round
  return 1 + DIFF_SPEED_SCALE * (roundNumber - 1);
}

function updateGame() {
  let dt = deltaTime / 1000;
  let moveX = 0, moveY = 0;

  if (isMobile && joystick.active) {
    moveX = (joystick.stickX - joystick.baseX) / 40;
    moveY = (joystick.stickY - joystick.baseY) / 40;
  } else {
    if (keyIsDown(87)) moveY -= 1; // W
    if (keyIsDown(83)) moveY += 1; // S
    if (keyIsDown(65)) moveX -= 1; // A
    if (keyIsDown(68)) moveX += 1; // D
  }

  let mag = sqrt(moveX * moveX + moveY * moveY);
  if (mag > 0) {
    moveX /= mag;
    moveY /= mag;
    player.x += moveX * player.speed * dt;
    player.y += moveY * player.speed * dt;
  }

  // Bordas do mapa
  player.x = constrain(player.x, player.size, width - player.size);
  player.y = constrain(player.y, player.size, height - player.size);

  // Spawn inimigo
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = getSpawnInterval();
  }

  // Tiros automáticos
  fireTimer -= dt;
  if (fireTimer <= 0) {
    fireAllBullets();
    fireTimer = player.fireRate;
  }

  // Orbs (com cooldown de hit)
  for (let orb of orbs) {
    let ability = getAbility(3);
    let lvl = ability ? ability.level : 0;
    let radius = 30 + lvl * 10;
    let speed = 2 + lvl * 0.5;

    if (orb.hitCD > 0) orb.hitCD -= dt;

    orb.angle += speed * dt;
    orb.x = player.x + cos(orb.angle) * radius;
    orb.y = player.y + sin(orb.angle) * radius;

    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i];
      if (dist(orb.x, orb.y, e.x, e.y) < (e.size / 2 + 6)) {
        if (orb.hitCD <= 0) {
          e.hp -= ORB_DAMAGE;
          orb.hitCD = ORB_HIT_COOLDOWN;
          if (e.hp <= 0) killEnemyAtIndex(i);
        }
      }
    }
  }

  // Bombas caindo
  let ability4 = getAbility(4);
  let lvl4 = ability4 ? ability4.level : 0;
  let bombInterval = lvl4 > 0 ? max(3, 15 - lvl4 * 2) : 15;
  fallingTimer -= dt;
  if (fallingTimer <= 0) {
    if (lvl4 > 0) falling.push({ x: random(width), y: -20, speed: 120 });
    fallingTimer = bombInterval;
  }
  for (let i = falling.length - 1; i >= 0; i--) {
    let b = falling[i];
    b.y += b.speed * dt;
    if (b.y > height) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (abs(enemies[j].x - b.x) < 24) {
          enemies[j].hp -= 9999; // bomba mata normal e causa grande dano no boss
          if (enemies[j].hp <= 0) killEnemyAtIndex(j);
        }
      }
      falling.splice(i, 1);
    }
  }

  // Inimigos perseguindo
  const speedScale = getSpeedScale();
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let distVal = sqrt(dx * dx + dy * dy);
    if (distVal > 0) {
      e.x += (dx / distVal) * e.speed * speedScale * dt;
      e.y += (dy / distVal) * e.speed * speedScale * dt;
    }
    if (distVal < player.size) {
      player.hp -= 1;
      enemies.splice(i, 1);
      if (player.hp <= 0) gameState = "gameover";
    }
  }

  // Balas
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;

    if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
      bullets.splice(i, 1);
      continue;
    }

    let hitSomething = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      let e = enemies[j];
      if (dist(b.x, b.y, e.x, e.y) < (e.size / 2 + 4)) {
        e.hp -= BULLET_DAMAGE;
        hitSomething = true;

        if (e.hp <= 0) {
          killEnemyAtIndex(j);
          if (b.explosion) explodeAt(e.x, e.y, b.explosion);
        } else {
          if (b.explosion) explodeAt(b.x, b.y, b.explosion);
        }

        if (b.remainingPierce > 0) {
          b.remainingPierce--;
        } else {
          bullets.splice(i, 1);
        }
        break;
      }
    }
    if (!hitSomething && b.explosion && (b.x < 0 || b.x > width || b.y < 0 || b.y > height)) {
      // nada
    }
  }

  // Coletar estrelas (XP)
  for (let i = stars.length - 1; i >= 0; i--) {
    if (dist(player.x, player.y, stars[i].x, stars[i].y) < player.size) {
      addXP(1);
      stars.splice(i, 1);
    }
  }

  // Troca de round
  roundTimer -= dt;
  if (roundTimer <= 0) {
    roundTimer = roundTime;
    enemies = [];
    roundNumber++;
  }
}

/* === MAPA DE FUNDO === */
function drawMapScrolling() {
  let tileSize = 100;
  let offsetX = -player.x % tileSize;
  let offsetY = -player.y % tileSize;

  const wrap255 = n => ((n % 255) + 255) % 255;
  let baseR = wrap255(roundNumber * 70);
  let baseG = wrap255(100 + roundNumber * 40);
  let baseB = wrap255(200 - roundNumber * 50);

  push();
  rectMode(CORNER);
  noStroke();
  for (let x = offsetX - tileSize; x < width + tileSize; x += tileSize) {
    for (let y = offsetY - tileSize; y < height + tileSize; y += tileSize) {
      if ((x + y) % 200 === 0) fill(baseR, baseG, baseB);
      else fill(baseR * 0.6, baseG * 0.6, baseB * 0.6);
      rect(x, y, tileSize, tileSize);
    }
  }
  pop();
}

/* === DESENHO DO JOGO === */
function drawGame() {
  drawMapScrolling();

  // Player
  imageMode(CENTER);
  image(playerImg, player.x, player.y, 40, 40);

  // Inimigos (como imagens)
  for (let e of enemies) {
    imageMode(CENTER);
    image(e.img, e.x, e.y, e.size, e.size);

    // Barra de vida para BOSS
    if (e.isBoss) {
      let bw = 60, bh = 6;
      let ratio = constrain(e.hp / e.maxHp, 0, 1);
      push();
      rectMode(CENTER);
      noStroke();
      fill(0, 0, 0, 150);
      rect(e.x, e.y - e.size / 2 - 10, bw, bh);
      fill(255, 0, 0);
      rect(e.x - bw / 2 + bw * ratio / 2, e.y - e.size / 2 - 10, bw * ratio, bh);
      pop();
    }
  }

  // Balas
  fill(255, 200, 0);
  for (let b of bullets) ellipse(b.x, b.y, isMobile ? 10 : 6);

  // Estrelas (XP)
  fill(255, 255, 0);
  textAlign(CENTER, CENTER);
  for (let s of stars) text("*", s.x, s.y);

  // Orbs
  textSize(isMobile ? 32 : 24);
  textAlign(CENTER, CENTER);
  for (let orb of orbs) text("🌀", orb.x, orb.y);

  // Bombas
  fill(255, 128, 0);
  textAlign(CENTER, CENTER);
  for (let b of falling) text("!", b.x, b.y);

  drawHUD();
  drawAbilitiesHUD();
}

/* === HUD + BOTÃO PAUSE/PLAY === */
function drawHUD() {
  push();
  fill(0, 180);
  rectMode(CORNER);
  let hudHeight = isMobile ? 70 : 50;
  rect(0, 0, width, hudHeight);

  let hpBarWidth = isMobile ? 300 : 200;
  let hpBarHeight = isMobile ? 24 : 16;
  let hpRatio = player.hp / 5;

  fill(120, 0, 0);
  rect(20, hudHeight / 2 - hpBarHeight / 2, hpBarWidth, hpBarHeight);
  fill(255, 0, 0);
  rect(20, hudHeight / 2 - hpBarHeight / 2, hpBarWidth * hpRatio, hpBarHeight);
  stroke(255);
  noFill();
  rect(20, hudHeight / 2 - hpBarHeight / 2, hpBarWidth, hpBarHeight);

  noStroke();
  fill(255);
  textSize(isMobile ? 22 : 14);
  textAlign(LEFT, CENTER);
  text("XP: " + player.xp, hpBarWidth + 40, hudHeight / 2);
  text("Level: " + player.level, hpBarWidth + 140, hudHeight / 2);
  text("Round: " + roundNumber, hpBarWidth + 260, hudHeight / 2);

  textAlign(RIGHT, CENTER);
  textSize(isMobile ? 26 : 16);
  text("Tempo: " + ceil(roundTimer), width - 90, hudHeight / 2);

  // botão pause/play no canto direito
  pauseButton.w = isMobile ? 60 : 40;
  pauseButton.h = isMobile ? 60 : 40;
  pauseButton.x = width - pauseButton.w - 10;
  pauseButton.y = 5;

  fill(80, 80, 80, 200);
  rect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h, 10);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(isMobile ? 28 : 20);
  if (gameState === "paused") text("▶", pauseButton.x + pauseButton.w / 2, pauseButton.y + pauseButton.h / 2);
  else text("⏸", pauseButton.x + pauseButton.w / 2, pauseButton.y + pauseButton.h / 2);

  pop();
}

function drawAbilitiesHUD() {
  let startX = 20;
  let startY = isMobile ? 100 : 60;
  let gap = isMobile ? 70 : 50;

  textAlign(CENTER, CENTER);
  textSize(isMobile ? 42 : 28);

  for (let i = 0; i < abilities.length; i++) {
    let ab = abilities[i];
    let symbol = "?";
    if (ab.id === 1) symbol = "➖";
    if (ab.id === 2) symbol = "➕";
    if (ab.id === 3) symbol = "🌀";
    if (ab.id === 4) symbol = "💣";
    if (ab.id === 5) symbol = "🏃";
    if (ab.id === 6) symbol = "⚡";
    if (ab.id === 7) symbol = "🎯";
    if (ab.id === 8) symbol = "💥";
    if (ab.id === 9) symbol = "⇔";

    fill(255);
    text(symbol, startX + i * gap, startY);

    textSize(isMobile ? 20 : 12);
    fill(255, 255, 0);
    text("Lv" + ab.level, startX + i * gap, startY + (isMobile ? 40 : 20));

    textSize(isMobile ? 42 : 28);
  }
}

/* === OVERLAY DE PAUSE === */
function drawPauseOverlay() {
  push();
  
  textAlign(CENTER, CENTER);
  textSize(isMobile ? 36 : 26);
  text("PAUSADO\nToque/clica no ▶ para voltar ou pressione P", width / 2, height / 2);
  pop();
}

/* === JOYSTICK VIRTUAL (mobile) === */
function drawJoystick() {
  if (!joystick.active) return;
  stroke(255);
  noFill();
  ellipse(joystick.baseX, joystick.baseY, 100, 100);
  fill(255, 100);
  noStroke();
  ellipse(joystick.stickX, joystick.stickY, 60, 60);
}

/* === INPUT UNIFICADO (mouse/touch) === */
function handlePointerPressed(px, py) {
  // Menu / Game Over
  if (gameState === "menu") { gameState = "playing"; return true; }
  if (gameState === "gameover") { resetGame(); gameState = "playing"; return true; }

  // Botão pause/play (funciona nos dois estados)
  if (
    px > pauseButton.x &&
    px < pauseButton.x + pauseButton.w &&
    py > pauseButton.y &&
    py < pauseButton.y + pauseButton.h
  ) {
    gameState = (gameState === "paused") ? "playing" : "paused";
    return true;
  }

  // Level Up: clique na caixa escolhe habilidade
  if (gameState === "levelup") {
    for (let box of levelUpBoxes) {
      if (px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h) {
        applyAbility(box.id);
        return true;
      }
    }
  }

  return false; // não foi consumido
}

function mousePressed() {
  handlePointerPressed(mouseX, mouseY);
}

function touchStarted() {
  if (touches.length === 0) return false;
  const px = touches[0].x, py = touches[0].y;
  const consumed = handlePointerPressed(px, py);
  if (!consumed && gameState === "playing") {
    // ativa joystick só se não clicou em UI
    joystick.active = true;
    joystick.baseX = px;
    joystick.baseY = py;
    joystick.stickX = px;
    joystick.stickY = py;
  }
  return false;
}

function touchMoved() {
  if (joystick.active && touches.length > 0) {
    joystick.stickX = touches[0].x;
    joystick.stickY = touches[0].y;
  }
  return false;
}

function touchEnded() {
  joystick.active = false;
  return false;
}

/* === TECLADO === */
function keyPressed() {
  // Toggle pause pelo P
  if (key === 'p' || key === 'P') {
    if (gameState === "playing") gameState = "paused";
    else if (gameState === "paused") gameState = "playing";
  }

  if (gameState === "menu" && keyCode === ENTER) {
    gameState = "playing";
  } else if (gameState === "gameover" && keyCode === ENTER) {
    resetGame();
    gameState = "playing";
  } else if (gameState === "levelup") {
    if (key === "1" && choices[0] != null) applyAbility(choices[0]);
    if (key === "2" && choices[1] != null) applyAbility(choices[1]);
    if (key === "3" && choices[2] != null) applyAbility(choices[2]);
  }
}

/* === LEVEL UP (overlay clicável e por teclado) === */
function drawLevelUp() {
  fill(0, 180);
  rectMode(CORNER);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(isMobile ? 32 : 20);
  text("Você subiu de nível! Escolha uma habilidade:", width / 2, 150);

  // caixas dimensionadas para mobile/desktop
  let boxWidth = min(width * 0.85, isMobile ? 640 : 520);
  let boxHeight = isMobile ? 100 : 60;
  let startY = height * 0.35;
  let gap = isMobile ? 50 : 30;

  levelUpBoxes = []; // recalcula cada frame

  for (let i = 0; i < choices.length; i++) {
    let id = choices[i];
    let ability = getAbility(id);
    let lvl = ability ? ability.level : 0;
    let extra = ability ? " (lvl " + lvl + ")" : "";

    let cx = width / 2;
    let cy = startY + i * (boxHeight + gap);

    // fundo da caixa
    fill(50, 100, 200);
    rectMode(CENTER);
    rect(cx, cy, boxWidth, boxHeight, 12);

    // texto
    fill(255);
    textSize(isMobile ? 26 : 18);
    textAlign(CENTER, CENTER);
    text("(" + (i + 1) + ") " + allAbilities[id] + extra, cx, cy);

    // salva hitbox
    levelUpBoxes.push({
      id,
      x: cx - boxWidth / 2,
      y: cy - boxHeight / 2,
      w: boxWidth,
      h: boxHeight
    });
  }

  fill(255);
  textSize(isMobile ? 22 : 14);
  textAlign(CENTER, TOP);
  text("Toque/clica na caixa ou pressione 1, 2 ou 3", width / 2, startY + choices.length * (boxHeight + gap));
}

/* ===================== INIMIGOS ===================== */

function spawnEnemy() {
  // escolhe letra aleatória (sem 'f')
  const letter = random(enemyLetters);
  const variant = floor(random(2)); // 0 ou 1
  const img = enemyImgs[letter][variant];

  // posição segura (não spawna em cima do player)
  let ex, ey;
  do {
    ex = random(width);
    ey = random(height);
  } while (dist(ex, ey, player.x, player.y) < SAFE_SPAWN_DIST);

  // decide se é boss (se estiver marcado depois de 35 kills)
  const isBoss = spawnBossNext;
  if (isBoss) spawnBossNext = false;

  enemies.push({
    x: ex,
    y: ey,
    img: img,
    size: isBoss ? BOSS_SIZE : NORMAL_SIZE,
    isBoss: isBoss,
    hp: isBoss ? BOSS_HP : 1,
    maxHp: isBoss ? BOSS_HP : 1,
    speed: 100 + random(-20, 20) // escalará por getSpeedScale() no update
  });
}

// quando um inimigo morre
function killEnemyAtIndex(index) {
  const e = enemies[index];
  stars.push({ x: e.x, y: e.y });
  enemies.splice(index, 1);

  killsTotal++;
  killsSinceBoss++;
  if (killsSinceBoss >= 35) {
    spawnBossNext = true; // próximo spawn vira boss
    killsSinceBoss = 0;
  }
}

/* === TIROS: mira no inimigo mais próximo === */
function fireAllBullets() {
  fireBullet("•", { pierce: getPierceCount(), speedMul: 1 });

  for (let a of abilities) {
    let id = a.id, lvl = a.level;
    if (id === 1) fireBullet("➖", { pierce: getPierceCount(), speedMul: 1 + 0.25 * lvl });
    if (id === 2) fireBullet("➕", { pierce: getPierceCount(), speedMul: 1 + 0.35 * lvl });
    if (id === 8) fireBullet("•", { pierce: getPierceCount(), explosion: 20 + 10 * lvl });
    if (id === 9) {
      let pairs = min(3, lvl);
      for (let p = 1; p <= pairs; p++) {
        let angle = 0.3 * p;
        fireBullet("•", { pierce: getPierceCount(), angleOffset: angle });
        fireBullet("•", { pierce: getPierceCount(), angleOffset: -angle });
      }
    }
  }
}

function getClosestEnemy() {
  if (enemies.length === 0) return null;
  let closest = enemies[0];
  let minDist = dist(player.x, player.y, closest.x, closest.y);
  for (let i = 1; i < enemies.length; i++) {
    let d = dist(player.x, player.y, enemies[i].x, enemies[i].y);
    if (d < minDist) {
      minDist = d;
      closest = enemies[i];
    }
  }
  return closest;
}

function fireBullet(char, params = {}) {
  let target = getClosestEnemy();
  let dx, dy;

  if (target) {
    dx = target.x - player.x;
    dy = target.y - player.y;
  } else {
    dx = 1; // fallback: direita
    dy = 0;
  }

  let distVal = sqrt(dx * dx + dy * dy);
  if (distVal === 0) distVal = 0.0001;
  dx /= distVal;
  dy /= distVal;

  if (params.angleOffset) {
    let ang = atan2(dy, dx) + params.angleOffset;
    dx = cos(ang);
    dy = sin(ang);
  }

  bullets.push({
    x: player.x,
    y: player.y,
    dx: dx,
    dy: dy,
    speed: 300 * (params.speedMul || 1),
    remainingPierce: params.pierce || 0,
    explosion: params.explosion || null
  });
}

/* === EXPLOSÃO: dano em área === */
function explodeAt(x, y, radius) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    if (dist(x, y, e.x, e.y) <= radius) {
      e.hp -= EXPLOSION_DAMAGE;
      if (e.hp <= 0) killEnemyAtIndex(i);
    }
  }
}

/* === XP / LEVEL UP === */
function addXP(amount) {
  player.xp += amount;
  let need = player.level * 5;
  if (player.xp >= need) {
    player.xp -= need;
    player.level++;
    openLevelUp();
  }
}

function openLevelUp() {
  choices = [];
  let pool = Object.keys(allAbilities).map(n => parseInt(n));
  for (let i = 0; i < 3; i++) {
    if (pool.length === 0) break;
    let idx = floor(random(pool.length));
    choices.push(pool[idx]);
    pool.splice(idx, 1);
  }
  gameState = "levelup";
}

function applyAbility(id) {
  let ability = getAbility(id);
  if (ability) {
    ability.level++;
  } else if (abilities.length < 6) {
    abilities.push({ id: id, level: 1 });
    if (id === 3) orbs.push({ angle: 0, hitCD: 0 }); // NEW: orb com cooldown
  }

  if (id === 5) player.speed += 30;
  if (id === 6) player.fireRate = max(0.05, player.fireRate - 0.05);
  if (id === 3) {
    let lvl = getAbility(3).level;
    while (orbs.length < min(3, lvl)) orbs.push({ angle: 0, hitCD: 0 });
  }

  gameState = "playing";
}

function getAbility(id) {
  return abilities.find(a => a.id === id);
}

function getPierceCount() {
  let ab = getAbility(7);
  return ab ? ab.level : 0;
}
