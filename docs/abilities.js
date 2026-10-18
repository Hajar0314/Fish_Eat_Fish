// =====================================================================
//  abilities.js — ÉVOLUTION du poisson + CAPACITÉS SPÉCIALES par espèce
//
//  En grossissant, le joueur évolue : Alevin -> Adulte -> Géant.
//    • la silhouette change à chaque stade (proportions, nageoires, aura du géant)
//    • Adulte : débloque la capacité de son espèce      (touche E / Maj / clic droit / bouton rond)
//    • Géant  : la capacité devient plus puissante et se recharge plus vite
//
//  🐟 Sardine       : banc de leurres (les prédateurs les poursuivent à ta place)
//  🌺 Poisson-clown : se cacher dans une anémone (invisible, immunisé, et les prédateurs sont piqués)
//  💥 Thon          : coup de queue (onde de choc : repousse et étourdit les prédateurs)
//  💡 Lanterne      : flash qui aveugle les prédateurs (ils perdent ta trace)
// =====================================================================

const STAGE_NAMES = ['Alevin', 'Adulte', 'Géant'];
const STAGE_AT = [0, .25, .65];   // fraction de la croissance totale (0 = taille de départ, 1 = taille max) à partir de laquelle on change de stade

const ABIL = {
  decoy: { icon: '🐟', name: 'Banc de leurres', cd: [0, 780, 600], desc: 'Lâche des sardines-leurres : les prédateurs qui les voient te lâchent pour les poursuivre.', up: '7 leurres, plus durables' },
  hide: { icon: '🌺', name: 'Anémone refuge', cd: [0, 900, 660], desc: "Déploie une anémone : caché dedans, tu es invisible et immunisé. Les prédateurs qui s'en approchent sont piqués.", up: 'refuge plus grand et plus long' },
  slap: { icon: '💥', name: 'Coup de queue', cd: [0, 600, 420], desc: 'Onde de choc : les prédateurs proches sont repoussés et étourdis.', up: 'onde plus large, étourdissement plus long' },
  flash: { icon: '💡', name: 'Flash aveuglant', cd: [0, 840, 600], desc: 'Éclair de lumière : les prédateurs alentour perdent ta trace.', up: 'flash plus large, cécité plus longue' },
};

const NONE = [];
const growthOf = f => constrain((f.r - f.sp.r) / (f.sp.r * .8), 0, 1);
const stageOf = f => { const g = growthOf(f); return g >= STAGE_AT[2] ? 2 : g >= STAGE_AT[1] ? 1 : 0; };

// Silhouette par stade (dérivée du style de l'espèce, mise en cache). 0 = alevin rond et petites nageoires, 1 = style normal, 2 = géant massif aux grandes nageoires
function stageStyle(sp, s) {
  const key = '_ss' + s; if (sp[key]) return sp[key];
  const b = getStyle(sp), o = Object.assign({}, b);
  if (s === 0) { o.th = b.th * 1.14; o.tail = b.tail * .78; o.dors = b.dors * .65; o.pect = b.pect * .9; o.amp = b.amp * 1.25; }
  else if (s === 2) { o.th = b.th * .97; o.tail = b.tail * 1.22; o.dors = b.dors * 1.4; o.pect = b.pect * 1.3; o.amp = b.amp * .8; o.back = b.back * 1.2; }
  return (sp[key] = o);
}

// Étourdit un prédateur (il ne nage plus, ne mord plus) ; interrompt charge, dash, attaque de murène
function stunHunter(h, f) {
  h.stun = Math.max(h.stun || 0, f);
  if (h instanceof Moray) { h.mode = 4; h.cool = Math.max(h.cool || 0, f); }
  else if (h.mode === 1 || h.mode === 2) { h.mode = 0; h.cool = Math.max(h.cool || 0, 200); }
  if (h.dash) { h.dash = 0; h.cool = Math.max(h.cool || 0, 200); }
}
// Aveugle un prédateur (il ne voit plus personne et erre au hasard)
function blindHunter(h, f) {
  h.blind = Math.max(h.blind || 0, f); h.target = null;
  if (h instanceof Moray) { if (h.mode < 2) { h.mode = 0; h.cool = Math.max(h.cool || 0, f); } }
  else if (h.mode === 1) { h.mode = 0; h.cool = Math.max(h.cool || 0, f); }
  if (h.dash) { h.dash = 0; h.cool = Math.max(h.cool || 0, 200); }
}

