// node tools/lostvalley/book.mjs : the plan book PDF (out/lostvalley-plan-book-r<ROUND>.pdf), white landscape
// pages: a cover with the course map, the course at a glance, then one page a hole (three sketch views across
// the top; the plan, how it plays, the profile and room for notes under them). Needs sample.mjs, plans.py and
// sketch.mjs first. Prints with Chrome.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { viewsFor } from './sketch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const D = JSON.parse(fs.readFileSync(`${OUT}/grid/holes.json`)), TEES = D.teeSets, YD = 0.9144;
const ROUND = process.env.ROUND || '1', DATE = process.env.DATE || '10 November 2026', BACK = D.back;
const NEW = process.env.NEW ? JSON.parse(fs.readFileSync(process.env.NEW)) : null;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = f => `file://${OUT}/${f}`;
const shape = h => {
  if (h.shape) return h.shape;   // round 3 on: each hole names its own shape in holes.mjs
  const L = h.line; if (L.length < 3) return h.par === 3 ? 'One shot' : 'Straight';
  const turns = []; for (let i = 1; i < L.length - 1; i++) { const a = [L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]], b = [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]];
    // x right, -z downrange: a right turn has a positive cross product
    const cr = a[0] * b[1] - a[1] * b[0]; turns.push(cr > 0 ? 'R' : 'L'); }
  return turns.length === 1 ? `Dogleg ${turns[0] === 'R' ? 'right' : 'left'}` : turns.join('') === 'LR' ? 'S-bend (left, then right)' : turns.join('') === 'RL' ? 'S-bend (right, then left)' : 'Bends ' + turns.join(' ');
};
const lines = n => Array.from({ length: n }, () => '<div class="rule"></div>').join('');
const card = h => `<table class="card"><tr>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}</tr>
  <tr>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}</tr></table>`;
const height = h => { const dh = h.pinY - h.teeY; return `${dh >= 0 ? '+' : '−'}${Math.abs(dh).toFixed(0)} m`; };

const css = `
@page { size: 11in 8.5in; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'DejaVu Sans', 'Helvetica', sans-serif; color: #222; background: white; }
.page { width: 11in; height: 8.5in; padding: 0.32in 0.38in; position: relative; page-break-after: always; overflow: hidden; background: white; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 34pt; margin: 0; letter-spacing: 0.02em; font-weight: 700; }
h2 { font-size: 17pt; margin: 0; }
h3 { font-size: 9.5pt; margin: 8pt 0 3pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
p { font-size: 8.6pt; line-height: 1.34; margin: 0 0 4pt; }
.small { font-size: 7.4pt; color: #555; }
.ov p { font-size: 7.9pt; line-height: 1.28; margin-bottom: 3pt; }
.ov h3 { margin-top: 5pt; }
.foot { position: absolute; bottom: 0.16in; left: 0.38in; right: 0.38in; font-size: 7pt; color: #777; display: flex; justify-content: space-between; }
.rule { border-bottom: 0.6pt solid #b8b8b8; height: 0.25in; }
.card { border-collapse: collapse; }
.card th, .card td { border: 0.6pt solid #999; padding: 1.5pt 7pt; font-size: 7.8pt; text-align: center; }
.card th { font-weight: 600; background: #f6f6f4; }
.dot { display: inline-block; width: 7pt; height: 7pt; border-radius: 50%; border: 0.6pt solid #333; margin-right: 3pt; vertical-align: -0.5pt; }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12pt; height: 0.5in; }
.head .facts { font-size: 8.6pt; color: #333; display: flex; gap: 12pt; margin-top: 2pt; }
.head .facts b { font-weight: 600; }
.views { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.1in; margin-top: 0.08in; }
.view img { width: 100%; border: 0.6pt solid #333; display: block; }
.view .cap { font-size: 7.2pt; margin-top: 1.5pt; color: #333; }
.view .cap b { font-weight: 600; }
.body { display: grid; grid-template-columns: 3.5in 1fr; gap: 0.2in; margin-top: 0.08in; height: 5.0in; }
.plan img { width: 3.5in; height: 4.91in; border: 0.6pt solid #888; display: block; }
.side { display: flex; flex-direction: column; min-height: 0; }
.side p { font-size: 7.7pt; line-height: 1.26; margin-bottom: 2.5pt; }
.side p.small { font-size: 7pt; }
.side p.kv { font-size: 7.5pt; line-height: 1.24; margin: 0 0 2pt; }
.kv b { display: inline-block; min-width: 0.5in; font-weight: 600; }
.side img.prof { width: 100%; max-height: 1.3in; object-fit: contain; object-position: left top; border: 0.6pt solid #ddd; margin-top: 3pt; display: block; }
.notes { border: 0.6pt solid #333; padding: 3pt 8pt; margin-top: 5pt; flex: 1; min-height: 0.45in; overflow: hidden; }
.gn { display: flex; gap: 6pt; flex: none; margin-top: 4pt; }
.gn .gimg { width: 1.3in; flex: none; }
.gn .gimg img { width: 1.3in; height: 1.3in; border: 0.6pt solid #ddd; display: block; }
.gn .gimg .cap { font-size: 6.3pt; color: #555; line-height: 1.2; margin-top: 1.5pt; }
.gn img.prof { flex: 1; min-width: 0; width: auto; margin-top: 0; }
.notes .t { font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
table.sc { border-collapse: collapse; width: 100%; font-size: 7.6pt; }
table.sc th, table.sc td { border-bottom: 0.6pt solid #ccc; padding: 1.8pt 4pt; text-align: center; }
table.sc th { border-bottom: 1pt solid #555; font-weight: 600; }
table.sc td.l, table.sc th.l { text-align: left; }
table.sc td.l b { white-space: nowrap; }
.legend { display: flex; flex-wrap: wrap; gap: 4pt 12pt; font-size: 7.4pt; margin-top: 4pt; }
.tips { color: #777; font-style: italic; }
.legend span i { display: inline-block; width: 12pt; height: 8pt; border: 0.5pt solid #777; margin-right: 3pt; vertical-align: -1pt; }
`;
const SW = { fairway: '#9ecc80', rough: '#c2d699', green: '#99db7a', fringe: '#8cc773', meadow: '#d6e0b3', jungle: '#618f61', sand: '#f2e8c7', waste: '#dccfae', bar: '#e6dbbd', water: '#9ec7e6', tar: '#242121', cliff: '#a8947f', mud: '#9e9475', rubble: '#b3a899' };

