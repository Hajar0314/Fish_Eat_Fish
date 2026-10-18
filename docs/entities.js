// =====================================================================
//  entities.js — poissons dessinés (dégradés, écailles brillantes, nageoires animées)
//               + rochers éclairés dynamiquement par les poissons lumineux
// =====================================================================

// ---------- Outils couleur (mis en cache) ----------
const _rgbC = {}, _shC = {};
function rgbOf(hex) {
  if (_rgbC[hex]) return _rgbC[hex];
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); return (_rgbC[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
// k < 0 : vers le noir, k > 0 : vers le blanc. Renvoie une chaîne rgba().
function shade(hex, k, a = 1) {
  const key = hex + '|' + k + '|' + a; if (_shC[key]) return _shC[key];
  const c = rgbOf(hex), t = k < 0 ? 0 : 255, q = Math.abs(k);
  return (_shC[key] = `rgba(${c.map(v => Math.round(v + (t - v) * q)).join(',')},${a})`);
}

// ---------- Style par espèce ----------
const FSTYLE = {
  def: { back: -.38, belly: .55, th: 1, tail: 1, dors: 1, pect: 1, amp: 1 },
  Sardine: { back: -.45, belly: .8, th: .8, tail: 1.05, dors: .8, pect: .9 },
  'Poisson-clown': { back: -.25, belly: .28, th: 1.15, tail: .9, dors: 1.1, pect: 1.1 },
  Thon: { back: -.55, belly: .75, th: 1, tail: 1.25, dors: .9, pect: 1.2, amp: .8 },
  Lanterne: { back: -.4, belly: .45, th: .95 },
  Requin: { back: -.4, belly: .9, th: .88, tail: 1.2, dors: 1.6, pect: 1.5, amp: .7, iris: '#0b0b0b', teeth: 1 },
  Baudroie: { back: -.6, belly: .05, th: 1.3, tail: .9, dors: .9, pect: .8, iris: '#ffd24a', teeth: 2 },
  Marteau: { back: -.45, belly: .85, th: .85, tail: 1.2, dors: 1.7, pect: 1.5, amp: .7, noEye: 1 },
  Barracuda: { back: -.5, belly: .8, th: .55, tail: .95, dors: .7, pect: .8, amp: 1.1, iris: '#e8d36a', teeth: 2 },
  Orque: { back: -.2, belly: .95, th: 1.15, tail: 1.1, dors: 2.1, pect: 1.6, amp: .7, noEye: 1 },
  'Poisson-ange': { back: -.3, belly: .4, th: 1.35, tail: .95, dors: 1.5, pect: 1.2, amp: .9 },
  Espadon: { back: -.5, belly: .8, th: .75, tail: 1.3, dors: 1.4, pect: 1.1, amp: .8 },
  Mérou: { back: -.4, belly: .35, th: 1.35, tail: .85, dors: .9, pect: 1.3, amp: .75, teeth: 1 },
  Vipère: { back: -.55, belly: .1, th: .8, tail: .9, dors: 1, pect: .7, amp: 1.1, iris: '#7dffb3', teeth: 2 },
};
const getStyle = sp => sp._st || (sp._st = Object.assign({}, FSTYLE.def, FSTYLE[sp.name]));

// ---------- Contour du corps (partagé canvas + SVG) ----------
const FN = 16, FM = 2 * FN + 1, _X = new Float32Array(FM), _Y = new Float32Array(FM);
const _HW = Array.from({ length: FN + 1 }, (_, i) => { const u = i / FN; return 0.12 * (1 - u) + 0.7 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.8); });
// Remplit _X/_Y : indices 0..FN = dos (queue -> nez), FN+1..2FN = ventre (nez -> queue). Ondulation = amp * sin(...)
function fishPts(r, th, sph, amp) {
  for (let i = 0; i <= FN; i++) {
    const u = i / FN, x = (-0.9 + 2.15 * u) * r, w = _HW[i] * r * th;
    const off = amp ? amp * Math.sin(sph - x / r * 2.2) * Math.pow(1 - u, 1.6) : 0;
    _X[i] = x; _Y[i] = off - w * 0.95;
    if (i < FN) { const k = 2 * FN - i; _X[k] = x; _Y[k] = off + w * 1.08; }
  }
}
function fishOutline(r, th, sph, amp) {
  fishPts(r, th, sph, amp);
  const p = new Path2D();
  p.moveTo((_X[FM - 1] + _X[0]) / 2, (_Y[FM - 1] + _Y[0]) / 2);
  for (let i = 0; i < FM; i++) { const j = (i + 1) % FM; p.quadraticCurveTo(_X[i], _Y[i], (_X[i] + _X[j]) / 2, (_Y[i] + _Y[j]) / 2); }
  p.closePath(); return p;
}
// Parcourt la grille d'écailles (décalées une ligne sur deux) en suivant l'ondulation du corps
function forScales(r, th, sph, amp, fn) {
  const s = Math.max(3.4, r * .3); let k = 0;
  for (let x = -r * .72, c = 0; x < r * 1.02; x += s * .8, c++) {
    const u = (x / r + .9) / 2.15, oy = amp * Math.sin(sph - x / r * 2.2) * Math.pow(Math.max(0, 1 - u), 1.6);
    for (let y = -r * .78 * th + (c % 2) * s * .5; y < r * .8 * th; y += s) fn(x, y + oy, s, k++);
  }
}

// ---------- Rochers : relief, éclairage par les sources de lumière (LIGHTS, voir sketch.js) ----------
const _lit = [];
class Obstacle {
  constructor(x, y, r) {
    this.pos = createVector(x, y); this.r = r; this.c = color(50 + random(40), 70 + random(40), 90 + random(30));
    this.jit = Array.from({ length: 11 }, () => random(.84, 1));
    this.pits = Array.from({ length: 8 }, () => ({ a: random(TWO_PI), d: random(.1, .72), s: random(.05, .14) }));
  }
  // Contour irrégulier (coordonnées locales + décalage ox/oy)
  makePath(ox, oy) {
    const n = this.jit.length, P = this.jit.map((j, i) => [ox + Math.cos(i / n * TWO_PI) * this.r * j, oy + Math.sin(i / n * TWO_PI) * this.r * j]), p = new Path2D();
    p.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    p.closePath(); return p;
  }
  // Rendu statique du rocher (relief + aspérités) mis en cache une fois pour toutes dans un sprite
  bake() {
    const r = this.r, S = Math.ceil(r * 2 + 6), cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d'), o = S / 2, cl = this.c.levels, base = `rgb(${cl[0]},${cl[1]},${cl[2]})`, path = this.makePath(o, o);
    const mixc = t => { const q = Math.abs(t), to = t < 0 ? 0 : 255; return `rgb(${cl.slice(0, 3).map(v => Math.round(v + (to - v) * q)).join(',')})`; };
    const g = ctx.createRadialGradient(o - r * .38, o - r * .45, r * .08, o, o, r * 1.1);
    g.addColorStop(0, mixc(.28)); g.addColorStop(.55, base); g.addColorStop(1, mixc(-.55));
    ctx.fillStyle = g; ctx.fill(path); ctx.clip(path);
    for (const p of this.pits) {
      const px = o + Math.cos(p.a) * r * p.d, py = o + Math.sin(p.a) * r * p.d, pr = r * p.s;
      ctx.fillStyle = 'rgba(0,0,0,.17)'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.arc(px - pr * .25, py - pr * .3, pr * .65, 0, TWO_PI); ctx.fill();
    }
    this._spr = cv; this._S = S; this._p = this.makePath(this.pos.x, this.pos.y);
  }
  show() {
    if (!this._spr) this.bake();
    const ctx = drawingContext, { x, y } = this.pos, r = this.r, S = this._S;
    ctx.drawImage(this._spr, x - S / 2, y - S / 2);
    // ---- éclairage dynamique : les 3 sources les plus fortes autour du rocher ----
    _lit.length = 0;
    for (const L of LIGHTS) {
      const dx = L.x - x, dy = L.y - y, d = Math.sqrt(dx * dx + dy * dy), f = 1 - (d - r * .3) / L.rad;
      if (f <= 0 || d < 1) continue;
      const e = f * f * L.k; if (e < .05) continue;
      _lit.push({ L, dx, dy, d, e });
    }
    if (!_lit.length) return;
    _lit.sort((a, b) => b.e - a.e);
    const n = Math.min(2, _lit.length);
    ctx.save(); ctx.clip(this._p); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const { L, dx, dy, d, e } = _lit[i], nx = dx / d, ny = dy / d, ex = x + nx * r * .55, ey = y + ny * r * .55, c = L.c, w = c.map(v => Math.round(v + (255 - v) * .5));
      const lg = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 1.45);
      lg.addColorStop(0, `rgba(${w[0]},${w[1]},${w[2]},${Math.min(.9, .8 * e)})`); lg.addColorStop(.38, `rgba(${c[0]},${c[1]},${c[2]},${Math.min(.7, .42 * e)})`); lg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = lg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    // liseré lumineux sur la face tournée vers la lumière
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2.4;
    for (let i = 0; i < n; i++) {
      const { L, dx, dy, e } = _lit[i], a = Math.atan2(dy, dx), c = L.c;
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(.85, .6 * e)})`; ctx.beginPath(); ctx.arc(x, y, r * .94, a - .8, a + .8); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- Poissons ----------
class Fish extends Vehicle {
  constructor(x, y, sp, k = 1) {
    super(x, y, sp.r * k); this.sp = sp; this.maxSpeed = sp.speed; this.maxForce = sp.force; this.ph = random(TWO_PI);
  }
  deep() { return this.pos.y > WH * 0.6; }
  styleNow() { return getStyle(this.sp); }   // le joueur change de silhouette en évoluant (voir abilities.js)
  toWorld(lx, ly) { const h = this.vel.heading(), c = Math.cos(h), s = Math.sin(h), y = this.vel.x < 0 ? -ly : ly; return [this.pos.x + lx * c - y * s, this.pos.y + lx * s + y * c]; }
  lureLocal() { const r = this.r; return [r * 1.55, -r * 1.2 + Math.sin(frameCount * .07 + this.ph) * r * .1]; }
  lurePos() { return this.toWorld(...this.lureLocal()); }

  show(glow = false, auraCol = null) {
    const ctx = drawingContext, r = this.r, sp = this.sp, st = this.styleNow(), col = sp.col, th = st.th, nm = sp.name;
    const spd = this.vel.mag(), T = frameCount, sk = Math.min(1, spd / 2.5);
    this.sph = (this.sph === undefined ? this.ph : this.sph) + 0.09 * (1 + spd * 0.9) * (this.noSlow ? 1 : TS);
    const sph = this.sph, amp = r * (0.06 + 0.08 * sk) * st.amp, lod0 = (sp.shiny || this.hero || r >= 10.5) ? 2 : r >= 5.5 ? 1 : 0, lod = (lod0 && Opt.crowd > Opt.CROWD && !sp.shiny && !this.hero && r < 9) ? 0 : lod0;   // foule : petites proies dessinées en version légère
    ctx.save(); ctx.translate(this.pos.x, this.pos.y);

    // halo lumineux (additif)
    if (glow || (sp.glow && this.deep())) {
      const ac = auraCol || col, R = r * 4.2, g = ctx.createRadialGradient(0, 0, r * .2, 0, 0, R);
      g.addColorStop(0, shade(ac, .2, .55)); g.addColorStop(.4, shade(ac, 0, .18)); g.addColorStop(1, shade(ac, 0, 0));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.globalCompositeOperation = 'source-over';
    }
    ctx.rotate(this.vel.heading()); if (this.vel.x < 0) ctx.scale(1, -1);

    if (lod === 0) {   // petites proies : dessin minimal (corps plein + queue qui bat + œil)
      const tw = Math.sin(sph - .9) * r * .55;
      ctx.fillStyle = shade(col, 0, .88); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * .72 * th, 0, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * .8, 0); ctx.lineTo(-r * 1.8, -r * .7 + tw); ctx.lineTo(-r * 1.8, r * .7 + tw); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(col, .6, .5); ctx.beginPath(); ctx.ellipse(r * .1, r * .28, r * .8, r * .28, 0, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * .65, -r * .15, r * .22, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(r * .72, -r * .15, r * .11, 0, TWO_PI); ctx.fill();
      ctx.restore(); return;
    }
    const body = fishOutline(r, th, sph, amp);
    const finG = (x0, y0, x1, y1, a0, a1, k1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, shade(col, -.1, a0)); g.addColorStop(1, shade(col, k1, a1)); return g; };

    // ---- queue (battement + déphasage des lobes) ----
    const K = st.tail, tx = _X[0] + r * .08, ty = (_Y[0] + _Y[2 * FN]) / 2, fl = Math.sin(sph - 1.9) * r * .22;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.sin(sph - 0.9) * (0.26 + 0.24 * sk));
    ctx.beginPath(); ctx.moveTo(r * .15, -r * .1 * th);
    ctx.bezierCurveTo(-r * .3 * K, -r * .2, -r * .75 * K, -r * .62 * K + fl * .5, -r * 1.05 * K, -r * .85 * K + fl);
    ctx.quadraticCurveTo(-r * .72 * K, -r * .3, -r * .62 * K, fl * .4);
    ctx.quadraticCurveTo(-r * .72 * K, r * .3, -r * 1.05 * K, r * .85 * K + fl);
    ctx.bezierCurveTo(-r * .75 * K, r * .62 * K + fl * .5, -r * .3 * K, r * .2, r * .15, r * .1 * th); ctx.closePath();
    ctx.fillStyle = lod >= 2 ? finG(0, 0, -r * 1.05 * K, 0, .95, .5, .45) : shade(col, 0, .85); ctx.fill();
    if (lod >= 2) {
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = .8; ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(0, 0); ctx.lineTo(-r * .92 * K, i * r * .27 * K + fl * Math.abs(i) / 2); }
      ctx.stroke();
    }
    ctx.restore();

    // ---- nageoire dorsale ondulante ----
    const kf = Math.round(FN * .66), kb = Math.round(FN * .34), Fx = _X[kf], Fy = _Y[kf] + r * .12, Bx = _X[kb], By = _Y[kb] + r * .12;
    const hD = r * .62 * st.dors, sway = Math.sin(sph * .7 + this.ph) * r * .16, Tx = Fx - r * .45 + sway, Ty = Fy - hD - r * .12;
    ctx.beginPath(); ctx.moveTo(Fx, Fy); ctx.quadraticCurveTo(Fx - r * .05 + sway * .3, Fy - hD * .9, Tx, Ty); ctx.quadraticCurveTo(Bx + r * .15 + sway * .4, By - hD * .35, Bx, By); ctx.closePath();
    ctx.fillStyle = lod >= 1 ? finG(0, By, 0, Ty, .95, .5, .3) : shade(col, 0, .85); ctx.fill();
    if (lod >= 2) {
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = .8; ctx.beginPath();
      for (const t of [.25, .5, .75]) { ctx.moveTo(Fx + (Bx - Fx) * t, Fy + (By - Fy) * t); ctx.lineTo(Tx + (Bx - Tx) * t, Ty + (By - hD * .15 - Ty) * t); }
      ctx.stroke();
    }
    // ---- nageoire anale ----
    if (lod >= 1) {
      const a1 = Math.round(FN * .45), a2 = Math.round(FN * .2), px = _X[a1], py = _Y[2 * FN - a1] - r * .1, qx = _X[a2], qy = _Y[2 * FN - a2] - r * .1, s2 = Math.sin(sph * .9 + 1.7) * r * .12;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - r * .05, py + r * .4, px - r * .3 - s2, py + r * .45); ctx.quadraticCurveTo(qx + r * .1, qy + r * .25, qx, qy); ctx.closePath();
      ctx.fillStyle = shade(col, 0, .8); ctx.fill();
    }

    // ---- corps : dégradé dos sombre -> ventre clair ----
    const bg = ctx.createLinearGradient(0, -r * .8 * th, 0, r * .85 * th);
    bg.addColorStop(0, shade(col, st.back)); bg.addColorStop(.4, shade(col, st.back * .3)); bg.addColorStop(.62, shade(col, 0)); bg.addColorStop(1, shade(col, st.belly));
    ctx.fillStyle = bg; ctx.fill(body);
    ctx.save(); if (lod >= 2 || sp.stripe) ctx.clip(body);
    if (lod >= 2) {   // reflet sur le dos
      const hg = ctx.createRadialGradient(r * .35, -r * .38 * th, 0, r * .35, -r * .38 * th, r * .95);
      hg.addColorStop(0, 'rgba(255,255,255,.4)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(-r * 1.2, -r * 1.3, r * 2.8, r * 2.6);
    }
    if (sp.stripe) {   // bandes du poisson-clown, liserées de noir
      for (const [cx, w] of [[.4, .26], [-.3, .3]]) {
        ctx.fillStyle = 'rgba(255,255,255,.93)'; ctx.fillRect(r * (cx - w / 2), -r, r * w, r * 2);
        ctx.strokeStyle = 'rgba(30,12,0,.6)'; ctx.lineWidth = Math.max(.7, r * .04); ctx.beginPath();
        ctx.moveTo(r * (cx - w / 2), -r); ctx.lineTo(r * (cx - w / 2), r); ctx.moveTo(r * (cx + w / 2), -r); ctx.lineTo(r * (cx + w / 2), r); ctx.stroke();
      }
    }
    if (lod >= 2) {   // écailles + scintillements
      const sc = new Path2D();
      forScales(r, th, sph, amp, (x, y, s) => { const rd = s * .62; sc.moveTo(x, y + rd); sc.arc(x, y, rd, Math.PI / 2, Math.PI * 1.5); });
      ctx.save(); ctx.translate(.5, .7); ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = .8; ctx.stroke(sc); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.26)'; ctx.lineWidth = .8; ctx.stroke(sc);
      forScales(r, th, sph, amp, (x, y, s, k) => {
        if (k % 3) return; const g = Math.pow(Math.max(0, Math.sin(T * .06 + k * 2.1 + this.ph)), 14); if (g < .08) return;
        ctx.fillStyle = `rgba(255,255,255,${g * .95})`; ctx.beginPath(); ctx.arc(x, y, s * .26 * (.6 + g), 0, TWO_PI); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${g * .8})`; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(x - s * .55 * g, y); ctx.lineTo(x + s * .55 * g, y); ctx.moveTo(x, y - s * .55 * g); ctx.lineTo(x, y + s * .55 * g); ctx.stroke();
      });
      const p = (T * .012 + this.ph * .4) % 2.6;   // bande de lumière qui balaie le corps
      if (p < 1.2) {
        const cx = -r * 1.1 + p / 1.2 * r * 2.6, sg = ctx.createLinearGradient(cx - r * .35, -r * .4, cx + r * .35, r * .4);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, `rgba(255,255,255,${.36 * Math.sin(p / 1.2 * Math.PI)})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.6, r * 2.4);
      }
    }
    ctx.restore();
    ctx.lineWidth = Math.max(.7, r * .045); ctx.strokeStyle = shade(col, -.6, .55); ctx.stroke(body);

    // ---- détails : branchies, bouche, dents ----
    if (lod >= 1) {
      ctx.strokeStyle = shade(col, -.6, .38); ctx.lineWidth = Math.max(.7, r * .05); ctx.beginPath();
      if (nm === 'Requin' || nm === 'Marteau') for (let i = 0; i < 3; i++) { ctx.moveTo(r * (.32 - i * .1), -r * .3); ctx.lineTo(r * (.3 - i * .1), r * .25); }
      else ctx.arc(r * .72, 0, r * .46, Math.PI * .62, Math.PI * 1.38);
      ctx.stroke();
    }
    ctx.strokeStyle = shade(col, -.7, .75); ctx.lineWidth = Math.max(.7, r * .05); ctx.beginPath(); ctx.moveTo(r * 1.17, r * .08); ctx.quadraticCurveTo(r * 1.05, r * .2, r * .93, r * .16); ctx.stroke();
    if (st.teeth) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); const n = st.teeth * 4, sz = r * (.09 + st.teeth * .03);
      for (let i = 0; i < n; i++) { const x = r * (1.1 - i * (.2 / st.teeth) * .5); ctx.moveTo(x, r * .16 + (1 - x / r) * .03 * r); ctx.lineTo(x - sz * .4, r * .16 + sz * (st.teeth > 1 ? 1.6 : 1.1)); ctx.lineTo(x - sz * .8, r * .17); }
      ctx.fill();
    }
    // ---- bouche qui s'ouvre quand le poisson mord (bite : 14 -> 0) ; mâchoire plus large + dents pour les requins ----
    if (this.bite > 0) {
      const o = this.bite > 7 ? (14 - this.bite) / 7 : this.bite / 7, a = o * (st.teeth ? .95 : .7);
      const hx = r * .93, hy = r * .16, ux = r * 1.23, uy = r * .09, vx = ux - hx, vy = uy - hy, ca = Math.cos(a), sa = Math.sin(a), L = Math.hypot(vx, vy);
      const lx = hx + vx * ca - vy * sa, ly = hy + vx * sa + vy * ca, dn = r * .2;
      ctx.fillStyle = '#4a0a14'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ux, uy); ctx.lineTo(lx, ly); ctx.closePath(); ctx.fill();   // intérieur de la bouche
      ctx.fillStyle = shade(col, .3); ctx.strokeStyle = shade(col, -.6, .6); ctx.lineWidth = Math.max(.7, r * .045);                       // mâchoire inférieure qui s'abaisse
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx, ly); ctx.lineTo(lx - dn * sa, ly + dn * ca); ctx.lineTo(hx - dn * sa, hy + dn * ca); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (st.teeth) {
        const sz = r * .12; ctx.fillStyle = '#fff'; ctx.beginPath();
        for (let i = 1; i <= 4; i++) {
          const t = i / 5, px = hx + vx * t, py = hy + vy * t, qx = hx + (lx - hx) * t, qy = hy + (ly - hy) * t;
          ctx.moveTo(px, py); ctx.lineTo(px + vx / L * sz * .8, py + vy / L * sz * .8); ctx.lineTo(px, py + sz * 1.5);
          ctx.moveTo(qx, qy); ctx.lineTo(qx + (lx - hx) / L * sz * .8, qy + (ly - hy) / L * sz * .8); ctx.lineTo(qx + sa * sz * 1.5, qy - ca * sz * 1.5);
        }
        ctx.fill();
      }
    }
    if (nm === 'Lanterne') {   // photophores le long du ventre
      for (let k = 3; k < FN - 3; k += 2) {
        const a = .5 + .5 * Math.sin(T * .08 + k * .9), x = _X[k], y = _Y[2 * FN - k] - r * .17;
        ctx.fillStyle = `rgba(230,255,200,${.35 + .6 * a})`; ctx.beginPath(); ctx.arc(x, y, r * .055, 0, TWO_PI); ctx.fill();
      }
    }

    // ---- nageoire pectorale qui bat ----
    if (lod >= 1) {
      const PK = st.pect;
      ctx.save(); ctx.translate(r * .5, r * .2 * th); ctx.rotate(.55 + Math.sin(sph * .8 + this.ph) * .45); ctx.scale(PK, PK);
      ctx.beginPath(); ctx.moveTo(r * .05, -r * .08); ctx.bezierCurveTo(-r * .3, -r * .3, -r * .75, -r * .15, -r * .9, r * .15); ctx.bezierCurveTo(-r * .55, r * .12, -r * .2, r * .15, r * .05, r * .1); ctx.closePath();
      ctx.fillStyle = lod >= 2 ? finG(0, 0, -r * .9, 0, .92, .45, .45) : shade(col, 0, .8); ctx.fill();
      ctx.strokeStyle = shade(col, -.5, .4); ctx.lineWidth = .7; ctx.stroke(); ctx.restore();
    }

    // ---- lanterne de la baudroie ----
    if (nm === 'Baudroie') {
      const [lx, ly] = this.lureLocal();
      ctx.strokeStyle = shade(col, -.3); ctx.lineWidth = Math.max(1, r * .07); ctx.beginPath(); ctx.moveTo(r * .45, -r * .62 * th); ctx.quadraticCurveTo(r * .9, -r * 1.75, lx, ly); ctx.stroke();
      const bg2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * .75);
      bg2.addColorStop(0, 'rgba(255,255,220,.95)'); bg2.addColorStop(.25, 'rgba(255,240,120,.7)'); bg2.addColorStop(1, 'rgba(255,220,60,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = bg2; ctx.fillRect(lx - r, ly - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fffbd0'; ctx.beginPath(); ctx.arc(lx, ly, r * .13, 0, TWO_PI); ctx.fill();
    }

    // ---- œil ----
    const ex = r * .68, ey = -r * .16 * th;
    if (st.noEye) { /* œil dessiné par la sous-classe (Marteau, Orque) */ } else if (lod >= 1) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * .22, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = st.iris || shade(col, -.6); ctx.beginPath(); ctx.arc(ex + r * .035, ey, r * .15, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + r * .05, ey, r * .09, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(ex + r * .1, ey - r * .07, r * .045, 0, TWO_PI); ctx.fill();
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * .22, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + r * .07, ey, r * .11, 0, TWO_PI); ctx.fill();
    }
    ctx.restore();
  }
  debug() {
    if (!P.debug || !this.a1) return;
    stroke(255, 255, 0); line(this.pos.x, this.pos.y, this.a1.x, this.a1.y); noFill(); circle(this.a1.x, this.a1.y, 6); circle(this.a2.x, this.a2.y, 6);
  }
}

class Player extends Fish {
  get hero() { return true; }
  get noSlow() { return true; }   // insensible au bonus « ralenti »
  styleNow() { return stageStyle(this.sp, this.stage | 0); }
  show(g) {
    const ctx = drawingContext, k = Abil.morph(), hid = Abil.hidden(this), giant = this.stage === 2;
    ctx.save();
    if (hid) ctx.globalAlpha = .5;   // caché dans l'anémone : à moitié transparent
    if (k !== 1) { ctx.translate(this.pos.x, this.pos.y); ctx.scale(k, k); ctx.translate(-this.pos.x, -this.pos.y); }   // « pop » d'évolution
    super.show(g || giant, g ? '#ff5a3a' : giant ? '#ffd27a' : null);   // le géant rayonne d'une aura dorée
    ctx.restore();
  }
  think(mouse, obs) {
    const b = typeof boost === 'number' ? boost : 1;
    this.maxSpeed = this.sp.speed * P.speed * Eco.speedMul() * b; this.maxForce = this.sp.force * (b > 1 ? 2.2 : 1);
    this.applyForce(this.arrive(mouse, 120));
    this.applyForce(this.avoid(obs).mult(P.avoidW));
    this.applyForce(this.bounds(0, 0, WW, WH));
  }
}

class Follower extends Fish {
  get noSlow() { return true; }
  styleNow() { return player ? stageStyle(this.sp, player.stage | 0) : getStyle(this.sp); }   // le banc prend la même forme que le joueur
  show(g) { if (this.life !== undefined && this.life < 180 && frameCount % 10 < 5) return; super.show(g); }   // clone qui clignote avant de disparaître
  think(leader, group, obs) {
    this.maxSpeed = leader.maxSpeed * 1.1;
    this.applyForce(this.followLeader(leader, group));
    this.applyForce(this.avoid(obs).mult(P.avoidW));
    this.applyForce(this.bounds(0, 0, WW, WH));
  }
}

class Prey extends Fish {
  // Flocking (séparation 28 px, alignement 60 px, cohésion 80 px) via la grille : on ne regarde que les 9 cases voisines
  flockGrid(g) {
    const px = this.pos.x, py = this.pos.y, cs = g.cs, cx = Math.floor(px / cs), cy = Math.floor(py / cs);
    let sx = 0, sy = 0, ax = 0, ay = 0, na = 0, qx = 0, qy = 0, nc = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cell = g.m.get(g.key(cx + i, cy + j)); if (!cell) continue;
      for (let n = 0; n < cell.length; n++) {
        const o = cell[n]; if (o === this) continue;
        const dx = px - o.pos.x, dy = py - o.pos.y, d2 = dx * dx + dy * dy;
        if (d2 >= 6400) continue;                                     // > 80 px
        qx += o.pos.x; qy += o.pos.y; nc++;
        if (d2 < 3600) { ax += o.vel.x; ay += o.vel.y; na++; }       // < 60 px
        if (d2 < 784 && d2 > 0) { sx += dx / d2; sy += dy / d2; }     // < 28 px
      }
    }
    // même résultat que separate()*sepW + align()*aliW + cohesion()*cohW, sans objets temporaires
    if (sx || sy) this.steerXY(sx, sy, P.sepW);
    if (na) this.steerXY(ax, ay, P.aliW);
    if (nc) this.steerXY(qx / nc - px, qy / nc - py, P.cohW);
  }
  think(flock, team, obs, hunters = [], grid = null) {
    this.lookAhead = P.look * 0.6;
    const px = this.pos.x, py = this.pos.y, R = P.detect * 0.6, R2 = R * R;
    for (const h of hunters) { const dx = h.pos.x - px, dy = h.pos.y - py; if (dx < R && dx > -R && dy < R && dy > -R && dx * dx + dy * dy < R2) this.applyForce(this.evade(h).mult(2.5)); }
    if (grid) {
      // hors écran (marge > Opt.FAR) : le flocking n'est recalculé qu'une image sur 3, la dernière force est réutilisée
      const far = px < cam.x - Opt.FAR || px > cam.x + width + Opt.FAR || py < cam.y - Opt.FAR || py > cam.y + height + Opt.FAR;
      if (far && (frameCount + (this.ph * 10 | 0)) % 3) { if (this.fk) { this.acc.x += this.fk.x; this.acc.y += this.fk.y; } }
      else { const ax = this.acc.x, ay = this.acc.y; this.flockGrid(grid); this.fk = this.fk || createVector(); this.fk.set(this.acc.x - ax, this.acc.y - ay); }
    } else {
      const fo = this.separate(flock, 28).mult(P.sepW).add(this.align(flock).mult(P.aliW)).add(this.cohesion(flock).mult(P.cohW));
      this.applyForce(fo);
    }
    this.applyForce(this.wander().mult(0.4));
    for (const v of (Opt.vents || vents)) { const dx = v.pos.x - px, dy = v.pos.y - py; if (dx < 260 && dx > -260 && dy < 260 && dy > -260 && dx * dx + dy * dy < 67600) this.applyForce(this.arrive(createVector(v.pos.x, v.pos.y - 70), 80).mult(0.6)); }
    for (const t of team) if (t.r > this.r * 1.15 && this.pos.dist(t.pos) < P.detect * 0.6) this.applyForce(this.evade(t).mult(3));
    this.applyForce(this.avoid(obs).mult(P.avoidW));
    this.applyForce(this.bounds(0, 0, WW, WH));
  }
}

class Predator extends Fish {
  constructor(x, y, kind) { super(x, y, kind); this.kind = kind; this.target = null; }
  think(team, preds, obs) {
    this.lookAhead = P.look * 1.4;
    this.ylim = [this.sp.deepOnly ? WH * 0.6 : 0, WH];
    const best = Chase.pick(this, team, P.detect * (this.sp.sight || 1), this.sp.deepOnly ? t => t.deep() : null), bd = best ? this.pos.dist(best.pos) : P.detect;   // chasse persistante (voir learning.js)
    this.target = best;
    if (best && this.sp.name === 'Requin') {   // la mâchoire du requin claque quand la proie est proche
      this.snapT = (this.snapT || 0) - 1;
      if (bd < this.r * 6 && this.snapT <= 0) { this.bite = 14; this.snapT = 24 + random(16); if (this.pos.dist(player.pos) < 800) snd.snap(panOf(this.pos.x)); }
    }
    this.applyForce(best ? this.pursue(best).mult(1.2) : this.wander());
    this.applyForce(this.separate(preds, this.r * 4).mult(P.sepW * 1.5));
    this.applyForce(this.avoid(obs).mult(P.avoidW * 1.3));
    this.applyForce(this.bounds(0, this.sp.deepOnly ? WH * 0.6 : 0, WW, WH, 70));
  }
  // Point visé : extrapolation linéaire + ce que les prédateurs ont appris des habitudes du joueur
  aim(o, k = 10) {
    const lin = p5.Vector.add(o.pos, o.vel.copy().mult(k));
    return o === player ? Habits.lead(this, o, lin) : lin;
  }
  pursue(o) { return this.seek(this.aim(o, 10)); }
  update() {   // un chasseur qui s'épuise ralentit (Chase.tire) ; maxSpeed est restauré car chaque think() le recalcule
    const ms = this.maxSpeed; this.maxSpeed = ms * Chase.tire(this); super.update(); this.maxSpeed = ms;
  }
  show() {
    super.show(this.sp.deepOnly);
    if (P.debug) { noFill(); stroke(255, 60, 60, 120); circle(this.pos.x, this.pos.y, P.detect * 2); }
    this.debug();
  }
}

// Méduse : obstacle mobile (Vehicle) qui dérive, pulse et pique. Les autres poissons l'évitent.
class Jellyfish extends Vehicle {
  constructor(x, y) { super(x, y, random(14, 24)); this.maxForce = 0.03; this.ph = random(TWO_PI); }
  think(rocks) {
    this.maxSpeed = 0.3 + 0.7 * max(0, sin(frameCount * 0.05 + this.ph));
    this.applyForce(this.wander()); this.applyForce(this.avoid(rocks).mult(2));
    this.applyForce(this.bounds(0, WH * 0.5, WW, WH, 60));
  }
  show() {
    const r = this.r; push(); translate(this.pos.x, this.pos.y);
    drawingContext.shadowBlur = 22; drawingContext.shadowColor = '#d38bff';
    noStroke(); fill(211, 139, 255, 150); arc(0, 0, r * 2, r * 1.8 * (1 + 0.12 * sin(frameCount * 0.1 + this.ph)), PI, TWO_PI);
    drawingContext.shadowBlur = 0; noFill(); stroke(230, 180, 255, 140);
    for (let i = -2; i <= 2; i++) { beginShape(); for (let k = 0; k < 6; k++) vertex(i * r * 0.35 + sin(frameCount * 0.08 + k + i) * 3, k * r * 0.35); endShape(); }
    pop();
  }
}

// Calmar des profondeurs : embuscade, puis jaillissement (dash) vers sa cible, puis recharge.
class Squid extends Predator {
  think(team, preds, obs) {
    this.cool = max(0, (this.cool || 0) - 1); this.dash = max(0, (this.dash || 0) - 1);
    super.think(team, preds, obs);
    if (this.target && !this.cool && this.pos.dist(this.target.pos) < P.detect * 0.7) { this.dash = 40; this.cool = 200; }
    this.maxSpeed = this.dash ? this.sp.speed * 2.6 : this.sp.speed; this.maxForce = this.dash ? 0.25 : this.sp.force;
  }
  show() {
    const r = this.r; push(); translate(this.pos.x, this.pos.y); rotate(this.vel.heading());
    drawingContext.shadowBlur = this.dash ? 30 : 12; drawingContext.shadowColor = '#ff3b3b';
    stroke(190, 50, 60); strokeWeight(3); noFill();
    for (let i = -2; i <= 2; i++) line(-r * .6, i * r * .22, -r * 1.9, i * r * .32 + sin(frameCount * .2 + i) * r * .3);
    noStroke(); fill(this.dash ? '#ff5a4d' : '#c0392b'); ellipse(0, 0, r * 2.4, r * 1.1); triangle(r * .9, 0, r * 1.7, -r * .5, r * 1.7, r * .5);
    fill(255, 240, 150); circle(-r * .1, -r * .2, r * .3); circle(-r * .1, r * .2, r * .3);
    pop(); drawingContext.shadowBlur = 0;
    if (P.debug) { noFill(); stroke(255, 60, 60, 120); circle(this.pos.x, this.pos.y, P.detect * 1.4); }
  }
}

// Source hydrothermale + vers tubicoles : attire les proies (donc un coin de chasse risqué).
class Vent {
  constructor(x, y) { this.pos = createVector(x, y); this.pts = []; this.worms = Array.from({ length: 6 }, () => ({ dx: random(-40, 40), h: random(18, 40), ph: random(TWO_PI) })); }
  show() {
    const { x, y } = this.pos; noStroke(); fill(60, 40, 40); triangle(x - 35, y + 12, x + 35, y + 12, x, y - 16);
    for (const w of this.worms) {
      const sw = sin(frameCount * .04 + w.ph) * 4; stroke(240); strokeWeight(3); line(x + w.dx, y + 12, x + w.dx + sw, y + 12 - w.h);
      noStroke(); fill(220, 40, 60); circle(x + w.dx + sw, y + 12 - w.h, 6);
    }
    if (frameCount % 3 === 0) this.pts.push({ x: x + random(-6, 6), y: y - 14, l: 90 });
    for (let i = this.pts.length - 1; i >= 0; i--) {
      const p = this.pts[i]; p.y -= 1; p.x += sin(p.y * .05) * .4; p.l--;
      fill(255, 150, 60, p.l * 1.8); circle(p.x, p.y, 5); if (p.l <= 0) this.pts.splice(i, 1);
    }
  }
}
