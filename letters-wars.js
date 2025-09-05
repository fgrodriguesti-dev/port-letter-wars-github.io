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
    size: 20, // usado para colisão
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
    text("LETTER WARS JS\nPressione ENTER para começar", width / 2, height / 2);
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
    drawGame();      // mostra o jogo como estava
    drawLevelUp();   // mostra as opções
    return;          // NÃO atualiza a lógica do jogo
  }

  if (gameState === "playing") {
    updateGame();
    drawGame();
  }
}

function updateGame() {
  let dt = deltaTime / 1000;

  // Movimento do jogador
  if (keyIsDown(87)) player.y -= player.speed * dt; // W
  if (keyIsDown(83)) player.y += player.speed * dt; // S
  if (keyIsDown(65)) player.x -= player.speed * dt; // A
  if (keyIsDown(68)) player.x += player.speed * dt; // D

  // Spawn inimigos
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = 1;
  }

  // Tiros
  fireTimer -= dt;
  if (fireTimer <= 0) {
    fireAllBullets();
    fireTimer = player.fireRate;
  }

  // Orbs
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

  // Bombas
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

  // Inimigos
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

  // Balas
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

  // Coletar estrelas (XP)
  for (let i = stars.length - 1; i >= 0; i--) {
    if (dist(player.x, player.y, stars[i].x, stars[i].y) < player.size) {
      addXP(1);
      stars.splice(i, 1);
    }
  }

  // Timer rodada
  roundTimer -= dt;
  if (roundTimer <= 0) {
    roundTimer = roundTime;
    enemies = [];
  }
}

function drawGame() {
  // Player (imagem)
  imageMode(CENTER);
  image(playerImg, player.x, player.y, 40, 40);

  // Inimigos
  fill(255);
  textSize(16);
  for (let e of enemies) text(e.letter, e.x, e.y);

  // Balas
  fill(255, 200, 0);
  for (let b of bullets) ellipse(b.x, b.y, 6);

  // Estrelas
  fill(255, 255, 0);
  for (let s of stars) text("*", s.x, s.y);

  // Orbs
  fill(255, 255, 0);
  for (let orb of orbs) text("@", orb.x, orb.y);

  // Bombas
  fill(255, 128, 0);
  for (let b of falling) text("!", b.x, b.y);

  // HUD
  fill(255);
  textSize(14);
  textAlign(LEFT);
  text("HP: " + player.hp, 10, 20);
  text("XP: " + player.xp, 10, 40);
  text("Level: " + player.level, 10, 60);
  text("Tempo: " + ceil(roundTimer), 10, 80);
  text("Habilidades:", 10, 100);
  for (let i = 0; i < abilities.length; i++) {
    text(abilities[i].id + ":" + abilities[i].level, 10, 120 + i * 16);
  }
}

function drawLevelUp() {
  fill(255);
  textAlign(CENTER);
  textSize(16);
  text("Você subiu de nível! Escolha uma habilidade:", width / 2, 200);

  for (let i = 0; i < choices.length; i++) {
    let id = choices[i];
    let ability = getAbility(id);
    let lvl = ability ? ability.level : 0;
    let extra = ability ? " (já tem lvl " + lvl + ")" : "";
    text("(" + (i + 1) + ") " + allAbilities[id] + extra, width / 2, 240 + i * 30);
  }
}

function spawnEnemy() {
  enemies.push({
    x: random(width),
    y: random(height),
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
  } else if (gameState === "playing" && key === "p") {
    gameState = "paused";
  } else if (gameState === "paused" && key === "p") {
    gameState = "playing";
  }
}
