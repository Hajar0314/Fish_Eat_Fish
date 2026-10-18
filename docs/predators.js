// =====================================================================
//  predators.js — prédateurs variés (chacun a sa propre tactique)
//    🔨 Requin-marteau : repère sa proie, se fige (alerte !), puis CHARGE en ligne droite
//    🐍 Murène         : embusquée dans un rocher, jaillit quand on passe à portée
//    🐟 Barracuda      : chasse en BANC (cohésion + alignement + poursuite partagée)
//    🐋 Orque          : chasse en MEUTE (encerclement, puis attaque coordonnée)
//  Tous héritent de Predator/Fish : ils utilisent les mêmes comportements (pursue,
//  wander, separate, avoid…) et le même rendu (dégradés, nageoires animées).
// =====================================================================

let wild = [];                       // tous les prédateurs « spéciaux » en vie
let wildPacks = { b: [], o: [] };    // bancs de barracudas / meutes d'orques
const resetWild = () => { wild = []; wildPacks = { b: [], o: [] }; };

const PRED_HAMMER = { name: 'Marteau', r: 27, speed: 2.5, force: 0.065, col: '#7f90a3' };
const PRED_MORAY = { name: 'Murène', r: 13, speed: 0, force: 0, col: '#7b8a3b' };
const PRED_BARRA = { name: 'Barracuda', r: 13, speed: 3.2, force: 0.13, col: '#a7bccd' };
const PRED_ORCA = { name: 'Orque', r: 36, speed: 2.9, force: 0.075, col: '#1f2b3a' };

// Base commune : détection de la proie la plus proche + bornes de profondeur
class Hunter extends Predator {
  scan(team, range) { return Chase.pick(this, team, range); }   // verrouillage + persistance (voir learning.js)
  base(obs, y0, y1) {
    this.ylim = [y0, y1];
    this.applyForce(this.avoid(obs).mult(P.avoidW * 1.3));
    this.applyForce(this.bounds(0, y0, WW, y1, 70));
  }
  // Un autre membre du groupe a repéré une proie proche : on la partage
  shared(mates, range) {
    if (this.blind > 0) return null;   // aveuglé (flash de la Lanterne)
    for (const m of mates) if (m !== this && m.target && m.pos.dist(this.pos) < range) return m.target;
    return null;
  }
}

