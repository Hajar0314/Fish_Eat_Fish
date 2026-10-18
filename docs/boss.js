// =====================================================================
//  boss.js — les 5 boss du mode Stages (un par biome)
//
//  Quand les objectifs d'un stage sont remplis, Stage appelle hooks.spawnBoss -> le boss du biome apparaît.
//
//  BossBase : barre de vie, 3 phases (100 % -> 66 % -> 33 %), annonce de chaque attaque (texte + télégraphie),
//             fenêtre de vulnérabilité après chaque grosse attaque.
//    Cycle : entrée -> rôde -> ANNONCE (tele) -> attaque -> VULNÉRABLE (rec) -> rôde …
//
//  Dégâts sur le boss :
//    - morsure : pendant la fenêtre de vulnérabilité, toucher le boss le blesse (plus fort quand on a évolué)
//    - frénésie : le bonus 🔥 le blesse au contact, même hors fenêtre
//  Hors fenêtre, toucher un boss fait perdre une vie (bouclier : protégé).
//
//  🔨 Récif    : requin-marteau colossal  — charges (simple, double, triple) + séisme
//  🐍 Kelp     : murène géante            — embuscade (surgit d'en dessous) + crachats d'acide
//  🐋 Épaves   : orque géante             — sonar (ondes) + meute invoquée + éperonnage
//  🎣 Grotte   : baudroie géante          — leurre qui ATTIRE + lueurs téléguidées + élan
//  🦈 Abysses  : mégalodon                — charges en série + rugissements (ondes qui vident le sprint)
//
//  Les boss vivent dans le tableau `wild` (comme les autres prédateurs) : étourdissement, aveuglement, flèches
//  de danger, tension musicale… fonctionnent donc sans rien changer. Seuls les contacts (morsure / dégâts) sont
//  gérés ici (Boss.step), et le jeu les ignore pour les boss (voir sketch.js : `isBoss`).
//  Test rapide : index.html?stage=3&boss=1 fait apparaître directement le boss du stage choisi.
// =====================================================================

const BOSS_ROCK_STUN = 40;   // images d'étourdissement quand un boss percute un rocher en chargeant
const BOSS_WALL_WAVE = 105;   // rayon (px) de l'onde quand une charge percute le bord de la carte (non annoncée : gardée petite)
const BOSS_STOMP_R = 190;     // rayon (px) de l'onde d'écrasement à la fin d'une charge (phase 2+)
const BOSS_MINI_GRACE = 130;   // images pendant lesquelles les orques invoquées sont étourdies (elles apparaissent sur le joueur qui mord le boss)
const BOSS_MINI = { name: 'Orque', r: 28, speed: 3, force: 0.08, col: '#27364a' };   // orques de la meute invoquée

class BossBase extends Hunter {
  constructor(x, y, sp, name, icon) {
    super(x, y, sp);
    this.isBoss = true; this.bossName = name; this.icon = icon;
    this.hp = this.maxHp = 100; this.gp = 100; this.phase = 1;
    this.st = 'enter'; this.t = 110; this.teleMax = 1; this.cool = 90; this.vuln = 0; this.dying = 0;
    this.biteCd = 0; this.frenzyCd = 0; this.hitFlash = 0; this.say = null; this.sub = null; this.n = 0; this.atkName = ''; this.last = '';
    this.cd = createVector(1, 0); this.meal = 1e9; this.charging = false;   // meal énorme : il ne chasse pas les petits poissons
  }

  // ---------- Utilitaires ----------
  fwd() {
    const m = Math.hypot(this.vel.x, this.vel.y);
    this._f = this._f || createVector(1, 0);
    if (m > .02) this._f.set(this.vel.x / m, this.vel.y / m);
    return this._f;
  }
  // Rochers : collision d'une charge + distance du premier rocher devant (pour couper la ligne de télégraphie)
  rockHit(k = .7) {
    for (const o of obstacles) {
      const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y, R = o.r + this.r * k;
      if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
      const d = Math.hypot(dx, dy) || 1; if (d < R) return { o, dx: dx / d, dy: dy / d, pen: R - d };
    }
    return null;
  }
  rayRock(len) {
    let best = len;
    for (const o of obstacles) {
      const ox = o.pos.x - this.pos.x, oy = o.pos.y - this.pos.y, along = ox * this.cd.x + oy * this.cd.y;
      if (along < 0 || along - o.r > best) continue;
      const side = Math.abs(ox * this.cd.y - oy * this.cd.x), R = o.r + this.r * .7;
      if (side < R) best = Math.min(best, Math.max(0, along - Math.sqrt(R * R - side * side)));
    }
    return best;
  }
  nearest(team) { let b = null, bd = 1e9; for (const t of team) { const d = this.pos.dist(t.pos); if (d < bd) { bd = d; b = t; } } return b; }
  announce(txt, t = 80) { this.say = { txt, t, max: t }; }
  harmless() { return this.vuln > 0 || this.st === 'enter' || this.st === 'phase' || this.st === 'dead' || this.dying > 0 || this.stun > 0; }
  circles() { return [[this.pos.x, this.pos.y, this.r * .8]]; }    // zones de contact (x, y, rayon)
  vulnFor() { return [210, 170, 140][this.phase - 1]; }
  coolFor() { return [150, 110, 80][this.phase - 1]; }
  go(st) { this.st = st; if (st === 'roam') { this.cool = this.coolFor(); this.sub = null; this.charging = false; } }

  // ---------- Cycle de combat ----------
  think(team) {
    const dt = TS;
    this.charging = false;
    if (this.stun > 45) this.stun = 45;                  // les étourdissements durent moins longtemps sur un boss
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;
    if (this.dying > 0 || this.st === 'dead') { this.maxSpeed = .3; return; }
    if (this.stun > 0) return;
    const tgt = this.nearest(team); this.target = tgt;
    switch (this.st) {
      case 'enter': this.maxSpeed = this.sp.speed * .6; this.maxForce = this.sp.force; this.applyForce(tgt ? this.seek(tgt.pos).mult(.6) : this.wander()); if ((this.t -= dt) <= 0) this.go('roam'); break;
      case 'roam': this.roam(tgt, dt); if ((this.cool -= dt) <= 0 && tgt) this.pick(tgt); break;
      case 'tele': this.tele(tgt, dt); if ((this.t -= dt) <= 0) { this.st = 'atk'; this.sub = null; this.begin(tgt); } break;
      case 'atk': { const r = this.atk(tgt, dt); if (r) this.endAtk(r); break; }
      case 'rec': this.rec(tgt, dt); if ((this.vuln -= dt) <= 0) { this.vuln = 0; this.go('roam'); } break;
      case 'phase': this.maxSpeed = .3; if (this.phaseWave > 0 && (this.phaseWave -= dt) <= 0) Boss.wave(this.pos.x, this.pos.y, 330, 75, 30, [255, 120, 90], { src: this, kind: 'roar' }); if ((this.t -= dt) <= 0) this.go('roam'); break;
    }
    if (!this.charging) {
      this.applyForce(this.bounds(0, WH * .04, WW, WH * .93, 90).mult(1.5));
      for (const o of obstacles) {                           // contourne les rochers
        const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y, R = o.r + this.r + 70;
        if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
        const d = Math.hypot(dx, dy) || 1; if (d < R) this.applyForce(createVector(dx / d, dy / d).mult(.35 * (1 - d / R)));
      }
    }
  }
  update() {
    super.update();
    if (!this.charging && this.dying <= 0) for (const o of obstacles) {   // jamais à l'intérieur d'un rocher
      const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y, R = o.r + this.r * .6;
      if (Math.abs(dx) > R || Math.abs(dy) > R) continue;
      const d = Math.hypot(dx, dy) || 1; if (d < R) { this.pos.x += dx / d * (R - d); this.pos.y += dy / d * (R - d); }
    }
  }
  startTele(name, txt, frames) {
    this.atkName = name; this.last = name; this.st = 'tele'; this.t = this.teleMax = frames; this.sub = null; this.announce(txt, frames + 30);
    if (vis(this, 900)) snd.growl(panOf(this.pos.x), 1);
  }
  endAtk(res) {
    this.sub = null; this.charging = false;
    if (res === 'quick') { this.st = 'roam'; this.cool = [70, 50, 36][this.phase - 1]; return; }   // attaque légère : pas de fenêtre
    this.st = 'rec'; this.vuln = this.vulnFor(); this.announce('✨ VULNÉRABLE !', 60); snd.power('double');
  }
  roam() { }  pick() { }  tele() { }  begin() { }  atk() { return true; }
  rec() { this.maxSpeed = .5; this.maxForce = .05; this.applyForce(this.wander().mult(.3)); }

