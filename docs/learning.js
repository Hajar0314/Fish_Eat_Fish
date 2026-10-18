// =====================================================================
//  learning.js — chasse persistante + prédateurs qui apprennent
//
//  1) Chase  : un prédateur qui a verrouillé une proie ne la lâche plus dès qu'elle sort du cercle
//              de détection. Il a une PATIENCE (≈ 9 s) qui s'épuise plus vite quand la proie est
//              loin, il se fatigue (un peu plus lent en fin de chasse), il va à la dernière position
//              connue si la proie se cache, puis il abandonne et se repose.
//              Garde-fous « pas mourir trop vite » : nombre de poursuivants lointains plafonné,
//              pause obligatoire entre deux chasses, et après une morsure les prédateurs proches
//              se calment quelques secondes (voir Chase.onBite).
//
//  2) Habits : le jeu observe le joueur et les prédateurs en tirent trois leçons
//      - carte de courants : « quand il passe ici, il va (en général) par là » -> trajectoire prédite
//      - côté d'esquive favori : il vire toujours du même côté quand on le charge -> tir décalé
//      - zones favorites (carte de chaleur) : les prédateurs sans cible rôdent là où tu aimes aller
//    Rien n'est appris au début : la maturité monte de 0 à 100 % en ~1 minute de jeu.
// =====================================================================

const Chase = {
  PAT: 540,                     // patience de base (images) ≈ 9 s
  ext: new Set(),               // chasseurs qui poursuivent au-delà du cercle de détection
  reset() { this.ext.clear(); },
  cap() { return Math.min(4, 2 + Math.floor(level / 4)); },     // max de poursuivants « lointains » en même temps
  st(h) { return h.ch || (h.ch = { tgt: null, mem: null, lost: 0, pat: 0, rest: 0, calm: 0, back: 0 }); },
  prune() { for (const h of this.ext) if (h.dead || !h.ch || !h.ch.tgt) this.ext.delete(h); },
  drop(h, c, rest = 0) { c.tgt = null; c.lost = 0; c.rest = Math.max(c.rest, rest); this.ext.delete(h); return null; },

  // Remplace l'ancien « plus proche dans le cercle ». team = ce que le prédateur voit, range = rayon d'acquisition.
  pick(h, team, range, ok = null) {
    const c = this.st(h);
    c.rest = Math.max(0, c.rest - TS); c.calm = Math.max(0, c.calm - TS);
    if (h.blind > 0) return this.drop(h, c, 90);                 // aveuglé : il perd tout
    if (c.back > 0) {                                            // recul juste après une morsure
      c.back -= TS; h.applyForce(h.flee(player.pos).mult(1.4)); return this.drop(h, c, 0);
    }
    // ---- cible verrouillée ----
    if (c.tgt) {
      const t = c.tgt;
      if (team.indexOf(t) >= 0 && (!ok || ok(t))) {
        c.mem = c.mem || createVector(); c.mem.set(t.pos); c.lost = 0;
        const d = h.pos.dist(t.pos), out = d > range;
        c.pat -= TS * (out ? 2.2 : 1);                           // loin du cercle, l'intérêt retombe 2× plus vite
        if (out) {
          if (!this.ext.has(h)) {
            this.prune();
            if (this.ext.size >= this.cap()) return this.drop(h, c, 0);   // trop de poursuivants lointains : comportement d'avant
            this.ext.add(h);
          }
        } else this.ext.delete(h);
        if (d > range * P.leash || c.pat <= 0) return this.drop(h, c, 200 + 60 * Math.random());
        // une autre cible nettement plus proche ? on change
        let alt = null, ad = d * .6;
        for (const o of team) if (o !== t && (!ok || ok(o))) { const k = h.pos.dist(o.pos); if (k < Math.min(ad, range)) { ad = k; alt = o; } }
        if (alt) { c.tgt = alt; c.mem.set(alt.pos); return alt; }
        return t;
      }
      // proie hors de vue (kelp, anémone, leurre disparu…) : on file vers la dernière position connue
      c.lost += TS; c.pat -= TS * 2;
      if (c.lost > 100 || c.pat <= 0) return this.drop(h, c, 120);
      return c.ghost = c.ghost || { pos: c.mem, vel: createVector(), r: 1, ghost: true, deep: () => true };
    }
    c.ghost = null;
    // ---- acquisition ----
    if (c.calm > 0) return null;                                 // « miséricorde » après une morsure
    let best = null, bd = c.rest > 0 ? range * .5 : range;       // en repos : il ne réagit qu'à une proie très proche
    for (const t of team) { if (ok && !ok(t)) continue; const d = h.pos.dist(t.pos); if (d < bd) { bd = d; best = t; } }
    if (best) {
      c.tgt = best; c.mem = best.pos.copy(); c.lost = 0; c.pat = this.PAT * (1 + Math.min(level, 10) * .03);
      return best;
    }
    h.applyForce(Habits.patrolForce(h));                         // sans cible : il rôde vers tes zones favorites
    return null;
  },

  // Vitesse max effective : un chasseur qui s'épuise ralentit jusqu'à −18 %
  tire(h) {
    const c = h.ch; if (!c || !c.tgt) return 1;
    const f = c.pat / (this.PAT * .4);
    return f >= 1 ? 1 : .82 + .18 * Math.max(0, f);
  },

  // Le joueur vient de se faire mordre : les prédateurs proches se calment le temps de souffler
  onBite(killer) {
    for (const h of [...preds, ...squids, ...wild]) {
      const c = h.ch; if (!c || h.dead) continue;
      const near = h.pos.dist(player.pos) < 700;
      if (h === killer) { c.back = 40; c.calm = 160; this.drop(h, c, 330); }
      else if (near) { c.calm = 90; this.drop(h, c, 200); }
    }
  },
};

