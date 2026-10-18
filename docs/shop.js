// =====================================================================
//  shop.js — économie du jeu : pièces 🪙 et perles à ramasser, boutique pour les dépenser
//
//  • Pièces : en petites traînées dans tout l'océan, lâchées par certaines proies, les coffres, le poisson doré.
//  • Perles : rares, cachées en profondeur, dans les coffres, sur les prédateurs mangés en frénésie.
//  • Le portefeuille et les améliorations sont SAUVEGARDÉS (localStorage) : ils restent d'une partie à l'autre.
//  • Boutique : touche B en jeu, ou boutons depuis le titre / la pause / l'écran de fin.
//      – Améliorations permanentes (niveaux, prix croissants)
//      – Achats immédiats (disponibles seulement pendant une partie)
// =====================================================================
const Eco = (() => {
  const KEY = 'feWallet';
  // ---- Améliorations permanentes ----
  const UPS = [
    { id: 'speed', icon: '💨', name: 'Nageoires turbo', desc: 'Tu nages plus vite.', cur: 'coins', costs: [60, 130, 240, 400, 600, 850, 1150, 1500], fmt: l => `+${l * 4} % de vitesse` },
    { id: 'stamina', icon: '🫁', name: 'Endurance', desc: 'Le sprint consomme moins et se recharge plus vite.', cur: 'coins', costs: [50, 110, 200, 330, 500, 700, 950], fmt: l => `−${l * 9} % conso · +${l * 14} % recharge` },
    { id: 'magnet', icon: '🧲', name: 'Aimant à trésors', desc: 'Attire les pièces et les perles de plus loin.', cur: 'coins', costs: [40, 90, 160, 260, 400, 580, 800], fmt: l => `${40 + l * 38} px` },
    { id: 'luck', icon: '🍀', name: 'Chasseur de trésors', desc: 'Les proies que tu manges lâchent plus souvent des pièces.', cur: 'coins', costs: [80, 160, 280, 440, 650, 900, 1200], fmt: l => `${10 + l * 4} % de chance` },
    { id: 'rich', icon: '💰', name: 'Poches pleines', desc: 'Chaque pièce ramassée vaut plus.', cur: 'coins', costs: [90, 200, 360, 600, 900], fmt: l => `+${l * 15} % de valeur` },
    { id: 'life', icon: '❤', name: 'Cœur supplémentaire', desc: 'Tu commences chaque partie avec une vie de plus.', cur: 'pearls', costs: [4, 9], fmt: l => `${3 + l} vies au départ` },
    { id: 'shield', icon: '🛡', name: 'Bouclier de départ', desc: 'Une bulle protectrice au début de chaque partie.', cur: 'pearls', costs: [2, 4, 7, 11], fmt: l => l ? `${l * 4} s` : 'aucun' },
    { id: 'cd', icon: '⏱', name: 'Capacités rapides', desc: 'Ta capacité spéciale (E) se recharge plus vite.', cur: 'pearls', costs: [3, 5, 8, 12, 18], fmt: l => `−${l * 10} % de recharge` },
    { id: 'dur', icon: '⌛', name: 'Bonus prolongés', desc: 'Les bonus ramassés (et tes objets) durent plus longtemps.', cur: 'pearls', costs: [3, 6, 10, 14], fmt: l => `+${l * 20} % de durée` },
    { id: 'score', icon: '⭐', name: 'Chasseur de points', desc: 'Tous les points gagnés sont augmentés.', cur: 'pearls', costs: [4, 8, 14, 20, 28], fmt: l => `+${l * 10} % de score` },
    { id: 'pearlc', icon: '🦪', name: 'Plongeur de perles', desc: 'Les proies que tu manges peuvent lâcher une perle.', cur: 'pearls', costs: [5, 9, 14], fmt: l => `${(l * 1.2).toFixed(1)} % de chance` },
  ];
  // ---- Skins (cosmétiques, valables pour tous les poissons) ----
  const SKINS = [
    { id: '', name: 'Classique', col: null, cur: 'coins', cost: 0 },
    { id: 'gold', name: 'Doré', col: '#ffcf33', cur: 'coins', cost: 120 },
    { id: 'ruby', name: 'Rubis', col: '#ff4466', cur: 'coins', cost: 150 },
    { id: 'emer', name: 'Émeraude', col: '#2fd47a', cur: 'coins', cost: 150 },
    { id: 'amet', name: 'Améthyste', col: '#b46bff', cur: 'pearls', cost: 3 },
    { id: 'neon', name: 'Néon', col: '#39f0ff', glow: true, cur: 'pearls', cost: 5 },
    { id: 'ghost', name: 'Fantôme', col: '#e8f4ff', glow: true, cur: 'pearls', cost: 8 },
  ];
  // ---- Objets à usage unique : achetés à l'avance, emportés en partie (touches 1 à 5 ou boutons à l'écran) ----
  const ITEM_MAX = 9;
  const ITEMS = [
    { id: 'bubble', key: 'shield', icon: '🛡', name: 'Bulle de survie', desc: 'Intouchable pendant 10 s.', cur: 'coins', cost: 60, dur: 600 },
    { id: 'magnetp', key: 'magnet', icon: '🧲', name: 'Potion aimant', desc: 'Attire tous les trésors proches pendant 15 s.', cur: 'coins', cost: 45, dur: 900 },
    { id: 'turbop', key: 'turbo', icon: '⚡', name: 'Fiole turbo', desc: 'Vitesse maximale pendant 10 s.', cur: 'coins', cost: 55, dur: 600 },
    { id: 'scroll', key: 'double', icon: '×2', name: 'Parchemin ×2', desc: 'Score doublé pendant 20 s.', cur: 'pearls', cost: 3, dur: 1200 },
    { id: 'timep', key: 'slow', icon: '⏳', name: 'Sablier', desc: 'Ralentit le temps pendant 8 s.', cur: 'pearls', cost: 2, dur: 480 },
    { id: 'revive', icon: '💖', name: 'Seconde chance', desc: 'Automatique : quand tu es mangé, tu reviens avec 1 vie et un bouclier.', cur: 'pearls', cost: 8, auto: true },
  ];
  // ---- Achats immédiats (en partie) ----
  const NOW = [
    { id: 'heal', icon: '❤', name: '+1 vie', desc: 'Récupère une vie (maximum 5).', cur: 'pearls', cost: 3, ok: () => lives < 5, apply: () => { lives = Math.min(5, lives + 1); } },
    { id: 'shield', icon: '🛡', name: 'Bouclier 8 s', desc: 'Intouchable pendant 8 secondes.', cur: 'coins', cost: 40, ok: () => true, apply: () => { fx.shield = Math.max(fx.shield, 480); } },
    { id: 'frenzy', icon: '🔥', name: 'Frénésie 6 s', desc: 'Mange même les prédateurs pendant 6 secondes.', cur: 'coins', cost: 70, ok: () => true, apply: () => { fx.frenzy = Math.max(fx.frenzy, 360); } },
  ];

  let W = { coins: 0, pearls: 0, up: {}, fish: {}, skins: {}, skin: '', items: {} }, dirty = false, run = { coins: 0, pearls: 0 };
  let items = [], spawnT = 0, targetC = 0, targetP = 0, lastSnd = -9, ret = null, isOpen = false;

  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') W = { coins: +s.coins || 0, pearls: +s.pearls || 0, up: s.up || {}, fish: s.fish || {}, skins: s.skins || {}, skin: s.skin || '', items: s.items || {} }; } catch (e) { }
  const save = () => { dirty = false; try { localStorage.setItem(KEY, JSON.stringify(W)); } catch (e) { } };
  addEventListener('pagehide', save); addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  const lv = id => Math.min(W.up[id] | 0, (UPS.find(u => u.id === id) || { costs: [] }).costs.length);

  // ---------------- Apparition des trésors ----------------
  const free = (x, y) => {
    if (x < 40 || x > WW - 40 || y < 40 || y > WH - 30) return false;
    for (const o of obstacles) { const dx = x - o.pos.x, dy = y - o.pos.y, rr = o.r + 14; if (dx * dx + dy * dy < rr * rr) return false; }
    return true;
  };
  function spot(y0, y1, avoid = 0) {
    for (let i = 0; i < 14; i++) {
      const x = random(60, WW - 60), y = random(y0, y1);
      if (free(x, y) && (!avoid || !player || dist(x, y, player.pos.x, player.pos.y) > avoid)) return { x, y };
    }
    return null;
  }
  const mk = (x, y, v, p) => ({ x, y, v, p, ph: random(TWO_PI), vx: 0, vy: 0 });
  // Traînée de pièces (légèrement courbe) ; certaines sont des pièces « lingot » qui valent 5
  function cluster(n, avoid = 0) {
    const s = spot(WH * .06, WH - 50, avoid); if (!s) return;
    let x = s.x, y = s.y, ang = random(TWO_PI); const curve = random(-.25, .25);
    for (let i = 0; i < n; i++) {
      if (free(x, y)) items.push(mk(x, y, random() < .08 ? 5 : 1, false));
      ang += curve; x += Math.cos(ang) * 22; y += Math.sin(ang) * 22;
    }
  }
  function pearlSpawn(avoid = 0) { const s = spot(WH * .45, WH - 40, avoid); if (s) items.push(mk(s.x, s.y, 1, true)); }
  // Éclaboussure de pièces / perles (loot)
  function burst(x, y, n, pearl) {
    for (let i = 0; i < n; i++) { const a = random(TWO_PI), s = random(1.5, 4.5), c = mk(x, y, 1, pearl); c.vx = Math.cos(a) * s; c.vy = Math.sin(a) * s; items.push(c); }
    while (items.length > 700) items.shift();
  }
  const count = p => { let n = 0; for (const c of items) if (c.p === p) n++; return n; };

  function onStart() {
    items = []; run = { coins: 0, pearls: 0 }; spawnT = 0;
    const a = A(); targetC = Math.round(7 * a); targetP = Math.max(6, Math.round(.7 * a));
    for (let n = 0, g = 0; n < targetC && g < 120; g++) { const k = Math.floor(random(4, 9)), b = items.length; cluster(k); n += items.length - b; }
    for (let i = 0; i < targetP; i++) pearlSpawn();
    fx.shield = Math.max(fx.shield, 240 * lv('shield'));
    renderItems();
  }

  // ---------------- Boucle de jeu ----------------
  function step() {
    if (!player) return;
    const px = player.pos.x, py = player.pos.y, mr = 40 + lv('magnet') * 38 + (fx.magnet ? 260 : 0), pr = player.r + 16;
    for (let i = items.length - 1; i >= 0; i--) {
      const c = items[i];
      if (c.vx || c.vy) { c.x += c.vx; c.y += c.vy; c.vx *= .92; c.vy *= .92; if (Math.abs(c.vx) < .03 && Math.abs(c.vy) < .03) c.vx = c.vy = 0; }
      const dx = px - c.x, dy = py - c.y, d2 = dx * dx + dy * dy;
      if (d2 < mr * mr) { const d = Math.sqrt(d2) || 1, s = (1 - d / mr) * 7 + 1.5; c.x += dx / d * s; c.y += dy / d * s; }
      if (d2 < pr * pr) {
        items.splice(i, 1); dirty = true;
        if (c.p) { W.pearls++; run.pearls++; floatText(c.x, c.y - 14, '+1 perle', '#f1dcff'); snd.pearl(panOf(c.x)); bubblesAt({ x: c.x, y: c.y }); }
        else { const v = Math.round(c.v * (1 + .15 * lv('rich'))); W.coins += v; run.coins += v; floatText(c.x, c.y - 12, `+${v}`, '#ffd54a'); if (frameCount - lastSnd > 3) { lastSnd = frameCount; snd.coin(panOf(c.x)); } }
      }
    }
    if (++spawnT > 180) {   // le trésor se renouvelle doucement, hors de l'écran
      spawnT = 0;
      if (count(false) < targetC * .75) cluster(Math.floor(random(3, 7)), 700);
      if (count(true) < targetP * .6 && random() < .5) pearlSpawn(700);
    }
    if (dirty && frameCount % 90 === 0) save();
  }

  // ---------------- Dessin ----------------
  function draw() {
    noStroke();
    for (const c of items) {
      if (!vis(c, 40)) continue;
      const y = c.y + Math.sin(frameCount * .05 + c.ph) * 3;
      if (c.p) {
        const ctx = drawingContext, r = 8 + Math.sin(frameCount * .08 + c.ph) * .6;
        ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(255,230,255,.9)';
        const g = ctx.createRadialGradient(c.x - r * .35, y - r * .35, 1, c.x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#f1dcff'); g.addColorStop(1, '#b9a3e8');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if ((frameCount + c.ph * 40 | 0) % 90 < 10) { fill(255, 255, 255, 230); rect(c.x - 1, y - r - 5, 2, 10, 1); rect(c.x - 5, y - r, 10, 2, 1); }
      } else {
        const w = Math.max(.2, Math.abs(Math.cos(frameCount * .07 + c.ph))), r = c.v > 1 ? 10 : 7;
        fill(176, 120, 12); ellipse(c.x, y, r * 2 * w, r * 2);
        fill(255, 213, 74); ellipse(c.x, y, r * 1.62 * w, r * 1.62);
        fill(255, 244, 176, 210); ellipse(c.x - r * .2 * w, y - r * .25, r * .5 * w, r * .5);
      }
    }
  }
  function lights(add, near) { for (const c of items) if (c.p && near(c.x, c.y)) add(c.x, c.y, 90, [255, 235, 250], .5); }
  function mini(sx, sy) {
    noStroke();
    fill(255, 213, 74, 190); for (const c of items) if (!c.p) rect(c.x * sx, c.y * sy, 1.5, 1.5);
    fill(255, 255, 255); for (const c of items) if (c.p) circle(c.x * sx, c.y * sy, 3.5);
  }
  function hud() {
    push(); noStroke();
    const pill = (y, n, drawIcon, col) => {
      textSize(16); textStyle(BOLD); const w = 38 + textWidth(String(n)) + 14, x = width - 12 - w;
      drawingContext.save(); drawingContext.shadowBlur = 14; drawingContext.shadowColor = 'rgba(0,0,0,.4)';
      fill(4, 22, 48, 175); stroke(127, 214, 255, 80); strokeWeight(1.2); rect(x, y, w, 28, 14); drawingContext.restore();
      noStroke(); drawIcon(x + 18, y + 14); fill(col); textAlign(RIGHT, CENTER); text(n, x + w - 12, y + 15);
    };
    pill(62, W.coins, (x, y) => { fill(176, 120, 12); circle(x, y, 18); fill(255, 213, 74); circle(x, y, 14); fill(255, 244, 176, 220); circle(x - 2, y - 3, 4); }, color(255, 232, 140));
    pill(96, W.pearls, (x, y) => { drawingContext.save(); drawingContext.shadowBlur = 8; drawingContext.shadowColor = 'rgba(255,230,255,.9)'; fill(241, 220, 255); circle(x, y, 16); drawingContext.restore(); fill(255); circle(x - 2, y - 3, 4); }, color(241, 220, 255));
    fill(255, 130); textSize(10); textStyle(NORMAL); textAlign(RIGHT, CENTER); text('B : boutique', width - 14, 136);
    pop();
  }

  // ---------------- Boutique (interface HTML) ----------------
  const $e = id => document.getElementById(id);
  const cost = u => u.costs[lv(u.id)];
  const can = (cur, n) => W[cur] >= n;
  const ico = cur => `<i class="${cur === 'coins' ? 'coin' : 'pearl'}"></i>`;
  const TABS = [['up', '⬆ Améliorations'], ['items', '🎒 Objets'], ['skins', '🎨 Skins'], ['fish', '🐠 Poissons']];
  let tab = 'up';
  const MAN = ITEMS.filter(i => !i.auto);
  const nItem = id => W.items[id] | 0;
  const owns = sp => !sp.price || !!W.fish[sp.name];
  const skinOwned = k => !k.id || !!W.skins[k.id];
  const skin = () => SKINS.find(k => k.id && k.id === W.skin) || null;

  function render() {
    const inGame = ret === 'game';
    if (!TABS.some(t => t[0] === tab)) tab = 'up';
    const pips = u => u.costs.map((_, i) => `<span class="${i < lv(u.id) ? 'on' : ''}"></span>`).join('');
    const buyBtn = (attr, c, cur, ok) => `<button class="buy${ok ? '' : ' no'}" ${attr}>${c}${ico(cur)}</button>`;
    const upCard = u => {
      const l = lv(u.id), maxed = l >= u.costs.length, c = maxed ? 0 : cost(u), ok = !maxed && can(u.cur, c);
      return `<div class="up${maxed ? ' maxed' : ''}"><div class="ui">${u.icon}</div><div class="ut"><b>${u.name}</b><div class="pips">${pips(u)}</div><small>${u.desc}</small><em>${u.fmt(l)}${maxed ? ' · MAX' : ' → ' + u.fmt(l + 1)}</em></div>${maxed ? '<button class="buy max" disabled>MAX</button>' : buyBtn(`data-up="${u.id}"`, c, u.cur, ok)}</div>`;
    };
    const nowCard = n => { const ok = n.ok() && can(n.cur, n.cost); return buyBtn(`data-now="${n.id}"`, n.cost, n.cur, ok).replace(/^/, `<div class="up"><div class="ui">${n.icon}</div><div class="ut"><b>${n.name}</b><small>${n.desc}</small></div>`) + '</div>'; };
    const itemCard = it => {
      const n = nItem(it.id), full = n >= ITEM_MAX, ok = !full && can(it.cur, it.cost), k = it.auto ? 'automatique' : 'touche ' + (MAN.indexOf(it) + 1);
      return `<div class="up"><div class="ui">${it.icon}</div><div class="ut"><b>${it.name} <span class="cnt">×${n}</span></b><small>${it.desc}</small><em>${k}${full ? ' · stock plein' : ''}</em></div>${full ? '<button class="buy max" disabled>MAX</button>' : buyBtn(`data-item="${it.id}"`, it.cost, it.cur, ok)}</div>`;
    };
    const skinCard = k => {
      const own = skinOwned(k), on = (W.skin || '') === k.id, base = SPECIES[0], col = k.col || base.col;
      const btn = own ? (on ? '<button class="buy max" disabled>✔ Équipé</button>' : `<button class="buy" data-equip="${k.id}">Équiper</button>`) : buyBtn(`data-skin="${k.id}"`, k.cost, k.cur, can(k.cur, k.cost));
      return `<div class="up${on ? ' maxed' : ''}"><div class="fi" style="--c:${col}">${fishSVG({ ...base, col, glow: !!k.glow })}</div><div class="ut"><b>${k.name}</b><small>${k.glow ? 'Brille dans les profondeurs' : 'Nouvelle couleur'}</small><em>${own ? (on ? 'Équipé' : 'Possédé') : 'À acheter'}</em></div>${btn}</div>`;
    };
    const fishCard = s => {
      const own = owns(s), ab = ABIL[s.abil];
      return `<div class="up${own ? ' maxed' : ''}"><div class="fi" style="--c:${s.col}">${fishSVG(s)}</div><div class="ut"><b>${s.name}</b><small>${s.info} · ${ab.icon} ${ab.name}</small><em>${own ? 'Débloqué' : 'Verrouillé'}</em></div>${own ? '<button class="buy max" disabled>✔</button>' : buyBtn(`data-fish="${s.name}"`, s.price, 'pearls', can('pearls', s.price))}</div>`;
    };
    const head = `<div class="shophead"><h2>🛒 Boutique</h2><div class="wallet"><span><i class="coin"></i><b>${W.coins}</b></span><span><i class="pearl"></i><b>${W.pearls}</b></span></div></div>`;
    const tabs = `<div class="tabs">${TABS.map(([id, l]) => `<button class="tab${id === tab ? ' on' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>`;
    let body;
    if (tab === 'up') body = `<h4>Améliorations permanentes <small>(sauvegardées)</small></h4><div class="shopgrid">${UPS.map(upCard).join('')}</div>`;
    else if (tab === 'items') body = (inGame ? `<h4>Achats immédiats</h4><div class="shopgrid">${NOW.map(nowCard).join('')}</div>` : '') +
      `<h4>Objets à usage unique <small>(emportés en partie · touches 1 à 5 ou boutons à l'écran)</small></h4><div class="shopgrid">${ITEMS.map(itemCard).join('')}</div>`;
    else if (tab === 'skins') body = `<h4>Skins <small>(valables pour tous les poissons)</small></h4><div class="shopgrid">${SKINS.map(skinCard).join('')}</div>`;
    else body = `<h4>Poissons à débloquer <small>(achat définitif, en perles)</small></h4><div class="shopgrid">${SPECIES.filter(s => s.price).map(fishCard).join('')}</div>`;
    const box = $e('shop_body').parentElement, top = box.scrollTop;
    $e('shop_body').innerHTML = head + tabs + body;
    box.scrollTop = top;
  }

  function buyFish(name) {
    const s = SPECIES.find(x => x.name === name);
    if (!s || owns(s)) return false;
    if (!can('pearls', s.price)) { snd.deny(); return false; }
    W.pearls -= s.price; W.fish[name] = true; save(); snd.buy(); return true;
  }

  function buy(e) {
    const t = e.target.closest('.tab'); if (t) { tab = t.dataset.tab; snd.tick(); render(); return; }
    const b = e.target.closest('.buy'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.up) {
      const u = UPS.find(x => x.id === d.up), l = lv(u.id);
      if (l >= u.costs.length || !can(u.cur, u.costs[l])) return snd.deny();
      W[u.cur] -= u.costs[l]; W.up[u.id] = l + 1; save(); snd.buy(); render();
    } else if (d.now) {
      const n = NOW.find(x => x.id === d.now);
      if (!n.ok() || !can(n.cur, n.cost)) return snd.deny();
      W[n.cur] -= n.cost; n.apply(); save(); snd.buy(); render();
    } else if (d.item) {
      const it = ITEMS.find(x => x.id === d.item);
      if (nItem(it.id) >= ITEM_MAX || !can(it.cur, it.cost)) return snd.deny();
      W[it.cur] -= it.cost; W.items[it.id] = nItem(it.id) + 1; save(); snd.buy(); renderItems(); render();
    } else if (d.skin) {
      const k = SKINS.find(x => x.id === d.skin);
      if (skinOwned(k) || !can(k.cur, k.cost)) return snd.deny();
      W[k.cur] -= k.cost; W.skins[k.id] = true; W.skin = k.id; save(); snd.buy(); render();
    } else if (d.equip !== undefined) {
      W.skin = d.equip; save(); snd.buy(); render();
    } else if (d.fish) {
      if (buyFish(d.fish)) render();
    }
  }

  // ---------------- Objets à usage unique ----------------
  let barShown = false;
  function renderItems() {
    const bar = $e('items'); if (!bar) return;
    const man = MAN.map((it, i) => nItem(it.id) ? `<button data-i="${i}" title="${it.name} — touche ${i + 1}"><span>${it.icon}</span><kbd>${i + 1}</kbd><b>×${nItem(it.id)}</b></button>` : '').join('');
    const rv = nItem('revive') ? `<div class="rv" title="Seconde chance (automatique)">💖<b>×${nItem('revive')}</b></div>` : '';
    bar.innerHTML = man + rv; bar.dataset.n = (man + rv) ? '1' : '0';
  }
  function syncBar() {
    const bar = $e('items'); if (!bar) return;
    const show = state === 'play' && !paused && !isOpen && bar.dataset.n === '1';
    if (show !== barShown) { barShown = show; bar.classList.toggle('hide', !show); }
  }
  function useItem(i) {
    const it = MAN[i];
    if (!it || state !== 'play' || paused || isOpen || !player) return;
    if (!nItem(it.id)) return snd.deny();
    if (fx[it.key] > 120) { floatText(player.pos.x, player.pos.y - 40, 'Déjà actif', '#ccc'); return snd.deny(); }
    W.items[it.id]--; save(); renderItems();
    fx[it.key] = Math.max(fx[it.key], Math.round(it.dur * (1 + .2 * lv('dur'))));
    const d = PUPS[it.key]; floatText(player.pos.x, player.pos.y - 40, d.n, d.c); bubblesAt(player.pos); snd.power(it.key);
  }
  function revive() {
    if (nItem('revive') < 1) return false;
    W.items.revive--; save(); renderItems(); return true;
  }

  function open(from, t) {
    if (from === 'game') { if (state !== 'play' || paused) return; setPause(true); }
    if (t) tab = t;
    ret = from; isOpen = true; render(); showScreen('shop');
  }
  function close() {
    if (!isOpen) return; isOpen = false;
    if (ret === 'title') showScreen('title');
    else if (ret === 'over') showScreen('over');
    else if (ret === 'pause') showScreen('pausemenu');
    else if (ret === 'select') { showScreen('select'); renderCard(); }
    else if (ret === 'stages') { renderStages(); showScreen('stages'); }
    else if (ret === 'win') showScreen('winscr');
    else { showScreen(null); setPause(false); }
    ret = null;
  }
  function initUI() {
    $e('shop_body').addEventListener('click', buy);
    $e('shop_close').onclick = close;
    $e('shop_t').onclick = () => open('title');
    $e('p_shop').onclick = () => open('pause');
    $e('shop_o').onclick = () => open('over');
    $e('stg_shop').onclick = () => open('stages');
    $e('w_shop').onclick = () => open('win');
    $e('shop_reset').onclick = () => {
      if (!confirm('Effacer toutes tes pièces, perles, améliorations, poissons, skins et objets ?')) return;
      W = { coins: 0, pearls: 0, up: {}, fish: {}, skins: {}, skin: '', items: {} }; save(); render(); renderItems();
    };
    const bar = $e('items');
    ['mousedown', 'touchstart', 'pointerdown'].forEach(ev => bar.addEventListener(ev, e => e.stopPropagation()));   // cliquer un objet ne déclenche pas le sprint
    bar.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { useItem(+b.dataset.i); b.blur(); } });
    renderItems(); setInterval(syncBar, 150);
  }

  return {
    onStart, step, draw, lights, mini, hud, initUI, open, close, save,
    isOpen: () => isOpen,
    get run() { return run; },
    lv,
    // poissons, skins, objets
    owns, buyFish, useItem, revive, skinOwned, skins: SKINS,
    skin, skinId: () => W.skin || '', setSkin: id => { W.skin = id; save(); },
    wallet: () => W,
    give: (c, p) => { W.coins += c | 0; W.pearls += p | 0; save(); },   // récompenses de stage
    // effets des améliorations
    speedMul: () => 1 + .04 * lv('speed'),
    sprintCost: () => 1 - .09 * lv('stamina'),
    regen: () => 1 + .14 * lv('stamina'),
    cdMul: () => 1 - .1 * lv('cd'),
    durMul: () => 1 + .2 * lv('dur'),
    scoreMul: () => 1 + .1 * lv('score'),
    // loot
    preyDrop: (x, y) => {
      if (random() < .1 + .04 * lv('luck')) burst(x, y, 1, false);
      if (lv('pearlc') && random() < .012 * lv('pearlc')) burst(x, y, 1, true);
    },
    bonus: (x, y, coins, pearls) => { if (coins) burst(x, y, coins, false); if (pearls) burst(x, y, pearls, true); },
  };
})();
