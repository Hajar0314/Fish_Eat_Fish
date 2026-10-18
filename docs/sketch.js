const SPECIES = [
  { name: 'Sardine', abil: 'decoy', r: 9, speed: 4.4, force: 0.28, col: '#a9d6ff', info: 'Rapide, fragile', desc: `Petite et vive, la sardine file comme l'éclair et se faufile partout. Elle est très maniable, mais la moindre morsure fait mal : pour les joueurs agiles.` },
  { name: 'Poisson-clown', abil: 'hide', r: 11, speed: 3.8, force: 0.22, col: '#ff8c1a', stripe: true, info: 'Équilibré', desc: `Le poisson-clown n'est ni trop lent ni trop fragile. Avec ses rayures, il se débrouille dans toutes les situations. Parfait pour débuter.` },
  { name: 'Thon', abil: 'slap', r: 16, speed: 3.4, force: 0.14, col: '#4f7cac', info: 'Gros, puissant', desc: `Un colosse des mers : déjà costaud au départ, il croque les proies sans effort. Plus lent à tourner, il faut anticiper ses virages.` },
  { name: 'Lanterne', abil: 'flash', r: 12, speed: 3.6, force: 0.2, col: '#7dffb3', glow: true, info: 'Brille en eau profonde', desc: `Son corps lumineux éclaire les abysses : il voit beaucoup plus loin dans le noir et brille en profondeur. Pour les explorateurs.` },
  { name: 'Poisson-ange', abil: 'flash', r: 10, speed: 4.1, force: 0.27, col: '#ff6fb5', stripe: true, price: 5, info: 'Agile et éblouissant', desc: `Gracieux et très maniable, le poisson-ange file entre les prédateurs et les éblouit d'un éclat de lumière. Pour les joueurs qui aiment l'esquive.` },
  { name: 'Espadon', abil: 'slap', r: 18, speed: 4.0, force: 0.13, col: '#3d6fb5', price: 8, info: 'Rapide et massif', desc: `Un torpilleur des océans : presque aussi rapide qu'une sardine, mais bien plus costaud. Il vire large, alors garde de la place pour tes manœuvres.` },
  { name: 'Mérou', abil: 'hide', r: 20, speed: 3.0, force: 0.12, col: '#a8794a', price: 12, info: 'Tank des récifs', desc: `Lent mais énorme dès le départ, le mérou avale presque tout sur son passage. Il se cache dans les anémones quand ça chauffe.` },
  { name: 'Vipère', abil: 'flash', r: 13, speed: 3.7, force: 0.21, col: '#b86bff', glow: true, price: 16, info: 'Chasseuse des abysses', desc: `Une rareté des profondeurs, phosphorescente et redoutable. Elle illumine les abysses et aveugle ses poursuivants d'un éclair.` },
];
const PREY = [{ r: 5, speed: 2.6, force: 0.1, col: '#ffe08a' }, { r: 7, speed: 2.4, force: 0.1, col: '#ff9fb2' }, { r: 4, speed: 2.8, force: 0.12, col: '#9dffd9', glow: true }];
const PRED = [{ name: 'Requin', r: 30, speed: 2.9, force: 0.07, col: '#8896a6' }, { name: 'Baudroie', r: 22, speed: 2.4, force: 0.06, col: '#7a4b6e', deepOnly: true }];
const PRED_SQUID = { name: 'Calmar', r: 20, speed: 2, force: 0.08, col: '#c0392b', deepOnly: true };
const PUPS = {
  shield: { c: '#6ee7ff', l: '🛡', d: 480, n: 'Bouclier' }, turbo: { c: '#ffe14d', l: '⚡', d: 420, n: 'Turbo' },
  frenzy: { c: '#ff5a5a', l: '🔥', d: 360, n: 'Frénésie' }, magnet: { c: '#c77dff', l: '🧲', d: 480, n: 'Aimant' },
  heal: { c: '#ff6b9a', l: '❤', d: 0, n: '+1 vie' },
  slow: { c: '#8ecbff', l: '⏳', d: 360, n: 'Ralenti' }, double: { c: '#ffd24a', l: '×2', d: 600, n: 'Double score' },
  clones: { c: '#7dffb3', l: '🐟', d: 0, n: 'Clones' },
};
const P = { nbPred: 4, nbPrey: 70, avoidW: 2, sepW: 1.5, aliW: 1, cohW: 1, detect: 260, look: 50, speed: 1, nbJelly: 4, nbSquid: 1, nbHammer: 1, nbMoray: 1, nbBarra: 1, nbOrca: 1, nbLife: 1, leash: 2.2, learn: .7, debug: false };
const CFG = [['nbPred', 'Prédateurs', 0, 12, 1], ['nbPrey', 'Proies (banc)', 0, 200, 5], ['avoidW', 'Poids évitement obstacles', 0, 5, .1],
  ['look', 'Distance anticipation', 10, 150, 5], ['sepW', 'Poids séparation', 0, 5, .1], ['aliW', 'Poids alignement', 0, 3, .1],
  ['cohW', 'Poids cohésion', 0, 3, .1], ['detect', 'Détection prédateurs', 60, 500, 10], ['speed', 'Vitesse joueur ×', .5, 2, .05], ['nbJelly', 'Méduses', 0, 12, 1], ['nbSquid', 'Calmars', 0, 6, 1],
  ['nbHammer', 'Requins-marteaux', 0, 6, 1], ['nbMoray', 'Murènes', 0, 6, 1], ['nbBarra', 'Bancs de barracudas', 0, 4, 1], ['nbOrca', "Meutes d'orques", 0, 3, 1], ['nbLife', 'Vie sauvage (poissons indépendants) ×', 0, 3, .5],
  ['leash', 'Persévérance de chasse × (cercle de détection)', 1, 4, .1], ['learn', 'Apprentissage des prédateurs (0 = aucun)', 0, 1, .05]];

let tension = 0, growlT = 0, nearThreat = null, threatD = 1e9;
let WW = 0, WH = 0, cam = { x: 0, y: 0 }, showMap = true;
let eaten = 0, maxDepth = 0, killer = null, isRecord = false, menuFish = [], menuBub = [], dir = 1;
let state = 'title', pick = 0, player, followers = [], preys = [], preds = [], obstacles = [], bubbles = [], snow = [], jellies = [], squids = [], vents = [];
let golds = [], pups = [], floats = [];
const LIGHTS = [];   // sources de lumière de la frame (poissons lumineux, cristaux, source…)
let level = 1, banner = 0, score = 0, lives = 3, inv = 0, muted = false;
let fx = { shield: 0, turbo: 0, frenzy: 0, magnet: 0, slow: 0, double: 0 }, energy = 100, boost = 1, combo = 0, comboT = 0, goldT = 0, pupT = 0;
let best = 0, saved = false, paused = false, shake = 0, moved = false;

let wasDash = false;
const away = (d = 250) => { let p; for (let i = 0; i < 12; i++) { p = createVector(random(WW), random(WH)); if (!player || p.dist(player.pos) > d) break; } return p; };

function setup() {
  createCanvas(windowWidth, windowHeight); WW = width; WH = height;
  try { best = +localStorage.getItem('feBest') || 0; } catch (e) { }
  { const q = new URLSearchParams(location.search).get('stage'); if (q) Stage.cur = Stage.find(q); }   // en attendant l'écran de sélection : index.html?stage=1..5 (ou reef|kelp|wreck|cave|abyss)
  showBest();
  initUI();
  const pn = select('#panel');
  CFG.forEach(([k, label, mn, mx, st]) => {
    const l = createElement('label', `${label}: <b id="v_${k}">${P[k]}</b>`); l.parent(pn);
    const s = createSlider(mn, mx, P[k], st); s.parent(l); s.input(() => { P[k] = s.value(); select('#v_' + k).html(P[k]); });
  });
  for (let i = 0; i < 120; i++) snow.push({ x: random(width), y: random(height), s: random(1, 3) });
}

function showBest() { const e = document.getElementById('best'); if (e) e.textContent = best ? `🏆 Record : ${best}` : ''; }