// ---------------------------------------------------------------------
//  🔨 Requin-marteau : patrouille -> alerte (34 images) -> charge rectiligne -> récupération
//  Pendant la charge il ne corrige plus sa trajectoire : il suffit de l'esquiver sur le côté.
// ---------------------------------------------------------------------
class HammerShark extends Hunter {
  constructor(x, y) { super(x, y, PRED_HAMMER); this.mode = 0; this.t = 0; this.cool = 60 + random(120); this.cd = null; }
  think(team, preds, obs) {
    this.lookAhead = P.look * 1.4;
    this.cool = max(0, this.cool - 1);
    const tgt = this.scan(team, P.detect * 0.95); this.target = tgt;
    if (this.mode === 0) {                       // patrouille / poursuite classique
      this.maxSpeed = this.sp.speed; this.maxForce = this.sp.force;
      this.applyForce(tgt ? this.pursue(tgt).mult(0.8) : this.wander());
      if (tgt && !this.cool && this.pos.dist(tgt.pos) < P.detect * 0.8) { this.mode = 1; this.t = 34; snd.growl(panOf(this.pos.x), 1); }
    } else if (this.mode === 1) {                // alerte : il freine et se cale sur la cible
      this.maxSpeed = this.sp.speed * 0.35; this.maxForce = 0.12;
      if (tgt) this.applyForce(this.seek(tgt.pos).mult(1.2));
      this.t -= TS; if (this.t <= 0) {
        if (tgt) { this.cd = p5.Vector.sub(this.aim(tgt, 14), this.pos).setMag(1); this.mode = 2; this.t = 52; }
        else { this.mode = 0; this.cool = 120; }
      }
    } else {                                     // charge : direction verrouillée
      this.maxSpeed = this.sp.speed * 3; this.maxForce = 0.4;
      this.applyForce(this.cd.copy().mult(0.35));
      this.t -= TS; if (this.t <= 0) { this.mode = 0; this.cool = 280; }
    }
    this.applyForce(this.separate(preds, this.r * 4).mult(P.sepW));
    this.base(obs, WH * 0.1, WH * 0.8);
  }
  show() {
    super.show();
    const ctx = drawingContext, r = this.r, col = this.sp.col;
    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(this.vel.heading()); if (this.vel.x < 0) ctx.scale(1, -1);
    // le « marteau » : tête en T, yeux aux deux extrémités
    const g = ctx.createLinearGradient(0, -r * .66, 0, r * .66);
    g.addColorStop(0, shade(col, -.4)); g.addColorStop(.55, shade(col, 0)); g.addColorStop(1, shade(col, .6));
    ctx.fillStyle = g; ctx.strokeStyle = shade(col, -.6, .6); ctx.lineWidth = Math.max(.7, r * .045);
    ctx.beginPath(); ctx.ellipse(r * 1.04, 0, r * .24, r * .66, 0, 0, TWO_PI); ctx.fill(); ctx.stroke();
    for (const s of [-1, 1]) {
      const ex = r * 1.08, ey = s * r * .6;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * .13, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = this.mode === 1 ? '#ff2a2a' : '#000'; ctx.beginPath(); ctx.arc(ex + r * .03, ey, r * .075, 0, TWO_PI); ctx.fill();
    }
    ctx.restore();
    if (this.mode === 1) {                       // alerte visuelle : anneau rouge + « ! »
      const a = .4 + .4 * sin(frameCount * .5);
      noFill(); stroke(255, 60, 60, 255 * a); strokeWeight(3); circle(this.pos.x, this.pos.y, this.r * 4 + (34 - this.t));
      noStroke(); fill(255, 80, 80); textAlign(CENTER, CENTER); textSize(24); text('!', this.pos.x, this.pos.y - this.r * 1.8);
      strokeWeight(1);
    } else if (this.mode === 2) {                // traînée de vitesse
      const b = this.vel.copy().setMag(1); stroke(255, 255, 255, 80); strokeWeight(2);
      for (let i = -1; i <= 1; i++) line(this.pos.x - b.x * r * 1.4 - b.y * i * r * .5, this.pos.y - b.y * r * 1.4 + b.x * i * r * .5, this.pos.x - b.x * r * 3.4 - b.y * i * r * .5, this.pos.y - b.y * r * 3.4 + b.x * i * r * .5);
      strokeWeight(1);
    }
  }
}

