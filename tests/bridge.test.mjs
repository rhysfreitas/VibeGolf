// End to end: a fake GSPro connector sends a shot over TCP; a game client receives it over WebSocket.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { startBridge, createJsonSplitter } from '../bridge/bridge.js';

test('splits back-to-back JSON objects, including braces inside strings', () => {
  const got = [];
  const split = createJsonSplitter(o => got.push(o));
  split('{"a":1}{"b":"x}{"}');
  split('{"c":');
  split('3}');
  assert.deepEqual(got, [{ a: 1 }, { b: 'x}{' }, { c: 3 }]);
});

test('relays a GSPro Open Connect shot to the game and acks the connector', async () => {
  const bridge = startBridge({ tcpPort: 19921, wsPort: 18921, log: () => {} });
  await new Promise(r => setTimeout(r, 150));
  const ws = new WebSocket('ws://localhost:18921');
  const messages = [];
  ws.onmessage = e => messages.push(JSON.parse(e.data));
  await new Promise(r => { ws.onopen = r; });

  const sock = net.connect(19921, '127.0.0.1');
  const fromBridge = [];
  sock.setEncoding('utf8');
  sock.on('data', createJsonSplitter(o => fromBridge.push(o)));
  await new Promise(r => sock.on('connect', r));

  // the game picks a club; the connector should hear about it
  ws.send(JSON.stringify({ type: 'player', club: 'I7', handed: 'RH' }));
  await new Promise(r => setTimeout(r, 100));

  sock.write(JSON.stringify({ DeviceID: 'Approach R10', ShotNumber: 1, APIversion: '1', ShotDataOptions: { IsHeartBeat: true } }));
  sock.write(JSON.stringify({
    DeviceID: 'Approach R10', Units: 'Yards', ShotNumber: 2, APIversion: '1',
    BallData: { Speed: 121.4, SpinAxis: -3.2, TotalSpin: 6900, HLA: 1.1, VLA: 16.8 },
    ClubData: { Speed: 1, Path: 1, FaceToTarget: 1, AngleOfAttack: 1, Loft: 1 },   // a connector's placeholders
    ShotDataOptions: { ContainsBallData: true, ContainsClubData: false, IsHeartBeat: false },
  }));
  await new Promise(r => setTimeout(r, 200));

  const shot = messages.find(m => m.type === 'shot');
  assert.ok(shot, 'game received the shot');
  assert.equal(shot.ball.Speed, 121.4);
  assert.equal(shot.club, null, 'club data marked absent is dropped, placeholders and all');
  assert.ok(messages.some(m => m.type === 'status' && m.device === 'Approach R10'), 'game saw the device');
  assert.ok(fromBridge.some(m => m.Code === 200), 'connector got Code 200');
  assert.ok(fromBridge.some(m => m.Code === 201 && m.Player.Club === 'I7'), 'connector got the club');

  sock.destroy(); ws.close(); await bridge.close();
});

test('club data from the connector reaches the game', async () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const { parseShot } = await import('../src/launch-monitor.js');
  const shot = parseShot({ type: 'shot', ball: { Speed: 158.4, VLA: 12.2, HLA: 2.4, TotalSpin: 2950, SpinAxis: 7.5 }, club: { Speed: 106.9, Path: -1.8, FaceToTarget: 2.6, AngleOfAttack: 1.2 } });
  assert.equal(shot.Club.Speed, 106.9);
  assert.equal(shot.Club.Path, -1.8);
  assert.equal(shot.Club.AngleOfAttack, 1.2);
  assert.equal(parseShot({ BallData: { Speed: 120, VLA: 16, TotalSpin: 7000 } }).Club, undefined);
});
