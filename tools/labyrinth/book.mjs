// node tools/labyrinth/book.mjs : plan book round 1, out/labyrinth-plan-book-r1.pdf, white A4 landscape pages: the
// cover with the map, the course card, what moved from the layout doc and what is open, the course at a glance, the
// checks, then a page a hole (three views through the game's camera with callouts; the hole card; the plan; how it
// plays; the profile; the green; the hole's checks; room for notes) and a page for the other version of the 3rd and
// the 7th. Needs sample.mjs, grids.mjs, plans.py, sketch.mjs and out/review.txt (relief, alike, spread) first, and
// JPEG copies of the views and plans (see the README).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { COURSE, HOLES, BACK, SETS } from './holes.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const S = JSON.parse(fs.readFileSync(path.join(OUT, 'sample.json'))), M = S.meta;
const NOTES = JSON.parse(fs.readFileSync(path.join(OUT, 'views/r1_notes.json')));
const CHECKS = fs.readFileSync(path.join(OUT, 'checks.txt'), 'utf8').split('\n');
const REVIEW = fs.existsSync(path.join(OUT, 'review.txt')) ? fs.readFileSync(path.join(OUT, 'review.txt'), 'utf8') : '';
const OPEN = JSON.parse(fs.readFileSync(path.join(HERE, 'round1-notes.json')));
const ROUND = 1, DATE = '16 November 2026', YD = 0.9144;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = f => { const j = f.replace(/\.png$/, '.jpg'), p = fs.existsSync(path.join(OUT, j)) ? j : f; return `data:image/${p.endsWith('.jpg') ? 'jpeg' : 'png'};base64,` + fs.readFileSync(path.join(OUT, p)).toString('base64'); };
const TEEC = Object.fromEntries(COURSE.teeSets.map(t => [t.id, t.color]));

function view(name, cap) {
  const n = (NOTES[name] || []).filter(q => q.at[0] > 1 && q.at[0] < 99 && q.at[1] > 1 && q.at[1] < 97);
  let lastY = -99; const place = new Map();
  for (const q of [...n].sort((a, b) => a.at[1] - b.at[1])) { const y = Math.max(q.at[1] + 1, lastY + 9); place.set(q, y); lastY = y; }
  const marks = n.map(q => { const left = q.at[0] < 62;
    return `<div class=dot style="left:${q.at[0]}%;top:${q.at[1]}%"></div><div class="lab ${left ? 'l' : 'r'}" style="${left ? 'left' : 'right'}:${left ? q.at[0] + 1.2 : 100 - q.at[0] + 1.2}%;top:${Math.min(88, place.get(q))}%">${esc(q.t)}</div>`; }).join('');
  return `<figure><div class=shot><img src="${img('views/' + name + '.png')}">${marks}</div><figcaption>${cap}</figcaption></figure>`;
}
const card = m => `<table class=card><tr>${COURSE.teeSets.map(t => `<th><span class=sw style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class=tips>${COURSE.tipsSet.name}*</th></tr><tr>${SETS.map(k => `<td>${m.yards[k]}</td>`).join('')}<td class=tips>${m.tips ? m.tips.yards : '–'}</td></tr></table>`;
const page = (title, body, n, cls = '') => `<section class="${cls}"><header><h2>${title}</h2><span>The Labyrinth · plan book round ${ROUND} · ${DATE} · ${n}</span></header>${body}</section>`;
const P = []; let pn = 1;
const par = HOLES.reduce((a, h) => a + h.par, 0), tot = k => HOLES.reduce((a, h) => a + h.yards[k], 0), tipsTot = HOLES.reduce((a, h) => a + (h.tips ? h.tips.yards : h.yards[BACK]), 0);
const SWATCH = { Fairway: '#8fcc70', Green: '#99e077', 'Rough round the mown ground': '#b8d48f', 'The maze floor (long grass: rough)': '#ccd9a8', 'Rubble at the foot of a wall (native)': '#ccc4b3', Sand: '#f7edcc', 'Water (a stroke and a drop)': '#94bad6', 'Penalty area (the Elbow\'s shut leg)': '#edc7c2' };

// ---- the cover
P.push(`<section class=cover><div class=g2c><img class=map src="${img('map.png')}"><div>
  <h1>The Labyrinth</h1><p class=sub>A maze the size of a town, built by nobody knows who: colossal overgrown walls 10 to 60 m high, the low evening sun, the tower in the central court, doors that change on two holes each round</p>
  <p class=small>Plan book · round ${ROUND} · ${DATE}<br>Par ${par} · ${tot(BACK).toLocaleString()} yd from the Tower tees · 1,200 ft</p>
  <h3>What this round is</h3>
  <p>The approved routing and hole cards (15 November) and round 0's picks (16 November: the 2nd's walls broken, soak 45% on bare stone and 80% in ivy, the Elbow's shut leg a stroke and a drop, the doors rolled each round) drawn for the first time: the whole maze as one world (every wall as a prism with its height, the floor and each hole's landforms, the cistern, the wall tops that are played on), real fairway outlines from the forms, green shapes and contour, the four tee sets and the Keystone tips spot, targets, and both versions of the 3rd and the 7th.</p>
  <p>Every shot is flown with the game's physics against the walls: a ball that hits one drops at its foot about half the time on bare stone and four times in five in ivy, otherwise it comes back. Page 3 lists what moved from the layout doc and what is open for you.</p>
  <h3>Reading the plans</h3>
  <div class=legend>${Object.entries(SWATCH).map(([k, v]) => `<span><i style="background:${v}"></i>${k}</span>`).join('')}</div>
  <p class=small>North up. Walls are their footprints, pale for a low wall and darker the taller (the number on one is its height in metres over the floor); hatched: a lintel over a gate or a door; red: a shut door. Dashed: the playing lines (dotted on the map: the other version of the 3rd and 7th).</p>