  // Charge rectiligne (direction verrouillée dans this.cd), this.n charges à la suite. Renvoie true à la fin.
  chargeStep(t, dt, o = {}) {
    const s = this.sub || (this.sub = { m: 'go', t: o.go || 46 });
    if (s.m === 'go') {
      const speed = this.sp.speed * (o.k || 4.2); this.charging = true;
      this.maxSpeed = speed; this.maxForce = 1; this.vel.set(this.cd.x * speed, this.cd.y * speed);
      s.t -= dt;
      if (frameCount % 3 === 0) bubbles.push({ x: this.pos.x - this.cd.x * this.r, y: this.pos.y - this.cd.y * this.r + random(-this.r * .5, this.r * .5), s: random(6, 14), life: 50 });
      const wall = this.pos.x < this.r * .7 || this.pos.x > WW - this.r * .7 || this.pos.y < WH * .05 || this.pos.y > WH * .92;
      const rk = wall ? null : this.rockHit();
      if (rk) {                                             // impact contre un rocher : la charge s'arrête net, le boss est sonné
        this.pos.x += rk.dx * rk.pen; this.pos.y += rk.dy * rk.pen; this.vel.set(rk.dx * 1.5, rk.dy * 1.5);
        this.stun = Math.max(this.stun || 0, BOSS_ROCK_STUN); this.charging = false; this.n = 0; this.sub = null; this.hitFlash = 8;
        shake = Math.max(shake, 11); bubblesAt({ x: this.pos.x - rk.dx * this.r * .5, y: this.pos.y - rk.dy * this.r * .5 }); bubblesAt(this.pos);
        snd.crunch(panOf(this.pos.x)); floatText(this.pos.x, this.pos.y - this.r * 1.2, '💥 Dans le rocher !', '#ffd166');
        return true;
      }
      if (s.t <= 0 || wall) {
        this.n--;
        if (wall) { shake = Math.max(shake, 12); Boss.wave(this.pos.x, this.pos.y, BOSS_WALL_WAVE, 40, 24, [255, 200, 120], { src: this, kind: 'wall' }); }   // impact contre le bord
        if (this.n > 0) { s.m = 'aim'; s.t = o.re || 24; }
        else { if (o.wave && !wall) Boss.wave(this.pos.x, this.pos.y, BOSS_STOMP_R, 44, 26, [255, 170, 90], { src: this, kind: 'stomp' }); return true; }
      }
    } else {                                                // se recale entre deux charges
      this.maxSpeed = .4; this.maxForce = .2; s.t -= dt;
      if (t) { if (s.t > (o.lock || 0)) this.cd = p5.Vector.sub(this.aim(t, 12), this.pos).setMag(1); this.applyForce(this.seek(t.pos).mult(3)); }   // o.lock : visée figée les dernières images
      if (s.t <= 0) { s.m = 'go'; s.t = o.go || 46; }
    }
    return false;
  }
  // Verrouille la direction sur la cible (jusqu'aux dernières images de l'annonce)
  lockAim(t, lead = 14, until = 12) {
    if (t && this.t > until) this.cd = p5.Vector.sub(this.aim(t, lead), this.pos).setMag(1);
    else if (!t && this.t > until) this.cd = this.fwd().copy();
  }

  // ---------- Dégâts, phases, mort ----------
  hurt(n) {
    if (this.dying > 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - n); this.hitFlash = 10;
    if (this.hp <= 0) { this.die(); return; }
    const np = this.hp > 66 ? 1 : this.hp > 33 ? 2 : 3;
    if (np > this.phase) this.nextPhase(np);
  }
  nextPhase(np) {
    this.phase = np; this.st = 'phase'; this.t = 85; this.vuln = 0; this.sub = null; this.charging = false; this.n = 0;
    this.announce(`⚠ PHASE ${np} !`, 110); Boss.alert(`PHASE ${np}`, 'Il devient plus féroce !', 130, '#ff9a5c');
    this.phaseWave = 36;   // le rugissement de changement de phase est annoncé (cercle pointillé) puis part avec un léger délai
    snd.event('erupt'); shake = Math.max(shake, 12); Boss.givePups(2);
    this.onPhase(np);
  }
  onPhase() { }
  die() { this.dying = 150; this.st = 'dead'; this.vuln = 0; this.say = null; this.sub = null; Boss.onDeath(this); }

  // ---------- Contacts avec l'équipe du joueur (appelé chaque image par Boss.step) ----------
  contact(team) {
    this.biteCd = Math.max(0, this.biteCd - 1); this.frenzyCd = Math.max(0, this.frenzyCd - 1); this.hitFlash = Math.max(0, this.hitFlash - 1);
    this.gp += (this.hp - this.gp) * .04;
    if (this.dying > 0 || this.st === 'dead') return;
    const cs = this.circles();
    for (let i = team.length - 1; i >= 0; i--) {
      const f = team[i]; if (!f || Abil.hidden(f)) continue;
      let touch = false;
      for (const c of cs) if (Math.hypot(c[0] - f.pos.x, c[1] - f.pos.y) < c[2] + f.r * .6) { touch = true; break; }
      if (!touch) continue;
      if (fx.frenzy) {                                      // frénésie : le joueur grignote le boss
        if (f === player && this.frenzyCd <= 0) { this.frenzyCd = 10; this.chomp(f, 1.6, false); }
        continue;
      }
      if (this.vuln > 0) {                                  // fenêtre de vulnérabilité : morsure
        if (this.biteCd <= 0) { this.biteCd = 36; this.chomp(f, f === player ? 7 + 2 * (player.stage | 0) : 3, true); }
        continue;
      }
      if (!this.harmless()) Boss.hurtTeam(f, this);
    }
  }
  chomp(f, dmg, big) {
    f.bite = 16; this.hurt(dmg);
    bubblesAt(f.pos); snd.crunch(panOf(this.pos.x)); shake = Math.max(shake, big ? 9 : 3);
    if (big) { score += 25; floatText(f.pos.x, f.pos.y - 34, `-${dmg} PV`, '#ffd166'); }
  }

