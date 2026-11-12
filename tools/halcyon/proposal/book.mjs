// node tools/halcyon/proposal/book.mjs : the proposal for the two addenda of 12 November (height forms; dials, set
// pieces and shots), white pages: the nine in a table, the checks before and after, then a page for each hole that
// changes with its side profile now and proposed at one scale and its plan now and proposed.
// Needs heights.mjs (now, proposed), proposal/profiles.py, plans.py and sketch.mjs first; the "now" plans and views
// were copied to out/heights before the changes.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '..', 'out', 'heights');
const img = f => `file://${OUT}/${f}`;
const css = `
@page { size: 11in 8.5in; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'DejaVu Sans', Helvetica, sans-serif; color: #222; background: white; }
.page { width: 11in; height: 8.5in; padding: 0.32in 0.38in; position: relative; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
h1 { font-size: 22pt; margin: 0 0 2pt; } h2 { font-size: 15pt; margin: 0; } h3 { font-size: 8.6pt; margin: 7pt 0 3pt; text-transform: uppercase; letter-spacing: .06em; color: #555; }
p, li { font-size: 8.3pt; line-height: 1.33; margin: 0 0 3.5pt; } ul { margin: 0; padding-left: 13pt; }
.small { font-size: 7.3pt; color: #555; }
table { border-collapse: collapse; width: 100%; font-size: 7.3pt; } th, td { border-bottom: .6pt solid #ccc; padding: 2pt 4pt; text-align: left; vertical-align: top; } th { border-bottom: 1pt solid #555; font-size: 7pt; }
.chg { color: #1f5f2a; font-weight: 600; } .was { color: #b03a2e; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.18in; }
.box img { width: 100%; border: .6pt solid #999; display: block; } .cap { font-size: 6.8pt; color: #444; margin-top: 2pt; }
.foot { position: absolute; bottom: .15in; left: .38in; right: .38in; font-size: 7pt; color: #777; display: flex; justify-content: space-between; }
.tag { display: inline-block; border: .8pt solid #1f5f2a; color: #1f5f2a; border-radius: 3pt; padding: 0 5pt; font-size: 7.6pt; font-weight: 600; margin-left: 4pt; }
.facts { font-size: 7.6pt; color: #333; margin: 3pt 0 4pt; } .facts b { color: #111; }
.prof img { width: 100%; display: block; }
.hole { display: grid; grid-template-columns: 2.75in 2.75in 1fr; gap: 0.14in; margin-top: 4pt; }
.hole .box img { height: 3.7in; object-fit: contain; object-position: top; }
`;
const pages = [];
const foot = n => `<div class="foot"><span>Halcyon Ring · height forms, dials and set pieces · proposal · 12 November 2026</span><span>${n}</span></div>`;
// the nine: [n, name, par, yards now → proposed, dial, height form, fairway form, tee shot, approach, hazard, surround, set piece]
const NINE = [
  [1, 'The Promenade', 4, '380', 'Width: the widest fairway, 74 m on average, 91 m where drives land', 'half-pipe (was a ramp)', 'fan', 'driver, hard', 'run-up', 'a side', 'tight run-off', ''],
  [2, 'The Walled Garden', 3, '170 → 115', 'Green size: about 290 m², the smallest on the course', 'uphill par 3', '–', '–', 'full wedge', 'all round', 'bunkers, the wall', 'postage stamp'],
  [3, 'The Terminator', 4, '430', 'Bunker count: nine rungs of the pews and two at the green', 'tee drop', 'hourglass', 'lay-up to a number', 'run-up', 'diagonal', 'bunkers', 'church pews'],
  [4, 'The Long Window', 5, '545', 'One hazard\'s scale: the Long Window, 90 m of glass, about 4,000 m²', 'stepped (was a ramp)', 'hook', 'fade', 'long wood', 'diagonal', 'a drop', ''],
  [5, 'The Balcony', 3, '230', 'Par 3 length: 230 yd, the longest par 3', 'drop par 3', '–', '–', 'long iron or wood', 'a side', 'the rim glass', ''],
  [6, 'The Long Lake', 4, '455', 'Height: a hillside bench, 10% across where drives land', 'hillside bench', 'scalloped', 'draw', 'from a hanging lie', 'a side', 'water', ''],
  [7, 'The Spoke', 4, '310', 'Green size, past real golf: one lawn of about 1,400 m², two shelves', 'table top (was a ramp)', 'island', 'high carry', 'blind, over the lip marker', 'centre (the foot)', 'a feeding bank', ''],
  [8, 'The Aqueduct', 5, '560 → 490', 'Par 5 length: 490 yd, reachable in two over the canal', 'perched green', 'split', 'dead straight', 'long wood', 'diagonal (the canal)', 'bunkers', ''],
  [9, 'The Great Window', 3, '150', 'Bunker count: none, the window and the amphitheatre do the work', 'par 3 across a gulf (was a drop)', '–', '–', 'high carry that stops', 'across', 'a drop to the window', ''],
];
pages.push(`<div class="page">
  <h1>Halcyon Ring: height forms, dials and set pieces</h1>
  <p class="small">One proposal for both addenda of 12 November: the ground ("the up/down elevation stuff gets a little repetitive"; "Halcyon came out a little boringly flat") and the plain numbers ("unique, fun to play holes with somewhat realistic features and somewhat bold or exaggerated features"; "mostly real, one past it"). Built and checked in the plan tools; nothing is committed until you pick. Pages 2–9: each hole that changes, its profile and plan now and proposed at one scale.</p>
  <table><tr><th>#</th><th>Hole</th><th>Yards</th><th>The dial it pushes</th><th>Height form</th><th>Fairway</th><th>Tee shot</th><th>Approach</th><th>Hazard</th><th>Green surround</th><th>Set piece</th></tr>
  ${NINE.map(r => `<tr><td>${r[0]}</td><td><b>${r[1]}</b> (${r[2]})</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td><td>${r[8]}</td><td>${r[9]}</td><td>${r[10]}</td><td class="chg">${r[11]}</td></tr>`).join('')}</table>
  <div class="grid" style="margin-top:6pt">
    <div>
      <h3>Dials (spread.mjs)</h3>
      <p class="was">Now: greens 434–608 m², 8 of 9 within 10% of one size; par 5s 545 and 560; fairways 45–62 m wide; bunkers one or two everywhere; nothing past real golf. Six flags.</p>
      <p class="chg">Proposed: greens 293 to 1,400 m² (three within 10% of the middle); par 3s 115, 150, 230; par 4s 310–455; par 5s 490 and 545; fairways 45–74 m on average; bunkers from none to eleven a hole; bends 0–55°. No flags. Edges of real golf touched: a 293 m² green, a 115 yd and a 230 yd par 3, a 310 yd par 4, a 490 yd par 5, a 74 m fairway, a hole with no bunker, a field of bunkers, a dead-straight hole. Past real golf: one hole, the 7th's green.</p>
      <h3>Height forms (relief.mjs)</h3>
      <p class="was">Now: bold holes 4 and 6; the 7th a plain ramp; two drop par 3s (flagged).</p>
      <p class="chg">Proposed: nine forms, none twice; bold holes 4 (stepped), 6 (bench) and 7 (table top); one tee drop (3); one drop par 3 (5). No flags.</p>
    </div>
    <div>
      <h3>Shots, hazards, surrounds</h3>
      <p>Tee shots of six kinds (driver, lay-up, fade, draw, high carry, straight); approaches of seven (run-up twice, full wedge, long wood or iron three times, hanging lie, blind over a marker, high carry). The 4th favours a fade (a cape to the right round the window), the 6th a draw (it holds the bench's high side). Hazards: three diagonal, three down a side, one across, one centre, one all round. Surrounds: no kind more than three times.</p>
      <h3>Set pieces (the register: never used)</h3>
      <p><b>Postage stamp</b> on the 2nd: 115 yd up into the walled garden to a 290 m² green, the garden wall 4 m behind it (the ball plays off it). <b>Church pews</b> on the 3rd: nine rungs of sand between clipped box ridges, a formal parterre on a diagonal into the pinch.</p>
      <h3>Also checked on the proposal (sample.mjs)</h3>
      <p>No flags: every tee set's drive on 43–94 m of fairway; pins 3% or less; two pin areas or more on every green; tips pads level, a 290 yd drive on fairway; every target or flag in sight from the game's camera; fairway forms unchanged (alike.mjs 0 of 15). Par 3s play about 124, 212 and 149 yd. No gate yet (no game module).</p>
      <p class="small">Found on the way: relief.mjs read every lean the wrong way round (on every course); fixed. The 6th already leaned away from the lake.</p>
    </div>
  </div>
  ${foot(1)}</div>`);

