// =====================================================================
//  stages.js — mode Stages : 5 cartes (une par biome), objectifs, étoiles, progression
//
//  Les visuels (palette, décor, obscurité, événements, taille de la carte) sont dans world.js
//  (World.stages[biome]). Ici : ce qui fait le STAGE lui-même :
//    - objectifs à remplir, seuils d'étoiles, boss prévu
//    - écosystème (densités d'espèces par « surface d'écran ») qui change à chaque stage
//    - rochers, point de départ
//    - suivi des objectifs en jeu, fin de stage, étoiles, déblocage du suivant (localStorage)
//
//  Densités (eco) : nombre d'individus par surface d'écran (la carte d'un stage fait size[0] x size[1] écrans).
//    prey = proies · pred = requins · baud = part de baudroies parmi eux · jelly = méduses · squid = calmars
//    hammer / moray = requins-marteaux, murènes · barra / orca = BANCS et MEUTES · life = poissons indépendants [petits, moyens, gros]
//    mix = répartition des 3 sortes de proies (la 3e brille dans le noir)
//    crit = espèces de poissons indépendants propres au biome, par taille [petits, moyens, gros]
//    tune = caractère des prédateurs : shark / baud = [vitesse ×, vue ×] · special = vitesse × (marteau, barracuda, orque) · moray = portée × · squid = vitesse ×
//  Seuils d'étoiles (stars) : score final pour 2★ et 3★ (1★ = stage terminé).
// =====================================================================

const STAGES = [
  {
    key: 'reef', biome: 'reef', name: 'Récif corallien', icon: '🪸', sub: 'Tes premiers coups de nageoire',
    boss: 'Requin-marteau colossal',
    objectives: [{ t: 'eat', n: 20 }, { t: 'grow', v: 1 }],
    stars: [1400, 2200], start: [.08, .2], rocks: { d: 8, r: [25, 60], y: .2 },
    eco: { prey: 44, mix: [.4, .45, .15], pred: .6, baud: 0, jelly: .5, squid: 0, hammer: 0, moray: 0, barra: 0, orca: 0, life: [.9, .45, .2], predY: [.1, .55] },
  },
  {
    key: 'kelp', biome: 'kelp', name: 'Forêt de kelp', icon: '🌿', sub: 'Les murènes guettent dans les algues',
    boss: 'Murène géante',
    objectives: [{ t: 'pearls', n: 3 }, { t: 'eat', n: 30 }],
    stars: [1900, 2900], start: [.06, .2], rocks: { d: 9, r: [25, 58], y: .2 },
    eco: { prey: 40, mix: [.4, .4, .2], pred: .8, baud: 0, jelly: .9, squid: 0, hammer: .06, moray: .45, barra: 0, orca: 0, life: [.8, .4, .16], predY: [.15, .65] },
  },
  {
    key: 'wreck', biome: 'wreck', name: "Cimetière d'épaves", icon: '⚓', sub: 'Barracudas, orques et trésors',
    boss: 'Orque géante',
    objectives: [{ t: 'chests', n: 3 }, { t: 'coins', n: 60 }],
    stars: [2500, 3700], start: [.05, .2], rocks: { d: 10, r: [26, 60], y: .2 },
    eco: { prey: 36, mix: [.35, .4, .25], pred: 1, baud: .1, jelly: .8, squid: 0, hammer: .12, moray: .35, barra: .09, orca: .045, life: [.6, .33, .14], predY: [.12, .7] },
  },
  {
    key: 'cave', biome: 'cave', name: 'Grotte sous-marine', icon: '💎', sub: 'Noir, cristaux et calmars',
    boss: 'Baudroie géante',
    objectives: [{ t: 'pearls', n: 4 }, { t: 'eat', n: 35 }],
    stars: [2700, 4000], start: [.05, .18], rocks: { d: 12, r: [30, 70], y: .22 },
    eco: { prey: 32, mix: [.2, .35, .45], pred: .9, baud: .45, jelly: 1.5, squid: .5, hammer: .08, moray: .5, barra: 0, orca: 0, life: [.5, .3, .12], predY: [.2, .85] },
  },
  {
    key: 'abyss', biome: 'abyss', name: 'Fosse abyssale', icon: '🌌', sub: 'Là où la lumière ne va plus',
    boss: 'Mégalodon',
    objectives: [{ t: 'grow', v: 2 }, { t: 'pearls', n: 5 }],
    stars: [3200, 4600], start: [.04, .2], rocks: { d: 7, r: [30, 66], y: .25 },
    eco: { prey: 26, mix: [.15, .3, .55], pred: 1.2, baud: .5, jelly: 1.7, squid: .8, hammer: .14, moray: .3, barra: .08, orca: .05, life: [.4, .25, .1], predY: [.25, .9] },
  },
];