  // ---------- Dessin ----------
  body() { const g = this.vuln > 0 || this.hitFlash > 0; Fish.prototype.show.call(this, g, g ? '#ffe680' : null); }
  show() {
    const ctx = drawingContext; ctx.save();
    if (this.dying > 0) ctx.globalAlpha = Math.max(0, Math.min(1, this.dying / 70));
    this.body();
    ctx.restore();
    if (this.hitFlash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * .03})`; ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.r * 1.1, 0, TWO_PI); ctx.fill(); ctx.restore(); }
  }
  // Annonce / télégraphie : dessiné par-dessus tout (voir Boss.drawWorld)
  drawTele(ctx) {
    if (this.st !== 'tele') return;
    const k = 1 - this.t / this.teleMax, a = .35 + .4 * Math.abs(Math.sin(frameCount * .4));
    ctx.save(); ctx.strokeStyle = `rgba(255,70,60,${a})`; ctx.lineWidth = 3 + 4 * k;
    ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.r * (1.5 + (1 - k) * .8), 0, TWO_PI); ctx.stroke(); ctx.restore();
  }
  dashLine(ctx, len = 900, w = 5) {   // ligne pointillée de la direction verrouillée
    const k = 1 - this.t / this.teleMax;
    ctx.save(); ctx.setLineDash([16, 12]); ctx.lineWidth = w + 3 * k; ctx.strokeStyle = `rgba(255,60,50,${.3 + .5 * k})`; ctx.lineCap = 'round';
    len = this.rayRock(len);   // la ligne s'arrête au premier rocher : c'est là que la charge finira
    ctx.beginPath(); ctx.moveTo(this.pos.x, this.pos.y); ctx.lineTo(this.pos.x + this.cd.x * len, this.pos.y + this.cd.y * len); ctx.stroke(); ctx.restore();
  }
  dashRing(ctx, R) {   // cercle pointillé = zone de danger d'une onde de choc
    ctx.save(); ctx.setLineDash([10, 12]); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,90,70,${.3 + .3 * Math.abs(Math.sin(frameCount * .3))})`;
    ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, R, 0, TWO_PI); ctx.stroke(); ctx.restore();
  }
  drawWorld(ctx) {
    if (this.st === 'dead' && this.dying <= 0) return;
    this.drawTele(ctx);
    if (this.st === 'atk' && this.stompWarn && this.n <= 1 && this.sub && this.sub.m === 'go') this.dashRing(ctx, BOSS_STOMP_R);   // dernière charge : zone d'écrasement annoncée
    if (this.st === 'phase' && this.phaseWave > 0) this.dashRing(ctx, 330);   // rugissement de phase : zone annoncée
    if (this.vuln > 0) {                                    // fenêtre de vulnérabilité : anneau doré + « MORDS ! »
      const pu = Math.sin(frameCount * .25);
      ctx.save(); ctx.setLineDash([14, 10]); ctx.lineDashOffset = -frameCount; ctx.lineWidth = 4; ctx.strokeStyle = `rgba(255,220,100,${.6 + .3 * pu})`;
      ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, this.r * 1.55 + 5 * pu, 0, TWO_PI); ctx.stroke(); ctx.restore();
      noStroke(); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(26); fill(255, 226, 110, 230); text('MORDS !', this.pos.x, this.pos.y - this.r * 1.75 - 8 * Math.abs(pu));
    } else if (this.say && this.say.t > 0 && this.dying <= 0) {
      const a = Math.min(1, this.say.t / 20);
      noStroke(); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(24 + 3 * Math.abs(Math.sin(frameCount * .4)));
      fill(0, 140 * a); text(this.say.txt, this.pos.x + 2, this.pos.y - this.r * 1.7 + 2); fill(255, 90, 80, 255 * a); text(this.say.txt, this.pos.x, this.pos.y - this.r * 1.7);
    }
    textStyle(NORMAL);
  }
  light() { }
}

// ---------------------------------------------------------------------
//  🔨 Requin-marteau colossal
// ---------------------------------------------------------------------
class BossHammer extends BossBase {
  constructor(x, y) { super(x, y, { name: 'Marteau', r: 78, speed: 2.5, force: .06, col: '#7f90a3' }, 'Requin-marteau colossal', '🔨'); }
  roam(t) {
    this.maxSpeed = this.sp.speed * (.9 + .15 * this.phase); this.maxForce = this.sp.force;
    this.applyForce(t ? this.pursue(t).mult(.9) : this.wander());
  }
  pick() {
    const p = this.phase, r = random();
    let a = 'charge';
    if (p === 2) a = r < .55 ? 'charge2' : 'charge';
    if (p === 3) a = r < .45 ? 'charge3' : r < .75 ? 'quake' : 'charge2';
    this.n = a === 'charge3' ? 3 : a === 'charge2' ? 2 : 1;
    this.startTele(a, { charge: '⚠ CHARGE !', charge2: '⚠ DOUBLE CHARGE !', charge3: '⚠ TRIPLE CHARGE !', quake: '⚠ SÉISME !' }[a], a === 'quake' ? 70 : 54 - 4 * p);
  }
  tele(t) {
    this.maxSpeed = .35; this.maxForce = .12;
    if (this.atkName === 'quake') return;
    if (t) this.applyForce(this.seek(t.pos).mult(2));
    this.lockAim(t);
  }
  atk(t, dt) {
    if (this.atkName === 'quake') {                         // séisme : deux ondes de choc successives
      const s = this.sub || (this.sub = { t: 0, k: 0 }); s.t += dt; this.maxSpeed = .3;
      if (s.k < 2 && s.t >= 1 + s.k * 45) { s.k++; Boss.wave(this.pos.x, this.pos.y, 420, 100, 34, [255, 190, 90], { src: this, kind: 'quake' }); shake = Math.max(shake, 12); }
      return s.t > 150;   // idem : après la dissipation du dernier anneau
    }
    this.stompWarn = this.phase >= 2;
    return this.chargeStep(t, dt, { k: 4.3, go: 46, wave: this.phase >= 2 });
  }
  circles() {
    const f = this.fwd(), r = this.r, px = -f.y, py = f.x, x = this.pos.x, y = this.pos.y;
    return [[x, y, r * .72], [x + f.x * r * 1.02, y + f.y * r * 1.02, r * .34], [x + f.x * r * 1.02 + px * r * .5, y + f.y * r * 1.02 + py * r * .5, r * .3], [x + f.x * r * 1.02 - px * r * .5, y + f.y * r * 1.02 - py * r * .5, r * .3]];
  }
  body() {
    super.body();
    const ctx = drawingContext, r = this.r, col = this.sp.col;
    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(this.vel.heading()); if (this.vel.x < 0) ctx.scale(1, -1);
    const g = ctx.createLinearGradient(0, -r * .66, 0, r * .66);   // le « marteau » : tête en T, yeux aux extrémités
    g.addColorStop(0, shade(col, -.4)); g.addColorStop(.55, shade(col, 0)); g.addColorStop(1, shade(col, .6));
    ctx.fillStyle = g; ctx.strokeStyle = shade(col, -.6, .6); ctx.lineWidth = Math.max(.7, r * .045);
    ctx.beginPath(); ctx.ellipse(r * 1.04, 0, r * .24, r * .66, 0, 0, TWO_PI); ctx.fill(); ctx.stroke();
    const angry = this.st === 'tele' || this.st === 'atk' || this.st === 'phase';
    for (const s of [-1, 1]) {
      const ex = r * 1.08, ey = s * r * .6;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * .13, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = angry ? '#ff2a2a' : '#000'; ctx.beginPath(); ctx.arc(ex + r * .03, ey, r * .075, 0, TWO_PI); ctx.fill();
    }
    ctx.restore();
    if (this.st === 'atk' && this.sub && this.sub.m === 'go') {   // traînée de vitesse
      const b = this.cd; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(this.pos.x - b.x * r * 1.6 - b.y * i * r * .35, this.pos.y - b.y * r * 1.6 + b.x * i * r * .35); ctx.lineTo(this.pos.x - b.x * r * 3.8 - b.y * i * r * .35, this.pos.y - b.y * r * 3.8 + b.x * i * r * .35); ctx.stroke(); }
      ctx.restore();
    }
  }
  drawTele(ctx) {
    super.drawTele(ctx);
    if (this.st !== 'tele') return;
    if (this.atkName === 'quake') this.dashRing(ctx, 420); else this.dashLine(ctx, 950, 6);
  }
}

