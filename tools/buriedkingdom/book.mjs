// node tools/buriedkingdom/book.mjs : the plan book PDF (out/buried-kingdom-plan-book-r<ROUND>.pdf), white landscape
// pages: a cover with the course map, the course at a glance, then one page a hole (three sketch views across
// the top; the plan, how it plays, the profile and room for notes under them). Needs sample.mjs, plans.py and
// sketch.mjs first. Prints with Chrome.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { viewsFor } from './sketch.mjs';
import { COURSE as CRS } from './holes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const D = JSON.parse(fs.readFileSync(`${OUT}/grid/holes.json`)), TEES = D.teeSets, YD = 0.9144;
const ROUND = process.env.ROUND || '1', DATE = process.env.DATE || '13 November 2026', BACK = D.back;
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
.view img { width: 100%; height: 1.3in; object-fit: cover; object-position: center 60%; border: 0.6pt solid #333; display: block; }
.view .cap { font-size: 7.2pt; margin-top: 1.5pt; color: #333; }
.view .cap b { font-weight: 600; }
.body { display: grid; grid-template-columns: 3.3in 1fr; gap: 0.2in; margin-top: 0.06in; height: 4.5in; }
.plan img { width: 3.3in; height: 4.45in; object-fit: contain; object-position: center top; border: 0.6pt solid #888; display: block; }
.side { display: flex; flex-direction: column; min-height: 0; }
.side p { font-size: 6.9pt; line-height: 1.2; margin-bottom: 1.5pt; }
.side p.small { font-size: 7pt; }
.side p.kv { font-size: 7pt; line-height: 1.2; margin: 0 0 1.5pt; }
.kv b { display: inline-block; min-width: 0.5in; font-weight: 600; }
.side img.prof { width: 100%; max-height: 1.5in; object-fit: contain; object-position: left top; border: 0.6pt solid #ddd; margin-top: 3pt; display: block; }
.notes { border: 0.6pt solid #333; padding: 3pt 8pt; margin-top: 5pt; flex: 1; min-height: 0.36in; overflow: hidden; }
.gn { display: flex; gap: 6pt; flex: none; margin-top: 4pt; }
.gn .gimg { width: 1.05in; flex: none; }
.gn .gimg img { width: 1.05in; height: 1.05in; border: 0.6pt solid #ddd; display: block; }
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
table.cc { border-collapse: collapse; width: 100%; margin-top: 8pt; }
table.cc th { text-align: left; vertical-align: top; width: 1.35in; font-size: 8pt; font-weight: 600; padding: 3.5pt 8pt 3.5pt 0; border-top: 0.6pt solid #bbb; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
table.cc td { font-size: 8.2pt; line-height: 1.3; padding: 3.5pt 0; border-top: 0.6pt solid #bbb; }
.hc { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1pt 12pt; margin-top: 4pt; padding: 3pt 0; border-top: 0.8pt solid #444; border-bottom: 0.6pt solid #bbb; }
.hc p { font-size: 6.9pt; line-height: 1.22; margin: 0; }
.hc p.st { grid-column: 1 / -1; font-size: 7.6pt; font-style: italic; }
.hc b { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 6.3pt; color: #444; margin-right: 3pt; font-style: normal; }
.hc p.dec { color: #8a2d1c; }
pre.mono { font-family: 'DejaVu Sans Mono', monospace; font-size: 5.6pt; line-height: 1.32; white-space: pre-wrap; margin: 0; }
.legend span i { display: inline-block; width: 12pt; height: 8pt; border: 0.5pt solid #777; margin-right: 3pt; vertical-align: -1pt; }
`;
const SW = { fairway: '#99c975', rough: '#bdcc85', green: '#94d975', fringe: '#8ac46b', firm: '#edddb3', sand: '#fcf2d4', water: '#8fbdd6', rock: '#c7ad8a', stone: '#dbd1bd', field: '#a8c780' };
const CHECKS = fs.readFileSync(`${OUT}/grid/checks.txt`, 'utf8').split('\n');
const REVIEW = fs.existsSync(`${OUT}/review.txt`) ? fs.readFileSync(`${OUT}/review.txt`, 'utf8') : '';

const pages = [];
const tot = k => D.holes.reduce((a, h) => a + h.yards[k], 0), par = D.holes.reduce((a, h) => a + h.par, 0), tips = D.holes.reduce((a, h) => a + h.tipsYards, 0);
pages.push(`<div class="page">
  <div style="display:flex; justify-content:space-between; align-items:flex-end">
    <div><h1>The Buried Kingdom</h1><p style="font-size:11pt; margin:2pt 0 0">Nine holes through a kingdom the desert has swallowed: the river, the plateau, the cliffs, in blazing late-morning light</p></div>
    <div class="small" style="text-align:right">Plan book · round ${ROUND} · ${DATE}<br>Par ${par} · ${tot(BACK).toLocaleString()} yd from the Falcon tees</div>
  </div>
  <img src="${img('map.png')}" style="width:10.24in; height:6.93in; margin-top:6pt; border:0.6pt solid #888; object-fit:cover">
  <div class="foot"><span>The Buried Kingdom · VibeGolf</span><span>North up. Dashed: the playing lines. Contours every 5 m (none up the cliffs or the pyramids). Blue: the river and the boat basin.</span></div>
</div>`);

const C = CRS.card || {};
const cardRows = [['Hook', C.hook], ['Skeleton', C.skeleton], ['Classics', C.classics], ['Decisions', C.decisions], ['Landmarks', C.landmarks], ['Rhythm', C.rhythm], ['Fairway forms', C.forms], ['Height forms', C.heights], ['Dials', C.dials], ['New and borrowed', C.newBorrowed], ['Tips tee', `The ${CRS.tipsSet ? CRS.tipsSet.name : 'tips'} tees, a fifth set at tour length (${tips.toLocaleString()} yd), in the data on every hole and switched off: nothing shows in the game until it is turned on.`]].filter(r => r[1]);
pages.push(`<div class="page"><h2>The course card</h2>
  <table class="cc">${cardRows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  <div class="notes" style="margin-top:8pt"><div class="t">Notes</div>${lines(3)}</div>
  <div class="foot"><span>The Buried Kingdom · plan book round ${ROUND}</span><span>2</span></div></div>`);
if (NEW) pages.push(`<div class="page"><h2>New in round ${ROUND}</h2><div style="columns:2; column-gap:0.3in; margin-top:6pt">${NEW.map(t => `<p>${t}</p>`).join('')}</div>
  <div class="foot"><span>The Buried Kingdom · plan book round ${ROUND}</span><span>3</span></div></div>`);

const side = g => g.angle > 8 ? `${g.angle}° R` : g.angle < -8 ? `${-g.angle}° L` : 'straight';
const rows = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td class="tips">${h.tipsYards}</td><td>${height(h)}</td><td>+${h.rise} / −${h.fall}</td><td class="l">${shape(h)}</td>
  <td>${h.greenArea}</td><td>${h.greenShape.depth}×${h.greenShape.width} ${side(h.greenShape)}</td><td class="l">${h.targets.map(t => `${esc(t.name)} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}</td></tr>`).join('');
const p3 = D.p3.map(q => `the ${q.n === 1 ? '1st' : q.n + 'th'} ${q.yd} yd plays about ${q.plays}`).join(', ');
const hc = h => h.card || {};
const rows2 = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td class="l">${esc(hc(h).form || '')}</td><td class="l">${esc(hc(h).height || '')}</td><td class="l">${esc(hc(h).dial || '')}</td><td class="l">${/^None/.test(hc(h).decision) ? '–' : esc(hc(h).decision.split(':')[0])}</td><td class="l">${esc(hc(h).hazard || '')}</td><td class="l">${esc(hc(h).surround || '')}</td></tr>`).join('');
pages.push(`<div class="page">
  <h2>The course at a glance</h2>
      <table class="sc" style="margin-top:4pt"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class="tips">Cobra*</th><th>Tee to green</th><th>Climbs / drops</th><th class="l">Shape</th><th>Green m²</th><th>Green (m), angle</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${par}</b></td>${TEES.map(t => `<td><b>${tot(t.id).toLocaleString()}</b></td>`).join('')}<td class="tips"><b>${tips.toLocaleString()}</b></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>
  <p class="small" style="margin-top:3pt">* The Cobra tips tees: a fifth set at tour length, in the data and switched off (the hollow ring on the plans). Green: depth along the approach × width, and which way its long axis turns from the approach. Par 3s: ${p3}.</p>
  <table class="sc" style="margin-top:6pt"><tr><th>#</th><th class="l">Hole</th><th class="l">Fairway form</th><th class="l">Height form</th><th class="l">Dial pushed</th><th class="l">Decision</th><th class="l">Hazard sits</th><th class="l">Round the green</th></tr>${rows2}</table>
  <div class="ov" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.3in; margin-top:4pt">
    <div>
      <h3>Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway', green: 'Green', fringe: 'Short grass', rough: 'Rough (the first band)', firm: 'Firm sand (the lie "Sand": plays as a waste area, 7 iron 160 yd against 173)', sand: 'Soft sand (the lie "Dune": a bunker, 7 iron 139 yd)', water: 'Water (a stroke and a drop): the 1st and 2nd only', rock: 'Rock: the cliffs, the quarry\'s faces', stone: 'Stone: the monuments', field: 'Fields by the river (rough)' }).map(([k, v]) => `<span><i style="background:${SW[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:4pt">Tee at the bottom. Dots: the four tees; the hollow ring is the tips spot. Blue dots: targets (red: the bold one), with yards from the Falcon tee. Numbers along the line: yards to the green. Contours every 2 m, labelled every 10. Profiles: the ground along the line by surface; red a tour drive (167 mph), blue 150 mph, flown with the game's physics over this ground.</p>
    </div>
    <div>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data through a real camera: from the back tee (2.4 m up, close to the game's eye), the landing area (on a par 3, the forward tee) and short of the green. Blockout shapes only: boxes for the towers, the colossi and the Sphinx's head. The art pass comes after the blockout.</p>
      <h3>Decided so far (Rhys, 12–13 November)</h3>
      <p>Egyptian ruins half buried; river, plateau, cliffs; blazing late morning; sand in three bands; firm sand plays as today's waste area (no change to the physics); par 36, 3 5 4 4 3 5 4 4 4; tees Falcon, Jackal, Ibis, Scarab, Cobra tips switched off; the camp in the cliff temple's forecourt; the routing and the nine hole cards; the 7th a hillside bench; the 4th's blowout the hole past real golf.</p>
    </div>
  </div>
  <div class="foot"><span>The Buried Kingdom · plan book round ${ROUND}</span><span>${NEW ? 4 : 3}</span></div>
</div>`);
// the checks, as run
const chk = CHECKS.filter(l => /tee view|bold|blind|Sphinx from|gate's towers|colossi|pyramid from the (1st|4th)|^  1 |4 the way|7 the bench|7 tour|8 the face|8 green to|walks|par 3 |greens with|fairways leaning|^!/.test(l));
pages.push(`<div class="page"><h2>The checks, as run</h2>
  <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap:0.25in; margin-top:4pt">
  <div><h3>sample.mjs (the look-at-first list; a line starting ! breaks a rule)</h3><pre class="mono">${esc(chk.join('\n'))}</pre></div>
  <div><h3>relief.mjs, alike.mjs, spread.mjs</h3><pre class="mono">${esc(REVIEW)}</pre></div></div>
  <div class="foot"><span>The Buried Kingdom · plan book round ${ROUND}</span><span>${NEW ? 5 : 4}</span></div></div>`);

let pg = NEW ? 6 : 5;
const hcard = h => { const c = h.card || {}, w = h.words || {}; if (!h.card) return '';
  return `<div class="hc"><p class="st"><b>Story</b>${esc(w.story || '')}</p><p><b>Type</b>${esc(c.type)}; ${esc(c.form)}</p><p><b>Height form</b>${esc(c.height)}</p><p><b>Dial</b>${esc(c.dial)}</p><p><b>Feature</b>${esc(c.feature)}: ${esc(c.job)}</p><p class="${/^None/.test(c.decision) ? '' : 'dec'}"><b>Decision</b>${esc(c.decision)}</p><p><b>Shots</b>${c.shots.tee ? 'Tee: ' + esc(c.shots.tee) + '. ' : ''}Approach: ${esc(c.shots.approach)}</p><p><b>Miss map</b>${esc(c.miss)}</p><p><b>Tee view</b>${esc(c.view)}</p><p><b>Ground</b>${esc(c.ground)}</p></div>`; };
const mine = n => CHECKS.filter(l => new RegExp(`^[ !] ${n} (landing widths|tee view|bold|the|tips|green contour|fairway lean|Falcon tee|Jackal tee|Ibis tee|Scarab tee|beach)`).test(l) || (l.startsWith('!') && new RegExp(`^! ${n} `).test(l))).map(l => l.replace(new RegExp(`^([ !]) ${n} `), '$1 '));
for (const h of D.holes) {
  const w = h.words, dr = h.drives || {};
  const drv = h.par === 3 ? '' : `<p class="small">Drives from the Falcon tee down the line: tour ${Math.round(dr.tour.carry / YD)} yd carry${dr.tour.hit ? ', hits ' + dr.tour.hit.what : ''}, 150 mph ${Math.round(dr.mid.carry / YD)}.${h.bold ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} ${v.rest === 'water' ? 'in the water' : v.hit ? 'hits ' + v.hit.what : 'finishes on ' + v.rest}`).join(', ')}.` : ''}</p>`;
  const vs = viewsFor(h.n - 1);
  const first = h.targets.filter(t => !t.bold)[0];
  const cap = v => ({ tee: `<b>From the back tee</b>${first ? ', toward ' + esc(first.name) : ''}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards.scarab} yd)` : `<b>From the landing area</b> (${esc(first ? first.name : '')})`, green: `<b>Short of the green</b>, ${Math.round(Math.hypot(v.pos[0] - h.pin[0], v.pos[2] - h.pin[1]) / 5) * 5} m out` })[v.id];
  pages.push(`<div class="page">
    <div class="head"><div><div class="small">Hole ${h.n}</div><h2>${esc(h.name)}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${shape(h)}</span><span>${height(h)} tee to green (climbs ${h.rise} m, drops ${h.fall} m)</span></div></div>${card(h)}</div>
    ${hcard(h)}
    <div class="views">${vs.map(v => `<div class="view"><img src="${img('views/h' + h.n + '_' + v.id + '.png')}"><div class="cap">${cap(v)}</div></div>`).join('')}</div>
    <div class="body">
      <div class="plan"><img src="${img('plan' + h.n + '.png')}"></div>
      <div class="side">
        <p>${esc(w.plays)}</p>
        <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
        ${w.bold ? `<p class="kv"><b>Bold</b> ${esc(w.bold)}</p>` : ''}
        <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
        <p class="kv"><b>Green</b> ${esc(h.green.style)} (${h.greenShape.depth} m deep × ${h.greenShape.width} m wide, ${h.greenArea} m²).</p>
        <pre class="mono" style="border-top:0.6pt solid #bbb; padding-top:2pt; margin-top:2pt">${esc([`Targets: ${h.targets.map(t => `${t.name} ${t.d} yd, ${t.width} m wide, ${t.toPin} yd left`).join(' · ') || 'the green'}`, ...mine(h.n)].join('\n'))}</pre>
        ${drv}
        <div class="gn"><img class="prof" src="${img('prof' + h.n + '.png')}"><div class="gimg"><img src="${img('green' + h.n + '.png')}"><div class="cap">The green: 5 cm contours, arrows downhill (red over 3%), pin areas dashed.</div></div></div>
        <div class="notes"><div class="t">Notes</div>${lines(4)}</div>
      </div>
    </div>
    <div class="foot"><span>The Buried Kingdom · hole ${h.n} · ${esc(h.name)}</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>The Buried Kingdom plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/buried-kingdom-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
