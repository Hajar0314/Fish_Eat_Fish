// Moteur audio 100% synthétisé (WebAudio) : effets, ambiance, musique adaptative, sons positionnels.
const snd = (() => {
  let ctx, master, musicBus, sfxBus, white, started = false, muted = false, curPan = 0, depth = 0, tension = 0;
  const nodes = {};
  const msg = t => { const d = document.getElementById('err'); if (!d) return; if (t) { d.style.display = 'block'; d.textContent = t; } else if (d.textContent.startsWith('🔇')) d.style.display = 'none'; };
  const now = () => ctx.currentTime;
  const play = fn => { if (ctx && !muted) { try { fn(now()); } catch (e) { console.warn('Son :', e); } } };
  const S = (p, fn) => { curPan = p || 0; play(fn); curPan = 0; };           // joue un son avec un panoramique -1 (gauche) .. 1 (droite)
  const route = (g, pan, bus) => {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus); } else g.connect(bus);
  };
  function tone(f, t, d, o = {}) {
    const { type = 'sine', vol = .2, to = null, at = .01, bus = sfxBus, pan = curPan } = o, os = ctx.createOscillator(), g = ctx.createGain();
    os.type = type; os.frequency.setValueAtTime(f, t); if (to) os.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + at); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    os.connect(g); route(g, pan, bus); os.start(t); os.stop(t + d + .05);
  }
  function noise(t, d, o = {}) {
    const { f = 800, to = null, vol = .2, q = 1, type = 'bandpass', bus = sfxBus, pan = curPan } = o, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = white; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(fl); fl.connect(g); route(g, pan, bus); s.start(t); s.stop(t + d + .05);
  }
  const arp = (p, notes, gap, d, type, vol) => S(p, t => notes.forEach((n, i) => tone(n, t + i * gap, d, { type, vol })));
  const lfo = (rate, amt, target) => { const o = ctx.createOscillator(), a = ctx.createGain(); o.frequency.value = rate; a.gain.value = amt; o.connect(a); a.connect(target); o.start(); };

  // Ambiance douce : petites vagues, bulles rigolotes, et un dauphin qui rit de temps en temps
  function ambience() {
    const len = ctx.sampleRate * 6, bf = ctx.createBuffer(1, len, ctx.sampleRate), d = bf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const s = ctx.createBufferSource(); s.buffer = bf; s.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = ctx.createGain(); g.gain.value = .16;
    lfo(.13, 300, lp.frequency); lfo(.09, .07, g.gain); s.connect(lp); lp.connect(g); g.connect(musicBus); s.start();
    (function bub() {
      play(t => { const f = 600 + Math.random() * 600, p = Math.random() - .5;
        tone(f, t, .1, { to: f * 1.7, vol: .05, bus: musicBus, pan: p });
        if (Math.random() < .6) tone(f * 1.25, t + .11, .09, { to: f * 2.1, vol: .04, bus: musicBus, pan: p }); });
      setTimeout(bub, 700 + Math.random() * 2600);
    })();
    (function dolphin() {
      play(t => { const p = Math.random() * 1.2 - .6;
        tone(1400, t, .12, { to: 2400, vol: .04, bus: musicBus, pan: p }); tone(2400, t + .14, .1, { to: 1500, vol: .04, bus: musicBus, pan: p }); tone(1600, t + .28, .14, { to: 2700, vol: .04, bus: musicBus, pan: p }); });
      setTimeout(dolphin, 12000 + Math.random() * 15000);
    })();
  }

  // Musique « boîte à musique » : arpèges kalimba en do majeur. En profondeur : plus lente, plus rêveuse (écho), jamais sombre.
  const CH = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], PENT = [0, 2, 4, 7, 9];
  let echoIn, echoWet, stepN = 0, oct = 1;
  function pluck(f, t, v, pan) {
    const br = 1 - depth * .6;
    [[1, 1, 1.1], [2, .28 * br, .45], [3, .1 * br, .25]].forEach(([m, a, dur]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * m;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v * a, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); route(g, pan, musicBus); g.connect(echoIn); o.start(t); o.stop(t + dur + .05);
    });
  }
  function music() {
    echoIn = ctx.createGain(); const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter(); echoWet = ctx.createGain();
    dl.delayTime.value = .34; fb.gain.value = .38; lp.type = 'lowpass'; lp.frequency.value = 2200; echoWet.gain.value = .25;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(echoWet); echoWet.connect(musicBus);
    (function seq() {
      const bpm = 104 - depth * 26 + tension * 28, bar = Math.floor(stepN / 8) % 4, k = stepN % 8; stepN++;
      if (k === 0) oct = depth > .55 ? .5 : 1;
      play(t => {
        const base = 261.63 * oct, ch = CH[bar], f = n => base * Math.pow(2, n / 12);
        if (k === 0) ch.forEach((n, i) => tone(f(n) / 2, t + i * .03, 2.6, { vol: .03, at: .35, bus: musicBus, pan: 0 }));   // pad très doux
        const pi = [0, 1, 2, 3, 2, 1, 2, 1][k], note = pi === 3 ? ch[0] + 12 : ch[pi];
        if (Math.random() > .2 + depth * .2) pluck(f(note), t, .1 + .03 * (1 - depth), (k - 3.5) * .1);
        if (k % 4 === 2 && Math.random() < .55) pluck(f(PENT[Math.floor(Math.random() * 5)] + 12), t + .02, .07, Math.random() - .5);
        if (tension > .15 && k % 2 === 1) { const b = f(ch[0]) / 2; tone(b, t, .12, { to: b * .8, vol: tension * .16, bus: musicBus, pan: 0 }); }   // petit « boup » de suspense rigolo
      });
      setTimeout(seq, 60000 / bpm / 2);
    })();
  }

  return {
    start(m) {
      muted = m;
      try {
        if (!ctx) {
          ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = m ? 0 : .8; master.connect(ctx.destination);
          musicBus = ctx.createGain(); sfxBus = ctx.createGain(); musicBus.connect(master); sfxBus.connect(master);
          white = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        ctx.resume();
        if (!ctx.onstatechange) ctx.onstatechange = () => { if (ctx && ctx.state === 'running') msg(''); };
        setTimeout(() => { if (ctx && ctx.state !== 'running') msg('🔇 Le navigateur bloque le son : clique ou appuie sur une touche pour l\'activer.'); }, 800);
        if (!started) { started = true; ambience(); music(); }
      } catch (e) { console.warn('Audio désactivé', e); msg('Audio indisponible : ' + e.message); ctx = null; }
    },
    state() { return ctx ? ctx.state : 'inactif'; },
    mute(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : .8, ctx.currentTime, .05); },
    vol(kind, v) { const b = kind === 'music' ? musicBus : sfxBus; if (b) b.gain.setTargetAtTime(v, ctx.currentTime, .05); },
    // profondeur 0..1 et tension 0..1 pilotent la musique
    setMusic(d, t) { depth = d; tension = t; if (ctx && echoWet) echoWet.gain.setTargetAtTime(.22 + d * .3, ctx.currentTime, .6); },
    // --- interface ---
    click() { S(0, t => { tone(760, t, .07, { type: 'triangle', to: 420, vol: .14 }); tone(1500, t, .03, { vol: .05 }); }); },
    tick() { S(0, t => { tone(1150, t, .05, { type: 'triangle', to: 1700, vol: .13 }); noise(t, .1, { f: 1600, to: 800, vol: .05 }); }); },
    // --- jeu (p = panoramique selon la position de la source) ---
    eat(p) { S(p, t => { const f = 380 + Math.random() * 220; tone(f, t, .1, { to: f * 2, vol: .22 }); tone(f * 1.5, t + .07, .09, { to: f * 2.6, vol: .12 }); }); },
    hurt(p) { S(p, t => { tone(640, t, .35, { type: 'triangle', to: 210, vol: .2 }); tone(420, t + .05, .3, { to: 160, vol: .14 }); tone(150, t, .15, { to: 80, vol: .22 }); }); },
    lose(p) { S(p, t => { tone(700, t, .3, { type: 'triangle', to: 180, vol: .2 }); tone(350, t + .12, .25, { type: 'triangle', to: 120, vol: .12 }); }); },
    life() { arp(0, [523, 659, 784, 1047, 1319, 1568], .09, .6, 'triangle', .2); play(t => tone(2093, t + .5, .8, { vol: .08 })); },
    power(k) {
      S(0, t => {
        if (k === 'shield') { tone(660, t, .35, { type: 'triangle', vol: .2 }); tone(880, t + .12, .5, { type: 'triangle', vol: .2 }); }
        else if (k === 'turbo') { tone(300, t, .35, { type: 'triangle', to: 1500, vol: .14 }); noise(t, .3, { f: 600, to: 3000, vol: .06 }); }
        else if (k === 'frenzy') { [523, 659, 784, 1047, 1319].forEach((n, i) => tone(n, t + i * .05, .3, { type: 'triangle', vol: .16 })); tone(180, t, .4, { to: 360, vol: .14 }); }
        else if (k === 'slow') { tone(900, t, .7, { type: 'triangle', to: 200, vol: .16 }); tone(450, t + .1, .7, { to: 100, vol: .1 }); noise(t, .6, { f: 2400, to: 300, vol: .05 }); }
        else if (k === 'double') { [784, 988, 1319, 1568].forEach((n, i) => tone(n, t + i * .06, .2, { type: 'triangle', vol: .16 })); tone(2093, t + .26, .35, { vol: .08 }); }
        else if (k === 'clones') { for (let i = 0; i < 5; i++) tone(380 + i * 110, t + i * .06, .09, { to: 600 + i * 150, vol: .15 }); }
        else { for (let i = 0; i < 4; i++) tone(500 + (i % 2) * 250, t + i * .07, .1, { vol: .18 }); }
      });
    },
    gold(p) { arp(p, [1047, 1319, 1568, 2093, 2637], .06, .35, 'triangle', .16); },
    // « clac-clac » de la mâchoire du requin
    snap(p) { S(p, t => { noise(t, .04, { f: 3500, to: 1800, q: 3, vol: .2 }); tone(220, t, .06, { type: 'triangle', to: 90, vol: .2 }); noise(t + .1, .03, { f: 3000, to: 1500, q: 3, vol: .12 }); }); },
    crunch(p) { S(p, t => { tone(500, t, .08, { to: 900, vol: .25 }); tone(300, t + .07, .1, { to: 700, vol: .22 }); tone(1200, t + .14, .12, { type: 'triangle', to: 1800, vol: .1 }); }); },
    // Alerte douce « bu-bup » (au lieu d'un grognement), plus aiguë et plus rapide quand le danger approche
    growl(p, v) { S(p, t => { const f = 330 + 160 * v; tone(f, t, .12, { type: 'triangle', to: f * .72, vol: .08 + .1 * v }); tone(f, t + .16, .12, { type: 'triangle', to: f * .72, vol: .08 + .1 * v }); }); },
    event(k) {
      S(0, t => {
        if (k === 'storm') { noise(t, 1.2, { f: 300, to: 900, q: .6, vol: .1, type: 'lowpass' }); tone(220, t, .9, { type: 'triangle', to: 330, vol: .08, at: .3 }); }
        else if (k === 'whirl') { tone(400, t, .6, { to: 900, vol: .12 }); tone(900, t + .3, .6, { to: 400, vol: .1 }); }
        else { for (let i = 0; i < 5; i++) tone(180 + i * 30, t + i * .09, .1, { to: 300 + i * 40, vol: .2 }); noise(t, .6, { f: 200, type: 'lowpass', vol: .1 }); }
      });
    },
    chest(p) { arp(p, [784, 988, 1175, 1568, 1976], .07, .5, 'triangle', .2); S(p, t => tone(2637, t + .4, .8, { vol: .07 })); },
    chirp(p) { S(p, t => { tone(1400, t, .12, { to: 2400, vol: .1 }); tone(2400, t + .14, .1, { to: 1500, vol: .1 }); tone(1600, t + .28, .14, { to: 2700, vol: .1 }); }); },
    whoosh() { S(0, t => noise(t, .35, { f: 400, to: 2200, q: 2, vol: .14 })); },
    evolve() { arp(0, [392, 523, 659, 784, 1047], .09, .45, 'triangle', .2); play(t => { noise(t, .6, { f: 600, to: 3000, vol: .12, q: 2 }); [523, 659, 784, 1047].forEach(n => tone(n, t + .5, 1.2, { vol: .07 })); }); },
    decoy() { S(0, t => { for (let i = 0; i < 5; i++) tone(500 + i * 130, t + i * .04, .14, { type: 'triangle', to: 900 + i * 90, vol: .12 }); noise(t, .25, { f: 1800, to: 600, vol: .08 }); }); },
    bloom() { S(0, t => { tone(260, t, .5, { to: 520, vol: .16, at: .15 }); tone(390, t + .1, .5, { to: 780, vol: .1, at: .15 }); noise(t, .4, { f: 400, to: 1400, vol: .06, q: .8 }); }); },
    slap(p) { S(p, t => { noise(t, .25, { f: 300, to: 90, vol: .4, q: .8, type: 'lowpass' }); tone(160, t, .3, { type: 'square', to: 50, vol: .2 }); tone(900, t, .08, { type: 'triangle', to: 300, vol: .15 }); }); },
    flash() { S(0, t => { tone(1400, t, .55, { to: 3200, vol: .12, at: .02 }); tone(2100, t, .6, { type: 'triangle', to: 1200, vol: .08 }); noise(t, .5, { f: 4000, to: 1000, vol: .1, type: 'highpass' }); }); },
    pop(p) { S(p, t => { tone(700, t, .09, { to: 200, vol: .18 }); noise(t, .08, { f: 2500, vol: .08 }); }); },
    coin(p) { S(p, t => { tone(1318, t, .07, { type: 'triangle', vol: .11 }); tone(1760, t + .06, .16, { type: 'triangle', vol: .11 }); }); },
    pearl(p) { arp(p, [1568, 2093, 2637, 3136], .05, .4, 'sine', .12); },
    buy() { arp(0, [659, 880, 1318], .07, .3, 'triangle', .16); },
    deny() { S(0, t => tone(220, t, .15, { type: 'square', to: 160, vol: .07 })); },
    level() { arp(0, [523, 659, 784, 1047], .11, .5, 'triangle', .2); play(t => { [523, 659, 784].forEach(n => tone(n * 2, t + .5, 1, { vol: .08 })); }); },
    over() { arp(0, [523, 466, 392, 349], .28, .6, 'sine', .2); },
  };
})();