// ---------------------------------------------------------------------
//  🐍 Murène géante : se cache (on ne voit que ses yeux), surgit d'en dessous, crache de l'acide
// ---------------------------------------------------------------------
class BossEel extends BossBase {
  constructor(x, y) {
    super(x, y, { name: 'Murène', r: 34, speed: 3.1, force: .12, col: '#6f8f3a' }, 'Murène géante', '🐍');
    this.N = 26; this.SEG = 22; this.vis = 1; this.pts = []; this.hist = [];
    for (let k = 0; k < 160; k++) this.hist.push({ x: x - 7 * k, y });
    this.buildBody();
  }
  harmless() { return super.harmless() || this.st === 'roam'; }    // elle rôde cachée : elle n'attaque pas encore
  roam(t) {
    this.maxSpeed = this.sp.speed * .8; this.maxForce = this.sp.force;
    const goal = t ? createVector(t.pos.x + Math.sin(frameCount * .012) * 320, Math.min(WH * .9, t.pos.y + 240)) : null;   // elle rôde SOUS le joueur
    this.applyForce(goal ? this.arrive(goal, 160) : this.wander());
  }
  pick(t) {
    const p = this.phase, ambush = random() < [.55, .5, .45][p - 1] && this.last !== 'ambush';
    if (ambush) {
      this.n = p === 3 ? 2 : 1;
      this.startTele('ambush', '⚠ EMBUSCADE !', 62);
      const a = random(.18, .82) * PI, d = 440;           // elle se glisse sous la cible, invisible, puis se prépare à bondir
      let x = constrain(t.pos.x + Math.cos(a) * d, 70, WW - 70), y = constrain(t.pos.y + Math.sin(a) * d, WH * .1, WH * .93);
      for (const o of obstacles) { const dx = x - o.pos.x, dy = y - o.pos.y, R = o.r + this.r * 1.2, m = Math.hypot(dx, dy) || 1; if (m < R) { x += dx / m * (R - m); y += dy / m * (R - m); } }   // jamais dans un rocher
      const u = createVector(t.pos.x - x, t.pos.y - y).setMag(1);
      this.pos.set(x, y); this.vel.set(u.x * .4, u.y * .4); this.cd = u.copy(); this.hist = [];
      for (let k = 1; k < 170; k++) this.hist.push({ x: x - u.x * k * 7 - u.y * Math.sin(k * .25) * 26, y: y - u.y * k * 7 + u.x * Math.sin(k * .25) * 26 });
      this.buildBody();
    } else this.startTele('spit', '⚠ CRACHAT !', 44);
  }
  tele(t) {
    this.maxSpeed = .35; this.maxForce = .12;
    if (this.atkName === 'ambush') this.lockAim(t, 16, 14);
    else if (t) this.applyForce(this.seek(t.pos).mult(2));
  }
  atk(t, dt) {
    if (this.atkName === 'ambush') return this.chargeStep(t, dt, { k: 4.4, go: 38, re: 22 });
    const s = this.sub || (this.sub = { t: 0, v: 0 }), V = [1, 1, 2][this.phase - 1], N = [3, 5, 7][this.phase - 1];
    this.maxSpeed = .3; s.t += dt;
    if (s.v < V && s.t >= s.v * 34 + 1) {
      s.v++;
      const base = t ? Math.atan2(t.pos.y - this.pos.y, t.pos.x - this.pos.x) : this.fwd().heading(), sp = .2 + .045 * this.phase;
      for (let i = 0; i < N; i++) Boss.shot(this.pos.x, this.pos.y, base + (N === 1 ? 0 : (i / (N - 1) - .5) * 2 * sp * 2.6), 5.6, { r: 11, life: 170, kind: 'spit', src: this });
      snd.pop(panOf(this.pos.x)); shake = Math.max(shake, 3);
    }
    return s.t > V * 34 + 20 ? 'quick' : false;
  }
  update() {
    super.update();
    const h = this.hist[0];
    if (!h || Math.hypot(h.x - this.pos.x, h.y - this.pos.y) > 4) { this.hist.unshift({ x: this.pos.x, y: this.pos.y }); if (this.hist.length > 360) this.hist.length = 360; }
    this.buildBody();
    const want = this.st === 'roam' ? .14 : this.st === 'tele' && this.atkName === 'ambush' ? .45 : 1;   // invisible quand elle rôde
    this.vis += (want - this.vis) * .08;
  }
  buildBody() {   // points du corps à intervalles réguliers le long de la trajectoire de la tête
    const P = this.pts; P.length = 0; P.push({ x: this.pos.x, y: this.pos.y });
    let px = this.pos.x, py = this.pos.y, acc = 0;
    for (let i = 0; i < this.hist.length && P.length < this.N; i++) {
      const q = this.hist[i], d = Math.hypot(q.x - px, q.y - py); acc += d; px = q.x; py = q.y;
      if (acc >= this.SEG) { P.push({ x: q.x, y: q.y }); acc = 0; }
    }
  }
  circles() {
    const out = [[this.pos.x, this.pos.y, this.r * .95]], n = this.pts.length;
    for (let i = 2; i < n; i += 2) out.push([this.pts[i].x, this.pts[i].y, this.r * (.85 - .55 * i / n)]);
    return out;
  }
  body() {
    const ctx = drawingContext, P = this.pts, n = P.length; if (n < 2) return;
    const a = this.vis, col = this.sp.col, T = frameCount, r = this.r, W = i => r * 1.7 * (1 - .66 * i / n);
    const wob = P.map((p, i) => { const q = P[Math.min(n - 1, i + 1)], o = P[Math.max(0, i - 1)], dx = o.x - q.x, dy = o.y - q.y, m = Math.hypot(dx, dy) || 1, w = Math.sin(T * .11 - i * .55) * r * .1 * (i / n + .25); return [p.x - dy / m * w, p.y + dx / m * w]; });
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    const pass = (wf, style, off = 0) => {
      for (let i = n - 1; i > 0; i--) {
        const A = wob[i], B = wob[i - 1], dx = B[0] - A[0], dy = B[1] - A[1], m = Math.hypot(dx, dy) || 1, ox = -dy / m * off(i), oy = dx / m * off(i);
        ctx.lineWidth = wf(i); ctx.strokeStyle = typeof style === 'function' ? style(i) : style;
        ctx.beginPath(); ctx.moveTo(A[0] + ox, A[1] + oy); ctx.lineTo(B[0] + ox, B[1] + oy); ctx.stroke();
      }
    };
    pass(i => W(i) + 5, 'rgba(10,18,8,.95)', () => 0);
    pass(i => W(i), i => shade(col, i % 2 ? -.04 : .02), () => 0);
    pass(i => W(i) * .38, shade(col, .5, .65), i => -W(i) * .22);
    ctx.fillStyle = 'rgba(250,230,110,.8)';
    for (let i = 2; i < n; i += 2) { ctx.beginPath(); ctx.arc(wob[i][0], wob[i][1], Math.max(2, W(i) * .12), 0, TWO_PI); ctx.fill(); }
    // tête
    const H = wob[0], B = wob[Math.min(2, n - 1)], ang = Math.atan2(H[1] - B[1], H[0] - B[0]), k = r / 13;
    const open = this.st === 'atk' ? .65 : this.st === 'tele' ? .45 : this.vuln > 0 ? .4 : .12, spit = this.atkName === 'spit' && (this.st === 'tele' || this.st === 'atk');
    ctx.translate(H[0], H[1]); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1); ctx.scale(k, k);
    ctx.fillStyle = '#5a0f1c'; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(21, -1); ctx.lineTo(21 * Math.cos(open), 21 * Math.sin(open)); ctx.closePath(); ctx.fill();
    if (spit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,255,120,.55)'; ctx.beginPath(); ctx.arc(19, 3, 9 + 3 * Math.sin(T * .5), 0, TWO_PI); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.rotate(open); ctx.fillStyle = shade(col, -.3); ctx.beginPath(); ctx.ellipse(10, 0, 12, 4.4, 0, 0, TWO_PI); ctx.fill(); ctx.restore();
    ctx.fillStyle = shade(col, -.05); ctx.strokeStyle = 'rgba(10,18,8,.9)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(8, -2, 14, 7.5, 0, 0, TWO_PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); for (let x = 12; x < 22; x += 3.2) { ctx.moveTo(x, 4.2); ctx.lineTo(x + 1.3, 4.2); ctx.lineTo(x + .6, 7.4); } ctx.fill();
    const eye = this.st === 'tele' || this.st === 'atk' || this.st === 'phase' ? '#ff4d3d' : '#ffe14d';
    ctx.globalAlpha = Math.max(a, .8); ctx.shadowBlur = 14; ctx.shadowColor = eye; ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(7, -5.2, 3.4, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }
  drawTele(ctx) {
    if (this.st !== 'tele') return;
    if (this.atkName === 'ambush') this.dashLine(ctx, 720, 6);
    else {                                                   // crachat : cône de tir vers la cible
      const t = this.target; if (!t) return;
      const a = Math.atan2(t.pos.y - this.pos.y, t.pos.x - this.pos.x), s = (.2 + .045 * this.phase) * 2.6;
      ctx.save(); ctx.fillStyle = `rgba(255,70,60,${.1 + .12 * Math.abs(Math.sin(frameCount * .4))})`; ctx.beginPath(); ctx.moveTo(this.pos.x, this.pos.y); ctx.arc(this.pos.x, this.pos.y, 700, a - s, a + s); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  light(add) { const c = this.st === 'tele' || this.st === 'atk' ? [255, 70, 50] : [255, 225, 80]; add(this.pos.x, this.pos.y, 170, c, this.st === 'roam' ? .55 : .9); }
}

// ---------------------------------------------------------------------
//  🐋 Orque géante : sonar (ondes), meute invoquée, éperonnage
// ---------------------------------------------------------------------
class BossOrca extends BossBase {
  constructor(x, y) { super(x, y, { name: 'Orque', r: 88, speed: 2.9, force: .07, col: '#1f2b3a' }, 'Orque géante', '🐋'); this.called = false; }
  minionsAlive() { return Boss.minions.filter(m => !m.dead).length; }
  roam(t) {
    this.maxSpeed = this.sp.speed * (.85 + .12 * this.phase); this.maxForce = this.sp.force;
    this.applyForce(t ? this.pursue(t).mult(.8) : this.wander());
  }
  pick() {
    const p = this.phase, r = random(), alive = this.minionsAlive();
    let a = 'sonar';
    if (!this.called && alive < 4) a = 'summon';
    else if (p === 1) a = r < .65 ? 'sonar' : alive < 3 ? 'summon' : 'sonar';
    else if (p === 2) a = r < .4 ? 'sonar' : r < .7 && alive < 4 ? 'summon' : 'ram';
    else a = r < .4 ? 'sonar' : r < .65 && alive < 4 ? 'summon' : 'ram';
    if (a === 'ram') this.n = p === 3 ? 2 : 1;
    this.startTele(a, { sonar: '⚠ SONAR !', summon: '⚠ LA MEUTE !', ram: '⚠ ÉPERONNAGE !' }[a], a === 'ram' ? 50 : 60);
  }
  tele(t) {
    this.maxSpeed = .35; this.maxForce = .12;
    if (this.atkName === 'ram') { if (t) this.applyForce(this.seek(t.pos).mult(2)); this.lockAim(t); }
  }
  atk(t, dt) {
    if (this.atkName === 'ram') return this.chargeStep(t, dt, { k: 4, go: 44, re: 22, wave: this.phase >= 3 });
    const s = this.sub || (this.sub = { t: 0, k: 0 }); this.maxSpeed = .3; s.t += dt;
    if (this.atkName === 'sonar') {                          // pulsations de sonar : anneaux bleus qui se propagent
      const N = [2, 3, 3][this.phase - 1];
      if (s.k < N && s.t >= 1 + s.k * 45) { s.k++; Boss.wave(this.pos.x, this.pos.y, 480, 100, 30, [120, 200, 255], { src: this, kind: 'sonar' }); snd.flash(); shake = Math.max(shake, 4); }
      return s.t > (N - 1) * 45 + 106;   // la fenêtre de morsure s'ouvre une fois le dernier anneau dissipé
    }
    if (!s.done && s.t >= 10) {                              // invocation : la meute surgit autour du boss
      s.done = true; this.called = true;
      Boss.summon(this, [2, 2, 3][this.phase - 1] - this.minionsAlive());
    }
    return s.t > 50;
  }
  circles() {
    const f = this.fwd(), r = this.r, x = this.pos.x, y = this.pos.y;
    return [[x, y, r * .72], [x + f.x * r * .7, y + f.y * r * .7, r * .5], [x - f.x * r * .75, y - f.y * r * .75, r * .42]];
  }
  body() {
    super.body();
    const ctx = drawingContext, r = this.r, hot = this.st === 'tele' || this.st === 'atk' || this.st === 'phase';
    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(this.vel.heading()); if (this.vel.x < 0) ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(190,200,210,.5)'; ctx.beginPath(); ctx.ellipse(-r * .15, -r * .5, r * .4, r * .16, .15, 0, TWO_PI); ctx.fill();    // selle grise
    ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.beginPath(); ctx.ellipse(r * .6, -r * .3, r * .24, r * .085, -.4, 0, TWO_PI); ctx.fill();   // tache blanche
    ctx.fillStyle = hot ? '#ff2a2a' : '#000'; ctx.beginPath(); ctx.arc(r * .66, -r * .3, r * .06, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }
  drawTele(ctx) {
    super.drawTele(ctx);
    if (this.st !== 'tele') return;
    if (this.atkName === 'ram') this.dashLine(ctx, 950, 6); else if (this.atkName === 'sonar') this.dashRing(ctx, 480);
  }
}

// ---------------------------------------------------------------------
//  🎣 Baudroie géante : leurre qui ATTIRE, lueurs téléguidées, élan
// ---------------------------------------------------------------------
class BossAngler extends BossBase {
  constructor(x, y) { super(x, y, { name: 'Baudroie', r: 84, speed: 1.9, force: .05, col: '#6b3d63' }, 'Baudroie géante', '🎣'); }
  roam(t) {
    this.maxSpeed = this.sp.speed * (.9 + .1 * this.phase); this.maxForce = this.sp.force;
    this.applyForce(t ? this.pursue(t).mult(.7) : this.wander());
  }
  pick() {
    const p = this.phase, pool = p === 1 ? ['lure', 'bolts'] : ['lure', 'bolts', 'dart'], opts = pool.filter(k => k !== this.last), a = random(opts);
    if (a === 'dart') this.n = 1;
    this.startTele(a, { lure: '⚠ LEURRE !', bolts: '⚠ LUEURS !', dart: '⚠ ÉLAN !' }[a], a === 'dart' ? 38 : a === 'lure' ? 56 : 42);
  }
  tele(t) {
    this.maxSpeed = .3; this.maxForce = .1;
    if (this.atkName === 'dart') { if (t) this.applyForce(this.seek(t.pos).mult(2)); this.lockAim(t, 12, 10); }
  }
  atk(t, dt) {
    if (this.atkName === 'dart') return this.chargeStep(t, dt, { k: 3.9, go: 30 });
    const s = this.sub || (this.sub = { t: 0 }); s.t += dt; this.maxSpeed = .25;
    if (this.atkName === 'bolts') {                          // 3 à 5 lueurs lentes qui se rabattent sur le joueur
      if (!s.done && s.t >= 2) {
        s.done = true; const [lx, ly] = this.lurePos(), N = 2 + this.phase, base = this.fwd().heading();
        for (let i = 0; i < N; i++) Boss.shot(lx, ly, base + (i / (N - 1) - .5) * 1.5, 3.2, { r: 13, life: 250, kind: 'orb', home: .07, src: this });
        snd.chirp(panOf(lx)); shake = Math.max(shake, 3);
      }
      return s.t > 36 ? 'quick' : false;
    }
    // leurre : aspire tout le monde vers la gueule pendant plusieurs secondes (le sprint permet de résister)
    const dur = [150, 170, 190][this.phase - 1], pull = (Boss.lurePull || [.25, .3, .4])[this.phase - 1];   // force d'attraction (réglée par mesure, voir tests de nage/sprint)
    for (const f of [player, ...followers]) {
      if (Abil.hidden(f)) continue;
      const dx = this.pos.x - f.pos.x, dy = this.pos.y - f.pos.y, d = Math.hypot(dx, dy) || 1;
      if (d < 1300 && d > this.r * .7) f.applyForce(createVector(dx / d, dy / d).mult(pull * (d > 900 ? .6 : 1)));
    }
    this.bite = 7;                                           // gueule grande ouverte
    if (s.t >= dur) { snd.snap(panOf(this.pos.x)); this.bite = 14; Boss.wave(this.pos.x, this.pos.y, 240, 36, 40, [255, 230, 120], { src: this, kind: 'chomp' }); shake = Math.max(shake, 10); return true; }
    return false;
  }
  circles() {
    const f = this.fwd(), r = this.r, x = this.pos.x, y = this.pos.y;
    return [[x, y, r * .74], [x + f.x * r * .62, y + f.y * r * .62, r * .5]];
  }
  drawTele(ctx) {
    super.drawTele(ctx);
    const T = frameCount, [lx, ly] = this.lurePos();
    if (this.st === 'tele' && this.atkName === 'dart') this.dashLine(ctx, 800, 6);
    if (this.st === 'atk' && this.atkName === 'lure') {      // lueurs qui convergent vers la gueule
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 22; k++) {
        const u = ((T * .018 + k / 22) % 1), a = k * 2.399, R = 120 + 560 * (1 - u), x = this.pos.x + Math.cos(a) * R, y = this.pos.y + Math.sin(a) * R * .75;
        ctx.fillStyle = `rgba(255,235,130,${.65 * u})`; ctx.beginPath(); ctx.arc(x, y, 2 + 3 * u, 0, TWO_PI); ctx.fill();
      }
      ctx.restore();
    }
    if (this.st === 'tele' && this.atkName === 'lure') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 160); g.addColorStop(0, 'rgba(255,240,150,.7)'); g.addColorStop(1, 'rgba(255,240,150,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 160, ly - 160, 320, 320); ctx.restore(); }
  }
  light(add) {
    const [lx, ly] = this.lurePos(), pull = this.st === 'atk' && this.atkName === 'lure';
    add(lx, ly, pull ? 330 : 240, [255, 245, 150], pull ? 1.15 : 1);
    if (this.st === 'tele' || this.st === 'atk') add(this.pos.x, this.pos.y, 210, [255, 90, 70], .6);   // on voit le boss pendant ses attaques
  }
}

// ---------------------------------------------------------------------
//  🦈 Mégalodon : charges en série + rugissements
// ---------------------------------------------------------------------
class BossMega extends BossBase {
  constructor(x, y) { super(x, y, { name: 'Requin', r: 122, speed: 3.1, force: .055, col: '#4d5b69' }, 'Mégalodon', '🦈'); }
  roam(t) {
    this.maxSpeed = this.sp.speed * (.85 + .12 * this.phase); this.maxForce = this.sp.force;
    this.applyForce(t ? this.pursue(t).mult(.9) : this.wander());
  }
  pick() {
    const p = this.phase, r = random();
    let a = 'charge';
    if (p === 1) a = r < .65 ? 'charge' : 'roar';
    else if (p === 2) a = r < .5 ? 'charge2' : 'roar';
    else a = r < .5 ? 'charge3' : 'roar';
    if (a === this.last && a !== 'charge') a = p === 1 ? 'charge' : p === 2 ? 'charge2' : 'charge3';
    this.n = a === 'charge3' ? 3 : a === 'charge2' ? 2 : 1;
    this.startTele(a, { charge: '⚠ CHARGE !', charge2: '⚠ DOUBLE CHARGE !', charge3: '⚠ TRIPLE CHARGE !', roar: '⚠ RUGISSEMENT !' }[a], a === 'roar' ? 58 : 56 - 4 * p);
  }
  tele(t) {
    this.maxSpeed = .35; this.maxForce = .12;
    if (this.atkName !== 'roar') { if (t) this.applyForce(this.seek(t.pos).mult(2)); this.lockAim(t, 8, 22); }   // visée figée 22 images avant la charge : assez pour un sprint latéral
    else this.bite = 7;
  }
  atk(t, dt) {
    if (this.sub && this.sub.m) return this.chargeStep(t, dt, { k: 3.6, go: 52, re: 34, lock: 18 });
    if (this.atkName !== 'roar') return this.chargeStep(t, dt, { k: 3.6, go: 52, re: 34, lock: 18 });
    const s = this.sub || (this.sub = { t: 0, k: 0 }), N = 1 + this.phase; this.maxSpeed = .3; this.bite = 7; s.t += dt;
    if (s.k < N && s.t >= 1 + s.k * 40) { s.k++; Boss.wave(this.pos.x, this.pos.y, 600, 120, 40, [255, 90, 70], { src: this, kind: 'roar' }); snd.event('storm'); shake = Math.max(shake, 10); }
    if (s.t > (N - 1) * 40 + 126) {
      if (this.phase === 3 && t) { this.n = 1; this.cd = p5.Vector.sub(this.aim(t, 14), this.pos).setMag(1); this.sub = { m: 'go', t: 50 }; this.announce('⚠ CHARGE !', 50); }   // phase 3 : il enchaîne
      else return true;
    }
    return false;
  }
  circles() {
    const f = this.fwd(), r = this.r, x = this.pos.x, y = this.pos.y;
    return [[x, y, r * .68], [x + f.x * r * .55, y + f.y * r * .55, r * .55], [x + f.x * r * 1.0, y + f.y * r * 1.0, r * .35]];
  }
  body() {
    super.body();
    const ctx = drawingContext, r = this.r, hot = this.st === 'tele' || this.st === 'atk' || this.st === 'phase';
    ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(this.vel.heading()); if (this.vel.x < 0) ctx.scale(1, -1);
    ctx.strokeStyle = 'rgba(210,225,235,.25)'; ctx.lineWidth = Math.max(1.5, r * .02);                     // vieilles cicatrices
    for (const [x, y] of [[.1, -.28], [-.25, -.1], [.35, .12]]) { ctx.beginPath(); ctx.moveTo(r * x, r * y); ctx.lineTo(r * (x - .16), r * (y + .1)); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 20; ctx.shadowColor = '#ff2a2a'; ctx.fillStyle = hot ? 'rgba(255,60,50,.9)' : 'rgba(255,90,60,.45)';
    ctx.beginPath(); ctx.arc(r * .68, -r * .16 * .88, r * .1, 0, TWO_PI); ctx.fill();                      // œil rouge
    ctx.restore();
    if (this.st === 'atk' && this.sub && this.sub.m === 'go') {
      const b = this.cd; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 4;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(this.pos.x - b.x * r * 1.5 - b.y * i * r * .3, this.pos.y - b.y * r * 1.5 + b.x * i * r * .3); ctx.lineTo(this.pos.x - b.x * r * 3.2 - b.y * i * r * .3, this.pos.y - b.y * r * 3.2 + b.x * i * r * .3); ctx.stroke(); }
      ctx.restore();
    }
  }
  drawTele(ctx) {
    super.drawTele(ctx);
    if (this.st !== 'tele') return;
    if (this.atkName === 'roar') this.dashRing(ctx, 600); else this.dashLine(ctx, 1000, 8);
  }
  light(add) { if (this.st === 'tele' || this.st === 'atk' || this.st === 'phase') add(this.pos.x, this.pos.y, 260, [255, 70, 50], .7); else add(this.pos.x, this.pos.y, 140, [255, 80, 60], .3); }
}

// =====================================================================
//  Boss : gestionnaire (liste, projectiles, ondes de choc, bonus, interface)
// =====================================================================
const Boss = {
  list: [], projs: [], waves: [], alerts: [], minions: [], pupT: 0,

  reset() { this.list = []; this.projs = []; this.waves = []; this.alerts = []; this.minions = []; this.pupT = 0; },
  main() { return this.list[0] || null; },

  // Apparition du boss du stage i (appelé par Stage quand les objectifs sont remplis)
  spawn(i) {
    const Cl = [BossHammer, BossEel, BossOrca, BossAngler, BossMega][i]; if (!Cl) return;
    const side = random() < .5 ? -1 : 1, x = constrain(player.pos.x + side * random(750, 1000), 200, WW - 200), y = constrain(player.pos.y + random(-150, 150), WH * .14, WH * .78);
    const b = new Cl(x, y); wild.push(b); this.list.push(b);
    Stage.calm = i >= 1 && i <= 3 ? 0 : .4;                     // moins de prédateurs ordinaires pendant le combat (aucun au cimetière : l'orque et sa meute suffisent)
    this.alert('⚠  BOSS  ⚠', b.bossName, 190);
    snd.event('erupt'); snd.growl(panOf(x), 1); shake = Math.max(shake, 9);
    this.givePups(1);
  },

  alert(txt, sub, t = 150, col = '#ff6b6b') { this.alerts.push({ txt, sub, t, max: t, col }); },

  // Onde de choc : anneau qui grandit ; touche une fois chaque poisson de l'équipe pris dans l'anneau
  wave(x, y, R, dur, th, c, o = {}) { this.waves.push({ x, y, R, dur, th, c, t: 0, hit: new Set(), src: o.src, kind: o.kind || 'shock' }); if (vis({ pos: { x, y } }, 400)) snd.slap(panOf(x)); },
  // Projectile : crachat d'acide ('spit') ou lueur téléguidée ('orb')
  shot(x, y, ang, spd, o = {}) { this.projs.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: o.r || 11, life: o.life || 160, kind: o.kind || 'spit', home: o.home || 0, src: o.src, ph: random(TWO_PI) }); },

