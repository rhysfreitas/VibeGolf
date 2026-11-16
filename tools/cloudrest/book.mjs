// node tools/cloudrest/book.mjs : the plan book PDF (out/cloudrest-plan-book-r<ROUND>.pdf), white landscape pages: a
// cover with the course map, the course card, what changed and what is open, the course at a glance, the checks, then
// one page a hole (three sketch views across the top; the plan, how it plays, the profile, the cross sections of the
// shelf holes, the green and room for notes under them). Needs sample.mjs, plans.py and sketch.mjs first, and
// out/review.txt (relief, alike, spread). Prints with Chrome. (After tools/eldergrove/book.mjs.) The views, plans and
// map go in as JPEG copies (a 20 MB book becomes a few): python3 -c "from PIL import Image; import glob; [Image.open(f).convert('RGB').save(f[:-4] + '.jpg', quality=84) for f in glob.glob('out/views/*.png') + glob.glob('out/plan*.png') + ['out/map.png']]"
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { viewsFor } from './sketch.mjs';
import { COURSE as CRS, HOLES as HH } from './holes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const D = JSON.parse(fs.readFileSync(`${OUT}/grid/holes.json`)), TEES = D.teeSets, YD = 0.9144;
for (const h of D.holes) { const q = HH[h.n - 1]; h.words = q.words; h.card = q.card; h.green = { ...h.green, style: q.green.style }; }   // the words as holes.mjs has them now
const ROUND = process.env.ROUND || '1', DATE = process.env.DATE || '15 November 2026', BACK = D.back;
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
.glance table.sc { font-size: 6.9pt; } .glance table.sc th, .glance table.sc td { padding: 1.2pt 3pt; } .glance .ov p { font-size: 7.2pt; }
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
const SW = { fairway: '#8fcc70', green: '#94de75', rough: '#c2d699', scrub: '#a8bd8c', rock: '#bdb8ad', kerb: '#8c877f', sand: '#f7edcc', water: '#8cb3cc', tea: '#9ec27a', paving: '#dbd1bd', void: '#e6ebf2' };
const CHECKS = fs.readFileSync(`${OUT}/grid/checks.txt`, 'utf8').split('\n');
const REVIEW = fs.existsSync(`${OUT}/review.txt`) ? fs.readFileSync(`${OUT}/review.txt`, 'utf8') : '';

