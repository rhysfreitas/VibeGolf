// Copies the game into app/site for the installer (and `npm start`), with site-version.json: the commit,
// its date and every file's git blob id, so the updater later downloads only what changed.
// node scripts/copy-site.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { isSiteFile } = require('../lib/site-files.js');
const { blobSha } = require('../lib/blob.js');

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(APP, '..'), OUT = path.join(APP, 'site');
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();

const sha = git('rev-parse', 'HEAD'), date = new Date(git('log', '-1', '--format=%cI')).toISOString();
const paths = git('ls-files', '-z').split('\0').filter(isSiteFile);
fs.rmSync(OUT, { recursive: true, force: true });
const files = {};
let bytes = 0;
for (const p of paths) {
  const from = path.join(REPO, ...p.split('/'));
  if (!fs.existsSync(from)) continue;
  const buf = fs.readFileSync(from), to = path.join(OUT, ...p.split('/'));
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, buf);
  files[p] = blobSha(buf); bytes += buf.length;
}
fs.writeFileSync(path.join(OUT, 'site-version.json'), JSON.stringify({ sha, date, files }));
console.log(`site: ${Object.keys(files).length} files, ${(bytes / 1e6).toFixed(1)} MB, ${sha.slice(0, 7)} (${date})`);