  // Meute d'orques invoquée (disparaît avec le boss ou au bout de ~18 s)
  summon(b, n) {
    n = Math.max(0, Math.min(4, n)); if (!n) return;
    const pk = [];
    for (let i = 0; i < n; i++) {
      const a = TWO_PI * i / n, o = new Orca(b.pos.x + Math.cos(a) * b.r * 1.3, b.pos.y + Math.sin(a) * b.r * 1.3, pk, a);
      o.sp = BOSS_MINI; o.r = BOSS_MINI.r; o.maxSpeed = BOSS_MINI.speed; o.maxForce = BOSS_MINI.force; o.minion = true; o.life = 800; o.stun = BOSS_MINI_GRACE;
      wild.push(o); this.minions.push(o); bubblesAt(o.pos);
    }
    snd.event('whirl'); shake = Math.max(shake, 8); floatText(b.pos.x, b.pos.y - b.r * 1.4, '🐋 La meute !', '#9fd8ff');
  },
  clearMinions() { for (const m of this.minions) { m.dead = true; const i = wild.indexOf(m); if (i >= 0) wild.splice(i, 1); bubblesAt(m.pos); } this.minions = []; },

  // Bonus pendant le combat : frénésie 🔥, vie ❤, bouclier 🛡 (tombent du haut de l'écran comme les autres)
  givePups(n) {
    for (let i = 0; i < n; i++) {
      const pool = lives <= 2 ? ['heal', 'heal', 'shield', 'frenzy'] : lives >= 5 ? ['frenzy', 'shield', 'frenzy'] : ['frenzy', 'shield', 'heal', 'frenzy'];
      pups.push({ x: constrain(cam.x + random(80, width - 80), 40, WW - 40), y: cam.y - 20 - i * 80, t: random(pool), ph: random(TWO_PI) });
    }
  },

