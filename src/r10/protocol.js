// Garmin Approach R10 wire protocol: pure, no Web Bluetooth, DOM or Three.js, so node can test it.
//
// Ported from 10over (https://github.com/divotmaker/10over), its docs/WIRE.md and docs/SEQUENCE.md.
//   Copyright 2026 Eric Thill. Licensed under the Apache License, Version 2.0 (or MIT, at your option).
//   You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
// 10over is not affiliated with or endorsed by Garmin; Garmin, Approach and R10 are Garmin's trademarks.
//
// The stack, top to bottom:
//   protobuf Envelope → 14-byte fragment header → GFDI frame (length, type, payload, CRC-16/ARC)
//   → COBS between 0x00 delimiters → MultiLink handle byte on every BLE chunk → GATT.
//
// R10Session runs the whole conversation over a transport that only moves bytes (src/r10/ble.js, or a
// test): register with MultiLink, the GFDI handshake (5024, FIT, 5050), subscribe to shot alerts, wake
// the radar, then turn each ShotReadout into the game's BallData shape (see toShot below).

export const SERVICE = '6a4e2800-667b-11e3-949a-0800200c9a66';
export const CHAR_RX = '6a4e2810-667b-11e3-949a-0800200c9a66'; // notify (all inbound) + REGISTER writes
export const CHAR_TX = '6a4e2820-667b-11e3-949a-0800200c9a66'; // outbound GFDI data, handle-prefixed
export const NAME_PREFIX = 'Approach R10';
export const GARMIN_ID = 0x0087;

export const MSG = { ACK: 5000, FILE_TRANSFER: 5003, FILE_DATA: 5004, FIT_DEF: 5011, FIT_DATA: 5012, DEVICE_INFO: 5024, PB_REQUEST: 5043, PB_RESPONSE: 5044, CONFIG: 5050 };
const CAP_SWING_SENSOR = 30;
const MPS_TO_MPH = 2.2369362920544;
const SENTINEL = 0xF0000000; // `finish` sometimes reads ~4.29e9 ms when the follow-through wasn't tracked

// Messages that carry the device's identity (unit ID, names, FIT files, pairing keys): never put their
// bytes in a capture that leaves the machine.
export function carriesIdentity(type) {
  return type === MSG.DEVICE_INFO || type === MSG.FIT_DEF || type === MSG.FIT_DATA || type === MSG.FILE_TRANSFER || type === MSG.FILE_DATA || (type >= 5101 && type <= 5112);
}

const u8 = a => (a instanceof Uint8Array ? a : new Uint8Array(a));
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const le16 = v => [v & 0xFF, (v >>> 8) & 0xFF];
const le32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
export const hex = b => Array.from(u8(b), x => x.toString(16).padStart(2, '0')).join(' ');

// ── CRC-16/ARC (poly 0x8005 reflected = 0xA001, init 0, no xor-out); check value 0xBB3D for "123456789" ──
const CRC_T = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
export function crc16(data) {
  let crc = 0;
  for (const b of data) {
    const t = ((crc >> 4) & 0x0FFF) ^ CRC_T[crc & 0xF] ^ CRC_T[b & 0xF];
    crc = ((t >> 4) & 0x0FFF) ^ CRC_T[t & 0xF] ^ CRC_T[(b >> 4) & 0xF];
  }
  return crc;
}

// ── COBS (Cheshire & Baker), standard form ──
// Every code below 0xFF stands for a zero after its block, except the last block. 10over's encoder drops a
// frame's trailing zero (so a CRC ending in 0x00 would be lost, 1 frame in 256); the standard form keeps it
// and decodes 10over-style input the same way.
export function cobsEncode(data) {
  data = u8(data);
  const out = [];
  let codeAt = 0, code = 1;
  out.push(0);
  for (const b of data) {
    if (b === 0) { out[codeAt] = code; codeAt = out.length; out.push(0); code = 1; continue; }
    out.push(b); code++;
    if (code === 0xFF) { out[codeAt] = code; codeAt = out.length; out.push(0); code = 1; }
  }
  out[codeAt] = code;
  return new Uint8Array(out);
}
export function cobsDecode(data) {
  data = u8(data);
  const out = [];
  let i = 0;
  while (i < data.length) {
    const code = data[i++];
    if (code === 0) throw new Error('COBS: zero byte inside a frame');
    for (let k = 1; k < code; k++) {
      if (i >= data.length) throw new Error('COBS: block runs past the end');
      out.push(data[i++]);
    }
    if (code < 0xFF && i < data.length) out.push(0);
  }
  return new Uint8Array(out);
}

