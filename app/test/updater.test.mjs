// The updater against a fake GitHub: only changed files are downloaded, every download is checked, a bad one
// leaves nothing behind, and the store serves the new copy from the next start.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { update } = require('../lib/updater.js');
const { createStore } = require('../lib/site-store.js');
const { blobSha } = require('../lib/blob.js');

function writeSite(dir, files, sha, date) {
  const ids = {};
  for (const [p, body] of Object.entries(files)) { const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); ids[p] = blobSha(Buffer.from(body)); }
  fs.writeFileSync(path.join(dir, 'site-version.json'), JSON.stringify({ sha, date, files: ids }));
}
function fakeGitHub(sha, date, files, { corrupt } = {}) {
  const hits = [];
  const fetch = async url => {
    hits.push(url);
    const ok = (body, j) => ({ ok: true, status: 200, json: async () => j, arrayBuffer: async () => { const b = Buffer.from(body); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
    if (url.endsWith('/commits/main')) return ok('', { sha, commit: { committer: { date } } });
    if (url.includes(`/git/trees/${sha}`)) return ok('', { truncated: false, tree: [...Object.entries(files).map(([p, b]) => ({ path: p, type: 'blob', sha: blobSha(Buffer.from(b)) })), { path: 'tools/x.mjs', type: 'blob', sha: 'x' }, { path: 'src', type: 'tree', sha: 'y' }] });
    const m = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([0-9a-f]+)\/(.+)$/);
    if (m && m[1] === sha) { const p = m[2].split('/').map(decodeURIComponent).join('/'); return p in files ? ok(p === corrupt ? 'tampered' : files[p]) : { ok: false, status: 404 }; }
    return { ok: false, status: 404 };
  };
  return { fetch, hits };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vg-'));
const OLD = { 'index.html': 'home v1', 'app.html': 'hub', 'src/hub.js': 'hub js', 'src/course/aerie.js': 'big course', 'styles/a b.css': 'css' };
const NEW = { ...OLD, 'index.html': 'home v2', 'src/new.js': 'new file' };
delete NEW['styles/a b.css'];

test('downloads only what changed, and serves it from the next start', async () => {
  const root = tmp(), bundled = path.join(root, 'site');
  writeSite(bundled, OLD, 'aaa', '2026-11-27T10:00:00.000Z');
  const store = createStore({ bundled, sitesDir: path.join(root, 'sites') });
  const serving = store.choose();
  assert.equal(serving.source, 'bundled');
  const gh = fakeGitHub('bbb', '2026-11-28T02:00:00Z', NEW);
  const r = await update({ fetch: gh.fetch, repo: 'o/r', serving, store });
  assert.equal(r.status, 'ready'); assert.equal(r.fetched, 2);
  assert.deepEqual(gh.hits.filter(u => u.includes('raw.')).map(u => u.split('/bbb/')[1]).sort(), ['index.html', 'src/new.js']);
  assert.equal(store.pending(), 'bbb');
  const next = store.choose();
  assert.equal(next.source, 'downloaded'); assert.equal(next.version.sha, 'bbb');
  assert.equal(fs.readFileSync(path.join(next.dir, 'index.html'), 'utf8'), 'home v2');
  assert.equal(fs.readFileSync(path.join(next.dir, 'src/course/aerie.js'), 'utf8'), 'big course');
  assert.ok(!fs.existsSync(path.join(next.dir, 'styles/a b.css')), 'a file gone from the repo is gone from the copy');
  assert.ok(!fs.existsSync(path.join(next.dir, 'tools')), 'only site files');
  const again = await update({ fetch: gh.fetch, repo: 'o/r', serving: next, store });
  assert.equal(again.status, 'current');
});

test('a download that doesn\'t match the repo stops the update and leaves the served copy alone', async () => {
  const root = tmp(), bundled = path.join(root, 'site');
  writeSite(bundled, OLD, 'aaa', '2026-11-27T10:00:00.000Z');
  const store = createStore({ bundled, sitesDir: path.join(root, 'sites') });
  const gh = fakeGitHub('ccc', '2026-11-28T02:00:00Z', NEW, { corrupt: 'src/new.js' });
  await assert.rejects(update({ fetch: gh.fetch, repo: 'o/r', serving: store.choose(), store }), /doesn't match/);
  assert.equal(store.pending(), null);
  assert.ok(!fs.existsSync(path.join(root, 'sites', 'ccc')));
  store.prune(null);
  assert.ok(!fs.existsSync(path.join(root, 'sites', 'ccc.partial')), 'the half-finished copy is cleared');
  assert.equal(store.choose().source, 'bundled');
});

test('a newer installer copy wins over an older download', async () => {
  const root = tmp(), bundled = path.join(root, 'site');
  writeSite(bundled, NEW, 'new', '2026-12-01T00:00:00.000Z');
  writeSite(path.join(root, 'sites', 'old'), OLD, 'old', '2026-11-20T00:00:00Z');
  fs.writeFileSync(path.join(root, 'sites', 'current.json'), JSON.stringify({ sha: 'old' }));
  const store = createStore({ bundled, sitesDir: path.join(root, 'sites') });
  assert.equal(store.choose().version.sha, 'new');
  const gh = fakeGitHub('old', '2026-11-20T00:00:00Z', OLD);
  assert.equal((await update({ fetch: gh.fetch, repo: 'o/r', serving: store.choose(), store })).status, 'current');
});
