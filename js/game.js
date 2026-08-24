/* ============================================================================
   Pony Adventure – Stub (v0.1)

   Ein kleines Endless-Runner-Spiel: Das Pony läuft von ganz allein, der
   Spieler springt über Hindernisse (Steine, Zäune, Löcher) und sammelt Münzen.
   Die Münzen wandern nach jedem Lauf ins "Sparschwein" (localStorage) und
   sollen später im Shop gegen Material getauscht werden.

   Aufbau dieser Datei:
     1. Einstellungen         5. Spiellogik (Spawner, Physik, Kollisionen)
     2. Bilder laden          6. Zeichnen
     3. Spielzustand          7. Bildschirme (Titel, Game Over, Shop)
     4. Eingabe               8. Hauptschleife
   ============================================================================ */
(() => {
  'use strict';

  /* ---------- 1. Einstellungen ---------------------------------------- */
  const W = 960, H = 540;        // interne Auflösung (wird per CSS skaliert)
  const GROUND_Y = 440;          // Oberkante des Bodens
  const GRAVITY = 2400;          // px/s²
  const JUMP_VELOCITY = -860;    // Absprung (negativ = nach oben)
  const JUMP_CUT = -300;         // Taste früh loslassen → kürzerer Sprung
  const BASE_SPEED = 320;        // Laufgeschwindigkeit am Anfang (px/s)
  const MAX_SPEED = 620;
  const PX_PER_METER = 40;       // für die Streckenanzeige
  const SAVE_KEY = 'ponyAdventure.save.v1';
  const DEBUG = location.search.includes('debug');   // ?debug zeigt Hitboxen

  const OBSTACLE_TYPES = {
    rock:  { w: 64, h: 46 },
    fence: { w: 66, h: 56 },
  };

  /* ---------- 2. Bilder laden ------------------------------------------ */
  const ASSETS = {
    ponyRun1: 'assets/pony_run1.svg',
    ponyRun2: 'assets/pony_run2.svg',
    ponyJump: 'assets/pony_jump.svg',
    coin:     'assets/coin.svg',
    rock:     'assets/rock.svg',
    fence:    'assets/fence.svg',
  };
  const images = {};
  for (const [name, src] of Object.entries(ASSETS)) {
    images[name] = new Image();
    images[name].src = src;
  }
  const isReady = (img) => img.complete && img.naturalWidth > 0;

  /* ---------- 3. Spielzustand ------------------------------------------ */
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const el = (id) => document.getElementById(id);

  let state = 'title';           // 'title' | 'playing' | 'dying' | 'dead'
  let cameraX = 0;               // wie weit die Welt nach links gescrollt ist (px)
  let speed = BASE_SPEED;
  let time = 0;                  // Gesamtzeit, für Animationen
  let runCoins = 0;              // Münzen im aktuellen Lauf
  let deathCause = null;         // 'bump' (Hindernis) | 'fall' (Loch)
  let dyingTimer = 0;
  let deadSince = 0;

  const pony = {
    x: 150, y: 0, w: 117, h: 90,
    vx: 0, vy: 0,
    onGround: true, falling: false,
    angle: 0, frame: 0, frameTimer: 0,
  };
  let obstacles = [];            // { type, x, w, h }   (x = Welt-Koordinate)
  let holes = [];                // { x, w }
  let coins = [];                // { x, y, r, taken }
  let effects = [];              // { x, y, text, t }   (z.B. "+1" beim Einsammeln)
  let spawnX = 0;                // Welt-x, ab der das nächste Muster erzeugt wird

  let save = loadSave();         // { wallet, best } – bleibt im Browser gespeichert
  function loadSave() {
    try { return Object.assign({ wallet: 0, best: 0 }, JSON.parse(localStorage.getItem(SAVE_KEY))); }
    catch (e) { return { wallet: 0, best: 0 }; }
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* z.B. privater Modus */ }
  }

  // kleine Helfer
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const meters = () => Math.floor(cameraX / PX_PER_METER);

  /* ---------- 4. Eingabe ------------------------------------------------ */
  function pressJump() {
    if (currentScreen === 'shop') return;
    if (state === 'title') return startGame();
    if (state === 'dead') { if (time - deadSince > 0.5) startGame(); return; }
    if (state === 'playing' && pony.onGround) {
      pony.vy = JUMP_VELOCITY;
      pony.onGround = false;
    }
  }
  function releaseJump() {
    // Wird die Taste früh losgelassen, endet der Sprung früher (kleiner Hüpfer)
    if (state === 'playing' && pony.vy < JUMP_CUT) pony.vy = JUMP_CUT;
  }
  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  window.addEventListener('keydown', (e) => {
    if (!JUMP_KEYS.includes(e.code)) return;
    e.preventDefault();
    if (!e.repeat) pressJump();
  });
  window.addEventListener('keyup', (e) => { if (JUMP_KEYS.includes(e.code)) releaseJump(); });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); pressJump(); });
  window.addEventListener('pointerup', releaseJump);

  /* ---------- 5. Spiellogik --------------------------------------------- */
  function resetWorld() {
    cameraX = 0; speed = BASE_SPEED; runCoins = 0;
    obstacles = []; holes = []; coins = []; effects = [];
    Object.assign(pony, {
      x: 150, y: GROUND_Y - pony.h, vx: 0, vy: 0,
      onGround: true, falling: false, angle: 0, frame: 0, frameTimer: 0,
    });
    spawnX = W + 400;            // die ersten Meter bleiben frei
    spawnPatterns();
  }

  function startGame() {
    if (state === 'playing' || state === 'dying') return;
    resetWorld();
    state = 'playing';
    showScreen(null);
  }

  function die(cause) {
    state = 'dying';
    deathCause = cause;
    dyingTimer = 0;
    speed = 0;
    if (cause === 'bump') {                  // vom Hindernis abprallen
      pony.vy = -460; pony.vx = -260; pony.onGround = false;
    } else {                                 // ins Loch fallen
      pony.falling = true; pony.vx = 140; pony.vy = Math.max(pony.vy, 0);
    }
  }

  function gameOver() {
    state = 'dead';
    deadSince = time;
    save.wallet += runCoins;
    save.best = Math.max(save.best, meters());
    writeSave();
    el('dead-stats').innerHTML =
      `Strecke: <strong>${meters()} m</strong> · Münzen: <strong>${runCoins}</strong> 🪙<br>` +
      `<span class="stats">Beste Strecke: ${save.best} m · Münzen gesamt: ${save.wallet} 🪙</span>`;
    showScreen('dead');
  }

  // --- Spawner: erzeugt Hindernisse, Löcher und Münzen vor dem Pony -------
  const difficulty = () => (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);   // 0..1

  function spawnPatterns() {
    while (spawnX < cameraX + W + 300) {
      const r = Math.random();
      let len;
      if (r < 0.35)      len = spawnObstacle(spawnX);
      else if (r < 0.60) len = spawnHole(spawnX);
      else if (r < 0.80) len = spawnCoinLine(spawnX);
      else               len = spawnCoinArc(spawnX);
      // Abstand zum nächsten Muster – wird mit dem Tempo etwas größer
      spawnX += len + rand(260, 460) + difficulty() * 220;
    }
  }

  function addCoin(x, y) { coins.push({ x, y, r: 16, taken: false }); }

  function spawnObstacle(x) {
    const type = pick(['rock', 'rock', 'fence']);
    const { w, h } = OBSTACLE_TYPES[type];
    obstacles.push({ type, x, w, h });
    if (Math.random() < 0.6) {               // Münzbogen über dem Hindernis
      addCoin(x - 24,     GROUND_Y - h - 56);
      addCoin(x + w / 2,  GROUND_Y - h - 84);
      addCoin(x + w + 24, GROUND_Y - h - 56);
    }
    return w;
  }

  function spawnHole(x) {
    const w = Math.round(rand(90, 110 + difficulty() * 50));
    holes.push({ x, w });
    if (Math.random() < 0.6) {
      for (let i = 0; i < 3; i++) addCoin(x + w * (0.25 + 0.25 * i), GROUND_Y - 100);
    }
    return w;
  }

  function spawnCoinLine(x) {
    const n = 5, gap = 44;
    for (let i = 0; i < n; i++) addCoin(x + i * gap, GROUND_Y - 48);
    return (n - 1) * gap;
  }

  function spawnCoinArc(x) {
    const n = 7, gap = 42;
    for (let i = 0; i < n; i++) {
      addCoin(x + i * gap, GROUND_Y - 44 - Math.sin(i / (n - 1) * Math.PI) * 115);
    }
    return (n - 1) * gap;
  }

  function cleanup() {
    const minX = cameraX - 200;
    obstacles = obstacles.filter(o => o.x + o.w > minX);
    holes = holes.filter(h => h.x + h.w > minX);
    coins = coins.filter(c => !c.taken && c.x + c.r > minX);
  }

  // --- Kollisionen ---------------------------------------------------------
  function ponyHitbox() {
    // etwas kleiner als das Bild, damit es sich fair anfühlt
    return { x: pony.x + 26, y: pony.y + 14, w: pony.w - 44, h: pony.h - 14 };
  }
  function obstacleHitbox(o) {
    return { x: o.x - cameraX + 8, y: GROUND_Y - o.h + 8, w: o.w - 16, h: o.h - 8 };
  }

  function checkCollisions() {
    const hb = ponyHitbox();
    for (const o of obstacles) {
      if (overlap(hb, obstacleHitbox(o))) return die('bump');
    }
    if (pony.onGround) {
      const footX = pony.x + pony.w * 0.45;          // Mitte zwischen den Hufen
      for (const h of holes) {
        const hx = h.x - cameraX;
        if (footX > hx + 12 && footX < hx + h.w - 12) return die('fall');
      }
    }
    for (const c of coins) {
      if (c.taken) continue;
      const cx = c.x - cameraX;
      if (overlap(hb, { x: cx - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 })) {
        c.taken = true;
        runCoins++;
        effects.push({ x: c.x, y: c.y, text: '+1', t: 0 });
      }
    }
  }

  // --- Ein Simulationsschritt (dt in Sekunden) -----------------------------
  function update(dt) {
    time += dt;
    for (const e of effects) e.t += dt;
    effects = effects.filter(e => e.t < 0.7);

    if (state === 'title' || state === 'dead') return;

    if (state === 'playing') {
      speed = Math.min(MAX_SPEED, BASE_SPEED + cameraX * 0.012);   // wird langsam schneller
      cameraX += speed * dt;
    }

    // Pony-Physik
    pony.vy += GRAVITY * dt;
    pony.y += pony.vy * dt;
    pony.x += pony.vx * dt;
    if (!pony.falling && pony.y + pony.h >= GROUND_Y) {
      if (!pony.onGround && state === 'dying') pony.vx = 0;   // nach dem Abprallen liegen bleiben
      pony.y = GROUND_Y - pony.h;
      pony.vy = 0;
      pony.onGround = true;
    } else {
      pony.onGround = false;
    }

    if (state === 'playing') {
      // Laufanimation: schneller laufen = schneller trippeln
      if (pony.onGround) {
        pony.frameTimer += dt * speed / BASE_SPEED;
        if (pony.frameTimer > 0.13) { pony.frameTimer = 0; pony.frame = 1 - pony.frame; }
      }
      // in der Luft leicht neigen (Nase hoch beim Steigen, runter beim Fallen)
      const target = pony.onGround ? 0 : clamp(pony.vy / 2600, -0.25, 0.3);
      pony.angle += (target - pony.angle) * Math.min(1, dt * 12);

      spawnPatterns();
      checkCollisions();
      cleanup();
    } else if (state === 'dying') {
      dyingTimer += dt;
      if (deathCause === 'fall') pony.angle += dt * 2.5;
      else if (!pony.onGround) pony.angle -= dt * 7;
      if (dyingTimer > 1.0 || pony.y > H + 60) gameOver();
    }
  }

  /* ---------- 6. Zeichnen ------------------------------------------------ */
  const skyGradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGradient.addColorStop(0, '#7ec8ff');
  skyGradient.addColorStop(1, '#dff4ff');
  const holeGradient = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  holeGradient.addColorStop(0, '#5a3b22');
  holeGradient.addColorStop(1, '#1a100a');

  // Zeichnet ein Bild – oder ein pinkes Rechteck, falls es (noch) nicht geladen ist
  function drawSprite(name, x, y, w, h) {
    const img = images[name];
    if (isReady(img)) ctx.drawImage(img, x, y, w, h);
    else { ctx.fillStyle = '#e0e'; ctx.fillRect(x, y, w, h); }
  }

  function draw() {
    drawSky();
    drawClouds();
    drawHills();
    drawGround();
    drawCoins();
    drawObstacles();
    drawPony();
    drawEffects();
    drawHUD();
    if (DEBUG) drawDebug();
  }

  function drawSky() {
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe66d';                       // Sonne
    ctx.beginPath(); ctx.arc(840, 90, 46, 0, Math.PI * 2); ctx.fill();
  }

  const CLOUDS = [
    { x: 100, y: 80, s: 1 }, { x: 420, y: 150, s: 0.7 }, { x: 700, y: 60, s: 1.2 },
    { x: 1100, y: 120, s: 0.8 }, { x: 1450, y: 70, s: 1 },
  ];
  const CLOUD_PERIOD = 1800;                         // Wolken wiederholen sich alle 1800 px
  function drawClouds() {
    const off = (cameraX * 0.2 + time * 12) % CLOUD_PERIOD;
    ctx.fillStyle = '#fff';
    for (const c of CLOUDS) {
      for (let k = -1; k <= 1; k++) {
        const x = c.x - off + k * CLOUD_PERIOD;
        if (x > -150 && x < W + 150) drawCloud(x, c.y, c.s);
      }
    }
  }
  function drawCloud(x, y, s) {
    ctx.beginPath();
    for (const [dx, dy, r] of [[0, 0, 26], [30, -14, 34], [66, 0, 26], [32, 10, 24]]) {
      ctx.moveTo(x + (dx + r) * s, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawHills() {
    drawHillRow(0.25, 150, 320, '#b6e2b0', GROUND_Y - 50);   // hinten, langsam
    drawHillRow(0.5, 100, 230, '#86cc82', GROUND_Y - 14);    // vorne, schneller
  }
  function drawHillRow(parallax, radius, period, color, baseY) {
    ctx.fillStyle = color;
    const off = (cameraX * parallax) % period;
    for (let x = -off - period; x < W + period; x += period) {
      ctx.beginPath();
      ctx.arc(x + period / 2, baseY, radius, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(0, baseY, W, GROUND_Y - baseY);
  }

  function drawGround() {
    ctx.fillStyle = '#b97a4b';                                   // Erde
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';                          // Striche → Bewegungsgefühl
    const off = cameraX % 90;
    for (let x = -off; x < W; x += 90) {
      ctx.fillRect(x, GROUND_Y + 46, 36, 5);
      ctx.fillRect(x + 50, GROUND_Y + 76, 24, 5);
    }
    ctx.fillStyle = '#5fbf5a';                                   // Gras
    ctx.fillRect(0, GROUND_Y, W, 14);
    ctx.fillStyle = '#4ea84a';
    ctx.fillRect(0, GROUND_Y + 14, W, 4);
    for (const h of holes) {                                     // Löcher
      const hx = h.x - cameraX;
      if (hx + h.w < 0 || hx > W) continue;
      ctx.fillStyle = holeGradient;
      ctx.fillRect(hx, GROUND_Y, h.w, H - GROUND_Y);
      ctx.fillStyle = '#3b2616';                                 // dunkle Kanten
      ctx.fillRect(hx, GROUND_Y, 6, H - GROUND_Y);
      ctx.fillRect(hx + h.w - 6, GROUND_Y, 6, H - GROUND_Y);
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      const x = o.x - cameraX;
      if (x + o.w < 0 || x > W) continue;
      drawSprite(o.type, x, GROUND_Y - o.h + 3, o.w, o.h);
    }
  }

  function drawCoins() {
    for (const c of coins) {
      if (c.taken) continue;
      const x = c.x - cameraX;
      if (x + c.r < 0 || x - c.r > W) continue;
      const spin = Math.max(0.15, Math.abs(Math.cos(time * 5 + c.x * 0.02)));   // "Drehung"
      const bob = Math.sin(time * 4 + c.x * 0.05) * 3;                         // leichtes Schweben
      const w = c.r * 2 * spin;
      drawSprite('coin', x - w / 2, c.y - c.r + bob, w, c.r * 2);
    }
  }

  function drawPony() {
    // Schatten (wird kleiner, je höher das Pony springt)
    if (!pony.falling) {
      const height = GROUND_Y - (pony.y + pony.h);
      const s = clamp(1 - height / 320, 0.3, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(pony.x + pony.w * 0.5, GROUND_Y + 8, 44 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const name = pony.onGround ? (pony.frame ? 'ponyRun2' : 'ponyRun1') : 'ponyJump';
    ctx.save();
    ctx.translate(pony.x + pony.w / 2, pony.y + pony.h / 2);
    ctx.rotate(pony.angle);
    drawSprite(name, -pony.w / 2, -pony.h / 2, pony.w, pony.h);
    ctx.restore();
  }

  function drawEffects() {
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const e of effects) {
      ctx.globalAlpha = 1 - e.t / 0.7;
      outlinedText(e.text, e.x - cameraX, e.y - 20 - e.t * 60, '#ffe066', 'rgba(120,80,0,0.6)');
    }
    ctx.globalAlpha = 1;
  }

  function outlinedText(text, x, y, fill = '#fff', stroke = 'rgba(0,0,0,0.4)') {
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function drawHUD() {
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    drawSprite('coin', 18, 16, 32, 32);
    ctx.textAlign = 'left';
    outlinedText(String(runCoins), 60, 33);
    ctx.textAlign = 'right';
    outlinedText(`${meters()} m`, W - 20, 33);
  }

  function drawDebug() {
    ctx.lineWidth = 2;
    const hb = ponyHitbox();
    ctx.strokeStyle = '#0f0'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    ctx.strokeStyle = '#f00';
    for (const o of obstacles) { const b = obstacleHitbox(o); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.strokeStyle = '#08f';
    for (const h of holes) ctx.strokeRect(h.x - cameraX + 12, GROUND_Y - 4, h.w - 24, 8);
    ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`state=${state} speed=${speed.toFixed(0)} cameraX=${cameraX.toFixed(0)} entities=${obstacles.length + holes.length + coins.length}`, 12, H - 14);
  }

  /* ---------- 7. Bildschirme -------------------------------------------- */
  const screens = { title: el('screen-title'), dead: el('screen-dead'), shop: el('screen-shop') };
  let currentScreen = null;
  let screenBeforeShop = 'title';

  function showScreen(name) {
    currentScreen = name;
    for (const [key, node] of Object.entries(screens)) node.classList.toggle('hidden', key !== name);
    if (name === 'title') el('title-stats').textContent = `Beste Strecke: ${save.best} m · Münzen gesamt: ${save.wallet} 🪙`;
    if (name === 'shop') el('shop-wallet').textContent = save.wallet;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  el('btn-start').addEventListener('click', startGame);
  el('btn-retry').addEventListener('click', startGame);
  const openShop = () => { screenBeforeShop = currentScreen; showScreen('shop'); };
  el('btn-shop').addEventListener('click', openShop);
  el('btn-shop2').addEventListener('click', openShop);
  el('btn-shop-back').addEventListener('click', () => showScreen(screenBeforeShop));
  el('btn-reset').addEventListener('click', () => {
    if (confirm('Wirklich alle Münzen und den Rekord löschen?')) {
      save = { wallet: 0, best: 0 };
      writeSave();
      showScreen('shop');
    }
  });

  /* ---------- 8. Hauptschleife ------------------------------------------ */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);   // nie zu große Zeitsprünge
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  if (DEBUG) {
    // Für Tests und die Browser-Konsole: window.PONY_DEBUG.getState()
    window.PONY_DEBUG = {
      getState: () => ({ state, cameraX, speed, runCoins, pony, obstacles, holes, coins, save, images }),
    };
  }

  resetWorld();
  showScreen('title');
  if (location.search.includes('autostart')) startGame();   // ?autostart überspringt den Titel
  requestAnimationFrame(frame);
})();