// ---------------------------------------------------------------------
//  🐍 Murène : vit dans un rocher. Au repos on ne voit que ses yeux qui brillent dans le trou.
//  Cycle : attente -> contraction (20 images, les yeux s'allument) -> détente -> pause -> retrait
//  Elle vise l'endroit où sera la proie : un virage brusque suffit à l'éviter.
// ---------------------------------------------------------------------
class Moray extends Hunter {
  constructor(rock) {
    super(rock.pos.x, rock.pos.y, PRED_MORAY);
    this.rock = rock; rock.moray = true;
    this.a = random(-PI * .92, -PI * .08); this.out = createVector(cos(this.a), sin(this.a));
    this.hole = p5.Vector.add(rock.pos, this.out.copy().mult(rock.r * .82));
    this.pos.set(this.hole); this.sd = this.out.copy(); this.L = 150;
    this.ext = 0; this.mode = 0; this.t = 0; this.cool = 60 + random(120); this.watch = 0;
  }
  // rayon de collision : minuscule tant que la tête est dans le trou
  get r() { return this.ext > .2 ? 13 : 2; }
  set r(v) { }
  think(team, preds, obs) {
    this.cool = max(0, this.cool - 1);
    const h = this.hole; let tgt = null, bd = 1e9;
    for (const t of team) { const d = h.dist(t.pos); if (d < bd) { bd = d; tgt = t; } }
    this.watch = lerp(this.watch, (bd < 300 && !this.cool) ? 1 : 0, .08);
    if (this.mode === 0) {
      this.ext = max(0, this.ext - .04 * TS);
      if (tgt && bd < 175 && !this.cool) { this.mode = 1; this.t = 20; }
    } else if (this.mode === 1) {                // contraction : la tête sort un peu et tremble
      this.ext = min(.14, this.ext + .02 * TS);
      this.t -= TS; if (this.t <= 0) {
        if (tgt) { const d = p5.Vector.sub(this.aim(tgt, 10), h); this.L = constrain(d.mag() + 14, 90, 210); this.sd = d.setMag(1); this.mode = 2; }
        else this.mode = 4;
      }
    } else if (this.mode === 2) {                // détente : jaillit
      this.ext = min(1, this.ext + .14 * TS);
      if (this.ext >= 1) { this.mode = 3; this.t = 9; }
    } else if (this.mode === 3) {                // pause bouche ouverte
      this.t -= TS; if (this.t <= 0) this.mode = 4;
    } else {                                     // retrait lent
      this.ext -= .035 * TS; if (this.ext <= 0) { this.ext = 0; this.mode = 0; this.cool = 170; }
    }
    const e = 1 - (1 - this.ext) * (1 - this.ext);
    this.pos.set(h.x + this.sd.x * this.L * e, h.y + this.sd.y * this.L * e);
    this.vel.set(this.sd.x, this.sd.y); this.target = this.mode >= 2 ? tgt : null;
  }
  update() { this.acc.mult(0); }                 // elle ne se déplace pas : l'ancre est le rocher
  show() {
    const ctx = drawingContext, h = this.hole, T = frameCount, col = this.sp.col;
    // trou sombre au bord du rocher
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(this.a + HALF_PI);
    ctx.fillStyle = 'rgba(2,6,14,.88)'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, TWO_PI); ctx.fill(); ctx.restore();
    if (this.ext < .05) {                        // au repos : deux yeux qui brillent dans le noir
      const a = .22 + .65 * this.watch + .1 * sin(T * .07 + this.ph), tx = -this.out.y, ty = this.out.x;
      ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#ffe14d'; ctx.fillStyle = `rgba(255,225,80,${a})`;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(h.x + this.out.x * 3 + tx * s * 5, h.y + this.out.y * 3 + ty * s * 5, 2.3, 0, TWO_PI); ctx.fill(); }
      ctx.restore();
    } else {
      const hd = this.pos, dx = hd.x - h.x, dy = hd.y - h.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const N = 16, amp = (this.mode === 2 || this.mode === 3) ? 5 : 13, shake = this.mode === 1 ? sin(T * 1.6) * 2 : 0, pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, w = amp * Math.sin(t * PI) * Math.sin(t * 7 - T * .3) + shake * t;
        pts.push([h.x + dx * t + nx * w, h.y + dy * t + ny * w]);
      }
      ctx.lineCap = 'round';
      const seg = (lw, style, off = 0) => {      // une passe sur tout le corps (épaisseur qui s'affine vers la queue)
        for (let i = 0; i < N; i++) {
          const k = 1 - i / N * .15; ctx.lineWidth = lw * k; ctx.strokeStyle = style;
          ctx.beginPath(); ctx.moveTo(pts[i][0] + nx * off, pts[i][1] + ny * off); ctx.lineTo(pts[i + 1][0] + nx * off, pts[i + 1][1] + ny * off); ctx.stroke();
        }
      };
      seg(17, 'rgba(10,18,8,.95)'); seg(13.5, shade(col, 0)); seg(5, shade(col, .45, .7), 2.5);
      ctx.fillStyle = 'rgba(250,230,110,.75)';   // taches jaunes
      for (let i = 2; i < N; i += 2) { ctx.beginPath(); ctx.arc(pts[i][0] + nx * -2, pts[i][1] + ny * -2, 2.2, 0, TWO_PI); ctx.fill(); }
      // tête : mâchoire qui s'ouvre pendant l'attaque
      const open = (this.mode === 2 || this.mode === 3) ? .6 : this.mode === 1 ? .28 : .1;
      ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(atan2(dy, dx)); if (dx < 0) ctx.scale(1, -1);
      ctx.fillStyle = '#5a0f1c'; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(21, -1); ctx.lineTo(21 * Math.cos(open), 21 * Math.sin(open)); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.rotate(open); ctx.fillStyle = shade(col, -.3); ctx.beginPath(); ctx.ellipse(10, 0, 12, 4.4, 0, 0, TWO_PI); ctx.fill(); ctx.restore();
      ctx.fillStyle = shade(col, -.05); ctx.strokeStyle = 'rgba(10,18,8,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(8, -2, 14, 7.5, 0, 0, TWO_PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath();
      for (let x = 12; x < 22; x += 3.2) { ctx.moveTo(x, 4.2); ctx.lineTo(x + 1.3, 4.2); ctx.lineTo(x + .6, 7.4); }
      ctx.fill();
      ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = '#ffe14d'; ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(7, -5.2, 3, 0, TWO_PI); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#000'; ctx.fillRect(6.6, -7.4, 1.1, 4.4);
      ctx.restore();
    }
    if (P.debug) { noFill(); stroke(255, 60, 60, 120); circle(h.x, h.y, 400); }
  }
}

