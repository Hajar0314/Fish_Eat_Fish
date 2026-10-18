// =====================================================================
//  ecosystem.js — ambiance vivante : des poissons INDÉPENDANTS vivent leur vie
//  Trois tailles (petits / moyens / gros). Règle unique : le plus gros mange le plus petit.
//    - ils fuient (sprint + bulles de panique) tout ce qui est nettement plus gros qu'eux :
//      autres poissons, prédateurs, et le joueur quand il est plus gros
//    - quand ils ont faim, ils chassent le plus petit à portée (proies du banc ou autres poissons)
//    - repus après un repas (~5 s), ils se promènent ; les petits nagent en banc ; un poisson qui fuit s'épuise et finit par être rattrapé
//    - les prédateurs sans cible s'en prennent aussi à eux
//    - le joueur peut les manger s'il est assez gros (bonus de points) ; ils ne l'attaquent jamais
//  Comme les autres entités, seule la zone proche de l'écran est simulée.
// =====================================================================

let critters = [];
const resetLife = () => { critters = []; };

// tier 0 = petits (en banc), 1 = moyens, 2 = gros. Les noms sans style dédié utilisent le style par défaut.
const CRIT = [
  [{ name: 'Sardine', tier: 0, r: 7, speed: 3.0, force: 0.16, col: '#d7ecff' },
   { name: 'Poisson-clown', tier: 0, r: 8, speed: 2.8, force: 0.15, col: '#ff9a3c', stripe: true },
   { name: 'Chromis', tier: 0, r: 7, speed: 3.0, force: 0.16, col: '#46c2ff' }],
  [{ name: 'Dorade', tier: 1, r: 12, speed: 2.7, force: 0.12, col: '#e6b85c' },
   { name: 'Bar', tier: 1, r: 13, speed: 2.6, force: 0.12, col: '#8fb79a' },
   { name: 'Bonite', tier: 1, r: 13, speed: 2.8, force: 0.12, col: '#6aa3d9' }],
  [{ name: 'Mérou', tier: 2, r: 20, speed: 2.3, force: 0.09, col: '#b0764d' },
   { name: 'Napoléon', tier: 2, r: 22, speed: 2.2, force: 0.09, col: '#3fa7a0' }],
];

class Critter extends Fish {
  constructor(x, y, sp) {
    super(x, y, sp, random(.92, 1.1));
    this.full = random(0, 160); this.mode = 'cruise'; this.maxR = sp.r * 1.6; this.sta = 300;   // sta = endurance de sprint
  }
  // cx : { mates (visibles), byTier, prey (visibles), hunters, team, obs }
  think(cx) {
    this.lookAhead = P.look * .8; this.full = max(0, this.full - 1);
    // ---- menace la plus proche ----
    const R = this.mode === 'flee' ? 280 : 150 + this.r * 4; let fear = null, fd = R;   // en fuite, il garde son alerte tant que le chasseur est à portée
    const watch = o => { const d = this.pos.dist(o.pos); if (d < fd) { fd = d; fear = o; } };
    for (const h of cx.hunters) if (h.r > this.r * .8 || h instanceof Moray) watch(h);
    for (const m of cx.mates) if (m !== this && !m.dead && m.r > this.r * 1.25) watch(m);
    for (const t of cx.team) if (t.r > this.r * 1.15) watch(t);
    if (fear) {                                   // fuite : sprint + bulles de panique
      this.mode = 'flee'; this.maxForce = this.sp.force * 1.6;
      if (this.sta > 0) { this.sta--; this.maxSpeed = this.sp.speed * 1.15; } else this.maxSpeed = this.sp.speed * .8;   // épuisé : il ralentit
      this.applyForce(this.evade(fear).mult(3));
      if ((frameCount + floor(this.ph * 10)) % 14 === 0) bubbles.push({ x: this.pos.x, y: this.pos.y, s: random(2, 4), life: 40 });
    } else {
      this.maxSpeed = this.sp.speed; this.maxForce = this.sp.force; this.sta = min(300, this.sta + .6);
      let tg = null, td = 280;                    // chasse : le plus proche plus petit que moi (seulement si j'ai faim)
      if (!this.full) {
        for (const p of cx.prey) { if (this.r > p.r * 1.25) { const d = this.pos.dist(p.pos); if (d < td) { td = d; tg = p; } } }
        for (const m of cx.mates) { if (m !== this && !m.dead && this.r > m.r * 1.25) { const d = this.pos.dist(m.pos); if (d < td) { td = d; tg = m; } } }
      }
      if (tg) { this.mode = 'hunt'; this.maxSpeed = this.sp.speed * 1.25; this.applyForce(this.pursue(tg).mult(1.2)); }
      else {
        this.mode = 'cruise'; this.applyForce(this.wander().mult(.8));
        const grp = cx.byTier[this.sp.tier];
        this.applyForce(this.separate(grp, this.r * 2.5).mult(P.sepW));
        if (this.sp.tier === 0) { this.applyForce(this.align(grp, 90).mult(P.aliW)); this.applyForce(this.cohesion(grp, 140).mult(P.cohW * .8)); }
      }
    }
    this.applyForce(this.avoid(cx.obs).mult(P.avoidW));
    this.applyForce(this.bounds(0, 0, WW, WH));
  }
}

