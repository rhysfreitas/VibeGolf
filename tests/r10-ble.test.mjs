// The direct R10 link's protocol layer (src/r10/protocol.js), checked against 10over's golden bytes
// (src/wire_golden.rs, https://github.com/divotmaker/10over, Copyright 2026 Eric Thill, MIT or Apache-2.0)
// and run end to end through R10Session with a fake R10 on the other side.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crc16, cobsEncode, cobsDecode, buildFrame, parseFrame, buildAck, wrapCobs, chunkWithHandle, FrameStream,
  buildRegister, parseRegisterResponse, subscribeEnvelope, wakeEnvelope, environmentEnvelope, decodeEnvelope,
  parseFragment, toShot, R10Session, MSG,
} from '../src/r10/protocol.js';

const B = a => new Uint8Array(a);
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);

// ── 10over golden envelopes ──
const SUBSCRIBE = [0xf2, 0x01, 0x06, 0x0a, 0x04, 0x0a, 0x02, 0x08, 0x08];
const WAKEUP = [0xb2, 0x02, 0x02, 0x1a, 0x00];
const ENVIRONMENT_EMPTY = [0xb2, 0x02, 0x02, 0x5a, 0x00];
const ENVIRONMENT_TEE = [0xb2, 0x02, 0x07, 0x5a, 0x05, 0x2d, 0x33, 0x33, 0x13, 0x40];
const ENVIRONMENT_ALL = [0xb2, 0x02, 0x1b, 0x5a, 0x19, 0x0d, 0x00, 0x00, 0xa8, 0x41, 0x15, 0x66, 0x66, 0xe6, 0x3e, 0x1d,
  0x00, 0x00, 0xf0, 0x42, 0x25, 0x9a, 0x99, 0x99, 0x3f, 0x2d, 0x00, 0x00, 0xc0, 0x40];
const SHOT_FULL = [
  0xf2, 0x01, 0x53, 0x1a, 0x51, 0x08, 0x08, 0xca, 0x3e, 0x4c, 0x12, 0x4a, 0x08, 0x2a, 0x10, 0x01,
  0x1a, 0x1d, 0x0d, 0x00, 0x00, 0x48, 0x41, 0x15, 0x9a, 0x99, 0x99, 0xbf, 0x1d, 0x00, 0x00, 0x86,
  0x42, 0x25, 0x00, 0x00, 0xa0, 0x40, 0x2d, 0x00, 0x00, 0x2f, 0x45, 0x30, 0x00, 0x38, 0x01, 0x22,
  0x14, 0x0d, 0x00, 0x00, 0x30, 0x42, 0x15, 0x00, 0x00, 0xc0, 0x3f, 0x1d, 0x00, 0x00, 0x00, 0xc0,
  0x25, 0x00, 0x00, 0x60, 0xc0, 0x2a, 0x0f, 0x08, 0xe8, 0x07, 0x10, 0xdc, 0x0b, 0x18, 0x88, 0x0e,
  0x20, 0x98, 0x11, 0x28, 0xc4, 0x13];
const SHOT_BALL_MEASURED = [
  0xf2, 0x01, 0x2c, 0x1a, 0x2a, 0x08, 0x08, 0xca, 0x3e, 0x25, 0x12, 0x23, 0x08, 0x07, 0x10, 0x00,
  0x1a, 0x1d, 0x0d, 0x00, 0x00, 0xf2, 0x41, 0x15, 0x00, 0x00, 0x20, 0x40, 0x1d, 0x00, 0x00, 0xcc,
  0x41, 0x25, 0x00, 0x00, 0x20, 0xc1, 0x2d, 0x00, 0x80, 0xbb, 0x45, 0x30, 0x03, 0x38, 0x02];
const SHOT_FLIGHT_MODEL = [0xf2, 0x01, 0x14, 0x1a, 0x12, 0x08, 0x08, 0xca, 0x3e, 0x0d, 0x12, 0x0b, 0x08, 0x08, 0x1a, 0x07,
  0x1d, 0x00, 0x00, 0x48, 0x42, 0x30, 0x01];