// ---------------------------------------------------------------------
//  🐟 Barracuda : chasse en banc. Si l'un voit une proie, tout le banc la poursuit.
//  Hors chasse : cohésion + alignement (nage en formation), plus lent.
// ---------------------------------------------------------------------
class Barracuda extends Hunter {
  constructor(x, y, pack) { super(x, y, PRED_BARRA); this.pack = pack; pack.push(this); }
  think(team, preds, obs) {
    this.lookAhead = P.look;
    const mates = this.pack.filter(m => !m.dead);
    const tgt = this.scan(team, P.detect * 1.1) || this.shared(mates, 350); this.target = tgt;
    this.maxSpeed = this.sp.speed * (tgt ? 1.15 : 0.7);
    if (tgt) { this.applyForce(this.pursue(tgt).mult(1.3)); this.applyForce(this.align(mates, 90).mult(0.5)); }
    else { this.applyForce(this.cohesion(mates, 260)); this.applyForce(this.align(mates, 120)); this.applyForce(this.wander().mult(0.5)); }
    this.applyForce(this.separate(mates, this.r * 3.2).mult(P.sepW * 1.2));
    this.base(obs, 0, WH * 0.7);
  }
}

// ---------------------------------------------------------------------
//  🐋 Orque : chasse en meute. Phase 1 : chaque orque rejoint sa place sur un cercle autour
//  de la proie (encerclement). Quand la meute est en place -> phase 2 : attaque de tous côtés
//  pendant ~3 s, puis la meute se replace (vagues d'attaque).
// ---------------------------------------------------------------------
class Orca extends Hunter {
  constructor(x, y, pack, slot) { super(x, y, PRED_ORCA); this.pack = pack; this.slot = slot; pack.push(this); }
  think(team, preds, obs) {
    this.lookAhead = P.look * 1.4;
    const pk = this.pack, mates = pk.filter(m => !m.dead);
    const tgt = this.scan(team, P.detect * 1.3) || this.shared(mates, 600); this.target = tgt;
    if (pk.stamp !== frameCount) {               // état de la meute : mis à jour une fois par image
      pk.stamp = frameCount;
      if (tgt) {
        if (!pk.mode) {
          pk.cool = Math.max(0, (pk.cool ?? 100) - 1);   // temps d'encerclement minimal avant chaque vague
          if (!pk.cool && mates.filter(m => m.pos.dist(tgt.pos) < 480).length >= Math.ceil(mates.length * .6)) { pk.mode = 1; pk.t = 170; snd.growl(panOf(this.pos.x), 1); }
        } else if (--pk.t <= 0) { pk.mode = 0; pk.cool = 140; }   // fin de vague : la meute se replace
      } else { pk.mode = 0; pk.cool = 100; }
    }
    if (tgt) {
      if (!pk.mode) {                            // encerclement
        const ang = this.slot + frameCount * .006, c = p5.Vector.add(tgt.pos, tgt.vel.copy().mult(14));
        this.maxSpeed = this.sp.speed * 1.1;
        this.applyForce(this.arrive(createVector(c.x + cos(ang) * 330, c.y + sin(ang) * 230), 120).mult(1.2));
      } else {                                   // attaque coordonnée
        this.maxSpeed = this.sp.speed * 1.3; this.applyForce(this.pursue(tgt).mult(1.4));
      }
    } else {
      this.maxSpeed = this.sp.speed * 0.7;
      this.applyForce(this.wander().mult(0.6)); this.applyForce(this.cohesion(mates, 400).mult(0.6)); this.applyForce(this.align(mates, 200).mult(0.5));
    }
    this.applyForce(this.separate(mates, this.r * 3).mult(P.sepW));
    this.base(obs, 0, WH * 0.55);
  }
  show() {
    super.show();
    const ctx = drawingContext, r = this.r;
    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(this.vel.heading()); if (this.vel.x < 0) ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(190,200,210,.5)'; ctx.beginPath(); ctx.ellipse(-r * .15, -r * .5, r * .4, r * .16, .15, 0, TWO_PI); ctx.fill();   // selle grise
    ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.ellipse(r * .6, -r * .3, r * .24, r * .085, -.4, 0, TWO_PI); ctx.fill();   // tache blanche
    ctx.fillStyle = this.pk && this.pk.mode ? '#ff2a2a' : '#000'; ctx.beginPath(); ctx.arc(r * .66, -r * .3, r * .06, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }
  get pk() { return this.pack; }
}

// ---------------------------------------------------------------------
//  Population : maintenue à chaque image par syncPop() (comme les autres prédateurs).
//  Les quantités suivent les réglages (touche S) et augmentent avec le niveau.
// ---------------------------------------------------------------------
function spawnPt(y0, y1, d = 450) {
  let p; for (let i = 0; i < 14; i++) { p = createVector(random(WW), random(y0, y1)); if (!player || p.dist(player.pos) > d) break; } return p;
}
function removeKind(cls) { for (let i = wild.length - 1; i >= 0; i--) if (wild[i] instanceof cls) { wild[i].dead = true; wild.splice(i, 1); return; } }

function syncWild() {
  const a = A(), lv = level;
  // requins-marteaux
  const nH = round((P.nbHammer + floor(lv / 3)) * a * .14);
  let c = wild.filter(w => w instanceof HammerShark).length;
  while (c < nH) { const p = spawnPt(WH * .2, WH * .7); wild.push(new HammerShark(p.x, p.y)); c++; }
  while (c > nH) { removeKind(HammerShark); c--; }
  // murènes : une par rocher, loin du joueur
  const nM = round(P.nbMoray * a * .3 + min(lv - 1, 4) * a * .04);
  c = wild.filter(w => w instanceof Moray).length;
  if (c < nM) {
    const free = obstacles.filter(o => !o.moray && o.pos.y > WH * .18 && (!player || o.pos.dist(player.pos) > 450));
    while (c < nM && free.length) { const i = floor(random(free.length)); wild.push(new Moray(free.splice(i, 1)[0])); c++; }
  }
  while (c > nM) { const m = wild.find(w => w instanceof Moray); if (!m) break; m.rock.moray = false; removeKind(Moray); c--; }
  // bancs de barracudas / meutes d'orques
  syncPacks('b', round((P.nbBarra + floor(lv / 5)) * a * .11), 4 + floor(lv / 8), WH * .08, WH * .55, (x, y, pk) => new Barracuda(x, y, pk));
  syncPacks('o', round((P.nbOrca + floor(lv / 4)) * a * .055), 3 + floor(lv / 6), WH * .08, WH * .4, (x, y, pk, i, n) => new Orca(x, y, pk, TWO_PI * i / n));
}
function syncPacks(key, want, size, y0, y1, make) {
  wildPacks[key] = wildPacks[key].filter(pk => pk.some(m => !m.dead));
  while (wildPacks[key].length < want) {
    const pk = [], p = spawnPt(y0, y1);
    for (let i = 0; i < size; i++) wild.push(make(p.x + random(-50, 50), p.y + random(-40, 40), pk, i, size));
    wildPacks[key].push(pk);
  }
  while (wildPacks[key].length > want) {
    const pk = wildPacks[key].pop();
    for (const m of pk) { m.dead = true; const i = wild.indexOf(m); if (i >= 0) wild.splice(i, 1); }
  }
}