function startGame() {
  if (!Eco.owns(SPECIES[pick])) { snd.deny(); if (state === 'select') renderCard(); return; }   // poisson verrouillé
  snd.start(muted);
  showScreen(null);
  const sp = activeSp();
  const stg = Stage.def(), sk = stg ? stg.biome : null, sz = stg ? Stage.size() : [6, 3];   // carte du stage ou carte libre
  WW = round(width * sz[0]); WH = round(height * sz[1]);
  player = new Player(WW * (stg ? stg.start[0] : .5), WH * (stg ? stg.start[1] : .15), sp); player.vel.set(1, 0); cam.x = constrain(player.pos.x - width / 2, 0, WW - width); cam.y = 0;
  followers = select('#grp').elt.checked ? Array.from({ length: 5 }, () => new Follower(player.pos.x - random(30, 90), player.pos.y + random(-40, 40), sp, 0.7)) : [];
  obstacles = [];
  { const R = stg ? stg.rocks : { d: 11.2, r: [25, 60], y: .2 }; for (let i = 0, n = floor(R.d * A()); i < n; i++) { const p = away(160); obstacles.push(new Obstacle(p.x, max(p.y, WH * R.y), random(R.r[0], R.r[1]))); } }
  preys = []; preds = []; jellies = []; squids = []; golds = []; pups = []; floats = []; bubbles = []; resetWild(); Boss.reset(); resetLife(); Habits.reset();
  fx = { shield: 0, turbo: 0, frenzy: 0, magnet: 0, slow: 0, double: 0 }; energy = 100; boost = 1; combo = 0; comboT = 0; goldT = 0; pupT = 0;
  tension = 0; growlT = 0; eaten = 0; maxDepth = 0; killer = null; level = 1; banner = 0; score = 0; lives = 3 + Eco.lv('life'); inv = 150; saved = false; paused = false; moved = false; TS = 1; state = 'play';
  { const n = max(3, round(WW / 600)); vents = Array.from({ length: n }, (_, i) => new Vent(WW * (i + .5) / n + random(-60, 60), WH - 24)); }
  World.init(sk); Abil.reset(); Eco.onStart(); if (stg) Stage.begin();
}

// Espèce choisie + skin équipé (copie mise en cache : un skin ne change que la couleur et l'aura)
const _spSkin = {};
function activeSp(i = pick) {
  const b = SPECIES[i], z = Eco.skin(); if (!z) return b;
  const key = b.name + '|' + z.id;
  return _spSkin[key] || (_spSkin[key] = { ...b, col: z.col, glow: b.glow || !!z.glow });
}

const A = () => max(1, (WW * WH) / (width * height));
const K = () => sqrt(max(1, (WW * WH) / (width * height)));
const vis = (o, m = 120) => { if (o.isBoss) m += o.r * 2; const x = o.pos ? o.pos.x : o.x, y = o.pos ? o.pos.y : o.y; return x > cam.x - m && x < cam.x + width + m && y > cam.y - m && y < cam.y + height + m; };
const panOf = x => constrain((x - player.pos.x) / (width * .5), -1, 1);
const team = () => [player, ...followers];
function syncPop() {
  if (Stage.on()) { Stage.sync(); return; }   // mode Stages : écosystème propre à la carte
  const nPr = round(P.nbPrey * A() * .58);
  while (preys.length < nPr) { const p = away(200); preys.push(new Prey(p.x, p.y, random(PREY), random(.9, 1.3))); }
  while (preys.length > nPr) preys.pop();
  const nP = round((P.nbPred + min(level - 1, 6)) * A() * .37), nJ = round((P.nbJelly + level - 1) * A() * .37), nS = round((P.nbSquid + floor(level / 2)) * A() * .37);
  while (preds.length < nP) { const k = preds.length % 3 === 2 ? PRED[1] : PRED[0], p = away(350); preds.push(new Predator(p.x, k.deepOnly ? WH * .8 : p.y * .5, k)); }
  while (preds.length > nP) preds.pop();
  while (jellies.length < nJ) { const p = away(200); jellies.push(new Jellyfish(p.x, random(WH * .55, WH * .95))); }
  while (jellies.length > nJ) jellies.pop();
  while (squids.length < nS) { const p = away(350); squids.push(new Squid(p.x, WH * .8, PRED_SQUID)); }
  while (squids.length > nS) squids.pop();
  syncWild(); syncLife();
}

// Bonus « clones » : un mini-banc (jusqu'à 8 poissons au total) qui suit le joueur et chasse avec lui pendant 25 s
function spawnClones() {
  const n = min(4, 8 - followers.length);
  if (n <= 0) { followers.forEach(f => { if (f.life !== undefined) f.life = 1500; }); floatText(player.pos.x, player.pos.y - 40, 'Banc complet !', '#7dffb3'); return; }
  for (let i = 0; i < n; i++) {
    const c = new Follower(player.pos.x - random(30, 90), player.pos.y + random(-50, 50), player.sp, 0.7);
    c.vel.set(player.vel.x, player.vel.y); c.life = 1500; followers.push(c); bubblesAt(c.pos);
  }
  floatText(player.pos.x, player.pos.y - 40, `+${n} clones`, '#7dffb3');
}

function bubblesAt(p) { for (let i = 0; i < 6; i++) bubbles.push({ x: p.x + random(-8, 8), y: p.y, s: random(3, 7), life: 60 }); }
function floatText(x, y, t, c = '#fff') { floats.push({ x, y, t, c, l: 60 }); }

function addScore(n, x, y) {
  combo++; comboT = 150;
  const mult = min(5, 1 + floor(combo / 5)), dbl = fx.double ? 2 : 1, pts = Math.round(n * mult * dbl * Eco.scoreMul());
  score += pts; floatText(x, y - 14, `+${pts}${mult > 1 ? ' x' + mult : ''}${dbl > 1 ? ' ⭐x2' : ''}`, mult > 1 || dbl > 1 ? '#ffd166' : '#fff');
  const nl = 1 + floor(score / 300);
  if (nl > level) { level = nl; banner = 150; lives = min(5, lives + 1); snd.level(); Eco.bonus(player.pos.x, player.pos.y, 5, 0); floatText(player.pos.x, player.pos.y - 40, '+1 vie', '#ff6b9a'); floatText(player.pos.x, player.pos.y - 62, '⭐ Niveau ' + level, '#ffd166'); }
}

function background_() { World.background(); }