const pages = [];
const tot = k => D.holes.reduce((a, h) => a + h.yards[k], 0), par = D.holes.reduce((a, h) => a + h.par, 0), tips = D.holes.reduce((a, h) => a + h.tipsYards, 0);
pages.push(`<div class="page">
  <div style="display:flex; justify-content:space-between; align-items:flex-end">
    <div><h1>The Lost Valley</h1><p style="font-size:11pt; margin:2pt 0 0">Nine holes in a hidden valley where time stopped, walled in by the cliffs of a table mountain, on a golden afternoon after rain</p></div>
    <div class="small" style="text-align:right">Plan book · round ${ROUND} · ${DATE}<br>Par ${par} · ${tot(BACK).toLocaleString()} yd from the Titan tees</div>
  </div>
  <img src="${img('map.png')}" style="width:10.24in; height:6.93in; margin-top:6pt; border:0.6pt solid #888; object-fit:cover">
  <div class="foot"><span>The Lost Valley · VibeGolf</span><span>The holes in the valley, north up. Dashed: the playing lines. Contours every 5 m on the floor. Blue: water. Brown dots: the herds; red: the hunter.</span></div>
</div>`);

if (NEW) pages.push(`<div class="page"><h2>New in round ${ROUND}</h2><div style="columns:2; column-gap:0.3in; margin-top:6pt">${NEW.map(t => `<p>${t}</p>`).join('')}</div>
  <div class="foot"><span>The Lost Valley · plan book round ${ROUND}</span><span>2</span></div></div>`);