// Sardine-leurre : un hologramme de ton poisson. Les prédateurs le prennent pour cible, le croquent et perdent du temps.
class Decoy extends Fish {
  constructor(x, y, sp, r, life) {
    super(x, y, sp, 1); this.r = r; this.life = life; this.noSlow = true;
    this.maxSpeed = sp.speed * .85; this.maxForce = sp.force;
  }
  think(obs) {
    this.applyForce(this.wander().mult(.8));
    this.applyForce(this.separate(Abil.decoys, this.r * 4).mult(1.5));
    this.applyForce(this.avoid(obs).mult(P.avoidW));
    this.applyForce(this.bounds(0, 0, WW, WH));
  }
  show() {
    const ctx = drawingContext;
    ctx.globalAlpha = Math.min(1, this.life / 60) * (.62 + .18 * Math.sin(frameCount * .2 + this.ph));   // translucide, scintillant, s'efface à la fin
    super.show(true, '#9fd8ff');
    ctx.globalAlpha = 1;
  }
}

const Abil = {
  cd: 0, cdMax: 1, decoys: [], anem: null, rings: [], sparks: [], flash: 0, evo: null, morphT: 0, lockT: 0, uiHold: false, rmb: false,

  reset() {
    this.cd = 0; this.cdMax = 1; this.decoys = []; this.anem = null; this.rings = []; this.sparks = []; this.flash = 0; this.evo = null; this.morphT = 0; this.lockT = 0; this.uiHold = false;
    if (player) player.stage = 0;
  },
  def() { return ABIL[player.sp.abil]; },
  lv() { return (player && player.stage) | 0; },
  // Un poisson de l'équipe est caché s'il se trouve dans l'anémone active
  hidden(f) { const a = this.anem; return !!a && a.t > 0 && Math.hypot(f.pos.x - a.x, f.pos.y - a.y) < a.R * .8; },
  // Cibles visibles pour les prédateurs : l'équipe (hors kelp / anémone) + les leurres
  targets(all) { const out = all.filter(f => !World.inKelp(f) && !this.hidden(f)); for (const d of this.decoys) out.push(d); return out; },
  // Ce que voit CE prédateur : rien s'il est aveuglé ; les leurres sont prioritaires (s'il en voit un, il ignore l'équipe)
  sightFor(p, seen) {
    if (p.blind > 0) return NONE;
    if (this.decoys.length) for (const d of this.decoys) if (Math.hypot(p.pos.x - d.pos.x, p.pos.y - d.pos.y) < P.detect) return this.decoys;
    return seen;
  },
  // Facteur d'échelle de l'animation d'évolution (le poisson « gonfle » puis se stabilise)
  morph() { return this.morphT > 0 ? 1 + .45 * Math.sin(Math.PI * (1 - this.morphT / 36)) : 1; },
  btn() { return { x: 50, y: height - 54, R: 30 }; },

  // ---------------- Évolution ----------------
  checkStage() {
    const s = stageOf(player);
    if (s > this.lv()) this.evolve(s);
  },
  evolve(s) {
    player.stage = s; this.morphT = 36; this.evo = { t: 230, s }; this.cd = 0; this.cdMax = 1;
    for (let i = 0; i < 44; i++) { const a = random(TWO_PI), v = random(1.5, 6); this.sparks.push({ x: player.pos.x, y: player.pos.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: random(35, 70), c: random() < .5 ? '255,224,120' : '160,240,255' }); }
    this.rings.push({ x: player.pos.x, y: player.pos.y, R: 240, t: 0, dur: 40, c: '255,224,120', kind: 'evo' });
    shake = Math.max(shake, 7); bubblesAt(player.pos); snd.evolve();
    floatText(player.pos.x, player.pos.y - 46, '✨ ' + STAGE_NAMES[s] + ' !', '#ffd166');
  },

  // ---------------- Capacité ----------------
  use() {
    if (state !== 'play' || paused || !player) return;
    const L = this.lv(), a = this.def();
    if (L < 1) { if (this.lockT <= 0) { floatText(player.pos.x, player.pos.y - 44, '🔒 Grossis pour évoluer !', '#9fd8ff'); this.lockT = 90; } return; }
    if (player.sp.abil === 'hide' && this.anem && this.anem.t > 0) { this.anem.t = 0; return; }   // 2e appui : on sort de l'anémone
    if (this.cd > 0) return;
    this.cdMax = this.cd = Math.round(a.cd[L] * Eco.cdMul());
    const hs = preds.concat(squids, wild), px = player.pos.x, py = player.pos.y;
    switch (player.sp.abil) {
      case 'decoy': {
        const n = L === 2 ? 7 : 4, life = L === 2 ? 780 : 540;
        for (let i = 0; i < n; i++) {
          const an = TWO_PI * i / n + random(-.3, .3), d = new Decoy(px + Math.cos(an) * 18, py + Math.sin(an) * 18, player.sp, player.r * .85, life + random(-40, 40));
          d.vel.set(Math.cos(an) * player.sp.speed, Math.sin(an) * player.sp.speed); this.decoys.push(d);
        }
        bubblesAt(player.pos); snd.decoy(); floatText(px, py - 40, '🐟 Leurres !', '#a9d6ff');
        break;
      }
      case 'hide': {
        this.anem = { x: px, y: py, R: 52 + player.r * 3 + (L === 2 ? 22 : 0), t: L === 2 ? 540 : 330, age: 0, ph: random(TWO_PI), L, col: random([[255, 110, 170], [255, 150, 90], [200, 110, 240]]) };
        player.vel.mult(.2); bubblesAt(player.pos); snd.bloom(); floatText(px, py - 44, '🌺 Caché !', '#ff9ccb');
        break;
      }
      case 'slap': {
        const R = L === 2 ? 230 : 160, st = L === 2 ? 260 : 170;
        for (const h of hs) {
          const d = Math.hypot(h.pos.x - px, h.pos.y - py);
          if (d > R + h.r) continue;
          stunHunter(h, st);
          if (!(h instanceof Moray)) { const away = createVector(h.pos.x - px, h.pos.y - py); if (away.mag() < 1) away.set(1, 0); away.setMag(1); h.vel.set(away.x * (h.maxSpeed || 3), away.y * (h.maxSpeed || 3)); h.pos.add(away.x * 18, away.y * 18); }
          bubblesAt(h.pos);
        }
        this.rings.push({ x: px, y: py, R, t: 0, dur: 24, c: '160,220,255', kind: 'slap' });
        shake = Math.max(shake, 11); snd.slap(); const h = player.vel.copy().setMag(1); floatText(px - h.x * player.r * 1.6, py - h.y * player.r * 1.6, '💥', '#ffffff');
        break;
      }
      case 'flash': {
        const R = L === 2 ? 680 : 460, bl = L === 2 ? 360 : 240;
        for (const h of hs) if (Math.hypot(h.pos.x - px, h.pos.y - py) < R + h.r) blindHunter(h, bl);
        this.flash = 1; this.rings.push({ x: px, y: py, R, t: 0, dur: 34, c: '225,255,200', kind: 'flash' });
        snd.flash(); floatText(px, py - 44, '💡 Flash !', '#eaffd0');
        break;
      }
    }
  },

  // ---------------- Boucle de jeu ----------------
  think(obs) { for (const d of this.decoys) d.think(obs); },
  // Après la mise à jour des positions (hs = tous les prédateurs)
  post(hs) {
    if (this.cd > 0) this.cd--;
    if (this.lockT > 0) this.lockT--;
    if (this.morphT > 0) this.morphT--;
    this.flash = Math.max(0, this.flash - .03);
    if (this.evo && --this.evo.t <= 0) this.evo = null;
    for (const h of hs) { if (h.stun > 0) h.stun--; if (h.blind > 0) h.blind--; }
    // leurres : croqués par les prédateurs ou expirés
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i]; let gone = --d.life <= 0;
      if (!gone) for (const h of hs) {
        if (!(h.stun > 0) && Math.hypot(h.pos.x - d.pos.x, h.pos.y - d.pos.y) < h.r * .8 + d.r * .6) { gone = true; h.bite = 14; if (vis(h, 200)) snd.pop(panOf(d.pos.x)); break; }
      }
      if (gone) { bubblesAt(d.pos); this.decoys.splice(i, 1); }
    }
    // anémone : pique les prédateurs qui s'en approchent
    const a = this.anem;
    if (a) {
      a.age++; a.t--;
      if (a.t > 0) for (const h of hs) if (!(h.stun > 0) && Math.hypot(h.pos.x - a.x, h.pos.y - a.y) < a.R + h.r * .3) { stunHunter(h, a.L === 2 ? 150 : 100); bubblesAt(h.pos); if (vis(h, 200)) snd.pop(panOf(h.pos.x)); }
      if (a.t <= -30) this.anem = null;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) if (++this.rings[i].t > this.rings[i].dur) this.rings.splice(i, 1);
    for (let i = this.sparks.length - 1; i >= 0; i--) { const s = this.sparks[i]; s.x += s.vx; s.y += s.vy; s.vx *= .96; s.vy *= .96; if (--s.l <= 0) this.sparks.splice(i, 1); }
  },

  // ---------------- Lumières (obscurité des profondeurs) ----------------
  lights(add) {
    if (!player) return;
    if (this.flash > 0) add(player.pos.x, player.pos.y, 280 + 520 * this.flash, [225, 255, 200], .25 + 1.2 * this.flash);
    const a = this.anem; if (a && a.t > 0) add(a.x, a.y - a.R * .3, 160, [255, 130, 190], .6);
  },

  // ---------------- Dessin ----------------
  drawAnem(front) {
    const a = this.anem; if (!a) return;
    const ctx = drawingContext, k = Math.min(1, a.age / 25) * (a.t < 0 ? 1 + a.t / 30 : 1), R = a.R * k, c = a.col, T = frameCount * .06;
    if (k <= .02) return;
    ctx.save(); ctx.lineCap = 'round';
    if (!front && a.t > 0) {   // zone refuge
      ctx.setLineDash([7, 9]); ctx.strokeStyle = `rgba(255,175,215,${.28 + .12 * Math.sin(frameCount * .12)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.R * .8, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.translate(a.x, a.y + a.R * .28);
    if (!front) {
      ctx.fillStyle = 'rgba(105,38,98,.96)'; ctx.beginPath(); ctx.ellipse(0, 0, R * .5, R * .15, 0, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = 'rgba(165,72,142,.92)'; ctx.beginPath(); ctx.ellipse(0, -R * .03, R * .42, R * .1, 0, 0, TWO_PI); ctx.fill();
      const g = ctx.createRadialGradient(0, -R * .4, 0, 0, -R * .4, R); g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.3)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-R, -R * 1.5, R * 2, R * 2); ctx.globalCompositeOperation = 'source-over';
    }
    const N = 18;
    for (let i = 0; i < N; i++) {
      if ((i % 2 === 1) !== front) continue;
      const t = i / (N - 1), bx = (t - .5) * R * .75, ang = -HALF_PI + (t - .5) * 2.1, L = R * (.62 + .22 * Math.sin(i * 2.7 + 1)), sw = Math.sin(T + i * .8 + a.ph) * R * .09;
      const mx = bx + Math.cos(ang) * L * .5 + sw * .5, my = Math.sin(ang) * L * .5, tx = bx + Math.cos(ang) * L + sw, ty = Math.sin(ang) * L;
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${front ? .92 : .7})`; ctx.lineWidth = Math.max(2, R * .07);
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
      ctx.fillStyle = 'rgba(255,235,245,.95)'; ctx.beginPath(); ctx.arc(tx, ty, Math.max(1.8, R * .045), 0, TWO_PI); ctx.fill();
    }
    ctx.restore();
  },
  drawBack() { this.drawAnem(false); },
  drawFront() {
    if (!player) return;
    this.drawAnem(true);
    const ctx = drawingContext;
    // ondes de choc / flash / évolution
    for (const r of this.rings) {
      const p = r.t / r.dur, e = 1 - Math.pow(1 - p, 3), rad = r.R * e, al = 1 - p;
      ctx.save();
      if (r.kind === 'flash' || r.kind === 'evo') {
        const g = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad); g.addColorStop(0, `rgba(${r.c},${.5 * al})`); g.addColorStop(.7, `rgba(${r.c},${.18 * al})`); g.addColorStop(1, `rgba(${r.c},0)`);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TWO_PI); ctx.fill();
      }
      ctx.strokeStyle = `rgba(${r.c},${.9 * al})`; ctx.lineWidth = 2 + 7 * (1 - p); ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TWO_PI); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.5 * al})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, rad * .82, 0, TWO_PI); ctx.stroke();
      if (r.kind === 'slap') { ctx.strokeStyle = `rgba(255,255,255,${.7 * al})`; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * TWO_PI; ctx.moveTo(r.x + Math.cos(a) * rad * .9, r.y + Math.sin(a) * rad * .9); ctx.lineTo(r.x + Math.cos(a) * rad * 1.08, r.y + Math.sin(a) * rad * 1.08); } ctx.stroke(); }
      ctx.restore();
    }
    // étincelles d'évolution
    if (this.sparks.length) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of this.sparks) { ctx.fillStyle = `rgba(${s.c},${Math.min(1, s.l / 40)})`; ctx.beginPath(); ctx.arc(s.x, s.y, 1.5 + s.l / 14, 0, TWO_PI); ctx.fill(); }
      ctx.restore();
    }
    // prédateurs étourdis (étoiles) ou aveuglés (« ? » + éblouissement)
    noStroke(); textAlign(CENTER, CENTER);
    for (const h of [...preds, ...squids, ...wild]) {
      if (!(h.stun > 0 || h.blind > 0) || !vis(h, 200)) continue;
      const hr = h.r > 4 ? h.r : 14;
      if (h.stun > 0) {
        textSize(15); fill(255, 225, 80, min(255, h.stun * 6));
        for (let i = 0; i < 3; i++) { const a = frameCount * .12 + i * TWO_PI / 3; text('★', h.pos.x + Math.cos(a) * hr * .8, h.pos.y - hr * 1.15 + Math.sin(a) * hr * .25); }
      }
      if (h.blind > 0) {
        const al = min(1, h.blind / 40);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(h.pos.x, h.pos.y, 0, h.pos.x, h.pos.y, hr * 1.6);
        g.addColorStop(0, `rgba(255,255,220,${.45 * al})`); g.addColorStop(1, 'rgba(255,255,220,0)'); ctx.fillStyle = g; ctx.fillRect(h.pos.x - hr * 1.6, h.pos.y - hr * 1.6, hr * 3.2, hr * 3.2); ctx.restore();
        textSize(22); fill(255, 255, 200, 255 * al); text('?', h.pos.x, h.pos.y - hr * 1.5 + Math.sin(frameCount * .2) * 3);
      }
    }
  },
  // Éclair plein écran (flash de la Lanterne)
  drawScreen() {
    if (this.flash <= 0) return;
    noStroke(); fill(238, 255, 218, 215 * Math.pow(this.flash, 1.6)); rect(0, 0, width, height);
  },

  // ---------------- Interface ----------------
  hud() {
    if (!player) return;
    const L = this.lv(), d = this.def(), b = this.btn(), g = growthOf(player), ready = L >= 1 && this.cd <= 0;
    push(); noStroke();
    fill(2, 12, 28, 190); circle(b.x, b.y, b.R * 2 + 10);
    noFill(); strokeWeight(5); stroke(255, 255, 255, 40); circle(b.x, b.y, b.R * 2);
    if (L >= 1) { stroke(ready ? '#ffd166' : '#5cc8ff'); arc(b.x, b.y, b.R * 2, b.R * 2, -HALF_PI, -HALF_PI + TWO_PI * (ready ? 1 : 1 - this.cd / this.cdMax)); }
    if (ready) { strokeWeight(2); stroke(255, 209, 102, 70 + 70 * Math.sin(frameCount * .2)); circle(b.x, b.y, b.R * 2 + 14); }
    noStroke(); textAlign(CENTER, CENTER); textSize(26); fill(255, L < 1 ? 80 : 255); text(L < 1 ? '🔒' : d.icon, b.x, b.y + 1);
    fill(0, 190); circle(b.x + b.R * .78, b.y + b.R * .78, 19); fill(255); textSize(11); text('E', b.x + b.R * .78, b.y + b.R * .78 + 1);
    if (L >= 1 && !ready) { fill(255, 235); textSize(12); text((this.cd / 60).toFixed(1), b.x, b.y + b.R + 14); }
    // nom de la capacité + progression d'évolution
    const x = b.x + b.R + 16, nxt = L < 2 ? STAGE_AT[L + 1] : 1, p = L < 2 ? constrain((g - STAGE_AT[L]) / (nxt - STAGE_AT[L]), 0, 1) : 1;
    textAlign(LEFT, CENTER); textSize(13); fill(255, L < 1 ? 170 : 255); text(L < 1 ? 'Capacité verrouillée' : d.name + (ready ? '  ·  PRÊT' : ''), x, b.y - 17);
    fill(255, 40); rect(x, b.y - 3, 130, 6, 3); fill(L < 2 ? '#7dffb3' : '#ffd166'); rect(x, b.y - 3, 130 * p, 6, 3);
    fill(255, 175); textSize(11); text(L < 2 ? `${STAGE_NAMES[L]}  →  ${STAGE_NAMES[L + 1]}${L === 0 ? '  (débloque ' + d.icon + ')' : ''}` : `${STAGE_NAMES[L]}  (max)`, x, b.y + 15);
    // états actifs
    const a = this.anem; let y = b.y - b.R - 20; textSize(13);
    if (a && a.t > 0 && this.hidden(player)) { fill('#ff9ccb'); text(`🌺 Caché · ${ceil(a.t / 60)} s  (E : sortir)`, 14, y); y -= 20; }
    if (this.decoys.length) { fill('#a9d6ff'); text(`🐟 Leurres × ${this.decoys.length}`, 14, y); y -= 20; }
    pop();
    // bandeau d'évolution
    const e = this.evo;
    if (e) {
      const al = constrain(Math.min(e.t / 40, (230 - e.t) / 12), 0, 1), dd = this.def();
      push(); textAlign(CENTER, CENTER); noStroke();
      drawingContext.shadowBlur = 26; drawingContext.shadowColor = '#ffb347';
      textSize(min(46, width * .07)); fill(255, 224, 120, 255 * al); text('✨ ÉVOLUTION ✨', width / 2, height * .22);
      drawingContext.shadowBlur = 0;
      textSize(min(28, width * .045)); fill(255, 255, 255, 255 * al); text(`Tu deviens ${e.s === 2 ? 'un poisson ' : ''}${STAGE_NAMES[e.s].toLowerCase()} !`, width / 2, height * .22 + 44);
      textSize(min(18, width * .035)); fill(255, 209, 102, 255 * al);
      text(e.s === 1 ? `🔓 Capacité débloquée : ${dd.icon} ${dd.name}  —  touche E, clic droit ou bouton rond` : `⚡ ${dd.name} améliorée : ${dd.up}`, width / 2, height * .22 + 76);
      pop();
    }
  },
  // Clic sur le bouton rond de la capacité (utile à la souris comme au tactile)
  press() {
    if (state !== 'play' || paused || !player || this.rmb) return;
    const b = this.btn();
    if (dist(mouseX, mouseY, b.x, b.y) < b.R + 8) { this.uiHold = true; this.use(); }
  },
};

// Clic droit = capacité (le menu contextuel du navigateur est désactivé en jeu)
addEventListener('mousedown', e => { if (e.button === 2) { Abil.rmb = true; if (state === 'play') Abil.use(); } });
addEventListener('mouseup', e => { if (e.button === 2) Abil.rmb = false; });
addEventListener('contextmenu', e => { if (state === 'play') e.preventDefault(); });