const holePage = (n, title, tag, facts, body, opts = {}) => pages.push(`<div class="page">
  <div><h2 style="display:inline">${n} ${title}</h2>${tag.map(t => `<span class="tag">${t}</span>`).join('')}</div>
  <div class="facts">${facts}</div>
  <div class="prof"><img src="${img('prof' + n + '.png')}" style="max-height:${opts.ph || 1.75}in; object-fit:contain"></div>
  <div class="cap">Along the playing line from the back tee: now (red), proposed (green, coloured by surface); heights four times too tall; the bar is the pin.</div>
  <div class="hole">
    <div class="box"><img src="${img('plan' + n + '-now.png')}"><div class="cap">Now</div></div>
    <div class="box"><img src="${img('plan' + n + '-proposed.png')}"><div class="cap">Proposed</div></div>
    <div>${body}</div>
  </div>
  ${foot(pages.length + 1)}</div>`);

holePage(1, 'The Promenade', ['dial: width', 'half-pipe'], '<b>Asks:</b> driver as hard as you like down an 85–90 m lawn, then a run-up into the open front of the Double Plateau green. Hazard down a side (the limes, the sunken lawn); surround a tight mown run-off.',
  `<p>The avenue's fairway widens to 91 m where drives land (74 m on average, the widest on the course; it was 46), and the ground either side rises into grassed embankments 9.5 m high 60 m out, the limes along the top of the left one. The line itself is as before: only the sides rise, so a loose drive runs back toward the middle.</p>
   <p>The Double Plateau green grows to about 670 m² (was 545). The opener stays gentle: no penalty ground.</p>
   <div class="box" style="margin-top:4pt"><img src="${img('across1.png')}" style="width:100%"><div class="cap">Across the landing area, now and proposed.</div></div>`);