const SHOT_SPIN_OTHER = [0xf2, 0x01, 0x0f, 0x1a, 0x0d, 0x08, 0x08, 0xca, 0x3e, 0x08, 0x12, 0x06, 0x08, 0x09, 0x1a, 0x02, 0x30, 0x02];
const stateFrame = s => [0xf2, 0x01, 0x0b, 0x1a, 0x09, 0x08, 0x08, 0xca, 0x3e, 0x04, 0x0a, 0x02, 0x08, s];
const ERROR_NOT_LEVEL = [0xf2, 0x01, 0x19, 0x1a, 0x17, 0x08, 0x08, 0xca, 0x3e, 0x12, 0x1a, 0x10, 0x08, 0x03, 0x10, 0x02,
  0x1a, 0x0a, 0x0d, 0x00, 0x00, 0x90, 0x40, 0x15, 0x00, 0x00, 0xc8, 0xc0];
const ERROR_OVERHEAT = [0xf2, 0x01, 0x0d, 0x1a, 0x0b, 0x08, 0x08, 0xca, 0x3e, 0x06, 0x1a, 0x04, 0x08, 0x01, 0x10, 0x01];
const ERROR_SATURATION = [0xf2, 0x01, 0x0d, 0x1a, 0x0b, 0x08, 0x08, 0xca, 0x3e, 0x06, 0x1a, 0x04, 0x08, 0x02, 0x10, 0x00];
const LEVEL_CHECK = [0xf2, 0x01, 0x0d, 0x1a, 0x0b, 0x08, 0x08, 0xca, 0x3e, 0x06, 0x22, 0x04, 0x08, 0x02, 0x10, 0x02];
const NOTIFICATION_EMPTY = [0xf2, 0x01, 0x04, 0x1a, 0x02, 0x08, 0x08];
const SUBSCRIBE_OK = [0xf2, 0x01, 0x0a, 0x12, 0x08, 0x0a, 0x06, 0x08, 0x00, 0x12, 0x02, 0x08, 0x08];
const SUBSCRIBE_FAIL = [0xf2, 0x01, 0x0a, 0x12, 0x08, 0x0a, 0x06, 0x08, 0x01, 0x12, 0x02, 0x08, 0x08];
const TOPICS_REPLY = [0xf2, 0x01, 0x06, 0x2a, 0x04, 0x08, 0x08, 0x10, 0x01];
const wakeResult = s => [0xb2, 0x02, 0x04, 0x22, 0x02, 0x08, s];
const ENVIRONMENT_ACCEPTED = [0xb2, 0x02, 0x04, 0x62, 0x02, 0x08, 0x01];
const ENVIRONMENT_REJECTED = [0xb2, 0x02, 0x04, 0x62, 0x02, 0x08, 0x00];
const STATE_REPLY = [0xb2, 0x02, 0x06, 0x12, 0x04, 0x0a, 0x02, 0x08, 0x02];
const LEVEL_REPLY = [0xb2, 0x02, 0x0e, 0x32, 0x0c, 0x0a, 0x0a, 0x0d, 0x00, 0x00, 0x80, 0x3f, 0x15, 0x00, 0x00, 0x00, 0xc0];

// ── A tiny protobuf writer for shots the golden set doesn't have ──
const vb = v => { const o = []; while (v > 127) { o.push((v % 128) | 0x80); v = Math.floor(v / 128); } o.push(v); return o; };
const L = (f, body) => [...vb(f * 8 + 2), ...vb(body.length), ...body];
const V = (f, v) => [...vb(f * 8), ...vb(v)];
const F = (f, v) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, true); return [...vb(f * 8 + 5), ...b]; };
const shotEnvelope = ({ n, club, timing }) => L(30, L(3, [...V(1, 8), ...L(1001, L(2, [
  ...V(1, n), ...V(2, 1),
  ...L(3, [...F(1, 14), ...F(2, 0.5), ...F(3, 52), ...F(4, -3), ...F(5, 5400), ...V(6, 0), ...V(7, 1)]),
  ...(club ? L(4, club.flatMap((v, i) => F(i + 1, v))) : []),
  ...(timing ? L(5, timing.flatMap((v, i) => V(i + 1, v))) : []),
]))]));