function step() {
  for (const k in fx) fx[k] = max(0, fx[k] - 1);
  TS = lerp(TS, fx.slow > 0 ? .35 : 1, .1);   // ralenti : tout le monde sauf le joueur et son banc
  for (let i = followers.length - 1; i >= 0; i--) { const f = followers[i]; if (f.life !== undefined && --f.life <= 0) { followers.splice(i, 1); bubblesAt(f.pos); } }   // les clones disparaissent
  inv = max(0, inv - 1); comboT = max(0, comboT - 1); if (!comboT) combo = 0;
  const dash = (keyIsDown(32) || (mouseIsPressed && !Abil.uiHold && !Abil.rmb)) && energy > 4;
  if (dash && !wasDash) snd.whoosh(); wasDash = dash;
  energy = dash ? energy - 1.1 * Eco.sprintCost() : min(100, energy + 0.35 * Eco.regen());
  boost = (dash ? 1.9 : 1) * (fx.turbo ? 1.4 : 1);
  maxDepth = max(maxDepth, floor(player.pos.y / WH * 500));
  syncPop();
  const all = team(), m = createVector((moved ? mouseX : width / 2) + cam.x, (moved ? mouseY : height / 2) + cam.y);
  const obs = obstacles.concat(jellies), hunters = preds.concat(squids, wild);
  player.think(m, obs); followers.forEach(f => f.think(player, followers, obs));
  const obsA = obs.filter(o => vis(o, 900)), rocksA = obstacles.filter(o => vis(o, 900));
  const ap = preys.filter(p => vis(p, 800)), apr = preds.filter(p => vis(p, 1300)), asq = squids.filter(p => vis(p, 1300)), aw = wild.filter(p => vis(p, 1300)), aj = jellies.filter(p => vis(p, 800));
  const ac = critters.filter(c => vis(c, 1300)), bigC = ac.filter(c => c.r >= 12);   // poissons indépendants visibles ; les gros font fuir les proies
  const seen = Abil.targets(all), sight = p => Abil.sightFor(p, seen);   // cibles visibles (hors kelp / anémone, + leurres) ; un prédateur aveuglé ne voit rien
  Opt.grid.clear(); Opt.crowd = 0;
  for (const p of ap) { Opt.grid.add(p); if (p.pos.x > cam.x && p.pos.x < cam.x + width && p.pos.y > cam.y && p.pos.y < cam.y + height) Opt.crowd++; }
  const threats = hunters.concat(bigC).filter(h => vis(h, 1000)); Opt.vents = vents.filter(v => vis(v, 1100));   // calculés UNE fois (avant : un concat par proie)
  ap.forEach(p => p.think(ap, all, obsA, threats, Opt.grid)); apr.forEach(p => p.think(sight(p), apr, obsA));
  asq.forEach(q => q.think(sight(q), asq, obsA)); aw.forEach(w => w.think(sight(w), aw, obsA)); aj.forEach(j => j.think(rocksA)); lifeThink(ac, ap, all, hunters, obsA); golds.forEach(g => g.think(all, obsA)); Abil.think(obsA);
  if (fx.magnet) for (const p of preys) if (p.pos.dist(player.pos) < 260) p.applyForce(p.seek(player.pos).mult(2.5));
  World.step(all, obsA, hunters);
  [...all, ...ap, ...apr, ...asq, ...aw, ...ac, ...aj, ...golds, ...Abil.decoys].forEach(v => v.update());
  Abil.post(hunters); Habits.update(player, hunters);
  lifeEat(ac, ap, hunters, all);
  updateCam();
  // Menace la plus proche : musique de tension + grognement positionnel
  nearThreat = null; threatD = 1e9;
  for (const pr of preds.concat(squids, wild)) { const d = pr.pos.dist(player.pos); if (d < threatD) { threatD = d; nearThreat = pr; } }
  const ten = (fx.frenzy || fx.shield || !nearThreat) ? 0 : constrain(map(threatD, P.detect * 1.6, P.detect * .4, 0, 1), 0, 1);
  tension = lerp(tension, ten, .05);
  if (nearThreat && ten > .05 && --growlT <= 0) { snd.growl(panOf(nearThreat.pos.x), ten); growlT = floor(map(threatD, P.detect * 1.6, P.detect * .4, 100, 28, true)); }

  // Manger les proies
  for (const f of all) for (let i = preys.length - 1; i >= 0; i--) {
    const p = preys[i];
    if (f.r > p.r * 1.15 && f.pos.dist(p.pos) < f.r + p.r * .4) {
      preys.splice(i, 1); f.r = min(f.r + 0.35, f.sp.r * 1.8); f.bite = 14; eaten++; addScore(10, p.pos.x, p.pos.y); bubblesAt(f.pos); snd.eat(panOf(p.pos.x)); Eco.preyDrop(p.pos.x, p.pos.y);
    }
  }
  // Poisson doré
  for (let i = golds.length - 1; i >= 0; i--) {
    const g = golds[i];
    if (g.life <= 0) { golds.splice(i, 1); continue; }
    for (const f of all) if (f.pos.dist(g.pos) < f.r + g.r) { f.bite = 14; addScore(150, g.pos.x, g.pos.y); bubblesAt(g.pos); snd.gold(panOf(g.pos.x)); Eco.bonus(g.pos.x, g.pos.y, 6, 1); golds.splice(i, 1); break; }
  }
  Eco.step();   // pièces et perles : aimant, ramassage, renouvellement
  // Frénésie : on mange les prédateurs
  if (fx.frenzy) for (const arr of [preds, squids, wild]) for (let i = arr.length - 1; i >= 0; i--) {
    const pr = arr[i];
    if (!pr.isBoss && pr.pos.dist(player.pos) < player.r + pr.r * .8) { arr.splice(i, 1); pr.dead = true; player.bite = 16; addScore(100, pr.pos.x, pr.pos.y); shake = 8; bubblesAt(pr.pos); snd.crunch(panOf(pr.pos.x)); Eco.bonus(pr.pos.x, pr.pos.y, 6, random() < .5 ? 1 : 0); }
  }
  // Se faire manger
  if (!fx.frenzy && !fx.shield) for (const pr of [...preds, ...squids, ...wild, ...jellies]) for (let i = all.length - 1; i >= 0; i--) {
    const f = all[i];
    if (pr.isBoss) break;              // les boss gèrent leurs contacts eux-mêmes (boss.js)
    if (pr.stun > 0) break;            // prédateur étourdi : il ne mord plus
    if (Abil.hidden(f)) continue;      // caché dans l'anémone : intouchable
    if (pr.pos.dist(f.pos) < pr.r * .8 + f.r * .6) {
      if (f === player) { if (!inv) { pr.bite = 14; snd.snap(panOf(pr.pos.x)); lives--; killer = pr; inv = 90; Chase.onBite(pr); shake = 14; combo = 0; snd.hurt(panOf(pr.pos.x)); bubblesAt(f.pos); } }
      else { const k = followers.indexOf(f); if (k >= 0) followers.splice(k, 1); bubblesAt(f.pos); snd.lose(panOf(f.pos.x)); }
    }
  }
  Abil.checkStage();   // évolution : alevin -> adulte -> géant
  // Bonus
  if (++pupT > 540 && pups.length < 2) { pupT = 0; pups.push({ x: cam.x + random(80, width - 80), y: cam.y - 20, t: random(Object.keys(PUPS)), ph: random(TWO_PI) }); }
  if (++goldT > 1000 && !golds.length) { goldT = 0; const ga = random(TWO_PI), gd = random(500, 900); golds.push(new GoldFish(constrain(player.pos.x + cos(ga) * gd, 50, WW - 50), constrain(player.pos.y + sin(ga) * gd, 50, WH - 50))); floatText(cam.x + width / 2, cam.y + 70, '✨ Un poisson doré !', '#ffd700'); }
  for (let i = pups.length - 1; i >= 0; i--) {
    const u = pups[i]; u.y += 0.7; u.x += sin(frameCount * .03 + u.ph) * .6;
    if (u.y > WH + 30) { pups.splice(i, 1); continue; }
    if (dist(u.x, u.y, player.pos.x, player.pos.y) < player.r + 16) {
      const d = PUPS[u.t]; if (u.t === 'heal') lives = min(5, lives + 1); else if (u.t === 'clones') spawnClones(); else fx[u.t] = Math.round(d.d * Eco.durMul());
      floatText(u.x, u.y - 20, d.n, d.c); bubblesAt(u); if (u.t === 'heal') snd.life(); else snd.power(u.t); pups.splice(i, 1);
    }
  }
  Stage.step();   // objectifs du stage / fin de stage
  Boss.step();    // boss : contacts, projectiles, ondes de choc, bonus
  if (lives <= 0 && Eco.revive()) { lives = 1; inv = 240; fx.shield = max(fx.shield, 300); snd.life(); bubblesAt(player.pos); floatText(player.pos.x, player.pos.y - 50, '💖 Seconde chance !', '#ff6b9a'); }
  if (lives <= 0 && state === 'play') { state = 'over'; snd.over(); isRecord = !Stage.on() && score > best; setTimeout(showOver, 900); Eco.save(); if (!saved) { saved = true; if (score > best && !Stage.on()) { best = score; try { localStorage.setItem('feBest', best); } catch (e) { } } } }
}

