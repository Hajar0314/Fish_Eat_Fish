// Échelle de temps du monde (1 = normal ; < 1 pendant le bonus « ralenti »). Le joueur et son banc ne sont pas ralentis.
let TS = 1;
// Base Vehicle du jeu (nouveau fichier, ne touche à aucun vehicle.js existant)
class Vehicle {
  constructor(x, y, r = 10) {
    this.pos = createVector(x, y); this.vel = p5.Vector.random2D(); this.acc = createVector();
    this.r = r; this.maxSpeed = 3; this.maxForce = 0.1; this.lookAhead = 50; this.wt = 0;
  }
  applyForce(f) { this.acc.add(f); }
  steer(d, s = this.maxSpeed) { return d.setMag(s).sub(this.vel).limit(this.maxForce); }
  seek(t) { return this.steer(p5.Vector.sub(t, this.pos)); }
  flee(t) { return this.seek(t).mult(-1); }
  arrive(t, d = 100) {
    const v = p5.Vector.sub(t, this.pos), m = v.mag();
    return this.steer(v, m < d ? map(m, 0, d, 0, this.maxSpeed) : this.maxSpeed);
  }
  pursue(o) { return this.seek(p5.Vector.add(o.pos, o.vel.copy().mult(10))); }
  evade(o) { return this.pursue(o).mult(-1); }
  wander() {
    this.wt = this.wt * 0.95 + random(-0.35, 0.35);
    const h = this.vel.heading() + this.wt;
    const c = this.vel.copy().setMag(60).add(this.pos);
    return this.seek(createVector(c.x + 30 * cos(h), c.y + 30 * sin(h)));
  }
  separate(list, dist) {
    const s = createVector(); let n = 0;
    for (const o of list) {
      const d = this.pos.dist(o.pos);
      if (o !== this && d < dist && d > 0) { s.add(p5.Vector.sub(this.pos, o.pos).div(d * d)); n++; }
    }
    return n ? this.steer(s) : s;
  }
  align(list, dist = 60) {
    const s = createVector(); let n = 0;
    for (const o of list) if (o !== this && this.pos.dist(o.pos) < dist) { s.add(o.vel); n++; }
    return n ? this.steer(s) : s;
  }
  cohesion(list, dist = 80) {
    const s = createVector(); let n = 0;
    for (const o of list) if (o !== this && this.pos.dist(o.pos) < dist) { s.add(o.pos); n++; }
    return n ? this.seek(s.div(n)) : s;
  }
  // Obstacle avoidance : 2 points "ahead", on fuit l'obstacle le plus menaçant
  avoid(obs) {
    const px = this.pos.x, py = this.pos.y, vm = Math.hypot(this.vel.x, this.vel.y) || 1, ux = this.vel.x / vm, uy = this.vel.y / vm, la = this.lookAhead;
    const a1 = this.a1 || (this.a1 = createVector()), a2 = this.a2 || (this.a2 = createVector());   // réutilisés (le debug les lit)
    a1.set(px + ux * la, py + uy * la); a2.set(px + ux * la / 2, py + uy * la / 2);
    let best = null, bd = 1e12;
    for (const o of obs) {
      const ox = o.pos.x, oy = o.pos.y, reach = o.r + this.r;
      if (Math.abs(ox - px) > la + reach || Math.abs(oy - py) > la + reach) continue;   // trop loin : aucun des 3 points ne peut toucher
      const d0 = (ox - px) ** 2 + (oy - py) ** 2, d1 = (ox - a1.x) ** 2 + (oy - a1.y) ** 2, d2 = (ox - a2.x) ** 2 + (oy - a2.y) ** 2, k = Math.min(d0, d1, d2);
      if (k < reach * reach && k < bd) { bd = k; best = o; }
    }
    if (!best) return (Opt.zero || (Opt.zero = createVector())).set(0, 0);
    return this.steer(p5.Vector.sub(a1, best.pos)).mult(2.5);
  }
  // Ajoute à acc une force « vers (dx,dy) » à la manière de steer(), sans créer de vecteur
  steerXY(dx, dy, w) {
    const m = Math.hypot(dx, dy), s = m ? this.maxSpeed / m : 0;
    let fx = dx * s - this.vel.x, fy = dy * s - this.vel.y; const l = Math.hypot(fx, fy);
    if (l > this.maxForce) { fx *= this.maxForce / l; fy *= this.maxForce / l; }
    this.acc.x += fx * w; this.acc.y += fy * w;
  }
  // Leader following : arrive derrière le leader, dégage sa trajectoire, sépare le groupe
  followLeader(leader, group, behind = 45) {
    const u = leader.vel.copy().setMag(1);
    const back = u.copy().mult(-behind).add(leader.pos), front = u.copy().mult(behind * 1.2).add(leader.pos);
    const f = this.arrive(back, 70);
    if (this.pos.dist(front) < behind * 0.8 || this.pos.dist(leader.pos) < behind * 0.5) f.add(this.evade(leader).mult(1.5));
    return f.add(this.separate(group, this.r * 3).mult(P.sepW));
  }
  bounds(x0, y0, x1, y1, m = 60) {
    const d = createVector();
    if (this.pos.x < x0 + m) d.x = this.maxSpeed; else if (this.pos.x > x1 - m) d.x = -this.maxSpeed;
    if (this.pos.y < y0 + m) d.y = this.maxSpeed; else if (this.pos.y > y1 - m) d.y = -this.maxSpeed;
    return d.mag() ? this.steer(d).mult(2) : d;
  }
  update() {
    if (P.debug) this.fa = this.acc.copy();   // uniquement pour l'affichage debug (évite une copie par poisson et par image)
    if (this.stun > 0) { this.acc.mult(0); this.vel.mult(.9); }   // étourdi (coup de queue du thon, piqûre d'anémone) : plus de poussée, il dérive
    this.vel.add(this.acc).limit(this.maxSpeed);
    const k = this.noSlow ? 1 : TS; this.pos.x += this.vel.x * k; this.pos.y += this.vel.y * k; this.acc.mult(0);
    if (this.bite > 0) this.bite--;   // animation de la bouche (voir Fish.show)
  }
}