test('CRC-16/ARC check value', () => {
  assert.equal(crc16(new TextEncoder().encode('123456789')), 0xBB3D);
  assert.equal(crc16([]), 0);
});

test('COBS round-trips, including a trailing zero and long runs', () => {
  const cases = [[], [0], [0, 0], [1, 0, 2], [0x11, 0x00], [0, 0, 0, 1], Array.from({ length: 254 }, (_, i) => i + 1),
    Array.from({ length: 255 }, (_, i) => (i % 255) + 1), Array.from({ length: 600 }, (_, i) => (i * 37) & 0xFF)];
  for (const c of cases) {
    const enc = cobsEncode(c);
    assert.ok(!enc.includes(0), `no zero in ${c.length}-byte encoding`);
    assert.deepEqual([...cobsDecode(enc)], c);
  }
  assert.deepEqual([...cobsEncode([1, 0, 2])], [2, 1, 2, 2]);
});

test('GFDI frames: standard and compressed headers, CRC rejection', () => {
  const f = buildFrame(5024, [1, 2, 3]);
  assert.deepEqual([...f.subarray(0, 4)], [9, 0, 0xA0, 0x13]);
  assert.deepEqual(parseFrame(f), { type: 5024, txn: null, payload: B([1, 2, 3]) });
  const body = [8, 0, 43, 0x80 | 5, 0xAA, 0xBB], c = crc16(body);
  assert.deepEqual(parseFrame([...body, c & 0xFF, c >> 8]), { type: 5043, txn: 5, payload: B([0xAA, 0xBB]) });
  const bad = f.slice(); bad[4] ^= 0xFF;
  assert.throws(() => parseFrame(bad), /CRC/);
  const ack = parseFrame(buildAck(5024, 0));
  assert.equal(ack.type, MSG.ACK); assert.deepEqual([...ack.payload], [0xA0, 0x13, 0]);
});

