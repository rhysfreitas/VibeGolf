// The game side of the camera link: cameras as sources, all with one interface, and the pairing that
// brings a phone in with two scans and nothing hosted.
//
//   const cam = await localCamera({ facing: 'user' });     // the game device's own camera (front camera, USB webcam)
//   const p = await phoneOffer();                           // p.link goes in a QR code; the phone's Camera app opens it
//   const phone = await p.accept(answerText);               // the phone's answer QR, read by scanQR() or pasted
//   cam / phone: { id, kind: 'local' | 'phone', label, stream, video, facing, frames(), stats(), close(),
//                  addEventListener('frame' | 'message' | 'state' | 'close', …) }
//
// Every source keeps a hidden <video> playing its stream and stamps each new frame (requestVideoFrameCallback
// where the browser has it, else a frame counter, marked approximate). A phone source also has its data
// channel: the phone's own numbers arrive as 'message' events ({ t: 'stats' | 'drop' | 'hello', … }), and
// later its putt tracks. Measure from the phone's own frames, never from the received video: that stream is
// compressed, drops frames and changes size with the Wi-Fi, and its frame times aren't capture times.
//
// This is plain web code with no page of its own, so the PC app's hub (claude/brief-pc-app.md, Stage C) can
// hold these sources and keep them up across pages.
import './core.js';
import './grab.js';
const C = self.CamCore, G = self.CamGrab;

export const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];
export const ANSWER_PREFIX = 'vgcam:a:';
let nextId = 1;

class Source extends EventTarget {
  constructor(kind, stream, label) {
    super();
    this.id = kind + nextId++; this.kind = kind; this.label = label; this.stream = null; this.facing = '';
    this.video = document.createElement('video');
    Object.assign(this.video, { muted: true, playsInline: true, autoplay: true });
    this.video.setAttribute('playsinline', '');
    this.win = C.frameWindow(3000); this.method = ''; this.last = null; this._stop = null;
    if (stream) this.setStream(stream);
  }
  setStream(stream) {
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.play().catch(() => {});
    if (this._stop) this._stop();
    this.win = C.frameWindow(3000);
    this._stop = G.frames(this.video, (t, info) => {
      this.win.push(t); this.method = info.method;
      this.dispatchEvent(new CustomEvent('frame', { detail: { t, approx: info.approx, meta: info.meta || null } }));
    });
  }
  frames() { return this.win.stats(); }
  get width() { return this.video.videoWidth; }
  get height() { return this.video.videoHeight; }
  track() { return this.stream ? this.stream.getVideoTracks()[0] : null; }
  settings() { const t = this.track(); return t && t.getSettings ? t.getSettings() : {}; }
  async stats() {
    return { kind: this.kind, label: this.label, w: this.width, h: this.height, frames: this.frames(), method: this.method, settings: this.settings() };
  }
  close() {
    if (this._stop) this._stop();
    if (this.stream && this.kind === 'local') this.stream.getTracks().forEach(t => t.stop());
    this.video.srcObject = null;
    this.dispatchEvent(new Event('close'));
  }
}

/* ---------------- the game device's own camera ---------------- */

export async function cameraList() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) { return []; }
}

class LocalCamera extends Source {
  constructor(stream, opts) { super('local', stream, 'This device'); this.opts = opts; this.facing = opts.facing || ''; }
  async open(opts) {
    const s = await openStream(opts);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.opts = opts; this.facing = opts.facing || '';
    this.setStream(s);
    this.label = s.getVideoTracks()[0]?.label || 'This device';
    return this;
  }
}
async function openStream({ deviceId, facing = 'user', fps = 60 } = {}) {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) throw new Error('This browser has no camera access.');
  const video = { frameRate: { ideal: fps }, width: { ideal: 1280 }, height: { ideal: 720 } };
  if (deviceId) video.deviceId = { exact: deviceId }; else video.facingMode = { ideal: facing };
  try { return await md.getUserMedia({ audio: false, video }); } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') throw e;
    return md.getUserMedia({ audio: false, video: deviceId ? { deviceId } : { facingMode: facing } });
  }
}
export async function localCamera(opts = {}) {
  const s = await openStream(opts);
  const cam = new LocalCamera(s, opts);
  cam.label = s.getVideoTracks()[0]?.label || 'This device';
  return cam;
}

/* ---------------- a phone, over WebRTC ---------------- */