function draw() {
  background_();
  const inMenu = state === 'title' || state === 'select';
  if (!inMenu && !(state === 'play' && !paused)) tension *= .97;
  snd.setMusic(inMenu || !player ? 0 : constrain(map(player.pos.y / WH, 0.1, 1, 0, 1), 0, 1), inMenu ? 0 : tension);
  if (inMenu) { menuScene(); return; }
  if (state === 'play' && !paused) step();
  const amb = ambient(); gatherLights(amb);

  push();
  if (shake > 0.3) { translate(random(-shake, shake), random(-shake, shake)); shake *= 0.85; }
  translate(-cam.x, -cam.y);
  World.decor();
  obstacles.filter(vis).forEach(o => o.show()); vents.filter(vis).forEach(v => v.show());
  strokeWeight(1); Abil.drawBack(); Eco.draw();
  [preys, critters, golds, jellies, preds, squids, wild, Abil.decoys, followers].forEach(a => a.filter(vis).forEach(e => e.show()));
  if ((state === 'play' || state === 'win') && (!inv || frameCount % 8 < 4)) { player.show(fx.frenzy > 0); }
  Abil.drawFront(); Boss.drawWorld();
  strokeWeight(1); player.debug(); if (P.debug) { debugWorld(); Habits.debug(); }
  if (fx.shield) { noFill(); stroke(110, 231, 255, 150 + 80 * sin(frameCount * .2)); strokeWeight(3); circle(player.pos.x, player.pos.y, player.r * 3.6); strokeWeight(1); }
  if (fx.magnet) { noFill(); stroke(199, 125, 255, 60); circle(player.pos.x, player.pos.y, 520); }
  for (const u of pups) {
    const d = PUPS[u.t]; noStroke(); drawingContext.shadowBlur = 20; drawingContext.shadowColor = d.c; fill(red_(d.c), 140);
    circle(u.x, u.y, 32 + 4 * sin(frameCount * .1)); drawingContext.shadowBlur = 0; fill(255); textAlign(CENTER, CENTER); textSize(18); text(d.l, u.x, u.y + 1);
  }
  for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= 1.2; b.life--; noFill(); stroke(255, b.life * 4); strokeWeight(1); circle(b.x, b.y, b.s); if (b.life <= 0) bubbles.splice(i, 1); }
  pop();
  World.overlay();
  darkness(amb);
  Abil.drawScreen();
  if (TS < .98) {   // ralenti : teinte bleutée + vignette
    const dc = drawingContext, k = 1 - TS, g = dc.createRadialGradient(width / 2, height / 2, min(width, height) * .3, width / 2, height / 2, max(width, height) * .75);
    g.addColorStop(0, 'rgba(60,120,255,0)'); g.addColorStop(1, `rgba(40,90,220,${k * .5})`);
    dc.fillStyle = g; dc.fillRect(0, 0, width, height); noStroke(); fill(90, 160, 255, k * 30); rect(0, 0, width, height);
  }
  push(); translate(-cam.x, -cam.y);
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; if (!paused) { f.y -= 0.8; f.l--; }
    noStroke(); fill(color(f.c + '').levels[0], color(f.c + '').levels[1], color(f.c + '').levels[2], min(255, f.l * 6)); textAlign(CENTER, CENTER); textSize(18); text(f.t, f.x, f.y);
    if (f.l <= 0) floats.splice(i, 1);
  }
  pop();
  dangerArrows();
  hud(); minimap(); if (P.debug) debugHud();
}

// Convertit un hex en couleur p5 (pour le halo des bonus)
function red_(h) { return color(h); }

// Obscurité ambiante : augmente avec la profondeur, la grotte, la nuit (calculée une seule fois par image).
const ambient = () => World.amb(player.pos.y / WH);

// Rassemble les sources de lumière visibles : elles éclairent les rochers ET percent l'obscurité.
function gatherLights(amb) {
  LIGHTS.length = 0;
  const ls = constrain(.35 + amb / .78 * .85, .35, 1.2), M = 340;
  const near = (x, y) => x > cam.x - M && x < cam.x + width + M && y > cam.y - M && y < cam.y + height + M;
  const add = (x, y, rad, c, k) => LIGHTS.push({ x, y, rad, c, k: Math.min(1.2, k * ls) });
  for (const f of team()) if (f.sp.glow && near(f.pos.x, f.pos.y)) add(f.pos.x, f.pos.y, 150 + f.r * 8, rgbOf(f.sp.col), 1);
  for (const p of preys) if (p.sp.glow && near(p.pos.x, p.pos.y)) add(p.pos.x, p.pos.y, 60 + p.r * 6, rgbOf(p.sp.col), .6);
  for (const g of golds) if (near(g.pos.x, g.pos.y)) add(g.pos.x, g.pos.y, 140, [255, 215, 0], .8);
  for (const pr of preds) if (pr.sp.name === 'Baudroie') { const [x, y] = pr.lurePos(); if (near(x, y)) add(x, y, 210, [255, 255, 150], 1); }
  for (const q of squids) if (near(q.pos.x, q.pos.y)) add(q.pos.x, q.pos.y, q.dash ? 170 : 80, [255, 60, 50], q.dash ? 1 : .35);
  for (const j of jellies) if (near(j.pos.x, j.pos.y)) add(j.pos.x, j.pos.y - j.r * .3, 130, [211, 139, 255], .55 + .25 * sin(frameCount * .05 + j.ph));
  for (const v of vents) if (near(v.pos.x, v.pos.y)) add(v.pos.x, v.pos.y - 20, 190, [255, 150, 60], .75 + .25 * sin(frameCount * .3 + v.pos.x));
  World.lights(add, near); Abil.lights(add); Eco.lights(add, near); Boss.lights(add, near);
  if (LIGHTS.length > 30) { LIGHTS.sort((a, b) => b.k * b.rad - a.k * a.rad); LIGHTS.length = 30; }
}

