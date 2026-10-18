// =====================================================================
//  grid.js — optimisation : grille spatiale (spatial hash) + utilitaires de performance
//
//  Avant : chaque proie comparait sa position à TOUTES les autres (n² paires : 500 proies visibles
//  = 250 000 tests par image, chacun avec création de vecteurs p5).
//  Maintenant : le monde est découpé en cases de 80 px ; une proie ne regarde que sa case et les 8
//  voisines (quelques voisins au lieu de centaines) et les calculs se font sans créer d'objets.
// =====================================================================
class Grid {
  constructor(cell = 80) { this.cs = cell; this.m = new Map(); this.free = []; }
  clear() { for (const a of this.m.values()) { a.length = 0; this.free.push(a); } this.m.clear(); }
  key(cx, cy) { return (cx + 64) * 4096 + (cy + 64); }
  add(o) {
    const k = this.key(Math.floor(o.pos.x / this.cs), Math.floor(o.pos.y / this.cs));
    let a = this.m.get(k); if (!a) { a = this.free.pop() || []; this.m.set(k, a); }
    a.push(o);
  }
}

const Opt = {
  grid: new Grid(80),     // grille des proies de la frame
  vents: null,            // sources hydrothermales proches de l'écran (calculé une fois par image)
  crowd: 0,               // nombre de proies à l'écran : au-dessus de 90, dessin simplifié (voir Fish.show)
  CROWD: 90,
  FAR: 250,               // au-delà de cette marge hors écran, le banc ne recalcule son flocking qu'1 image sur 3
  zero: null,
};