class PhoneCamera extends Source {
  constructor(pc, dc) {
    super('phone', null, 'Phone');
    this.pc = pc; this.dc = dc; this.remote = null; this.hello = null; this.drop = null;
    this.state = 'connecting'; this._prev = null; this.recv = null; this.pings = []; this.clock = null;
    dc.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'pong') { this.pings.push({ t0: m.t0, t1: m.t1, t2: Date.now() }); if (this.pings.length > 20) this.pings.shift(); this.clock = C.clock(this.pings); }
      else if (m.t === 'stats') { this.remote = m; this.facing = m.facing; }
      else if (m.t === 'hello') { this.hello = m; this.facing = m.facing; this.label = phoneName(m.caps?.ua); }
      else if (m.t === 'drop') this.drop = m;
      this.dispatchEvent(new CustomEvent('message', { detail: m }));
    };
    dc.onopen = () => { this._ping = setInterval(() => this.send({ t: 'ping', t0: Date.now() }), 2000); this.send({ t: 'ping', t0: Date.now() }); };
    const st = () => {
      const s = pc.connectionState || pc.iceConnectionState;
      if (s === this.state) return;
      this.state = s;
      this.dispatchEvent(new CustomEvent('state', { detail: s }));
    };
    pc.addEventListener('connectionstatechange', st);
    pc.addEventListener('iceconnectionstatechange', st);
  }
  send(m) { if (this.dc.readyState === 'open') this.dc.send(JSON.stringify(m)); }
  flip() { this.send({ t: 'flip' }); }
  // what arrives here: frames decoded and dropped, the jitter buffer, round trip, bitrate, codec
  async receiveStats() {
    const rep = await this.pc.getStats();
    let inb = null, pair = null, codec = null;
    rep.forEach(r => {
      if (r.type === 'inbound-rtp' && r.kind === 'video') inb = r;
      if (r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded') pair = r;
    });
    if (inb?.codecId) codec = rep.get(inb.codecId);
    if (!inb) return null;
    const now = { t: inb.timestamp, bytes: inb.bytesReceived || 0, dec: inb.framesDecoded || 0 }, p = this._prev;
    this._prev = now;
    let local = null, remote = null;
    if (pair) { local = rep.get(pair.localCandidateId); remote = rep.get(pair.remoteCandidateId); }
    this.recv = {
      fps: inb.framesPerSecond ?? (p ? 1000 * (now.dec - p.dec) / (now.t - p.t) : NaN),
      kbps: p && now.t > p.t ? 8 * (now.bytes - p.bytes) / (now.t - p.t) : NaN,
      decoded: inb.framesDecoded, dropped: inb.framesDropped ?? null, lost: inb.packetsLost ?? null,
      jitterMs: inb.jitterBufferEmittedCount ? 1000 * inb.jitterBufferDelay / inb.jitterBufferEmittedCount : NaN,
      w: inb.frameWidth, h: inb.frameHeight, codec: codec?.mimeType?.replace('video/', '') || '',
      rttMs: pair?.currentRoundTripTime != null ? 1000 * pair.currentRoundTripTime : NaN,
      path: local && remote ? `${local.candidateType} → ${remote.candidateType}` : ''
    };
    return this.recv;
  }
  async stats() {
    const base = await super.stats();
    await this.receiveStats().catch(() => null);
    return { ...base, state: this.state, phone: this.remote, hello: this.hello ? { ua: this.hello.caps?.ua, caps: this.hello.caps } : null, recv: this.recv, clock: this.clock, drop: this.drop };
  }
  close() { clearInterval(this._ping); try { this.pc.close(); } catch (e) {} super.close(); }
}
function phoneName(ua = '') {
  const m = /iPhone OS (\d+)_(\d+)/.exec(ua);
  if (m) return `iPhone · iOS ${m[1]}.${m[2]}`;
  const a = /Android (\d+)[^;)]*;\s*([^;)]+)/.exec(ua);
  if (a) return `${a[2].trim()} · Android ${a[1]}`;
  return 'Phone';
}

function waitIce(pc, ms) {
  return new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const t = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); } });
  });
}

