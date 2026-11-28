// Which of the game's pages are menus. Every other page is a play page, and the PC stays awake while one is
// open (the game asks for a screen wake lock on those same pages: the course, the range, the mini games).
'use strict';
const MENUS = new Set(['index.html', 'practice.html', 'courses.html', 'games.html', 'online.html', 'my-game.html', 'app.html', '']);
const pageOf = url => { try { return new URL(url).pathname.split('/').pop(); } catch (e) { return ''; } };
const isPlayPage = url => !MENUS.has(pageOf(url).toLowerCase());
module.exports = { isPlayPage, pageOf };