// ── GFDI frames ──
// Host frames always use the standard 4-byte header. Device frames may use the compressed one
// (byte 3 has its high bit set: type = byte2 + 5000, transaction id = byte3 & 0x7F).
export function buildFrame(type, payload = []) {
  payload = u8(payload);
  const len = 2 + 2 + payload.length + 2;
  const body = cat(new Uint8Array([...le16(len), ...le16(type)]), payload);
  return cat(body, new Uint8Array(le16(crc16(body))));
}
export function parseFrame(frame) {
  frame = u8(frame);
  if (frame.length < 6) throw new Error(`GFDI: frame too short (${frame.length} bytes)`);
  const got = frame[frame.length - 2] | (frame[frame.length - 1] << 8), want = crc16(frame.subarray(0, frame.length - 2));
  if (got !== want) throw new Error(`GFDI: CRC ${got.toString(16)} != ${want.toString(16)}`);
  const compressed = (frame[3] & 0x80) !== 0;
  const type = compressed ? frame[2] + 5000 : frame[2] | (frame[3] << 8);
  return { type, txn: compressed ? frame[3] & 0x7F : null, payload: frame.slice(4, frame.length - 2) };
}
export function buildAck(origType, status = 0, payload = []) {
  return buildFrame(MSG.ACK, cat(new Uint8Array([...le16(origType), status]), u8(payload)));
}
export const wrapCobs = frame => cat(new Uint8Array([0]), cobsEncode(frame), new Uint8Array([0]));

// Split a wrapped frame into BLE writes, each led by the MultiLink handle. 20 bytes is the default ATT
// payload (MTU 23), so 19 data bytes ride behind the handle.
export function chunkWithHandle(bytes, handle, size = 20) {
  const per = size - 1, out = [];
  for (let i = 0; i < bytes.length; i += per) out.push(cat(new Uint8Array([handle]), bytes.subarray(i, i + per)));
  return out;
}

// Reassembles the 0x00-delimited COBS stream across notifications (handle byte already stripped).
// Bytes before the first delimiter ever seen are a partial frame from before we joined; they're dropped.
export class FrameStream {
  constructor() { this.buf = []; this.synced = false; }
  push(data) {
    const frames = [];
    for (const b of u8(data)) {
      if (b !== 0) { if (this.synced) { this.buf.push(b); if (this.buf.length > 8192) { this.buf = []; this.synced = false; frames.push({ error: 'COBS: frame over 8 KiB' }); } } continue; }
      if (this.synced && this.buf.length) {
        const cobs = new Uint8Array(this.buf); this.buf = [];
        try { frames.push({ frame: parseFrame(cobsDecode(cobs)) }); } catch (e) { frames.push({ error: e.message, cobs }); }
      }
      this.synced = true;
    }
    return frames;
  }
}

// ── MultiLink registration (13 bytes out on 2810, 16 back) ──
export function buildRegister(txn = 1, service = 1) {
  const b = new Uint8Array(13);
  b[1] = 0x00; // REGISTER
  b.set(le32(txn), 2); // u64 LE, high half zero
  b.set(le16(service), 10);
  return b;
}
export const REGISTER_STATUS = ['success', 'invalid service', 'pending auth', 'already in use', 'rejected'];
export function parseRegisterResponse(data) {
  data = u8(data);
  if (data.length < 15 || data[0] !== 0x00 || data[1] !== 0x01) return null;
  return { status: data[12], handle: data[13] };
}