// Plus on descend, plus il fait noir : le joueur éclaire un cercle (la Lanterne voit plus loin),
// et chaque source de lumière « troue » l'obscurité autour d'elle (calque basse résolution).
let _dkc = null, _dkx = null;
const DQ = .33;
function darkness(amb) {
  if (amb <= 0.01) return;
  const w = ceil(width * DQ), h = ceil(height * DQ);
  if (!_dkc) { _dkc = document.createElement('canvas'); _dkx = _dkc.getContext('2d'); }
  if (_dkc.width !== w || _dkc.height !== h) { _dkc.width = w; _dkc.height = h; }
  const x = _dkx, R = (player.sp.glow ? 340 : 230) + (fx.frenzy ? 80 : 0), px = player.pos.x - cam.x, py = player.pos.y - cam.y;
  x.setTransform(DQ, 0, 0, DQ, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, width, height);
  x.fillStyle = `rgba(0,4,14,${amb})`; x.fillRect(0, 0, width, height);
  x.globalCompositeOperation = 'destination-out';
  let g = x.createRadialGradient(px, py, 30, px, py, R * 1.5); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, width, height);
  for (const L of LIGHTS) {
    const sx = L.x - cam.x, sy = L.y - cam.y, Rl = L.rad * 1.05, A = Math.min(.92, .8 * L.k);
    if (L.rad < 70 || sx < -Rl || sx > width + Rl || sy < -Rl || sy > height + Rl) continue;
    g = x.createRadialGradient(sx, sy, 0, sx, sy, Rl);
    g.addColorStop(0, `rgba(0,0,0,${A})`); g.addColorStop(.35, `rgba(0,0,0,${A * .55})`); g.addColorStop(.7, `rgba(0,0,0,${A * .16})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(sx - Rl, sy - Rl, Rl * 2, Rl * 2);
  }
  const dc = drawingContext; dc.drawImage(_dkc, 0, 0, width, height);
  // lueur colorée additive autour de chaque source
  dc.save(); dc.globalCompositeOperation = 'lighter'; const fa = min(1, amb / .4);
  let ng = 0;
  for (const L of LIGHTS) {
    const sx = L.x - cam.x, sy = L.y - cam.y, Rl = L.rad * .85;
    if (L.k * fa < .2 || L.rad < 100 || ng >= 10) continue;
    if (sx < -Rl || sx > width + Rl || sy < -Rl || sy > height + Rl) continue;
    g = dc.createRadialGradient(sx, sy, 0, sx, sy, Rl); g.addColorStop(0, `rgba(${L.c[0]},${L.c[1]},${L.c[2]},${.16 * L.k * fa})`); g.addColorStop(1, `rgba(${L.c[0]},${L.c[1]},${L.c[2]},0)`);
    dc.fillStyle = g; dc.fillRect(sx - Rl, sy - Rl, Rl * 2, Rl * 2); ng++;
  }
  dc.restore();
}

// ================= HUD (haut gauche) : panneau « verre » =================
let dispScore = 0, scorePop = 0, lastScoreV = 0, fxMax = {};
function glassPanel(x, y, w, h, r) {
  const dc = drawingContext; fill(4, 22, 48, 175); stroke(127, 214, 255, 80); strokeWeight(1.2);
  dc.shadowBlur = 20; dc.shadowColor = 'rgba(0,0,0,.45)'; rect(x, y, w, h, r); dc.shadowBlur = 0;
  noStroke(); fill(255, 255, 255, 13); rect(x + 2, y + 2, w - 4, h * .42, r - 2, r - 2, 0, 0);
}
function gradBar(x, y, w, h, p, c0, c1) {
  noStroke(); fill(255, 255, 255, 28); rect(x, y, w, h, h / 2);
  if (p <= 0) return;
  const dc = drawingContext, g = dc.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c0); g.addColorStop(1, c1);
  dc.save(); dc.fillStyle = g; dc.shadowBlur = 8; dc.shadowColor = c1; dc.beginPath(); dc.roundRect(x, y, max(h, w * p), h, h / 2); dc.fill(); dc.restore();
}
function hudChip(x, y, w, col, frac, label) {
  const c = color(col), h = 22;
  noStroke(); fill(4, 22, 48, 170); rect(x, y, w, h, 11);
  stroke(red(c), green(c), blue(c), 150); strokeWeight(1.2); noFill(); rect(x, y, w, h, 11);
  noStroke(); fill(red(c), green(c), blue(c), 70); rect(x + 2, y + 2, max(16, (w - 4) * constrain(frac, 0, 1)), h - 4, 9);
  fill(255); textAlign(LEFT, CENTER); textSize(12); textStyle(BOLD); text(label, x + 10, y + h / 2 + 1);
}
function hud() {
  push();
  const X = 12, Y = 12, W = min(310, width - 24), PAD = 14;
  if (score < dispScore) dispScore = score;
  if (score > lastScoreV) scorePop = 1; lastScoreV = score;
  dispScore += (score - dispScore) * .18; if (abs(score - dispScore) < .6) dispScore = score; scorePop *= .88;
  glassPanel(X, Y, W, 132, 18);

  // --- badge de niveau avec anneau de progression ---
  const bx = X + PAD + 24, by = Y + 38, p = constrain((score - (level - 1) * 300) / 300, 0, 1);
  noFill(); strokeWeight(5); stroke(255, 255, 255, 35); circle(bx, by, 48);
  stroke('#ffd166'); drawingContext.save(); drawingContext.shadowBlur = 10; drawingContext.shadowColor = '#ffb347';
  arc(bx, by, 48, 48, -HALF_PI, -HALF_PI + TWO_PI * max(.02, p)); drawingContext.restore();
  noStroke(); fill(10, 50, 90); circle(bx, by, 38);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(8); fill(127, 214, 255); text('NIV', bx, by - 9);
  textSize(18); fill(255); text(level, bx, by + 4);

  // --- score ---
  const sx = bx + 24 + 14;
  textAlign(LEFT, TOP); textStyle(BOLD); textSize(9); fill(127, 214, 255, 200); text('SCORE', sx, Y + 15);
  push(); translate(sx, Y + 26); const k = 1 + scorePop * .22; scale(k);
  drawingContext.shadowBlur = 14 + 14 * scorePop; drawingContext.shadowColor = 'rgba(255,190,70,.8)';
  textSize(30); fill(scorePop > .05 ? '#fff3b0' : '#ffd166'); text(Math.round(dispScore).toLocaleString('fr-FR'), 0, 0); pop();

  // --- vies (cœurs) à droite ---
  const maxL = max(3, lives); textAlign(RIGHT, CENTER); textSize(18);
  for (let i = 0; i < maxL; i++) {
    const hx = X + W - PAD - (maxL - 1 - i) * 22, on = i < lives, beat = on && lives <= 1 ? 1 + .12 * sin(frameCount * .3) : 1;
    push(); translate(hx - 8, Y + 22); scale(beat); drawingContext.shadowBlur = on ? 10 : 0; drawingContext.shadowColor = '#ff3b6b';
    fill(on ? color('#ff5a7a') : color(255, 255, 255, 40)); text('❤', 8, 0); pop();
  }

  // --- stats compactes ---
  textStyle(NORMAL); textAlign(LEFT, CENTER); textSize(12);
  const stats = [['📏', nf(player.r, 1, 1)], ['🌊', floor(player.pos.y / WH * 500) + ' m'], ['🐟', followers.length]];
  if (P.learn) stats.push(['🧠', Habits.pct() + ' %']);
  let cx = X + PAD; const cy = Y + 76;
  for (const [ic, v] of stats) { fill(255, 255, 255, 230); text(`${ic} ${v}`, cx, cy); cx += textWidth(`${ic} ${v}`) + 16; }

  // --- énergie du sprint ---
  const low = energy <= 25, pul = low ? 160 + 95 * sin(frameCount * .3) : 255;
  textSize(9); textStyle(BOLD); fill(255, 255, 255, 150); text('SPRINT', X + PAD, Y + 98);
  gradBar(X + PAD + 44, Y + 94, W - PAD * 2 - 44, 8, constrain(energy / 100, 0, 1), low ? '#ff5a5a' : '#ff9d2e', low ? '#ff8a8a' : '#ffe08a');
  if (low) { noStroke(); fill(255, 90, 90, 255 - pul); rect(X + PAD + 44, Y + 94, W - PAD * 2 - 44, 8, 4); }

  // --- biome / événement ---
  World.hud(X + PAD, Y + 116);

  // --- combo + bonus actifs ---
  let y = Stage.hudCard(X, Y + 132 + 10, W); const cw = min(200, W);   // objectifs du stage (rien en mode libre)
  if (combo > 1) {
    const m = min(5, 1 + floor(combo / 5));
    hudChip(X, y, cw, '#ffd166', (combo % 5) / 5, `🔥 COMBO ${combo}   ×${m}`); y += 28;
  }
  for (const key in fx) {
    if (fx[key] > 0) { fxMax[key] = max(fxMax[key] || 0, fx[key]); hudChip(X, y, cw, PUPS[key].c, fx[key] / fxMax[key], `${PUPS[key].l} ${PUPS[key].n}  ${ceil(fx[key] / 60)}s`); y += 28; }
    else fxMax[key] = 0;
  }
  pop();
  levelBar();
  Abil.hud(); Eco.hud(); Stage.draw(); Boss.hud();
}

function mouseMoved() { moved = true; }
function mouseDragged() { moved = true; }
function mousePressed() { if (state === 'win') return; Abil.press(); }   // écran de victoire : boutons HTML
function mouseReleased() { Abil.uiHold = false; }
function keyPressed() {
  if (state === 'win') { if ((keyCode === ENTER || key === ' ') && Stage.res && Stage.res.t > 40) Stage.after(); return false; }
  if (Eco.isOpen()) { if (key === 'b' || key === 'B' || keyCode === ESCAPE) Eco.close(); return false; }   // boutique ouverte : seules B / Échap agissent
  if ((key === 'b' || key === 'B') && state === 'play' && !paused) { Eco.open('game'); return false; }
  if (state === 'select') { if (keyCode === LEFT_ARROW) { move(-1); return false; } if (keyCode === RIGHT_ARROW) { move(1); return false; } }
  if (key === 'e' || key === 'E' || keyCode === SHIFT) Abil.use();   // capacité spéciale
  if (state === 'play' && !paused && /^[1-5]$/.test(key)) Eco.useItem(+key - 1);   // objets à usage unique
  if (key === 'd' || key === 'D') P.debug = !P.debug;
  if (key === 'n' || key === 'N') showMap = !showMap;
  if (key === 'p' || key === 'P' || keyCode === ESCAPE) setPause(!paused);
  if (key === 's' || key === 'S') { const e = select('#panel').elt; e.style.display = e.style.display === 'block' ? 'none' : 'block'; }
  if (key === 'm' || key === 'M') { setMuted(!muted); }
  if (key === ' ' && state === 'play') return false;
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); if (state === 'title' || state === 'select') { WW = width; WH = height; } }

// ================= Interface (écrans HTML) =================
const $ = id => document.getElementById(id);
function showScreen(id) { ['title', 'select', 'over', 'pausemenu', 'shop', 'stages', 'winscr'].forEach(k => $(k).classList.toggle('hide', k !== id)); }
function toTitle() { TS = 1; World.off(); state = 'title'; paused = false; WW = width; WH = height; cam.x = cam.y = 0; showBest(); showScreen('title'); }
function renderStages() {
  $('stg_list').innerHTML = Stage.list.map((s, i) => {
    const ok = Stage.unlocked(i), n = Stage.stars(i);
    return `<div class="card stg${ok ? '' : ' lk'}" data-i="${i}"><div class="ic">${ok ? s.icon : '🔒'}</div><b>${i + 1}. ${s.name}</b><small>${s.sub}</small><div class="st">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</div><div class="bs">👑 ${s.boss}</div><small>${Stage.best(i) ? 'Record : ' + Stage.best(i) : ok ? 'Pas encore joué' : 'Bats le boss précédent'}</small></div>`;
  }).join('');
  $('stg_list').querySelectorAll('.stg').forEach(el => el.onclick = () => { const i = +el.dataset.i; if (!Stage.unlocked(i)) { snd.deny(); return; } Stage.cur = i; toSelect(); });
}
function toStages() { TS = 1; World.off(); state = 'title'; paused = false; WW = width; WH = height; cam.x = cam.y = 0; Stage.res = null; renderStages(); showScreen('stages'); }
function toSelect() { state = 'select'; renderCard(); showScreen('select'); }
function move(d) { pick = (pick + d + SPECIES.length) % SPECIES.length; dir = d; renderCard(); snd.tick(); }

function initUI() {
  $('logo').innerHTML = [...'FISH EAT FISH'].map((c, i) => c === ' ' ? '<span class="gap"></span>' : `<span class="ch" style="animation-delay:${i * .12}s">${c}</span>`).join('');
  $('logo').addEventListener('click', e => { burst(e.clientX, e.clientY); snd.start(muted); snd.eat(); });
  $('play').onclick = () => { Stage.cur = null; snd.start(muted); toSelect(); };   // mode libre
  $('stg_t').onclick = () => { snd.start(muted); renderStages(); showScreen('stages'); };
  $('stg_back').onclick = toTitle; $('stg_o').onclick = toStages; $('p_stages').onclick = toStages;
  $('w_next').onclick = () => Stage.after(); $('w_again').onclick = () => { Stage.res = null; startGame(); }; $('w_stages').onclick = toStages;
  $('prev').onclick = () => move(-1); $('next').onclick = () => move(1);
  $('go').onclick = () => startGame(); $('back').onclick = toTitle;
  $('again').onclick = () => startGame(); $('home').onclick = toTitle;
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    snd.start(muted); if (!b.classList.contains('arrow')) snd.click();
  });
  $('p_resume').onclick = () => setPause(false); $('p_restart').onclick = () => startGame(); $('p_quit').onclick = toTitle;
  $('p_settings').onclick = () => { const e = $('panel'); e.style.display = e.style.display === 'block' ? 'none' : 'block'; };
  $('vm').oninput = e => snd.vol('music', +e.target.value); $('vs').oninput = e => snd.vol('sfx', +e.target.value);
  // Débloque l'audio dès la première interaction (les navigateurs l'exigent) + bouton son
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => snd.start(muted), { passive: true }));
  $('soundbtn').onclick = () => setMuted(!muted);
  initMenuFish(); showBest(); Eco.initUI();
}

function burst(x, y) { for (let i = 0; i < 16; i++) menuBub.push({ x, y, s: random(4, 14), l: 120, vx: random(-2, 2), vy: -random(.5, 3) }); }

let svgId = 0;
// Poisson de la carte de sélection : même dessin que dans le jeu (dégradés, écailles, nageoires animées en CSS)
function fishSVG(sp) {
  const id = 'f' + (svgId++), R = 14 + sp.r * .45, st = getStyle(sp), c = sp.col, th = st.th, K = st.tail, f = n => +(n * R).toFixed(1), q = n => (+n).toFixed(1);
  fishPts(R, th, 0, 0);
  const mid = (a, b) => `${q((_X[a] + _X[b]) / 2)} ${q((_Y[a] + _Y[b]) / 2)}`;
  let body = `M${mid(FM - 1, 0)}`; for (let i = 0; i < FM; i++) body += `Q${q(_X[i])} ${q(_Y[i])} ${mid(i, (i + 1) % FM)}`; body += 'Z';
  const tail = `M${f(.15)} ${f(-.1 * th)}C${f(-.3 * K)} ${f(-.2)} ${f(-.75 * K)} ${f(-.62 * K)} ${f(-1.05 * K)} ${f(-.85 * K)}Q${f(-.72 * K)} ${f(-.3)} ${f(-.62 * K)} 0Q${f(-.72 * K)} ${f(.3)} ${f(-1.05 * K)} ${f(.85 * K)}C${f(-.75 * K)} ${f(.62 * K)} ${f(-.3 * K)} ${f(.2)} ${f(.15)} ${f(.1 * th)}Z`;
  let rays = ''; for (let i = -2; i <= 2; i++) rays += `M0 0L${f(-.92 * K)} ${f(i * .27 * K)}`;
  const kf = Math.round(FN * .66), kb = Math.round(FN * .34), Fx = _X[kf], Fy = _Y[kf] + R * .12, Bx = _X[kb], By = _Y[kb] + R * .12, hD = R * .62 * st.dors, Tx = Fx - R * .45, Ty = Fy - hD - R * .12;
  const dors = `M${q(Fx)} ${q(Fy)}Q${q(Fx - R * .05)} ${q(Fy - hD * .9)} ${q(Tx)} ${q(Ty)}Q${q(Bx + R * .15)} ${q(By - hD * .35)} ${q(Bx)} ${q(By)}Z`;
  const a1 = Math.round(FN * .45), a2 = Math.round(FN * .2), px = _X[a1], py = _Y[2 * FN - a1] - R * .1, qx = _X[a2], qy = _Y[2 * FN - a2] - R * .1;
  const anal = `M${q(px)} ${q(py)}Q${q(px - R * .05)} ${q(py + R * .4)} ${q(px - R * .3)} ${q(py + R * .45)}Q${q(qx + R * .1)} ${q(qy + R * .25)} ${q(qx)} ${q(qy)}Z`;
  const pect = `M${f(.05)} ${f(-.08)}C${f(-.3)} ${f(-.3)} ${f(-.75)} ${f(-.15)} ${f(-.9)} ${f(.15)}C${f(-.55)} ${f(.12)} ${f(-.2)} ${f(.15)} ${f(.05)} ${f(.1)}Z`;
  // écailles + scintillements (positions fixes, animées en CSS)
  let sc = '', gl = '';
  forScales(R, th, 0, 0, (x, y, s, k) => { const rd = s * .62; sc += `M${q(x)} ${q(y + rd)}A${q(rd)} ${q(rd)} 0 0 1 ${q(x)} ${q(y - rd)}`; if (k % 3 === 0 && gl.length < 900) gl += `<circle class="gl" cx="${q(x)}" cy="${q(y)}" r="${q(s * .3)}" fill="#fff" style="animation-delay:${(k * .37 % 2.4).toFixed(2)}s"/>`; });
  let bands = '';
  if (sp.stripe) for (const [cx, w] of [[.4, .26], [-.3, .3]]) bands += `<rect x="${f(cx - w / 2)}" y="${f(-1)}" width="${f(w)}" height="${f(2)}" fill="#fff" fill-opacity=".93" stroke="rgba(30,12,0,.6)" stroke-width="${q(Math.max(.7, R * .04))}"/>`;
  let photo = ''; if (sp.name === 'Lanterne') for (let k = 3; k < FN - 3; k += 2) photo += `<circle class="ph" cx="${q(_X[k])}" cy="${q(_Y[2 * FN - k] - R * .17)}" r="${q(R * .055)}" fill="#e6ffc8" style="animation-delay:${(k * .13).toFixed(2)}s"/>`;
  const ex = f(.68), ey = f(-.16 * th), iris = st.iris || shade(c, -.6), tx = _X[0] + R * .08;
  return `<svg viewBox="-58 -38 102 76"><defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c, st.back)}"/><stop offset=".4" stop-color="${shade(c, st.back * .3)}"/><stop offset=".62" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, st.belly)}"/></linearGradient>
