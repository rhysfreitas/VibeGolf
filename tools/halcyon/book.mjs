// node tools/halcyon/book.mjs : the plan book PDF (out/halcyon-plan-book-r<ROUND>.pdf), white landscape pages: a
// cover with the course map, the course card, the course at a glance, then one page a hole (the hole card, three
// sketch views across the top; the plan, how it plays, the profile, the green and room for notes under them).
// Needs sample.mjs, plans.py and sketch.mjs first. Prints with Chrome.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { viewsFor } from './sketch.mjs';
import { COURSE as CRS } from './holes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const D = JSON.parse(fs.readFileSync(`${OUT}/grid/holes.json`)), TEES = D.teeSets, YD = 0.9144;
const VIEWS = JSON.parse(fs.readFileSync(`${OUT}/grid/views.json`));
const ROUND = process.env.ROUND || '1', DATE = process.env.DATE || '12 November 2026', BACK = D.back;
const NEW = process.env.NEW ? JSON.parse(fs.readFileSync(process.env.NEW)) : null;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img = f => `file://${OUT}/${f}`;
const lines = n => Array.from({ length: n }, () => '<div class="rule"></div>').join('');
const card = h => `<table class="card"><tr>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}</tr>
  <tr>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}</tr></table>`;
const height = h => { const dh = h.pinY - h.teeY; return `${dh >= 0 ? '+' : '−'}${Math.abs(dh).toFixed(0)} m`; };
const NAME = 'Halcyon Ring';

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
.ov p { font-size: 7.5pt; line-height: 1.24; margin-bottom: 2.5pt; }
.ov h3 { margin-top: 4pt; }
.ov p.small { font-size: 7pt; }
.foot { position: absolute; bottom: 0.16in; left: 0.38in; right: 0.38in; font-size: 7pt; color: #777; display: flex; justify-content: space-between; gap: 12pt; }
.rule { border-bottom: 0.6pt solid #b8b8b8; height: 0.25in; }
.card { border-collapse: collapse; }
.card th, .card td { border: 0.6pt solid #999; padding: 1.5pt 7pt; font-size: 7.8pt; text-align: center; }
.card th { font-weight: 600; background: #f6f6f4; }
.dot { display: inline-block; width: 7pt; height: 7pt; border-radius: 50%; border: 0.6pt solid #333; margin-right: 3pt; vertical-align: -0.5pt; }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12pt; height: 0.5in; }
.head .facts { font-size: 8.6pt; color: #333; display: flex; gap: 12pt; margin-top: 2pt; }
.head .facts b { font-weight: 600; }
.views { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.1in; margin-top: 0.08in; }
.view img { width: 100%; height: 1.36in; object-fit: cover; object-position: center 60%; border: 0.6pt solid #333; display: block; }
.view .cap { font-size: 7.2pt; margin-top: 1.5pt; color: #333; }
.view .cap b { font-weight: 600; }
.body { display: grid; grid-template-columns: 3.3in 1fr; gap: 0.2in; margin-top: 0.06in; height: 4.4in; }
.plan img { width: 3.3in; height: 4.36in; object-fit: contain; object-position: center top; border: 0.6pt solid #888; display: block; }
.side { display: flex; flex-direction: column; min-height: 0; }
.side p { font-size: 7.2pt; line-height: 1.22; margin-bottom: 2pt; }
.side p.small { font-size: 7pt; }
.side p.kv { font-size: 7pt; line-height: 1.2; margin: 0 0 1.5pt; }
.kv b { display: inline-block; min-width: 0.5in; font-weight: 600; }
.side img.prof { width: 100%; max-height: 1.05in; object-fit: contain; object-position: left top; border: 0.6pt solid #ddd; margin-top: 3pt; display: block; }
.notes { border: 0.6pt solid #333; padding: 3pt 8pt; margin-top: 5pt; flex: 1; min-height: 0.36in; overflow: hidden; }
.gn { display: flex; gap: 6pt; flex: none; margin-top: 4pt; }
.gn .gimg { width: 1.15in; flex: none; }
.gn .gimg img { width: 1.15in; height: 1.15in; border: 0.6pt solid #ddd; display: block; }
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
table.cc th { text-align: left; vertical-align: top; width: 1.35in; font-size: 8.4pt; font-weight: 600; padding: 3.6pt 8pt 3.6pt 0; border-top: 0.6pt solid #bbb; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
table.cc td { font-size: 8.4pt; line-height: 1.32; padding: 3.6pt 0; border-top: 0.6pt solid #bbb; }
.hc { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1pt 12pt; margin-top: 4pt; padding: 3pt 0; border-top: 0.8pt solid #444; border-bottom: 0.6pt solid #bbb; }
.hc p { font-size: 6.9pt; line-height: 1.22; margin: 0; }
.hc p.st { grid-column: 1 / -1; font-size: 7.6pt; font-style: italic; }
.hc b { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 6.3pt; color: #444; margin-right: 3pt; font-style: normal; }
.hc p.dec { color: #8a2d1c; }
.hc p.st.dl { font-style: normal; font-size: 6.9pt; }
.legend span i { display: inline-block; width: 12pt; height: 8pt; border: 0.5pt solid #777; margin-right: 3pt; vertical-align: -1pt; }
.cover2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in; margin-top: 8pt; }
`;
// the plan palette (plans.py COL)
const SW = { fairway: '#9ecf80', rough: '#c2d99e', park: '#dbe8c2', green: '#99db7a', fringe: '#8cc773', wood: '#85ad75', garden: '#e6e6d1', plaza: '#e0dbd1', stone: '#ccc7bd', sand: '#f2e8c7', water: '#9ec7e6', window: '#1a1f38' };

const pages = [];
const tot = k => D.holes.reduce((a, h) => a + h.yards[k], 0), par = D.holes.reduce((a, h) => a + h.par, 0), tips = D.holes.reduce((a, h) => a + h.tipsYards, 0);
const topName = TEES.find(t => t.id === BACK).name, tipsName = CRS.tipsSet.name;
pages.push(`<div class="page">
  <div style="display:flex; justify-content:space-between; align-items:flex-end">
    <div><h1>${NAME}</h1><p style="font-size:11pt; margin:2pt 0 0">Nine holes of parkland golf inside a ring space station, a garden colony 5 km in radius, in the late light</p></div>
    <div class="small" style="text-align:right">Plan book · round ${ROUND} · ${DATE}<br>Par ${par} · ${tot(BACK).toLocaleString()} yd from the ${topName} tees</div>
  </div>
  <img src="${img('map.png')}" style="width:10.24in; height:5.02in; margin-top:6pt; border:0.6pt solid #888; object-fit:contain">
  <div class="cover2">
    <div><h3>The ring</h3><p>A wheel 5 km in radius turning once every 2.4 minutes, its floor 900 m wide between two rim walls of glass 320 m high. On the floor: lawns, woods, a long lake and a canal, white villas on terraces, and one tram line down the middle. Ahead and behind, the floor curves up out of sight; overhead, the far side is 10 km away and too hazy to see. The light comes in through a mirror band along the axis, shuttered south of the day/night line.</p></div>
    <div><h3>The map</h3><p>The ring's floor unrolled flat, north (spinward, up the curve) to the right and west at the top; it is a cylinder, so both ends of the map climb. Dashed gold: the playing lines from the ${topName} tees; numbered circles the back tees. Dark blue with stars: the floor windows (glass, a penalty area). The shaded band on the left: the night side. Grey squares: the spoke's two feet.</p></div>
  </div>
  <div class="foot"><span>${NAME} · VibeGolf</span><span>1</span></div>
</div>`);

const C = CRS.card || {};
const cardRows = [['Hook', C.hook], ['Skeleton', C.skeleton], ['Classics', C.classics], ['Decisions', C.decisions], ['Landmarks', C.landmarks], ['Rhythm', C.rhythm], ['Set pieces', C.setPieces], ['Dials', C.dials], ['Height forms', C.heights], ['Fairway forms', C.forms], ['Shots and hazards', C.shots], ['New and borrowed', C.newBorrowed],
  ['Tips tee', `The ${tipsName} tees, a fifth set at tour length (${tips.toLocaleString()} yd), in the data on every hole and switched off: nothing shows in the game until it is turned on.`]].filter(r => r[1]);
pages.push(`<div class="page"><h2>The course card</h2>
  <table class="cc">${cardRows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  <div class="notes" style="margin-top:8pt"><div class="t">Notes</div>${lines(2)}</div>
  <div class="foot"><span>${NAME} · plan book round ${ROUND}</span><span>2</span></div></div>`);
if (NEW) pages.push(`<div class="page"><h2>New in round ${ROUND}</h2><div style="columns:2; column-gap:0.3in; margin-top:6pt">${NEW.map(t => `<p>${t}</p>`).join('')}</div>
  <div class="foot"><span>${NAME} · plan book round ${ROUND}</span><span>3</span></div></div>`);

const side = g => g.angle > 8 ? `${g.angle}° R` : g.angle < -8 ? `${-g.angle}° L` : 'straight';
const rows = D.holes.map(h => `<tr><td>${h.n}</td><td class="l"><b>${esc(h.name)}</b></td><td>${h.par}</td>${TEES.map(t => `<td>${h.yards[t.id]}</td>`).join('')}<td class="tips">${h.tipsYards}</td><td>${height(h)}</td><td>+${h.rise} / −${h.fall}</td><td class="l">${esc(h.shape)}</td>
  <td>${h.greenShape.depth}×${h.greenShape.width} ${side(h.greenShape)}</td><td class="l">${h.targets.map(t => `${esc(t.name)}${t.bold ? ' (bold)' : ''} ${t.width ? t.width + ' m' : ''}`).join(', ') || '–'}</td></tr>`).join('');
const ord = n => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
const p3 = D.p3.map(q => `the ${ord(q.n)} ${q.yd} yd plays about ${q.plays}`).join(', ');
pages.push(`<div class="page">
  <h2>The course at a glance</h2>
      <table class="sc" style="margin-top:4pt"><tr><th>#</th><th class="l">Hole</th><th>Par</th>${TEES.map(t => `<th><span class="dot" style="background:${t.color}"></span>${t.name}</th>`).join('')}<th class="tips">Tips*</th><th>Tee to green</th><th>Climbs / drops</th><th class="l">Shape</th><th>Green (m), angle</th><th class="l">Landing areas (fairway width)</th></tr>${rows}
      <tr><td></td><td class="l"><b>Total</b></td><td><b>${par}</b></td>${TEES.map(t => `<td><b>${tot(t.id).toLocaleString()}</b></td>`).join('')}<td class="tips"><b>${tips.toLocaleString()}</b></td><td></td><td></td><td></td><td></td><td></td></tr></table>
  <p class="small" style="margin-top:3pt">* Tips: the ${tipsName} tees, a fifth set at tour length, in the data and switched off (nothing shows in the game until it is turned on): 30–40 yd behind the back tee on the par 4s and 5s, 15 yd on the par 3s, the hollow ring on the plans. Tee to green includes the curve: each hole's ground rises (s − s₀)² / 2R along the ring from its back tee, about 6 m at 250 m and 25 m at 500. Green: depth along the approach × width, and which way its long axis turns from the approach.</p>
  <div class="ov" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.3in">
    <div>
      <h3>The idea</h3>
      <p>Parkland golf in a pristine garden colony on the floor of a ring station: lime avenues, walled gardens, a long lake, a canal with a lock, white villas stepping up terraces toward the rim walls, and the station's own structure as the hazards and landmarks. Its one rule: a floor window is glass, flush with the turf, with space and the stars wheeling under it, and plays as a penalty area (a stroke and a drop beside where the ball crossed, like water). The ball flies as on Earth. The curve plays as it looks: along the ring the floor rises ahead of you and behind you; across it the floor is level.</p>
      <p><b>The round.</b> It starts at the tram stop (the 1st tee) and plays south up the curve toward the day/night line; the 3rd runs along it with the lit villas of the night side beyond. The 4th turns west round the Long Window, the first floor window, and climbs to the west terraces; the 5th drops off them to a balcony over the rim glass with Earth beside it. The 6th follows the long lake up the ring on a bench to the falls, the 7th drives up onto the spoke's plinth, a table under the A-frame with the biggest green in the game on it, and the 8th climbs the valley beside the canal and its lock, reachable in two. From the 9th tee, on the rim of a sunken amphitheatre, the Great Window lies in its floor across the line with the clubhouse on the far rim: the reveal and the finish.</p>
      <p><b>Opens on:</b> evening: late light from the mirror band as it dims, warm along the ring; clear and mild; a light spinward breeze from the air handling.</p>
      <h3>Height, hole by hole</h3>
      <p>A half-pipe up 10 with the curve between two embankments (1), up 5 into the walled garden (2), 12 down off the east terrace (3), up 26 in three terraces round the Long Window (4), 22 down to the balcony (5), a 10% bench up the lake shore (6), off the falls terrace to the floor and up a 7.5 m face onto the plinth (7), up 12 through the valley to a perched green (8), and level across the amphitheatre, 8.5 m deep, to the clubhouse lawn (9).</p>
    </div>
    <div>
      <h3>Reading the plans</h3>
      <div class="legend">${Object.entries({ fairway: 'Fairway', green: 'Green', fringe: 'Short grass', rough: 'Rough', park: 'Parkland lawn (native)', wood: 'Woods', garden: 'Villa gardens', plaza: 'Plaza, paths', stone: 'Terrace walls and banks', sand: 'Bunker', water: 'Water: lake, canal, pools (a stroke and a drop)', window: 'Floor window: glass over space (a stroke and a drop)' }).map(([k, v]) => `<span><i style="background:${SW[k]}"></i>${v}</span>`).join('')}</div>
      <p class="small" style="margin-top:6pt">Tee at the bottom. Dots: the four tees; the hollow ring behind them is the tips spot. Blue dots: course-management targets (red: the bold one), with their yardage from the ${topName} tee. Numbers along the line: yards to the green. Contours every 2 m, labelled every 10, with the curve included. Circles: trees (limes, planes, yews, poplars, willows); white blocks: villas and the clubhouse; grey: the spoke's feet; black lines: garden walls.</p>
      <h3>Reading the profiles</h3>
      <p class="small">The ground along the playing line, coloured by surface, from the back tee, the curve included. Grey bars: anything solid over the line (the spoke's foot on the 7th). Red: a tour drive (167 mph); dotted red: a high drive; blue: a 150 mph drive. All flown with the game's physics at sea level over this ground.</p>
      <h3>Reading the sketches</h3>
      <p class="small">Plain shapes from the plan data through a real camera, 5 m up (9 m short of the green), drawn on the true cylinder: the floor rises along the ring, out of the top of the frame within a few kilometres. Rim walls as glass with ribs; Earth placed where the view could see it through the glass (it wheels past once a turn). Space drawn as a pale wash with grey stars so the book prints. The game's own camera is lower (1.55 m up, 3.2 m behind the ball): every tee shot's target was checked in sight from it.</p>
      <h3>Decided so far</h3>
      <p>Radius 5 km; the curve plays as it looks; floor windows and the rim glass (a band along the foot of each rim wall, segmented every 120 m by beams on the wall's ribs, a sill where it meets the wall) are glass and a penalty area. Tees ${TEES.map(t => t.name).join(', ')}; ${tipsName} tips switched off. Decisions on 4, 7 and 8; the classics Double Plateau, Short, Road, Leven, Channel; the set pieces the postage stamp (2) and the church pews (3); a dial pushed on every hole, the 7th's green past real golf; landmarks the spoke, Earth through the rim glass and the clubhouse; late light with the air handling's breeze. Par 3s: ${p3}.</p>
    </div>
  </div>
  <div class="foot"><span>${NAME} · plan book round ${ROUND}</span><span>${NEW ? 4 : 3}</span></div>
</div>`);

let pg = NEW ? 5 : 4;
const hcard = h => { const c = h.card || {}, w = h.words || {}; if (!h.card) return '';
  return `<div class="hc"><p class="st"><b>Story</b>${esc(w.story || '')}</p><p><b>Type</b>${esc(c.type)}; ${esc(c.form)}</p><p><b>Feature</b>${esc(c.feature)}: ${esc(c.job)}</p><p class="${/^None/.test(c.decision) ? '' : 'dec'}"><b>Decision</b>${esc(c.decision)}</p><p><b>Miss map</b>${esc(c.miss)}</p><p><b>Tee view</b>${esc(c.view)}</p><p><b>Ground</b>${esc(c.ground)}</p>${c.dial ? `<p class="st dl"><b>Dial</b>${esc(c.dial)}${c.setPiece ? ` · <b>Set piece</b>${esc(c.setPiece)}` : ''} · <b>Shots</b>${c.shots.tee !== '-' ? 'tee: ' + esc(c.shots.tee) + '; ' : ''}${esc(c.shots.approach)} · <b>Hazard</b>${esc(c.hazard)} · <b>Surround</b>${esc(c.surround)}</p>` : ''}</div>`; };
const front = TEES.at(-1);
for (const h of D.holes) {
  const w = h.words, dr = h.drives || {}, tv = VIEWS[h.n];
  const drv = h.par === 3 ? '' : `<p class="small">Drives from the ${topName} tee down the line: tour ${Math.round(dr.tour.carry / YD)} yd carry${dr.tour.hit ? ', hits ' + dr.tour.hit.what : ''}, 150 mph ${Math.round(dr.mid.carry / YD)}.${h.bold && h.bold.drives && Object.keys(h.bold.drives).length ? ` Along the bold line: ${Object.entries(h.bold.drives).map(([k, v]) => `${k === 'mid' ? '150 mph' : k} ${v.rest === 'water' ? 'in the water' : v.hit ? 'hits ' + v.hit.what : 'finishes on ' + v.rest}`).join(', ')}.` : ''}</p>`;
  const vs = viewsFor(h.n - 1);
  const first = h.targets.filter(t => !t.bold)[0];
  const cap = v => ({ tee: `<b>From the back tee</b>${first ? ', toward ' + esc(first.name) : ''}`, land: h.par === 3 ? `<b>From the forward tee</b> (${h.yards[front.id]} yd)` : `<b>From the landing area</b> (${esc(first ? first.name : '')})`, green: `<b>Short of the green</b>, ${Math.round(Math.hypot(v.pos[0] - h.pin[0], v.pos[2] - h.pin[1]) / 5) * 5} m out` })[v.id];
  pages.push(`<div class="page">
    <div class="head"><div><div class="small">Hole ${h.n}</div><h2>${esc(h.name)}</h2>
      <div class="facts"><span><b>Par ${h.par}</b></span><span>${esc(h.shape)}</span><span>${height(h)} tee to green (climbs ${h.rise} m, drops ${h.fall} m)</span></div></div>${card(h)}</div>
    ${hcard(h)}
    <div class="views">${vs.map(v => `<div class="view"><img src="${img('views/h' + h.n + '_' + v.id + '.png')}"><div class="cap">${cap(v)}</div></div>`).join('')}</div>
    <div class="body">
      <div class="plan"><img src="${img('plan' + h.n + '.png')}"></div>
      <div class="side">
        <p>${esc(w.plays)}</p>
        <p class="kv"><b>Safe</b> ${esc(w.safe)}</p>
        ${w.bold ? `<p class="kv"><b>Bold</b> ${esc(w.bold)}</p>` : ''}
        <p class="kv"><b>A miss</b> ${esc(w.miss)}</p>
        ${h.targets.length ? `<p class="kv"><b>Targets</b> ${h.targets.map(t => `${esc(t.name)}${t.bold ? ' (bold)' : ''} (${t.d} yd, ${t.width} m wide)`).join(' · ')}</p>` : ''}
        <p class="kv"><b>Green</b> ${esc(h.green.style)} (${h.greenShape.depth} m deep × ${h.greenShape.width} m wide, ${h.greenArea} m²).</p>
        ${h.contour ? `<p class="kv"><b>Contour</b> Typically ${h.contour.median}% underfoot, ${h.contour.feat === 'a feature' ? `${h.contour.relief} m of shape beyond its fall` : 'flatter: just its fall'}; ${h.contour.areas} pin areas, ${h.contour.cup}% cuppable.${h.lean && h.lean.length ? ' Fairway lean: ' + h.lean.map(l => `${esc(l.name)} ${Math.abs(l.lean)}% ${l.lean > 0.3 ? 'right' : l.lean < -0.3 ? 'left' : 'level'}`).join(', ') + '.' : ''}</p>` : ''}
        ${tv ? `<p class="kv"><b>In sight</b> From the game's camera, ${esc(tv.to)}: ${esc(tv.sets.join('; '))}.</p>` : ''}
        <p class="kv"><b>Tips</b> The ${tipsName} tee, in the data and switched off: ${h.tipsYards} yd${h.par > 3 ? ', its 290 yd drive checked on fairway' : ''}.</p>
        ${drv}
        <div class="gn"><img class="prof" src="${img('prof' + h.n + '.png')}"><div class="gimg"><img src="${img('green' + h.n + '.png')}"><div class="cap">The green: 5 cm contours, arrows downhill (red over 3%), pin areas dashed.</div></div></div>
        <div class="notes"><div class="t">Notes</div>${lines(6)}</div>
      </div>
    </div>
    <div class="foot"><span>${NAME} · hole ${h.n} · ${esc(h.name)}</span><span>${pg++}</span></div></div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${NAME} plan book</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(`${OUT}/book.html`, html);
const pdf = `${OUT}/halcyon-plan-book-r${ROUND}.pdf`;
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/book.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, (fs.statSync(pdf).size / 1e6).toFixed(1) + ' MB', pages.length, 'pages');
