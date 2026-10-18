// Poisson doré : rare, très rapide, fuit le joueur. Vaut 150 points.
class GoldFish extends Fish {
  constructor(x, y) { super(x, y, { r: 8, speed: 4.6, force: 0.35, col: '#ffd700', glow: true, shiny: true }); this.life = 700; }
  think(team, obs) {
    let near = team[0];
    for (const t of team) if (t.pos.dist(this.pos) < near.pos.dist(this.pos)) near = t;
    this.applyForce(this.pos.dist(near.pos) < 300 ? this.evade(near).mult(2) : this.wander());
    this.applyForce(this.avoid(obs).mult(P.avoidW));
    this.applyForce(this.bounds(0, 0, WW, WH, 80));
    this.life--;
  }
  show() { super.show(true); }
}