<linearGradient id="${id}t" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${shade(c, -.1, .95)}"/><stop offset=".6" stop-color="${shade(c, .15, .8)}"/><stop offset="1" stop-color="${shade(c, .45, .5)}"/></linearGradient>
<linearGradient id="${id}d" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${shade(c, -.1, .95)}"/><stop offset="1" stop-color="${shade(c, .3, .5)}"/></linearGradient>
<radialGradient id="${id}h" cx=".62" cy=".22" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="${id}c"><path d="${body}"/></clipPath></defs>
<g transform="translate(${q(tx)} 0)"><g class="tail"><path d="${tail}" fill="url(#${id}t)"/><path d="${rays}" stroke="#fff" stroke-opacity=".2" stroke-width=".8" fill="none"/></g></g>
<path class="dorsal" d="${dors}" fill="url(#${id}d)"/><path class="anal" d="${anal}" fill="${shade(c, 0, .8)}"/>
<path d="${body}" fill="url(#${id}b)"/>
<g clip-path="url(#${id}c)"><rect x="${f(-1.2)}" y="${f(-1.2)}" width="${f(2.6)}" height="${f(2.4)}" fill="url(#${id}h)"/>${bands}
<path d="${sc}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".8" transform="translate(.5 .7)"/><path d="${sc}" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width=".8"/>${gl}
<g transform="skewX(-20)"><rect class="shine" x="${f(-1.5)}" y="${f(-1.2)}" width="${f(.55)}" height="${f(2.4)}" fill="url(#${id}s)" style="--d:${f(3.4)}px"/></g></g>
<path d="${body}" fill="none" stroke="${shade(c, -.6, .55)}" stroke-width="${q(Math.max(.7, R * .045))}"/>
<path d="M${f(1.17)} ${f(.08)}Q${f(1.05)} ${f(.2)} ${f(.93)} ${f(.16)}" fill="none" stroke="${shade(c, -.7, .75)}" stroke-width="${q(Math.max(.7, R * .05))}"/>
<path d="M${f(.72 + .46 * Math.cos(Math.PI * .62))} ${f(.46 * Math.sin(Math.PI * .62))}A${f(.46)} ${f(.46)} 0 0 0 ${f(.72 + .46 * Math.cos(Math.PI * 1.38))} ${f(.46 * Math.sin(Math.PI * 1.38))}" fill="none" stroke="${shade(c, -.6, .38)}" stroke-width="${q(Math.max(.7, R * .05))}"/>${photo}
<g transform="translate(${f(.5)} ${f(.2 * th)}) rotate(32)"><path class="pect" d="${pect}" fill="${shade(c, .15, .8)}" stroke="${shade(c, -.5, .4)}" stroke-width=".7"/></g>
<circle cx="${ex}" cy="${ey}" r="${f(.22)}" fill="#fff"/><circle cx="${q(+ex + R * .035)}" cy="${ey}" r="${f(.15)}" fill="${iris}"/><circle cx="${q(+ex + R * .05)}" cy="${ey}" r="${f(.09)}" fill="#000"/><circle cx="${q(+ex + R * .1)}" cy="${q(+ey - R * .07)}" r="${f(.045)}" fill="#fff"/></svg>`;
}

// Ligne « évolution » de la carte : les 3 formes (alevin -> adulte -> géant) + la capacité débloquée
function evoRow(s) {
  const ab = ABIL[s.abil], W = [60, 76, 96], sub = [`départ`, `🔓 ${ab.icon} ${ab.name}`, `⚡ ${ab.up}`];
  const cells = STAGE_NAMES.map((n, i) => `<div class="evo-c${i === 1 ? ' unlock' : ''}"><div class="evo-art" style="--c:${s.col}">${fishSVG({ ...s, _st: stageStyle(s, i) }).replace('<svg ', `<svg style="width:${W[i]}px" `)}</div><b>${n}</b><small>${sub[i]}</small></div>`);
  return `<div class="evo">${cells.join('<span class="evo-arrow">›</span>')}</div><div class="abil"><b>${ab.icon} ${ab.name}</b> <kbd>E</kbd> <kbd>clic droit</kbd><br>${ab.desc}</div>`;
}

function renderCard() {
  const s = activeSp(), base = SPECIES[pick], locked = !Eco.owns(base), card = $('card'), bar = (l, v) => `<div class="st"><span>${l}</span><div class="bar"><b style="width:${Math.round(min(1, v) * 100)}%"></b></div></div>`;
  const sk = Eco.skins.map(z => { const own = Eco.skinOwned(z), on = Eco.skinId() === z.id; return `<i class="sk${on ? ' on' : ''}${own ? '' : ' lk'}" data-id="${z.id}" title="${z.name}${own ? '' : ' — ' + z.cost + (z.cur === 'pearls' ? ' perles' : ' pièces')}" style="--k:${z.col || base.col}">${own ? '' : '🔒'}</i>`; }).join('');
  card.className = 'card' + (locked ? ' locked' : '');
  card.innerHTML = `<div class="art" style="--c:${s.col}">${fishSVG(s)}${locked ? '<div class="lockico">🔒</div>' : ''}</div><h3>${base.name}</h3><div class="tagline">${base.info}</div><p>${base.desc}</p>` +
    (locked ? `<button class="btn tiny pulse" id="unlock">🔓 Débloquer · ${base.price} <i class="pearl"></i></button><div class="have">Tu as <b>${Eco.wallet().pearls}</b> <i class="pearl"></i> — les perles se trouvent en profondeur</div>` : '') +
    `${bar('Vitesse', base.speed / 4.4)}${bar('Maniabilité', base.force / .28)}${bar('Taille', base.r / 20)}${evoRow(s)}<div class="skins"><span>Skin</span>${sk}</div>`;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = `slide${dir > 0 ? 'R' : 'L'} .35s ease`;
  const go = $('go'); go.disabled = locked; go.textContent = locked ? '🔒 Verrouillé' : '🌊 PLONGER';
  const un = $('unlock'); if (un) un.onclick = () => { if (Eco.buyFish(base.name)) renderCard(); };
  card.querySelectorAll('.sk').forEach(el => el.onclick = () => {
    const z = Eco.skins.find(x => x.id === el.dataset.id);
    if (Eco.skinOwned(z)) { Eco.setSkin(z.id); renderCard(); snd.tick(); } else Eco.open('select', 'skins');
  });
  $('dots').innerHTML = SPECIES.map((sp, i) => `<i class="${i === pick ? 'on' : ''}" data-i="${i}" ${Eco.owns(sp) ? '' : 'style="opacity:.45"'}></i>`).join('');
  $('dots').querySelectorAll('i').forEach(el => el.onclick = () => { const i = +el.dataset.i; dir = i > pick ? 1 : -1; pick = i; renderCard(); snd.tick(); });
}

function showOver() {
  if (state !== 'over') return;
  const names = { Requin: 'un requin', Baudroie: 'une baudroie', Calmar: 'un calmar', Marteau: 'un requin-marteau', Murène: 'une murène', Barracuda: 'un banc de barracudas', Orque: 'une meute d\'orques', Éruption: 'une éruption volcanique' };
  const who = killer && killer.bossName ? 'le boss ' + killer.bossName : killer instanceof Jellyfish ? 'une méduse' : killer && killer.sp ? names[killer.sp.name] || 'un prédateur' : 'les abysses';
  $('o_kill').textContent = `Tu t'es fait croquer par ${who}…`;
  $('o_fish').innerHTML = fishSVG(player.sp);
  $('o_level').textContent = level; $('o_eaten').textContent = eaten; $('o_size').textContent = player.r.toFixed(1) + ' · ' + STAGE_NAMES[player.stage | 0]; $('o_depth').textContent = maxDepth + ' m'; $('o_coins').textContent = Eco.run.coins; $('o_pearls').textContent = Eco.run.pearls;
  const sg = Stage.def(), bb = Boss.main();
  $('stg_o').style.display = sg ? '' : 'none';
  if (sg) { $('o_best').className = ''; $('o_best').textContent = `${sg.icon} Stage ${Stage.cur + 1} · ${sg.name}` + (bb ? ` · Boss à ${Math.round(bb.hp)} % de vie` : ''); }
  else { $('o_best').className = isRecord ? 'rec' : ''; $('o_best').textContent = isRecord ? '🏆 Nouveau record !' : `Record : ${best}`; }
  let n = 0; $('o_score').textContent = 0;
  const t = setInterval(() => { n = Math.min(score, n + Math.ceil(score / 40)); $('o_score').textContent = n; if (n >= score) clearInterval(t); }, 25);
  showScreen('over');
}