// Espèces propres aux stages (le mode libre garde les siennes)
const CRIT_X = [
  { name: 'Poisson-papillon', tier: 0, r: 8, speed: 2.9, force: 0.15, col: '#ffd23c', stripe: true },
  { name: 'Hareng', tier: 0, r: 7, speed: 3.1, force: 0.16, col: '#a9c7d8' },
  { name: 'Tétra des grottes', tier: 0, r: 7, speed: 2.8, force: 0.15, col: '#ddd6ff', glow: true },
  { name: 'Poisson-lanterne', tier: 0, r: 7, speed: 2.9, force: 0.15, col: '#7fe8ff', glow: true },
  { name: 'Perche', tier: 1, r: 12, speed: 2.6, force: 0.12, col: '#7fae5a', stripe: true },
  { name: 'Sar', tier: 1, r: 13, speed: 2.6, force: 0.12, col: '#bdb6a2', stripe: true },
  { name: 'Cardinal', tier: 1, r: 12, speed: 2.5, force: 0.12, col: '#ff7a7a', glow: true },
  { name: 'Grenadier', tier: 1, r: 13, speed: 2.5, force: 0.12, col: '#8a9bb8', glow: true },
  { name: 'Mérou des abysses', tier: 2, r: 21, speed: 2.2, force: 0.09, col: '#7a64a0', glow: true },
];
const CRIT_BY_NAME = Object.fromEntries([...CRIT.flat(), ...CRIT_X].map(s => [s.name, s]));

// Caractère de l'écosystème, stage par stage : récif calme -> abysses impitoyables
const ECO_EXTRA = {
  reef:  { tune: { shark: [.85, .75], baud: [1, 1], special: 1, moray: 1, squid: 1 },
           crit: [['Poisson-clown', 'Chromis', 'Poisson-papillon'], ['Dorade', 'Bonite'], ['Mérou', 'Napoléon']] },
  kelp:  { tune: { shark: [.95, .9], baud: [1, 1], special: 1, moray: 1.15, squid: 1 },
           crit: [['Sardine', 'Hareng', 'Chromis'], ['Bar', 'Perche', 'Bonite'], ['Mérou']] },
  wreck: { tune: { shark: [1, 1], baud: [1, 1], special: 1.05, moray: 1.1, squid: 1 },
           crit: [['Sardine', 'Poisson-clown', 'Hareng'], ['Sar', 'Dorade', 'Bar'], ['Mérou', 'Napoléon']] },
  cave:  { tune: { shark: [1, .9], baud: [1.05, 1], special: 1.05, moray: 1.2, squid: 1.1 },
           crit: [['Tétra des grottes', 'Chromis'], ['Cardinal', 'Bonite'], ['Mérou']] },
  abyss: { tune: { shark: [1.12, 1.25], baud: [1.12, 1.25], special: 1.12, moray: 1.3, squid: 1.2 },
           crit: [['Poisson-lanterne', 'Tétra des grottes'], ['Grenadier', 'Cardinal'], ['Mérou des abysses']] },
};
for (const s of STAGES) { Object.assign(s.eco, ECO_EXTRA[s.key]); s.eco.pool = s.eco.crit.map(l => l.map(n => CRIT_BY_NAME[n])); }

// Types d'objectifs : texte, icône, valeur courante, avancement (0..1)
const OBJ_TYPES = {
  eat: { icon: '🐟', text: o => `Manger ${o.n} poissons`, cur: () => eaten },
  pearls: { icon: '🦪', text: o => `Trouver ${o.n} perles`, cur: () => Eco.run.pearls },
  coins: { icon: '🪙', text: o => `Ramasser ${o.n} pièces`, cur: () => Eco.run.coins },
  chests: { icon: '💰', text: o => `Ouvrir ${o.n} coffres`, cur: () => Stage.chests },
  grow: { icon: '📏', text: o => o.v >= 2 ? 'Devenir géant' : 'Devenir adulte', cur: o => (player && (player.stage | 0) >= o.v) ? 1 : 0, n: () => 1, frac: o => player ? constrain(growthOf(player) / STAGE_AT[o.v], 0, 1) : 0, label: o => Math.floor((player ? constrain(growthOf(player) / STAGE_AT[o.v], 0, 1) : 0) * 100) + ' %' },
};