// An offer for one phone. Call after this page has camera permission (Chrome then puts the real local
// addresses in it, not mDNS names an old iPhone may not resolve). base: where camera.html lives.
export async function phoneOffer({ base = location.href } = {}) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const tr = pc.addTransceiver('video', { direction: 'recvonly' });
  try {
    const caps = RTCRtpReceiver.getCapabilities('video').codecs;
    const h264 = caps.filter(c => c.mimeType === 'video/H264' && /packetization-mode=1/.test(c.sdpFmtpLine || '') && /profile-level-id=42e01f/.test(c.sdpFmtpLine || ''));
    const vp8 = caps.filter(c => c.mimeType === 'video/VP8');
    if (h264.length || vp8.length) tr.setCodecPreferences(h264.concat(vp8));
  } catch (e) { /* older browsers: the packer keeps whichever of the two the offer has */ }
  const dc = pc.createDataChannel('cam', { ordered: true });
  const cam = new PhoneCamera(pc, dc);
  pc.ontrack = e => { cam.setStream(e.streams[0] || new MediaStream([e.track])); };
  await pc.setLocalDescription(await pc.createOffer());
  await waitIce(pc, 2500);
  const code = C.pack(pc.localDescription.sdp, 'offer');
  const link = new URL('camera.html#o=' + code, base).href;
  return {
    code, link, camera: cam,
    // true when the text answers this offer (an answer carries the offer's last 6 characters)
    mine(text) { const t = /\.([A-Za-z0-9_-]{6})\s*$/.exec(text); return !t || t[1] === code.slice(-6); },
    async accept(text) {
      const m = new RegExp(ANSWER_PREFIX + '([A-Za-z0-9_-]+)').exec(text) || /^\s*([A-Za-z0-9_-]{60,})(?:\.\w{6})?\s*$/.exec(text);
      if (!m) throw new Error('That isn\'t a VibeGolf camera code.');
      if (!this.mine(text)) throw new Error('That code answers an older pairing. Scan the new code on this screen with the phone.');
      const a = C.unpack(m[1]);
      if (a.type !== 'answer') throw new Error('That code is an offer, not the phone\'s answer.');
      await pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
      return cam;
    },
    cancel() { cam.close(); }
  };
}

/* ---------------- reading the answer QR with this device's camera ---------------- */

// Watches a source's video for a QR code holding a camera answer and calls onCode(text); scanning stops
// unless onCode returns false (a stale code: keep looking). Uses the
// browser's BarcodeDetector where it has one, else the vendored jsQR (load vendor/jsqr/jsQR.js first).
export function scanQR(source, onCode, { every = 120, maxSide = 720 } = {}) {
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  let stopped = false, det = null, busy = false, seen = '';
  try { if (self.BarcodeDetector) det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; }
  const look = async () => {
    if (stopped || busy) return;
    const v = source.video, w0 = v.videoWidth, h0 = v.videoHeight;
    if (!w0) return;
    busy = true;
    try {
      let text = null;
      if (det) { const r = await det.detect(v).catch(() => []); text = r.find(x => x.rawValue?.startsWith(ANSWER_PREFIX))?.rawValue || null; }
      if (!text && self.jsQR) {
        const s = Math.min(1, maxSide / Math.max(w0, h0)), w = Math.round(w0 * s), h = Math.round(h0 * s);
        cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
        const r = self.jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (r?.data?.startsWith(ANSWER_PREFIX)) text = r.data;
      }
      if (text && !stopped && text !== seen) {
        seen = text;
        if (onCode(text) !== false) { stopped = true; clearInterval(iv); }
      }
    } finally { busy = false; }
  };
  const iv = setInterval(look, every);
  return () => { stopped = true; clearInterval(iv); };
}

/* ---------------- recording (what Stage 2's clips will use) ---------------- */

// Records a source for ms with MediaRecorder; resolves { ok, type, bytes, kbps, url } or { ok: false, why }.
export function recordTest(source, ms = 3000) {
  return new Promise(resolve => {
    if (typeof MediaRecorder !== 'function') return resolve({ ok: false, why: 'no MediaRecorder in this browser' });
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
    const type = types.find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    let rec;
    try { rec = new MediaRecorder(source.stream, type ? { mimeType: type } : undefined); } catch (e) { return resolve({ ok: false, why: e.message }); }
    const parts = [], t0 = performance.now();
    rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(parts, { type: rec.mimeType || type || 'video/webm' }), secs = (performance.now() - t0) / 1000;
      resolve({ ok: blob.size > 0, type: blob.type, bytes: blob.size, kbps: 8 * blob.size / 1000 / secs, url: URL.createObjectURL(blob), why: blob.size ? '' : 'recorded nothing' });
    };
    rec.onerror = e => resolve({ ok: false, why: e.error?.message || 'recorder error' });
    rec.start(500);
    setTimeout(() => { try { rec.stop(); } catch (e) { resolve({ ok: false, why: e.message }); } }, ms);
  });
}

export { C as CamCore, G as CamGrab };
