/* ============================================================================
   Pony Adventure – v0.3 (Level-Modus mit Levelprüfer)

   Ein kleines Runner-Spiel: Das Pony läuft von ganz allein, der Spieler
   springt über Hindernisse (Steine, Zäune, Baumstämme, Löcher, Bäche …) und
   sammelt Münzen.

   Es gibt zwei Modi:
     • Level-Modus  – 7 Pferde-Level (js/levels.js). Jedes Level hat ein festes
                      Tempo, eine feste Strecke, eigene Hindernisse und ein
                      eigenes Aussehen. Die Strecke wird aus dem "seed" gebaut
                      und sieht darum jedes Mal gleich aus. Wer ein Level
                      schafft, schaltet das nächste frei und bekommt 1–3 Sterne.
     • Endlos-Modus – wie in v0.1: läuft immer weiter und wird schneller.

   Wichtig: Alle Level sind garantiert schaffbar. Beim Bauen rechnet der
   Levelprüfer (Abschnitt 5) mit der echten Sprungphysik nach, ob es für jedes
   Hindernis einen Absprungpunkt gibt – und zwar mit genug Spielraum. Passt
   etwas nicht, rückt das Muster weiter nach hinten oder wird ersetzt.

   Aufbau dieser Datei:
     1. Einstellungen     5. Levelprüfer + Levelbau
     2. Bilder laden      6. Spiellogik (Physik, Kollisionen, Ziel)
     3. Spielstand        7. Zeichnen (mit Level-Aussehen)
     4. Spielzustand      8. Bildschirme (Titel, Übersicht, Ziel, Shop)
     + Eingabe            9. Hauptschleife
   ============================================================================ */
