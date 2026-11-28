import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { decide, forChooser, SETTLE, AUTO_WAIT } = require('../lib/r10-pick.js');
const { restore } = require('../lib/window-state.js');
const { isSiteFile } = require('../lib/site-files.js');
const { isPlayPage } = require('../lib/pages.js');

const R10 = { deviceName: 'Approach R10', deviceId: 'r10' }, R10B = { deviceName: 'R10 1234', deviceId: 'r10b' };
const MOUSE = { deviceName: 'MX Master', deviceId: 'mouse' }, ANON = { deviceName: '', deviceId: 'aa:bb:cc:dd:ee' };

test('the remembered R10 is taken at once, in either mode', () => {
  assert.deepEqual(decide([MOUSE, R10], { mode: 'tap', remembered: 'r10', started: 0 }, 10), { pick: 'r10' });
  assert.deepEqual(decide([R10], { mode: 'auto', remembered: 'r10', started: 0 }, 10), { pick: 'r10' });
});

test('reconnecting by itself waits only for the remembered R10, then gives up', () => {
  assert.deepEqual(decide([R10B, MOUSE], { mode: 'auto', remembered: 'r10', started: 0 }, 1000), { wait: true });
  assert.deepEqual(decide([], { mode: 'auto', remembered: 'r10', started: 0 }, AUTO_WAIT + 1), { cancel: true });
});

test('a tap: one R10 is taken after the scan settles; anything less clear opens the chooser', () => {
  assert.deepEqual(decide([R10], { mode: 'tap', started: 0 }, SETTLE - 1), { wait: true });
  assert.deepEqual(decide([R10], { mode: 'tap', started: 0 }, SETTLE), { pick: 'r10' });
  assert.deepEqual(decide([R10, MOUSE], { mode: 'tap', started: 0 }, SETTLE), { pick: 'r10' }, 'first time, the only R10 among others');
  assert.deepEqual(decide([R10, R10B], { mode: 'tap', started: 0 }, SETTLE), { ask: true }, 'two R10s');
  assert.deepEqual(decide([MOUSE, ANON], { mode: 'tap', started: 0 }, SETTLE), { ask: true }, 'Show all devices: no name to go by');
  assert.deepEqual(decide([R10B, MOUSE], { mode: 'tap', remembered: 'r10', started: 0 }, SETTLE), { ask: true }, 'a different R10 than last time, among others');
  assert.deepEqual(decide([], { mode: 'tap', started: 0 }, SETTLE), { ask: true });
});

test('the chooser lists R10s first, and names nameless devices', () => {
  const l = forChooser([MOUSE, ANON, R10]);
  assert.equal(l[0].id, 'r10'); assert.equal(l[0].r10, true);
  assert.match(l.find(d => d.id === ANON.deviceId).name, /Unnamed device/);
});

test('the window comes back where it was, unless that display is gone', () => {
  const laptop = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];
  const both = [...laptop, { workArea: { x: 1920, y: 0, width: 1920, height: 1080 } }];
  const onProjector = { bounds: { x: 2000, y: 50, width: 1600, height: 900 }, fullscreen: true };
  assert.deepEqual(restore(onProjector, both), { bounds: onProjector.bounds, maximized: false, fullscreen: true });
  const back = restore(onProjector, laptop);
  assert.equal(back.bounds.x, undefined); assert.equal(back.fullscreen, false);
  assert.equal(restore(null, laptop).bounds.width, 1280);
});

test('the site is the game without tools, tests, bridge, docs or the app', () => {
  for (const p of ['index.html', 'app.html', 'manifest.webmanifest', 'sw.js', 'src/hub.js', 'src/course/aerie.js', 'styles/shared.css', 'assets/menu-bg.jpg', 'vendor/three-r147/three.min.js']) assert.ok(isSiteFile(p), p);
  for (const p of ['README.md', 'CLAUDE.md', 'package.json', 'tools/r10/check.mjs', 'tests/hub.test.mjs', 'bridge/bridge.js', 'docs/MINIGAMES.md', 'app/main.js', '.github/workflows/app.yml', '../x.html']) assert.ok(!isSiteFile(p), p);
});

test('menus let the PC sleep; play pages keep it awake', () => {
  for (const p of ['index.html', 'courses.html', 'practice.html', 'games.html', 'my-game.html']) assert.equal(isPlayPage(`vibegolf://game/${p}`), false, p);
  for (const p of ['course.html?c=aerie', 'range.html?mode=range', 'shape-it.html', 'golf-bowling.html']) assert.equal(isPlayPage(`vibegolf://game/${p}`), true, p);
});