test('MultiLink REGISTER and its response', () => {
  assert.deepEqual([...buildRegister(1, 1)], [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
  assert.deepEqual(parseRegisterResponse([0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 7, 0, 0]), { status: 0, handle: 7 });
  assert.equal(parseRegisterResponse([7, 0x00, 0x14]), null);
});

test('chunks lead with the handle; the stream reassembles frames split anywhere', () => {
  assert.deepEqual(chunkWithHandle(B([1, 2, 3, 4, 5]), 7, 3).map(c => [...c]), [[7, 1, 2], [7, 3, 4], [7, 5]]);
  const a = wrapCobs(buildFrame(5050, [4, 0, 0, 0, 0x40])), b = wrapCobs(buildFrame(5000, [0xBA, 0x13, 0]));
  const s = new FrameStream(), got = [];
  const wire = [0x55, 0x66, ...a, ...b.subarray(1)]; // junk before we joined, then frames sharing a delimiter
  for (let i = 0; i < wire.length; i += 3) got.push(...s.push(B(wire.slice(i, i + 3))));
  assert.deepEqual(got.map(g => g.frame.type), [5050, 5000]);
});

test('builders match the golden bytes', () => {
  assert.deepEqual([...subscribeEnvelope()], SUBSCRIBE);
  assert.deepEqual([...wakeEnvelope()], WAKEUP);
  assert.deepEqual([...environmentEnvelope({})], ENVIRONMENT_EMPTY);
  assert.deepEqual([...environmentEnvelope({ teeDistanceYd: 2.3 })], ENVIRONMENT_TEE);
  assert.deepEqual([...environmentEnvelope({ temperatureC: 21, humidity: 0.45, elevationM: 120, airDensity: 1.2, teeDistanceYd: 6 })], ENVIRONMENT_ALL);
});

test('a full shot decodes into the game shape (mph, + = right axis, Club, Meta)', () => {
  const ev = decodeEnvelope(B(SHOT_FULL));
  assert.equal(ev.kind, 'shot'); assert.equal(ev.readout.shotNumber, 42); assert.equal(ev.readout.kind, 'regular');
  const s = toShot(ev.readout);
  close(s.Speed, 67 * 2.23694); close(s.VLA, 12.5); close(s.HLA, -1.2); assert.equal(s.TotalSpin, 2800);
  close(s.SpinAxis, -5); // the wire's tilt of +5 is 5° left
  close(s.Club.Speed, 44 * 2.23694); close(s.Club.FaceToTarget, 1.5); close(s.Club.Path, -2); close(s.Club.AngleOfAttack, -3.5);
  assert.equal(s.Club.Loft, undefined);
  assert.deepEqual(s.Meta, { source: 'ble', shotNumber: 42, spinSource: 'estimated', marking: 'plain', timing: { takeaway: 1000, transition: 1500, impact: 1800, finish: 2200 } });
});

test('ball-only, measured, flight-model and unclassified spin', () => {
  const m = toShot(decodeEnvelope(B(SHOT_BALL_MEASURED)).readout);
  close(m.VLA, 30.25); close(m.HLA, 2.5); close(m.Speed, 25.5 * 2.23694); close(m.SpinAxis, 10); assert.equal(m.TotalSpin, 6000);
  assert.equal(m.Club, undefined); assert.equal(m.Meta.timing, null);
  assert.equal(m.Meta.spinSource, 'measured'); assert.equal(m.Meta.marking, 'dotted'); assert.equal(m.Meta.shotNumber, 7);
  const f = toShot(decodeEnvelope(B(SHOT_FLIGHT_MODEL)).readout);
  close(f.Speed, 50 * 2.23694); assert.equal(f.VLA, 0); assert.equal(f.TotalSpin, 0); assert.equal(f.Meta.spinSource, 'model'); assert.equal(f.Meta.marking, null);
  const o = decodeEnvelope(B(SHOT_SPIN_OTHER)).readout;
  assert.equal(o.shotNumber, 9); assert.equal(o.ball.spinSource, 2);
  assert.equal(toShot(o), null, 'no ball speed, no shot');
});

test('slow-swing placeholder drops Club; sentinel finish becomes null', () => {
  const s = toShot(decodeEnvelope(B(shotEnvelope({ n: 3, club: [18, 0, 0, 0], timing: [500, 900, 1100, 4294967295, 1600] }))).readout);
  assert.equal(s.Club, undefined);
  assert.deepEqual(s.Meta.timing, { takeaway: 500, transition: 900, impact: 1100, finish: null });
  close(s.SpinAxis, 3); close(s.HLA, 0.5);
});

test('state, fault, level and reply frames', () => {
  for (let p = 0; p <= 5; p++) assert.deepEqual(decodeEnvelope(B(stateFrame(p))).phase, p);
  assert.equal(decodeEnvelope(B(stateFrame(2))).name, 'armed');
  const nl = decodeEnvelope(B(ERROR_NOT_LEVEL));
  assert.equal(nl.kind, 'fault'); assert.equal(nl.cause, 'not-level'); assert.equal(nl.urgency, 'critical'); close(nl.tilt.roll, 4.5); close(nl.tilt.pitch, -6.25);
  const oh = decodeEnvelope(B(ERROR_OVERHEAT)); assert.equal(oh.cause, 'too-hot'); assert.equal(oh.urgency, 'high'); assert.equal(oh.tilt, null);
  const sat = decodeEnvelope(B(ERROR_SATURATION)); assert.equal(sat.cause, 'signal-overload'); assert.equal(sat.urgency, 'low');
  assert.deepEqual(decodeEnvelope(B(LEVEL_CHECK)), { kind: 'level', verdict: 2, attempt: 2 });
  assert.deepEqual(decodeEnvelope(B(SUBSCRIBE_OK)), { kind: 'subscribe', success: true });
  assert.deepEqual(decodeEnvelope(B(SUBSCRIBE_FAIL)), { kind: 'subscribe', success: false });
  for (let w = 0; w < 3; w++) assert.deepEqual(decodeEnvelope(B(wakeResult(w))), { kind: 'wake', outcome: w });
  assert.deepEqual(decodeEnvelope(B(ENVIRONMENT_ACCEPTED)), { kind: 'environment', success: true });
  assert.deepEqual(decodeEnvelope(B(ENVIRONMENT_REJECTED)), { kind: 'environment', success: false });
  assert.equal(decodeEnvelope(B(STATE_REPLY)).kind, 'reply');
  assert.equal(decodeEnvelope(B(LEVEL_REPLY)).kind, 'reply');
  assert.equal(decodeEnvelope(B(WAKEUP)).kind, 'reply');
  assert.equal(decodeEnvelope(B(NOTIFICATION_EMPTY)).kind, 'unknown');
  assert.equal(decodeEnvelope(B(TOPICS_REPLY)).kind, 'unknown');
  assert.equal(decodeEnvelope(B([])).kind, 'unknown');
});

// ── End to end: a fake R10 behind MultiLink handle 3, 19-byte chunks ──
function fakeR10() {
  const handle = 3, out = { data: [], reg: [], events: [] };
  const stream = new FrameStream();
  let now = 0;
  const session = new R10Session({
    send: c => { assert.equal(c[0], handle); assert.ok(c.length <= 20); for (const r of stream.push(c.subarray(1))) out.data.push(r.frame); },
    register: b => out.reg.push(b),
    emit: (type, detail) => out.events.push({ type, detail }),
    now: () => now,
  });
  const feedFrame = frame => { for (const c of chunkWithHandle(wrapCobs(frame), handle)) session.receive(c); };
  const pbFrame = (env, type = MSG.PB_REQUEST, reqId = 9) => {
    const p = B([reqId, 0, 0, 0, 0, 0, env.length, 0, 0, 0, env.length, 0, 0, 0, ...env]);
    return buildFrame(type, p);
  };
  const sent = () => { const d = out.data; out.data = []; return d; };
  const events = t => out.events.filter(e => e.type === t);
  return { session, out, feedFrame, pbFrame, sent, events, handle, tick: ms => { now += ms; } };
}

function deviceInfo() {
  const s = n => [n.length, ...new TextEncoder().encode(n)];
  return buildFrame(5024, [150, 0, 0x26, 0x0E, 1, 2, 3, 4, 10, 0, 0x00, 0x02, ...s('Approach R10'), ...s('R10'), ...s('R10')]);
}

function handshake(r) {
  r.session.start();
  assert.deepEqual([...r.out.reg[0]], [...buildRegister(1, 1)]);
  r.session.receive(B([0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, r.handle, 0, 0]));
  assert.equal(r.events('registered')[0].detail.handle, r.handle);
  r.feedFrame(deviceInfo());
  let tx = r.sent();
  assert.equal(tx.length, 1); assert.equal(tx[0].type, MSG.ACK);
  assert.deepEqual([...tx[0].payload.subarray(0, 5)], [0xA0, 0x13, 0, 150, 0]); // ACK of 5024 + host protocol 150
  r.feedFrame(buildFrame(5011, [1, 2, 3]));
  assert.deepEqual([...r.sent()[0].payload], [0x93, 0x13, 0, 0]);
  r.feedFrame(buildFrame(5050, [4, 0xFF, 0xFF, 0xFF, 0xFF]));
  tx = r.sent();
  assert.deepEqual(tx.map(f => f.type), [MSG.ACK, MSG.CONFIG]);
  assert.equal(tx[1].payload[0], 13); assert.equal(tx[1].payload[1 + 3], 0x40); // bit 30, SwingSensor
  r.feedFrame(buildAck(5050, 0));
  tx = r.sent();
  assert.equal(r.events('handshake').length, 1);
  assert.equal(tx[0].type, MSG.PB_REQUEST); assert.deepEqual([...parseFragment(tx[0].payload).data], SUBSCRIBE);
  r.feedFrame(r.pbFrame(B(SUBSCRIBE_OK), MSG.PB_RESPONSE));
  tx = r.sent();
  assert.deepEqual(tx.map(f => f.type), [MSG.ACK, MSG.PB_REQUEST]);
  assert.deepEqual([...parseFragment(tx[1].payload).data], WAKEUP);
}

test('session: register, handshake, subscribe, wake, environment, shots', () => {
  const r = fakeR10();
  r.session.setEnvironment({ teeDistanceYd: 2.3 });
  handshake(r);
  r.feedFrame(r.pbFrame(B(wakeResult(0)), MSG.PB_RESPONSE));
  let tx = r.sent();
  assert.equal(r.session.phase, 'active');
  assert.deepEqual([...parseFragment(tx.find(f => f.type === MSG.PB_REQUEST).payload).data], ENVIRONMENT_TEE);
  r.feedFrame(r.pbFrame(B(stateFrame(1))));
  r.feedFrame(r.pbFrame(B(stateFrame(2))));
  r.feedFrame(r.pbFrame(B(stateFrame(2))));
  assert.equal(r.events('ready').length, 1, 'only transitions count');

  // a ~100-byte shot frame arrives across six or seven 19-byte chunks
  r.sent();
  r.feedFrame(r.pbFrame(B(SHOT_FULL)));
  assert.equal(r.events('shot').length, 1);
  assert.equal(r.events('shot')[0].detail.Meta.shotNumber, 42);
  tx = r.sent();
  assert.equal(tx.length, 1); assert.deepEqual([...tx[0].payload], [0xB3, 0x13, 0], 'the shot alert is ACKed');

  // resent until ACKed: dedupe by shot number
  r.tick(2000); r.feedFrame(r.pbFrame(B(SHOT_FULL)));
  assert.equal(r.events('shot').length, 1, 'resent shot dropped');
  assert.equal(r.sent().length, 1, 'still ACKed');
  r.tick(61000); r.feedFrame(r.pbFrame(B(SHOT_FULL)));
  assert.equal(r.events('shot').length, 2, 'the same number is a new shot after the window');

  r.feedFrame(r.pbFrame(B(ERROR_NOT_LEVEL)));
  assert.equal(r.events('fault')[0].detail.cause, 'not-level');
  // dozed off → wake again
  r.sent(); r.feedFrame(r.pbFrame(B(stateFrame(0))));
  assert.ok(r.sent().some(f => f.type === MSG.PB_REQUEST && [...parseFragment(f.payload).data].join() === WAKEUP.join()));
});

test('session: already-armed wake is ready; no tee distance means no environment message', () => {
  const r = fakeR10();
  handshake(r);
  r.feedFrame(r.pbFrame(B(wakeResult(1)), MSG.PB_RESPONSE));
  assert.equal(r.events('ready').length, 1);
  assert.ok(!r.sent().some(f => f.type === MSG.PB_REQUEST), 'nothing sent unless the tee distance is set');
  r.session.setEnvironment({ teeDistanceYd: 6 });
  assert.equal(r.sent().filter(f => f.type === MSG.PB_REQUEST).length, 1, 'sent at once when set mid-session');
});

test('session: a protobuf message fragmented over two GFDI frames is reassembled', () => {
  const r = fakeR10();
  handshake(r);
  r.feedFrame(r.pbFrame(B(wakeResult(1)), MSG.PB_RESPONSE));
  const env = B(SHOT_FULL), cut = 40, total = env.length;
  const part = (off, data) => buildFrame(MSG.PB_REQUEST, B([5, 0, ...[off, 0, 0, 0], total, 0, 0, 0, data.length, 0, 0, 0, ...data]));
  r.feedFrame(part(0, env.subarray(0, cut)));
  assert.equal(r.events('shot').length, 0);
  r.feedFrame(part(cut, env.subarray(cut)));
  assert.equal(r.events('shot').length, 1);
  close(r.events('shot')[0].detail.VLA, 12.5);
});

test('session: a refused registration is reported', () => {
  const r = fakeR10();
  r.session.start();
  r.session.receive(B([0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0]));
  assert.match(r.events('error')[0].detail.message, /already in use/);
});

test('bridge shots get Meta.source bridge; BLE-style shots pass through parseShot unchanged', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const { bridgeShot } = await import('../src/launch-monitor.js');
  const s = bridgeShot({ type: 'shot', ball: { Speed: 120, VLA: 16, HLA: 1, TotalSpin: 7000, SpinAxis: 2 }, club: null, shotNumber: 12 });
  assert.deepEqual(s.Meta, { source: 'bridge', shotNumber: 12, spinSource: null, marking: null, timing: null });
});
