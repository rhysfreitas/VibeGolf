// Which files in the repo make up the game the app serves: the static site exactly as GitHub Pages serves
// it, without the tools, tests, bridge, docs or the app itself. Shared by the build (scripts/copy-site.mjs)
// and the updater, so a downloaded copy has the same files as the one in the installer.
'use strict';
const DIRS = ['src/', 'styles/', 'assets/', 'vendor/'];
const ROOT = /^[a-z0-9-]+\.(html|webmanifest|js)$/i;   // index.html, course.html, manifest.webmanifest, sw.js

function isSiteFile(p) {
  if (!p || p.includes('..') || p.startsWith('/')) return false;
  if (DIRS.some(d => p.startsWith(d))) return true;
  return !p.includes('/') && ROOT.test(p);
}

module.exports = { isSiteFile, DIRS };