(() => {
  'use strict';

  /* ---------- 1. Einstellungen ---------------------------------------- */
  const W = 960, H = 540;        // interne Auflösung (wird per CSS skaliert)
  const GROUND_Y = 440;          // Oberkante des Bodens
  const GRAVITY = 2400;          // px/s²
  const JUMP_VELOCITY = -860;    // Absprung (negativ = nach oben)
  const JUMP_CUT = -300;         // Taste früh loslassen → kürzerer Sprung
  const V0 = -JUMP_VELOCITY;     // Absprungtempo nach oben
  const AIR_TIME = 2 * V0 / GRAVITY;   // ca. 0,72 s in der Luft
  const BASE_SPEED = 320;        // Endlos-Modus: Tempo am Anfang (px/s)
  const MAX_SPEED = 620;         // Endlos-Modus: Höchsttempo
  const PX_PER_METER = 40;       // für die Streckenanzeige
  const MAX_PIXEL_SCALE = 3;     // so viel feiner darf gezeichnet werden als 960x540
  const SAVE_KEY = 'ponyAdventure.save.v2';
  const OLD_SAVE_KEY = 'ponyAdventure.save.v1';   // Spielstand aus v0.1
  const DEBUG = location.search.includes('debug');   // ?debug zeigt Hitboxen
  const LEVELS = window.PONY_LEVELS || [];

  // Größe der Hindernisse (Originalgröße, wird pro Level skaliert)
  const OBSTACLE_TYPES = {
    rock:    { w: 64, h: 46 },
    boulder: { w: 92, h: 62 },
    fence:   { w: 66, h: 56 },
    hay:     { w: 62, h: 56 },
    log:     { w: 92, h: 34 },
    bush:    { w: 66, h: 48 },
  };

  // Maße der Pony-Hitbox (siehe ponyHitbox()) – der Levelprüfer rechnet damit
  const PONY_W = 117;
  const PONY_FRONT = 26 + (PONY_W - 44);   // 99: vordere Kante ab pony.x
  const PONY_FOOT = 52;                    // Huf-Punkt ab pony.x (zählt bei Löchern)
  const PONY_HB_W = PONY_W - 44;           // 73: Breite der Hitbox
  const HOLE_EDGE = 12;                    // so viel Rand hat ein Loch (siehe Kollision)

  // So viel Spielraum muss beim Abspringen mindestens bleiben (Sekunden).
  // Das ist die wichtigste Fairness-Schraube des Spiels: Jedes Level sagt in
  // js/levels.js mit "win", wie knapp es werden darf – kleiner = schwerer,
  // aber immer noch schaffbar. Dieser Wert gilt, wenn das Level nichts sagt.
  const DEFAULT_WINDOW = 0.22;

  // Wie viele Münzen es für wie viele Sterne braucht
  const STAR_2 = 0.6, STAR_3 = 0.9;

  // Aussehen, wenn kein Level läuft (Endlos-Modus)
  const DEFAULT_THEME = {
    sky: ['#7ec8ff', '#dff4ff'], hillBack: '#b6e2b0', hillFront: '#86cc82',
    grass: '#5fbf5a', grassDark: '#4ea84a', soil: '#b97a4b', deco: 'flowers',
  };

  /* ---------- 2. Bilder laden ------------------------------------------ */
  const ASSETS = {
    ponyRun1: 'assets/pony_run1.svg',
    ponyRun2: 'assets/pony_run2.svg',
    ponyJump: 'assets/pony_jump.svg',
    coin:     'assets/coin.svg',
    rock:     'assets/rock.svg',
    boulder:  'assets/boulder.svg',
    fence:    'assets/fence.svg',
    hay:      'assets/hay.svg',
    log:      'assets/log.svg',
    bush:     'assets/bush.svg',
  };
  const images = {};
  for (const [name, src] of Object.entries(ASSETS)) {
    images[name] = new Image();
    images[name].src = src;
  }
  const isReady = (img) => img.complete && img.naturalWidth > 0;

  // Größte Breite, in der ein Bild im Spiel vorkommt – danach wird gerastert
  const RASTER_REF = {
    ponyRun1: 117, ponyRun2: 117, ponyJump: 117, coin: 44,
    rock: 90, boulder: 130, fence: 92, hay: 88, log: 130, bush: 92,
  };
  const rasters = {};            // Name → fertig gerastertes Canvas
  // Die SVGs einmal pro Bildschirmauflösung in ein Canvas zeichnen. Das ist
  // scharf und beim Spielen schneller als jedes Mal das SVG zu rastern.
  function buildRasters(scale) {
    for (const [name, img] of Object.entries(images)) {
      if (!isReady(img)) continue;
      const w = Math.ceil((RASTER_REF[name] || img.naturalWidth) * scale * 1.1);
      const h = Math.ceil(w * img.naturalHeight / img.naturalWidth);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      rasters[name] = c;
    }
  }
  for (const img of Object.values(images)) {
    img.addEventListener('load', () => { if (pixelScale) buildRasters(pixelScale); });
  }

  /* ---------- 3. Spielstand (localStorage) ------------------------------ */
  // save = { wallet, best, levels: { h1: { done, stars, coins }, ... } }
  let save = loadSave();

  function loadSave() {
    const base = { wallet: 0, best: 0, levels: {} };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(base, JSON.parse(raw));
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old) return Object.assign(base, JSON.parse(old), { levels: {} });
    } catch (e) { /* kaputter Spielstand → einfach neu anfangen */ }
    return base;
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* z.B. privater Modus */ }
  }
  const levelRecord = (id) => save.levels[id] || { done: false, stars: 0, coins: 0 };
  const isUnlocked = (i) => i === 0 || levelRecord(LEVELS[i - 1].id).done;
  const totalStars = () => LEVELS.reduce((sum, L) => sum + levelRecord(L.id).stars, 0);
  const levelsDone = () => LEVELS.filter(L => levelRecord(L.id).done).length;

  function starsFor(coins, total) {
    if (!total) return 3;
    const part = coins / total;
    return part >= STAR_3 ? 3 : part >= STAR_2 ? 2 : 1;
  }

  /* ---------- 4. Spielzustand ------------------------------------------ */
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const el = (id) => document.getElementById(id);

  // Das Spiel rechnet immer in 960x540. Gezeichnet wird aber in der echten
  // Auflösung des Bildschirms – sonst sieht auf großen Monitoren alles
  // verwaschen aus. ctx.setTransform rechnet die Spielkoordinaten um.
  let pixelScale = 0;
  function fitCanvasToScreen() {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    const want = clamp((box.width * (window.devicePixelRatio || 1)) / W, 1, MAX_PIXEL_SCALE);
    if (Math.abs(want - pixelScale) > 0.01) {
      pixelScale = want;
      canvas.width = Math.round(W * want);
      canvas.height = Math.round(H * want);
      buildRasters(want);                    // Bilder in der neuen Größe rastern
    }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  let state = 'title';           // 'title' | 'playing' | 'dying' | 'dead' | 'finish'
  let mode = 'level';            // 'level' | 'endless'
  let level = null;              // aktuelles Level-Objekt aus LEVELS
  let levelIndex = 0;
  let goalX = 0;                 // Kamera-Position, bei der das Ziel erreicht ist
  let finishX = 0;               // Welt-x der Ziellinie
  let coinsTotal = 0;            // wie viele Münzen im Level insgesamt liegen
  let tightest = 0;              // knappstes Zeitfenster im Level (nur für ?debug)
  let cameraX = 0;               // wie weit die Welt nach links gescrollt ist (px)
  let speed = BASE_SPEED;
  let time = 0;                  // Gesamtzeit, für Animationen
  let runCoins = 0;              // Münzen im aktuellen Lauf
  let deathCause = null;         // 'bump' (Hindernis) | 'fall' (Loch/Wasser)
  let dyingTimer = 0;
  let finishTimer = 0;
  let deadSince = 0;
  let paused = false;            // Pause-Bildschirm offen

  const pony = {
    x: 150, y: 0, w: PONY_W, h: 90,
    vx: 0, vy: 0,
    onGround: true, falling: false,
    angle: 0, frame: 0, frameTimer: 0,
  };
  let obstacles = [];            // { type, x, w, h }   (x = Welt-Koordinate)
  let holes = [];                // { x, w, water }
  let coins = [];                // { x, y, r, taken }
  let effects = [];              // { x, y, text, t }   (z.B. "+1" beim Einsammeln)
  let spawnX = 0;                // Endlos-Modus: ab hier kommt das nächste Muster

  const theme = () => (mode === 'level' && level && level.theme) ? level.theme : DEFAULT_THEME;

  // Zufallsgenerator: im Level-Modus mit "seed" (immer gleiche Strecke),
  // im Endlos-Modus einfach Math.random.
  let rng = Math.random;
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // kleine Helfer
  const rand = (a, b) => a + rng() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const meters = () => Math.floor(cameraX / PX_PER_METER);
  // immer gleiche "Zufalls"-Zahl für eine Position (für Blumen, Bäume …)
  const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

  /* ---------- Eingabe --------------------------------------------------- */
  function pressJump() {
    if (currentScreen === 'title') return showScreen('levels');
    // anderes Overlay offen (Pause, Shop, Übersicht …)? Dann nicht springen.
    if (currentScreen && currentScreen !== 'dead') return;
    if (state === 'dead') { if (time - deadSince > 0.5) startRun(); return; }
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
    // Ist gerade ein Knopf ausgewählt, soll die Leertaste diesen drücken
    if (e.target && e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (!e.repeat) pressJump();
  });
  window.addEventListener('keyup', (e) => { if (JUMP_KEYS.includes(e.code)) releaseJump(); });
  window.addEventListener('keydown', (e) => {          // Esc / P = Pause an und aus
    if (e.code !== 'Escape' && e.code !== 'KeyP') return;
    e.preventDefault();
    if (paused) resumeGame(); else pauseGame();
  });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); pressJump(); });
  window.addEventListener('pointerup', releaseJump);

  /* ---------- 5. Levelprüfer + Levelbau ---------------------------------
     Sprungkurve: höhe(t) = V0*t - GRAVITY/2*t².
     tUp(H)/tDown(H) = wann das Pony die Höhe H überquert bzw. wieder
     unterschreitet. Damit lässt sich für jedes Hindernis ausrechnen, von
     welcher Stelle aus man abspringen darf – und wie viel Spielraum bleibt.
     ---------------------------------------------------------------------- */
  const tUp   = (Hh) => (V0 - Math.sqrt(Math.max(0, V0 * V0 - 2 * GRAVITY * Hh))) / GRAVITY;
  const tDown = (Hh) => (V0 + Math.sqrt(Math.max(0, V0 * V0 - 2 * GRAVITY * Hh))) / GRAVITY;

  // Strecke, die das Pony im Sprung oberhalb der Höhe Hh zurücklegt (Tempo v)
  const airRun = (Hh, v) => v * (tDown(Hh) - tUp(Hh));
  // Wie lang darf ein Hindernis der Höhe Hh sein, damit der Sprung fair bleibt?
  const maxSpan = (Hh, v, win) => airRun(Hh, v) - PONY_HB_W - win * v;

  // Alle Hindernisse und Löcher als Liste. Hindernisse, die so dicht
  // beieinander stehen, dass man dazwischen nicht landen kann, zählen als ein
  // einziger langer Block – so wie es sich beim Spielen auch anfühlt.
  function hazards() {
    const list = [];
    const obs = obstacles
      .map(o => ({ kind: 'o', a: o.x + 8, b: o.x + o.w - 8, h: o.h - 8 }))
      .sort((p, q) => p.a - q.a);
    for (const o of obs) {
      const last = list[list.length - 1];
      if (last && o.a - last.b < 150) {
        last.b = Math.max(last.b, o.b);
        last.h = Math.max(last.h, o.h);
      } else list.push(o);
    }
    for (const h of holes) list.push({ kind: 'h', a: h.x + HOLE_EDGE, b: h.x + h.w - HOLE_EDGE });
    return list.sort((p, q) => p.a - q.a);
  }

  // Spielt die Strecke gedanklich durch: Gibt es für jedes Hindernis einen
  // Absprungpunkt? Rückgabe = knappstes Zeitfenster in Sekunden
  // (kleiner als 0 heißt: nicht schaffbar).
  function checkRun(v) {
    const D = v * AIR_TIME;                     // Sprungweite
    const list = hazards();
    let worst = Infinity;
    let reach = pony.x + PONY_FRONT;            // hier steht das Pony am Anfang
    for (const z of list) {
      // Fenster für die vordere Hitbox-Kante beim Absprung
      let lo, hi;
      if (z.kind === 'o') {
        lo = z.b + PONY_HB_W - v * tDown(z.h);  // sonst streift das Hinterteil
        hi = z.a - v * tUp(z.h);                // sonst ist das Pony noch zu tief
      } else {
        lo = z.b - D + (PONY_FRONT - PONY_FOOT) + 10;   // sonst landet es im Loch
        hi = z.a + (PONY_FRONT - PONY_FOOT) - 10;       // sonst springt es zu spät ab
      }
      const from = Math.max(lo, reach);
      const window = (hi - from) / v;
      if (window < worst) worst = window;
      if (window < 0) return window;            // hier kommt das Pony nicht durch
      // Frühestmöglicher Landepunkt – und nicht im nächsten Loch landen
      let land = from + D;
      for (const w of list) {
        if (w.kind !== 'h') continue;
        const foot = land - (PONY_FRONT - PONY_FOOT);
        if (foot > w.a && foot < w.b) {
          const need = w.b + (PONY_FRONT - PONY_FOOT) + 6;
          if (need > hi + D) return -1;         // kein Absprung landet dahinter
          land = need;
        }
      }
      reach = land;
    }
    return worst === Infinity ? 9 : worst;
  }

  // Bau-Werte für die Muster. jump = Sprungweite bei diesem Tempo; alles
  // andere wird daran gemessen, damit schnelle Level fair bleiben.
  function genParams() {
    if (mode === 'level') {
      return {
        speed: level.speed, jump: level.speed * AIR_TIME, size: level.sizeScale,
        hole: level.holeFactor, gap: level.gapFactor, main: level.main || 'rock',
        win: level.win || DEFAULT_WINDOW,
        water: !!(level.theme && level.theme.water),
      };
    }
    const d = difficulty();                         // Endlos: 0 → 1
    return {
      speed, jump: speed * AIR_TIME, size: 1 + d * 0.3, hole: 0.34 + d * 0.18,
      gap: 1.5 - d * 0.45, main: 'rock', win: DEFAULT_WINDOW, water: false,
    };
  }
  const difficulty = () => clamp((speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);

  const ENDLESS_PATTERNS = [
    ['rock', 3], ['fence', 2], ['hay', 1], ['log', 1], ['bush', 1],
    ['hole', 3], ['double', 1], ['coinLine', 2], ['coinArc', 2],
  ];

  function pickWeighted(list) {
    let total = 0;
    for (const entry of list) total += entry[1];
    let r = rng() * total;
    for (const entry of list) { r -= entry[1]; if (r <= 0) return entry[0]; }
    return list[0][0];
  }

  function addCoin(x, y) { coins.push({ x, y, r: 16, taken: false }); }

  function addObstacle(type, x, scale) {
    const t = OBSTACLE_TYPES[type];
    const o = { type, x, w: Math.round(t.w * scale), h: Math.round(t.h * scale) };
    obstacles.push(o);
    return o;
  }

  // Hindernis aufstellen, aber vorher schrumpfen, falls es bei diesem Tempo
  // zu lang zum Überspringen wäre
  function addFitting(type, x, scale, p) {
    const t = OBSTACLE_TYPES[type];
    let s = scale;
    while (s > 0.55 && t.w * s - 16 > maxSpan(t.h * s - 8, p.speed, p.win)) s -= 0.05;
    return addObstacle(type, x, s);
  }

  function addHole(x, w, p) { holes.push({ x, w, water: p.water }); }

  // Münzbogen über ein Hindernis (genau auf der Sprungbahn)
  function coinsOver(x, w, h) {
    if (rng() > 0.6) return;
    addCoin(x - 24,     GROUND_Y - h - 56);
    addCoin(x + w / 2,  GROUND_Y - h - 88);
    addCoin(x + w + 24, GROUND_Y - h - 56);
  }
  // Münzen über einem Loch oder Bach
  function coinsOverHole(x, w) {
    if (rng() > 0.65) return;
    for (let i = 0; i < 3; i++) addCoin(x + w * (0.25 + 0.25 * i), GROUND_Y - 105);
  }

  // Die Bausteine. Jeder legt sein Zeug ab Welt-x ab und meldet seine Länge.
  const single = (type) => function (x, p) {
    const o = addFitting(type, x, p.size, p);
    coinsOver(x, o.w, o.h);
    return o.w;
  };

  const PATTERNS = {
    rock:    single('rock'),
    boulder: single('boulder'),
    fence:   single('fence'),
    hay:     single('hay'),
    log:     single('log'),
    bush:    single('bush'),

    // zwei flachere Hindernisse dicht hintereinander – in einem Sprung zu
    // nehmen. Die Lücke wird so gewählt, dass die Sprungweite reicht.
    double(x, p) {
      const type = p.main;
      const t = OBSTACLE_TYPES[type];
      const scale = p.size * 0.7;                 // flacher als ein einzelnes
      const w = Math.round(t.w * scale);
      const h = Math.round(t.h * scale);
      const room = maxSpan(h - 8, p.speed, p.win) - (2 * w - 16);
      const gap = Math.floor(Math.min(p.jump * 0.16, room));   // abrunden: sonst zu lang
      if (gap < 18) return PATTERNS[type](x, p);  // passt nicht → nur eins
      addObstacle(type, x, scale);
      addObstacle(type, x + w + gap, scale);
      const len = 2 * w + gap;
      coinsOver(x, len, h);
      return len;
    },

    hole(x, p) {
      const w = Math.round(p.jump * p.hole);
      addHole(x, w, p);
      coinsOverHole(x, w);
      return w;
    },

    // zwei Löcher (im Bachlauf: zwei Bäche) mit einer Insel zum Landen
    doubleHole(x, p) {
      const w = Math.round(p.jump * p.hole * 0.8);
      const island = Math.round(Math.max(200, p.jump * 0.75));
      addHole(x, w, p);
      addHole(x + w + island, w, p);
      coinsOverHole(x, w);
      coinsOverHole(x + w + island, w);
      return w * 2 + island;
    },

    // Loch, dahinter ein Hindernis: landen und gleich wieder abspringen
    holeRock(x, p) {
      const w = Math.round(p.jump * p.hole * 0.85);
      addHole(x, w, p);
      const after = Math.round(Math.max(220, p.jump * 1.15));
      const o = addFitting(p.main, x + w + after, p.size * 0.85, p);
      coinsOverHole(x, w);
      return w + after + o.w;
    },

    coinLine(x) {
      const n = 5, gap = 44;
      for (let i = 0; i < n; i++) addCoin(x + i * gap, GROUND_Y - 48);
      return (n - 1) * gap;
    },

    coinArc(x) {
      const n = 7, gap = 42;
      for (let i = 0; i < n; i++) {
        addCoin(x + i * gap, GROUND_Y - 44 - Math.sin(i / (n - 1) * Math.PI) * 115);
      }
      return (n - 1) * gap;
    },
  };

  // Level-Modus: die ganze Strecke einmal am Anfang bauen – und dabei nach
  // jedem Muster prüfen, ob das Pony noch überall drüberkommt.
  function buildLevel() {
    rng = mulberry32(level.seed);
    const p = genParams();
    let x = pony.x + p.jump * 2.2;               // ruhiger Anlauf
    const lastX = finishX - 280;                 // vor dem Ziel wird es ruhig
    let guard = 0;
    while (x < lastX && guard++ < 500) {
      const name = pickWeighted(level.patterns);
      const mark = { o: obstacles.length, h: holes.length, c: coins.length };
      const undo = () => { obstacles.length = mark.o; holes.length = mark.h; coins.length = mark.c; };
      let len = PATTERNS[name](x, p);
      // Zu eng? Muster nach hinten schieben – und wenn es gar nicht passt,
      // kommt hier eben nur eine Münzreihe hin.
      for (let tries = 0; tries < 8 && checkRun(p.speed) < p.win - 1e-6; tries++) {
        undo();
        x += 70;
        len = tries < 7 ? PATTERNS[name](x, p) : PATTERNS.coinLine(x, p);
      }
      if (checkRun(p.speed) < p.win - 1e-6) { undo(); len = PATTERNS.coinLine(x, p); }
      x += len + p.jump * p.gap + rng() * p.jump * 0.6;
    }
    coinsTotal = coins.length;
    tightest = checkRun(p.speed);
  }

  // Endlos-Modus: immer nachlegen, kurz bevor das Pony dort ankommt
  function spawnPatterns() {
    while (spawnX < cameraX + W + 300) {
      const p = genParams();
      const mark = { o: obstacles.length, h: holes.length, c: coins.length };
      const name = pickWeighted(ENDLESS_PATTERNS);
      let len = PATTERNS[name](spawnX, p);
      if (checkRun(p.speed) < p.win - 1e-6) {    // auch endlos bleibt es fair
        obstacles.length = mark.o; holes.length = mark.h; coins.length = mark.c;
        spawnX += 80;
        len = PATTERNS.coinLine(spawnX, p);
      }
      spawnX += len + p.jump * p.gap + rng() * p.jump * 0.6;
    }
  }

  /* ---------- 6. Spiellogik --------------------------------------------- */
  function resetWorld() {
    cameraX = 0; runCoins = 0; coinsTotal = 0; tightest = 0;
    obstacles = []; holes = []; coins = []; effects = [];
    Object.assign(pony, {
      x: 150, y: GROUND_Y - pony.h, vx: 0, vy: 0,
      onGround: true, falling: false, angle: 0, frame: 0, frameTimer: 0,
    });
    if (mode === 'level') {
      speed = level.speed;
      goalX = level.meters * PX_PER_METER;
      finishX = goalX + pony.x;               // Ziel steht vor dem Pony, wenn goalX erreicht ist
      buildLevel();
    } else {
      rng = Math.random;
      speed = BASE_SPEED;
      goalX = 0; finishX = 0;
      spawnX = W + 400;                       // die ersten Meter bleiben frei
      spawnPatterns();
    }
  }

  function startRun() {
    if (state === 'playing' || state === 'dying' || state === 'finish') return;
    resetWorld();
    state = 'playing';
    showScreen(null);
  }

  function startLevel(i) {
    mode = 'level';
    levelIndex = i;
    level = LEVELS[i];
    state = 'title';                          // damit startRun() nicht blockiert
    startRun();
  }

  function startEndless() {
    mode = 'endless';
    level = null;
    state = 'title';
    startRun();
  }

  // --- Pause ---------------------------------------------------------------
  function pauseGame() {
    if (state !== 'playing' || paused) return;
    paused = true;
    el('pause-info').innerHTML = mode === 'level'
      ? `Level ${level.nr} · ${level.emoji} ${level.name}<br>` +
        `<span class="stats">${meters()} von ${level.meters} m · ${runCoins} von ${coinsTotal} 🪙</span>`
      : `Endlos-Modus<br><span class="stats">${meters()} m · ${runCoins} 🪙</span>`;
    el('btn-pause-quit').textContent = mode === 'level' ? '🗺️ Übersicht' : '🏠 Titel';
    showScreen('pause');
  }

  function resumeGame() {
    if (!paused) return;
    paused = false;
    showScreen(null);
  }

  // Lauf beenden, ohne zu sterben (für "Nochmal" und "Abbrechen" in der Pause).
  // Die gesammelten Münzen bleiben dem Pony erhalten.
  function leaveRun() {
    paused = false;
    if (state === 'playing' || state === 'dying' || state === 'finish') {
      save.wallet += runCoins;
      if (mode === 'endless') save.best = Math.max(save.best, meters());
      writeSave();
    }
    state = 'dead';
    deadSince = time;
  }

  function die(cause) {
    state = 'dying';
    el('btn-pause').classList.add('hidden');
    deathCause = cause;
    dyingTimer = 0;
    speed = 0;
    if (cause === 'bump') {                  // vom Hindernis abprallen
      pony.vy = -460; pony.vx = -260; pony.onGround = false;
    } else {                                 // ins Loch / ins Wasser fallen
      pony.falling = true; pony.vx = 140; pony.vy = Math.max(pony.vy, 0);
    }
  }

  function gameOver() {
    state = 'dead';
    deadSince = time;
    save.wallet += runCoins;
    if (mode === 'endless') save.best = Math.max(save.best, meters());
    writeSave();
    const rest = mode === 'level' ? Math.max(0, level.meters - meters()) : 0;
    el('dead-stats').innerHTML = mode === 'level'
      ? `Level ${level.nr}: <strong>${meters()} m</strong> von ${level.meters} m<br>` +
        `<span class="stats">Nur noch ${rest} m bis zum Ziel · ${runCoins} 🪙 gesammelt</span>`
      : `Strecke: <strong>${meters()} m</strong> · Münzen: <strong>${runCoins}</strong> 🪙<br>` +
        `<span class="stats">Beste Strecke: ${save.best} m · Münzen gesamt: ${save.wallet} 🪙</span>`;
    el('btn-dead-back').textContent = mode === 'level' ? '🗺️ Übersicht' : '🏠 Titel';
    showScreen('dead');
  }

  // Ziel erreicht: das Pony trabt noch kurz aus, dann kommt der Siegesbildschirm
  function reachFinish() {
    state = 'finish';
    finishTimer = 0;
    for (let i = 0; i < 6; i++) {
      effects.push({ x: cameraX + rand(200, 800), y: rand(120, 360), text: '🎉', t: rand(0, 0.3) });
    }
  }

  function levelDone() {
    const stars = starsFor(runCoins, coinsTotal);
    const rec = levelRecord(level.id);
    rec.done = true;
    rec.stars = Math.max(rec.stars, stars);
    rec.coins = Math.max(rec.coins, runCoins);
    save.levels[level.id] = rec;
    save.wallet += runCoins;
    writeSave();

    const isLast = levelIndex >= LEVELS.length - 1;
    el('won-level').innerHTML = `Level ${level.nr} · ${level.emoji} ${level.name}`;
    el('won-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    el('won-stats').innerHTML =
      `Münzen: <strong>${runCoins}</strong> von ${coinsTotal} 🪙<br>` +
      (stars < 3 ? `<span class="stats">Sammle mehr Münzen für mehr Sterne!</span>`
                 : `<span class="stats">Alle Münzen – perfekt! ✨</span>`);
    el('won-next').classList.toggle('hidden', isLast);
    el('won-outro').classList.toggle('hidden', !isLast);
    state = 'dead';                            // Lauf ist vorbei (kein Update mehr)
    deadSince = time;
    showScreen('won');
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
    return { x: pony.x + 26, y: pony.y + 14, w: PONY_HB_W, h: pony.h - 14 };
  }
  function obstacleHitbox(o) {
    return { x: o.x - cameraX + 8, y: GROUND_Y - o.h + 8, w: o.w - 16, h: o.h - 8 };
  }

  function collectCoins() {
    const hb = ponyHitbox();
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

  function checkCollisions() {
    const hb = ponyHitbox();
    for (const o of obstacles) {
      if (overlap(hb, obstacleHitbox(o))) return die('bump');
    }
    if (pony.onGround) {
      const footX = pony.x + PONY_FOOT;
      for (const h of holes) {
        const hx = h.x - cameraX;
        if (footX > hx + HOLE_EDGE && footX < hx + h.w - HOLE_EDGE) return die('fall');
      }
    }
    collectCoins();
  }

  // --- Ein Simulationsschritt (dt in Sekunden) -----------------------------
  function update(dt) {
    if (paused) return;          // Pause: die Welt friert ein
    time += dt;
    for (const e of effects) e.t += dt;
    effects = effects.filter(e => e.t < 0.9);

    if (state === 'title' || state === 'dead') return;

    if (state === 'playing') {
      // Level: festes Tempo. Endlos: wird langsam schneller.
      speed = mode === 'level' ? level.speed : Math.min(MAX_SPEED, BASE_SPEED + cameraX * 0.012);
      cameraX += speed * dt;
      if (mode === 'level' && cameraX >= goalX) reachFinish();
    } else if (state === 'finish') {
      cameraX += speed * dt;
      speed = Math.max(0, speed - 260 * dt);         // ausrollen lassen
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

    if (state === 'playing' || state === 'finish') {
      // Laufanimation: schneller laufen = schneller trippeln
      if (pony.onGround && speed > 0) {
        pony.frameTimer += dt * speed / BASE_SPEED;
        if (pony.frameTimer > 0.13) { pony.frameTimer = 0; pony.frame = 1 - pony.frame; }
      }
      // in der Luft leicht neigen (Nase hoch beim Steigen, runter beim Fallen)
      const target = pony.onGround ? 0 : clamp(pony.vy / 2600, -0.25, 0.3);
      pony.angle += (target - pony.angle) * Math.min(1, dt * 12);
    }

    if (state === 'playing') {
      if (mode === 'endless') spawnPatterns();
      checkCollisions();
      cleanup();
    } else if (state === 'finish') {
      collectCoins();                              // Münzen hinter dem Ziel zählen noch
      finishTimer += dt;
      if (finishTimer > 1.4) levelDone();
    } else if (state === 'dying') {
      dyingTimer += dt;
      if (deathCause === 'fall') pony.angle += dt * 2.5;
      else if (!pony.onGround) pony.angle -= dt * 7;
      if (dyingTimer > 1.0 || pony.y > H + 60) gameOver();
    }
  }

  /* ---------- 7. Zeichnen ------------------------------------------------ */
  const pitGradient = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  pitGradient.addColorStop(0, '#5a3b22');
  pitGradient.addColorStop(1, '#1a100a');
  const waterGradient = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  waterGradient.addColorStop(0, '#7fd3f0');
  waterGradient.addColorStop(1, '#1d6fa8');

  // Himmel-Verlauf pro Aussehen einmal bauen und merken
  function skyGradient(t) {
    if (!t._sky) {
      const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      g.addColorStop(0, t.sky[0]);
      g.addColorStop(1, t.sky[1]);
      t._sky = g;
    }
    return t._sky;
  }

  // Zeichnet ein Bild – oder ein pinkes Rechteck, falls es (noch) nicht geladen ist
  function drawSprite(name, x, y, w, h) {
    const img = rasters[name] || images[name];
    if (img && (img.width || isReady(img))) ctx.drawImage(img, x, y, w, h);
    else { ctx.fillStyle = '#e0e'; ctx.fillRect(x, y, w, h); }
  }

  function draw() {
    const t = theme();
    drawSky(t);
    drawDecoSky(t);
    drawClouds();
    drawHills(t);
    drawDecoBack(t);
    drawGround(t);
    drawDecoFront(t);
    drawCoins();
    drawObstacles();
    drawFinish();
    drawPony();
    drawEffects();
    drawHUD();
    if (DEBUG) drawDebug();
  }

  function drawSky(t) {
    ctx.fillStyle = skyGradient(t);
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

  function drawHills(t) {
    drawHillRow(0.25, 150, 320, t.hillBack, GROUND_Y - 50);   // hinten, langsam
    drawHillRow(0.5, 100, 230, t.hillFront, GROUND_Y - 14);   // vorne, schneller
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

  function drawGround(t) {
    ctx.fillStyle = t.soil;                                      // Erde
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';                          // Striche → Bewegungsgefühl
    const off = cameraX % 90;
    for (let x = -off; x < W; x += 90) {
      ctx.fillRect(x, GROUND_Y + 46, 36, 5);
      ctx.fillRect(x + 50, GROUND_Y + 76, 24, 5);
    }
    ctx.fillStyle = t.grass;                                     // Gras
    ctx.fillRect(0, GROUND_Y, W, 14);
    ctx.fillStyle = t.grassDark;
    ctx.fillRect(0, GROUND_Y + 14, W, 4);
    for (const h of holes) {                                     // Löcher / Bäche
      const hx = h.x - cameraX;
      if (hx + h.w < 0 || hx > W) continue;
      if (h.water) drawWater(hx, h.w, t); else drawPit(hx, h.w);
    }
  }

  function drawPit(hx, w) {
    ctx.fillStyle = pitGradient;
    ctx.fillRect(hx, GROUND_Y, w, H - GROUND_Y);
    ctx.fillStyle = '#3b2616';                                   // dunkle Kanten
    ctx.fillRect(hx, GROUND_Y, 6, H - GROUND_Y);
    ctx.fillRect(hx + w - 6, GROUND_Y, 6, H - GROUND_Y);
  }

  // Bach: Wasser mit kleinen Wellen und Ufer
  function drawWater(hx, w, t) {
    ctx.fillStyle = waterGradient;
    ctx.fillRect(hx, GROUND_Y + 6, w, H - GROUND_Y);
    ctx.fillStyle = t.soil;                                      // Ufer
    ctx.fillRect(hx - 4, GROUND_Y, 8, 12);
    ctx.fillRect(hx + w - 4, GROUND_Y, 8, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {                                // Wellenlinien
      const y = GROUND_Y + 16 + k * 22;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin((x + hx) * 0.06 + time * 2.5 + k) * 3;
        if (x === 0) ctx.moveTo(hx + x, yy); else ctx.lineTo(hx + x, yy);
      }
      ctx.stroke();
    }
  }

  /* --- Deko: gibt jedem Level sein eigenes Gesicht --------------------- */
  function drawDecoSky(t) {
    if (t.deco === 'rainbow') drawRainbow();
    else if (t.deco === 'wind') drawWind();
  }
  function drawDecoBack(t) {
    if (t.deco === 'trees') drawTrees();
    else if (t.deco === 'posts') drawPosts();
    else if (t.deco === 'cliffs') drawCliffs();
  }
  function drawDecoFront(t) {
    if (t.deco === 'flowers') drawFlowers();
    else if (t.deco === 'reeds') drawReeds();
  }

  // wiederholt Deko entlang der Strecke: cb(bildschirm-x, index)
  function alongGround(period, parallax, cb) {
    const shift = cameraX * parallax;
    const first = Math.floor((shift - period) / period);
    for (let i = first; i * period - shift < W + period; i++) {
      cb(i * period - shift, i);
    }
  }

  const FLOWER_COLORS = ['#ff7ab3', '#fff28a', '#ffffff', '#c58cff'];
  function drawFlowers() {
    alongGround(70, 1, (x, i) => {
      const r = hash(i);
      if (r > 0.75) return;
      const y = GROUND_Y + 3 + hash(i + 7) * 8;
      const c = FLOWER_COLORS[Math.floor(hash(i + 3) * FLOWER_COLORS.length)];
      const px = x + hash(i + 11) * 40;
      ctx.fillStyle = c;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(px + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(px, y, 2.4, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawReeds() {
    alongGround(90, 1, (x, i) => {
      if (hash(i) > 0.6) return;
      const px = x + hash(i + 5) * 50;
      const hgt = 26 + hash(i + 2) * 22;
      const sway = Math.sin(time * 1.6 + i) * 4;
      ctx.strokeStyle = '#3f8f5c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, GROUND_Y + 8);
      ctx.quadraticCurveTo(px + sway, GROUND_Y - hgt / 2, px + sway * 2, GROUND_Y - hgt);
      ctx.stroke();
      ctx.fillStyle = '#8a5a33';                       // Rohrkolben
      ctx.beginPath();
      ctx.ellipse(px + sway * 2, GROUND_Y - hgt - 4, 3.4, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Koppelzäune weit hinten auf der Wiese: klein, blass und höher gesetzt,
  // damit man sie nie mit den echten Zäunen zum Springen verwechselt
  function drawPosts() {
    ctx.globalAlpha = 0.55;
    alongGround(190, 0.3, (x, i) => {
      const y = GROUND_Y - 54;
      ctx.fillStyle = '#c49a6c';
      ctx.fillRect(x, y - 24, 5, 24);
      ctx.fillRect(x + 62, y - 24, 5, 24);
      ctx.fillStyle = '#dcb68a';
      ctx.fillRect(x, y - 20, 67, 4);
      ctx.fillRect(x, y - 10, 67, 4);
    });
    ctx.globalAlpha = 1;
  }

  function drawTrees() {
    alongGround(120, 0.45, (x, i) => {
      const s = 0.8 + hash(i) * 0.5;
      const baseY = GROUND_Y - 16;
      const px = x + hash(i + 4) * 40;
      ctx.fillStyle = '#7a5a34';
      ctx.fillRect(px - 5 * s, baseY - 34 * s, 10 * s, 36 * s);
      ctx.fillStyle = hash(i + 9) > 0.5 ? '#2f7a44' : '#38924f';
      for (let k = 0; k < 3; k++) {                    // Tannen-Etagen
        const ty = baseY - (30 + k * 26) * s;
        const tw = (44 - k * 9) * s;
        ctx.beginPath();
        ctx.moveTo(px, ty - 34 * s);
        ctx.lineTo(px + tw, ty);
        ctx.lineTo(px - tw, ty);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  function drawCliffs() {
    alongGround(240, 0.32, (x, i) => {
      const s = 0.85 + hash(i) * 0.5;
      const baseY = GROUND_Y - 10;
      ctx.fillStyle = hash(i + 1) > 0.5 ? '#8c8177' : '#9a8f84';
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 40 * s, baseY - 96 * s);
      ctx.lineTo(x + 70 * s, baseY - 52 * s);
      ctx.lineTo(x + 104 * s, baseY - 120 * s);
      ctx.lineTo(x + 150 * s, baseY);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawWind() {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const speedFactor = 160 + (i % 3) * 90;
      const x = W - ((time * speedFactor + i * 260) % (W + 320));
      const y = 60 + hash(i) * 260;
      const len = 50 + hash(i + 2) * 70;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len * 0.5, y - 8, x + len, y);
      ctx.stroke();
    }
  }

  const RAINBOW = ['#ff5f6d', '#ffa63d', '#ffe066', '#6fdc8c', '#4fc3f7', '#9b7bff'];
  const RAINBOW_PERIOD = 1500;
  function drawRainbow() {
    const off = (cameraX * 0.12) % RAINBOW_PERIOD;
    ctx.lineWidth = 16;
    ctx.globalAlpha = 0.6;
    for (let k = -1; k <= 1; k++) {
      const cx = W / 2 - off + k * RAINBOW_PERIOD;
      if (cx < -320 || cx > W + 320) continue;
      RAINBOW.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        ctx.arc(cx, GROUND_Y + 40, 260 - i * 16, Math.PI, Math.PI * 2);
        ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
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

  // Ziellinie mit Karo-Banner
  function drawFinish() {
    if (mode !== 'level') return;
    const x = finishX - cameraX;
    if (x < -80 || x > W + 120) return;
    const top = GROUND_Y - 210;
    ctx.fillStyle = '#8a5a33';                                   // Pfosten
    ctx.fillRect(x - 4, top, 9, GROUND_Y - top + 6);
    const cell = 15, cols = 6, rows = 3;                         // Banner
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#222' : '#fff';
        ctx.fillRect(x + 5 + c * cell, top + r * cell, cell, cell);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';                    // Markierung am Boden
    ctx.fillRect(x - 4, GROUND_Y, 9, 14);
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText('ZIEL', x + 50, top - 16, '#fff', 'rgba(0,0,0,0.55)');
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
      ctx.globalAlpha = clamp(1 - e.t / 0.9, 0, 1);
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
    outlinedText(mode === 'level' ? `${runCoins}/${coinsTotal}` : String(runCoins), 60, 33);
    ctx.textAlign = 'right';
    outlinedText(`${meters()} m`, W - 20, 33);
    if (mode === 'level') drawProgressBar();
  }

  // Fortschrittsbalken: wie weit ist das Pony im Level?
  function drawProgressBar() {
    const bw = 300, bh = 14, bx = (W - bw) / 2, by = 26;
    const part = clamp(cameraX / goalX, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(bx - 3, by - 3, bw + 6, bh + 6, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    roundRect(bx, by, bw, bh, 7); ctx.fill();
    ctx.fillStyle = '#ffd166';
    roundRect(bx, by, Math.max(bh, bw * part), bh, 7); ctx.fill();
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    outlinedText(`Level ${level.nr} · ${level.name}`, W / 2, by - 14);
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    outlinedText(`${meters()} / ${level.meters} m`, W / 2, by + bh + 13);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawDebug() {
    ctx.lineWidth = 2;
    const hb = ponyHitbox();
    ctx.strokeStyle = '#0f0'; ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    ctx.strokeStyle = '#f00';
    for (const o of obstacles) { const b = obstacleHitbox(o); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.strokeStyle = '#08f';
    for (const h of holes) ctx.strokeRect(h.x - cameraX + HOLE_EDGE, GROUND_Y - 4, h.w - 2 * HOLE_EDGE, 8);
    ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`mode=${mode} state=${state} speed=${speed.toFixed(0)} cameraX=${cameraX.toFixed(0)} ` +
      `coins=${runCoins}/${coinsTotal} fenster=${tightest.toFixed(3)}s ` +
      `entities=${obstacles.length + holes.length + coins.length}`, 12, H - 14);
  }

  /* ---------- 8. Bildschirme -------------------------------------------- */
  const screens = {
    title: el('screen-title'), levels: el('screen-levels'), pause: el('screen-pause'),
    dead: el('screen-dead'), won: el('screen-won'), shop: el('screen-shop'),
  };
  let currentScreen = null;
  let screenBeforeShop = 'title';

  function showScreen(name) {
    currentScreen = name;
    for (const [key, node] of Object.entries(screens)) node.classList.toggle('hidden', key !== name);
    if (name === 'title') {
      state = 'title';             // vom Titel aus läuft garantiert kein Lauf mehr
      el('title-stats').textContent =
        `${levelsDone()} von ${LEVELS.length} Leveln geschafft · ★ ${totalStars()}/${LEVELS.length * 3} · ${save.wallet} 🪙`;
    }
    // Pause-Knopf gibt es nur, solange wirklich gespielt wird
    el('btn-pause').classList.toggle('hidden', name !== null || state !== 'playing');
    if (name === 'levels') buildLevelScreen();
    if (name === 'shop') el('shop-wallet').textContent = save.wallet;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  // Levelübersicht: alle Level liegen auf einem Weg, der sich in Schlangenlinien
  // von links (einfach und langsam) nach rechts (schnell und schwer) zieht.
  // Das letzte Feld ist der Ausblick auf die Einhorn-Level.
  const MAP_W = 800, MAP_H = 260;
  const mapNodes = () => LEVELS.length + 1;
  const mapT = (i) => i / (mapNodes() - 1);                       // 0 … 1
  const mapX = (t) => 60 + t * (MAP_W - 132);
  const mapY = (t) => MAP_H / 2 - 58 * Math.sin(t * Math.PI * 2);  // die Schlangenlinie

  // Der Weg als Linienzug (viele kleine Punkte = schön rund)
  function mapPath(from, to) {
    let d = '';
    const steps = 64;
    for (let s = 0; s <= steps; s++) {
      const t = from + (to - from) * (s / steps);
      d += `${s ? 'L' : 'M'}${mapX(t).toFixed(1)} ${mapY(t).toFixed(1)} `;
    }
    return d.trim();
  }

  function buildLevelScreen() {
    const map = el('level-map');
    const done = levelsDone();
    const walked = mapT(Math.min(done, mapNodes() - 1));          // so weit ist das Pony schon
    map.innerHTML =
      `<svg class="map-path" viewBox="0 0 ${MAP_W} ${MAP_H}" aria-hidden="true">` +
        `<path class="path-back" d="${mapPath(0, 1)}"/>` +
        (done ? `<path class="path-done" d="${mapPath(0, walked)}"/>` : '') +
        `<path class="path-dash" d="${mapPath(0, 1)}"/>` +
      `</svg>`;

    // Beschriftung immer auf die Außenseite der Kurve legen, damit sie nicht
    // auf dem Weg liegt: Station oben → Text oben, Station unten → Text unten.
    const place = (node, t) => {
      node.style.left = `${mapX(t) / MAP_W * 100}%`;
      node.style.top = `${mapY(t) / MAP_H * 100}%`;
      if (mapY(t) < MAP_H / 2 - 8) node.classList.add('label-up');
    };
    // Tempo-Anzeige: kleine Balken, gefüllt = so schnell ist dieses Level
    const tempoBar = (nr) => {
      let s = '<span class="tempo">';
      for (let k = 1; k <= LEVELS.length; k++) s += `<i${k <= nr ? ' class="on"' : ''}></i>`;
      return s + '</span>';
    };

    LEVELS.forEach((L, i) => {
      const rec = levelRecord(L.id);
      const open = isUnlocked(i);
      const next = open && !rec.done;                             // hier geht es weiter
      const node = document.createElement('div');
      node.className = 'level-node' + (open ? '' : ' locked') + (rec.done ? ' done' : '') + (next ? ' next' : '');
      place(node, mapT(i));
      node.innerHTML =
        `<button class="node-dot"${open ? '' : ' disabled'} title="${L.name}: ${L.meters} m, Tempo ${L.speed}">` +
          `${open ? L.emoji : '🔒'}<span class="node-nr">${L.nr}</span></button>` +
        `<span class="node-label">` +
          `<span class="node-name">${open ? L.name : 'gesperrt'}</span>` +
          `<span class="node-meta">${L.meters} m ${tempoBar(L.nr)}</span>` +
          `<span class="node-stars"><b>${'★'.repeat(rec.stars)}</b>${'☆'.repeat(3 - rec.stars)}</span>` +
        `</span>`;
      if (open) node.querySelector('.node-dot').addEventListener('click', () => startLevel(i));
      map.appendChild(node);
    });

    const teaser = document.createElement('div');
    teaser.className = 'level-node locked';
    place(teaser, 1);
    teaser.innerHTML =
      `<button class="node-dot" disabled>🦄</button>` +
      `<span class="node-label"><span class="node-name">Einhorn-Level</span>` +
      `<span class="node-meta">kommen bald</span></span>`;
    map.appendChild(teaser);

    el('level-progress').innerHTML =
      `<strong>${done} von ${LEVELS.length}</strong> Leveln geschafft · ` +
      `★ <strong>${totalStars()}</strong> von ${LEVELS.length * 3} · ${save.wallet} 🪙`;
  }

  el('btn-start').addEventListener('click', () => showScreen('levels'));
  el('btn-endless').addEventListener('click', startEndless);
  el('btn-levels-back').addEventListener('click', () => showScreen('title'));
  el('btn-pause').addEventListener('click', pauseGame);
  el('btn-resume').addEventListener('click', resumeGame);
  el('btn-pause-retry').addEventListener('click', () => { leaveRun(); startRun(); });
  el('btn-pause-quit').addEventListener('click', () => {
    leaveRun();
    showScreen(mode === 'level' ? 'levels' : 'title');
  });
  el('btn-retry').addEventListener('click', startRun);
  el('btn-dead-back').addEventListener('click', () => showScreen(mode === 'level' ? 'levels' : 'title'));
  el('won-again').addEventListener('click', startRun);
  el('won-back').addEventListener('click', () => showScreen('levels'));
  el('won-next').addEventListener('click', () => {
    if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
    else showScreen('levels');
  });

  const openShop = () => { screenBeforeShop = currentScreen; showScreen('shop'); };
  el('btn-shop').addEventListener('click', openShop);
  el('btn-shop2').addEventListener('click', openShop);
  el('btn-shop-back').addEventListener('click', () => showScreen(screenBeforeShop));
  el('btn-reset').addEventListener('click', () => {
    if (confirm('Wirklich alle Münzen, Sterne und freigeschalteten Level löschen?')) {
      save = { wallet: 0, best: 0, levels: {} };
      writeSave();
      mode = 'level'; levelIndex = 0; level = LEVELS[0];   // Lauf verwerfen
      paused = false;
      resetWorld();
      showScreen('title');
    }
  });

  /* ---------- 9. Hauptschleife ------------------------------------------ */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);   // nie zu große Zeitsprünge
    last = now;
    fitCanvasToScreen();
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  if (DEBUG) {
    // Für Tests und die Browser-Konsole: window.PONY_DEBUG.getState()
    window.PONY_DEBUG = {
      getState: () => ({ state, mode, level, cameraX, goalX, speed, runCoins, coinsTotal,
                         tightest, pony, obstacles, holes, coins, save, images }),
      // Baut alle Level einmal und sagt, wie knapp der engste Absprung ist
      checkAll: () => {
        const before = { mode, level, levelIndex };
        const out = LEVELS.map((L, i) => {
          mode = 'level'; level = L; levelIndex = i;
          resetWorld();
          return { nr: L.nr, name: L.name, verlangt: L.win || DEFAULT_WINDOW,
                   fenster: +tightest.toFixed(3), hindernisse: obstacles.length,
                   loecher: holes.length, muenzen: coinsTotal };
        });
        mode = before.mode; level = before.level; levelIndex = before.levelIndex;
        resetWorld();
        return out;
      },
      startLevel, startEndless,
    };
  }

  window.addEventListener('resize', fitCanvasToScreen);
  fitCanvasToScreen();

  // Startzustand: Level 1 vorbereiten, damit die Welt gezeichnet werden kann
  level = LEVELS[0];
  levelIndex = 0;
  resetWorld();
  showScreen('title');

  // Entwickler-Abkürzungen: ?level=3 startet Level 3, ?autostart den Endlos-Modus
  const levelParam = parseInt(new URLSearchParams(location.search).get('level'), 10);
  if (Number.isFinite(levelParam) && LEVELS.length) startLevel(clamp(levelParam - 1, 0, LEVELS.length - 1));
  else if (location.search.includes('autostart')) startEndless();

  requestAnimationFrame(frame);
})();
