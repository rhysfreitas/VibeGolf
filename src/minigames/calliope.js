// A little calliope (steam organ) waltz for Carnival Booth, synthesised with Web Audio: an
// oom-pah-pah bass and a bright reedy melody with a wobble. Starts on the first tap; isOn() mutes it.
export function createCalliope(isOn) {
  let ctx = null, out = null, next = 0, beat = 0, timer = null;
  const BPM = 168, SPB = 60 / BPM;
  // melody: [semitones from A4 or null, beats] — a jaunty 3/4 tune, 16 bars, loops
  const M = [[7,1],[11,1],[14,1],[19,2],[14,1],[16,1],[14,1],[12,1],[11,3],
             [9,1],[12,1],[16,1],[21,2],[16,1],[19,1],[16,1],[14,1],[12,3],
             [7,1],[11,1],[14,1],[19,2],[17,1],[16,1],[14,1],[16,1],[19,3],
             [14,1],[12,1],[11,1],[9,1],[11,1],[12,1],[14,2],[11,1],[7,3]];
  const BASS = [-14, -9, -10, -7]; // a chord root per bar (G, C, D, D)… cycled every bar
  const hz = s => 440 * Math.pow(2, s / 12);
  function note(f, t, len, vol, type, vib = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6.2; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + len + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.setValueAtTime(vol * 0.8, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.05);
  }
  let mi = 0, mLeft = 0;
  function schedule() {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.25) {
      if (isOn()) {
        const bar = Math.floor(beat / 3), pos = beat % 3, root = BASS[bar % BASS.length];
        if (pos === 0) note(hz(root), next, SPB * 0.9, 0.05, 'triangle');
        else { note(hz(root + 12 + (pos === 1 ? 4 : 7)), next, SPB * 0.45, 0.02, 'square'); }
        if (mLeft <= 0) { const [s, b] = M[mi]; mi = (mi + 1) % M.length; mLeft = b; if (s !== null) { note(hz(s), next, SPB * b * 0.92, 0.028, 'square', 0.008); note(hz(s + 12), next, SPB * b * 0.92, 0.012, 'triangle', 0.008); } }
        mLeft--;
      }
      beat++; next += SPB;
    }
  }
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    out = ctx.createGain(); out.gain.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; out.connect(lp).connect(ctx.destination);
    next = ctx.currentTime + 0.1; timer = setInterval(schedule, 90);
  }
  addEventListener('pointerdown', start, { passive: true });
  return { start, get ctx() { return ctx; } };
}
