// Night ambience for Zombie Siege, all synthesised (no audio files): wind, crickets, groans that
// grow as the horde nears the fence, crows, distant thunder, a church bell, a crackling transformer.
//
//   const amb = createAmbience(() => kit.sfx.on);
//   amb.update(dt, { count, nearest })   // nearest: metres from the closest zombie to the fence
//   amb.thunder(delay) · amb.bell() · amb.crackle() · amb.caw()

export function createAmbience(isOn) {
  let ctx = null, master = null, windGain = null, windFilter = null, noiseBuf = null;
  const start = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const n = ctx.sampleRate * 3; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < n; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } // brown noise
    // wind: looping brown noise through a slowly wandering band-pass
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(windFilter).connect(windGain).connect(master); src.start();
  };
  addEventListener('pointerdown', start, { passive: true });
  const live = () => ctx && isOn();

  function noise(len, { type = 'bandpass', freq = 800, q = 1, vol = 0.2, t = 0, attack = 0.01, slide = 0 } = {}) {
    if (!live()) return;
    const t0 = ctx.currentTime + t, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q; if (slide) f.frequency.exponentialRampToValueAtTime(freq * slide, t0 + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    s.connect(f).connect(g).connect(master); s.start(t0, Math.random() * 2); s.stop(t0 + len + 0.1);
  }
  function osc(freq, len, { type = 'sine', vol = 0.1, t = 0, slide = 0, attack = 0.01 } = {}) {
    if (!live()) return null;
    const t0 = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + len);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + len + 0.05); return { o, g, t0 };
  }

  // a groan: a buzzy low voice through two vowel formants, sliding down
  function groan(vol, pitch = 1) {
    if (!live()) return;
    const t0 = ctx.currentTime, len = 1.1 + Math.random() * 0.9, f0 = (70 + Math.random() * 50) * pitch;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.15, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t0 + len);
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5 + Math.random() * 3; vg.gain.value = f0 * 0.04; vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.25); g.gain.linearRampToValueAtTime(vol * 0.7, t0 + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) pan.pan.value = (Math.random() * 2 - 1) * 0.7;
    for (const [fq, qq, k] of [[480 + Math.random() * 120, 6, 1], [950 + Math.random() * 200, 8, 0.5]]) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq; f.Q.value = qq;
      const fg = ctx.createGain(); fg.gain.value = k; o.connect(f).connect(fg).connect(g);
    }
    if (pan) g.connect(pan).connect(master); else g.connect(master);
    o.start(t0); vib.start(t0); o.stop(t0 + len + 0.1); vib.stop(t0 + len + 0.1);
  }
  function chirp(t) { // one cricket: a few fast pulses of a high tone
    for (let k = 0; k < 3; k++) osc(4300 + Math.random() * 300, 0.035, { vol: 0.012, t: t + k * 0.055, attack: 0.004 });
  }
  function caw() { for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { noise(0.22, { freq: 1300, q: 4, vol: 0.06, t: k * 0.34, slide: 0.7 }); osc(620, 0.22, { type: 'sawtooth', vol: 0.025, t: k * 0.34, slide: 0.75 }); } }
  function thunder(delay = 2) {
    noise(0.25, { type: 'lowpass', freq: 1800, vol: 0.12, t: delay });
    noise(3.6, { type: 'lowpass', freq: 220, q: 0.7, vol: 0.5, t: delay + 0.05, attack: 0.25, slide: 0.5 });
    noise(2.4, { type: 'lowpass', freq: 120, q: 0.7, vol: 0.4, t: delay + 0.6, attack: 0.4 });
  }
  function bell() { // a far church bell: inharmonic partials, long decay
    [[220, 0.09], [440, 0.05], [528, 0.04], [660, 0.03], [880, 0.02]].forEach(([f, v]) => osc(f, 4.5, { vol: v, attack: 0.005 }));
  }
  function crackle() { for (let k = 0; k < 9; k++) noise(0.05 + Math.random() * 0.05, { type: 'highpass', freq: 3000, vol: 0.08, t: k * 0.06 + Math.random() * 0.04 }); osc(120, 0.5, { type: 'square', vol: 0.02 }); }

  let cricketT = 0, groanT = 2, cawT = 12, windT = 0;
  function update(dt, { count = 0, nearest = Infinity } = {}) {
    if (!ctx) return;
    windT += dt;
    if (windGain) {
      const target = isOn() ? 0.05 + 0.04 * Math.sin(windT * 0.21) + 0.03 * Math.sin(windT * 0.53) : 0;
      windGain.gain.setTargetAtTime(Math.max(0, target), ctx.currentTime, 0.4);
      windFilter.frequency.setTargetAtTime(320 + 260 * (0.5 + 0.5 * Math.sin(windT * 0.17)), ctx.currentTime, 0.6);
    }
    if (!isOn()) return;
    // crickets go quiet when the horde is close
    const calm = Math.min(1, Math.max(0, (nearest - 25) / 120));
    cricketT -= dt; if (cricketT <= 0) { cricketT = 0.35 + Math.random() * 0.9; if (Math.random() < 0.3 + 0.6 * calm) chirp(0); }
    // groans: more of them, and louder, as zombies get near the fence
    const near = count ? Math.min(1, Math.max(0, 1 - (nearest - 10) / 230)) : 0;
    groanT -= dt;
    if (count && groanT <= 0) { groanT = (6 - 4.5 * near) * (0.6 + Math.random() * 0.8) / Math.min(3, 1 + count / 15); groan(0.035 + 0.11 * near, 0.85 + Math.random() * 0.35); }
    cawT -= dt; if (cawT <= 0) { cawT = 18 + Math.random() * 25; caw(); }
  }
  return { update, thunder, bell, crackle, caw, groan };
}