// ── Handshake payloads ──
export function parseDeviceInfo(p) {
  p = u8(p);
  if (p.length < 12) return null;
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  let pos = 12;
  const str = () => { if (pos >= p.length) return ''; const n = p[pos++]; const s = new TextDecoder().decode(p.subarray(pos, pos + n)); pos += n; return s; };
  return { protocol: dv.getUint16(0, true), product: dv.getUint16(2, true), software: dv.getUint16(8, true), maxPacket: dv.getUint16(10, true), friendly: str(), name: str(), model: str() };
}
export function buildDeviceInfoReply(deviceProtocol = 150, names = ['VibeGolf', 'VibeGolf', 'Web']) {
  const enc = new TextEncoder(), parts = [];
  for (const s of names) { const b = enc.encode(s).slice(0, 255); parts.push(new Uint8Array([b.length]), b); }
  const head = new Uint8Array([...le16(deviceProtocol >= 150 ? 150 : 113), 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, ...le16(100), 0xFF, 0xFF]);
  return buildAck(MSG.DEVICE_INFO, 0, cat(head, ...parts, new Uint8Array([1])));
}
export function buildHostConfig() {
  const bitmap = new Uint8Array(13);
  bitmap[CAP_SWING_SENSOR >> 3] |= 1 << (CAP_SWING_SENSOR & 7); // the launch-monitor capability
  return buildFrame(MSG.CONFIG, cat(new Uint8Array([bitmap.length]), bitmap));
}

// ── Protobuf fragment header (14 bytes) ──
export function buildProtobufRequest(reqId, pb) {
  pb = u8(pb);
  return buildFrame(MSG.PB_REQUEST, cat(new Uint8Array([...le16(reqId), ...le32(0), ...le32(pb.length), ...le32(pb.length)]), pb));
}
export function parseFragment(payload) {
  payload = u8(payload);
  if (payload.length < 14) return null;
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const offset = dv.getUint32(2, true), total = dv.getUint32(6, true), size = dv.getUint32(10, true);
  return { reqId: dv.getUint16(0, true), offset, total, size, data: payload.slice(14, 14 + size) };
}

// ── A small protobuf reader and writer, just for the messages used here ──
// read() returns { field: [values] }: varints as numbers, length-delimited as Uint8Array, fixed32 as
// { f32 } (a float view; every 32-bit field the R10 uses is a float), fixed64 skipped.
export function pbRead(bytes) {
  bytes = u8(bytes);
  const out = {};
  let i = 0;
  const varint = () => {
    let v = 0, mul = 1, b;
    do { if (i >= bytes.length) throw new Error('protobuf: truncated varint'); b = bytes[i++]; v += (b & 0x7F) * mul; mul *= 128; } while (b & 0x80);
    return v;
  };
  while (i < bytes.length) {
    const tag = varint(), field = Math.floor(tag / 8), wire = tag % 8;
    let val;
    if (wire === 0) val = varint();
    else if (wire === 2) { const n = varint(); if (i + n > bytes.length) throw new Error('protobuf: truncated field'); val = bytes.slice(i, i + n); i += n; }
    else if (wire === 5) { if (i + 4 > bytes.length) throw new Error('protobuf: truncated fixed32'); val = { f32: new DataView(bytes.buffer, bytes.byteOffset + i, 4).getFloat32(0, true) }; i += 4; }
    else if (wire === 1) { i += 8; continue; }
    else throw new Error(`protobuf: wire type ${wire}`);
    (out[field] ||= []).push(val);
  }
  return out;
}
const one = (m, f) => (m && m[f] ? m[f][m[f].length - 1] : undefined);          // proto2 optional: last wins
const msg = (m, f) => { const v = one(m, f); return v instanceof Uint8Array ? pbRead(v) : undefined; };
const num = (m, f) => { const v = one(m, f); return typeof v === 'number' ? v : undefined; };
const flt = (m, f) => { const v = one(m, f); return v && typeof v.f32 === 'number' ? v.f32 : undefined; };

function vbytes(v) { const o = []; while (v > 127) { o.push((v % 128) | 0x80); v = Math.floor(v / 128); } o.push(v); return o; }
const pbLen = (field, body) => [...vbytes(field * 8 + 2), ...vbytes(body.length), ...body];
const pbVar = (field, v) => [...vbytes(field * 8), ...vbytes(v)];
const pbF32 = (field, v) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, true); return [...vbytes(field * 8 + 5), ...b]; };

