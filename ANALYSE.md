# 📐 Analyse approfondie des schémas et des tableaux

### Projet *Fish Eat Fish — Deep Sea* — document complémentaire du README

| | |
|---|---|
| **Réalisé par** | **HAJAR BELHACHMI** |
| **Formation** | Master IA2 — Université Côte d'Azur |
| **Année universitaire** | 2026 / 2027 |

---

## Comment lire ce document

Le `README.md` présente le projet à travers des **schémas** (hiérarchie de classes, boucle de simulation, machines à états) et des **tableaux** (comportements, prédateurs, apprentissage, stages, optimisations). Ce document les **reprend un par un** et, pour chacun, répond à quatre questions :

1. **Ce que montre** le schéma ou le tableau ;
2. **Lecture détaillée** : signification de chaque élément ;
3. **Exemple chiffré** tiré du code (les valeurs viennent des fichiers du projet) ;
4. **Pourquoi ce choix** : l'intérêt de conception.

Les durées sont données à **60 images par seconde** (1 s = 60 images). Les distances sont en **pixels**.

**Sommaire**

- A. [Architecture : hiérarchie des classes et boucle de simulation](#a-architecture)
- B. [Le moteur de steering behaviors](#b-le-moteur-de-steering-behaviors)
- C. [Les entités : proies, prédateurs, machines à états](#c-les-entités)
- D. [L'apprentissage](#d-lapprentissage)
- E. [Le jeu : espèces, évolution, boss, stages](#e-le-jeu)
- F. [Les optimisations](#f-les-optimisations)
- G. [Le mode debug et le protocole de démonstration](#g-debug-et-démonstration)
- H. [Synthèse](#h-synthèse)

---

# A. Architecture

## A.1 Schéma : la hiérarchie des classes

```
Vehicle  → steering behaviors + intégration du mouvement
   └── Fish  → rendu
         ├── Player, Follower
         ├── Prey, NightFish, GoldFish
         ├── Critter
         ├── Decoy
         └── Predator
               ├── Squid
               └── Hunter
                     ├── HammerShark, Moray, Barracuda, Orca
                     └── BossBase → BossHammer / BossEel / BossOrca / BossAngler / BossMega
```

### Ce que montre ce schéma
Un **arbre d'héritage** à trois niveaux de responsabilité : *se déplacer* (`Vehicle`), *se dessiner* (`Fish`), *décider* (toutes les classes feuilles).

### Lecture détaillée

| Niveau | Classe | Responsabilité unique | Fichier |
|---|---|---|---|
| 1 | `Vehicle` | Calculer des forces (`seek`, `flee`…) et intégrer `vel` et `pos` | `vehicle.js` |
| 2 | `Fish` | Dessiner : corps, écailles, nageoires, bouche, lueur | `entities.js` |
| 3 | `Player`, `Prey`, `Predator`… | Choisir **quelles forces** appliquer dans `think()` | `entities.js`, `predators.js`, `ecosystem.js` |
| 4 | `Hunter` | Ajouter ce que partagent les prédateurs spéciaux : `scan` (verrouillage), `base` (évitement + bornes), `shared` (cible partagée) | `predators.js` |
| 5 | `BossBase` | Ajouter barre de vie, phases, télégraphie, vulnérabilité | `boss.js` |

Trois observations sur le schéma :

- **`Jellyfish` n'est pas sous `Fish`** : c'est un `Vehicle` direct (`class Jellyfish extends Vehicle`). Une méduse est un *obstacle mobile* : elle se déplace et dérive, mais ne se dessine pas comme un poisson et n'a ni bouche ni nageoires.
- **`Squid` est sous `Predator`**, pas sous `Hunter` : il réutilise la chasse persistante de `Predator.think()` puis lui superpose un *dash*.
- **`Decoy` (leurre) est un `Fish`** : il peut ainsi être dessiné comme un poisson et poursuivi comme une cible, sans code spécial côté prédateur.

### Exemple chiffré
Le prédateur de base ne contient que **~20 lignes** de logique (`Predator.think`), alors qu'il chasse, mord, évite les rochers et respecte une profondeur. C'est possible parce que toute la mécanique de mouvement est héritée.

### Pourquoi ce choix
- **Polymorphisme** : la boucle `step()` appelle `.think()` et `.update()` sur toutes les entités sans connaître leur type.
- **Boss = prédateurs** : comme `BossBase` descend de `Hunter`, les boss sont placés dans le tableau `wild` avec les autres prédateurs. Étourdissement, aveuglement, flèches de danger et musique de tension fonctionnent **sans une ligne de code supplémentaire**.

---

## A.2 Schéma : la boucle de simulation `step()`

```
 1. Mise à jour des bonus, énergie, échelle de temps (TS)
 2. syncPop()
 3. Sélection des entités « actives »
 4. Remplissage de la grille spatiale
 5. think()
 6. update()
 7. Habits.update()
 8. Collisions « qui mange qui »
 9. Bonus, Stage.step(), Boss.step(), fin de partie
```

### Ce que montre ce schéma
Le **cycle de vie d'une image** : l'ordre est fixe et chaque étape alimente la suivante.

### Lecture détaillée, étape par étape

| # | Étape | Rôle | Pourquoi à cet endroit |
|---|---|---|---|
| 1 | Bonus, énergie, `TS` | Décrémente les durées des bonus, gère le sprint, calcule `TS` (échelle de temps) | Les valeurs de cette image doivent être connues **avant** que chacun ne décide |
| 2 | `syncPop()` | Crée ou supprime des entités pour atteindre les populations voulues | Avant la sélection, sinon les nouvelles entités ne seraient pas simulées |
| 3 | Sélection (`vis()`) | Ne garde que les entités proches de l'écran | Réduit le coût (voir F) |
| 4 | Grille spatiale | Range les proies visibles dans des cases de 80 px | Doit précéder `think()` des proies, qui l'interrogent |
| 5 | `think()` | **Chaque entité calcule ses forces** et les ajoute à `acc` | Tous décident à partir du **même état** du monde |
| 6 | `update()` | `vel += acc`, `pos += vel`, `acc = 0` | Toutes les entités bougent **après** que tout le monde a décidé |
| 7 | `Habits.update()` | Le jeu observe le joueur (position, vitesse, esquive) | Après le mouvement : on mesure ce que le joueur **a fait** |
| 8 | Collisions | Qui mange qui, morsures, frénésie | Après le mouvement : on teste les positions finales |
| 9 | Bonus, stage, boss, fin | Logique de haut niveau | Dépend du résultat des collisions (score, vies) |

### Exemple chiffré : pourquoi séparer `think` et `update`
Si chaque poisson décidait *puis* bougeait immédiatement, le premier de la liste verrait un monde « d'avant » et le dernier un monde « d'après » : l'ordre du tableau favoriserait certains poissons. En séparant, les 500 proies voient exactement les mêmes positions.

### Pourquoi ce choix
Cette structure est le motif classique **« lire tout → écrire tout »** des simulations d'agents. Elle garantit un comportement **indépendant de l'ordre** des entités.

> **Remarque sur `TS`** : l'échelle de temps ne touche que `update()` (`pos += vel × TS`). Le joueur et son banc ont `noSlow = true` et utilisent `k = 1`. C'est ce qui permet au bonus ⏳ *Ralenti* de ralentir **le monde sans ralentir le joueur**.

---

# B. Le moteur de steering behaviors

## B.1 La formule de base

```
steering = limit( desired − velocity , maxForce )
```

### Ce que montre cette formule
Le principe de Reynolds : on ne **fixe pas** la vitesse du poisson, on calcule la **correction** pour passer de la vitesse actuelle à la vitesse voulue, mais **bornée**.

### Lecture détaillée
- **`desired`** : la vitesse que le poisson voudrait avoir (direction vers la cible, longueur `maxSpeed`).
- **`desired − velocity`** : l'erreur à corriger.
- **`limit(…, maxForce)`** : le poisson ne peut pas corriger plus vite que son agilité. C'est cette borne qui crée l'**inertie** et les trajectoires courbes.

### Exemple chiffré : l'agilité par espèce
Un rayon de virage approximatif se déduit de `v² / F` (vitesse au carré divisée par la force de virage). Plus il est petit, plus le poisson tourne serré :

| Poisson | `maxSpeed` | `maxForce` | Rayon de virage ≈ v²/F | Lecture |
|---|---|---|---|---|
| Sardine (joueur) | 4,4 | 0,28 | **≈ 69 px** | Très maniable |
| Mérou (joueur) | 3,0 | 0,12 | ≈ 75 px | Lent mais vire court |
| Thon (joueur) | 3,4 | 0,14 | ≈ 83 px | Costaud |
| Requin | 2,9 | 0,07 | ≈ 120 px | Vire large |
| Espadon (joueur) | 4,0 | 0,13 | ≈ 123 px | Rapide, vire large |
| Orque | 2,9 | 0,075 | ≈ 112 px | Vire large |
| Requin-marteau (en charge) | 7,5 | 0,40 | ≈ 140 px | Charge droite, ne peut plus corriger |

> Ces valeurs sont des **ordres de grandeur** (le rayon exact dépend aussi des autres forces et de la vitesse réelle). Elles expliquent pourquoi, en jeu, **la sardine esquive un requin plus facilement qu'un espadon** : l'avantage vient moins de la vitesse que de la maniabilité.

### Pourquoi ce choix
Un seul couple (`maxSpeed`, `maxForce`) par espèce suffit à lui donner une **personnalité de pilotage**, sans écrire de code spécifique.

## B.2 L'intégration : de la force à la position

```js
update() {
  if (this.stun > 0) { this.acc.mult(0); this.vel.mult(.9); }  // étourdi : dérive
  this.vel.add(this.acc).limit(this.maxSpeed);
  this.pos.x += this.vel.x * k;   // k = TS, ou 1 si noSlow
  this.acc.mult(0);
}
```

### Lecture détaillée
1. `acc` est la **somme de toutes les forces** appliquées pendant `think()`.
2. `vel` est limitée à `maxSpeed` : c'est ce qui borne la vitesse, pas les forces.
3. `acc` est remise à zéro : les forces sont **recalculées à chaque image** (pas de mémoire dans l'accélération).
4. Étourdi, un poisson perd sa poussée et **dérive** en perdant 10 % de vitesse par image.

### Point d'analyse important
Chaque force est **limitée à `maxForce` avant d'être multipliée par son poids**. Donc le poids n'est pas seulement un « coefficient d'importance » : c'est aussi un **budget de force**.

| Entité | Force | `maxForce` | Poids | Force maximale de cette règle |
|---|---|---|---|---|
| Proie | Panique `evade` | 0,10 | × 2,5 | **0,25** |
| Proie | Fuite devant un plus gros | 0,10 | × 3 | **0,30** |
| Proie | Errance `wander` | 0,10 | × 0,4 | 0,04 |
| Joueur | Évitement (`avoidW` = 2, ×2,5 interne) | 0,28 (sardine) | × 5 | **1,4** |

Conséquence : pour une proie, **fuir (0,25 à 0,30) domine largement l'errance (0,04)** : dès qu'un danger apparaît, l'errance devient négligeable. C'est ce qui donne l'effet de « panique » sans aucun test `if danger`.

---

## B.3 Tableau : récapitulatif des 12 comportements

| Comportement | Méthode | Utilisé par |
|---|---|---|
| Seek | `seek(t)` | Base de presque tout |
| Flee | `flee(t)` | Recul d'un prédateur après morsure |
| Arrive | `arrive(t, d)` | Joueur, orques, évents, patrouille |
| Pursue | `pursue(o)` | Tous les prédateurs |
| Evade | `evade(o)` | Proies, poisson doré, poissons indépendants |
| Wander | `wander()` | Proies, prédateurs sans cible |
| Separation | `separate(list, dist)` | Banc, meutes |
| Alignment | `align(list, dist)` | Proies, barracudas, orques |
| Cohesion | `cohesion(list, dist)` | Proies, barracudas, orques |
| Obstacle avoidance | `avoid(obs)` | Toutes les entités |
| Leader following | `followLeader(...)` | Banc du joueur |
| Bounds | `bounds(...)` | Toutes les entités |

### Ce que montre ce tableau
Une **bibliothèque de briques** réutilisables. Les trois dernières colonnes de chaque ligne montrent qu'un comportement n'appartient pas à une espèce : le même `evade` sert la proie, le poisson doré et le leader du banc.

### Lecture : trois familles
- **Mouvement vers/depuis une cible** : `seek`, `flee`, `arrive`, `pursue`, `evade`.
- **Mouvement autonome** : `wander`, `bounds`, `avoid`.
- **Comportements de groupe** : `separate`, `align`, `cohesion`, `followLeader`.

Les comportements se **dérivent les uns des autres** :

```
seek ─► flee   (= seek × −1)
seek ─► arrive (= seek avec vitesse désirée réduite)
seek ─► pursue (= seek vers la position future)
pursue ─► evade (= pursue × −1)
seek ─► wander, cohesion, avoid, followLeader…
```

C'est pour cela que `vehicle.js` ne fait que **86 lignes** : tout repose sur `steer()` et `seek()`.

---

## B.4 Analyse détaillée de chaque comportement

### Arrive : le comportement du joueur

```
vitesse désirée = maxSpeed                        si distance ≥ d
vitesse désirée = map(distance, 0, d, 0, maxSpeed) si distance < d   (linéaire)
```

**Exemple chiffré** — Poisson-clown (`maxSpeed` 3,8), rayon d'arrivée 120 :

| Distance à la souris | Vitesse désirée |
|---|---|
| 200 px | 3,80 (pleine vitesse) |
| 120 px | 3,80 |
| 60 px | 1,90 |
| 12 px | 0,38 |
| 0 px | 0 |

**Pourquoi** : avec un simple `seek`, le poisson dépasserait la souris et oscillerait autour. Avec `arrive`, il **glisse** vers le curseur et s'arrête. C'est ce qui donne la sensation de « nager » plutôt que de « téléporter ».

### Pursue : viser le futur

Cible visée = `pos_cible + vel_cible × 10`.

**Exemple chiffré** — une proie à 3 px/image : le prédateur vise **30 px devant elle**. S'il vise une proie qui nage perpendiculairement, il tire « en avance » : c'est de l'**interception** et non de la poursuite pure.

Pour les prédateurs, `pursue` est redéfini dans `Predator` : le point visé passe par `aim()`, qui ajoute ce que le jeu a appris du joueur (voir D).

### Wander : errance avec mémoire

```js
this.wt = this.wt * 0.95 + random(-0.35, 0.35);   // écart d'angle, avec mémoire
const h = this.vel.heading() + this.wt;
cible = (pos + vel.setMag(60)) + 30 × (cos h, sin h);
```

**Analyse statistique** — l'écart `wt` est un processus **autorégressif** (AR(1)) : son écart-type en régime permanent vaut `√( var(U) / (1 − 0,95²) )` avec `var(U) = 0,35²/3 ≈ 0,041`, soit `≈ 0,65 rad ≈ 37°`. Le poisson dévie donc typiquement de ±37° de sa direction, et le facteur 0,95 fait que **les virages durent** (mémoire d'environ 1/(1−0,95) = 20 images).

**Pourquoi** : sans mémoire (`0,95` absent), l'angle changerait au hasard à chaque image et le poisson **vibrerait** sur place. Avec elle, il décrit des **courbes douces**.

### Separation : la répulsion en 1/d²

```js
s.add( (pos − pos_voisin) / d² )
```

**Exemple chiffré** — contribution relative d'un voisin :

| Distance au voisin | Poids `1/d²` | Par rapport à 28 px |
|---|---|---|
| 28 px | 0,00128 | × 1 |
| 14 px | 0,00510 | × 4 |
| 7 px | 0,02041 | × 16 |

**Nuance d'analyse** : `steer()` appelle `setMag(maxSpeed)`, ce qui **normalise** le résultat. La loi en `1/d²` ne règle donc pas l'*intensité* de la force, mais la **direction** : celle-ci est dominée par le voisin le plus proche. Un voisin collé « gagne » sur dix voisins lointains. C'est exactement l'effet voulu : on évite d'abord la collision imminente.

### Alignment et Cohesion

| Règle | Rayon par défaut | Ce qu'elle moyenne |
|---|---|---|
| Séparation | 28 px | Positions (répulsion) |
| Alignement | 60 px | **Vitesses** des voisins |
| Cohésion | 80 px | **Positions** des voisins (centre de masse) |

**Lecture** : les rayons sont **emboîtés** (28 < 60 < 80). Un voisin très proche est repoussé, un voisin moyen donne son cap, un voisin lointain attire. Ce gradient crée un banc **dense mais sans collision**. Les poids `sepW`, `aliW`, `cohW` (1,5 / 1 / 1 par défaut) permettent de tendre vers un banc serré, aligné ou diffus.

### Obstacle avoidance : le test « à trois points »

```
        pos ●────────●────────●
              mi-chemin   lookAhead (a1)
              (a2)
```

Les trois points testés : la position actuelle, `a2` à `lookAhead/2` et `a1` à `lookAhead` devant. Si le plus proche de ces points entre dans le rayon de **l'obstacle + du poisson** (`reach = o.r + this.r`), on pilote vers `a1 − obstacle`, c'est-à-dire **en s'éloignant du centre de l'obstacle**, avec un poids × 2,5.

| Classe | `lookAhead` | Calcul |
|---|---|---|
| Proie | `P.look × 0,6` = 30 px | Court : les proies sont petites et vives |
| Poisson indépendant | `P.look × 0,8` = 40 px | |
| Joueur / défaut | `P.look` = 50 px | |
| Prédateur | `P.look × 1,4` = 70 px | Long : un grand corps doit anticiper plus tôt |

**Pourquoi trois points et pas un** : un seul point loin devant rate les obstacles *proches sur le côté* ; un seul point près du corps réagit trop tard. Trois points couvrent « maintenant », « bientôt » et « plus tard ».

**Optimisation intégrée** : avant tout calcul, on rejette les obstacles dont `|Δx|` ou `|Δy|` dépasse `lookAhead + reach` : aucun des trois points ne peut les toucher.

### Leader following : trois comportements en un

Avec `behind = 45` :

| Point | Position | Rôle |
|---|---|---|
| `back` | 45 px **derrière** le leader | Cible d'`arrive` (rayon 70) |
| `front` | 54 px **devant** le leader | Zone à dégager |
| Seuils d'évitement | < 36 px de `front` ou < 22,5 px du leader | Déclenche `evade(leader) × 1,5` |

**Lecture** : le suiveur vise le point `back`. S'il se retrouve devant le leader ou collé à lui, il **s'écarte de sa trajectoire** pour ne pas lui bloquer le passage. En plus, il se sépare des autres suiveurs (`separate` × `sepW`). On obtient une **file qui se déforme** en virage au lieu d'un convoi rigide.

### Bounds : un mur souple

Dans une marge de 60 px (70 px pour les prédateurs, 80 px pour le poisson doré), une force de rappel × 2 pousse vers l'intérieur. Les limites **verticales** sont spécifiques à chaque espèce :

| Entité | Zone de profondeur |
|---|---|
| Requin | Toute la carte |
| Baudroie, calmar | **Profondeur uniquement** (à partir de 60 % de la hauteur) |
| Requin-marteau | 10 % à 80 % |
| Barracuda | 0 % à 70 % |
| Orque | 0 % à 55 % |

Cela crée une **écologie verticale** : le joueur sait que les baudroies sont en bas et que les orques restent en haut.

---

## B.5 Tableau : les poids ajustables (`P`)

| Paramètre | Valeur par défaut | Effet observable |
|---|---|---|
| `avoidW` | 2 | Rochers évités plus ou moins largement |
| `sepW` / `aliW` / `cohW` | 1,5 / 1 / 1 | Banc dense, aligné ou dispersé |
| `look` | 50 | Anticipation des obstacles |
| `detect` | 260 | Rayon de vue des prédateurs |
| `leash` | 2,2 | Persévérance de chasse |
| `learn` | 0,7 | Intensité de l'apprentissage |

**Lecture** : ce sont les **boutons de réglage** du système. Les modifier en direct (touche S) est la meilleure façon de comprendre que *le comportement collectif est une propriété émergente* de ces six nombres.

---

# C. Les entités

## C.1 Tableau : les forces de la proie

| Force | Effet |
|---|---|
| Séparation (28 px) | Ne pas se superposer |
| Alignement (60 px) | Même direction |
| Cohésion (80 px) | Rester groupé |
| `evade` × 2,5 d'un prédateur proche | Panique |
| `evade` × 3 d'un poisson plus gros | Fuir le joueur |
| `wander` × 0,4 | Errance de fond |
| `arrive` vers un évent × 0,6 | Attirance |
| `avoid`, `bounds` | Environnement |

### Lecture détaillée

Les deux fuites ne se déclenchent pas sur les mêmes critères :

- **Panique (× 2,5)** : un chasseur est **à moins de 0,6 × `detect`** (≈ 156 px) → test d'abord par boîte englobante (`dx < R && dy < R`) puis par distance au carré. Aucune racine carrée n'est calculée pour les chasseurs éloignés.
- **Fuite devant un plus gros (× 3)** : le poisson de l'équipe est plus gros d'au moins 15 % (`t.r > this.r × 1,15`) **et** à moins de 156 px. C'est l'inverse de la règle de manger : la proie fuit exactement ceux qui peuvent la manger.

Les poids d'attirance et d'errance sont **faibles** (0,6 et 0,4) : ce sont des tendances de fond, balayées par la peur.

### Exemple chiffré : un détail de gameplay que révèle le code
Les proies ont un rayon de 4, 5 ou 7, multiplié par un facteur aléatoire entre 0,9 et 1,3. La plus grosse proie possible mesure donc **≈ 9,1 px**. Pour la manger, il faut un rayon supérieur à `9,1 × 1,15 ≈ 10,5`. Or la **Sardine démarre à 9** : elle **ne peut pas manger les plus grosses proies** avant d'avoir grandi. Le Poisson-clown (11) le peut dès le départ.

## C.2 Tableau : les prédateurs

| Prédateur | Forces principales | Particularité |
|---|---|---|
| Requin / Baudroie | `pursue` × 1,2 ou `wander`, `separate` × 1,5, `avoid` × 1,3 | Baudroie : profondeur seulement |
| Calmar | Comme `Predator` + dash | Vitesse × 2,6 |
| Requin-marteau | `pursue` × 0,8 ; états | Direction verrouillée en charge |
| Murène | Aucune force | Vise la position future |
| Barracuda | `pursue` × 1,3, `align` × 0,5 | Cible partagée |
| Orque | `arrive` puis `pursue` × 1,4 | Encerclement |
| Poisson indépendant | `evade` × 3, `pursue` × 1,2 | Endurance, digestion |
| Poisson doré | `evade` × 2, sinon `wander` | Rapide, très maniable |

### Lecture détaillée : ce que traduisent les poids

- Le **requin** (× 1,2) poursuit plus fort que le **marteau** (× 0,8) : le marteau n'est pas un poursuivant mais un **chargeur**, sa vraie arme est la charge.
- Le **barracuda** (× 1,3) et l'**orque** (× 1,4) ont les poids de poursuite les plus élevés, car leur force vient de la **coordination** et non d'une unique grosse force.
- Tous les prédateurs ont un poids d'**évitement** augmenté (× 1,3) et de **séparation** (jusqu'à × 1,5 pour le requin) : un grand corps doit éviter plus fort de se coincer et de s'empiler.

### Exemple chiffré : le calmar

- Déclenchement : cible à moins de `0,7 × detect` ≈ **182 px**.
- Dash : **40 images** (≈ 0,67 s) à vitesse `2 × 2,6 = 5,2` px/image et force 0,25.
- Distance parcourue : environ **200 px**, puis recharge de **200 images** (≈ 3,3 s).

Le calmar est donc lent (2) en croisière mais très dangereux à courte distance : la **menace est dans la rupture de vitesse**, pas dans la vitesse moyenne.

### Exemple chiffré : le poisson indépendant (`Critter`)

| Paramètre | Valeur | Signification |
|---|---|---|
| Rayon d'alerte normal | `150 + 4r` | Un gros poisson voit plus loin |
| Rayon d'alerte en fuite | 280 | Garde l'alerte tant que le chasseur est à portée |
| Endurance `sta` | 300 images | 5 s de sprint à `1,15 × vitesse`, puis `0,8 ×` quand il est épuisé |
| Récupération | +0,6 / image | ≈ 500 images pour refaire le plein à partir de 0 |
| Rassasiement `full` | 260 + aléa(140) images | 4,3 à 6,7 s sans chasser après un repas |
| Population | 60 % petits, 33 % moyens, 14 % gros | Pyramide écologique |

**Lecture** : un poisson qui fuit s'**épuise** et finit par être rattrapé ; un poisson qui a mangé **cesse de chasser**. Ces deux mécanismes empêchent les extinctions locales et les « poursuites infinies ».

## C.3 Schéma : machine à états du requin-marteau

```
 patrouille ──(cible < 0,8·detect, cool=0)──► ALERTE ──(34 images)──► CHARGE
      ▲                                                                  │
      └────────────── récupération (cool 280) ◄──────(52 images)─────────┘
```

### Lecture détaillée

| État | Durée | `maxSpeed` | Comportement | Signal visuel |
|---|---|---|---|---|
| Patrouille | — | 2,5 | `pursue` × 0,8 ou `wander` | — |
| Alerte | 34 images (0,57 s) | 2,5 × 0,35 ≈ **0,9** | `seek` × 1,2, il **freine** et se cale sur la cible | Anneau rouge + « ! », œil rouge |
| Charge | 52 images (0,87 s) | 2,5 × 3 = **7,5** | Force constante dans une **direction verrouillée** | Traînée de vitesse |
| Récupération | 280 images (4,7 s) | 2,5 | Retour à la patrouille | — |

### Exemples chiffrés
- **Déclenchement** : `detect × 0,8` = 260 × 0,8 = **208 px**.
- **Distance maximale de charge** : environ `7,5 × 52 ≈ 390 px` (moins en pratique : il accélère progressivement).
- **Durée d'un cycle complet** ≈ 34 + 52 + 280 ≈ **366 images ≈ 6,1 s**.

### Pourquoi ce schéma est bien conçu (analyse de game design)
Le marteau est **lisible et équitable** : il annonce (« ! »), il se fige 0,57 s (fenêtre pour réagir), puis charge **tout droit** (il ne corrige plus). Le joueur n'a qu'à **virer sur le côté** au bon moment. C'est le patron classique du *télégraphe → engagement → punition* utilisé par les boss de jeux d'action. Le même patron est repris, en plus grand, par les boss.

La direction verrouillée est calculée avec `aim(tgt, 14)` : elle inclut l'**apprentissage**. Un joueur qui esquive toujours du même côté sera visé… de ce côté.

## C.4 Schéma : le cycle de la murène

```
attente ──► contraction (20 images) ──► détente (jaillit) ──► pause (9) ──► retrait ──► attente (cool 170)
```

| État | Ce qui se passe | Valeurs |
|---|---|---|
| Attente | Seuls ses **yeux** brillent dans le trou ; leur éclat augmente si une proie est à < 300 px | — |
| Contraction | La tête sort un peu (`ext` ≤ 0,14) et **tremble** | 20 images : c'est le délai de réaction du joueur |
| Détente | La tête **jaillit** à `ext = 1` | `+0,14` / image, soit ≈ 6 à 7 images |
| Pause | Bouche ouverte | 9 images |
| Retrait | Retour dans le trou | `−0,035` / image ≈ 29 images |

- **Déclenchement** : proie à moins de **175 px** du trou.
- **Portée de l'attaque** : entre 90 et 210 px (`L = distance visée + 14`).
- **Rayon de collision** : `r = 2` tant que la tête est dans le trou, `13` quand elle est sortie.
- La position suit `e = 1 − (1 − ext)²` : un mouvement qui **démarre vite et ralentit** (courbe d'amortissement), plus naturel qu'un mouvement linéaire.

**Lecture** : la murène **n'utilise aucun steering behavior** de déplacement (`update()` est vide). C'est un cas où la bonne solution n'est *pas* un agent autonome : son ancre (le rocher) ne bouge pas. Elle réutilise seulement `aim()` pour viser la **position future** du joueur : un virage brusque suffit à l'éviter.

## C.5 Schéma : la meute d'orques

```
 phase 1 : ENCERCLEMENT  → chaque orque rejoint sa place sur un cercle autour de la proie
      │  (≥ 60 % de la meute à < 480 px, et délai écoulé)
      ▼
 phase 2 : ATTAQUE       → 170 images, pursue × 1,4 de tous les côtés
      ▼
 la meute se replace (cool 140) → nouvelle vague
```

### Lecture détaillée

| Paramètre | Valeur | Sens |
|---|---|---|
| Point d'encerclement de l'orque *i* | `cible + (cos α × 330, sin α × 230)` | Une **ellipse** de 330 × 230 px autour de la proie |
| Angle `α` | `slot + frameCount × 0,006` | `slot = 2π·i/n` : places **régulièrement réparties** ; l'ellipse tourne lentement (un tour ≈ 1 050 images ≈ 17,5 s) |
| Condition d'attaque | ≥ 60 % de la meute à < 480 px de la proie | La meute attaque **groupée** |
| Durée de la vague | 170 images (≈ 2,8 s) | |
| Pause entre vagues | 140 images (≈ 2,3 s) | Fenêtre pour s'échapper |

**Pourquoi c'est efficace** : l'encerclement est un simple `arrive` vers un point **différent pour chaque orque**. Il n'y a pas de « chef » ni de communication complexe : la coordination **émerge** de places distribuées autour du même centre (la proie). C'est un **comportement émergent de groupe** à coût quasi nul. L'état de la meute (`pk.mode`) n'est mis à jour qu'**une fois par image** (`pk.stamp !== frameCount`) pour qu'aucune orque ne voie un état différent d'une autre.

---

## C.6 Tableau : le partage de cible

Le tableau suivant, dérivé du code de `Hunter.shared()`, résume comment un groupe « se parle » :

| Groupe | Rayon de partage | Effet |
|---|---|---|
| Barracudas | 350 px | Si un membre a une cible, les autres la reprennent |
| Orques | 600 px | Idem, rayon plus grand (meute dispersée en encerclement) |

Un prédateur aveuglé (`blind > 0`) **ne reçoit plus** la cible partagée : le flash du Lanterne casse donc aussi la coordination du groupe.

---

# D. L'apprentissage

## D.1 Schéma : le principe général

```
        observe                         mémorise                       utilise
  Joueur ─────────► Habits.update() ─────────► heat / fx,fy,fw / dodge ─────────► Habits.lead() · patrolForce()
 (position,                                                                      → les prédateurs visent mieux
  vitesse, esquive)                      oubli ×0,98 / ~1 s
```

### Ce que montre ce schéma
Une **boucle d'apprentissage en ligne** : observer → mémoriser → utiliser → (oublier). Pas de phase d'entraînement séparée : le « modèle » est construit **pendant** la partie.

## D.2 Tableau : le module `Chase` (poursuite persistante)

| Mécanisme | Valeur | Rôle |
|---|---|---|
| Patience de base | 540 images (9 s) | Durée d'intérêt pour une proie |
| Bonus de niveau | +3 % par niveau (max 10) | La patience monte à 702 images au niveau 10 |
| Usure hors cercle | × 2,2 | Une proie éloignée lasse 2,2 × plus vite |
| Fatigue | jusqu'à −18 % de vitesse | Quand la patience < 40 % de sa valeur de départ |
| Repos après abandon | 200 à 260 images | Pas de réaction hors proximité immédiate |
| Plafond de poursuivants lointains | `min(4, 2 + niveau/4)` | Équité |

### Lecture détaillée : la patience, pas à pas

1. **Acquisition** : la proie la plus proche dans le cercle (`detect`) devient la cible, `pat = 540 × (1 + 0,03 × min(niveau, 10))`.
2. **Poursuite** : `pat` baisse de 1 par image **dans** le cercle, de **2,2** hors du cercle.
3. **Perte de vue** (la proie s'est cachée dans le kelp, une anémone, etc.) : le prédateur file vers la **dernière position connue** (cible « fantôme »), avec `pat − 2` par image, et abandonne après **100 images** ou à `pat ≤ 0`.
4. **Abandon** : distance > `detect × leash` (≈ 572 px), ou `pat ≤ 0` → repos.

### Exemples chiffrés

| Situation | Durée de la poursuite |
|---|---|
| Proie toujours dans le cercle | ≈ 540 images = **9 s** |
| Proie hors du cercle en permanence | 540 / 2,2 ≈ 245 images = **4,1 s** |
| Proie cachée (cible fantôme) | **≤ 100 images** (1,7 s) |
| Niveau 10, proie dans le cercle | 702 images = **11,7 s** |

**La fatigue** : `tire(h) = 0,82 + 0,18 × f` avec `f = pat / 216` dès que `pat < 216`. Au dernier moment, le prédateur ne va plus qu'à **82 %** de sa vitesse : le joueur qui tient 6 à 7 secondes gagne un **avantage croissant**. C'est de la **difficulté réaliste** : un chasseur fatigue.

**Le plafond** `min(4, 2 + ⌊niveau/4⌋)` :

| Niveau | Poursuivants lointains simultanés max |
|---|---|
| 1 à 3 | 2 |
| 4 à 7 | 3 |
| 8 et plus | 4 |

Sans ce plafond, le joueur serait traqué par tous les prédateurs de la carte dès qu'il en croise un.

### La « miséricorde » après une morsure (`onBite`)

| Prédateur | Recul | Calme | Repos |
|---|---|---|---|
| Celui qui a mordu | 40 images | 160 images | 330 images |
| Les autres à < 700 px | — | 90 images | 200 images |

Après avoir perdu une vie, le joueur obtient donc **un répit de 1,5 à 5,5 s** : les prédateurs ne s'acharnent pas pendant qu'il est vulnérable. C'est un garde-fou de **game design** (« ne pas mourir trop vite »).

## D.3 Tableau : le module `Habits` (trois leçons)

| Leçon | Structure | Usage |
|---|---|---|
| Carte de courants | `fx`, `fy`, `fw` | Trajectoire prédite |
| Côté d'esquive favori | `dodge` | Tir décalé |
| Zones favorites | `heat` | Patrouille |

### Lecture détaillée

**La grille.** La carte est découpée en cases de **110 px**. Pour chaque image, la case du joueur reçoit :

```js
heat[i] += 1;                                      // où il est
fx[i] += vel.x / vitesse;  fy[i] += vel.y / vitesse;  fw[i] += 1;   // vers où il va (si vitesse > 0,6)
```

On additionne des **vecteurs unitaires** (la direction, pas la vitesse) : on apprend *où il va*, pas *à quelle vitesse*.

**La cohérence d'une case.** Pour la direction autour d'un point, on moyenne les 9 cases voisines (la case centrale compte double) :

```
cohérence c = |somme des vecteurs| / nombre d'échantillons      (entre 0 et 1)
```

| Cohérence | Signification |
|---|---|
| ≈ 1 | Le joueur passe toujours dans **la même direction** ici |
| ≈ 0 | Il passe dans **tous les sens** : aucune habitude |

Cette valeur est aussi multipliée par `min(1, w/160)` : **une case qui n'a eu que quelques passages ne compte presque pas**. Il faut au moins 160 échantillons (≈ 2,7 s de présence cumulée) pour qu'une habitude soit prise au sérieux.

**Le côté d'esquive.** Pour le chasseur le plus proche (entre 70 et 320 px), on calcule la composante latérale de la vitesse du joueur par rapport à l'axe de la charge. Une moyenne mobile exponentielle (`α = 0,02`, soit une mémoire d'environ 50 images) donne `dodge ∈ [−1, +1]` : *« il vire à gauche (+) ou à droite (−) quand on le charge »*. Le décalage n'est appliqué que progressivement : `min(1, dodgeN / 300)`, il faut donc **300 observations** avant qu'il soit pleinement pris en compte.

**La carte de chaleur.** Elle sert à `patrolForce` : un prédateur **sans cible** choisit une case chaude (au moins 40 de chaleur) dans un rayon de 9 cases, avec un **tirage pondéré** par `chaleur / (1 + distance × 0,35)`, et s'y rend avec `arrive` à `0,55 × L`. Le point choisi est conservé **180 à 300 images** (3 à 5 s) pour éviter qu'il hésite.

## D.4 Tableau : maturité et oubli

| Grandeur | Formule | Valeurs |
|---|---|---|
| Maturité | `clamp((n − 600) / 3000, 0, 1)` | 0 jusqu'à 10 s ; **100 % à 60 s** |
| Apprentissage effectif | `L = P.learn × maturité` | Maximum `0,7` par défaut |
| Oubli | × 0,98 toutes les 60 images | Demi-vie ≈ **34 s** |
| Message | maturité > 35 % | « 🧠 Les prédateurs étudient tes habitudes… » (≈ 28 s) |

### Exemple chiffré : la demi-vie de l'oubli
Après *k* cycles, la mémoire vaut `0,98^k`. Elle tombe à 50 % pour `k = ln 0,5 / ln 0,98 ≈ 34,3` cycles, soit `34,3 × 60 ≈ 2 060` images ≈ **34 s**.

**Lecture** : la fenêtre d'apprentissage est **d'une demi-minute environ**. Un joueur qui **change de zone ou de trajectoire** voit les anciennes habitudes s'effacer, et les prédateurs doivent réapprendre. L'oubli évite qu'une erreur ancienne soit éternellement punie, et rend le jeu **adaptable des deux côtés**.

## D.5 Schéma : la trajectoire prédite (`Habits.path`)

La trajectoire est calculée sur **9 pas de 10 images**, soit 90 images (1,5 s) :

```
pas 0 : position actuelle
pas k : direction mélangée  v = v·(1 − c) + flux·c       (c ≤ 0,85)
        position += v × vitesse × 10
```

### Lecture détaillée
- `c` est la **confiance** : `c = min(0,85, cohérence × L)`. Même avec une cohérence parfaite, la prédiction ne remplace jamais **complètement** la direction courante (maximum 85 %) : le joueur garde sa part d'imprévu.
- La prédiction est **cumulée** (`sum / k`) : on garde une moyenne de confiance le long du chemin, ce qui permet d'en évaluer la fiabilité globale.
- Le résultat est **mis en cache** (`_pf === frameCount`) : même si dix prédateurs la demandent, elle n'est calculée qu'**une fois par image**.

### Les deux situations extrêmes

| Joueur | Cohérence | Résultat |
|---|---|---|
| Fait toujours le même circuit | Proche de 1 | Trajectoire apprise : les prédateurs interceptent **en avance** |
| Change sans cesse de direction | Proche de 0 | Retour à l'extrapolation linéaire : **aucun avantage** |

## D.6 Le tir anticipé (`Habits.lead`)

### Lecture détaillée, étape par étape

1. **Au contact** (`distance < r_joueur + r_prédateur + 40`) : on retombe sur l'extrapolation linéaire (inutile d'être subtil à bout portant).
2. **Temps d'interception** : `t = distance / max(1,5, maxSpeed)`, borné entre 8 et 85 images, puis converti en « pas » de 10 images.
3. **Point prédit** : interpolation linéaire entre deux points de la trajectoire apprise.
4. **Correction** = (point appris) − (point en ligne droite), plafonnée à **220 px**.
5. **Décalage latéral** = `dodge × min(1, N/300) × min(distance × 0,5, 120) × L`, perpendiculaire à l'axe prédateur → proie.

### Exemple chiffré

Un requin (`maxSpeed` 2,9) à 400 px du joueur : `t = 400 / 2,9 ≈ 138` → borné à **85 images** (soit 8,5 pas). Le requin vise le point où le joueur **sera dans 1,4 s** *d'après ses habitudes*.

Décalage latéral maximal : `1 (dodge) × 1 × 120 × 0,7 (L) = 84 px`. **Le tir peut donc être décalé de 84 px du côté d'esquive favori**, un décalage suffisant pour intercepter un joueur dont l'esquive est prévisible (la taille d'un requin est de 60 px de diamètre).

### Pourquoi ces limites
- **Plafond de 220 px** : la correction ne peut pas devenir absurde si la carte de courants est bruitée.
- **Plafond de 85 images** : prédire à plus de 1,4 s n'a pas de sens, le joueur a le temps de changer d'avis.
- **Facteur `P.learn` à 0,7** : même au maximum, les prédateurs ne sont jamais « parfaits ».

### Limites assumées de l'approche
- Ce n'est **pas un modèle appris par optimisation** (pas de gradient, pas de fonction de coût) : c'est une **statistique descriptive en ligne**.
- Il n'y a **pas de généralisation** entre parties : tout est remis à zéro (`Habits.reset()`) à chaque partie.
- Le modèle ne capture **que les habitudes spatiales** (où, vers où, côté d'esquive), pas les habitudes stratégiques (usage des capacités, des bonus).

---

# E. Le jeu

## E.1 Tableau : les huit espèces

| Espèce | Rôle | Capacité |
|---|---|---|
| Sardine | Rapide, fragile | Banc de leurres |
| Poisson-clown | Équilibré | Anémone refuge |
| Thon | Gros, puissant | Coup de queue |
| Lanterne | Brille en profondeur | Flash aveuglant |
| Poisson-ange | Agile | Flash aveuglant |
| Espadon | Rapide et massif | Coup de queue |
| Mérou | Tank | Anémone refuge |
| Vipère | Chasseuse des abysses | Flash aveuglant |

### Ce que montre ce tableau
Les capacités se répartissent en **trois familles**, selon leur philosophie défensive :

| Famille | Espèces | Philosophie |
|---|---|---|
| **Leurrer / cacher** (*éviter d'être vu*) | Sardine, Poisson-clown, Mérou | Détourner ou masquer |
| **Repousser** (*frapper*) | Thon, Espadon | Étourdir les prédateurs proches |
| **Aveugler** (*couper la perception*) | Lanterne, Poisson-ange, Vipère | Faire perdre la cible |

### Lecture détaillée : tailles et profils

| Espèce | `r` | `speed` | `force` | Profil |
|---|---|---|---|---|
| Sardine | 9 | 4,4 | 0,28 | Vitesse et agilité maximales, taille minimale |
| Poisson-clown | 11 | 3,8 | 0,22 | Compromis |
| Thon | 16 | 3,4 | 0,14 | Costaud, vire large |
| Lanterne | 12 | 3,6 | 0,20 | Éclaire (voit loin dans le noir) |
| Poisson-ange | 10 | 4,1 | 0,27 | Très agile |
| Espadon | 18 | 4,0 | 0,13 | Rapide mais **très peu maniable** |
| Mérou | 20 | 3,0 | 0,12 | Le plus gros et le plus lent |
| Vipère | 13 | 3,7 | 0,21 | Phosphorescente |

On voit un **compromis taille / agilité** : plus l'espèce est grosse, plus sa force de virage est faible. Chaque espèce impose donc un **style de jeu** : la sardine esquive, le mérou encaisse.

## E.2 Tableau : les trois stades d'évolution

| Stade | Seuil de croissance | Effet |
|---|---|---|
| Alevin | 0 % | Silhouette ronde, pas de capacité |
| Adulte | 25 % | Capacité débloquée |
| Géant | 65 % | Capacité renforcée, aura dorée |

### Lecture détaillée
La croissance est définie par :

```
croissance = clamp( (r − r_départ) / (0,8 × r_départ) , 0, 1 )
```

Le rayon maximum est `1,8 × r_départ` (plafond de `grow`), ce qui correspond à une croissance de 1.

Rayons de passage de stade : `Adulte = 1,2 × r_départ`, `Géant = 1,52 × r_départ`.

### Exemple chiffré : nombre de proies à manger

Chaque proie fait grandir le joueur de **0,35**. Pour atteindre chaque stade :

| Espèce | `r` départ | Adulte (r) | Proies pour Adulte | Géant (r) | Proies pour Géant | Maximum (r) |
|---|---|---|---|---|---|---|
| Sardine | 9 | 10,8 | **6** | 13,7 | **14** | 16,2 |
| Poisson-clown | 11 | 13,2 | 7 | 16,7 | 17 | 19,8 |
| Thon | 16 | 19,2 | **10** | 24,3 | **24** | 28,8 |
| Mérou | 20 | 24,0 | 12 | 30,4 | 30 | 36,0 |

(Calcul : `⌈(r_stade − r_départ) / 0,35⌉` en ne comptant que les proies standard ; manger des poissons indépendants fait grandir de 0,5.)

**Lecture** : la progression est **proportionnelle à la taille de départ** mais **plus rapide pour les petites espèces en nombre de proies**. Une sardine devient adulte en 6 proies, un mérou en 12. L'espèce « difficile » au départ est donc la plus rapide à évoluer, ce qui **rééquilibre** son handicap initial.

## E.3 Tableau : les capacités et leur recharge

| Capacité | Recharge (Adulte / Géant) | Amélioration au stade Géant |
|---|---|---|
| Banc de leurres | 780 / 600 images (13 s / 10 s) | 7 leurres, plus durables |
| Anémone refuge | 900 / 660 images (15 s / 11 s) | Refuge plus grand et plus long |
| Coup de queue | 600 / 420 images (10 s / 7 s) | Onde plus large, étourdissement plus long |
| Flash aveuglant | 840 / 600 images (14 s / 10 s) | Flash plus large, cécité plus longue |

**Lecture** : la capacité la plus **offensive** (coup de queue) a la recharge la plus courte ; la plus **défensive** (anémone, invulnérabilité) la plus longue. L'évolution en Géant réduit la recharge de **25 à 30 %**.

## E.4 Tableau : les effets des capacités sur la perception des prédateurs

| Capacité | Mécanisme dans le code | Effet |
|---|---|---|
| Leurres | `sightFor()` renvoie la liste des leurres si l'un est à moins de `detect` | Le prédateur **ignore le joueur** |
| Flash | `blind > 0` → `sightFor()` renvoie une liste vide | Le prédateur perd tout (`Chase.pick` → `drop`) |
| Anémone | Le joueur est retiré de `targets()` | Invisible et intouchable |
| Coup de queue | `stunHunter` : `acc = 0`, `vel × 0,9` | Le prédateur dérive |
| Kelp | `World.inKelp(f)` retire le poisson des cibles | Cachette naturelle |

### Pourquoi c'est un bon design technique
Toutes ces capacités agissent **sur la perception** (quelle liste le prédateur reçoit) ou **sur le mouvement** (étourdissement), jamais sur la logique interne du prédateur. Ajouter une nouvelle capacité ne demande **aucune modification des prédateurs** : on change seulement la liste qu'ils reçoivent.

## E.5 Tableau et schéma : les boss

```
 entrée → rôde → ANNONCE → ATTAQUE → VULNÉRABLE → rôde …
```

| Phase du boss | Vie restante | Conséquence |
|---|---|---|
| Phase 1 | 100 % → 66 % | Attaques de base |
| Phase 2 | 66 % → 33 % | Ex. : onde d'écrasement à la fin d'une charge |
| Phase 3 | < 33 % | Attaques enchaînées |

### Lecture détaillée du cycle

| État | Rôle | Intérêt pour le joueur |
|---|---|---|
| Rôde | Le boss circule | Temps de repositionnement |
| Annonce | Texte + télégraphie (ligne, zone) | **Apprendre** l'attaque à venir |
| Attaque | Exécution | Esquive |
| Vulnérable | Fenêtre où l'on peut mordre | **Récompense** de l'esquive |

Tout le schéma repose sur le principe *« la prise de risque ouvre la fenêtre de dégâts »*. Hors fenêtre, toucher un boss fait **perdre une vie**.

### Constantes remarquables
- `BOSS_ROCK_STUN = 40` : un boss qui percute un rocher en chargeant est **étourdi 40 images** → le joueur peut **utiliser le décor** contre lui.
- `BOSS_STOMP_R = 190` : rayon de l'onde à la fin d'une charge (phase 2+).
- `BOSS_WALL_WAVE = 105` : onde, plus petite, quand une charge percute le bord.
- `BOSS_MINI_GRACE = 130` : les orques invoquées sont étourdies 2,2 s pour que le joueur ne soit pas attaqué au moment où il mord le boss.

### Tableau : l'adaptation boss ↔ biome

| Biome | Boss | Mécanique centrale |
|---|---|---|
| Récif | Requin-marteau | **Charges** : esquive latérale |
| Kelp | Murène géante | **Embuscade** : surveiller le dessous |
| Épaves | Orque géante | **Sonar + meute** : gestion de l'espace |
| Grotte | Baudroie | **Leurre qui attire** : résister à l'attraction |
| Abysses | Mégalodon | **Charges en série + ondes** : gestion de l'énergie |

Chaque boss est une **version amplifiée** du prédateur du biome. Le joueur applique donc au boss ce qu'il a appris du biome : la difficulté est **cohérente et progressive**.

## E.6 Tableau : les cinq stages

| # | Stage | Objectifs | 2★ | 3★ |
|---|---|---|---|---|
| 1 | Récif corallien | Manger 20 · Devenir adulte | 1 400 | 2 200 |
| 2 | Forêt de kelp | 3 perles · Manger 30 | 1 900 | 2 900 |
| 3 | Cimetière d'épaves | 3 coffres · 60 pièces | 2 500 | 3 700 |
| 4 | Grotte sous-marine | 4 perles · Manger 35 | 2 700 | 4 000 |
| 5 | Fosse abyssale | Devenir géant · 5 perles | 3 200 | 4 600 |

### Lecture détaillée

**Les objectifs sont variés et enseignent le jeu.** Chaque stage mélange un objectif de **combat** (manger), un de **progression** (grandir) et un d'**exploration** (perles, coffres, pièces) :

| Type d'objectif | Ce qu'il fait pratiquer |
|---|---|
| `eat` | La chasse |
| `grow` | L'évolution |
| `pearls` | L'exploration en profondeur (zones dangereuses) |
| `coins` | Le ramassage en mouvement |
| `chests` | La recherche d'éléments cachés |

**Les seuils d'étoiles** augmentent à chaque stage :

| Stage | Seuil 3★ | Progression par rapport au stage précédent |
|---|---|---|
| 1 | 2 200 | — |
| 2 | 2 900 | + 32 % |
| 3 | 3 700 | + 28 % |
| 4 | 4 000 | + 8 % |
| 5 | 4 600 | + 15 % |

On observe une **courbe de difficulté croissante**, avec un palier plus doux entre les stages 3 et 4 (la grotte demande de gérer l'obscurité, une difficulté d'un autre type).

**Condition de déblocage** : un stage s'ouvre quand le précédent a au moins 1★ (`prog.stars[i − 1] ≥ 1`). Le **score final** = score + 150 par vie restante + bonus de boss.

## E.7 Tableau : les trois familles d'améliorations

| Monnaie | Familles | Exemples |
|---|---|---|
| **Pièces** 🪙 (abondantes) | Confort de jeu | Vitesse, endurance, aimant, chance, valeur des pièces |
| **Perles** (rares) | Survie et puissance | Vies, bouclier, recharge, durée, score |

Coûts croissants (exemple *Nageoires turbo*) : 60 → 130 → 240 → 400 → 600 → 850 → 1 150 → 1 500 pièces pour 8 niveaux, soit un gain de `+4 %` de vitesse par niveau (`+32 %` au maximum). Le coût augmente plus vite que le gain : c'est une **économie à rendements décroissants**, qui évite qu'un joueur riche ne soit invincible.

---

# F. Les optimisations

## F.1 Tableau d'ensemble

| Optimisation | Principe | Gain |
|---|---|---|
| Grille spatiale | Cases de 80 px | `O(n²)` → `O(n)` |
| Simulation locale | `vis()` | Entités éloignées ignorées |
| Flocking espacé | 1 image sur 3 hors écran | ≈ −67 % de calculs |
| Zéro allocation | `steerXY`, vecteurs réutilisés | Moins de ramasse-miettes |
| Dessin simplifié | > 90 proies à l'écran | Rendu plus léger |
| Sprites pré-rendus | `Obstacle.bake()` | Un rocher = une image |

## F.2 La grille spatiale en détail

### Schéma

```
 ┌────┬────┬────┐
 │ ·  │ ·· │    │      Une proie ● ne compare qu'avec les proies
 ├────┼────┼────┤      des 9 cases autour d'elle (la sienne + 8 voisines)
 │  · │ ●  │ ·  │
 ├────┼────┼────┤
 │    │ ·  │    │
 └────┴────┴────┘
       cases de 80 px
```

### Lecture détaillée
- **Pourquoi 80 px ?** C'est le plus grand rayon utilisé par le flocking (la cohésion : 80 px). Un voisin à moins de 80 px est donc **forcément dans les 9 cases** : aucun voisin utile n'est manqué.
- **Clé de case** : `(cx + 64) × 4096 + (cy + 64)`. Le décalage de 64 permet d'accepter des indices **légèrement négatifs** sans collision de clés, et la taille 4096 permet jusqu'à 4 096 cases en hauteur.
- **Recyclage** : `clear()` ne détruit pas les tableaux mais les range dans `free`, qui sont réutilisés : **zéro allocation** d'une image à l'autre.

### Exemple chiffré
Le commentaire du code donne le cas : **500 proies visibles = 250 000 tests de paires** par image dans l'ancienne version, chacun avec création de vecteurs p5. Avec la grille, chaque proie examine quelques voisins, soit une réduction d'**un à deux ordres de grandeur** (le gain exact dépend de la densité locale).

## F.3 Le flocking hors écran
Les proies à plus de **250 px** hors de l'écran ne recalculent leur flocking qu'**une image sur 3** : `(frameCount + ph × 10) % 3` utilise la **phase individuelle** `ph` du poisson pour décaler les calculs, de sorte que ce ne soient pas les mêmes poissons à chaque image. La dernière force est **réutilisée** (`this.fk`) les autres images. L'œil ne voit rien : ce qui est hors écran n'est pas observé.

## F.4 Le calcul sans objets : `steerXY`
`steerXY(dx, dy, w)` refait le calcul de `steer()` avec des nombres, sans créer de `p5.Vector`. Le commentaire du code précise que `flockGrid` donne **« le même résultat que `separate()*sepW + align()*aliW + cohesion()*cohW`, sans objets temporaires »** : la version rapide est une réécriture **à comportement identique** de la version lisible.

---

# G. Debug et démonstration

## G.1 Tableau : les éléments de debug

| Élément | Source | Ce qu'il illustre |
|---|---|---|
| Ligne jaune + 2 cercles | `Fish.debug` | Les points « ahead » de l'évitement |
| Cercle rouge | `Predator.show` | Rayon de détection |
| Cercle rouge de 400 px | `Moray.show` | Zone d'embuscade |
| Carte violette | `Habits.debug` | Chaleur (zones fréquentées) |
| Ligne violette | `Habits.debug` | Trajectoire prédite |

### Lecture détaillée
- **La ligne jaune** relie le poisson au point `a1` ; deux petits cercles marquent `a1` et `a2`. On **voit** le test à trois points de l'évitement.
- **L'opacité de la carte violette** vaut `min(110, chaleur × 0,6)` : les zones les plus visitées sont les plus opaques ; les cases à moins de 8 de chaleur ne s'affichent pas.
- **La ligne violette** est la trajectoire prédite à 1,5 s : si le joueur suit sa ligne, c'est que **les prédateurs l'ont bien « compris »**.

## G.2 Tableau : isoler un comportement pour le démontrer

| Pour observer… | Réglage | Résultat attendu |
|---|---|---|
| Le flocking pur | Prédateurs à 0 ; faire varier séparation, alignement, cohésion | Banc serré, aligné ou dispersé |
| L'évitement | Faire varier `avoidW` et `look` | Contournement plus large ou plus tardif |
| Le *pursue* seul | 1 prédateur, `learn` = 0 | Poursuite par simple extrapolation |
| L'apprentissage | `learn` = 1, circuit répété | Ligne violette qui colle au circuit |
| La chasse en groupe | Augmenter barracudas et orques | Encerclement et vagues |
| La persévérance | Faire varier `leash` | Poursuites plus ou moins longues |

### Pourquoi ce protocole est utile
Il applique la **méthode expérimentale** : on **fait varier un seul paramètre** à la fois et on observe l'effet. C'est l'approche idéale pour **justifier** chaque comportement lors d'une soutenance.

### Expérience-clé pour prouver l'apprentissage (protocole en trois temps)

1. **Mesure de référence** : `learn = 0`. Faire un circuit régulier de 90 s, compter les morsures.
2. **Avec apprentissage** : `learn = 1`, même circuit, même durée, compter les morsures.
3. **Changement de stratégie** : après 60 s, varier le circuit : observer que la ligne violette **perd sa cohérence** et que les morsures **diminuent**.

**Résultat attendu** : plus de morsures à l'étape 2 qu'à l'étape 1, moins à l'étape 3 qu'à l'étape 2. Cette courbe en « bosse » prouve à la fois **l'apprentissage** et **l'oubli**.

---

# H. Synthèse

## H.1 Ce que révèlent les schémas et les tableaux

| Axe | Ce qu'on retient |
|---|---|
| **Architecture** | Une seule base (`Vehicle`) ; chaque entité n'est qu'une façon de **combiner des forces** |
| **Steering** | Douze briques simples ; le comportement riche vient des **poids** et de la **superposition** |
| **Machines à états** | Les prédateurs spéciaux suivent le patron *annonce → engagement → récupération* : **lisible et équitable** |
| **Groupes** | La coordination (barracudas, orques) **émerge** de règles locales (cible partagée, places sur un cercle) |
| **Apprentissage** | Un modèle statistique léger, **progressif, oubliant, borné** |
| **Équilibrage** | Garde-fous partout : plafond de poursuivants, miséricorde, fatigue, maturité |
| **Performance** | Grille spatiale, simulation locale, zéro allocation |

## H.2 Trois idées à retenir pour une présentation

1. **« Un moteur, mille comportements »** : tout repose sur `steer = limit(désiré − vitesse, maxForce)`, et la variété vient uniquement des combinaisons de forces et de leurs poids.
2. **« Les ennemis apprennent, mais restent équitables »** : maturité progressive (1 min), oubli (demi-vie 34 s), plafond de 0,7, et répit après chaque morsure.
3. **« Chaque schéma est testable »** : le mode debug (touche **D**) et le panneau de réglages (touche **S**) permettent de *voir* chaque comportement isolément.

---

<p align="center"><b>Réalisé par HAJAR BELHACHMI</b><br>Master IA2 — Université Côte d'Azur — Année universitaire 2026/2027</p>