const Stage = (() => {
  const KEY = 'feStages', N = STAGES.length;
  let prog = { stars: Array(N).fill(0), best: Array(N).fill(0) };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.stars)) for (let i = 0; i < N; i++) { prog.stars[i] = Math.max(0, Math.min(3, s.stars[i] | 0)); prog.best[i] = +(s.best && s.best[i]) || 0; }
  } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { } };

  const S = {
    cur: null,            // index du stage en cours (null = mode libre)
    phase: 'obj',         // obj -> (boss) -> clear -> done
    objs: [], t: 0, chests: 0, intro: 0, toast: null, winT: 0, res: null, calm: 1,
    hooks: { spawnBoss: null },   // le boss s'accroche ici (voir la suite du mode Stages)
  };

  // ---------------- Progression ----------------
  S.list = STAGES;
  S.on = () => S.cur !== null && S.cur !== undefined;
  S.def = () => S.on() ? STAGES[S.cur] : null;
  S.find = q => { const n = +q; if (n >= 1 && n <= N) return n - 1; const i = STAGES.findIndex(s => s.key === q); return i >= 0 ? i : null; };
  S.stars = i => prog.stars[i] | 0;
  S.best = i => prog.best[i] | 0;
  S.totalStars = () => prog.stars.reduce((a, b) => a + b, 0);
  S.unlocked = i => i === 0 || prog.stars[i - 1] >= 1;   // un stage s'ouvre quand le précédent est terminé
  S.reset = () => { prog = { stars: Array(N).fill(0), best: Array(N).fill(0) }; save(); };
  S.size = () => World.stages[S.def().biome].size;

  // ---------------- Début de stage ----------------
  S.begin = () => {
    S.phase = 'obj'; S.t = 0; S.chests = 0; S.intro = 260; S.toast = null; S.winT = 0; S.res = null; S.calm = 1;
    S.objs = S.def().objectives.map(d => {
      const T = OBJ_TYPES[d.t], o = { ...d, done: false, val: 0 };
      o.icon = T.icon; o.label = T.text(o); o.total = T.n ? T.n(o) : o.n;
      o.read = () => T.cur(o); o.frac = () => T.frac ? T.frac(o) : constrain(o.read() / o.total, 0, 1);
      o.show = () => T.label ? T.label(o) : `${min(o.read(), o.total)}/${o.total}`;
      return o;
    });
  };
  S.onChest = () => { if (S.on()) S.chests++; };

  // ---------------- Pas de simulation : objectifs, fin de stage ----------------
  S.step = () => {
    if (!S.on() || state !== 'play') return;
    S.t++;
    if (S.phase === 'obj') {
      let all = true;
      for (const o of S.objs) {
        if (!o.done) {
          o.val = o.read();
          if (o.val >= o.total) {
            o.done = true; score += 150; S.toast = { t: 170, txt: `✔  ${o.label}` };
            floatText(player.pos.x, player.pos.y - 56, '✔ Objectif !', '#7dffb3'); snd.level(); bubblesAt(player.pos);
          }
        }
        if (!o.done) all = false;
      }
      if (all) { S.phase = S.hooks.spawnBoss ? 'boss' : 'clear'; S.winT = 100; if (S.hooks.spawnBoss) S.hooks.spawnBoss(); }
    }
    if (S.phase === 'clear' && --S.winT <= 0) S.win();
  };

  // Score final = score + 150 par vie restante (+ bonus du boss quand il existe)
  S.finalScore = (bossBonus = 0) => score + max(0, lives) * 150 + bossBonus;
  S.starsFor = fs => { const d = S.def(); return 1 + (fs >= d.stars[0] ? 1 : 0) + (fs >= d.stars[1] ? 1 : 0); };

  // Stage réussi : étoiles, sauvegarde, déblocage, récompenses
  S.win = (bossBonus = 0) => {
    if (S.phase === 'done') return;
    const i = S.cur, d = S.def(), fs = S.finalScore(bossBonus), st = S.starsFor(fs), first = prog.stars[i] === 0, gain = Math.max(0, st - prog.stars[i]);
    const rw = { coins: (first ? 100 : 25) * (i + 1), pearls: gain };
    prog.stars[i] = Math.max(prog.stars[i], st); prog.best[i] = Math.max(prog.best[i], fs); save();
    Eco.give(rw.coins, rw.pearls);
    S.res = { i, name: d.name, score, lifeBonus: max(0, lives) * 150, bossBonus, final: fs, stars: st, newBest: fs >= prog.best[i], rw, t: 0, unlockedNext: i + 1 < N && first, next: i + 1 < N };
    S.phase = 'done'; state = 'win'; snd.level(); shake = 6;
    setTimeout(() => { if (state === 'win' && S.res) { const b = document.getElementById('w_next'); b.disabled = !S.res.next; b.textContent = S.res.next ? '▶ Stage suivant' : '🏁 Dernier stage terminé'; showScreen('winscr'); } }, 900);
    Eco.bonus(player.pos.x, player.pos.y, 14, st >= 3 ? 3 : 0);
  };
  // Bouton « Stage suivant » / touche Entrée : lance le stage suivant, ou retourne à la liste après le dernier
  S.after = () => { const r = S.res; S.res = null; if (r && r.next) { S.cur = r.i + 1; startGame(); } else toStages(); };

  // ---------------- Écosystème du stage ----------------
  // Variante d'une espèce de prédateur réglée pour le stage (même nom, donc même apparence)
  const kinds = {};
  const tk = (base, speed = 1, sight = 1) => { const id = S.cur + base.name + speed + sight; return kinds[id] || (kinds[id] = { ...base, speed: base.speed * speed, sight }); };
  const pickPrey = mix => { let r = random() * (mix[0] + mix[1] + mix[2]); for (let k = 0; k < 3; k++) { r -= mix[k]; if (r <= 0) return PREY[k]; } return PREY[0]; };
  // ajuste le nombre d'éléments d'une liste (test = quels éléments comptent)
  const fit = (arr, test, want, make) => {
    let c = 0; for (const e of arr) if (test(e)) c++;
    while (c < want) { arr.push(make()); c++; }
    while (c > want) { for (let i = arr.length - 1; i >= 0; i--) if (test(arr[i])) { arr[i].dead = true; arr.splice(i, 1); break; } c--; }
  };
  S.sync = () => {
    const d = S.def(), E = d.eco, a = A(), lv = level, calm = S.calm, boost = (1 + .08 * Math.min(lv - 1, 6)) * calm;
    const cnt = (dens, b = 1) => dens > 0 && b > 0 ? Math.max(1, Math.round(dens * a * b)) : 0;
    // proies
    const nPr = Math.round(E.prey * a);
    while (preys.length < nPr) { const p = away(200); preys.push(new Prey(p.x, p.y, pickPrey(E.mix), random(.9, 1.3))); }
    while (preys.length > nPr) preys.pop();
    // requins et baudroies
    const nP = cnt(E.pred, boost), nB = Math.round(nP * E.baud), [y0, y1] = E.predY, T = E.tune;
    fit(preds, p => p.kind.name === 'Requin', nP - nB, () => { const p = away(350); return new Predator(p.x, random(WH * y0, WH * y1), tk(PRED[0], T.shark[0], T.shark[1])); });
    fit(preds, p => p.kind.name === 'Baudroie', nB, () => { const p = away(350); return new Predator(p.x, random(WH * .62, WH * .92), tk(PRED[1], T.baud[0], T.baud[1])); });
    // méduses, calmars
    fit(jellies, () => true, cnt(E.jelly), () => { const p = away(200); return new Jellyfish(p.x, random(WH * .3, WH * .95)); });
    fit(squids, () => true, cnt(E.squid, calm), () => { const p = away(350); return new Squid(p.x, random(WH * .62, WH * .9), tk(PRED_SQUID, T.squid)); });
    // prédateurs spéciaux
    fit(wild, w => w instanceof HammerShark, cnt(E.hammer, calm), () => { const p = spawnPt(WH * .2, WH * .7), h = new HammerShark(p.x, p.y); h.sp = tk(PRED_HAMMER, T.special); return h; });
    const nM = cnt(E.moray, calm);
    let c = 0; for (const w of wild) if (w instanceof Moray) c++;
    if (c < nM) {
      const free = obstacles.filter(o => !o.moray && o.pos.y > WH * .18 && (!player || o.pos.dist(player.pos) > 450));
      while (c < nM && free.length) { const m = new Moray(free.splice(floor(random(free.length)), 1)[0]); m.L *= T.moray; wild.push(m); c++; }
    }
    while (c > nM) { const m = wild.find(w => w instanceof Moray); if (!m) break; m.rock.moray = false; removeKind(Moray); c--; }
    syncPacks('b', cnt(E.barra, calm), 4 + floor(lv / 8), WH * .08, WH * .55, (x, y, pk) => { const b = new Barracuda(x, y, pk); b.sp = tk(PRED_BARRA, T.special); return b; });
    syncPacks('o', cnt(E.orca, calm), 3 + floor(lv / 6), WH * .08, WH * .45, (x, y, pk, i, n) => { const o = new Orca(x, y, pk, TWO_PI * i / n); o.sp = tk(PRED_ORCA, T.special); return o; });
    // poissons indépendants
    for (let t = 0; t < 3; t++) fit(critters, k => k.sp.tier === t, Math.round(E.life[t] * a), () => { const p = lifeSpawn(t); return new Critter(p.x, p.y, random(E.pool[t])); });
  };

  // ---------------- Interface en jeu (canvas) ----------------
  const starShape = (cx, cy, R) => { beginShape(); for (let k = 0; k < 10; k++) { const an = -HALF_PI + k * PI / 5, r = k % 2 ? R * .46 : R; vertex(cx + cos(an) * r, cy + sin(an) * r); } endShape(CLOSE); };
  S.starShape = starShape;

  // Carte des objectifs sous le panneau de score ; renvoie le y suivant
  S.hudCard = (x, y, W) => {
    const d = S.def(); if (!d) return y;
    const rows = S.objs.length, H = 34 + rows * 31 + 28;
    push(); glassPanel(x, y, W, H, 16);
    textAlign(LEFT, CENTER); textStyle(BOLD); textSize(10); noStroke(); fill(127, 214, 255, 220);
    text(`${d.icon}  STAGE ${S.cur + 1} · ${d.name.toUpperCase()}`, x + 14, y + 17);
    textAlign(RIGHT, CENTER); fill(255, 255, 255, 120); text(S.phase === 'obj' ? 'OBJECTIFS' : S.phase === 'boss' ? 'BOSS !' : 'TERMINÉ', x + W - 14, y + 17);
    S.objs.forEach((o, k) => {
      const ry = y + 34 + k * 31, p = o.done ? 1 : o.frac();
      textAlign(LEFT, CENTER); textStyle(NORMAL); textSize(15); fill(255, o.done ? 130 : 255); text(o.done ? '✅' : o.icon, x + 14, ry + 8);
      textStyle(BOLD); textSize(12); fill(o.done ? color(125, 255, 179, 220) : color(255, 255, 255, 240)); text(o.label, x + 38, ry + 7);
      textAlign(RIGHT, CENTER); textStyle(NORMAL); textSize(11); fill(255, 255, 255, o.done ? 120 : 210); text(o.done ? 'OK' : o.show(), x + W - 14, ry + 7);
      gradBar(x + 38, ry + 17, W - 38 - 14, 5, p, o.done ? '#3fcf8e' : '#2bb3d6', o.done ? '#7dffb3' : '#ffd166');
    });
    // étoiles visées : 1★ = stage terminé, 2★ / 3★ = score
    const sy = y + 34 + rows * 31 + 8, fsNow = S.finalScore(), got = S.phase === 'obj' ? 0 : S.starsFor(fsNow);
    for (let k = 0; k < 3; k++) {
      const on = k === 0 ? S.phase !== 'obj' : fsNow >= d.stars[k - 1];
      noStroke(); fill(on ? color('#ffd166') : color(255, 255, 255, 38));
      drawingContext.shadowBlur = on ? 10 : 0; drawingContext.shadowColor = '#ffb347'; starShape(x + 22 + k * 22, sy + 7, 8); drawingContext.shadowBlur = 0;
    }
    textAlign(LEFT, CENTER); textStyle(NORMAL); textSize(10); fill(255, 255, 255, 170);
    const nextT = fsNow < d.stars[0] ? d.stars[0] : fsNow < d.stars[1] ? d.stars[1] : 0;
    text(nextT ? `prochaine étoile : ${nextT} pts` : '★★★ en vue !', x + 88, sy + 8);
    pop(); return y + H + 10;
  };

  // Bandeaux centraux (début de stage, objectif accompli) + écran de résultat provisoire
  S.draw = () => {
    if (!S.on()) return;
    const d = S.def(); push(); noStroke();
    if (S.intro > 0 && state === 'play') {
      const a = constrain(min(S.intro / 40, (260 - S.intro) / 25), 0, 1); if (!paused) S.intro--;
      textAlign(CENTER, CENTER); drawingContext.shadowBlur = 24; drawingContext.shadowColor = '#2bb3d6';
      textStyle(BOLD); textSize(min(18, width * .035)); fill(127, 214, 255, 255 * a); text(`STAGE ${S.cur + 1}`, width / 2, height * .24);
      textSize(min(52, width * .08)); fill(255, 255, 255, 255 * a); text(`${d.icon} ${d.name}`, width / 2, height * .24 + 46);
      drawingContext.shadowBlur = 0; textStyle(NORMAL); textSize(min(20, width * .04)); fill(255, 209, 102, 255 * a);
      text(d.sub, width / 2, height * .24 + 90);
      textSize(min(16, width * .035)); fill(255, 255, 255, 230 * a); S.objs.forEach((o, k) => text(`${o.icon}  ${o.label}`, width / 2, height * .24 + 126 + k * 26));
    }
    if (S.toast && S.toast.t > 0 && state === 'play') {
      const a = constrain(min(S.toast.t / 20, (170 - S.toast.t) / 12), 0, 1); if (!paused) S.toast.t--;
      const w = min(420, width - 40), x = width / 2 - w / 2, y = 84;
      glassPanel(x, y, w, 44, 22); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(17); fill(125, 255, 179, 255 * a); text(S.toast.txt, width / 2, y + 23);
    }
    pop();
    if (state === 'win' && S.res) S.drawResult();
  };

  S.drawResult = () => {
    const r = S.res; r.t++;
    push(); noStroke(); fill(1, 6, 18, min(170, r.t * 6)); rect(0, 0, width, height);
    const w = min(470, width - 30), h = 450, x = width / 2 - w / 2, y = height / 2 - h / 2, pop_ = k => constrain((r.t - k) / 14, 0, 1);
    fill(3, 14, 32, 235); rect(x, y, w, h, 24); glassPanel(x, y, w, h, 24);
    textAlign(CENTER, CENTER); textStyle(BOLD);
    textSize(32); fill(255, 224, 120); drawingContext.shadowBlur = 22; drawingContext.shadowColor = '#ffb347'; text('STAGE TERMINÉ !', width / 2, y + 40); drawingContext.shadowBlur = 0;
    textSize(15); textStyle(NORMAL); fill(127, 214, 255); text(`${STAGES[r.i].icon} ${r.name}`, width / 2, y + 72);
    for (let k = 0; k < 3; k++) {
      const on = k < r.stars, p = pop_(24 + k * 22), sc = on ? 1 + .5 * (1 - p) * (p > 0 ? 1 : 0) : 1, cx = width / 2 + (k - 1) * 84, cy = y + 140;
      push(); translate(cx, cy); scale(on ? p * sc : 1);
      if (on) { fill(255, 209, 102); drawingContext.shadowBlur = 24; drawingContext.shadowColor = '#ffb347'; } else fill(255, 255, 255, 36);
      starShape(0, 0, k === 1 ? 44 : 36); drawingContext.shadowBlur = 0; pop();
    }
    textSize(14); textAlign(LEFT, CENTER); const lx = x + 40, rx = x + w - 40; let yy = y + 216;
    const line = (a, b, col = 255) => { textAlign(LEFT, CENTER); fill(255, 255, 255, 190); text(a, lx, yy); textAlign(RIGHT, CENTER); textStyle(BOLD); fill(col); text(b, rx, yy); textStyle(NORMAL); yy += 26; };
    line('Score', r.score); line('Bonus vies restantes', '+' + r.lifeBonus); if (r.bossBonus) line('Bonus boss vaincu', '+' + r.bossBonus, color(255, 160, 120));
    stroke(255, 255, 255, 60); strokeWeight(1); line_(lx, yy - 8, rx, yy - 8); noStroke(); yy += 10;
    textSize(18); line('Score final', r.final + (r.newBest ? '  🏆' : ''), color('#ffd166')); textSize(14); yy += 8;
    line('Récompense', `+${r.rw.coins} 🪙${r.rw.pearls ? `   +${r.rw.pearls} 🦪` : ''}`, color(255, 232, 140));
    if (r.unlockedNext) line('Débloqué', `🔓 Stage ${r.i + 2}`, color('#7dffb3'));
    textAlign(CENTER, CENTER); textSize(12); fill(255, 255, 255, 120 + 90 * Math.sin(frameCount * .08)); text(r.next ? 'Entrée : stage suivant' : 'Entrée : retour aux stages', width / 2, y + h - 24);
    pop();
  };
  const line_ = (x1, y1, x2, y2) => line(x1, y1, x2, y2);   // line() de p5 (masquée localement par la fonction d'affichage)

  return S;
})();