const pages = [];
const tot = k => D.holes.reduce((a, h) => a + h.yards[k], 0), par = D.holes.reduce((a, h) => a + h.par, 0), tips = D.holes.reduce((a, h) => a + h.tipsYards, 0);
pages.push(`<div class="page">
  <div style="display:grid; grid-template-columns: 4.7in 1fr; gap:0.3in; height:100%">
    <img src="${img('map.jpg')}" style="width:4.7in; height:7.75in; border:0.6pt solid #888; object-fit:contain; background:white">
    <div style="display:flex; flex-direction:column">
      <h1>Cloudrest</h1>
      <p style="font-size:11pt; margin:4pt 0 10pt">Golf on the sides of a misty gorge: two facing cliffs hung with pines, stone pinnacles standing out of the cloud between, a lived-in monastery set into the far wall</p>
      <p class="small">Plan book · round ${ROUND} · ${DATE}<br>Par ${par} · ${tot(BACK).toLocaleString()} yd from the Summit tees · 8,500 ft</p>
      <h3>What this round is</h3>
      <p>The approved routing and hole cards (15 November) drawn for the first time: the gorge as one terrain (both cliffs, the cleft, the hanging valley, the pinnacles, the Needle, the Broken Ridge, the alcove and its roof, the tea terraces, the three tiers down to the monastery's courtyard), real fairway outlines from the forms, green shapes, heights, the four tee sets and the Pinnacle tips spot on every hole, targets. Every drive is flown with the game's physics as Cloudrest will play from round 0: the thin air (8,500 ft), damp turf on the fairways, cliff faces that drop 45% of the balls that hit them at their foot, and open air down to the mist (a stroke and a drop).</p>
      <p>Every tee set's target is in the game's frame and in sight from its tee (the fixed camera, 3.2 m behind the ball), except where a page says so. Page 3 lists what moved from the layout doc to get there, and what is open for you.</p>
      <h3>Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway', green: 'Green', rough: 'Rough (mountain grass)', scrub: 'Scrub (juniper: rough)', rock: 'Rock (native, kicks)', kerb: 'Kerb (rock and pines along an edge)', sand: 'Sand', water: 'Water (a stroke and a drop)', tea: 'Tea rows (rough)', paving: 'Paving (the courtyard)', void: 'Open air: the mist below (hatched)' }).map(([k, v]) => `<span><i style="background:${SW[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:6pt">North up. Dashed: the playing lines. Dark green discs: pines (scenery for now). Boxes: the built things (gold and red roofs: the monastery). Contours every 10 m.</p>
    </div>
  </div>
  <div class="foot"><span>Cloudrest · VibeGolf</span><span>1</span></div>
</div>`);

const C = CRS.card || {};
const cardRows = [['Hook', C.hook], ['Skeleton', C.skeleton], ['Classics', C.classics], ['Decisions', C.decisions], ['Landmarks', C.landmarks], ['Rhythm', C.rhythm], ['Fairway forms', C.forms], ['Height forms', C.heights], ['Dials', C.dials], ['New and borrowed', C.newBorrowed], ['Tips tee', `The ${CRS.tipsSet ? CRS.tipsSet.name : 'tips'} tees, a fifth set at tour length (${tips.toLocaleString()} yd), in the data on every hole and switched off: nothing shows in the game until it is turned on.`]].filter(r => r[1]);
pages.push(`<div class="page"><h2>The course card</h2>
  <table class="cc">${cardRows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  <div class="notes" style="margin-top:8pt"><div class="t">Notes</div>${lines(3)}</div>
  <div class="foot"><span>Cloudrest · plan book round ${ROUND}</span><span>2</span></div></div>`);
const OPEN = JSON.parse(fs.readFileSync(path.join(HERE, 'round1-notes.json')));
pages.push(`<div class="page"><h2>What moved from the layout doc, and what is open</h2>
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.3in; margin-top:6pt">
    <div><h3>Moved, to pass the checks (the lines and pins are the approved ones)</h3>${OPEN.moved.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <div><h3>Open for you</h3>${OPEN.open.map((t, i) => `<p><b>${i + 1}.</b> ${esc(t)}</p>`).join('')}<div class="notes" style="margin-top:8pt; min-height:1.6in"><div class="t">Notes</div>${lines(6)}</div></div>
  </div>
  <div class="foot"><span>Cloudrest · plan book round ${ROUND}</span><span>3</span></div></div>`);

const side = g => g.angle > 8 ? `${g.angle}° R` : g.angle < -8 ? `${-g.angle}° L` : 'straight';
const rows = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td class="tips">${h.tipsYards}</td><td>${height(h)}</td><td>+${h.rise} / −${h.fall}</td><td class="l">${shape(h)}</td>
  <td>${h.greenArea}</td><td>${h.greenShape.depth}×${h.greenShape.width} ${side(h.greenShape)}</td><td class="l">${h.targets.map(t => `${esc(t.name)} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}</td></tr>`).join('');
const p3 = D.p3.map(q => `the ${q.n === 1 ? '1st' : q.n + 'th'} ${q.yd} yd plays about ${q.plays}`).join(', ');
const hc = h => h.card || {};
const rows2 = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td class="l">${esc(hc(h).form || '')}</td><td class="l">${esc(hc(h).height || '')}</td><td class="l">${esc(hc(h).dial || '')}</td><td class="l">${/^None/.test(hc(h).decision) ? '–' : esc(hc(h).decision.split(':')[0])}</td><td class="l">${esc(hc(h).hazard || '')}</td><td class="l">${esc(hc(h).surround || '')}</td></tr>`).join('');
pages.push(`<div class="page glance">
  <h2>The course at a glance</h2>
      <table class="sc" style="margin-top:4pt"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class="tips">Pinnacle*</th><th>Tee to green</th><th>Climbs / drops</th><th class="l">Shape</th><th>Green m²</th><th>Green (m), angle</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${par}</b></td>${TEES.map(t => `<td><b>${tot(t.id).toLocaleString()}</b></td>`).join('')}<td class="tips"><b>${tips.toLocaleString()}</b></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>
  <p class="small" style="margin-top:3pt">* The Pinnacle tips tees: a fifth set at tour length, in the data and switched off (the hollow ring on the plans). Green: depth along the approach × width, and which way its long axis turns from the approach. Par 3s: ${p3}.</p>
  <table class="sc" style="margin-top:6pt"><tr><th>#</th><th class="l">Hole</th><th class="l">Fairway form</th><th class="l">Height form</th><th class="l">Dial pushed</th><th class="l">Decision</th><th class="l">Hazard sits</th><th class="l">Round the green</th></tr>${rows2}</table>
  <div class="ov" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.3in; margin-top:4pt">
    <div>
      <h3>Reading the plans</h3>
      <p class="small">Tee at the bottom. Dots: the four tees; the hollow ring is the tips spot. Blue dots: targets (red: the bold one), with yards from the Summit tee. Numbers along the line: yards to the green. Contours every metre, labelled every 5. Hatched: open air, the mist far below. A, B, C: where the cross sections cut. Profiles: the ground along the line by surface, open air as a gap down to the mist band, the alcove's roof and the built things as brown bars; red a tour drive (167 mph), blue 150 mph, flown with the game's physics at 8,500 ft (▼ where each stops).</p>
    </div>
    <div>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data through a real camera: from the back tee (3.2 m behind the ball, 1.8 m up: the game's eye), the landing area (on a par 3, the forward tee) and short of the green. Open air as the top of the mist far below, cliff faces down to it, pines as dark cones, the monastery as boxes under red and gold roofs, the alcove's roof as a slab of rock. The art pass comes after the blockout.</p>

    </div>
  </div>
  <div class="foot"><span>Cloudrest · plan book round ${ROUND}</span><span>4</span></div>
</div>`);
// the checks, as run
const chk = CHECKS.filter(l => /thin air|wall|kerb|alcove|roof|skied|6 the|6 drives|5 the|5 short|5 from|9 the|9 from|9 twelve|8 the|Balcony|Needle|pinnacles|open air|penalty|blind|walks|par 3 |greens with|golden roof in|^!/.test(l));
pages.push(`<div class="page"><h2>The checks, as run</h2>
  <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap:0.25in; margin-top:4pt">
  <div><h3>sample.mjs (the look-at-first list; a line starting ! breaks a rule)</h3><pre class="mono">${esc(chk.join('\n'))}</pre></div>
  <div><h3>relief.mjs, alike.mjs, spread.mjs</h3><pre class="mono">${esc(REVIEW)}</pre></div></div>
  <div class="foot"><span>Cloudrest · plan book round ${ROUND}</span><span>5</span></div></div>`);

let pg = 6;
const hcard = h => { const c = h.card || {}, w = h.words || {}; if (!h.card) return '';
  return `<div class="hc"><p class="st"><b>Story</b>${esc(w.story || '')}</p><p><b>Type</b>${esc(c.type)}; ${esc(c.form)}</p><p><b>Height form</b>${esc(c.height)}</p><p><b>Dial</b>${esc(c.dial)}</p><p><b>Feature</b>${esc(c.feature)}: ${esc(c.job)}</p><p class="${/^None/.test(c.decision) ? '' : 'dec'}"><b>Decision</b>${esc(c.decision)}</p><p><b>Shots</b>${c.shots.tee ? 'Tee: ' + esc(c.shots.tee) + '. ' : ''}Approach: ${esc(c.shots.approach)}</p><p><b>Miss map</b>${esc(c.miss)}</p><p><b>Tee view</b>${esc(c.view)}</p><p><b>Ground</b>${esc(c.ground)}</p></div>`; };
const mine = n => CHECKS.filter(l => !/monastery's roofs/.test(l)).filter(l => new RegExp(`^[ !] ${n} (landing widths|tee view|bold|tips|green contour|fairway lean|from)`).test(l) || (l.startsWith('!') && new RegExp(`^! ${n} `).test(l))).map(l => l.replace(new RegExp(`^([ !]) ${n} `), '$1 '));
for (const h of D.holes) {
  const w = h.words, dr = h.drives || {};
  const drv = h.par === 3 ? '' : `<p class="small">Drives from the Summit tee straight down the first leg (8,500 ft, damp turf): tour ${Math.round(dr.tour.carry / YD)} yd carry, ${Math.round(dr.tour.total / YD)} total, finishing ${dr.tour.rest === 'mist' ? 'in the mist' : 'on ' + dr.tour.rest}${dr.tour.rocks ? ' (off a wall)' : ''}; 150 mph ${Math.round(dr.mid.carry / YD)} carry, ${Math.round(dr.mid.total / YD)} total, ${dr.mid.rest === 'mist' ? 'in the mist' : 'on ' + dr.mid.rest}.${h.bold ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} ${v.rest === 'mist' ? 'in the mist' : 'finishes on ' + v.rest}`).join(', ')}.` : ''}</p>`;
  const vs = viewsFor(h.n - 1);
  const first = h.targets.filter(t => !t.bold)[0];
  const cap = v => ({ tee: `<b>From the back tee</b>${first ? ', toward ' + esc(first.name) : ''}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards.terrace} yd)` : `<b>From the landing area</b> (${esc(first ? first.name : '')})`, green: `<b>Short of the green</b>, ${Math.round(Math.hypot(v.pos[0] - h.pin[0], v.pos[2] - h.pin[1]) / 5) * 5} m out` })[v.id];
  pages.push(`<div class="page">
    <div class="head"><div><div class="small">Hole ${h.n}</div><h2>${esc(h.name)}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${shape(h)}</span><span>${height(h)} tee to green (climbs ${h.rise} m, drops ${h.fall} m)</span></div></div>${card(h)}</div>
    ${hcard(h)}
    <div class="views" style="grid-template-columns: repeat(${vs.length}, 1fr)">${vs.map(v => `<div class="view"><img src="${img('views/h' + h.n + '_' + v.id + '.jpg')}"><div class="cap">${cap(v)}</div></div>`).join('')}</div>
    <div class="body">
      <div class="plan">${h.sections && h.sections.length ? `<img style="height:${4.45 - 0.36 * h.sections.length - 0.1}in" src="${img('plan' + h.n + '.jpg')}"><img style="height:${0.36 * h.sections.length + 0.06}in; margin-top:0.04in; border:0.6pt solid #ddd" src="${img('xsec' + h.n + '.png')}">` : `<img src="${img('plan' + h.n + '.jpg')}">`}</div>
      <div class="side">
        <p>${esc(w.plays)}</p>
        <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
        ${w.bold ? `<p class="kv"><b>Bold</b> ${esc(w.bold)}</p>` : ''}
        <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
        <p class="kv"><b>Green</b> ${esc(h.green.style)} (${h.greenShape.depth} m deep × ${h.greenShape.width} m wide, ${h.greenArea} m²).</p>
        <pre class="mono" style="border-top:0.6pt solid #bbb; padding-top:2pt; margin-top:2pt">${esc([`Targets: ${h.targets.map(t => `${t.name} ${t.d} yd, ${t.width} m wide, ${t.toPin} yd left`).join(' · ') || 'the green'}`, ...mine(h.n)].join('\n'))}</pre>
        ${drv}
        <div class="gn"><img class="prof" src="${img('prof' + h.n + '.png')}"><div class="gimg"><img src="${img('green' + h.n + '.png')}"><div class="cap">The green: 5 cm contours, arrows downhill (red over 3%), pin areas dashed.</div></div></div>
        <div class="notes"><div class="t">Notes</div>${lines(h.sections && h.sections.length ? 3 : 4)}</div>
      </div>
    </div>
    <div class="foot"><span>Cloudrest · hole ${h.n} · ${esc(h.name)}</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cloudrest plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/cloudrest-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
