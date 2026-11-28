// The camera link's pure core (src/cam/core.js): SDP packing for the QR pairing, frame-interval stats,
// the clock offset, the ball finder and the drop-test fit. core.js is a plain script (it has to run on
// Safari 12), so it is loaded here the way camera.html loads it: as a script with a `self`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const SRC = fs.readFileSync(new URL('src/cam/core.js', ROOT), 'utf8');
const ctx = {}; ctx.self = ctx; vm.runInNewContext(SRC, ctx);
const C = ctx.CamCore;
const J = v => JSON.parse(JSON.stringify(v)); // objects from the script's own realm
const FIX = JSON.parse(fs.readFileSync(new URL('tests/fixtures/cam-sdp.json', ROOT), 'utf8'));

// iOS 12 Safari: nothing newer than ES2017 in the files the camera phone runs
// (ES2018+: optional catch binding, object spread, named groups and lookbehind, flat, fromEntries, finally.)
const SAFARI12 = [/\?\.[\w(\[]/, /\?\?/, /\bstatic\s+\w+\s*=/, /^\s+#\w+/m, /\bimport\s*\(/, /\.at\(/, /\bclass\s/, /catch\s*\{/, /\{\s*\.\.\./, /,\s*\.\.\.\w+\s*\}/,
  /\(\?<[=!\w]/, /\.flat(Map)?\(/, /fromEntries/, /\.finally\(/, /matchAll|replaceAll/, /\bexport\b|^\s*import\s/m];
for (const f of ['src/cam/core.js', 'src/cam/grab.js', 'src/cam/camera-page.js']) {
  test(`${f} uses nothing newer than iOS 12 Safari runs`, () => {
    const raw = fs.readFileSync(new URL(f, ROOT), 'utf8'), src = raw.replace(/^\s*\/\/.*$/gm, '');
    for (const re of SAFARI12) assert.ok(!re.test(src), `${f} matches ${re}`);
    assert.doesNotThrow(() => new vm.Script(raw), 'parses as a classic script');
  });
}

test('base64url round-trips every byte value', () => {
  const b = new Uint8Array(259); for (let i = 0; i < b.length; i++) b[i] = i & 255;
  for (const n of [0, 1, 2, 3, 4, 100, 259]) {
    const s = C.b64u.encode(b.subarray(0, n));
    assert.match(s, /^[A-Za-z0-9_-]*$/);
    assert.deepEqual([...C.b64u.decode(s)], [...b.subarray(0, n)]);
  }
  assert.equal(C.b64u.encode(Buffer.from('hello')), Buffer.from('hello').toString('base64url'));
});

test('an offer packs small enough for a link a phone camera reads, and rebuilds the parts that matter', () => {
  const code = C.pack(FIX.chromeOffer, 'offer');
  assert.ok(code.length < 200, `offer code is ${code.length} chars`);
  const r = C.unpack(code);
  assert.equal(r.type, 'offer');
  const a = C.parseSdp(FIX.chromeOffer), b = C.parseSdp(r.sdp);
  for (const k of ['ufrag', 'pwd', 'fp', 'setup']) assert.equal(b[k], a[k], k);
  assert.deepEqual(J(b.cands.map(c => c.addr + ':' + c.port)), J(a.cands.map(c => c.addr + ':' + c.port)));
  assert.deepEqual(J(b.sections.map(s => [s.kind, s.mid, s.dir])), [['video', '0', 'recvonly'], ['application', '1', 'sendrecv']]);
  assert.deepEqual(J(b.sections[0].pts), J(a.sections[0].pts), 'payload types and codecs kept');
  assert.equal(b.sections[1].sctp, 5000);
  assert.match(r.sdp, /a=group:BUNDLE 0 1/);
});

test('an answer keeps its SSRC, its codec order and an mDNS host name', () => {
  const code = C.pack(FIX.mdnsAnswer, 'answer');
  assert.ok(code.length < 220, `answer code is ${code.length} chars`);
  const r = C.unpack(code);
  assert.equal(r.type, 'answer');
  const a = C.parseSdp(FIX.mdnsAnswer), b = C.parseSdp(r.sdp);
  assert.equal(b.sections[0].ssrc, a.sections[0].ssrc);
  assert.equal(b.sections[0].dir, 'sendonly');
  assert.equal(b.setup, 'active');
  assert.deepEqual(J(b.sections[0].pts), J(a.sections[0].pts), 'the fmtp written in another order still reads as H.264 42e01f');
  assert.match(b.cands[0].addr, /^6f1d9e2a-3b4c-4d5e-8f90-a1b2c3d4e5f6\.local$/);
  assert.match(r.sdp, /a=ssrc:\d+ cname:cam/);
});

test('packing refuses an SDP with no codec it knows, and a damaged code', () => {
  const vp9 = FIX.chromeOffer.replace(/VP8/g, 'VP9').replace(/H264/g, 'AV1');
  assert.throws(() => C.pack(vp9, 'offer'), /codec/);
  const code = C.pack(FIX.chromeOffer, 'offer');
  assert.throws(() => C.unpack(code.slice(0, 30)), /cut short/);
  assert.throws(() => C.unpack('Z' + code.slice(1)), /version/);
});

test('IPv6 and server-reflexive candidates survive the trip', () => {
  const sdp = FIX.chromeOffer.replace(/(a=candidate:[^\n]*typ host[^\n]*\n)/, '$1a=candidate:7 1 udp 1686052607 203.0.113.9 51000 typ srflx raddr 192.0.2.2 rport 9 generation 0\r\na=candidate:8 1 udp 2122197247 2001:db8::1:2 40000 typ host generation 0\r\n');
  const b = C.parseSdp(C.unpack(C.pack(sdp, 'offer')).sdp), h = C.parseSdp(FIX.chromeOffer).cands[0];
  assert.deepEqual(J(b.cands.map(c => `${c.type} ${c.addr}:${c.port}`)), [`host ${h.addr}:${h.port}`, 'srflx 203.0.113.9:51000', 'host 2001:db8:0:0:0:0:1:2:40000']);
});

test('frame intervals: a steady 30 fps, then one with jitter and a dropped frame', () => {
  const steady = Array.from({ length: 31 }, (_, i) => i * 1000 / 30);
  const s = C.intervals(steady);
  assert.ok(Math.abs(s.fps - 30) < 0.01 && s.sd < 1e-9 && s.gaps === 0);
  const rough = steady.filter((_, i) => i !== 10).map((t, i) => t + (i % 2 ? 3 : -3));
  const r = C.intervals(rough);
  assert.equal(r.gaps, 1);
  assert.ok(r.sd > 3 && r.max > 60, JSON.stringify(r));
  const w = C.frameWindow(500); for (const t of steady) w.push(t);
  assert.ok(w.times().length <= 17 && Math.abs(w.stats().fps - 30) < 0.5);
});

test('clock offset comes from the shortest round trip', () => {
  const r = C.clock([{ t0: 0, t1: 5060, t2: 40 }, { t0: 100, t1: 5108, t2: 110 }, { t0: 200, t1: 5230, t2: 260 }]);
  assert.equal(r.rtt, 10);
  assert.equal(r.offset, 5003);
});

function frame(w, h, balls, bgLum = 40) {
  const lum = new Uint8Array(w * h).fill(bgLum), sat = new Uint8Array(w * h).fill(20);
  for (const b of balls) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x + 0.5 - b.x) ** 2 + (y + 0.5 - b.y) ** 2 <= b.r * b.r) { lum[y * w + x] = b.lum ?? 230; sat[y * w + x] = b.sat ?? 10; }
  }
  return { lum, sat };
}

test('the ball finder takes the biggest white patch and ignores colour and the background', () => {
  const f = frame(80, 60, [{ x: 30.3, y: 20.7, r: 4 }, { x: 60, y: 50, r: 2 }, { x: 10, y: 50, r: 6, sat: 160 }]);
  const b = C.blob(f.lum, f.sat, null, 80, 60);
  assert.ok(Math.abs(b.x - 30.3) < 0.3 && Math.abs(b.y - 20.7) < 0.3, JSON.stringify(b));
  assert.ok(b.w >= 7 && b.w <= 9);
  const bg = f.lum.slice();
  assert.equal(C.blob(f.lum, f.sat, bg, 80, 60), null, 'nothing differs from the background');
  const rgba = new Uint8Array([255, 255, 255, 255, 255, 0, 0, 255]);
  const ls = C.lumSat(rgba, 2);
  assert.deepEqual([...ls.lum], [255, 76]); assert.deepEqual([...ls.sat], [0, 255]);
});

// A ball held, then dropped 1.0 m in front of a camera at 30 fps, 400 px per metre.
function dropTrack({ fps = 30, jitterMs = 0, scale = 400, hM = 1.0, seed = 1 } = {}) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const pts = [], release = 300, g = 9.81, y0 = 50, tFloor = Math.sqrt(2 * hM / g) * 1000;
  for (let i = 0; i < 40; i++) {
    const tc = i * 1000 / fps, tr = tc + jitterMs * 2 * rnd();       // tr: when the page read the frame
    const dt = Math.max(0, tc - release) / 1000;
    let y;
    if (tc < release) y = y0;
    else if (tc - release < tFloor) y = y0 + 0.5 * g * dt * dt * scale;
    else { const u = (tc - release - tFloor) / 1000; y = y0 + hM * scale - Math.max(0, 3.0 * u - 0.5 * g * u * u) * scale; }
    pts.push({ t: tr, y });
  }
  return pts;
}

test('the drop test reads g from clean frame times', () => {
  const r = C.fitDrop(dropTrack(), 400);
  assert.ok(r.ok, r.why);
  assert.ok(Math.abs(r.err) < 0.02, `g ${r.g}`);
  assert.ok(r.frames >= 8, `${r.frames} frames in the air`);
  assert.ok(Math.abs(r.speed - Math.sqrt(2 * 9.81)) < 0.6, `speed ${r.speed}`);
});

test('the drop test shows sloppy frame times as a g error and a timing residual', () => {
  const clean = C.fitDrop(dropTrack(), 400), rough = C.fitDrop(dropTrack({ jitterMs: 8, seed: 7 }), 400);
  assert.ok(rough.ok);
  assert.ok(rough.rmsMs > 2 && rough.rmsMs > 10 * (clean.rmsMs || 0.01), `rms ${rough.rmsMs} ms vs ${clean.rmsMs}`);
  assert.equal(C.fitDrop(dropTrack().slice(0, 9), 400).ok, false, 'only the hold and the release');
});

test('frames seen late at each screen refresh go back on the camera\'s steady clock', () => {
  let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const T = 1000 / 30, real = [], seen = [];
  for (let i = 0; i < 60; i++) {
    if (i === 20) continue;                                        // a frame the page never saw
    const t = 500 + i * T; real.push(t);
    seen.push(Math.ceil((t + 2) / 16.1) * 16.1 + rnd() * 2);       // the next screen refresh after it arrived (not locked to the camera)
  }
  const st = C.steady(seen);
  assert.equal(st.lost, 1);
  assert.ok(Math.abs(st.period - T) < 0.05, `period ${st.period}`);
  const lag = st.times.map((t, i) => t - real[i]), mean = lag.reduce((a, b) => a + b) / lag.length;
  const wobble = Math.sqrt(lag.reduce((a, b) => a + (b - mean) ** 2, 0) / lag.length);
  assert.ok(wobble < 0.5, `steady times wobble ${wobble} ms about a constant lag`);
  assert.ok(st.rmsMs > 3 && st.ok, 'the seen times were rough, and still read as a steady camera');
  const lumpy = seen.map((t, i) => t + (i % 7 === 3 ? 40 : 0) + (i % 5) * 9);
  assert.equal(C.steady(lumpy).ok, false, 'frames that come in lumps are not a steady clock');
});

test('the drop test on the steady clock recovers g that rough frame times blur', () => {
  const pts = dropTrack(), T = 1000 / 30;
  const rough = pts.map(p => ({ t: Math.ceil((p.t + 3) / 16.1) * 16.1, y: p.y }));
  const st = C.steady(rough.map(p => p.t));
  const fixed = rough.map((p, i) => ({ t: st.times[i], y: p.y }));
  const a = C.fitDrop(rough, 400), b = C.fitDrop(fixed, 400);
  assert.ok(Math.abs(b.err) < 0.01, `steady g err ${b.err}`);
  assert.ok(b.rmsMs < a.rmsMs, `${b.rmsMs} < ${a.rmsMs}`);
  assert.ok(Math.abs(st.period - T) < 0.1);
});
