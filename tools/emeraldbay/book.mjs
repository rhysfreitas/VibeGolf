// node tools/emeraldbay/book.mjs : the plan book PDF (out/emerald-bay-plan-book-r<ROUND>.pdf), white landscape pages:
// a cover with the course map, the bay at both tides, the course card, what moved and what is open, the course at a
// glance, the checks, then one page a hole, two for each tide hole (low tide, high tide): three sketch views across
// the top; the plan, how it plays, the profile, the cross sections, the green and room for notes under them. Needs
// sample.mjs, plans.py and sketch.mjs first, and out/review.txt (relief, alike, spread). Prints with Chrome. The views,
// plans and maps go in as JPEG copies, made here. (After tools/cloudrest/book.mjs.)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { viewsFor } from './sketch.mjs';
import { COURSE as CRS, HOLES as HH } from './holes.mjs';
execFileSync('python3', ['-c', "from PIL import Image; import glob; [Image.open(f).convert('RGB').save(f[:-4] + '.jpg', quality=84) for f in glob.glob('out/views/*.png') + glob.glob('out/plan*.png') + glob.glob('out/map-*.png')]"], { cwd: path.dirname(fileURLToPath(import.meta.url)) });

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const D = JSON.parse(fs.readFileSync(`${OUT}/grid/holes.json`)), TEES = D.teeSets, YD = 0.9144;
for (const h of D.pages) { const q = HH[h.n - 1]; h.words = q.words; h.card = q.card; h.green = { ...h.green, style: q.green.style }; }   // the words as holes.mjs has them now
D.holes = D.pages.filter(h => !h.tideHole || h.tide === 'low');   // one row a hole (a tide hole's low-tide page)
const ROUND = process.env.ROUND || '6', DATE = process.env.DATE || '25 November 2026', BACK = D.back;
const tideName = h => h.tideHole ? (h.tide === 'low' ? 'low tide' : 'high tide') : '';
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
.view img { width: 100%; height: 1.08in; object-fit: cover; object-position: center 60%; border: 0.6pt solid #333; display: block; }
.view .cap { font-size: 7.2pt; margin-top: 1.5pt; color: #333; }
.view .cap b { font-weight: 600; }
.body { display: grid; grid-template-columns: 3.3in 1fr; gap: 0.2in; margin-top: 0.04in; height: 4.62in; }
.plan img { width: 3.3in; height: 4.45in; object-fit: contain; object-position: center top; border: 0.6pt solid #888; display: block; }
/* a hole page: the body takes what the header leaves, so a long card never pushes the plan into the footer */
.hp { display: flex; flex-direction: column; } .hp .body { flex: 1; min-height: 0; height: auto; margin-bottom: 0.22in; }
.hp .plan { display: flex; flex-direction: column; min-height: 0; } .hp .plan img { flex: 1 1 0; min-height: 0; height: auto !important; } .hp .plan img.xs { flex: none; height: var(--xs) !important; }
.glance table.sc { font-size: 6.9pt; } .glance table.sc th, .glance table.sc td { padding: 1.2pt 3pt; } .glance .ov p { font-size: 7.2pt; }
.side { display: flex; flex-direction: column; min-height: 0; }
.side p { font-size: 6.5pt; line-height: 1.17; margin-bottom: 1.2pt; }
.side p.small { font-size: 7pt; }
.side p.kv { font-size: 6.5pt; line-height: 1.17; margin: 0 0 1.2pt; }
.kv b { display: inline-block; min-width: 0.5in; font-weight: 600; }
.side img.prof { width: 100%; max-height: 1.3in; object-fit: contain; object-position: left top; border: 0.6pt solid #ddd; margin-top: 3pt; display: block; }
.notes { border: 0.6pt solid #333; padding: 3pt 8pt; margin-top: 4pt; flex: 1; min-height: 0.2in; overflow: hidden; }
.side { overflow: hidden; }
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
.hc p { font-size: 6.6pt; line-height: 1.18; margin: 0; }
.hc p.st { grid-column: 1 / -1; font-size: 7.6pt; font-style: italic; }
.hc b { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 6.3pt; color: #444; margin-right: 3pt; font-style: normal; }
.hc p.dec { color: #8a2d1c; }
pre.mono { font-family: 'DejaVu Sans Mono', monospace; font-size: 5.1pt; line-height: 1.32; white-space: pre-wrap; margin: 0; }
.legend span i { display: inline-block; width: 12pt; height: 8pt; border: 0.5pt solid #777; margin-right: 3pt; vertical-align: -1pt; }
`;
const SW = { fairway: '#8fcc70', green: '#94de75', rough: '#c2d699', scrub: '#a8bd8c', rock: '#bdb8ad', kerb: '#8c877f', sand: '#f7edcc', water: '#8cb3cc', tea: '#9ec27a', paving: '#dbd1bd', void: '#e6ebf2' };
const CHECKS = fs.readFileSync(`${OUT}/grid/checks.txt`, 'utf8').split('\n');
const REVIEW = fs.existsSync(`${OUT}/review.txt`) ? fs.readFileSync(`${OUT}/review.txt`, 'utf8') : '';

const pages = [];
const tot = k => D.holes.reduce((a, h) => a + h.yards[k], 0), par = D.holes.reduce((a, h) => a + h.par, 0), tips = D.holes.reduce((a, h) => a + h.tipsYards, 0);
const SWE = { fairway: '#8fcc70', green: '#94de75', rough: '#c2d699', jungle: '#8cad78', rock: '#c2bdb3', sand: '#f2dc9e', drysand: '#fcf5db', wetsand: '#e6dbbd', water: '#9edbdb' };
const HI = HH.reduce((a, h) => a + (h.versions ? h.versions[1].yards : h.yards)[BACK], 0);
pages.push(`<div class="page">
  <div style="display:grid; grid-template-columns: 5.6in 1fr; gap:0.3in; height:100%">
    <img src="${img('map-low.jpg')}" style="width:5.6in; height:7.75in; border:0.6pt solid #888; object-fit:contain; background:white">
    <div style="display:flex; flex-direction:column">
      <h1>Emerald Bay</h1>
      <p style="font-size:11pt; margin:4pt 0 10pt">A warm bay of whole limestone islands with open water between them: sheer cliffs, jungle on top, white sand and clear turquoise water below</p>
      <p class="small">Plan book · round ${ROUND} · ${DATE}<br>Par ${par} · ${tot(BACK).toLocaleString()} yd from the Marlin tees at low tide, ${HI.toLocaleString()} at high</p>
      <h3>What this round is</h3>
      <p>The 9th's land reshaped from your markup on round 5: the cave beach one natural piece of land along your red line with the fairway you drew round the cave's mouth; the island fairway a triangle, its point toward the tee, so the longer the carry the wider it is; a ring of sand round the island and a channel of water between it and the right fairway; the right fairway's ends rounded into beaches. Every edge of the 9th's land now shelves away under the sea as a sandbar instead of dropping off. The rest is round 5.</p>
      <p>Every drive is flown with the game's physics as round 0 settled it: dry sand plays as waste, wet sand as firm beach, bunkers as sand, water a stroke and a drop, cliff faces drop 45% of the balls that hit them at their foot, and the cave's roof and the overhang are solid. Page 4 lists what moved since round 5, and what is open for you.</p>
      <h3>Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway', green: 'Green', rough: 'Rough', jungle: 'Jungle (plays as rough)', rock: 'Rock and cliffs (native; a cliff gives the ball back)', sand: 'Bunker', drysand: 'Dry sand (plays as waste)', wetsand: 'Wet sand, dry at low tide (firm: it runs)', water: 'Water (a stroke and a drop)' }).map(([k, v]) => `<span><i style="background:${SWE[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:6pt">North up. Dashed: the playing lines. The map is at low tide; the next page has both. Boxes: the stilt village, the beach shack, longtails. Contours at 10, 20, 40, 80 m and up.</p>
    </div>
  </div>
  <div class="foot"><span>Emerald Bay · VibeGolf</span><span>1</span></div>
</div>`);
pages.push(`<div class="page"><h2>The bay at both tides</h2>
  <p class="small">The ground never moves; the sea stands at low water (0) or high water (2.4 m) for the whole round, rolled like the pins and changeable on the setup screen. What changes: the Tongue on the 3rd (a landing strip at low tide), the Sandbar's wet sand on the 5th, the 9th's flats (low tide: a fairway; high tide: the sea, and the hole plays along the spit), and the beaches everywhere.</p>
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.2in; margin-top:6pt">
    <img src="${img('map-low.jpg')}" style="width:100%; height:6.4in; object-fit:contain; border:0.6pt solid #888">
    <img src="${img('map-high.jpg')}" style="width:100%; height:6.4in; object-fit:contain; border:0.6pt solid #888">
  </div>
  <div class="foot"><span>Emerald Bay · plan book round ${ROUND}</span><span>2</span></div></div>`);
const C = CRS.card || {};
const cardRows = [['Hook', C.hook], ['Skeleton', C.skeleton], ['Classics', C.classics], ['Decisions', C.decisions], ['Landmarks', C.landmarks], ['Rhythm', C.rhythm], ['Fairway forms', C.forms], ['Height forms', C.heights], ['Dials', C.dials], ['New and borrowed', C.newBorrowed], ['Tips tee', `The ${CRS.tipsSet ? CRS.tipsSet.name : 'tips'} tees, a fifth set at tour length (${tips.toLocaleString()} yd), in the data on every hole and switched off: nothing shows in the game until it is turned on.`]].filter(r => r[1]);
pages.push(`<div class="page"><h2>The course card</h2>
  <table class="cc">${cardRows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  <div class="notes" style="margin-top:8pt"><div class="t">Notes</div>${lines(3)}</div>
  <div class="foot"><span>Emerald Bay · plan book round ${ROUND}</span><span>3</span></div></div>`);
const OPEN = JSON.parse(fs.readFileSync(path.join(HERE, `round${ROUND}-notes.json`)));
pages.push(`<div class="page"><h2>${ROUND === '2' ? 'What moved from the layout doc, and what is open' : `What changed since round ${+ROUND - 1}, and what is open`}</h2>
  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.3in; margin-top:6pt">
    <div><h3>${ROUND === '2' ? 'Moved, to pass the checks (the lines and pins are the approved ones)' : 'From your markup'}</h3>${OPEN.moved.map(t => `<p>${esc(t)}</p>`).join('')}</div>
    <div><h3>Open for you</h3>${OPEN.open.map((t, i) => `<p><b>${i + 1}.</b> ${esc(t)}</p>`).join('')}<div class="notes" style="margin-top:8pt; min-height:1.6in"><div class="t">Notes</div>${lines(6)}</div></div>
  </div>
  <div class="foot"><span>Emerald Bay · plan book round ${ROUND}</span><span>4</span></div></div>`);

const side = g => g.angle > 8 ? `${g.angle}° R` : g.angle < -8 ? `${-g.angle}° L` : 'straight';
const rows = D.holes.map(h => { const hi = D.pages.find(q => q.n === h.n && q.tide === 'high' && q.tideHole); return `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td class="tips">${h.tipsYards}</td><td>${height(h)}</td><td>+${h.rise} / −${h.fall}</td><td class="l">${shape(h)}</td>
  <td>${h.greenArea}</td><td>${h.greenShape.depth}×${h.greenShape.width} ${side(h.greenShape)}</td><td class="l">${h.targets.filter(t => !t.pin).map(t => `${esc(t.name)} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}${hi && hi.yards[BACK] !== h.yards[BACK] ? ` <i>(high tide ${hi.yards[BACK]} yd: ${hi.targets.filter(t => !t.pin).map(t => esc(t.name) + (t.width ? ' ' + t.width + ' m' : '')).join(', ')})</i>` : ''}</td></tr>`; }).join('');
const p3 = 'all three over water (the Leap 20 m down, the Tongue level with the tide\'s sand, the Stack 3 m up)';
const hc = h => h.card || {};
const rows2 = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td class="l">${esc(hc(h).form || '')}</td><td class="l">${esc(hc(h).height || '')}</td><td class="l">${esc(hc(h).dial || '')}</td><td class="l">${/^None/.test(hc(h).decision) ? '–' : esc(hc(h).decision.split(':')[0])}</td><td class="l">${esc(hc(h).hazard || '')}</td><td class="l">${esc(hc(h).surround || '')}</td></tr>`).join('');
pages.push(`<div class="page glance">
  <h2>The course at a glance</h2>
      <table class="sc" style="margin-top:4pt"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class="tips">Shark*</th><th>Tee to green</th><th>Climbs / drops</th><th class="l">Shape</th><th>Green m²</th><th>Green (m), angle</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${par}</b></td>${TEES.map(t => `<td><b>${tot(t.id).toLocaleString()}</b></td>`).join('')}<td class="tips"><b>${tips.toLocaleString()}</b></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>
  <p class="small" style="margin-top:3pt">* The Shark tips tees: a fifth set at tour length, in the data and switched off (the hollow ring on the plans). Green: depth along the approach × width, and which way its long axis turns from the approach. Par 3s: ${p3}.</p>
  <table class="sc" style="margin-top:6pt"><tr><th>#</th><th class="l">Hole</th><th class="l">Fairway form</th><th class="l">Height form</th><th class="l">Dial pushed</th><th class="l">Decision</th><th class="l">Hazard sits</th><th class="l">Round the green</th></tr>${rows2}</table>
  <div class="ov" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.3in; margin-top:4pt">
    <div>
      <h3>Reading the plans</h3>
      <p class="small">Tee at the bottom. Dots: the four tees; the hollow ring is the tips spot. Blue dots: targets (red: the bold one), with yards from the Marlin tee. Numbers along the line: yards to the green. Dashed blue: the high-water mark (at low tide the sand below it is dry, firm wet sand). Contours every metre, labelled every 5. A, B, C: where the cross sections cut. Profiles: the ground along the line by surface, the sea at the page's tide, rock overhead as brown bars; red a tour drive (167 mph), blue 150 mph, flown with the game's physics (▼ where each stops). On the 9th at high tide the blue dashes are the route along the spit.</p>
    </div>
    <div>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data through a real camera: from the back tee (3.2 m behind the ball, 1.8 m up: the game's eye), the landing area (on a par 3, the forward tee) and short of the green. The sea a flat sheet at the page's tide, karst faces pale grey, the jungle canopy as dark dots, the village and the shack as boxes under thatch, the cave's roof and the overhang as dark slabs. No palms yet; the art pass comes after the blockout.</p>

    </div>
  </div>
  <div class="foot"><span>Emerald Bay · plan book round ${ROUND}</span><span>5</span></div>
</div>`);
// the checks, as run
const chk = CHECKS.filter(l => /total|sea stack|cave|overhang|bold line|safe line|straight line|4 bold|shelf's lean|pinnacle|6 from|3 \(|5 \(low\) dry|5 \(high\) dry|The Leap|The Tongue|The Stack|blind|walks|greens with|^!/.test(l));
pages.push(`<div class="page"><h2>The checks, as run</h2>
  <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap:0.25in; margin-top:4pt">
  <div><h3>sample.mjs (the look-at-first list; a line starting ! breaks a rule)</h3><pre class="mono">${esc(chk.join('\n'))}</pre></div>
  <div><h3>relief.mjs, alike.mjs, spread.mjs</h3><pre class="mono">${esc(REVIEW)}</pre></div></div>
  <div class="foot"><span>Emerald Bay · plan book round ${ROUND}</span><span>6</span></div></div>`);

let pg = 7;
const hcard = h => { const c = h.card || {}, w = h.words || {}; if (!h.card) return '';
  return `<div class="hc"><p class="st"><b>Story</b>${esc(w.story || '')}</p><p><b>Type</b>${esc(c.type)}; ${esc(c.form)}</p><p><b>Height form</b>${esc(c.height)}</p><p><b>Dial</b>${esc(c.dial)}</p><p><b>Feature</b>${esc(c.feature)}: ${esc(c.job)}</p><p class="${/^None/.test(c.decision) ? '' : 'dec'}"><b>Decision</b>${esc(c.decision)}</p><p><b>Shots</b>${c.shots.tee ? 'Tee: ' + esc(c.shots.tee) + '. ' : ''}Approach: ${esc(c.shots.approach)}</p><p><b>Miss map</b>${esc(c.miss)}</p><p><b>Tee view</b>${esc(c.view)}</p><p><b>Ground</b>${esc(c.ground)}</p></div>`; };
const mine = (n, tide, th) => CHECKS.filter(l => new RegExp(`^[ !] ${n}( \\((${tide}|${tide} tide)\\))? (landing widths|tee view|bold|tips|green contour|fairway lean|from)`).test(l) && (!th || new RegExp(`^[ !] ${n} \\((${tide}|${tide} tide)\\)`).test(l) || /green contour|fairway lean|bold target/.test(l)) && (th || !/\((low|high)/.test(l) || l.includes('(' + (tide === 'high' ? 'high' : 'low'))) ).map(l => l.replace(new RegExp(`^([ !]) ${n} (\\((low|high)( tide)?\\) )?`), '$1 '));
for (const h of D.pages) {
  const w = h.words, dr = h.drives || {};
  const drv = h.par === 3 ? '' : `<p class="small">Drives from the Marlin tee straight down the first leg${h.route ? ' (at high tide, toward the spit)' : ''}: tour ${Math.round(dr.tour.carry / YD)} yd carry, ${Math.round(dr.tour.total / YD)} total, finishing on ${dr.tour.rest}${dr.tour.rocks ? ' (off rock)' : ''}; 150 mph ${Math.round(dr.mid.carry / YD)} carry, ${Math.round(dr.mid.total / YD)} total, on ${dr.mid.rest}.${h.bold ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} finishes on ${v.rest}`).join(', ')}.` : ''}</p>`;
  const vs = viewsFor(h.n - 1, h.tide);
  const first = h.targets.filter(t => !t.bold)[0];
  const cap = v => ({ tee: `<b>From the back tee</b>${first ? ', toward ' + esc(first.name) : ''}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards.clownfish} yd)` : `<b>From the landing area</b> (${esc(first ? first.name : '')})`, green: `<b>Short of the green</b>, ${Math.round(Math.hypot(v.pos[0] - h.pin[0], v.pos[2] - h.pin[1]) / 5) * 5} m out` })[v.id];
  pages.push(`<div class="page hp">
    <div class="head"><div><div class="small">Hole ${h.n}${h.tideHole ? ` · <b style="color:${h.tide === 'low' ? '#7a5a2a' : '#1f5fa8'}">${tideName(h).toUpperCase()}</b>` : ''}</div><h2>${esc(h.name)}${h.tideHole ? ` <span style="font-size:11pt; color:${h.tide === 'low' ? '#7a5a2a' : '#1f5fa8'}">at ${tideName(h)}</span>` : ''}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${shape(h)}</span><span>${height(h)} tee to green (climbs ${h.rise} m, drops ${h.fall} m)</span></div></div>${card(h)}</div>
    ${h.tideHole && h.tide === 'high' ? `<div class="hc"><p class="st"><b>At high tide</b>${esc(h.note)}</p></div>` : hcard(h).replace('</p><p><b>Type', h.tideHole ? `</p><p class="st" style="color:#7a5a2a"><b>At low tide</b>${esc(h.note)}</p><p><b>Type` : '</p><p><b>Type')}
    <div class="views" style="grid-template-columns: repeat(${vs.length}, 1fr)">${vs.map(v => `<div class="view"><img src="${img('views/h' + h.id + '_' + v.id + '.jpg')}"><div class="cap">${cap(v)}</div></div>`).join('')}</div>
    <div class="body">
      <div class="plan">${h.sections && h.sections.length ? `<img style="height:${4.45 - 0.36 * h.sections.length - 0.1}in" src="${img('plan' + h.id + '.jpg')}"><img class="xs" style="--xs:${0.36 * h.sections.length + 0.06}in; margin-top:0.04in; border:0.6pt solid #ddd" src="${img('xsec' + h.id + '.png')}">` : `<img src="${img('plan' + h.id + '.jpg')}">`}</div>
      <div class="side">
        <p>${esc(w.plays)}</p>
        <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
        ${w.bold ? `<p class="kv"><b>Bold</b> ${esc(w.bold)}</p>` : ''}
        <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
        <p class="kv"><b>Green</b> ${esc(h.green.style)} (${h.greenShape.depth} m deep × ${h.greenShape.width} m wide, ${h.greenArea} m²).</p>
        <pre class="mono" style="border-top:0.6pt solid #bbb; padding-top:2pt; margin-top:2pt">${esc([`Targets: ${h.targets.filter(t => !t.pin).map(t => `${t.name} ${t.d} yd, ${t.width} m wide, ${t.toPin} yd left`).join(' · ') || 'the green'}`, ...mine(h.n, h.tide, h.tideHole)].join('\n'))}</pre>
        ${drv}
        <div class="gn"><img class="prof" src="${img('prof' + h.id + '.png')}"><div class="gimg"><img src="${img('green' + h.n + '.png')}"><div class="cap">The green: 5 cm contours, arrows downhill (red over 3%), pin areas dashed.</div></div></div>
        <div class="notes"><div class="t">Notes</div>${lines(h.sections && h.sections.length ? 3 : 4)}</div>
      </div>
    </div>
    <div class="foot"><span>Emerald Bay · hole ${h.n} · ${esc(h.name)}${h.tideHole ? ' · ' + tideName(h) : ''}</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Emerald Bay plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/emerald-bay-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