// Envelope { 30: AlertChannel, 38: MonitorChannel }
export const subscribeEnvelope = () => new Uint8Array(pbLen(30, pbLen(1, pbLen(1, pbVar(1, 8)))));     // TOPIC_SHOT_DATA
export const wakeEnvelope = () => new Uint8Array(pbLen(38, pbLen(3, [])));
export function environmentEnvelope(env = {}) {
  const f = [];
  const add = (n, v) => { if (v !== undefined && v !== null && isFinite(v)) f.push(...pbF32(n, +v)); };
  add(1, env.temperatureC); add(2, env.humidity); add(3, env.elevationM); add(4, env.airDensity); add(5, env.teeDistanceYd);
  return new Uint8Array(pbLen(38, pbLen(11, f)));
}

export const PHASES = ['idle', 'noise-check', 'armed', 'capturing', 'analyzing', 'faulted'];
const FAULT_CAUSE = ['unspecified', 'too-hot', 'signal-overload', 'not-level'];
const FAULT_URGENCY = ['low', 'high', 'critical'];
const SPIN_SOURCE = ['estimated', 'model', 'unknown', 'measured'];
const MARKING = [null, 'plain', 'dotted'];

// Decode one Envelope into a single event-like object.
export function decodeEnvelope(bytes) {
  const env = pbRead(bytes);
  const alerts = msg(env, 30);
  if (alerts) {
    const sub = msg(alerts, 2);
    if (sub) { const outs = (sub[1] || []).map(b => num(pbRead(b), 1) || 0); return { kind: 'subscribe', success: outs.length > 0 && outs.every(o => o === 0) }; }
    const note = msg(alerts, 3), rep = note && msg(note, 1001);
    if (rep) {
      const shot = msg(rep, 2);
      if (shot) return { kind: 'shot', readout: readShot(shot) };
      const fault = msg(rep, 3);
      if (fault) {
        const o = msg(fault, 3);
        return { kind: 'fault', cause: FAULT_CAUSE[num(fault, 1) || 0] || 'unspecified', urgency: FAULT_URGENCY[num(fault, 2) || 0] || 'low', tilt: o ? { roll: flt(o, 1) || 0, pitch: flt(o, 2) || 0 } : null };
      }
      const lvl = msg(rep, 4);
      if (lvl) return { kind: 'level', verdict: num(lvl, 1) || 0, attempt: num(lvl, 2) || 0 };
      const st = msg(rep, 1);
      if (st) { const p = num(st, 1) || 0; return { kind: 'state', phase: p, name: PHASES[p] || `phase ${p}` }; }
    }
    return { kind: 'unknown' };
  }
  const mon = msg(env, 38);
  if (mon) {
    const wake = msg(mon, 4);
    if (wake) return { kind: 'wake', outcome: num(wake, 1) || 0 };
    const er = msg(mon, 12);
    if (er) return { kind: 'environment', success: !!num(er, 1) };
    return { kind: 'reply' };
  }
  return { kind: 'unknown' };
}

function readShot(s) {
  const b = msg(s, 3), c = msg(s, 4), t = msg(s, 5);
  return {
    shotNumber: num(s, 1) ?? null,
    kind: num(s, 2) === 1 ? 'regular' : 'warmup',
    ball: b ? { vla: flt(b, 1), hla: flt(b, 2), speed: flt(b, 3), tilt: flt(b, 4), rpm: flt(b, 5), spinSource: num(b, 6), marking: num(b, 7) } : null,
    club: c ? { speed: flt(c, 1), face: flt(c, 2), path: flt(c, 3), attack: flt(c, 4) } : null,
    timing: t ? { takeaway: num(t, 1), transition: num(t, 2), impact: num(t, 3), finish: num(t, 4), captureEnd: num(t, 5) } : null,
  };
}

const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const ms = v => (typeof v === 'number' && v < SENTINEL ? v : null);

