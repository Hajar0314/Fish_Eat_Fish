// world.js — biomes, cycle jour/nuit, événements, décor animé, parallaxe, épaves et coffres au trésor
class HiddenObstacle { constructor(x, y, r) { this.pos = createVector(x, y); this.r = r; } show() { } }

// Poisson lumineux qui ne sort que la nuit (25 points)
class NightFish extends Prey {
  constructor(x, y) { super(x, y, { r: 6, speed: 2.3, force: 0.1, col: '#7ad7ff', glow: true }, random(.9, 1.2)); }
  show() { super.show(true); }
}

const World = (() => {
  const BI = {
    reef: { name: 'Récif corallien', tint: [255, 120, 150, 34] }, kelp: { name: 'Forêt de kelp', tint: [60, 200, 110, 40] },
    wreck: { name: "Cimetière d'épaves", tint: [170, 140, 90, 36] }, cave: { name: 'Grotte sous-marine', tint: [110, 70, 170, 70] },
    abyss: { name: 'Fosse abyssale', tint: [10, 30, 100, 70] },
  };
  const BCOL = { reef: [255, 130, 150], kelp: [60, 190, 110], wreck: [160, 140, 90], cave: [120, 80, 180], abyss: [30, 60, 130] };
  const DAY = [[43, 179, 214], [14, 95, 138], [8, 42, 74], [1, 5, 16]], NIGHT = [[12, 40, 90], [7, 26, 58], [4, 13, 34], [1, 5, 16]];
  const CYCLE = 7200, S = { ready: false };
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  const biomeAt = (x, y) => S.stg ? S.key : y > WH * .8 ? 'abyss' : (y > WH * .55 && x < WW * .45) ? 'cave' : x < WW * .33 ? 'reef' : x < WW * .66 ? 'kelp' : 'wreck';
  const fracBiome = f => f < .33 ? 'reef' : f < .66 ? 'kelp' : 'wreck';
  const onScr = (x, y, m = 120) => x > cam.x - m && x < cam.x + width + m && y > cam.y - m && y < cam.y + height + m;
  const chest = (x, y) => ({ x, y, cool: 0 });

  // ---------- Stages : un biome par carte (palette, obscurité, événements, décor) ----------
  //  size  : taille de la carte en largeurs / hauteurs d'écran      pal / npal : dégradé jour / nuit (4 couleurs, surface -> fond)
  //  dark  : obscurité ambiante [surface, fond]                      ev : événements possibles ([] = aucun)
  //  rays  : intensité des rayons de lumière                         cycle : false = pas de cycle jour/nuit
  const STG = {
    reef: { size: [3.4, 1.7], pal: [[72, 208, 228], [30, 146, 190], [16, 86, 128], [8, 44, 76]], npal: [[12, 44, 96], [8, 30, 66], [4, 16, 40], [2, 8, 22]], tint: [255, 120, 150, 30],
      rock: [104, 82, 90], floor: [214, 186, 152], dark: [0, .26], rays: 1, cycle: true, ev: ['storm', 'whirl'], passers: true, nf: false, schools: 2, spires: 3, motes: 14, moteY: .55 },
    kelp: { size: [4, 2], pal: [[54, 192, 170], [24, 126, 122], [12, 72, 82], [5, 36, 46]], npal: [[10, 46, 70], [6, 32, 52], [3, 18, 32], [1, 8, 18]], tint: [60, 200, 110, 40],
      rock: [58, 86, 70], floor: [92, 118, 78], dark: [.04, .4], rays: .8, cycle: true, ev: ['whirl'], passers: true, nf: false, schools: 1.6, spires: 3, motes: 24, moteY: .5 },
    wreck: { size: [4.4, 2.2], pal: [[112, 172, 190], [62, 112, 132], [36, 66, 86], [14, 30, 42]], npal: [[14, 38, 66], [9, 26, 46], [5, 16, 30], [2, 8, 16]], tint: [170, 140, 90, 38],
      rock: [98, 88, 72], floor: [132, 114, 82], dark: [.1, .52], rays: .6, cycle: true, ev: ['storm', 'whirl'], passers: true, nf: false, schools: 1, spires: 4, motes: 30, moteY: .5 },
    cave: { size: [4, 2.6], pal: [[50, 42, 104], [36, 28, 84], [24, 18, 58], [9, 7, 28]], npal: [[50, 42, 104], [36, 28, 84], [24, 18, 58], [9, 7, 28]], tint: [110, 70, 170, 60],
      rock: [74, 58, 104], floor: [58, 46, 86], dark: [.36, .68], rays: 0, cycle: false, ev: ['erupt'], passers: false, nf: false, schools: 0, spires: 5, motes: 60, moteY: .15, ceil: true },
    abyss: { size: [5, 3], pal: [[12, 42, 104], [7, 26, 72], [3, 13, 42], [1, 5, 17]], npal: [[12, 42, 104], [7, 26, 72], [3, 13, 42], [1, 5, 17]], tint: [10, 30, 100, 70],
      rock: [42, 52, 84], floor: [20, 28, 50], dark: [.5, .78], rays: 0, cycle: false, ev: ['erupt', 'whirl'], passers: false, nf: true, schools: 0, spires: 8, motes: 90, moteY: .2 },
  };

  function init(key) {
    if (key && STG[key]) return initStage(key);
    const sgn = () => random() < .5 ? -1 : 1, sc = WW / (3 * width);
    Object.assign(S, { stg: null, key: null, stal: [], fsp: [], lamps: [], fl: [], ce: [], ready: true, t: 0, day: 1, night: 0, dk: 0, ev: null, evT: 900, banner: null, biome: null, bT: 0, passT: 700, hid: false, tint: [0, 0, 0, 0],
      kelp: [], corals: [], crystals: [], wrecks: [], chests: [], passers: [], nf: [], motes: [], ledge: [], plume: [] });
    S.schools = Array.from({ length: round(5 * sc) }, () => ({ x: random(WW * .35 + width), y: random(WH * .35 + height), vx: random(.3, .7) * sgn(), n: Array.from({ length: 10 }, () => ({ dx: random(-40, 40), dy: random(-18, 18) })) }));
    S.weeds = Array.from({ length: round(26 * sc) }, () => ({ x: random(WW * .55 + width), h: random(60, 170), ph: random(TWO_PI) }));
    S.spires = Array.from({ length: round(12 * sc) }, () => ({ x: random(WW * .25 + width), h: random(90, 260), w: random(50, 110) }));
    S.snow = [0, 1].map(() => Array.from({ length: 60 }, () => ({ x: random(width), y: random(height), s: random(1, 3) })));
    // Forêt de kelp : longues algues qui cachent les poissons
    for (let i = 0, n = round(WW * .33 / 55); i < n; i++) S.kelp.push({ x: WW * .33 + random(WW * .33), y: WH * .8 - random(0, 30), h: random(220, 430), ph: random(TWO_PI) });
    // Récif : corniche rocheuse (avec un passage vers la grotte) + coraux
    for (let x = 40; x < WW * .45; x += 85) {
      if (x > WW * .12 && x < WW * .12 + 240) continue;
      const o = new Obstacle(x, WH * .55 + 40, random(38, 52)); o.c = color(78 + random(20), 66 + random(18), 70 + random(20)); obstacles.push(o); S.ledge.push({ x, y: WH * .55 + 10 });
    }
    const PAL = [[255, 110, 150], [255, 160, 70], [200, 90, 220], [255, 220, 90]];
    for (let i = 0, n = round(WW * .33 / 40); i < n; i++) S.corals.push({ x: random(WW * .33), y: WH * .55 - 4 + random(-6, 16), type: floor(random(3)), s: random(30, 70), col: random(PAL), ph: random(TWO_PI) });
    // Grotte : rochers + cristaux lumineux
    const CR = [[120, 220, 255], [255, 120, 220], [150, 255, 180]];
    for (let i = 0, n = round(7 * sc); i < n; i++) { const o = new Obstacle(random(WW * .03, WW * .42), random(WH * .62, WH * .78), random(28, 50)); o.c = color(60 + random(20), 50 + random(20), 90 + random(30)); obstacles.push(o); }
    for (let i = 0, n = round(18 * sc); i < n; i++) S.crystals.push({ x: random(WW * .02, WW * .44), y: random(WH * .6, WH * .8), h: random(20, 46), col: random(CR), ph: random(TWO_PI) });
    // Épaves + coffres
    for (let wi = 0, nW = round(3 * sc); wi < nW; wi++) {
      const f = .68 + wi * .29 / Math.max(1, nW - 1);
      const w = { x: WW * f, y: WH * .78, a: random(-.2, .2), s: random(.9, 1.2) }; S.wrecks.push(w);
      for (const dx of [-120, -40, 40, 120]) obstacles.push(new HiddenObstacle(w.x + dx * w.s * cos(w.a), w.y - 10 + dx * w.s * sin(w.a), 44 * w.s));
      S.chests.push(chest(w.x, w.y + 25 * w.s));
    }
    for (let i = 0, n = round(2 * sc); i < n; i++) S.chests.push(chest(random(WW * .04, WW * .42), WH * .77), chest(random(WW * .34, WW * .65), WH * .79), chest(random(WW * .05, WW * .95), WH - 50));
    for (let i = 0, n = round(100 * sc); i < n; i++) S.motes.push({ x: random(WW), y: random(WH * .8, WH), ph: random(TWO_PI) });
  }


  // ---------- Construction d'un stage : le décor couvre toute la carte ----------
  function initStage(k) {
    const st = STG[k], W1 = WW / width, sgn = () => random() < .5 ? -1 : 1, PAL = [[255, 110, 150], [255, 160, 70], [200, 90, 220], [255, 220, 90]];
    Object.assign(S, { ready: true, stg: st, key: k, t: 0, day: 1, night: 0, dk: 0, ev: null, evT: random(1100, 1700), banner: null, biome: null, bT: 0, passT: 700, hid: false, tint: st.tint.slice(),
      kelp: [], corals: [], crystals: [], wrecks: [], chests: [], passers: [], nf: [], motes: [], ledge: [], plume: [], stal: [], fsp: [], lamps: [], fl: [], ce: [] });
    // fonds parallaxe
    S.schools = Array.from({ length: round(st.schools * W1) }, () => ({ x: random(WW * .35 + width), y: random(WH * .35 + height), vx: random(.3, .7) * sgn(), n: Array.from({ length: 10 }, () => ({ dx: random(-40, 40), dy: random(-18, 18) })) }));
    S.weeds = Array.from({ length: round(8 * W1) }, () => ({ x: random(WW * .55 + width), h: random(60, 170), ph: random(TWO_PI) }));
    S.spires = Array.from({ length: round(st.spires * W1) }, () => ({ x: random(WW * .25 + width), h: random(90, 260) * (k === 'abyss' ? 1.4 : 1), w: random(50, 110) }));
    S.snow = [0, 1].map(() => Array.from({ length: 60 }, () => ({ x: random(width), y: random(height), s: random(1, 3) })));
    // sol (et plafond de la grotte) irréguliers, un point tous les 50 px
    for (let x = -50, i = 0; x < WW + 100; x += 50, i++) { S.fl.push(8 + 34 * noise(i * .23, 7)); if (st.ceil) S.ce.push(24 + 70 * noise(i * .19, 91)); }
    // rochers déjà créés par startGame : on les recolore dans la teinte du stage
    const [rr, rg, rb] = st.rock, tintRock = o => { o.c = color(rr + random(-12, 16), rg + random(-12, 16), rb + random(-12, 16)); return o; };
    for (const o of obstacles) if (o.c) tintRock(o);
    const rock = (x, y, r) => { const o = tintRock(new Obstacle(x, y, r)); obstacles.push(o); return o; };
    const onFloor = (n, f) => { for (let i = 0; i < n; i++) f(random(120, WW - 120), i); };
    for (let i = 0, n = round(st.motes * W1); i < n; i++) S.motes.push({ x: random(WW), y: random(WH * st.moteY, WH), ph: random(TWO_PI) });

    if (k === 'reef') {
      // tapis de coraux sur le fond + piliers coralliens à mi-profondeur
      for (let x = 30; x < WW - 30; x += random(26, 44)) S.corals.push({ x, y: WH - 4 + random(-4, 12), type: floor(random(3)), s: random(30, 74), col: random(PAL), ph: random(TWO_PI) });
      for (let i = 0, n = round(5 * W1); i < n; i++) {
        const o = rock(random(220, WW - 220), random(WH * .35, WH * .78), random(40, 62));
        for (let j = 0; j < 3; j++) S.corals.push({ x: o.pos.x + random(-o.r * .6, o.r * .6), y: o.pos.y - o.r * .78 + random(-3, 8), type: floor(random(3)), s: random(28, 56), col: random(PAL), ph: random(TWO_PI) });
      }
      onFloor(2, () => 0); S.chests.push(chest(random(WW * .2, WW * .45), WH - 16), chest(random(WW * .55, WW * .85), WH - 16));
    } else if (k === 'kelp') {
      // forêt dense d'un bout à l'autre de la carte
      for (let x = 20; x < WW - 20; x += random(34, 58)) S.kelp.push({ x, y: WH - random(0, 14), h: random(240, Math.min(520, WH * .62)), ph: random(TWO_PI) });
      for (let i = 0, n = round(6 * W1); i < n; i++) { const r = random(34, 56); rock(random(120, WW - 120), WH - r * .55, r); }
      for (let i = 0; i < 3; i++) S.chests.push(chest(WW * (.18 + i * .32) + random(-80, 80), WH - 16));
    } else if (k === 'wreck') {
      // épaves posées sur le fond, boulets de roche, coffres
      const nW = Math.max(3, round(WW / 1250));
      for (let i = 0; i < nW; i++) {
        const s = random(.9, 1.2), w = { x: WW * (.12 + .76 * i / (nW - 1)) + random(-60, 60), y: WH - 58 * s, a: random(-.2, .2), s }; S.wrecks.push(w);
        for (const dx of [-120, -40, 40, 120]) obstacles.push(new HiddenObstacle(w.x + dx * s * cos(w.a), w.y - 10 + dx * s * sin(w.a), 44 * s));
        S.chests.push(chest(w.x, w.y + 25 * s));
      }
      for (let i = 0, n = round(5 * W1); i < n; i++) { const r = random(30, 52); rock(random(100, WW - 100), WH - r * .6, r); }
      for (let i = 0; i < 2; i++) S.chests.push(chest(random(WW * .1, WW * .9), WH - 16));
      for (let x = 60; x < WW - 60; x += random(110, 220)) S.corals.push({ x, y: WH - 2 + random(0, 10), type: 1, s: random(26, 44), col: [120, 100, 76], ph: random(TWO_PI) });   // concrétions rouillées
    } else if (k === 'cave') {
      // galerie de rochers, stalactites / stalagmites, cristaux au sol et sur les roches
      for (let i = 0, n = round(9 * W1); i < n; i++) rock(random(120, WW - 120), random(WH * .22, WH * .86), random(30, 58));
      const CR = [[120, 220, 255], [255, 120, 220], [150, 255, 180]];
      for (let i = 0, n = round(12 * W1); i < n; i++) S.crystals.push({ x: random(40, WW - 40), y: WH - 2 + random(0, 8), h: random(24, 54), col: random(CR), ph: random(TWO_PI) });
      for (const o of obstacles) if (o.c && random() < .42) S.crystals.push({ x: o.pos.x + random(-o.r * .5, o.r * .5), y: o.pos.y - o.r * .8, h: random(18, 40), col: random(CR), ph: random(TWO_PI) });
      for (let x = 30; x < WW; x += random(55, 120)) S.stal.push({ x, h: random(70, 210), w: random(22, 50), top: true, j: random(-.4, .4) });
      for (let x = 30; x < WW; x += random(90, 190)) S.stal.push({ x, h: random(40, 140), w: random(22, 46), top: false, j: random(-.4, .4) });
      for (let i = 0, n = round(3 * W1); i < n; i++) S.lamps.push({ x: random(160, WW - 160), y: random(WH * .3, WH * .9), col: random(CR), ph: random(TWO_PI) });
      for (let i = 0; i < 3; i++) S.chests.push(chest(WW * (.15 + i * .33) + random(-100, 100), WH - 16));
    } else {   // abyss
      // tours de roche noire, lanternes bioluminescentes
      for (let x = 100; x < WW - 100; x += random(190, 340)) {
        const h = random(180, 520), w = random(50, 110);
        S.fsp.push({ x, h, w, j: Array.from({ length: 7 }, () => random(-.18, .18)) }); obstacles.push(new HiddenObstacle(x, WH - h * .16, w * .55));
      }
      for (let i = 0, n = round(5 * W1); i < n; i++) rock(random(120, WW - 120), random(WH * .2, WH * .85), random(30, 54));
      const LC = [[90, 200, 255], [150, 255, 200], [200, 140, 255]];
      for (let i = 0, n = round(6 * W1); i < n; i++) S.lamps.push({ x: random(120, WW - 120), y: random(WH * .25, WH - 70), col: random(LC), ph: random(TWO_PI) });
      for (let i = 0; i < 3; i++) S.chests.push(chest(WW * (.18 + i * .32) + random(-100, 100), WH - 24));
    }
  }

  // Sol / plafond irréguliers du stage
  function band(top) {
    const arr = top ? S.ce : S.fl; if (!arr.length) return;
    if (top ? cam.y > 140 : cam.y + height < WH - 140) return;
    const i0 = Math.max(0, Math.floor((cam.x + 50) / 50) - 1), i1 = Math.min(arr.length - 1, Math.ceil((cam.x + width + 50) / 50) + 1), c = S.stg.floor, X = i => -50 + i * 50, Y = i => top ? arr[i] : WH - arr[i];
    noStroke(); fill(c[0], c[1], c[2]); beginShape(); vertex(X(i0), top ? -200 : WH + 200);
    for (let i = i0; i <= i1; i++) vertex(X(i), Y(i));
    vertex(X(i1), top ? -200 : WH + 200); endShape(CLOSE);
    noFill(); stroke(255, 255, 255, 38); strokeWeight(3); beginShape(); for (let i = i0; i <= i1; i++) vertex(X(i), Y(i)); endShape(); noStroke();
  }

  // Décor propre aux stages (dessiné avant le reste du décor)
  function stageBack() {
    const st = S.stg, c = st.floor;
    band(false); band(true);
    // stalactites (haut) et stalagmites (bas)
    noStroke();
    for (const s of S.stal) {
      if (s.x < cam.x - 90 || s.x > cam.x + width + 90) continue;
      const y0 = s.top ? S.ce[Math.max(0, Math.min(S.ce.length - 1, Math.round((s.x + 50) / 50)))] - 6 : WH - S.fl[Math.max(0, Math.min(S.fl.length - 1, Math.round((s.x + 50) / 50)))] + 6, d = s.top ? 1 : -1, ty = y0 + d * s.h;
      if (s.top ? cam.y > ty + 40 : cam.y + height < ty - 40) continue;
      fill(Math.min(255, c[0] * 1.25), Math.min(255, c[1] * 1.25), Math.min(255, c[2] * 1.4)); triangle(s.x - s.w, y0, s.x + s.w, y0, s.x + s.j * s.w, ty);
      fill(255, 255, 255, 34); triangle(s.x - s.w * .1, y0, s.x + s.w, y0, s.x + s.j * s.w, ty);
    }
    // tours abyssales
    for (const p of S.fsp) {
      if (p.x < cam.x - 140 || p.x > cam.x + width + 140 || cam.y + height < WH - p.h - 40) continue;
      const b = WH + 20, w = p.w, h = p.h, j = p.j;
      const pts = [[-w, b], [-w * (.7 + j[0]), WH - h * .35], [-w * (.4 + j[1]), WH - h * .62], [-w * (.14 + j[2]), WH - h * .82], [w * j[3] * .6, WH - h], [w * (.2 + j[4]), WH - h * .7], [w * (.55 + j[5]), WH - h * .42], [w * (.85 + j[6]), WH - h * .16], [w, b]];
      fill(c[0] * .9, c[1] * .9, c[2] * 1.15); beginShape(); for (const [dx, y] of pts) vertex(p.x + dx, y); endShape(CLOSE);
      noFill(); stroke(70, 130, 255, 55); strokeWeight(2); beginShape(); for (let i = 1; i < pts.length - 1; i++) vertex(p.x + pts[i][0], pts[i][1]); endShape(); noStroke();
    }
    // lanternes bioluminescentes
    for (const l of S.lamps) {
      if (!onScr(l.x, l.y, 120)) continue;
      const [r, g, b] = l.col, pu = .75 + .25 * Math.sin(frameCount * .05 + l.ph), dc = drawingContext;
      dc.shadowBlur = 34; dc.shadowColor = `rgb(${r},${g},${b})`;
      noFill(); stroke(r, g, b, 120); strokeWeight(2);
      for (let i = -2; i <= 2; i++) { beginShape(); for (let t = 0; t <= 5; t++) vertex(l.x + i * 5 + Math.sin(frameCount * .04 + l.ph + t * .8 + i) * 5 * t / 5, l.y + 6 + t * 7); endShape(); }
      noStroke(); fill(r, g, b, 215 * pu); ellipse(l.x, l.y, 22, 17); fill(255, 255, 255, 170 * pu); ellipse(l.x - 3, l.y - 3, 7, 5);
      dc.shadowBlur = 0;
    }
  }

  const inKelp = f => S.ready && S.kelp.some(k => Math.abs(f.pos.x - k.x) < 26 && f.pos.y > k.y - k.h && f.pos.y < k.y);

  function startEvent() {
    const pool = S.stg ? S.stg.ev.filter(e => e !== 'erupt' || vents.length) : ['storm', 'whirl', 'erupt'];
    if (!pool.length) { S.evT = 1e9; return; }
    const k = random(pool);
    if (k === 'storm') S.ev = { type: k, t: 700, dur: 700, dir: random() < .5 ? -1 : 1 };
    else if (k === 'whirl') { const a = random(TWO_PI), d = random(300, 600); S.ev = { type: k, t: 800, dur: 800, x: constrain(player.pos.x + cos(a) * d, 200, WW - 200), y: constrain(player.pos.y + sin(a) * d, 200, WH - 200) }; }
    else { const vs = vents.slice().sort((a, b) => a.pos.dist(player.pos) - b.pos.dist(player.pos)); S.ev = { type: k, t: 560, dur: 560, v: vs[floor(random(Math.min(3, vs.length)))] }; }
    S.banner = { t: 200, txt: { storm: '🌊 Tempête en surface !', whirl: '🌀 Un tourbillon se forme !', erupt: '🌋 Éruption de la source hydrothermale !' }[k] };
    snd.event(k);
  }

  function spawnPasser() {
    const dolphin = random() < .45, dir = random() < .5 ? 1 : -1, y = constrain(cam.y + random(height * .25, height * .7), 80, WH - 200);
    S.passers.push({ dolphin, x: dir > 0 ? cam.x - 200 : cam.x + width + 200, y, y0: y, vx: dir * (dolphin ? random(2.6, 3.4) : random(.7, 1)), ph: random(TWO_PI), s: dolphin ? 1 : random(.9, 1.3) });
    if (dolphin) snd.chirp(-dir * .7);
  }

  // Appelé à chaque image de jeu, avant la mise à jour des poissons
  function step(all, obs, hunters) {
    S.t++;
    if (S.stg && S.stg.cycle === false) { S.day = .4; S.night = 0; }   // grotte / abysses : pas de jour ni de nuit
    else { S.day = .5 + .5 * cos(TWO_PI * S.t / CYCLE); S.night = constrain(map(S.day, .55, .15, 0, 1), 0, 1); }
    const b = biomeAt(player.pos.x, player.pos.y); if (b !== S.biome) { S.biome = b; S.bT = 150; }
    S.hid = inKelp(player);
    // Poissons de nuit
    const want = (S.night > .5 || (S.stg && S.stg.nf)) ? 30 : 0;
    if (want) { const i = S.nf.findIndex(n => n.pos.dist(player.pos) > 1800); if (i >= 0) S.nf.splice(i, 1); }
    while (S.nf.length < want) { const a = random(TWO_PI), d = random(600, 1100); S.nf.push(new NightFish(constrain(player.pos.x + cos(a) * d, 50, WW - 50), constrain(player.pos.y + sin(a) * d, 50, WH - 50))); }
    if (S.nf.length > want) { const i = S.nf.findIndex(n => !vis(n, 200)); if (i >= 0) S.nf.splice(i, 1); }
    S.nf.forEach(n => n.think(S.nf, all, obs, hunters));
    // Événements
    if (S.ev) { if (--S.ev.t <= 0) { S.ev = null; S.evT = random(1500, 2700); } } else if (--S.evT <= 0) startEvent();
    const ev = S.ev;
    if (ev && ev.type === 'storm') shake = Math.max(shake, 1.1);
    if (ev && ev.type === 'erupt') {
      const act = ev.dur - ev.t > 120, v = ev.v.pos;
      if (ev.dur - ev.t === 120) shake = Math.max(shake, 10);
      if (act) for (let i = 0; i < 3; i++) S.plume.push({ x: v.x + random(-25, 25), y: v.y - 16, vx: random(-.8, .8), l: 90 });
    }
    for (let i = S.plume.length - 1; i >= 0; i--) { const p = S.plume[i]; p.y -= 4.5; p.x += p.vx; if (--p.l <= 0) S.plume.splice(i, 1); }
    const list = !ev ? null : [...all, ...preys.filter(v => vis(v, 800)), ...preds.filter(v => vis(v, 1300)), ...squids.filter(v => vis(v, 1300)), ...wild.filter(v => vis(v, 1300)), ...critters.filter(v => vis(v, 1300)), ...jellies.filter(v => vis(v, 800)), ...golds, ...S.nf];
    if (ev) {
      const k = constrain(Math.min(ev.t, ev.dur - ev.t) / 60, 0, 1);
      for (const v of list) {
        if (ev.type === 'storm' && v.pos.y < WH * .35) { const s = (1 - v.pos.y / (WH * .35)) * k; v.applyForce(createVector(ev.dir * .09 * s, sin(frameCount * .05 + v.pos.x * .01) * .04 * s)); }
        else if (ev.type === 'whirl') {
          const dx = v.pos.x - ev.x, dy = v.pos.y - ev.y, d = Math.hypot(dx, dy), R = 280;
          if (d < R && d > 1) { const q = (1 - d / R) * k; v.applyForce(createVector((-dy / d) * .22 * q - (dx / d) * .1 * q, (dx / d) * .22 * q - (dy / d) * .1 * q)); }
        } else if (ev.type === 'erupt' && ev.dur - ev.t > 120) {
          const dx = Math.abs(v.pos.x - ev.v.pos.x), up = ev.v.pos.y - v.pos.y;
          if (dx < 70 && up > -10 && up < 430) {
            v.applyForce(createVector(0, -.35));
            if (v === player && !inv && !fx.shield && !fx.frenzy) { lives--; killer = { sp: { name: 'Éruption' } }; inv = 90; shake = 14; combo = 0; snd.hurt(0); bubblesAt(v.pos); }
          }
        }
      }
    }
    S.nf.forEach(n => n.update());
    // Poissons de nuit mangés
    for (let i = S.nf.length - 1; i >= 0; i--) {
      const n = S.nf[i];
      for (const f of all) if (f.r > n.r * 1.15 && f.pos.dist(n.pos) < f.r + n.r * .4) { S.nf.splice(i, 1); eaten++; addScore(25, n.pos.x, n.pos.y); bubblesAt(f.pos); snd.eat(panOf(n.pos.x)); break; }
    }
    // Coffres au trésor
    for (const c of S.chests) {
      if (c.cool > 0) { c.cool--; continue; }
      for (const f of all) if (f.pos.dist(createVector(c.x, c.y)) < f.r + 34) {
        c.cool = 3600; addScore(300, c.x, c.y); Stage.onChest(); Eco.bonus(c.x, c.y - 20, 12, 2); floatText(c.x, c.y - 34, '💰 Trésor !', '#ffd700'); snd.chest(panOf(c.x)); bubblesAt({ x: c.x, y: c.y });
        if (random() < .6) pups.push({ x: c.x, y: c.y - 30, t: random(Object.keys(PUPS)), ph: random(TWO_PI) });
        break;
      }
    }
    // Tortues et dauphins de passage
    if (--S.passT <= 0) { S.passT = random(900, 1700); if (!S.stg || S.stg.passers) spawnPasser(); }
    for (let i = S.passers.length - 1; i >= 0; i--) {
      const p = S.passers[i]; p.x += p.vx; p.y = p.y0 + (p.dolphin ? sin(p.x * .012 + p.ph) * 70 : sin(p.x * .01 + p.ph) * 14);
      if (Math.abs(p.x - (cam.x + width / 2)) > width + 450) S.passers.splice(i, 1);
    }
  }

  // Obscurité ambiante (f = profondeur 0..1) : en stage, chaque carte a sa propre plage [surface, fond]
  const amb = f => {
    const d = dark();
    if (!S.ready || !S.stg) return Math.max(constrain(map(f, .4, 1, 0, .78), 0, .78), d);
    const [a, b] = S.stg.dark; return Math.max(a + (b - a) * constrain(f * 1.15, 0, 1), d);
  };
  const dark = () => { if (!S.ready) return 0; if (S.stg) { S.dk += (S.night * .35 - S.dk) * .03; return S.dk; } const tg = S.biome === 'cave' ? .55 : S.biome === 'abyss' ? .6 : 0; S.dk += (Math.max(tg, S.night * .35) - S.dk) * .03; return S.dk; };

  // ---------- Fond : dégradé jour/nuit + couches de parallaxe ----------
  function background() {
    const rd = S.ready, night = rd ? S.night : 0, cy = rd ? cam.y : 0, bot = rd ? WH : height;
    const g = drawingContext.createLinearGradient(0, -cy, 0, bot - cy);
    const pd = rd && S.stg ? S.stg.pal : DAY, pn = rd && S.stg ? S.stg.npal : NIGHT;
    [0, .35, .7, 1].forEach((p, i) => g.addColorStop(p, mix(pd[i], pn[i], night)));
    drawingContext.fillStyle = g; drawingContext.fillRect(0, 0, width, height);
    // Rayons de lumière (parallaxe .25), plus faibles la nuit et en profondeur
    const span = width * 1.6, fade = rd ? constrain(1 - cam.y / (WH * .5), 0, 1) : 1, day = rd ? S.day : 1, tt = rd ? S.t : frameCount;
    noStroke(); fill(255 - 85 * night, 255 - 40 * night, 255, 16 * Math.max(.25, day) * fade * (rd && S.stg ? S.stg.rays : 1));
    for (let i = 0; i < 5; i++) { const sx = (((i * span / 5 + tt * .15) - (rd ? cam.x : 0) * .25) % span + span) % span - span * .2; quad(sx, 0, sx + 60, 0, sx + 200, height * .65, sx + 90, height * .65); }
    if (!rd) return;
    const mx = Math.max(1, WH - height), df = constrain(cam.y / mx * 1.3 - .1, 0, 1);
    // Couche lointaine (.25) : pics rocheux
    for (const s of S.spires) { const sx = s.x - cam.x * .25, base = height + (cam.y - mx) * .25; fill(4, 18, 42, 120 * df); triangle(sx - s.w, base, sx, base - s.h, sx + s.w, base); }
    // Bancs de petits poissons en arrière-plan (.35)
    const sw = WW * .35 + width;
    fill(190, 225, 255, 55 * (1 - df * .5));
    for (const s of S.schools) {
      s.x += s.vx; if (s.x > sw) s.x -= sw; if (s.x < 0) s.x += sw;
      const sx = s.x - cam.x * .35, sy = s.y - cam.y * .35, d = Math.sign(s.vx);
      for (let k = 0; k < s.n.length; k++) { const n = s.n[k], x = sx + n.dx, y = sy + n.dy + sin(frameCount * .1 + k) * 2; ellipse(x, y, 9, 4); triangle(x - d * 4, y, x - d * 10, y - 3, x - d * 10, y + 3); }
    }
    // Couche intermédiaire (.55) : algues ondulantes teintées selon le biome, visibles en descendant
    const base = height + (cam.y - mx) * .55; noFill(); strokeWeight(6);
    for (const w of S.weeds) {
      const c = S.stg ? BCOL[S.key] : BCOL[fracBiome(w.x / (WW * .55 + width))], sx = w.x - cam.x * .55;
      stroke(c[0] * .55, c[1] * .55, c[2] * .55, 190 * df); beginShape();
      for (let i = 0; i <= 6; i++) { const t = i / 6; vertex(sx + sin(frameCount * .03 + w.ph + t * 2) * 14 * t, base - w.h * t); }
      endShape();
    }
    // Neige marine sur deux plans (.3 et .7)
    noStroke();
    S.snow.forEach((layer, l) => { const f = l ? .7 : .3; fill(255, 255, 255, 80 + 60 * l);
      for (const s of layer) circle(((s.x - cam.x * f) % width + width) % width, ((s.y - cam.y * f - S.t * .1 * (l + 1) * s.s) % height + height) % height, s.s * (1 + l * .5)); });
  }

  // ---------- Décor du monde (coordonnées du monde, derrière les poissons) ----------
  function decor() {
    if (!S.ready) return;
    if (S.stg) stageBack();
    noStroke(); fill(70, 58, 78);
    for (const l of S.ledge) if (onScr(l.x, l.y + 60)) triangle(l.x - 22, l.y + 30, l.x + 22, l.y + 30, l.x + sin(l.x) * 8, l.y + 70 + (l.x % 37));
    for (const c of S.corals) {
      if (!onScr(c.x, c.y, 100)) continue;
      push(); translate(c.x, c.y); const [r, g, b] = c.col, sw = sin(frameCount * .03 + c.ph) * 4;
      if (c.type === 0) { stroke(r, g, b); strokeWeight(6); for (let i = -2; i <= 2; i++) line(0, 0, i * 9 + sw, -c.s * (.7 + .1 * (2 - abs(i)))); noStroke(); fill(255, 255, 255, 130); for (let i = -2; i <= 2; i++) circle(i * 9 + sw, -c.s * (.7 + .1 * (2 - abs(i))), 6); }
      else if (c.type === 1) { noStroke(); fill(r, g, b); arc(0, 0, c.s * 1.5, c.s * 1.2, PI, TWO_PI); fill(255, 255, 255, 60); circle(-c.s * .2, -c.s * .25, 6); circle(c.s * .15, -c.s * .35, 8); circle(c.s * .3, -c.s * .12, 5); }
      else { noStroke(); fill(r, g, b, 210); ellipse(sw * .5, -c.s * .55, c.s * 1.1, c.s * 1.1); stroke(255, 255, 255, 80); strokeWeight(2); for (let i = -2; i <= 2; i++) line(0, 0, i * c.s * .2 + sw * .5, -c.s); }
      pop();
    }
    noFill();
    for (const k of S.kelp) {
      if (Math.abs(k.x - (cam.x + width / 2)) > width / 2 + 100 || k.y < cam.y || k.y - k.h > cam.y + height) continue;
      for (const [w, col] of [[10, [30, 120, 60]], [4, [90, 200, 110]]]) {
        stroke(col[0], col[1], col[2], 225); strokeWeight(w); beginShape();
        for (let i = 0; i <= 8; i++) { const t = i / 8; vertex(k.x + sin(frameCount * .03 + k.ph + t * 2.2) * 18 * t + (w < 6 ? 3 : 0), k.y - k.h * t); }
        endShape();
      }
    }
    noStroke(); drawingContext.shadowBlur = 18;
    for (const c of S.crystals) {
      if (!onScr(c.x, c.y, 80)) continue;
      const [r, g, b] = c.col; drawingContext.shadowColor = `rgb(${r},${g},${b})`; fill(r, g, b, 170 + 60 * sin(frameCount * .05 + c.ph));
      triangle(c.x - 9, c.y, c.x + 9, c.y, c.x, c.y - c.h); triangle(c.x + 4, c.y, c.x + 16, c.y, c.x + 10, c.y - c.h * .6);
    }
    drawingContext.shadowBlur = 0;
    for (const w of S.wrecks) {
      if (!onScr(w.x, w.y, 260)) continue;
      push(); translate(w.x, w.y); rotate(w.a); scale(w.s); noStroke();
      fill(78, 56, 40); beginShape(); vertex(-180, -20); vertex(180, -40); vertex(140, 50); vertex(-150, 60); endShape(CLOSE);
      fill(56, 40, 30); rect(-170, -5, 330, 6); rect(-160, 25, 300, 5);
      fill(20, 30, 40); stroke(170, 140, 80); strokeWeight(3); for (let i = 0; i < 4; i++) circle(-110 + i * 70, 8, 22);
      noStroke(); fill(60, 44, 32); rect(-6, -170, 12, 150); rect(-70, -130, 140, 8);
      fill(210, 200, 170, 120); beginShape(); vertex(8, -125); vertex(70, -122); vertex(52, -70); vertex(10, -60); endShape(CLOSE);
      fill(40, 120, 70, 150); for (let i = 0; i < 5; i++) ellipse(-150 + i * 75, 55, 10, 40 + 10 * sin(frameCount * .04 + i));
      pop();
    }
    for (const c of S.chests) {
      if (!onScr(c.x, c.y, 80)) continue;
      const looted = c.cool > 0, el = 3600 - c.cool; if (looted && el > 150) continue;
      const o = looted ? constrain(el / 20, 0, 1) : 0;
      push(); translate(c.x, c.y); noStroke();
      if (!looted) { drawingContext.shadowBlur = 16; drawingContext.shadowColor = '#ffd700'; }
      fill(120, 72, 28); rect(-20, -14, 40, 22, 3); fill(90, 50, 20); rect(-20, -2, 40, 4);
      push(); translate(-20, -14); rotate(-o * 1.2); fill(140, 84, 32); arc(20, 0, 40, 28, PI, TWO_PI); pop();
      drawingContext.shadowBlur = 0; fill(255, 215, 0); rect(-4, -8, 8, 9, 2);
      if (looted) for (let i = 0; i < 6; i++) { const a = frameCount * .1 + i * 1.05; fill(255, 230, 120, 220 - el * 1.4); circle(cos(a) * (10 + el * .3), -20 + sin(a) * 8 - el * .2, 4); }
      else if ((frameCount + c.x) % 90 < 12) { fill(255); circle(10, -18, 5); }
      pop();
    }
    for (const m of S.motes) if (onScr(m.x, m.y, 40)) { fill(120, 200, 255, 80 + 70 * sin(frameCount * .04 + m.ph)); circle(m.x + sin(frameCount * .01 + m.ph) * 10, m.y, 5); }
    for (const p of S.passers) {
      if (!onScr(p.x, p.y, 200)) continue;
      const sg = Math.sign(p.vx); push(); translate(p.x, p.y); scale(sg, 1); noStroke();
      if (p.dolphin) {
        rotate(atan(cos(p.x * .012 + p.ph) * 70 * .012 * sg)); const w = sin(frameCount * .3) * 8;
        fill(120, 150, 185); ellipse(0, 0, 120, 34); ellipse(52, 2, 40, 26); triangle(-58, 0, -92, -18 + w, -92, 18 + w); triangle(-8, -14, 12, -14, -4, -36);
        fill(200, 220, 240); ellipse(6, 8, 80, 14); fill(20); circle(58, -2, 4);
      } else {
        scale(p.s); const f = sin(frameCount * .06) * 8; fill(110, 180, 130); ellipse(40, -4, 22, 17); ellipse(-6, 20 + f, 26, 10); ellipse(22, 20 - f, 26, 10); ellipse(-6, -22 - f, 26, 10);
        fill(70, 150, 110); ellipse(0, 0, 72, 46); fill(50, 115, 85); ellipse(0, 0, 48, 30); fill(20); circle(46, -7, 3);
      }
      pop();
    }
    // Visuels d'événements
    const ev = S.ev;
    if (ev && ev.type === 'storm' && cam.y < 300) {
      const k = constrain(Math.min(ev.t, ev.dur - ev.t) / 60, 0, 1); noFill(); stroke(255, 255, 255, 70 * k); strokeWeight(3);
      for (let i = 0; i < 6; i++) { beginShape(); for (let x = cam.x - 20; x < cam.x + width + 40; x += 30) vertex(x, 25 + i * 22 + sin(x * .02 + frameCount * .08 * ev.dir + i) * (8 + 8 * k)); endShape(); }
    }
    if (ev && ev.type === 'whirl' && onScr(ev.x, ev.y, 320)) {
      const k = constrain(Math.min(ev.t, ev.dur - ev.t) / 60, 0, 1); noFill(); strokeWeight(3);
      for (let i = 0; i < 6; i++) { stroke(220, 240, 255, 70 * k); const r = 30 + i * 38, a0 = frameCount * .05 * (1 + i * .15) + i; arc(ev.x, ev.y, r * 2, r * 2, a0, a0 + PI * 1.3); }
    }
    if (ev && ev.type === 'erupt') {
      const v = ev.v.pos;
      if (ev.dur - ev.t < 120) { noFill(); stroke(255, 90, 60, 160); strokeWeight(4); circle(v.x, v.y - 10, 80 + sin(frameCount * .3) * 20); }
    }
    noStroke(); for (const p of S.plume) { fill(255, 120 + p.l, 60, p.l * 3); circle(p.x, p.y, 6 + (90 - p.l) * .1); }
  }

  // ---------- Teinte du biome, nuit, tempête (par-dessus la scène) ----------
  function overlay() {
    if (!S.ready) return;
    const tg = S.stg ? S.stg.tint : BI[S.biome || 'reef'].tint; for (let i = 0; i < 4; i++) S.tint[i] += (tg[i] - S.tint[i]) * .03;
    noStroke(); fill(S.tint[0], S.tint[1], S.tint[2], S.tint[3]); rect(0, 0, width, height);
    const df = constrain(cam.y / Math.max(1, WH - height) * 1.3, 0, 1);
    if (S.night > .01) { fill(6, 10, 44, 120 * S.night * (1 - df * .6)); rect(0, 0, width, height); }
    if (S.ev && S.ev.type === 'storm') { fill(20, 30, 40, 90 * constrain(Math.min(S.ev.t, S.ev.dur - S.ev.t) / 60, 0, 1) * (1 - df)); rect(0, 0, width, height); }
  }

  // Info discrète en haut à gauche (pas de texte au centre de l'écran)
  function hud(hx = 14, hy = 32) {
    if (!S.ready) return;
    const b = BI[S.biome || 'reef'], ico = S.stg && S.stg.cycle === false ? '🌑' : S.night > .6 ? '🌙' : S.night > .15 ? '🌅' : '☀️', ev = S.ev;
    const evTxt = ev ? { storm: '🌊 tempête', whirl: '🌀 tourbillon', erupt: ev.dur - ev.t < 120 ? '🌋 éruption imminente !' : '🌋 éruption' }[ev.type] : '';
    noStroke(); textAlign(LEFT, CENTER); textSize(11); textStyle(NORMAL); fill(255, 255, 255, 200);
    text(`${ico} ${b.name}${evTxt ? '  ·  ' + evTxt : ''}${S.hid ? '  ·  🌿 caché' : ''}`, hx, hy);
  }

  function miniBg(sx, sy) {
    if (!S.ready) return; noStroke();
    if (S.stg) { const c = BCOL[S.key]; fill(c[0], c[1], c[2], 55); rect(0, 0, WW * sx, WH * sy); return; }
    for (const [x0, y0, x1, y1, b] of [[0, 0, .33, .55, 'reef'], [.33, 0, .66, .8, 'kelp'], [.66, 0, 1, .8, 'wreck'], [0, .55, .45, .8, 'cave'], [0, .8, 1, 1, 'abyss']]) {
      const c = BCOL[b]; fill(c[0], c[1], c[2], 55); rect(x0 * WW * sx, y0 * WH * sy, (x1 - x0) * WW * sx, (y1 - y0) * WH * sy);
    }
  }
  function mini(sx, sy) {
    if (!S.ready) return; noStroke(); fill(255, 215, 0); for (const c of S.chests) if (!c.cool) rect(c.x * sx - 2, c.y * sy - 2, 4, 4);
    const ev = S.ev; if (!ev) return;
    if (ev.type === 'storm') { fill(255, 255, 255, 50); rect(0, 0, WW * sx, WH * .35 * sy); }
    else if (ev.type === 'whirl') { noFill(); stroke(255, 255, 255, 170); circle(ev.x * sx, ev.y * sy, 560 * sx); noStroke(); }
    else { fill(255, 80, 40, 220); circle(ev.v.pos.x * sx, ev.v.pos.y * sy, 7); }
  }

  // Sources de lumière du décor : cristaux, poissons de nuit, coffres non pillés
  function lights(add, near) {
    if (!S.ready) return;
    for (const c of S.crystals) if (near(c.x, c.y - c.h / 2)) add(c.x, c.y - c.h * .5, 110 + c.h * 1.5, c.col, .55 + .2 * Math.sin(frameCount * .05 + c.ph));
    for (const n of S.nf) if (near(n.pos.x, n.pos.y)) add(n.pos.x, n.pos.y, 105, [122, 215, 255], .8);
    for (const c of S.chests) if (!c.cool && near(c.x, c.y)) add(c.x, c.y - 8, 95, [255, 215, 0], .45);
    for (const l of S.lamps) if (near(l.x, l.y)) add(l.x, l.y, 150, l.col, .75 + .15 * Math.sin(frameCount * .05 + l.ph));
  }

  return { init, step, amb, stages: STG, lights, background, decor, overlay, hud, miniBg, mini, dark, inKelp, off() { S.ready = false; } };
})();