const Habits = {
  CELL: 110, cols: 0, rows: 0, heat: null, fx: null, fy: null, fw: null,
  n: 0, dodge: 0, dodgeN: 0, told: false, _pf: -1, _path: null,

  reset() {
    this.cols = Math.ceil(WW / this.CELL) + 1; this.rows = Math.ceil(WH / this.CELL) + 1;
    const N = this.cols * this.rows;
    this.heat = new Float32Array(N); this.fx = new Float32Array(N); this.fy = new Float32Array(N); this.fw = new Float32Array(N);
    this.n = 0; this.dodge = 0; this.dodgeN = 0; this.told = false; this._pf = -1; Chase.reset();
  },
  cx(x) { return Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.CELL))); },
  cy(y) { return Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.CELL))); },
  get maturity() { return Math.max(0, Math.min(1, (this.n - 600) / 3000)); },   // 0 pendant ~10 s, 100 % après ~1 min
  pct() { return Math.round(this.maturity * 100 * P.learn); },

  // Appelé une fois par image (voir step) : on regarde jouer le joueur
  update(p, hunters) {
    if (!this.heat) return;
    const i = this.cy(p.pos.y) * this.cols + this.cx(p.pos.x), sp = Math.hypot(p.vel.x, p.vel.y);
    this.heat[i] += 1; this.n++;
    if (sp > .6) { this.fx[i] += p.vel.x / sp; this.fy[i] += p.vel.y / sp; this.fw[i] += 1; }
    if (this.n % 60 === 0) {                                     // oubli lent (demi-vie ≈ 35 s)
      for (let k = 0; k < this.heat.length; k++) { this.heat[k] *= .98; this.fx[k] *= .98; this.fy[k] *= .98; this.fw[k] *= .98; }
    }
    // côté d'esquive favori : on regarde le poursuivant le plus proche
    let nh = null, nd = 320;
    for (const h of hunters) if (h.target === p) { const d = h.pos.dist(p.pos); if (d < nd) { nd = d; nh = h; } }
    if (nh && nd > 70 && sp > .8) {
      const dx = (p.pos.x - nh.pos.x) / nd, dy = (p.pos.y - nh.pos.y) / nd, lat = (p.vel.x * -dy + p.vel.y * dx) / sp;   // + = à gauche de la charge
      this.dodge += (lat - this.dodge) * .02; this.dodgeN++;
    }
    if (!this.told && this.maturity > .35 && P.learn > 0) {
      this.told = true; floatText(p.pos.x, p.pos.y - 70, '🧠 Les prédateurs étudient tes habitudes…', '#c9a7ff');
    }
  },

  // Direction habituelle autour d'un point : moyenne des vitesses déjà vues dans les 9 cases voisines
  flowAt(x, y) {
    const cx = this.cx(x), cy = this.cy(y); let sx = 0, sy = 0, w = 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const a = cx + k, b = cy + j; if (a < 0 || b < 0 || a >= this.cols || b >= this.rows) continue;
      const i = b * this.cols + a, m = (j || k) ? 1 : 2; sx += this.fx[i] * m; sy += this.fy[i] * m; w += this.fw[i] * m;
    }
    if (w < 1) return null;
    const mag = Math.hypot(sx, sy), coh = mag / w;                // cohérence : 1 = toujours la même direction
    return { ux: sx / (mag || 1), uy: sy / (mag || 1), c: coh * Math.min(1, w / 160) };
  },

  // Trajectoire prédite du joueur sur 90 images (un point toutes les 10), recalculée au plus une fois par image
  path(p) {
    if (this._pf === frameCount && this._path) return this._path;
    const L = P.learn * this.maturity, pts = [{ x: p.pos.x, y: p.pos.y, cc: 0 }];
    let x = p.pos.x, y = p.pos.y, sp = Math.max(1.5, Math.hypot(p.vel.x, p.vel.y)), vx = p.vel.x, vy = p.vel.y, vm = Math.hypot(vx, vy) || 1, sum = 0;
    vx /= vm; vy /= vm;
    for (let k = 1; k <= 9; k++) {
      const f = L > 0 ? this.flowAt(x, y) : null, c = f ? Math.min(.85, f.c * L) : 0;
      if (f) { vx = vx * (1 - c) + f.ux * c; vy = vy * (1 - c) + f.uy * c; const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m; }
      x = Math.max(0, Math.min(WW, x + vx * sp * 10)); y = Math.max(0, Math.min(WH, y + vy * sp * 10)); sum += c;
      pts.push({ x, y, cc: sum / k });
    }
    this._pf = frameCount; return this._path = pts;
  },

  // Point visé par un chasseur h pour intercepter p. lin = extrapolation linéaire de base.
  lead(h, p, lin) {
    const L = P.learn * this.maturity; if (L < .02) return lin;
    const d = h.pos.dist(p.pos); if (d < p.r + h.r + 40) return lin;           // au contact : poursuite directe
    const pts = this.path(p), t = Math.max(8, Math.min(85, d / Math.max(1.5, h.maxSpeed))) / 10, i = Math.min(8, Math.floor(t)), f = t - i;
    const q = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    const lx = p.pos.x + p.vel.x * t * 10, ly = p.pos.y + p.vel.y * t * 10;        // où il serait en ligne droite
    let ox = q.x - lx, oy = q.y - ly; const om = Math.hypot(ox, oy);              // ce que les habitudes changent
    if (om > 220) { ox *= 220 / om; oy *= 220 / om; }
    // côté d'esquive favori : décalage perpendiculaire à l'axe prédateur -> proie
    const dx = (p.pos.x - h.pos.x) / d, dy = (p.pos.y - h.pos.y) / d, sh = this.dodge * Math.min(1, this.dodgeN / 300) * Math.min(d * .5, 120) * L;
    return createVector(lin.x + ox + -dy * sh, lin.y + oy + dx * sh);
  },

  // Zones favorites : une case chaude à portée (tirage pondéré, gardé ~3 s pour ne pas hésiter)
  patrolForce(h) {
    const L = P.learn * this.maturity, none = createVector(); if (L < .05 || !this.heat) return none;
    const holder = h.pack || h.ch;                                // un banc / une meute rôde ensemble
    holder.patT = (holder.patT || 0) - TS;
    if (holder.patT <= 0 || !holder.patPt) {
      holder.patT = 180 + Math.random() * 120; holder.patPt = null;
      const R = 9, cx = this.cx(h.pos.x), cy = this.cy(h.pos.y), lim = h.ylim || [0, WH], cand = []; let tot = 0;
      for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) {
        const a = cx + k, b = cy + j; if (a < 0 || b < 0 || a >= this.cols || b >= this.rows) continue;
        const y = (b + .5) * this.CELL; if (y < lim[0] + 60 || y > lim[1] - 60) continue;
        const v = this.heat[b * this.cols + a]; if (v < 40) continue;
        const s = v / (1 + Math.hypot(j, k) * .35); cand.push([a, b, s]); tot += s;
      }
      if (cand.length) {
        let r = Math.random() * tot; for (const [a, b, s] of cand) { r -= s; if (r <= 0) { holder.patPt = createVector((a + Math.random()) * this.CELL, (b + Math.random()) * this.CELL); break; } }
      }
    }
    if (!holder.patPt) return none;
    return h.arrive(holder.patPt, 150).mult(.55 * L);
  },

  // Carte de chaleur + trajectoire prédite (touche D)
  debug() {
    if (!this.heat) return;
    push(); noStroke();
    const x0 = this.cx(cam.x), x1 = this.cx(cam.x + width), y0 = this.cy(cam.y), y1 = this.cy(cam.y + height);
    for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) {
      const v = this.heat[b * this.cols + a]; if (v < 8) continue;
      fill(190, 120, 255, Math.min(110, v * .6)); rect(a * this.CELL, b * this.CELL, this.CELL, this.CELL);
    }
    const pts = this.path(player); noFill(); stroke(190, 120, 255, 220); strokeWeight(2); beginShape(); for (const q of pts) vertex(q.x, q.y); endShape();
    pop();
  },
};