// Décor animé du menu : un banc de poissons qui fuit la souris + bulles
function initMenuFish() {
  menuFish = []; const pool = [...PREY, ...SPECIES.map(s => ({ ...s, speed: s.speed * .55, force: s.force * .6 }))];
  for (let i = 0; i < 26; i++) menuFish.push(new Prey(random(width), random(height), random(pool), random(.9, 1.3)));
}
function menuScene() {
  const mo = { pos: createVector(mouseX, mouseY), vel: createVector(mouseX - pmouseX, mouseY - pmouseY), r: 80 };
  for (const f of menuFish) { f.think(menuFish, [mo], [], []); f.update(); }
  menuFish.forEach(f => f.show());
  if (frameCount % 12 === 0) menuBub.push({ x: random(width), y: height + 10, s: random(4, 12), l: 500, vx: 0, vy: -random(.6, 1.4) });
  if (moved && frameCount % 5 === 0) menuBub.push({ x: mouseX, y: mouseY, s: random(3, 8), l: 100, vx: random(-.4, .4), vy: -random(.5, 1.2) });
  noFill(); strokeWeight(1);
  for (let i = menuBub.length - 1; i >= 0; i--) {
    const b = menuBub[i]; b.x += b.vx + sin(frameCount * .05 + b.y * .02) * .3; b.y += b.vy; b.l--;
    stroke(255, min(160, b.l * 2)); circle(b.x, b.y, b.s); if (b.l <= 0 || b.y < -20) menuBub.splice(i, 1);
  }
}

