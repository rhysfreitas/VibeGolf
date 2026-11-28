// Where the game's files come from. The installer carries a copy (resources/site); the updater puts newer
// copies in <userData>/sites/<commit>/. At start the app serves the newest complete copy, taking a copy
// downloaded last time ("Update ready") first. Every copy has site-version.json: { sha, date, files }.
'use strict';
const fs = require('fs');
const path = require('path');

const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v)); };
const time = s => Date.parse(s || '') || 0;
const versionOf = dir => { const v = readJSON(path.join(dir, 'site-version.json')); return v && v.sha ? v : null; };

function createStore({ bundled, sitesDir }) {
  const pointer = name => path.join(sitesDir, `${name}.json`);
  const dirOf = sha => path.join(sitesDir, sha);
  return {
    sitesDir, dirOf,
    // The copy to serve this run: { dir, version, source: 'bundled' | 'downloaded' }.
    choose() {
      const next = readJSON(pointer('next'));
      if (next && next.sha && versionOf(dirOf(next.sha))) { writeJSON(pointer('current'), { sha: next.sha }); fs.rmSync(pointer('next'), { force: true }); }
      const cur = readJSON(pointer('current'));
      const down = cur && cur.sha ? versionOf(dirOf(cur.sha)) : null;
      const bund = versionOf(bundled);
      // a newer installer can carry a newer copy than the one downloaded before it
      if (down && (!bund || time(down.date) >= time(bund.date))) return { dir: dirOf(cur.sha), version: down, source: 'downloaded' };
      return { dir: bundled, version: bund || { sha: 'unknown', date: '', files: {} }, source: 'bundled' };
    },
    // A finished download: served from the next start.
    ready(sha) { writeJSON(pointer('next'), { sha }); },
    pending() { const n = readJSON(pointer('next')); return n && n.sha && versionOf(dirOf(n.sha)) ? n.sha : null; },
    // Drop copies nobody points at (and half-finished ones), keeping the one being served.
    prune(serving) {
      let names = []; try { names = fs.readdirSync(sitesDir); } catch (e) { return; }
      const keep = new Set([serving, (readJSON(pointer('current')) || {}).sha, (readJSON(pointer('next')) || {}).sha].filter(Boolean).map(s => path.basename(s)));
      for (const n of names) if (!n.endsWith('.json') && !keep.has(n)) fs.rmSync(path.join(sitesDir, n), { recursive: true, force: true });
    },
  };
}

module.exports = { createStore, versionOf, readJSON, writeJSON, time };
