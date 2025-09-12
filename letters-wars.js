let player;
let enemies = [];
let bullets = [];
let stars = [];
let abilities = [];
let orbs = [];
let falling = [];

let playerImg; // imagem do jogador

let gameState = "menu"; // menu / playing / levelup / gameover / paused
let choices = [];

let roundTime = 30;
let roundTimer = roundTime;
let spawnTimer = 0;
let fireTimer = 0;
let fallingTimer = 15;

let roundNumber = 1; // contador de rounds

let allAbilities = {
  1: "Tiro '-' (mais rápido por nível)",
  2: "Tiro '+' (mais rápido por nível)",
  3: "Orb '@' orbitando (raio/velocidade sobem)",
  4: "Bomba '!' caída (intervalo menor por nível)",
  5: "Velocidade do jogador (+spd por nível)",
  6: "Taxa de tiro (intervalo menor por nível)",
  7: "Tiros penetram (mais acertos por nível)",
  8: "Explosão ao matar (raio maior por nível)",
  9: "Tiros laterais (ângulo maior por nível)"
};

function preload() {
  playerImg = loadImage('player.png'); // coloque player.png na mesma pasta
}

function setup() {
  createCanvas(800, 600);
  resetGame();
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
}

function draw() {
  background(30);

  if (!playerImg) {
    fill(255);
    textAlign(CENTER);
    textSize(24);
    text("Carregando imagem...", width / 2, height / 2);
    return;
  }

  if (gameState === "menu") {
    fill(255);
    textAlign(CENTER);
    textSize(24);
    text("LETTER WARS \nPressione ENTER para começar", width / 2, height / 2);
    return;
  }

  if (gameState === "gameover") {
    fill(255);
    textAlign(CENTER);
    textSize(24);
    text("GAME OVER\nPressione ENTER para tentar novamente", width / 2, height / 2);
    text("Level alcançado: " + player.level, width / 2, height / 2 + 50);
    return;
  }

  if (gameState === "paused") {
    fill(255);
    textAlign(CENTER);
    textSize(24);
    text("PAUSADO\nPressione P para continuar", width / 2, height / 2);
    return;
  }

  if (gameState === "levelup") {
    drawGame();
    drawLevelUp();
    return;
  }

  if (gameState === "playing") {
    updateGame();
    drawGame();
  }
}

function updateGame() {
  let dt = deltaTime / 1000;

  if (keyIsDown(87)) player.y -= player.speed * dt;
  if (keyIsDown(83)) player.y += player.speed * dt;
  if (keyIsDown(65)) player.x -= player.speed * dt;
  if (keyIsDown(68)) player.x += player.speed * dt;

  // Impede sair do mapa
  player.x = constrain(player.x, player.size, width - player.size);
  player.y = constrain(player.y, player.size, height - player.size);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = 1;
  }

  fireTimer -= dt;
  if (fireTimer <= 0) {
    fireAllBullets();
    fireTimer = player.fireRate;
  }

  for (let orb of orbs) {
    let ability = getAbility(3);
    let lvl = ability ? ability.level : 0;
    let radius = 30 + lvl * 10;
    let speed = 2 + lvl * 0.5;

    orb.angle += speed * dt;
    orb.x = player.x + cos(orb.angle) * radius;
    orb.y = player.y + sin(orb.angle) * radius;

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (dist(orb.x, orb.y, enemies[i].x, enemies[i].y) < 15) {
        stars.push({ x: enemies[i].x, y: enemies[i].y });
        enemies.splice(i, 1);
      }
    }
  }

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
          stars.push({ x: enemies[j].x, y: enemies[j].y });
          enemies.splice(j, 1);
        }
      }
      falling.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let distVal = sqrt(dx * dx + dy * dy);
    if (distVal > 0) {
      e.x += (dx / distVal) * e.speed * dt;
      e.y += (dy / distVal) * e.speed * dt;
    }
    if (distVal < player.size) {
      player.hp -= 1;
      enemies.splice(i, 1);
      if (player.hp <= 0) gameState = "gameover";
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;

    if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
      bullets.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j--) {
      let e = enemies[j];
      if (dist(b.x, b.y, e.x, e.y) < 15) {
        stars.push({ x: e.x, y: e.y });
        enemies.splice(j, 1);

        if (b.explosion) explodeAt(e.x, e.y, b.explosion);

        if (b.remainingPierce > 0) {
          b.remainingPierce--;
        } else {
          bullets.splice(i, 1);
        }
        break;
      }
    }
  }

  for (let i = stars.length - 1; i >= 0; i--) {
    if (dist(player.x, player.y, stars[i].x, stars[i].y) < player.size) {
      addXP(1);
      stars.splice(i, 1);
    }
  }

  roundTimer -= dt;
  if (roundTimer <= 0) {
    roundTimer = roundTime;
    enemies = [];
    roundNumber++;
  }
}

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
      if ((x + y) % 200 === 0) {
        fill(baseR, baseG, baseB);
      } else {
        fill(baseR * 0.6, baseG * 0.6, baseB * 0.6);
      }
      rect(x, y, tileSize, tileSize);
    }
  }
  pop();
}

function drawGame() {
  drawMapScrolling();

  imageMode(CENTER);
  image(playerImg, player.x, player.y, 40, 40);

  fill(255);
  textSize(16);
  for (let e of enemies) text(e.letter, e.x, e.y);

  fill(255, 200, 0);
  for (let b of bullets) ellipse(b.x, b.y, 6);

  fill(255, 255, 0);
  for (let s of stars) text("*", s.x, s.y);

  fill(255, 255, 0);
  for (let orb of orbs) text("@", orb.x, orb.y);

  fill(255, 128, 0);
  for (let b of falling) text("!", b.x, b.y);

  // HUD estilo Castlevania
  drawHUD();
  drawAbilitiesHUD();
}