// The game's shot shape (GSPro BallData naming, mph/deg/rpm), plus Club and Meta.
//   SpinAxis: + = right (the R10 sends + = tilted left, so it's negated).
//   Club is left out when face, path and attack are all exactly 0 (the R10's slow-swing placeholder).
//   Meta.timing is device ms; a sentinel or missing value is null.
export function toShot(rd) {
  const b = rd.ball;
  if (!b || !(b.speed > 0)) return null;
  const shot = { Speed: r(b.speed * MPS_TO_MPH), VLA: r(b.vla || 0), HLA: r(b.hla || 0), TotalSpin: Math.round(b.rpm || 0), SpinAxis: r(-(b.tilt || 0)) || 0 };
  const c = rd.club;
  if (c && !((c.face || 0) === 0 && (c.path || 0) === 0 && (c.attack || 0) === 0)) {
    shot.Club = { Speed: c.speed > 0 ? r(c.speed * MPS_TO_MPH) : undefined, Path: r(c.path || 0), FaceToTarget: r(c.face || 0), AngleOfAttack: r(c.attack || 0) };
  }
  const t = rd.timing;
  const timing = t ? { takeaway: ms(t.takeaway), transition: ms(t.transition), impact: ms(t.impact), finish: ms(t.finish) } : null;
  shot.Meta = {
    source: 'ble',
    shotNumber: rd.shotNumber,
    spinSource: SPIN_SOURCE[b.spinSource ?? 0] || 'unknown',
    marking: MARKING[b.marking ?? 0] ?? null,
    timing: timing && Object.values(timing).some(v => v !== null) ? timing : null,
  };
  return shot;
}

// ── The session ──
// io = { send(chunk), register(bytes), emit(type, detail), log?(entry), now?() }
//   send: a data write on 2820 (write without response); register: a write on 2810 (with response).
// Events: registered, handshake, ready, state, shot, fault, level, subscribed, wake, environment, nak, error.
export class R10Session {
  constructor(io, { recent = new Map(), dedupeMs = 60000 } = {}) {
    this.io = io; this.recent = recent; this.dedupeMs = dedupeMs;
    this.phase = 'idle'; this.handle = 0; this.stream = new FrameStream();
    this.reqId = 1; this.state = null; this.env = null; this.device = null;
  }
  now() { return this.io.now ? this.io.now() : Date.now(); }
  log(dir, what, extra) { if (this.io.log) this.io.log({ dir, what, ...extra }); }
  emit(type, detail = {}) { this.io.emit(type, detail); }

  start() {
    this.phase = 'registering';
    const reg = buildRegister(1, 1);
    this.log('tx', 'register', { hex: hex(reg) });
    return this.io.register(reg);
  }

  // A tee distance (yards) and the rest of EnvironmentSettings; sent now if the session is up, else on wake.
  setEnvironment(env) {
    this.env = env && Object.values(env).some(v => v !== undefined && v !== null && isFinite(v)) ? env : null;
    if (this.env && this.phase === 'active') this.sendProtobuf(environmentEnvelope(this.env), 'environment');
  }

  receive(chunk) {
    chunk = u8(chunk);
    if (this.phase === 'registering') {
      const resp = parseRegisterResponse(chunk);
      if (resp) {
        this.log('rx', 'register-response', { hex: hex(chunk) });
        if (resp.status !== 0) { this.phase = 'failed'; this.emit('error', { code: 'register', message: `MultiLink refused the link (${REGISTER_STATUS[resp.status] || resp.status})` }); return; }
        this.handle = resp.handle; this.phase = 'device-info';
        this.emit('registered', { handle: resp.handle });
        return;
      }
    }
    if (chunk[0] !== this.handle || this.phase === 'registering') { this.log('rx', 'chunk-skipped', { len: chunk.length, hex: this.phase === 'active' ? hex(chunk) : undefined }); return; }
    this.log('rx', 'chunk', { len: chunk.length, hex: this.phase === 'active' ? hex(chunk) : undefined });
    for (const r of this.stream.push(chunk.subarray(1))) {
      if (r.error) { this.log('rx', 'frame-error', { error: r.error }); continue; }
      this.dispatch(r.frame);
    }
  }