  // Dégâts subis par un poisson de l'équipe (joueur : une vie ; banc : le poisson disparaît)
  hurtTeam(f, src, push = 30) {
    if (fx.shield || fx.frenzy) return false;           // bouclier / frénésie : toute l'équipe est protégée
    if (f === player) {
      if (inv) return false;
      lives--; killer = src; inv = 90; shake = 14; combo = 0; snd.hurt(panOf(src.pos.x)); bubblesAt(f.pos); Chase.onBite(src); src.bite = 14;
      const a = createVector(f.pos.x - src.pos.x, f.pos.y - src.pos.y); if (a.mag() < 1) a.set(1, 0); f.pos.add(a.setMag(push));
      return true;
    }
    const k = followers.indexOf(f); if (k >= 0) { followers.splice(k, 1); bubblesAt(f.pos); snd.lose(panOf(f.pos.x)); }
    return true;
  },

  onDeath(b) {
    this.clearMinions(); this.projs = []; this.waves = [];
    this.alerts = []; this.alert('BOSS VAINCU !', b.bossName, 200, '#7dffb3');
    snd.level(); shake = 16; Eco.bonus(b.pos.x, b.pos.y, 26, 3 + Stage.cur);
    floatText(b.pos.x, b.pos.y - b.r, '💀', '#ffffff');
  },
  bonusScore() { return 600 + 300 * Stage.cur; },