holePage(2, 'The Walled Garden', ['dial: green size', 'postage stamp', 'the wall'], '<b>Asks:</b> a full wedge, 115 yd, up 5 m into the garden. Trouble all round: bunkers short left and right and a pot front left, the wall right behind.',
  `<p>The tees come 42 m forward (170 → 115 yd from Zenith; Meridian 110, Horizon 105, Nadir 100) and the green shrinks to about 290 m² (was 434). The garden's back wall closes in to 4 m behind the green, so a ball long hits it and comes back (it is solid, 3.2 m high); the ha-ha now lies beyond the wall.</p>
   <p>The garden's top lawn is 1 m lower (5 m over the tee), so every forward tee sees the flag over the garden's front bank.</p>
   <p>Par 3s now 115, 150 and 230 yd (they play about 124, 149 and 212).</p>`);
holePage(3, 'The Terminator', ['dial: bunker count', 'church pews'], '<b>Asks:</b> a lay-up to a number (short of the pews, 243 yd) or a drive that takes on the pinch, then a run-up to the Road green. Hazard diagonal; surround bunkers.',
  `<p>The garden wall that made the hourglass's pinch on the left becomes a formal parterre: the church pews, nine rungs of sand 18 m long between clipped box ridges, on a diagonal from 46 m left of the line at 222 m out to 8 m left at 300 m. The longer the drive, the more of the pinch they take. Eleven bunkers on the hole (it had two).</p>
   <p>The Road green shrinks to about 420 m² (was 556), long and narrow across the line; its pot front left stays.</p>`);