  dispatch(f) {
    const secret = carriesIdentity(f.type) || (f.type === MSG.ACK && f.payload.length >= 2 && carriesIdentity(f.payload[0] | (f.payload[1] << 8)));
    this.log('rx', 'frame', { type: f.type, txn: f.txn, len: f.payload.length, hex: secret ? undefined : hex(f.payload) });
    switch (f.type) {
      case MSG.DEVICE_INFO: {
        this.device = parseDeviceInfo(f.payload);
        this.sendFrame(buildDeviceInfoReply(this.device ? this.device.protocol : 150), 'device-info-ack');
        this.phase = 'config';
        return;
      }
      case MSG.FIT_DEF: case MSG.FIT_DATA:
        this.sendFrame(buildAck(f.type, 0, [0]), 'fit-ack');
        return;
      case MSG.CONFIG:
        this.sendFrame(buildAck(MSG.CONFIG, 0), 'config-ack');
        this.sendFrame(buildHostConfig(), 'host-config');
        this.phase = 'config-ack';
        return;
      case MSG.ACK: {
        if (f.payload.length < 3) return;
        const orig = f.payload[0] | (f.payload[1] << 8), status = f.payload[2];
        if (status !== 0) { this.emit('nak', { type: orig, status }); return; }
        if (orig === MSG.CONFIG && this.phase === 'config-ack') {
          this.phase = 'subscribing';
          this.emit('handshake', { device: this.device });
          this.sendProtobuf(subscribeEnvelope(), 'subscribe');
        }
        return;
      }
      case MSG.PB_REQUEST: case MSG.PB_RESPONSE: {
        let ev = null;
        const frag = parseFragment(f.payload);
        if (frag) {
          // R10 messages fit one frame; a fragmented one is gathered by request id.
          let data = frag.data;
          if (frag.total > frag.size) {
            const p = (this.partial ||= {});
            const cur = p[frag.reqId] ||= new Uint8Array(frag.total);
            cur.set(data.subarray(0, Math.max(0, frag.total - frag.offset)), frag.offset);
            cur.got = (cur.got || 0) + data.length;
            data = cur.got >= frag.total ? (delete p[frag.reqId], cur) : null;
          }
          if (data) { try { ev = decodeEnvelope(data); } catch (e) { this.log('rx', 'protobuf-error', { error: e.message }); } }
        }
        this.sendFrame(buildAck(f.type, 0), 'ack');
        if (ev) this.onEnvelope(ev);
        return;
      }
      default:
    }
  }

  onEnvelope(ev) {
    this.log('rx', 'envelope', { event: ev.kind === 'shot' ? { kind: 'shot', readout: ev.readout } : ev });
    switch (ev.kind) {
      case 'subscribe':
        this.emit('subscribed', { success: ev.success });
        if (this.phase === 'subscribing') { this.phase = 'waking'; this.sendProtobuf(wakeEnvelope(), 'wake'); }
        return;
      case 'wake':
        if (this.phase === 'waking') {
          this.phase = 'active';
          if (this.env) this.sendProtobuf(environmentEnvelope(this.env), 'environment');
        }
        this.emit('wake', { outcome: ev.outcome });
        if (ev.outcome === 1 && this.state !== 2) { this.state = 2; this.emit('ready', {}); } // already armed: no ARMED alert follows
        return;
      case 'environment': this.emit('environment', { success: ev.success }); return;
      case 'state': {
        if (this.state === ev.phase) return; // only act on transitions
        this.state = ev.phase;
        if (ev.phase === 2) this.emit('ready', {});
        else if (ev.phase === 0 && this.phase === 'active') this.sendProtobuf(wakeEnvelope(), 'wake'); // dozed off: wake it again
        this.emit('state', { phase: ev.phase, name: ev.name });
        return;
      }
      case 'shot': {
        const n = ev.readout.shotNumber, t = this.now();
        for (const [k, at] of this.recent) if (t - at > this.dedupeMs) this.recent.delete(k);
        if (n !== null && this.recent.has(n)) { this.log('rx', 'shot-duplicate', { shotNumber: n }); return; } // resent until ACKed
        if (n !== null) this.recent.set(n, t);
        const shot = toShot(ev.readout);
        if (shot) this.emit('shot', shot);
        return;
      }
      case 'fault': this.emit('fault', ev); return;
      case 'level': this.emit('level', ev); return;
      default:
    }
  }

  sendProtobuf(pb, what) {
    const id = this.reqId; this.reqId = (this.reqId + 1) & 0xFFFF || 1;
    this.sendFrame(buildProtobufRequest(id, pb), what, hex(pb));
  }
  sendFrame(frame, what, pb) {
    this.log('tx', what, { hex: hex(frame), pb });
    for (const c of chunkWithHandle(wrapCobs(frame), this.handle)) this.io.send(c);
  }
}