  // ---------------- Une image de simulation (appelé depuis step() dans sketch.js) ----------------
  step() {
    if (!Stage.on() || state !== 'play') return;
    if (!this.list.length && !this.projs.length && !this.waves.length && !this.alerts.length) return;
    const team = [player, ...followers];
    for (const a of this.alerts) a.t--; this.alerts = this.alerts.filter(a => a.t > 0);
    for (const b of this.list) {
      if (!vis(b, 1300)) { b.think(Abil.sightFor(b, Abil.targets(team)), [], []); b.update(); }   // loin de l'écran, le jeu ne le simule pas : on le fait ici
      b.contact(team);
    }
    // meute : durée de vie
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      if (m.dead || --m.life <= 0) { m.dead = true; const k = wild.indexOf(m); if (k >= 0) wild.splice(k, 1); bubblesAt(m.pos); this.minions.splice(i, 1); }
    }
    this.stepProjs(team); this.stepWaves(team);
    const b = this.main();
    if (b && b.dying <= 0 && b.st !== 'dead') { if (++this.pupT > 780) { this.pupT = 0; if (pups.length < 3) this.givePups(1); } }
    // mort : explosion de bulles, puis le stage est gagné
    if (b && b.dying > 0) {
      if (--b.dying % 5 === 0) bubblesAt({ x: b.pos.x + random(-b.r, b.r), y: b.pos.y + random(-b.r * .5, b.r * .5) });
      if (b.dying % 16 === 0) { shake = Math.max(shake, 7); snd.pop(panOf(b.pos.x)); }
      if (b.dying <= 0) {
        b.dead = true; const k = wild.indexOf(b); if (k >= 0) wild.splice(k, 1); this.list = [];
        Eco.bonus(b.pos.x, b.pos.y, 10, 1);
        this.alerts = []; Stage.win(this.bonusScore());
      }
    }
  },

  stepProjs(team) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; let dead = --p.life <= 0;
      if (p.home && player) {
        const dx = player.pos.x - p.x, dy = player.pos.y - p.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(p.vx, p.vy), nx = p.vx + dx / d * p.home * TS, ny = p.vy + dy / d * p.home * TS, m = Math.hypot(nx, ny) || 1;
        p.vx = nx / m * sp; p.vy = ny / m * sp;
      }
      p.x += p.vx * TS; p.y += p.vy * TS;
      if (p.x < -60 || p.x > WW + 60 || p.y < -60 || p.y > WH + 60) dead = true;
      if (!dead) for (const o of obstacles) { if (Math.abs(o.pos.x - p.x) < o.r + 20 && Math.abs(o.pos.y - p.y) < o.r + 20 && Math.hypot(o.pos.x - p.x, o.pos.y - p.y) < o.r + p.r * .5) { dead = true; break; } }   // les rochers font écran
      if (!dead) for (const f of team) {
        if (!f || Abil.hidden(f) || Math.hypot(f.pos.x - p.x, f.pos.y - p.y) > p.r + f.r * .6) continue;
        if (f === player && inv && !fx.shield && !fx.frenzy) continue;            // invincible : le projectile passe
        if (f === player && (fx.shield || fx.frenzy)) { snd.pop(panOf(p.x)); dead = true; break; }   // absorbé
        this.hurtTeam(f, p.src || this.main() || player, 14); dead = true; break;
      }
      if (dead) { bubblesAt({ x: p.x, y: p.y }); this.projs.splice(i, 1); }
    }
  },
  stepWaves(team) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]; w.t += TS; const rad = w.R * w.t / w.dur;
      for (const f of team) {
        if (!f || w.hit.has(f) || Abil.hidden(f)) continue;
        const d = Math.hypot(f.pos.x - w.x, f.pos.y - w.y);
        if (d <= rad + f.r * .25 && d >= rad - w.th - f.r * .25) {   // bande qui suit le front visible de l'anneau : on n'est touché qu'une fois le front passé sur soi
          w.hit.add(f);
          if (this.hurtTeam(f, w.src || this.main() || player, 34) && f === player && w.kind === 'roar') energy = Math.max(0, energy - 25);   // le rugissement vide le sprint
        }
      }
      if (w.t >= w.dur) this.waves.splice(i, 1);
    }
  },

  // ---------------- Lumières (obscurité de la grotte / des abysses) ----------------
  lights(add, near) {
    for (const b of this.list) if (b.dying <= 0 && near(b.pos.x, b.pos.y)) b.light(add);
    for (const p of this.projs) if (near(p.x, p.y)) add(p.x, p.y, 95, p.kind === 'orb' ? [255, 235, 120] : [120, 255, 130], .75);
  },

  // ---------------- Dessin dans le monde (par-dessus les poissons) ----------------
  drawWorld() {
    if (!this.list.length && !this.projs.length && !this.waves.length) return;
    const ctx = drawingContext;
    for (const w of this.waves) {
      const p = w.t / w.dur, rad = w.R * p, al = 1 - p * .75, c = w.c.join(',');
      ctx.save();
      if (w.kind === 'sonar' || w.kind === 'chomp') { const g = ctx.createRadialGradient(w.x, w.y, Math.max(0, rad - 90), w.x, w.y, rad + 4); g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},${.28 * al})`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, rad + 4, 0, TWO_PI); ctx.fill(); }
      ctx.shadowBlur = 16; ctx.shadowColor = `rgb(${c})`;
      ctx.strokeStyle = `rgba(${c},${.8 * al})`; ctx.lineWidth = w.th * .55; ctx.beginPath(); ctx.arc(w.x, w.y, rad, 0, TWO_PI); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(255,255,255,${.6 * al})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w.x, w.y, rad, 0, TWO_PI); ctx.stroke();
      ctx.restore();
    }
    for (const p of this.projs) {
      const orb = p.kind === 'orb', R = p.r * (orb ? 3.2 : 2.6) * (1 + .12 * Math.sin(frameCount * .3 + p.ph)), c = orb ? '255,235,120' : '120,255,120';
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R); g.addColorStop(0, `rgba(${c},.9)`); g.addColorStop(.4, `rgba(${c},.35)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2); ctx.restore();
      ctx.fillStyle = orb ? '#fffbd0' : '#d9ffd0'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .55, 0, TWO_PI); ctx.fill();
    }
    for (const b of this.list) b.drawWorld(ctx);
  },

  // ---------------- Interface : barre de vie du boss + bandeaux ----------------
  hud() {
    if (!Stage.on() || state === 'title' || state === 'select') return;
    const b = this.main();
    push(); noStroke();
    if (b && state !== 'win') {
      const x0 = Math.max(335, (width - 560) / 2), w = Math.min(560, width - x0 - 60), x = x0, y = 14, h = 62, p = b.hp / b.maxHp;
      if (w > 160) {
        glassPanel(x, y, w, h, 16);
        textAlign(LEFT, CENTER); textStyle(BOLD); textSize(13); noStroke(); fill(255, 220, 220); text(`${b.icon}  ${b.bossName.toUpperCase()}`, x + 16, y + 17);
        textAlign(RIGHT, CENTER); textSize(11); fill(255, 255, 255, 170); text(`PHASE ${b.phase} / 3`, x + w - 16, y + 17);
        const bx = x + 16, bw = w - 32, by = y + 31, bh = 12;
        noStroke(); fill(255, 255, 255, 70); rect(bx, by, Math.max(bh, bw * constrain(b.gp / b.maxHp, 0, 1)), bh, bh / 2);   // dégâts récents
        gradBar(bx, by, bw, bh, p, '#ff3b3b', b.hitFlash > 0 ? '#ffffff' : '#ff9a3c');
        stroke(0, 0, 0, 150); strokeWeight(1.5); line(bx + bw * .33, by, bx + bw * .33, by + bh); line(bx + bw * .66, by, bx + bw * .66, by + bh); noStroke();
        textAlign(CENTER, CENTER); textSize(12);
        if (b.dying > 0) { fill(125, 255, 179, 230); text('💀 TERRASSÉ !', x + w / 2, y + h - 11); }
        else if (b.vuln > 0) { fill(255, 224, 120, 200 + 55 * Math.sin(frameCount * .3)); text(`✨ VULNÉRABLE — MORDS-LE !  ${Math.ceil(b.vuln / 60)} s`, x + w / 2, y + h - 11); }
        else if (b.say && b.say.t > 0) { fill(255, 110, 100, 190 + 65 * Math.sin(frameCount * .5)); text(b.say.txt, x + w / 2, y + h - 11); }
        else { fill(255, 255, 255, 120); textStyle(NORMAL); text('Esquive ses attaques : il est exposé juste après', x + w / 2, y + h - 11); }
      }
    }
    // bandeaux centraux (apparition, changement de phase, victoire)
    if (state === 'play') this.alerts.forEach((a, k) => {
      const al = constrain(Math.min(a.t / 30, (a.max - a.t) / 14), 0, 1), cy = height * .3 + k * 70;
      textAlign(CENTER, CENTER); textStyle(BOLD); drawingContext.shadowBlur = 26; drawingContext.shadowColor = a.col;
      const c = color(a.col); textSize(min(52, width * .08)); fill(red(c), green(c), blue(c), 255 * al); text(a.txt, width / 2, cy);
      drawingContext.shadowBlur = 0; textSize(min(24, width * .045)); fill(255, 255, 255, 240 * al); text(a.sub, width / 2, cy + 44);
    });
    textStyle(NORMAL); pop();
  },

  // Mini-carte : le boss est toujours visible (anneau pulsant)
  mini(sx, sy) {
    for (const b of this.list) {
      if (b.dying > 0) continue;
      const k = 1 + .3 * Math.sin(frameCount * .2);
      noStroke(); fill(255, 60, 60); circle(b.pos.x * sx, b.pos.y * sy, 8 * k);
      noFill(); stroke(255, 120, 120, 200); strokeWeight(1.5); circle(b.pos.x * sx, b.pos.y * sy, 15 * k); strokeWeight(1); noStroke();
    }
    fill(255, 150, 60); for (const m of this.minions) circle(m.pos.x * sx, m.pos.y * sy, 4);
  },
};

// Branchement sur le mode Stages + test rapide (?stage=N&boss=1)
Stage.hooks.spawnBoss = () => Boss.spawn(Stage.cur);
{
  const begin = Stage.begin;
  Stage.begin = () => {
    begin(); Boss.reset();
    if (new URLSearchParams(location.search).get('boss')) { for (const o of Stage.objs) o.done = true; Stage.phase = 'boss'; Boss.spawn(Stage.cur); }
  };
}
