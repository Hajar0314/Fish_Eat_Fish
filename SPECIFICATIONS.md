# Spécifications — Fish Eat Fish : Deep Sea

**Projet :** jeu d'action sous-marin en p5.js (« Mange. Grandis. Survis. »), avec comportements de pilotage (steering), IA de prédateurs qui apprennent, progression, boutique et mode Stages avec boss
**Auteure :** Hajar Belhachmi
**Destinataire :** l'agent de développement chargé de réaliser le projet

---

## Comment lire ce document

Ce document décrit, **dans l'ordre où elles doivent être exécutées**, toutes les tâches nécessaires pour construire *Fish Eat Fish — Deep Sea* de zéro. Chaque tâche est numérotée et porte un statut :

* `[todo]` : à faire ;
* `[done]` : terminée et vérifiée (critères d'acceptation remplis).

**État actuel :** les 64 tâches sont `[done]`. Le projet est complet et jouable (`index.html`, 14 fichiers JavaScript, p5.js embarqué en local).

**Note de méthode.** L'ordre et le découpage ont été reconstitués en lisant le code final (`index.html`, `vehicle.js`, `grid.js`, `entities.js`, `extras.js`, `learning.js`, `predators.js`, `ecosystem.js`, `abilities.js`, `world.js`, `shop.js`, `stages.js`, `boss.js`, `audio.js`, `sketch.js`) et les commentaires d'en-tête de chaque fichier. L'archive ne contient ni historique git ni suite de tests automatisés : les critères d'acceptation sont donc **vérifiables à la main en jouant** (et via les raccourcis de debug de la tâche 62), et non par des tests unitaires. Ce n'est pas un journal horodaté : c'est la séquence logique la plus cohérente pour obtenir exactement le projet livré. (L'archive s'appelle `Fish_version_28.zip` mais le dossier interne est `Fish_version_6/Fish version_6`.)

**Dépendances de fichiers (ordre de chargement dans `index.html`) :**
`audio.js` → `vehicle.js` → `entities.js` → `extras.js` → `grid.js` → `learning.js` → `predators.js` → `ecosystem.js` → `abilities.js` → `world.js` → `shop.js` → `stages.js` → `boss.js` → `sketch.js`

---

## Phase 0 — Socle technique

### T01 `[done]` Squelette HTML/CSS et chargement des scripts
- Créer `index.html` (`lang="fr"`, viewport mobile, titre « Fish Eat Fish — Deep Sea »).
- Charger p5.js depuis `libraries/p5.min.js`, avec repli automatique sur le CDN cdnjs si la copie locale manque.
- Ajouter un gestionnaire global `error` qui affiche l'erreur (message, fichier, ligne) dans un bandeau `#err`.
- Charger les scripts dans l'ordre de dépendance indiqué plus haut.
- **Critères :** la page s'ouvre sans erreur console ; une erreur volontaire s'affiche dans le bandeau.

### T02 `[done]` Classe `Vehicle` : comportements de pilotage
- Écrire `vehicle.js` : position, vitesse, accélération, `maxSpeed`, `maxForce`, `lookAhead`.
- Implémenter `seek`, `flee`, `arrive`, `pursue`, `evade`, `wander` (bruit lissé), `separate`, `align`, `cohesion`.
- Implémenter `avoid` (obstacle avoidance à 2 points « devant », fuite de l'obstacle le plus menaçant), `followLeader` (arrivée derrière le leader + dégagement de sa trajectoire + séparation du groupe) et `bounds` (rebond doux aux bords).
- Ajouter `update` : étourdissement (`stun` : plus de poussée, dérive), limite de vitesse, animation de morsure (`bite`).
- Ajouter l'échelle de temps globale `TS` (bonus « ralenti » : le monde ralentit, pas le joueur ni son banc).
- **Critères :** un véhicule de test suit la souris, fuit, erre, contourne un rocher, et le banc garde sa cohésion.

### T03 `[done]` Grille spatiale et optimisations de performance
- Écrire `grid.js` : `Grid` (spatial hash, cases de 80 px, tableaux recyclés) et l'objet `Opt` (grille des proies de la frame, sources hydrothermales proches, compteur de foule, seuil de dessin simplifié `CROWD = 90`, marge `FAR`).
- Ajouter `steerXY` dans `Vehicle` (force de pilotage sans allocation de vecteur p5) et la réutilisation des vecteurs dans `avoid`.
- **Critères :** le flocking d'un banc de plusieurs centaines de proies reste fluide (chaque proie ne regarde que sa case et les 8 voisines).

### T04 `[done]` Paramètres globaux et panneau de réglages
- Définir l'objet `P` (nombre de prédateurs/proies/méduses/calmars/marteaux/murènes/barracudas/orques, poids d'évitement, séparation, alignement, cohésion, détection, vitesse du joueur, `leash`, `learn`, `debug`).
- Définir `CFG` (libellé, min, max, pas) et générer automatiquement un panneau de sliders (touche **S**).
- **Critères :** modifier un slider change le comportement immédiatement, sans rechargement.

---

## Phase 1 — Entités et rendu

### T05 `[done]` Rendu des poissons dessinés
- Écrire `entities.js` : conversion de couleurs en cache (`rgbOf`, `shade`), table de styles `FSTYLE` + `getStyle`, contour de poisson paramétrique (`fishPts`, `fishOutline`), écailles brillantes (`forScales`), dégradés, nageoires animées, bouche animée.
- Gérer les variantes de style : rayures (poisson-clown), lueur (poissons lumineux), éclat (poisson doré).
- **Critères :** chaque espèce a une silhouette et une couleur propres ; les nageoires ondulent ; la queue bat avec la vitesse.

### T06 `[done]` Obstacles : rochers éclairés
- Classe `Obstacle` (position, rayon, couleur) rendue avec relief et **éclairage dynamique** par les sources lumineuses proches (`_lit`).
- **Critères :** un rocher proche d'un poisson lumineux s'éclaire côté source.

### T07 `[done]` Classes `Fish`, `Player`, `Follower`
- `Fish extends Vehicle` : espèce (`sp`), phase d'animation, rendu (`show`), morsure.
- `Player` : suit la souris, sprint, vitesse modulée par les réglages et la boutique.
- `Follower` : membre du banc du joueur (option « Jouer avec un banc ») qui suit le leader avec `followLeader`.
- **Critères :** le joueur nage vers la souris ; 5 suiveurs se placent derrière lui sans s'empiler.

### T08 `[done]` Proies (`Prey`)
- Comportement de banc (séparation + alignement + cohésion via la grille), errance, évitement des obstacles, **fuite** devant les menaces (prédateurs, gros poissons, joueur plus gros).
- Trois sortes de proies (taille/vitesse/couleur), la troisième brillant dans le noir.
- **Critères :** un banc de proies se déplace en formation et se disperse à l'approche d'un requin.

### T09 `[done]` Prédateurs de base : requin et baudroie
- `Predator` : détection, poursuite de la cible visible, errance sans cible, évitement des obstacles, limite à sa zone de profondeur (`deepOnly` pour la baudroie).
- **Critères :** un requin détecte le joueur dans son rayon et le poursuit ; une baudroie reste en eau profonde.

### T10 `[done]` Méduses, calmars et sources hydrothermales
- `Jellyfish` (obstacle mobile dangereux au contact), `Squid extends Predator` (calmar, eau profonde), `Vent` (sources hydrothermales au fond, avec panache).
- **Critères :** toucher une méduse coûte une vie ; les sources apparaissent régulièrement le long du fond.

### T11 `[done]` Catalogue d'espèces et constantes
- Dans `sketch.js` : `SPECIES` (Sardine, Poisson-clown, Thon, Lanterne + 4 espèces achetables : Poisson-ange, Espadon, Mérou, Vipère), chacune avec rayon, vitesse, force, couleur, capacité, description.
- `PREY`, `PRED` (Requin, Baudroie), `PRED_SQUID`, `PUPS` (bonus).
- **Critères :** chaque espèce a des statistiques distinctes et une capacité associée.

---

## Phase 2 — Boucle de jeu

### T12 `[done]` Machine à états, `setup` et `startGame`
- États : `title`, `select`, `play`, `over`, `win` ; `showScreen` pour afficher l'écran HTML correspondant.
- `setup` : canvas plein écran, lecture du record, génération du panneau, neige marine.
- `startGame` : crée le monde (taille de carte libre 6×3 écrans ou celle du stage), le joueur, le banc, les rochers, les sources, réinitialise tous les tableaux et effets.
- **Critères :** on enchaîne titre → sélection → partie → fin → rejouer sans fuite d'état.

### T13 `[done]` Monde large, caméra, minimap et flèches de danger
- Caméra qui suit le joueur (`updateCam`), minimap (touche **N** pour l'afficher/masquer), flèches de danger indiquant les prédateurs hors écran (`dangerArrows`).
- Simuler uniquement les entités proches de l'écran (`vis`).
- **Critères :** la carte défile, la minimap montre les entités, une flèche apparaît quand un prédateur approche hors champ.

### T14 `[done]` Contrôles et sprint
- Souris pour nager ; **Espace** ou clic pour sprinter ; jauge d'énergie (consommation/recharge, modulées par la boutique) ; son de sprint.
- **Critères :** le sprint accélère le poisson, vide la jauge et se bloque à énergie quasi nulle.

### T15 `[done]` Manger, être mangé, vies et invincibilité
- Manger une proie plus petite (croissance plafonnée) ; se faire mordre par un prédateur : perte d'une vie, invincibilité temporaire, secousse d'écran, recul du prédateur.
- Les suiveurs du banc sont mangés sans coûter de vie.
- **Critères :** 3 vies au départ, perte de vie au contact, fin de partie à 0 vie.

### T16 `[done]` Score, combo et niveaux
- `addScore` avec combo (multiplicateur jusqu'à ×5), double score, bonus boutique ; passage de niveau tous les 300 points (+1 vie, bannière, récompenses).
- **Critères :** enchaîner les proies augmente le multiplicateur ; il retombe après un délai sans manger.

### T17 `[done]` Population dynamique et difficulté progressive
- `syncPop` maintient le nombre de proies, prédateurs, méduses, calmars selon les réglages, la taille du monde et le niveau.
- **Critères :** plus le niveau monte, plus il y a de prédateurs ; la population se renouvelle hors écran.

### T18 `[done]` Bonus à ramasser
- Bouclier, Turbo, Frénésie (mange les prédateurs), Aimant, +1 vie, Ralenti, Double score, Clones (mini-banc de 25 s).
- **Critères :** chaque bonus a son effet, sa durée, son indicateur HUD et son son.

### T19 `[done]` Poisson doré
- `GoldFish` (extras.js) : rare, très rapide, fuit le joueur, 150 points, pluie de pièces.
- **Critères :** il apparaît périodiquement, fuit, disparaît après ~700 images s'il n'est pas attrapé.

### T20 `[done]` HUD
- Panneaux vitrés, score animé, vies, jauge d'énergie, puces des bonus actifs avec temps restant, barre de niveau, indicateur d'apprentissage des prédateurs, objectifs de stage.
- **Critères :** toutes les informations de jeu sont lisibles sans gêner la vue.

### T21 `[done]` Écrans HTML : titre, sélection, fin de partie, pause
- Titre : logo animé lettre par lettre, slogan, boutons Jouer / Stages / Boutique, rappel des touches, record.
- Sélection : carrousel de poissons (flèches, points, touches ← →) avec carte SVG animée, statistiques, évolution et capacité.
- Fin de partie : poisson mangé, score, niveau, proies mangées, taille et profondeur max, pièces/perles, record.
- Pause (**P** / **Échap**) : reprendre, recommencer, stages, boutique, réglages, volumes musique/effets, quitter.
- **Critères :** navigation complète au clavier et à la souris, adaptée aux petits écrans (media queries).

### T22 `[done]` Record et persistance simple
- Sauvegarde du meilleur score dans `localStorage` (`feBest`) avec gestion d'erreur si le stockage est indisponible.
- **Critères :** le record survit au rechargement de la page ; aucun crash en navigation privée.

---

## Phase 3 — Intelligence des prédateurs

### T23 `[done]` Chasse persistante (`Chase`)
- Verrouillage de cible avec **patience** (~9 s) qui s'épuise plus vite si la proie est loin ; mémoire de la dernière position connue ; fatigue (jusqu'à −18 % de vitesse) ; changement de cible si une autre est nettement plus proche.
- Garde-fous : plafond de poursuivants lointains selon le niveau, repos entre chasses, « miséricorde » après une morsure (`onBite`).
- **Critères :** un prédateur ne lâche pas sa proie dès qu'elle sort du cercle, mais abandonne après épuisement ; le joueur n'est jamais acculé sans répit.

### T24 `[done]` Apprentissage des habitudes du joueur (`Habits`)
- Carte de chaleur des zones fréquentées, carte de courants (direction habituelle), côté d'esquive favori, maturité qui monte de 0 à 100 % en ~1 minute, oubli lent.
- Trajectoire prédite sur 90 images (`path`), point d'interception (`lead`), patrouille vers les zones favorites (`patrolForce`), affichage debug (touche **D**).
- **Critères :** après une minute de jeu, les prédateurs visent devant le joueur et rôdent là où il aime aller ; `P.learn = 0` désactive tout.

### T25 `[done]` Prédateur spécial : requin-marteau
- `Hunter` (base commune) puis `HammerShark` : patrouille → alerte (se fige 34 images) → charge rectiligne sans correction → récupération.
- **Critères :** la charge est esquivable sur le côté ; l'alerte est visible.

### T26 `[done]` Prédateur spécial : murène
- `Moray` : embusquée dans un rocher (seuls les yeux brillent), contraction de 20 images, détente vers l'endroit où sera la proie, pause, retrait.
- **Critères :** un virage brusque suffit à l'éviter ; elle ne bouge pas du rocher.

### T27 `[done]` Prédateur spécial : barracuda (banc)
- `Barracuda` : chasse en banc, une proie vue = tout le banc la poursuit ; hors chasse, cohésion et alignement, plus lent.
- **Critères :** le banc chasse de façon coordonnée et nage en formation au repos.

### T28 `[done]` Prédateur spécial : orque (meute)
- `Orca` : phase 1 encerclement (chaque orque rejoint sa place sur un cercle autour de la proie), phase 2 attaque de tous côtés ~3 s, puis replacement (vagues d'attaque).
- **Critères :** la meute encercle avant d'attaquer ; les vagues se répètent.

### T29 `[done]` Population des prédateurs spéciaux
- `syncWild` / `syncPacks` : quantités selon les réglages et le niveau, apparition hors écran à distance minimale, création de bancs et de meutes.
- **Critères :** les réglages (touche S) ajoutent ou retirent des spéciaux en direct.

### T30 `[done]` Écosystème indépendant : les `Critter`
- Trois tailles (petits en banc / moyens / gros), espèces propres (Sardine, Poisson-clown, Chromis, Dorade, Bar, Bonite, Mérou, Napoléon).
- Règle unique « le plus gros mange le plus petit » : fuite avec sprint, bulles de panique et épuisement ; chasse seulement quand ils ont faim ; digestion après repas.
- **Critères :** on observe des poissons qui vivent leur vie, se chassent entre eux et fuient le joueur plus gros.

### T31 `[done]` Interactions de l'écosystème avec le reste du jeu
- `lifeThink` (les prédateurs libres chassent aussi les critters), `lifeEat` (qui mange qui, croissance, sons), `syncLife` (population maintenue, réglage « Vie sauvage »).
- Le joueur peut manger un critter assez petit (points bonus) ; les critters n'attaquent jamais le joueur.
- **Critères :** un prédateur sans cible mange un critter ; le score augmente quand le joueur en mange un.

---

## Phase 4 — Évolution et capacités

### T32 `[done]` Évolution du poisson en 3 stades
- `abilities.js` : Alevin → Adulte → Géant selon la croissance (`growthOf`, `stageOf`, seuils `STAGE_AT`).
- La silhouette change à chaque stade (`stageStyle` : proportions, nageoires, aura du géant), avec animation de transformation et son d'évolution.
- **Critères :** grossir déclenche l'évolution avec effet visuel et sonore.

### T33 `[done]` Capacités spéciales par espèce
- Touche **E** / Maj / clic droit / bouton rond : 🐟 banc de leurres (`Decoy`), 🌺 anémone refuge (invisible et immunisé, prédateurs piqués), 💥 coup de queue (onde de choc, repousse et étourdit), 💡 flash (aveugle les prédateurs).
- Débloquées au stade Adulte, plus puissantes et plus rapides à recharger au stade Géant ; recharge affichée.
- **Critères :** chaque capacité a un effet mesurable sur les prédateurs et un temps de recharge.

### T34 `[done]` Effets de statut sur les prédateurs et ciblage
- `stunHunter`, `blindHunter`, `Abil.targets` / `sightFor` : un prédateur aveuglé ne voit rien ; un poisson caché dans le kelp ou l'anémone est invisible ; les leurres attirent les poursuites.
- **Critères :** un prédateur aveuglé perd sa cible ; un leurre détourne un requin.

---

## Phase 5 — Monde vivant

### T35 `[done]` Biomes et fond jour/nuit
- `world.js` : 5 biomes (Récif, Kelp, Épaves, Grotte, Abysse), teinte par zone, dégradé de fond par profondeur, **cycle jour/nuit** (7200 images), palette de nuit.
- **Critères :** la couleur change avec la profondeur et le biome ; la nuit tombe progressivement.

### T36 `[done]` Décor animé et parallaxe
- Algues qui ondulent (forêt de kelp qui cache les poissons), coraux, corniche rocheuse, stalactites/spires, cristaux, bancs d'arrière-plan, poussières lumineuses, rayons de lumière, neige marine en parallaxe.
- **Critères :** le décor bouge à des vitesses différentes selon la profondeur.

### T37 `[done]` Événements dynamiques
- Tempête, tourbillon, éruption hydrothermale ; annonce par bannière et son dédié.
- **Critères :** un événement se déclenche périodiquement avec annonce, effet et fin propres.

### T38 `[done]` Épaves, coffres au trésor et poissons nocturnes
- Épaves avec obstacles invisibles, coffres à ouvrir (pièces/perles), `NightFish` (poisson lumineux nocturne, 25 points), cristaux lumineux.
- **Critères :** ouvrir un coffre donne des récompenses avec son d'arpège ; les poissons lumineux n'apparaissent que la nuit.

### T39 `[done]` Éclairage dynamique et obscurité
- `gatherLights`, `darkness` : obscurité ambiante selon la profondeur/biome, trouée par les poissons lumineux, cristaux et sources ; la Lanterne voit plus loin dans le noir. Cache pour limiter le coût.
- **Critères :** dans la grotte et les abysses, seules les sources de lumière révèlent l'environnement.

---

## Phase 6 — Économie et boutique

### T40 `[done]` Pièces 🪙 et perles
- `shop.js` (objet `Eco`) : pièces en traînées, lâchées par des proies, coffres, poisson doré ; perles rares en profondeur ; aimant, ramassage, renouvellement, sons.
- **Critères :** les ressources se ramassent et s'affichent par partie et au total.

### T41 `[done]` Améliorations permanentes
- Vitesse, endurance, aimant, chasseur de trésors, poches pleines (pièces) ; cœur supplémentaire, bouclier de départ, capacités rapides, bonus prolongés, chasseur de points, plongeur de perles (perles) ; prix croissants par niveau.
- **Critères :** chaque amélioration modifie le gameplay selon sa description.

### T42 `[done]` Poissons à débloquer et skins
- 4 poissons achetables (cartes verrouillées avec cadenas) ; 7 skins cosmétiques (Classique, Doré, Rubis, Émeraude, Améthyste, Néon, Fantôme).
- **Critères :** un poisson verrouillé ne peut pas être joué ; un skin change couleur et aura.

### T43 `[done]` Objets à usage unique et achats immédiats
- Objets emportés en partie (touches **1–5** ou boutons) : bulle de survie, potion aimant, fiole turbo, parchemin ×2, sablier, seconde chance automatique.
- Achats en partie : +1 vie, bouclier 8 s, frénésie 6 s.
- **Critères :** consommation correcte du stock ; achat refusé si fonds insuffisants.

### T44 `[done]` Interface de la boutique et sauvegarde
- Boutique à onglets (touche **B** en jeu, ou depuis titre/pause/fin) ; portefeuille, pips de niveau, prix, états (achetable / insuffisant / max) ; bouton de réinitialisation.
- Sauvegarde dans `localStorage` (`feWallet`) à chaque achat, à la fermeture de page et au passage en arrière-plan.
- **Critères :** achats et portefeuille persistent d'une partie à l'autre.

---

## Phase 7 — Mode Stages

### T45 `[done]` Données des 5 stages
- `stages.js` : Récif corallien, Forêt de kelp, Cimetière d'épaves, Grotte sous-marine, Fosse abyssale ; chacun avec nom, icône, boss, objectifs, seuils d'étoiles, point de départ, rochers.
- **Critères :** chaque stage a une identité et une difficulté croissantes.

### T46 `[done]` Écosystème propre à chaque stage
- Densités par « surface d'écran » (proies, requins, baudroies, méduses, calmars, marteaux, murènes, barracudas, orques, critters) ; espèces additionnelles `CRIT_X` ; réglages de caractère `ECO_EXTRA` (récif calme → abysses impitoyables).
- **Critères :** les populations diffèrent nettement d'un stage à l'autre.

### T47 `[done]` Visuels propres aux stages
- `World.stages` : taille de carte, palette jour/nuit, obscurité, rayons, événements autorisés, cycle jour/nuit activé ou non, décor spécifique.
- **Critères :** chaque stage a sa palette, son décor et son niveau d'obscurité.

### T48 `[done]` Objectifs et suivi en jeu
- Types d'objectifs : manger N poissons, trouver N perles, ramasser N pièces, ouvrir N coffres, devenir adulte/géant ; bandeau d'introduction, toast de validation, barres d'avancement.
- **Critères :** les objectifs se valident automatiquement (+150 points) ; le boss apparaît quand tous sont remplis.

### T49 `[done]` Étoiles, score final, déblocage et récompenses
- Score final = score + 150 par vie restante + bonus du boss ; 1★ = terminé, 2★/3★ selon les seuils ; le stage suivant se débloque à la première victoire ; récompenses de pièces et de perles ; sauvegarde (`feStages`).
- **Critères :** les étoiles ne baissent jamais ; le déblocage persiste.

### T50 `[done]` Écran de sélection des stages
- Cartes avec icône, sous-titre, étoiles, meilleur score, cadenas ; paramètre d'URL `?stage=` pour entrer directement.
- **Critères :** un stage verrouillé n'est pas lançable.

### T51 `[done]` Écran de victoire
- Résumé animé (score, bonus de vies, bonus boss, étoiles, nouveau record, récompenses), boutons Stage suivant / Rejouer / Stages / Boutique, touche Entrée.
- **Critères :** après le dernier stage, le bouton devient « Dernier stage terminé » et renvoie à la liste.

---

## Phase 8 — Boss

### T52 `[done]` Classe de base `BossBase`
- Barre de vie, 3 phases (100 % → 66 % → 33 %), cycle entrée → rôde → **annonce** (texte + télégraphie) → attaque → **fenêtre de vulnérabilité** → rôde.
- Dégâts : morsure pendant la fenêtre (plus fort après évolution), frénésie au contact ; hors fenêtre, toucher le boss coûte une vie.
- **Critères :** chaque attaque est annoncée avant d'être lancée ; le boss est blessable seulement aux moments prévus.

### T53 `[done]` Boss du Récif : requin-marteau colossal
- Charges simple, double, triple + séisme.
- **Critères :** les charges sont esquivables ; le séisme est télégraphié.

### T54 `[done]` Boss du Kelp : murène géante
- Embuscade (surgit d'en dessous) + crachats d'acide.
- **Critères :** l'embuscade est annoncée ; les crachats sont esquivables.

### T55 `[done]` Boss des Épaves : orque géante
- Sonar (ondes) + meute d'orques invoquée (disparaît avec le boss ou après ~18 s) + éperonnage.
- **Critères :** la meute invoquée est limitée à 4 ; l'éperonnage est télégraphié.

### T56 `[done]` Boss de la Grotte : baudroie géante
- Leurre qui **attire** le joueur + lueurs téléguidées + élan.
- **Critères :** l'attraction est contrable (sprint, capacités) ; les lueurs disparaissent après une durée de vie.

### T57 `[done]` Boss des Abysses : mégalodon
- Charges en série + rugissements (ondes qui vident le sprint).
- **Critères :** le combat final est plus intense que les précédents ; la victoire déclenche l'écran de fin de stage.

### T58 `[done]` Gestionnaire de boss (`Boss`)
- Apparition à distance du joueur, alerte plein écran, ondes de choc, projectiles, flèches de danger, bonus donnés pendant le combat, réduction temporaire des prédateurs ordinaires, branchement sur `Stage.hooks.spawnBoss`.
- Les boss vivent dans le tableau `wild` : étourdissement, aveuglement, tension musicale fonctionnent sans modification ; seuls les contacts sont gérés par `Boss.step` (les boss sont ignorés par la logique de morsure générale via `isBoss`).
- **Critères :** battre le boss termine le stage ; mourir pendant le combat renvoie à l'écran de fin.

---

## Phase 9 — Audio

### T59 `[done]` Moteur audio synthétisé (WebAudio)
- `audio.js` : `tone`, `noise`, arpèges, LFO, bus musique/effets, panoramique stéréo selon la position de la source ; aucun fichier audio externe.
- Gestion du blocage de l'audio par le navigateur (message invitant à cliquer).
- **Critères :** le son démarre au premier clic ; aucun échec si l'audio est indisponible.

### T60 `[done]` Ambiance et musique adaptative
- Ambiance de fond, musique pilotée par la **profondeur** (écho, tonalité) et la **tension** (distance du prédateur le plus proche) ; alerte douce « bu-bup » qui s'accélère à l'approche du danger.
- **Critères :** la musique devient plus tendue quand un prédateur approche et s'apaise en son absence.

### T61 `[done]` Effets sonores et contrôles
- Sons : clic, manger, sprint, bonus, pièce, perle, coffre, évolution, capacités, événements, niveau, achat, refus, fin de partie, morsure, etc.
- Bouton 🔊 et touche **M** (mute) ; curseurs musique / effets dans le menu pause.
- **Critères :** chaque action importante a un retour sonore ; le mute est immédiat.

---

## Phase 10 — Finitions et robustesse

### T62 `[done]` Outils de debug et raccourcis de test
- Touche **D** : vecteurs de force, points d'anticipation, carte de chaleur et trajectoire prédite ; HUD debug.
- Paramètres d'URL : `?stage=1..5` (ou `reef|kelp|wreck|cave|abyss`) et `&boss=1` pour faire apparaître directement le boss.
- **Critères :** on peut tester n'importe quel stage ou boss sans rejouer les précédents.

### T63 `[done]` Responsive et robustesse
- `windowResized`, media queries (hauteurs < 820 px et < 680 px, largeur < 560 px), garde-fous `try/catch` sur `localStorage` et audio, protection contre l'état incohérent (boutique ouverte, victoire en cours, pause).
- **Critères :** le jeu reste utilisable du petit écran au grand écran ; aucune exception non gérée au changement d'écran.

### T64 `[done]` Optimisation finale
- Simulation et dessin limités aux entités proches de l'écran, dessin simplifié des foules, recalcul du flocking à 1 image sur 3 loin de l'écran, calculs lumineux et d'obscurité mis en cache, réutilisation d'objets pour éviter le ramasse-miettes.
- **Critères :** le jeu reste fluide avec les valeurs par défaut en carte libre comme en stage.

---

## Récapitulatif

| Phase | Tâches | Statut |
|---|---|---|
| 0 — Socle technique | T01–T04 | `[done]` |
| 1 — Entités et rendu | T05–T11 | `[done]` |
| 2 — Boucle de jeu | T12–T22 | `[done]` |
| 3 — Intelligence des prédateurs | T23–T31 | `[done]` |
| 4 — Évolution et capacités | T32–T34 | `[done]` |
| 5 — Monde vivant | T35–T39 | `[done]` |
| 6 — Économie et boutique | T40–T44 | `[done]` |
| 7 — Mode Stages | T45–T51 | `[done]` |
| 8 — Boss | T52–T58 | `[done]` |
| 9 — Audio | T59–T61 | `[done]` |
| 10 — Finitions | T62–T64 | `[done]` |

**Total : 64 tâches — 64 `[done]`, 0 `[todo]`.**