</div></div><div class=foot>${pn++}</div></section>`);

// ---- the course card
const C = COURSE.card;
const rows = [['Hook', C.hook], ['Skeleton', C.skeleton], ['Classics and set pieces', C.classics], ['Decisions', C.decisions], ['Landmarks', C.landmarks], ['Rhythm', C.rhythm], ['Fairway forms', C.forms], ['Height forms', C.heights], ['Dials', C.dials], ['New and borrowed', C.newBorrowed], ['The doors', C.doors],
  ['Tips tee', `The ${COURSE.tipsSet.name} tees, a fifth set at tour length (${tipsTot.toLocaleString()} yd; the 3rd has no room behind its back tee, so its Tower yards count), in the data on eight holes and switched off.`]];
P.push(page('The course card', `<table class=cc>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>`, pn++));

// ---- what moved, what's open
P.push(page('What moved from the layout doc, and what is open', `<div class=g2><div><h3>Moved, to pass the checks (the routing and the cards are the approved ones)</h3>${OPEN.moved.map(t => `<p>${esc(t)}</p>`).join('')}</div>
  <div><h3>Open for you (the picker asks these too)</h3>${OPEN.open.map((t, i) => `<p><b>${i + 1}.</b> ${esc(t)}</p>`).join('')}<div class=notes><div class=t>Notes</div>${'<div class=rule></div>'.repeat(7)}</div></div></div>`, pn++));

// ---- at a glance
const hm = n => M.find(m => m.tag === String(n) || m.tag === n + 'A');
const g1 = HOLES.map(h => { const m = hm(h.n), dh = m.pinY - m.teeY;
  return `<tr><td>${h.n}</td><td class=l><b>${esc(h.name)}</b></td><td>${h.par}</td>${SETS.map(k => `<td>${h.yards[k]}${h.versions ? ' / ' + h.versions[0].yards[k] : ''}</td>`).join('')}<td class=tips>${h.tips ? h.tips.yards : '–'}</td><td>${dh >= 0 ? '+' : '−'}${Math.abs(dh).toFixed(0)} m</td><td class=l>${esc(h.shape)}</td><td>${m.green.area}${h.versions ? ' / ' + M.find(q => q.tag === h.n + 'B').green.area : ''}</td><td class=l>${m.targets.map(t => `${esc(t.name)}${t.bold ? ' (bold)' : ''} ${Math.max(0, ...t.lanes)} m`).join(', ') || '–'}</td></tr>`; }).join('');
const g2 = HOLES.map(h => { const c = h.card; return `<tr><td>${h.n}</td><td class=l><b>${esc(h.name)}</b></td><td class=l>${esc(c.form)}</td><td class=l>${esc(c.height)}</td><td class=l>${esc(c.dial)}</td><td class=l>${/^None/.test(c.decision) ? '–' : esc(c.decision.split(':')[0])}</td><td class=l>${esc(c.hazard)}</td><td class=l>${esc(c.surround)}</td></tr>`; }).join('');
P.push(page('The course at a glance', `<table class=t><tr><th>#</th><th class=l>Hole</th><th>Par</th>${COURSE.teeSets.map(t => `<th><span class=sw style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class=tips>Keystone*</th><th>Tee to green</th><th class=l>Shape</th><th>Green m²</th><th class=l>Landing areas (fairway across)</th></tr>${g1}
  <tr><td></td><td class=l><b>Total</b></td><td><b>${par}</b></td>${SETS.map(k => `<td><b>${tot(k).toLocaleString()}</b></td>`).join('')}<td class=tips><b>${tipsTot.toLocaleString()}</b></td><td colspan=4></td></tr></table>
  <p class=small>Two numbers on the 3rd and 7th: version A (the left way) / version B (the right). * The Keystone tips: a fifth set at tour length, in the data and switched off.</p>
  <table class=t><tr><th>#</th><th class=l>Hole</th><th class=l>Fairway form</th><th class=l>Height form</th><th class=l>Dial pushed</th><th class=l>Decision</th><th class=l>Hazard sits</th><th class=l>Round the green</th></tr>${g2}</table>
  <p class=small>Plans: the tee at the bottom of the hole's page plan is wherever it falls, north is always up. Coloured dots: the four tees (hollow ring: the tips spot); blue: targets (red: the bold one) with yards from the Tower tee; numbers along the line: yards to the green; contours every metre, labelled every 5; thin coloured lines: each tee set's drive, ▼ where it stops; small dots: 24 drives with an amateur's miss (start σ 3°, curve σ 6.5°) from the Rampart tee, crosses along the bold line, or 12 tee shots on a par 3. Profiles: the ground along the line by surface, grey bars where the line passes through or under a wall, the drives' flights.</p>`, pn++, 'glance'));

// ---- the checks
const chk = CHECKS.filter(l => l.startsWith('!') || /^\d|second shots|total|bold line|amateur/.test(l) || /^  (tower|rampart|gate|court):/.test(l));
P.push(page('The checks, as run', `<div class=g2><div><h3>sample.mjs (a line starting ! breaks a Must or a Should)</h3><pre class=mono>${esc(chk.join('\n'))}</pre></div><div><h3>relief.mjs, alike.mjs, spread.mjs</h3><pre class=mono>${esc(REVIEW)}</pre></div></div>`, pn++));

// ---- the holes
const hcard = (h, c, w) => `<div class=hc><p class=st><b>Story</b>${esc(w.story)}</p><p><b>Type</b>${esc(c.type)}; ${esc(c.form)}</p><p><b>Height form</b>${esc(c.height)}</p><p><b>Dial</b>${esc(c.dial)}</p>
  <p><b>Feature</b>${esc(c.feature)}: ${esc(c.job)}</p><p class="${/^None/.test(c.decision) ? '' : 'dec'}"><b>Decision</b>${esc(c.decision)}</p><p><b>Shots</b>${esc(c.shots.tee)}${c.shots.approach ? '; then ' + esc(c.shots.approach) : ''}</p>
  <p><b>Miss map</b>${esc(c.miss)}</p><p><b>Tee view</b>${esc(c.view)}</p><p><b>Ground</b>${esc(c.ground)}</p></div>`;
const mine = tag => { const i = CHECKS.findIndex(l => l.startsWith(tag + ' ')), out = []; if (i < 0) return out; for (let j = i + 1; j < CHECKS.length && CHECKS[j].trim(); j++) out.push(CHECKS[j]); return out; };
for (const m of M) {
  const h = HOLES[m.n - 1], v = m.ver ? (m.ver === 'A' ? h : h.versions[0]) : h, c = h.card, w = h.words, two = !!m.ver;
  const caps = h.par === 3
    ? [[`r1_${m.tag}_tee`, `<b>From the Tower tee</b>, ${m.yards.tower} yd`], [`r1_${m.tag}_rampart`, `<b>From the Rampart tee</b>, ${m.yards.rampart} yd`], [`r1_${m.tag}_court`, `<b>From the Court tee</b>, ${m.yards.court} yd`]]
    : [[`r1_${m.tag}_tee`, `<b>From the Tower tee</b>, toward ${esc((m.targets.find(t => !t.bold && !t.second) || {}).name || 'the line')}`], [`r1_${m.tag}_land`, `<b>From where the Tower drive stops</b>, toward the pin`], fs.existsSync(path.join(OUT, `views/r1_${m.tag}_bold.png`)) ? [`r1_${m.tag}_bold`, `<b>From the Tower tee along the bold line</b>`] : [`r1_${m.tag}_green`, `<b>90 yd out</b>, toward the pin`]];
  const extra = m.n === 2 && m.bank ? `<pre class=mono>The bank shot (12 each, a little start-line scatter): ${m.bank.filter(r => r.long >= 20).map(r => `${r.club} ${r.long} yd long ${r.on}/12 on`).join(' · ')}</pre>` : '';
  const verLine = two ? `<p class=ver>This page: version ${m.ver}, ${m.ver === 'A' ? 'the left way' : 'the right way'}. ${m.n === 3 ? 'The other leg is shut: its door a slab, its court and leg a penalty area.' : 'The other doorway is shut: its door a slab across it.'} The round rolls which version is played, like the pins.</p>` : '';
  const body = `<div class=hd><div><div class=small>Hole ${m.n}${two ? ` · version ${m.ver}` : ''}</div><h2 class=hn>${esc(m.name)}</h2><div class=facts><b>Par ${m.par}</b> · ${esc(v.shape || h.shape)} · ${(m.pinY - m.teeY >= 0 ? '+' : '−') + Math.abs(m.pinY - m.teeY).toFixed(0)} m tee to green</div></div>${card(m)}</div>
    ${two && m.ver === 'B' ? verLine : hcard(h, c, w) + verLine}
    <div class=v3>${caps.map(([n, cp]) => view(n, cp)).join('')}</div>
    <div class=bd><div class=pl><img src="${img('plan' + m.tag + '.png')}"></div><div class=sd>
      ${two && m.ver === 'B' ? `<p>The same hole turned the other way: the corridor's first leg and the tee shot are the same; ${m.n === 3 ? 'the corner turns right, the bold line carries the west court\'s low walls, and the left leg is the penalty area' : 'the green sits in the right-hand doorway'}. ${esc(w.miss)}</p>` : `<p>${esc(w.plays)}</p><p class=kv><b>Safe</b> ${esc(w.safe)}</p>${w.bold ? `<p class=kv><b>Bold</b> ${esc(w.bold)}</p>` : ''}<p class=kv><b>A miss</b> ${esc(w.miss)}</p>`}
      <pre class=mono>${esc(mine(m.tag).join('\n'))}</pre>${extra}
      <div class=gn><img class=prof src="${img('prof' + m.tag + '.png')}"><div class=gi><img src="${img('green' + m.tag + '.png')}"><div class=cap>The green: 5 cm contours, arrows downhill (red over 3%), pin areas dashed; the approach from the bottom.</div></div></div>
      <div class="notes nh"><div class=t>Notes</div></div></div></div>`;
  P.push(page(`Hole ${m.n}${two ? ` (${m.ver === 'A' ? 'left' : 'right'})` : ''}`, body, pn++, 'hole'));
}

const css = `@page { size: A4 landscape; margin: 0 } body { margin: 0; font: 10px/1.36 'DejaVu Sans', Arial, sans-serif; color: #222; background: #fff }
section { width: 297mm; height: 210mm; box-sizing: border-box; padding: 7mm 10mm; page-break-after: always; overflow: hidden; position: relative }
header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #bbb; margin-bottom: 3mm } header h2 { font-size: 14px; margin: 0 } header span { color: #888; font-size: 8.5px }
.cover { padding: 9mm 11mm } .cover h1 { font-size: 30px; margin: 2mm 0 1mm } .cover .sub { font-size: 13px; color: #555; margin: 0 0 4mm } .g2c { display: grid; grid-template-columns: 158mm 1fr; gap: 7mm; height: 100% } .map { width: 158mm; height: 186mm; object-fit: contain; border: 1px solid #999 }
.foot { position: absolute; bottom: 5mm; right: 11mm; color: #888; font-size: 8.5px }
h3 { font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: #555; margin: 3mm 0 1.5mm } p { margin: 0 0 1.8mm }
.small { font-size: 9px; color: #555 } .legend { display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: 9px } .legend i { display: inline-block; width: 12px; height: 8px; border: 1px solid #888; margin-right: 3px; vertical-align: -1px }
table { border-collapse: collapse } .cc { width: 100% } .cc th { text-align: left; vertical-align: top; width: 38mm; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #444; padding: 2.4px 6px 2.4px 0; border-top: 1px solid #ccc } .cc td { font-size: 9.6px; padding: 2.4px 0; border-top: 1px solid #ccc }
.t { width: 100%; font-size: 8.6px; margin-bottom: 2mm } .t td, .t th { border-bottom: 1px solid #ccc; padding: 2px 4px; text-align: center; vertical-align: top } .t th { border-bottom: 1.4px solid #555 } .t .l { text-align: left }
.tips { color: #777; font-style: italic } .sw { display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 1px solid #333; margin-right: 3px; vertical-align: -1px }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 7mm } pre.mono { font: 6.7px/1.25 'DejaVu Sans Mono', monospace; white-space: pre-wrap; margin: 0 0 1.5mm; background: #f6f4ef; padding: 3px 5px }
.notes { border: 1px solid #333; padding: 2px 6px; margin-top: 2mm } .notes .t { font-size: 8px; text-transform: uppercase; color: #555; letter-spacing: .05em; border: 0; width: auto } .rule { border-bottom: 1px solid #bbb; height: 6mm } .nh { height: 9mm; margin-top: 1mm }
.hole { padding: 6mm 9mm } .hd { display: flex; justify-content: space-between; align-items: flex-end } .hn { font-size: 17px; margin: 0 } .facts { font-size: 9.5px; color: #333 }
.card th, .card td { border: 1px solid #999; padding: 1px 6px; font-size: 8.6px; text-align: center } .card th { background: #f6f6f4 }
.hc { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 9px; border-top: 1.2px solid #444; border-bottom: 1px solid #bbb; padding: 1.5px 0; margin-top: 1.5mm } .hc p { font-size: 7.6px; line-height: 1.22; margin: 0 0 1px } .hc .st { grid-column: 1 / -1; font-style: italic; font-size: 8.4px }
.hc b { font-size: 6.8px; text-transform: uppercase; letter-spacing: .04em; color: #444; margin-right: 3px; font-style: normal } .hc .dec { color: #8a2d1c } .ver { font-size: 8.6px; color: #8a2d1c; margin: 1.5mm 0 0 }
.v3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2.5mm; margin-top: 1.5mm } figure { margin: 0 } figcaption { font-size: 8px; margin-top: .5mm }
.shot { position: relative; overflow: hidden; height: 31mm } .shot img { width: 100%; height: 31mm; object-fit: cover; object-position: center 55%; display: block; border: 1px solid #777 }
.dot { position: absolute; width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: #e23b2e; border: 1.2px solid #fff }
.lab { position: absolute; background: rgba(255,255,255,.88); border: 1px solid #e23b2e; padding: 0 3px; font-size: 7px; max-width: 45%; line-height: 1.2 }
.bd { display: grid; grid-template-columns: 86mm 1fr; gap: 4mm; margin-top: 1.5mm } .pl img { width: 86mm; height: 100mm; object-fit: contain; object-position: center top; border: 1px solid #999; display: block }
.sd p { font-size: 8px; line-height: 1.25; margin-bottom: 1.2mm } .kv b { font-weight: 600; margin-right: 3px }
.gn { display: flex; gap: 2mm; align-items: flex-start } .gn .prof { flex: 1; min-width: 0; width: 100%; border: 1px solid #ddd } .gi { width: 30mm; flex: none } .gi img { width: 30mm; height: 30mm; border: 1px solid #ddd; display: block } .gi .cap { font-size: 6.4px; color: #555; line-height: 1.15 }`;
const html = `<!doctype html><html><head><meta charset=utf-8><title>The Labyrinth plan book round ${ROUND}</title><style>${css}</style></head><body>${P.join('')}</body></html>`;
fs.writeFileSync(path.join(OUT, 'book-r1.html'), html);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const pg = await b.newPage(); await pg.setContent(html, { waitUntil: 'load' });
await pg.pdf({ path: path.join(OUT, `labyrinth-plan-book-r${ROUND}.pdf`), format: 'A4', landscape: true, printBackground: true });
const over = await pg.evaluate(() => [...document.querySelectorAll('section')].map((s, i) => s.scrollHeight > s.clientHeight + 2 ? i + 1 : 0).filter(Boolean));
console.log('pages', P.length, 'overflow', over);
await b.close();