// Avant la mise à jour : les poissons décident ; les prédateurs libres chassent aussi les poissons
function lifeThink(ac, ap, team, hunters, obs) {
  const byTier = [[], [], []]; for (const c of ac) byTier[c.sp.tier].push(c);
  const hv = hunters.filter(h => vis(h, 1300)), cx = { mates: ac, byTier, prey: ap, hunters: hv, team, obs };
  ac.forEach(c => c.think(cx));
  for (const h of hv) {
    if (h.meal > 0) { h.meal--; continue; }
    if (h.target || h instanceof Moray || h.mode > 0 || h.dash) continue;   // déjà occupé (cible, charge, attaque…)
    let b = null, bd = 300;
    for (const c of ac) { if (h.r > c.r * 1.2) { const d = h.pos.dist(c.pos); if (d < bd) { bd = d; b = c; } } }
    if (b) h.applyForce(h.pursue(b).mult(.9));
  }
}

// Après la mise à jour : qui mange qui
function lifeEat(ac, ap, hunters, team) {
  const near = p => player && p.dist(player.pos) < 520, grow = (f, k) => { f.r = min(f.r + k, f.maxR || f.sp.r * 1.8); };
  // 1) poissons indépendants : mangent les proies ou plus petits qu'eux
  for (const c of ac) {
    if (c.dead || c.full) continue;
    let ate = false;
    for (let i = ap.length - 1; i >= 0 && !ate; i--) {
      const p = ap[i];
      if (!p.gone && c.r > p.r * 1.25 && c.pos.dist(p.pos) < c.r * .9 + p.r * .4) {
        p.gone = true; const k = preys.indexOf(p); if (k >= 0) preys.splice(k, 1); ate = true;
      }
    }
    for (let i = 0; i < ac.length && !ate; i++) {
      const o = ac[i];
      if (o !== c && !o.dead && c.r > o.r * 1.25 && c.pos.dist(o.pos) < c.r * .9 + o.r * .4) { o.dead = true; ate = true; }
    }
    if (ate) { grow(c, .4); c.bite = 14; c.full = 260 + random(140); bubblesAt(c.pos); if (near(c.pos)) snd.eat(panOf(c.pos.x)); }
  }
  // 2) prédateurs : un repas à la fois, puis digestion
  for (const h of hunters) {
    if (h.meal > 0 || !vis(h, 300)) continue;
    for (const c of ac) {
      if (!c.dead && h.r > c.r * 1.2 && h.pos.dist(c.pos) < h.r * .8 + c.r * .6) {
        c.dead = true; h.meal = 180; h.bite = 14; bubblesAt(c.pos); if (near(c.pos)) snd.eat(panOf(c.pos.x)); break;
      }
    }
  }
  // 3) joueur et son banc : mangent les poissons plus petits qu'eux
  for (const f of team) for (const c of ac) {
    if (!c.dead && f.r > c.r * 1.15 && f.pos.dist(c.pos) < f.r + c.r * .4) {
      c.dead = true; grow(f, .5); f.bite = 14; eaten++; addScore(15 + round(c.r), c.pos.x, c.pos.y); bubblesAt(f.pos); snd.eat(panOf(c.pos.x));
    }
  }
  if (critters.some(c => c.dead)) critters = critters.filter(c => !c.dead);
}

// Population maintenue à chaque image (comme les autres) ; réglage « Vie sauvage » (touche S)
function lifeSpawn(t) {
  const Y = [[.05, .55], [.15, .8], [.3, .9]][t]; let p;
  for (let i = 0; i < 12; i++) { p = createVector(random(WW), random(WH * Y[0], WH * Y[1])); if (!player || p.dist(player.pos) > 400) break; }
  return p;
}
function syncLife() {
  const a = A(), f = P.nbLife, want = [round(f * a * .6), round(f * a * .33), round(f * a * .14)], have = [0, 0, 0];
  for (const c of critters) have[c.sp.tier]++;
  for (let t = 0; t < 3; t++) {
    while (have[t] < want[t]) { const p = lifeSpawn(t); critters.push(new Critter(p.x, p.y, random(CRIT[t]))); have[t]++; }
    while (have[t] > want[t]) { for (let i = critters.length - 1; i >= 0; i--) if (critters[i].sp.tier === t) { critters.splice(i, 1); break; } have[t]--; }
  }
}
