// node tools/rimeholm/book.mjs : the plan book PDF (out/rimeholm-plan-book-r<ROUND>.pdf), white landscape
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
const ROUND = process.env.ROUND || '1', DATE = process.env.DATE || '9 November 2026';
const NEW = process.env.NEW ? JSON.parse(fs.readFileSync(process.env.NEW)) : null;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = f => `file://${OUT}/${f}`;
const shape = h => {
  const L = h.line; if (L.length < 3) return h.par === 3 ? 'One shot' : 'Straight';
  const turns = []; for (let i = 1; i < L.length - 1; i++) { const a = [L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]], b = [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]];
    // x right, -z downrange: a right turn has a positive cross product
    const cr = a[0] * b[1] - a[1] * b[0]; turns.push(cr > 0 ? 'R' : 'L'); }
  if (h.n === 7) return 'Cape right';
  if (h.n === 9) return 'Sidehill climb';
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
.kv { font-size: 8.2pt; line-height: 1.3; margin: 0 0 3pt; }
.kv b { display: inline-block; min-width: 0.5in; font-weight: 600; }
.side img.prof { width: 100%; border: 0.6pt solid #ddd; margin-top: 3pt; display: block; }
.notes { border: 0.6pt solid #333; padding: 3pt 8pt; margin-top: 5pt; flex: 1; min-height: 0.4in; overflow: hidden; }
.notes .t { font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
table.sc { border-collapse: collapse; width: 100%; font-size: 8pt; }
table.sc th, table.sc td { border-bottom: 0.6pt solid #ccc; padding: 2.6pt 4pt; text-align: center; }
table.sc th { border-bottom: 1pt solid #555; font-weight: 600; }
table.sc td.l, table.sc th.l { text-align: left; }
table.sc td.l b { white-space: nowrap; }
.legend { display: flex; flex-wrap: wrap; gap: 4pt 12pt; font-size: 7.4pt; margin-top: 4pt; }
.legend span i { display: inline-block; width: 12pt; height: 8pt; border: 0.5pt solid #777; margin-right: 3pt; vertical-align: -1pt; }
`;
const SW = { fairway: '#bdd4eb', rough: '#dbe6f2', snow: '#f3f5fa', green: '#a8de85', fringe: '#9ecc80', sand: '#6b696e', powder: '#e0eaff', water: '#8cc7db', ice: '#b3dbf0', rock: '#8f919e', rubble: '#bdc2cc', travertine: '#ede3cc', void: '#29384f' };

const pages = [];
pages.push(`<div class="page">
  <div style="display:flex; justify-content:space-between; align-items:flex-end">
    <div><h1>Rimeholm</h1><p style="font-size:11pt; margin:2pt 0 0">Nine holes on a glacier in the far north, played at night under the northern lights</p></div>
    <div class="small" style="text-align:right">Plan book · round ${ROUND} · ${DATE}<br>Par ${D.holes.reduce((a, h) => a + h.par, 0)} · ${D.holes.reduce((a, h) => a + h.yards.mammoth, 0).toLocaleString()} yd from the Mammoth tees</div>
  </div>
  <img src="${img('map.png')}" style="width:10.24in; height:6.93in; margin-top:6pt; border:0.6pt solid #888; object-fit:cover">
  <div class="foot"><span>Rimeholm · VibeGolf</span><span>The holes on the glacier. Dashed: the playing lines. Contours every 10 m. Dark: crevasses and the moulin (open air).</span></div>
</div>`);

if (NEW) pages.push(`<div class="page"><h2>New in round ${ROUND}</h2><div style="columns:2; column-gap:0.3in; margin-top:6pt">${NEW.map(t => `<p>${t}</p>`).join('')}</div>
  <div class="foot"><span>Rimeholm · plan book round ${ROUND}</span><span>2</span></div></div>`);

const rows = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td>${height(h)}</td><td>+${h.rise} / −${h.fall}</td><td class="l">${shape(h)}</td>
  <td class="l">${h.targets.map(t => `${esc(t.name)} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}</td></tr>`).join('');
pages.push(`<div class="page">
  <div style="display:grid; grid-template-columns: 1fr 3.2in; gap: 0.32in">
    <div>
      <h2>The course at a glance</h2>
      <table class="sc" style="margin-top:4pt"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th>Tee to green</th><th>Climbs / drops</th><th class="l">Shape</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${D.holes.reduce((a, h) => a + h.par, 0)}</b></td>${TEES.map(t => `<td><b>${D.holes.reduce((a, h) => a + h.yards[t.id], 0).toLocaleString()}</b></td>`).join('')}<td></td><td></td><td></td><td></td></tr></table>
      <h3>The idea</h3>
      <p>A glacier in the far north, played at night under the northern lights. Where the other courses play against the void, cliffs, walls and ruins, Rimeholm plays against the ice: packed-snow fairways that run, powder rough that holds a ball, crevasses and a moulin that swallow a wild one. Hot springs keep the greens alive, so each green is warm grass in a ring of steam against the snow. Two things lie frozen in the clear ice: a Viking longship under the lake on the 3rd and a woolly mammoth in the valley wall on the 8th. Braziers light the lines of play; the hall, a Norse longhouse, is the clubhouse at the top of the 9th.</p>
      <p><b>Opens on:</b> a clear, cold night with the aurora; light wind. Falling snow is an option on the round setup.</p>
      <h3>Height, hole by hole</h3>
      <p>Off a ledge out of the ice cave (1, −30 m), up four travertine terraces (2, +15), down to the frozen lake (3), down into a trough, up two ramps and onto a shelf 4 m above the last crevasse (4, +12), off the icefall and down a jagged ice scarp (5, −35), a blind climb to a shelf (6, +18), up to a crest and down round the moulin (7, ends level), along an esker and down a valley step to a punchbowl (8) and the big climb to the hall (9, +38). No two holes in a row change height the same way. Fairways lean on six holes: 1, 2, 4, 7, 8 and 9.</p>

    </div>
    <div>
      <h3 style="margin-top:0">Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway (packed snow)', green: 'Green', fringe: 'Short grass (warm moss)', rough: 'Rough (powder)', snow: 'Deep snow (native)', ice: 'Ice', water: 'Hot pool, open water', sand: 'Black-sand bunker', powder: 'Powder bunker (buries the ball)', rock: 'Rock', rubble: 'Broken ice', travertine: 'Travertine terrace', void: 'Open air: crevasse, moulin' }).map(([k, v]) => `<span><i style="background:${SW[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:6pt">Tee at the bottom. Dots: the four tees. Blue dots: course-management targets (red: the bold one), with their yardage from the Mammoth tee. Numbers along the line: yards to the green. Contours every 2 m, labelled every 10. Grey circles: boulders; pale blue circles: seracs, with their height; pale hexagons: blocks of ice on a pressure ridge; orange dots: braziers. Dashed outlines: things overhead or under the ice. Crevasses are dark; a heavy edge with ticks is the raised lip (the ticks point down its face). A zigzag line with ticks is a scarp, the ticks on the low side.</p>
      <h3>Reading the profiles</h3>
      <p class="small">The ground along the playing line, coloured by surface, from the back tee. Grey bars: anything solid over the line. Red: a tour drive (167 mph); dotted red: a high drive; blue: a 150 mph drive. All flown with the game's physics over this ground.</p>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data, drawn through a real camera: from the back tee, from the landing area (on a par 3, the forward tee) and from just short of the green. The cameras stand 5 m up (9 m short of the green) so the shape of the ground reads. They are drawn light so the book prints: in the game it is night, lit by the moon, the aurora, the braziers and the light on each green. These are for judging the layout, not the look.</p>
      <h3>Decided so far</h3>
      <p>Tees Mammoth, Raven, Lynx, Hare. The lake ice plays fast (a ball skates on). The finds are the longship and the mammoth, nothing more fantastical. A clear night with the aurora. The clubhouse is a longhouse. The 8th's green is a true punchbowl, set down into level ground. No line markers on blind shots: the corner map shows the line. Round 2: a bold mix of green shapes; fairways with two edges that swell, pinch and scallop; crevasses with jagged edges and a raised lip on one side; a shelf on 4, a scarp on 5, a split fairway on 8 and crevasses biting in at the edges of 1, 7 and 9; plenty of layered ice scenery between the holes. Varied green and fairway shapes are now a rule for every course. Bunkers: black volcanic sand by the greens (warm ground), hollows of soft powder out in the fairways; greenside bunkers sit just off the green, never in it. Round 3: fairway bunkers on the larger side (now a rule for every course); a long powder bunker down the left of 1; open water short of 3's green in place of the lead; a pod, bunkers and shorter seracs round 5's green; a frozen waterfall on 6 and a bunker wrapping its green. Round 4: 6's shelf a craggy cliff of dark rock with the frozen falls as ice down it; a big powder bunker on 5's line short of the green.</p>
      <div class="notes" style="margin-top:6pt; flex:none"><div class="t">Notes</div>${lines(4)}</div>
    </div>
  </div>
  <div class="foot"><span>Rimeholm · plan book round ${ROUND}</span><span>${NEW ? 3 : 2}</span></div>
</div>`);

let pg = NEW ? 4 : 3;
for (const h of D.holes) {
  const w = h.words, dr = h.drives || {};
  const drv = h.par === 3 ? '' : `<p class="small">Drives from the Mammoth tee down the line: tour ${Math.round(dr.tour.carry / YD)} yd carry${dr.tour.hit ? ', hits ' + dr.tour.hit.what : ''}, 150 mph ${Math.round(dr.mid.carry / YD)}.${h.bold ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} ${v.rest === 'void' ? 'into the moulin' : v.hit ? 'hits ' + v.hit.what : 'clear'}`).join(', ')}.` : ''}</p>`;
  const vs = viewsFor(h.n - 1);
  const first = h.targets[0];
  const cap = v => ({ tee: `<b>From the back tee</b>${first ? ', toward ' + esc(first.name) : ''}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards.hare} yd)` : `<b>From the landing area</b> (${esc(first ? first.name : '')})`, green: `<b>Short of the green</b>, ${Math.round(Math.hypot(v.pos[0] - h.pin[0], v.pos[2] - h.pin[1]) / 5) * 5} m out` })[v.id];
  pages.push(`<div class="page">
    <div class="head"><div><div class="small">Hole ${h.n}</div><h2>${esc(h.name)}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${shape(h)}</span><span>${height(h)} tee to green (climbs ${h.rise} m, drops ${h.fall} m)</span></div></div>${card(h)}</div>
    <div class="views">${vs.map(v => `<div class="view"><img src="${img('views/h' + h.n + '_' + v.id + '.png')}"><div class="cap">${cap(v)}</div></div>`).join('')}</div>
    <div class="body">
      <div class="plan"><img src="${img('plan' + h.n + '.png')}"></div>
      <div class="side">
        <p>${esc(w.plays)}</p>
        <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
        <p class="kv"><b>Bold</b> ${esc(w.bold)}</p>
        <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
        ${h.targets.length ? `<p class="kv"><b>Targets</b> ${h.targets.map(t => `${esc(t.name)} (${t.d} yd, ${t.width} m wide)`).join(' · ')}</p>` : ''}
        <p class="kv"><b>Green</b> ${esc(h.green.style)}</p>
        ${drv}
        <img class="prof" src="${img('prof' + h.n + '.png')}">
        <div class="notes"><div class="t">Notes</div>${lines(6)}</div>
      </div>
    </div>
    <div class="foot"><span>Rimeholm · hole ${h.n} · ${esc(h.name)}</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rimeholm plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/rimeholm-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