// ================= Caméra, mini-carte, alertes =================
function updateCam() {
  cam.x = lerp(cam.x, constrain(player.pos.x - width / 2, 0, max(0, WW - width)), .12);
  cam.y = lerp(cam.y, constrain(player.pos.y - height / 2, 0, max(0, WH - height)), .12);
}

function minimap() {
  if (!showMap || state === 'title' || state === 'select') return;
  const mw = min(220, width * .3), mh = mw * WH / WW, sx = mw / WW, sy = mh / WH;
  push(); translate(width - mw - 14, height - mh - 14); noStroke();
  fill(2, 12, 28, 190); rect(-4, -4, mw + 8, mh + 8, 8);
  World.miniBg(sx, sy);
  fill(70, 100, 130); for (const o of obstacles) circle(o.pos.x * sx, o.pos.y * sy, max(2, o.r * 2 * sx));
  fill(255, 140, 60); for (const v of vents) circle(v.pos.x * sx, v.pos.y * sy, 4);
  fill(255, 255, 255, 80); for (const p of preys) rect(p.pos.x * sx, p.pos.y * sy, 1, 1);
  fill(120, 200, 255, 120); for (const c of critters) rect(c.pos.x * sx, c.pos.y * sy, 2, 2);
  fill(211, 139, 255); for (const j of jellies) circle(j.pos.x * sx, j.pos.y * sy, 3);
  fill(255, 60, 60); for (const pr of [...preds, ...squids, ...wild]) if (pr.pos.dist(player.pos) < P.detect * 3) circle(pr.pos.x * sx, pr.pos.y * sy, 5);
  fill(255, 215, 0); for (const g of golds) circle(g.pos.x * sx, g.pos.y * sy, 5 + 2 * sin(frameCount * .3));
  for (const u of pups) { fill(PUPS[u.t].c); circle(u.x * sx, u.y * sy, 4); }
  Eco.mini(sx, sy);
  World.mini(sx, sy); Boss.mini(sx, sy);
  noFill(); stroke(255, 255, 255, 170); rect(cam.x * sx, cam.y * sy, width * sx, height * sy);
  noStroke(); fill(255); circle(player.pos.x * sx, player.pos.y * sy, 5);
  fill(255, 170); textSize(10); textAlign(LEFT, BOTTOM); text('CARTE (N)', 2, -6);
  pop();
}

// Alerte de danger : grande flèche pulsante vers le prédateur le plus proche (hors écran), petites flèches pour les autres
function dangerArrows() {
  const cx = width / 2, cy = height / 2, pulse = .5 + .5 * sin(frameCount * .25);
  for (const pr of [...preds, ...squids, ...wild]) {
    const sx = pr.pos.x - cam.x, sy = pr.pos.y - cam.y, d = pr.pos.dist(player.pos), main = pr === nearThreat;
    if (sx > -20 && sx < width + 20 && sy > -20 && sy < height + 20) continue;
    if (d > P.detect * 3) continue;
    const a = atan2(sy - cy, sx - cx), k = min((cx - 40) / max(abs(cos(a)), 1e-6), (cy - 40) / max(abs(sin(a)), 1e-6)), x = cx + cos(a) * k, y = cy + sin(a) * k;
    push(); translate(x, y); noStroke();
    if (main) {
      const sc = 1 + pulse * .35 + constrain(map(d, P.detect * 3, 0, 0, .8), 0, .8);
      drawingContext.shadowBlur = 20; drawingContext.shadowColor = '#ff2a2a';
      push(); rotate(a); scale(sc); fill(255, 50, 50, 230); triangle(20, 0, -12, -13, -12, 13); pop();
      drawingContext.shadowBlur = 0; fill(255); textAlign(CENTER, CENTER); textSize(12); text(floor(d / 10) + ' m', -cos(a) * 34, -sin(a) * 34);
    } else { rotate(a); fill(255, 90, 90, 110); triangle(11, 0, -6, -7, -6, 7); }
    pop();
  }
}

// Barre de progression du niveau (en bas, au centre)
function levelBar() {
  const w = min(200, width * .2), x = (width - w) / 2, y = height - 18, p = constrain((score - (level - 1) * 300) / 300, 0, 1);
  noStroke(); fill(0, 90); rect(x - 3, y - 3, w + 6, 12, 6); fill(255, 255, 255, 30); rect(x, y, w, 6, 3);
  const g = drawingContext.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#2bb3d6'); g.addColorStop(1, '#ffd166');
  drawingContext.fillStyle = g; drawingContext.fillRect(x, y, w * p, 6);
  fill(255, 255, 255, 170); textSize(9); textAlign(CENTER, BOTTOM); text(`NIV ${level} · ${floor(p * 100)} %`, width / 2, y - 4);
}

function setMuted(m) { muted = m; snd.start(m); snd.mute(m); $('soundbtn').textContent = m ? '🔇' : '🔊'; }
function setPause(b) {
  if (state !== 'play') return; paused = b; $('pausemenu').classList.toggle('hide', !b);
  if (b) { const st = Stage.on(); $('p_stages').style.display = st ? '' : 'none'; $('p_restart').textContent = st ? '↻ Recommencer le stage' : '↻ Recommencer'; }
}

// ================= Debug amélioré (touche D) =================
function debugWorld() {
  push(); noFill(); strokeWeight(1);
  stroke(255, 255, 255, 45); for (const o of obstacles) if (vis(o)) circle(o.pos.x, o.pos.y, o.r * 2);
  stroke(255, 200, 80, 90); circle(player.pos.x, player.pos.y, P.detect * 3.2);
  stroke(255, 80, 80, 110); circle(player.pos.x, player.pos.y, P.detect * .8);
  stroke(120, 200, 255, 120); line(player.pos.x, player.pos.y, mouseX + cam.x, mouseY + cam.y);
  for (const v of [player, ...followers, ...preys, ...critters, ...preds, ...squids, ...wild, ...jellies, ...golds]) {
    if (!vis(v)) continue;
    stroke(80, 255, 120); line(v.pos.x, v.pos.y, v.pos.x + v.vel.x * 12, v.pos.y + v.vel.y * 12);
    if (v.fa) { stroke(255, 70, 70); line(v.pos.x, v.pos.y, v.pos.x + v.fa.x * 150, v.pos.y + v.fa.y * 150); }
  }
  pop();
}
function debugHud() {
  const L = [`FPS : ${round(frameRate())}`, `Proies ${preys.length} · Préd. ${preds.length} · Calmars ${squids.length} · Spéciaux ${wild.length} · Poissons libres ${critters.length} · Méduses ${jellies.length}`,
    `Monde ${WW}×${WH} · Caméra ${round(cam.x)}, ${round(cam.y)}`, `Menace : ${nearThreat ? round(threatD) + ' px' : '—'} · Tension ${round(tension * 100)} %`,
    `Audio : ${snd.state()}`, `Vitesse joueur ${nf(player.vel.mag(), 1, 2)} / ${nf(player.maxSpeed, 1, 2)}`, 'vert = vitesse · rouge = force · jaune/rouge = zone de menace'];
  noStroke(); fill(0, 160); rect(10, height - 20 - L.length * 16 - 56, 400, L.length * 16 + 12, 6); fill(120, 255, 160); textSize(12); textAlign(LEFT, TOP);
  L.forEach((l, i) => text(l, 16, height - 14 - L.length * 16 - 56 + i * 16));
}
