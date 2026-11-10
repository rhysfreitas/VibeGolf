// node tools/reclaim/book.mjs : the plan book PDF (out/the-reclaim-plan-book-r1.pdf), white landscape pages:
// a cover with the course map, the course at a glance, then two pages a hole (plan, profile and how it plays;
// three sketch views and room for notes). Needs sample.mjs, plans.py and sketch.mjs first. Prints with Chrome.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { viewsFor } from './sketch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const D = JSON.parse(fs.readFileSync(`${OUT}/grid/holes.json`)), TEES = D.teeSets, YD = 0.9144;
const ROUND = process.env.ROUND || '1', DATE = process.env.DATE || '9 November 2026';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = f => `file://${OUT}/${f}`;
const shape = h => {
  const L = h.line; if (L.length < 3) return h.par === 3 ? 'One shot' : 'Straight';
  const turns = []; for (let i = 1; i < L.length - 1; i++) { const a = [L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]], b = [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]];
    // x right, -z downrange: a right turn has a positive cross product
    const cr = a[0] * b[1] - a[1] * b[0]; turns.push(cr > 0 ? 'R' : 'L'); }
  return turns.length === 1 ? `Dogleg ${turns[0] === 'R' ? 'right' : 'left'}` : turns.join('') === 'LR' ? 'S-bend (left, then right)' : turns.join('') === 'RL' ? 'S-bend (right, then left)' : 'Bends ' + turns.join(' ');
};
const lines = n => Array.from({ length: n }, () => '<div class="rule"></div>').join('');
const card = h => `<table class="card"><tr>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}</tr>
  <tr>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}</tr></table>`;

const css = `
@page { size: 11in 8.5in; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'DejaVu Sans', 'Helvetica', sans-serif; color: #222; background: white; }
.page { width: 11in; height: 8.5in; padding: 0.38in 0.45in; position: relative; page-break-after: always; overflow: hidden; background: white; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 34pt; margin: 0; letter-spacing: 0.02em; font-weight: 700; }
h2 { font-size: 20pt; margin: 0 0 2pt; }
h3 { font-size: 10pt; margin: 9pt 0 3pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
p { font-size: 9.2pt; line-height: 1.38; margin: 0 0 5pt; }
.small { font-size: 7.6pt; color: #555; }
.foot { position: absolute; bottom: 0.22in; left: 0.45in; right: 0.45in; font-size: 7pt; color: #777; display: flex; justify-content: space-between; }
.rule { border-bottom: 0.6pt solid #b8b8b8; height: 0.27in; }
.card { border-collapse: collapse; margin: 4pt 0 6pt; }
.card th, .card td { border: 0.6pt solid #999; padding: 2.5pt 9pt; font-size: 8.4pt; text-align: center; }
.card th { font-weight: 600; background: #f6f6f4; }
.dot { display: inline-block; width: 7pt; height: 7pt; border-radius: 50%; border: 0.6pt solid #333; margin-right: 3pt; vertical-align: -0.5pt; }
.facts { display: flex; gap: 14pt; font-size: 8.6pt; margin: 2pt 0 4pt; color: #333; }
.facts b { font-weight: 600; }
.hole { display: grid; grid-template-columns: 5.2in 1fr; gap: 0.25in; height: 7.55in; }
.plan img { width: 5.2in; height: 7.3in; border: 0.6pt solid #888; }
.side img.prof { width: 100%; border: 0.6pt solid #ddd; margin-top: 4pt; }
.kv { font-size: 8.8pt; line-height: 1.35; margin: 0 0 4pt; }
.kv b { display: inline-block; min-width: 0.62in; }
.views { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; gap: 0.16in 0.2in; }
.view img { width: 100%; border: 0.6pt solid #333; display: block; }
.view .cap { font-size: 7.8pt; margin-top: 2.5pt; color: #333; }
.view .cap b { font-weight: 600; }
.notes { border: 0.6pt solid #333; padding: 6pt 9pt; }
.notes .t { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
table.sc { border-collapse: collapse; width: 100%; font-size: 8.4pt; }
table.sc th, table.sc td { border-bottom: 0.6pt solid #ccc; padding: 3.2pt 5pt; text-align: center; }
table.sc th { border-bottom: 1pt solid #555; font-weight: 600; }
table.sc td.l, table.sc th.l { text-align: left; }
.glance p { font-size: 8.4pt; line-height: 1.32; margin-bottom: 3pt; }
.glance h3 { margin-top: 6pt; }
.glance table.sc td, .glance table.sc th { padding: 2.4pt 4pt; font-size: 8pt; }
.legend { display: flex; flex-wrap: wrap; gap: 4pt 12pt; font-size: 7.6pt; margin-top: 4pt; }
.legend span i { display: inline-block; width: 12pt; height: 8pt; border: 0.5pt solid #777; margin-right: 3pt; vertical-align: -1pt; }
`;
const SW = { fairway: '#99c975', green: '#b3e38c', rough: '#b3c994', street: '#dedbd4', rubble: '#c7bdad', sand: '#f2e6b8', water: '#b8d1e3', stands: '#ccc7bd', building: '#9e9c99', void: '#404042' };

