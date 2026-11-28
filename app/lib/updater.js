// Brings the game up to the latest commit on GitHub, downloading only the files that changed.
//   1. the latest commit on main (one API call; 60 an hour are allowed without a login)
//   2. its file tree (one more call): every site file with its git blob id
//   3. a new copy in <sites>/<sha>.partial: unchanged files copied from the copy being served, changed ones
//      downloaded from raw.githubusercontent.com and checked against their blob id
//   4. renamed to <sites>/<sha> and marked ready; the app serves it from the next start
// `fetch` is passed in, so the tests run it against a fake repo.
'use strict';
const fs = require('fs');
const path = require('path');
const { isSiteFile } = require('./site-files');
const { blobSha } = require('./blob');
const { time } = require('./site-store');

async function json(fetch, url) {
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'VibeGolf-app' } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

async function update({ fetch, repo, branch = 'main', serving, store, onProgress = () => {}, log = () => {} }) {
  const api = `https://api.github.com/repos/${repo}`;
  const head = await json(fetch, `${api}/commits/${branch}`);
  const sha = head.sha, date = head.commit && head.commit.committer && head.commit.committer.date || '';
  if (!sha) throw new Error('no commit');
  if (sha === serving.version.sha) return { status: 'current', sha };
  if (store.pending() === sha) return { status: 'ready', sha };
  if (time(serving.version.date) && time(date) && time(date) < time(serving.version.date)) return { status: 'current', sha: serving.version.sha };   // a newer installer copy

  const tree = await json(fetch, `${api}/git/trees/${sha}?recursive=1`);
  if (tree.truncated) throw new Error('tree truncated');
  const files = {};
  for (const e of tree.tree || []) if (e.type === 'blob' && isSiteFile(e.path)) files[e.path] = e.sha;
  if (!files['index.html'] || !files['app.html'] || !files['src/hub.js']) throw new Error('tree has no game');

  const dest = store.dirOf(sha), part = `${dest}.partial`;
  fs.rmSync(part, { recursive: true, force: true });
  const have = serving.version.files || {};
  const paths = Object.keys(files);
  let done = 0, fetched = 0, bytes = 0;
  await pool(paths, 8, async p => {
    const to = path.join(part, ...p.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const from = path.join(serving.dir, ...p.split('/'));
    if (have[p] === files[p] && fs.existsSync(from)) fs.copyFileSync(from, to);
    else {
      const url = `https://raw.githubusercontent.com/${repo}/${sha}/${p.split('/').map(encodeURIComponent).join('/')}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'VibeGolf-app' } });
      if (!r.ok) throw new Error(`${p} → ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (blobSha(buf) !== files[p]) throw new Error(`${p}: download doesn't match the repo`);
      fs.writeFileSync(to, buf); fetched++; bytes += buf.length;
    }
    onProgress(++done, paths.length);
  });
  fs.writeFileSync(path.join(part, 'site-version.json'), JSON.stringify({ sha, date, files }));
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(part, dest);
  store.ready(sha);
  log({ what: 'update-ready', sha, files: paths.length, fetched, bytes });
  return { status: 'ready', sha, fetched, bytes };
}

module.exports = { update };