holePage(4, 'The Long Window', ['dial: one hazard\'s scale', 'stepped'], '<b>Asks:</b> a fade round the cape (or over the window), then a long wood up onto the terraces. Hazard diagonal (the window); surround a drop (the perched green).',
  `<p>The window itself is the dial: 90 m of glass, about 4,000 m², the largest hazard on the course (it is already this size; spread.mjs counts only bunkers, so it doesn't see it).</p>
   <p>The 26 m climb to the west terraces comes as three level garden terraces with banks of 7–8 m between (about 35%), instead of two ramps. The approach bunker moves up onto the top terrace; "Below the terraces" becomes "The middle terrace" (357 yd).</p>`);
holePage(6, 'The Long Lake', ['dial: height', 'hillside bench'], '<b>Asks:</b> a draw that holds the bench\'s high side by the lake, then an approach from a hanging lie. Hazard down a side (the lake); surround water.',
  `<p>The landing area leans 10% (was 7.9%), down to the right, away from the lake: the high side is the lake side, held by the shore's bank; the low side runs into a wide first cut and the catch bunker. The fairway is 57–61 m wide where drives land.</p>
   <div class="box" style="margin-top:4pt"><img src="${img('across6.png')}" style="width:100%"><div class="cap">Across the landing area, now and proposed; the lake on the left.</div></div>`);
holePage(7, 'The Spoke', ['dial: green size (past real golf)', 'table top'], '<b>Asks:</b> a high carry up onto the plinth (about 215 yd from Zenith), or a lay-up below the face and a blind pitch over the lip marker. Hazard in the centre (the spoke\'s foot); surround a feeding bank.',
  `<p>The plinth becomes a table 7.5 m up behind a grass face 165–197 m out; the west foot stands on the floor in front of it (133–167 m). On top, the green is one lawn of about 1,400 m² under the A-frame (was 572), split by a 0.5 m tier into a front and a back shelf. The hole people describe to a friend.</p>
   <p><b>World changes:</b> the spoke 30 m west; the plinth from 3.5 to 7.5 m; the falls terrace narrowed so the Zenith tee is 3 m short of its lip; Meridian down on the floor; the 8th tee rises with the plinth.</p>`);
holePage(8, 'The Aqueduct', ['dial: par 5 length'], '<b>Asks:</b> a dead-straight drive up the valley, then a long wood for the green in two over the canal, or a lay-up. Hazard diagonal (the canal); surround bunkers.',
  `<p>The second leg is 63 m shorter: 490 yd (was 560), so a good drive leaves about 230 yd and the green is in reach. Par 5s 490 and 545 (they were 545 and 560). The Channel and the footbridge stay; "Short of the bend" becomes "Short of the green" (80 m out).</p>
   <p>The green is smaller, about 490 m² (was 608), deep and angled, a back tier 0.35 m up.</p>`);
holePage(9, 'The Great Window', ['dial: bunker count (none)', 'across a gulf'], '<b>Asks:</b> a high carry that stops, level, 150 yd over a hole in the floor. Hazard across; surround a drop back down into the amphitheatre.',
  `<p>The window lies in the floor of an amphitheatre 8.5 m deep; the Zenith tee on its near rim, Meridian and Horizon on steps down its near bank (each 3 m short of its lip), the green on the far rim level with the top tee. The 5th keeps the one drop par 3. The window is 44 m along the line (was 56); carries 91, 78 and 65 yd; Nadir from the south rim across the bowl's corner (110 yd). No bunker: the window and the bowl do the work.</p>`);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Halcyon Ring proposal</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`;
fs.writeFileSync(path.join(OUT, 'proposal.html'), html);
const pdf = path.join(OUT, 'halcyon-dials-and-heights-proposal.pdf');
execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/proposal.html`], { stdio: 'ignore' });
console.log(pdf, pages.length, 'pages');
