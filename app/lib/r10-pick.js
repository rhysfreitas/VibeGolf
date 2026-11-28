// Which Bluetooth device to hand the game when it asks for its R10 (Electron's `select-bluetooth-device`,
// which fires again each time the scan finds more). Pure: the main process feeds it the list and the clock.
//
// - The R10 picked last time is taken the moment it shows up: no chooser.
// - mode 'auto' (the app reconnecting by itself at start): only the remembered R10, silently; give up after
//   AUTO_WAIT so the game can say so and offer Connect R10.
// - mode 'tap' (the player pressed Connect R10): after SETTLE, a single device named like an R10 is taken;
//   otherwise the app's chooser opens and lists what it finds (as Chrome's would).
'use strict';
const SETTLE = 1500, AUTO_WAIT = 25000;
const isR10 = d => /(^|\s)R10\b/i.test(d.deviceName || '');

function decide(list, { mode = 'tap', remembered = null, started = 0 } = {}, now = Date.now()) {
  const waited = now - started;
  if (remembered && list.some(d => d.deviceId === remembered)) return { pick: remembered };
  if (mode === 'auto') return waited > AUTO_WAIT ? { cancel: true } : { wait: true };
  if (waited < SETTLE) return { wait: true };
  const r10s = list.filter(isR10);
  if (r10s.length === 1 && r10s.length === list.length) return { pick: r10s[0].deviceId };
  if (r10s.length === 1 && !remembered) return { pick: r10s[0].deviceId };
  return { ask: true };
}

// What the chooser shows for each device, R10s first.
const label = d => d.deviceName || `Unnamed device (${String(d.deviceId).slice(-5)})`;
const forChooser = list => [...list].sort((a, b) => isR10(b) - isR10(a)).map(d => ({ id: d.deviceId, name: label(d), r10: isR10(d) }));

module.exports = { decide, forChooser, isR10, SETTLE, AUTO_WAIT };