function drawHUD() {
  push();

  // fundo translúcido
  fill(0, 180);
  rectMode(CORNER);
  rect(0, 0, width, 50);

  // Barra de HP
  let hpBarWidth = 200;
  let hpBarHeight = 16;
  let hpRatio = player.hp / 5; // assume HP máximo = 5

  fill(120, 0, 0);
  rect(20, 20, hpBarWidth, hpBarHeight);

  fill(255, 0, 0);
  rect(20, 20, hpBarWidth * hpRatio, hpBarHeight);

  stroke(255);
  noFill();
  rect(20, 20, hpBarWidth, hpBarHeight);

  noStroke();
  fill(255);
  textSize(14);

  // XP, Level, Round
  textAlign(LEFT, CENTER);
  text("XP: " + player.xp, 240, 28);
  text("Level: " + player.level, 320, 28);
  text("Round: " + roundNumber, 420, 28);

  // Tempo no canto direito
  textAlign(RIGHT, CENTER);
  textSize(16);
  text("Tempo: " + ceil(roundTimer), width - 20, 28);

  pop();
}

function drawAbilitiesHUD() {
  let startX = 20;
  let startY = 60; // logo abaixo do HUD
  let gap = 50;

  textAlign(CENTER, CENTER);
  textSize(28); // ícones maiores

  for (let i = 0; i < abilities.length; i++) {
    let ab = abilities[i];

    // define símbolo
    let symbol = "?";
    if (ab.id === 1) symbol = "➖";
    if (ab.id === 2) symbol = "➕";
    if (ab.id === 3) symbol = "⚪";
    if (ab.id === 4) symbol = "💣";
    if (ab.id === 5) symbol = "🏃";
    if (ab.id === 6) symbol = "⚡";
    if (ab.id === 7) symbol = "🎯";
    if (ab.id === 8) symbol = "💥";
    if (ab.id === 9) symbol = "⇔";

    // desenha o ícone
    fill(255);
    text(symbol, startX + i * gap, startY);

    // desenha nível embaixo
    textSize(12);
    fill(255, 255, 0);
    text("Lv" + ab.level, startX + i * gap, startY + 20);

    textSize(28); // volta para ícones
  }
}



function drawLevelUp() {
  fill(0, 180);
  rectMode(CORNER);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(20);
  text("Você subiu de nível! Escolha uma habilidade:", width / 2, 150);

  let boxWidth = 500;
  let boxHeight = 60;
  let startY = 220;
  let gap = 30;

  for (let i = 0; i < choices.length; i++) {
    let id = choices[i];
    let ability = getAbility(id);
    let lvl = ability ? ability.level : 0;
    let extra = ability ? " (lvl " + lvl + ")" : "";

    fill(50, 100, 200);
    rectMode(CENTER);
    rect(width / 2, startY + i * (boxHeight + gap), boxWidth, boxHeight, 12);

    fill(255);
    textSize(18);
    textAlign(CENTER, CENTER);
    text(
      "(" + (i + 1) + ") " + allAbilities[id] + extra,
      width / 2,
      startY + i * (boxHeight + gap)
    );
  }

  fill(255);
  textSize(14);
  textAlign(CENTER, TOP);
  text("Pressione 1, 2 ou 3 para escolher", width / 2, startY + choices.length * (boxHeight + gap));
}

function spawnEnemy() {
  let ex, ey;
  let safeDist = 100;
  do {
    ex = random(width);
    ey = random(height);
  } while (dist(ex, ey, player.x, player.y) < safeDist);

  enemies.push({
    x: ex,
    y: ey,
    letter: String.fromCharCode(65 + floor(random(26))),
    speed: 100 + random(-20, 20)
  });
}

function fireAllBullets() {
  fireBullet("•", { pierce: getPierceCount(), speedMul: 1 });

  for (let a of abilities) {
    let id = a.id, lvl = a.level;
    if (id === 1) fireBullet("-", { pierce: getPierceCount(), speedMul: 1 + 0.25 * lvl });
    if (id === 2) fireBullet("+", { pierce: getPierceCount(), speedMul: 1 + 0.35 * lvl });
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

function fireBullet(char, params = {}) {
  let dx = mouseX - player.x;
  let dy = mouseY - player.y;
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

function explodeAt(x, y, radius) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (dist(x, y, enemies[i].x, enemies[i].y) <= radius) {
      stars.push({ x: enemies[i].x, y: enemies[i].y });
      enemies.splice(i, 1);
    }
  }
}

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
    if (id === 3) orbs.push({ angle: 0 });
  }

  if (id === 5) player.speed += 30;
  if (id === 6) player.fireRate = max(0.05, player.fireRate - 0.05);
  if (id === 3) {
    let lvl = getAbility(3).level;
    while (orbs.length < min(3, lvl)) orbs.push({ angle: 0 });
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

function keyPressed() {
  if (gameState === "menu" && keyCode === ENTER) {
    gameState = "playing";
  } else if (gameState === "gameover" && keyCode === ENTER) {
    resetGame();
    gameState = "playing";
  } else if (gameState === "levelup") {
    if (key === "1" && choices[0]) applyAbility(choices[0]);
    if (key === "2" && choices[1]) applyAbility(choices[1]);
    if (key === "3" && choices[2]) applyAbility(choices[2]);
  } else if (gameState === "playing" && (key === "p" || key === "P")) {
    gameState = "paused";
  } else if (gameState === "paused" && (key === "p" || key === "P")) {
    gameState = "playing";
  }
}