const side = g => g.angle > 8 ? `${g.angle}° R` : g.angle < -8 ? `${-g.angle}° L` : 'straight';
const rows = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td class="tips">${h.tipsYards}</td><td>${height(h)}</td><td>+${h.rise} / −${h.fall}</td><td class="l">${shape(h)}</td>
  <td>${h.greenShape.depth}×${h.greenShape.width} ${side(h.greenShape)}</td><td class="l">${h.targets.map(t => `${esc(t.name)} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}</td></tr>`).join('');
const p3 = D.p3.map(q => `the ${q.n === 3 ? '3rd' : q.n + 'th'} ${q.yd} yd plays about ${q.plays}`).join(', ');
pages.push(`<div class="page">
  <h2>The course at a glance</h2>
      <table class="sc" style="margin-top:4pt"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class="tips">Tips*</th><th>Tee to green</th><th>Climbs / drops</th><th class="l">Shape</th><th>Green (m), angle</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${par}</b></td>${TEES.map(t => `<td><b>${tot(t.id).toLocaleString()}</b></td>`).join('')}<td class="tips"><b>${tips.toLocaleString()}</b></td><td></td><td></td><td></td><td></td><td></td></tr></table>
  <p class="small" style="margin-top:3pt">* Tips: a fifth set of tees at tour length, not built yet. Each hole keeps a spot for it (the hollow ring on the plans), 35–40 yd behind the back tee on the par 4s and 5s and 15 yd on the par 3s. Green: depth along the approach × width, and which way its long axis turns from the approach.</p>
  <div class="ov" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.3in">
    <div>
      <h3>The idea</h3>
      <p>A hidden valley where time stopped about 70 million years ago: the classic lost world, after the table mountains (tepuis) of Venezuela and Guyana. Sheer sandstone walls 380–470 m high close it in on every side, jungle on their talus and ledges, falls pouring off them into the mist; other table mountains stand beyond the rim. The floor is a plain of ferns and horsetails with stands of monkey-puzzles, cycads and tree ferns, a braided river, a swamp and a tar pit. Long-necks graze the plain and wade the river, small plant-eaters drink at its edge, pterosaurs wheel along the walls and nest on them, and one hunter watches from the herd's far edge: scenery only, slow, well off the play.</p>
      <p><b>The round.</b> It starts and ends at the expedition camp on a ledge 30 m up the south wall: canvas tents, a hut on stilts, a cook fire. The 1st drops off the ledge's bluff to the floor; on the round's very first shot a crested pterosaur launches off the spire beside the tee and glides out below you. Holes 2–8 loop round the floor: the cycad grove, the tar pit, the river, the plunge pool under the Great Falls, the Strangler fig, the Bone Bluff, the swamp. The 9th climbs a broad ramp back to the ledge, beside Camp Falls and under the pterosaurs' nests.</p>
      <p><b>Opens on:</b> golden afternoon after rain: low warm sun from the west-south-west, steam off the jungle, mist in the falls, wet leaves glinting; calm.</p>
      <h3>Height, hole by hole</h3>
      <p>Off the bluff, 27 m down (1), 9 m down to the grove's hollow (2), up 6 past the tar pit (3), down 9 to the shallows and up 14 onto the gravel terrace (4), 9 m down off the sill to the pool (5), up 11 onto the Strangler's knoll (6), over a blind crest and 20 m down to the river's bend (7), gently down through the swamp (8), and up 30 on the ramp to the ledge (9). The walks climb to the sill before the 5th and cross the rope bridge to the 6th.</p>
    </div>
    <div>
      <h3>Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway', green: 'Green', fringe: 'Short grass', rough: 'Rough', meadow: 'Fern meadow (native)', jungle: 'Jungle (the walls\' talus)', sand: 'Bunker (river sand)', waste: 'Waste (sand and gravel, a shallow bunker)', bar: 'Sandbar in the river (plays as a bunker)', water: 'Water: river, creek, pools, swamp (a stroke and a drop)', tar: 'The tar pit (plays as water)', mud: 'Swamp hummocks (mud)', cliff: 'Rock: walls, bluffs, banks', rubble: 'Steep banks, rubble' }).map(([k, v]) => `<span><i style="background:${SW[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:6pt">Tee at the bottom. Dots: the four tees; the hollow ring behind them is the tips spot. Blue dots: course-management targets (red: the bold one), with their yardage from the Titan tee. Numbers along the line: yards to the green. Contours every 2 m, labelled every 10 (none up the walls). Stars: cycads and tree ferns; circles: monkey-puzzles, broadleaves and swamp cypresses (a white ring: standing in water). The Strangler: its trunk, its canopy (shaded) and the root arch (the dotted bar).</p>
      <h3>Reading the profiles</h3>
      <p class="small">The ground along the playing line, coloured by surface, from the back tee. Grey bars: anything solid over the line (the root arch on the 6th). Red: a tour drive (167 mph); dotted red: a high drive; blue: a 150 mph drive. All flown with the game's physics at the valley's 1,320 ft over this ground.</p>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data, drawn through a real camera: from the back tee, from the landing area (on a par 3, the forward tee) and from just short of the green, 5 m up (9 m short of the green). The walls are drawn from the same ground out to 2.7 km, the table mountains beyond as silhouettes. The animals are true-shape silhouettes. Drawn light so the book prints; in the game it is a warm, misty afternoon.</p>
      <h3>Decided so far</h3>
      <p>The Lost Valley. Tees Titan, Rex, Raptor, Compy. Gentle giants and one distant hunter, scenery only, with true shapes and simple detail. The Overlook's pterosaur, once a round, on the very first shot. Golden afternoon after rain. The expedition camp as the only human touch. The rope bridge is the walk from the 5th to the 6th. Room for a tips tee on every hole. Par 3s: ${p3}.</p>
    </div>
  </div>
  <div class="foot"><span>The Lost Valley · plan book round ${ROUND}</span><span>${NEW ? 3 : 2}</span></div>
</div>`);

let pg = NEW ? 4 : 3;
for (const h of D.holes) {
  const w = h.words, dr = h.drives || {};
  const drv = h.par === 3 ? '' : `<p class="small">Drives from the Titan tee down the line: tour ${Math.round(dr.tour.carry / YD)} yd carry${dr.tour.hit ? ', hits ' + dr.tour.hit.what : ''}, 150 mph ${Math.round(dr.mid.carry / YD)}.${h.bold ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} ${v.rest === 'water' ? 'in the water' : v.hit ? 'hits ' + v.hit.what : 'finishes on ' + v.rest}`).join(', ')}.` : ''}</p>`;
  const vs = viewsFor(h.n - 1);
  const first = h.targets.filter(t => !t.bold)[0];
  const cap = v => ({ tee: `<b>From the back tee</b>${first ? ', toward ' + esc(first.name) : ''}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards.compy} yd)` : `<b>From the landing area</b> (${esc(first ? first.name : '')})`, green: `<b>Short of the green</b>, ${Math.round(Math.hypot(v.pos[0] - h.pin[0], v.pos[2] - h.pin[1]) / 5) * 5} m out` })[v.id];
  pages.push(`<div class="page">
    <div class="head"><div><div class="small">Hole ${h.n}</div><h2>${esc(h.name)}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${shape(h)}</span><span>${height(h)} tee to green (climbs ${h.rise} m, drops ${h.fall} m)</span></div></div>${card(h)}</div>
    <div class="views">${vs.map(v => `<div class="view"><img src="${img('views/h' + h.n + '_' + v.id + '.png')}"><div class="cap">${cap(v)}</div></div>`).join('')}</div>
    <div class="body">
      <div class="plan"><img src="${img('plan' + h.n + '.png')}"></div>
      <div class="side">
        <p>${esc(w.plays)}</p>
        <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
        ${w.bold ? `<p class="kv"><b>Bold</b> ${esc(w.bold)}</p>` : ''}
        <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
        ${h.targets.length ? `<p class="kv"><b>Targets</b> ${h.targets.map(t => `${esc(t.name)} (${t.d} yd, ${t.width} m wide)`).join(' · ')}</p>` : ''}
        <p class="kv"><b>Green</b> ${esc(h.green.style)} (${h.greenShape.depth} m deep × ${h.greenShape.width} m wide, ${h.greenArea} m²).</p>
        ${h.contour ? `<p class="kv"><b>Contour</b> Typically ${h.contour.median}% underfoot, ${h.contour.feat === 'a feature' ? `${h.contour.relief} m of shape beyond its fall` : 'flatter: just its fall'}; ${h.contour.areas} pin areas, ${h.contour.cup}% cuppable.${h.lean && h.lean.length ? ' Fairway lean: ' + h.lean.map(l => `${esc(l.name)} ${Math.abs(l.lean)}% ${l.lean > 0.3 ? 'right' : l.lean < -0.3 ? 'left' : 'level'}`).join(', ') + '.' : ''}</p>` : ''}
        <p class="kv"><b>Tips</b> Room for a future tips tee: ${h.tipsYards} yd${h.par > 3 ? ', landing areas checked for 280–300 yd drives' : ''}.</p>
        ${drv}
        <div class="gn"><img class="prof" src="${img('prof' + h.n + '.png')}"><div class="gimg"><img src="${img('green' + h.n + '.png')}"><div class="cap">The green: 5 cm contours, arrows downhill (red over 3%), pin areas dashed.</div></div></div>
        <div class="notes"><div class="t">Notes</div>${lines(6)}</div>
      </div>
    </div>
    <div class="foot"><span>The Lost Valley · hole ${h.n} · ${esc(h.name)}</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>The Lost Valley plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/lostvalley-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
