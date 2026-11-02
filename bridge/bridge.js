#!/usr/bin/env node
// VibeGolf launch-monitor bridge.
//
//   R10 ──BLE──> OpenLaunch Connect / gsp-r10-adapter / any GSPro connector
//                      │  GSPro Open Connect v1 (TCP, JSON)  → this bridge, port 921
//                      ▼
//              bridge.js ──WebSocket (ws://localhost:8921)──> VibeGolf in the browser
//
// The connector thinks it is talking to GSPro. Each shot is acknowledged with Code 200, and
// the club you pick in the game is sent back as GSPro "player information" (Code 201) so the
// connector tags shots with the right club.
//
// Usage:  npm install   then   npm start   (options: --tcp 921 --ws 8921)

import net from 'node:net';
import { WebSocketServer } from 'ws';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? +process.argv[i + 1] : def; };
export const DEFAULTS = { tcpPort: arg('tcp', 921), wsPort: arg('ws', 8921) };

// Connectors write JSON objects back to back with no delimiter, so split on brace depth.
export function createJsonSplitter(onObject) {
  let buf = '', pos = 0, depth = 0, inStr = false, esc = false, start = -1;
  return chunk => {
    buf += chunk;
    for (; pos < buf.length; pos++) {          // resume where the last chunk stopped
      const c = buf[pos];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') { if (depth++ === 0) start = pos; }
      else if (c === '}' && depth > 0 && --depth === 0) {
        try { onObject(JSON.parse(buf.slice(start, pos + 1))); } catch (e) { /* skip malformed object */ }
        buf = buf.slice(pos + 1); pos = -1; start = -1;
      }
    }
    if (depth === 0) { buf = ''; pos = 0; }    // drop whitespace between objects
    if (buf.length > 1e6) { buf = ''; pos = 0; depth = 0; inStr = false; }
  };
}

export function startBridge({ tcpPort = DEFAULTS.tcpPort, wsPort = DEFAULTS.wsPort, log = console.log } = {}) {
  const browsers = new Set();
  const connectors = new Set();
  let device = null, player = { Handed: 'RH', Club: 'DR' };

  const toBrowsers = obj => { const s = JSON.stringify(obj); for (const b of browsers) if (b.readyState === 1) b.send(s); };
  const status = () => toBrowsers({ type: 'status', device, connectors: connectors.size });
  const sendPlayer = sock => sock.write(JSON.stringify({ Code: 201, Message: 'GSPro Player Information', Player: player }));

  // --- TCP side: GSPro Open Connect ---
  const tcp = net.createServer(sock => {
    connectors.add(sock);
    sock.setEncoding('utf8');
    log(`connector connected from ${sock.remoteAddress}`);
    sendPlayer(sock);
    const split = createJsonSplitter(msg => {
      const opts = msg.ShotDataOptions || {};
      if (msg.DeviceID) device = msg.DeviceID;
      if (opts.IsHeartBeat) { status(); return; }
      if (opts.ContainsBallData === false || !msg.BallData) { status(); return; }
      sock.write(JSON.stringify({ Code: 200, Message: 'Shot received successfully' }));
      const b = msg.BallData;
      log(`shot ${msg.ShotNumber ?? ''}: ${(+b.Speed).toFixed(1)} mph, ${(+b.VLA).toFixed(1)}° launch, ${Math.round(+b.TotalSpin || 0)} rpm`);
      toBrowsers({ type: 'shot', ball: b, club: msg.ClubData || null, shotNumber: msg.ShotNumber ?? null });
    });
    sock.on('data', split);
    sock.on('close', () => { connectors.delete(sock); if (!connectors.size) device = null; status(); log('connector disconnected'); });
    sock.on('error', () => {});
    status();
  });
  tcp.listen(tcpPort, () => log(`GSPro Open Connect listening on tcp://0.0.0.0:${tcpPort}`));

  // --- WebSocket side: the game ---
  const wss = new WebSocketServer({ port: wsPort });
  wss.on('connection', ws => {
    browsers.add(ws);
    log('game connected');
    ws.send(JSON.stringify({ type: 'status', device, connectors: connectors.size }));
    ws.on('message', data => {
      let msg; try { msg = JSON.parse(data); } catch (e) { return; }
      if (msg.type === 'player') {
        player = { Handed: msg.handed || player.Handed, Club: msg.club || player.Club };
        for (const c of connectors) sendPlayer(c);
      }
    });
    ws.on('close', () => browsers.delete(ws));
  });
  wss.on('listening', () => log(`Game WebSocket on ws://localhost:${wsPort}`));

  return {
    close: () => new Promise(res => { for (const c of connectors) c.destroy(); wss.close(); tcp.close(() => res()); }),
    tcp, wss,
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('bridge.js');
if (isMain) {
  startBridge();
  console.log('Point your connector at this computer (GSPro mode, port ' + DEFAULTS.tcpPort + '), then press Connect in the game.');
}