const pages = [];
// 1. the cover: the name, the idea, the map
pages.push(`<div class="page">
  <div style="display:flex; justify-content:space-between; align-items:flex-end">
    <div><h1>The Reclaim</h1><p style="font-size:11pt; margin:2pt 0 0">Nine holes through a city that nature has taken back</p></div>
    <div class="small" style="text-align:right">Plan book · round ${ROUND} · ${DATE}<br>Par ${D.holes.reduce((a, h) => a + h.par, 0)} · ${D.holes.reduce((a, h) => a + h.yards.spire, 0).toLocaleString()} yd from the Spire tees</div>
  </div>
  <img src="${img('map.png')}" style="width:10.1in; height:6.93in; margin-top:6pt; border:0.6pt solid #888; object-fit:cover">
  <div class="foot"><span>The Reclaim · VibeGolf</span><span>The holes in the city. Dashed: the playing lines. Darker blocks are taller buildings.</span></div>
</div>`);

// 2. the course at a glance
const rows = D.holes.map(h => {
  const dh = h.pinY - h.teeY, d = h.drives.tour;
  return `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td>${dh > 0 ? '+' : ''}${dh.toFixed(0)} m</td><td class="l">${shape(h)}</td>
    <td class="l">${h.targets.filter(t => !t.pin).map(t => `${esc(t.name)} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}</td></tr>`;
}).join('');
pages.push(`<div class="page glance">
  <div style="display:grid; grid-template-columns: 1fr 3.3in; gap: 0.35in">
    <div>
      <h2>The course at a glance</h2>
      <table class="sc"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th>Height</th><th class="l">Shape</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${D.holes.reduce((a, h) => a + h.par, 0)}</b></td>${TEES.map(t => `<td><b>${D.holes.reduce((a, h) => a + h.yards[t.id], 0).toLocaleString()}</b></td>`).join('')}<td></td><td></td><td></td></tr></table>
      <h3>The idea</h3>
      <p>About twenty years after everyone left. The towers still stand, gutted to their floor slabs, tops snapped off, vines up the walls and trees on the roofs. The streets have cracked and gone to grass, and the cars and buses sit where they stopped. Someone kept a nine mown through the ruins. It's quiet rather than spooky: deer in the avenues, birds round the towers, the creak of concrete somewhere far off.</p>
      <p><b>Opens on:</b> a misty overcast morning, cool, light wind. The mist hides the far city, so each landmark comes out of the grey as you get close.</p>
      <h3>Landmarks seen from other holes</h3>
      <p>The El (1, and behind the 6th green) · the Broken Tower's fallen span (4, from 3 and 5) · the stadium bowl (5, from 4) · the suspension bridge and its slack cables (7, from 8) · the leaning clubhouse and its clock tower (9, from 1 and 8).</p>
      <h3>Height, hole by hole</h3>
      <p>Drops and climbs alternate: a ledge tee (1), a rubble ramp up (2), a cave-in (3), a climb to the hill park (4), the big drop into the stadium (5), a rise (6), a drop off the expressway ramp (7), up to the wharf (8) and the big climb up the Rift (9).</p>
    </div>
    <div>
      <h3 style="margin-top:0">Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway', green: 'Green', rough: 'Rough', street: 'Street (cracked asphalt, native)', rubble: 'Rubble', sand: 'Bunker', water: 'Water', stands: 'Stadium seats', building: 'Building (height in m)', void: 'Open air: the rift' }).map(([k, v]) => `<span><i style="background:${SW[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:6pt">Tee at the bottom. Dots: the four tees (${TEES.map(t => t.name).join(', ')}). Blue dots: course-management targets (red: the bold one), with their yardage from the Spire tee. Numbers along the line: yards to the green. Contours every metre, labelled every 5. A dashed outline is something overhead (the span, a roof). The star marks a blind shot's line marker.</p>
      <h3>Reading the profiles</h3>
      <p class="small">The ground along the playing line, coloured by surface, from the back tee. Grey bars are anything solid over the line (a building's upper floors, the span, the El). Red: a tour drive (167 mph); dotted red: a high drive; blue: a 150 mph drive. All flown with the game's physics over this ground.</p>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data, drawn through a real camera: from the back tee, from the landing area (on a par 3, the forward tee) and from just short of the green. The cameras stand 5 m up (9 m short of the green) so the shape of the ground reads; in the game you stand lower. Labels name the targets and features. These are for judging the layout, not the look: the art pass comes after.</p>
      <div class="notes" style="margin-top:8pt"><div class="t">Notes</div>${lines(6)}</div>
    </div>
  </div>
  <div class="foot"><span>The Reclaim · plan book round ${ROUND}</span><span>2</span></div>
</div>`);

let pg = 3;
for (const h of D.holes) {
  const w = h.words, dh = h.pinY - h.teeY, dr = h.drives || {};
  const driveLine = h.par === 3 ? '' : `<p class="small">Drives from the Spire tee down the line: tour ${Math.round(dr.tour.carry / YD)} yd carry (apex ${dr.tour.apex.toFixed(0)} m)${dr.tour.hit ? ', hits ' + dr.tour.hit.what : ''}; 150 mph ${Math.round(dr.mid.carry / YD)} yd.${h.bold ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} ${v.hit ? 'hits ' + v.hit.what : 'clear'}`).join(', ')}.` : ''}</p>`;
  pages.push(`<div class="page"><div class="hole">
    <div class="plan"><img src="${img('plan' + h.n + '.png')}"></div>
    <div class="side">
      <div class="small">Hole ${h.n}</div>
      <h2>${esc(h.name)}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${shape(h)}</span><span>${dh > 0 ? 'Up' : 'Down'} ${Math.abs(dh).toFixed(0)} m, tee to green</span></div>
      ${card(h)}
      <p>${esc(w.plays)}</p>
      <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
      <p class="kv"><b>Bold</b> ${esc(w.bold)}</p>
      <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
      ${h.targets.length ? `<p class="kv"><b>Targets</b> ${h.targets.map(t => `${esc(t.name)} (${t.d} yd, ${t.pin ? 'the green' : t.width + ' m wide'})`).join(' · ')}</p>` : ''}
      <p class="kv"><b>Green</b> ${esc(h.green.style)}</p>
      ${driveLine}
      <img class="prof" src="${img('prof' + h.n + '.png')}">
    </div></div>
    <div class="foot"><span>The Reclaim · hole ${h.n} · plan and profile</span><span>${pg++}</span></div></div>`);
  const vs = viewsFor(h.n - 1);
  const cap = v => ({ tee: `<b>From the back tee</b>, toward ${esc((h.targets.find(t => !t.pin) || { name: 'the green' }).name)}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards.moss} yd)` : `<b>From the landing area</b> (${esc((h.targets.find(t => !t.pin) || {}).name || '')}), toward the green`, green: '<b>Short of the green</b>, 55 m out' })[v.id];
  pages.push(`<div class="page"><div class="views">
    ${vs.map(v => `<div class="view"><img src="${img('views/h' + h.n + '_' + v.id + '.png')}"><div class="cap">${cap(v)}</div></div>`).join('')}
    <div class="notes"><div class="t">Hole ${h.n} · ${esc(h.name)} · notes</div>${lines(10)}</div>
  </div><div class="foot"><span>The Reclaim · hole ${h.n} · sketch views</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>The Reclaim plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/the-reclaim-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
