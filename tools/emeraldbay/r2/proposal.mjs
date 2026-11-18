// node proposal.mjs : the round 2 routing proposal (out/emerald-bay-routing-r2.pdf), white landscape pages: the map
// with the nine, the bay from the air, the tee views, the course card, the hole cards, what changed and the checks.
// Needs map.mjs + map.py and render.mjs first. Prints with Chrome (CHROME).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { HOLES, W, polyLen } from './bay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../out/r2');
execFileSync('python3', ['-c', `from PIL import Image; import glob; [Image.open(f).convert('RGB').save(f[:-4] + '.jpg', quality=86) for f in glob.glob('${OUT}/*.png')]`]);
const img = f => `file://${OUT}/${f}.jpg`;
const yd = h => Math.round(polyLen(h.line.map(p => W(...p))) / 0.9144);
const CARDS = {
  1: { faces: 'S', bend: 'nearly straight (left 8°)', form: 'fan', height: 'crest and run', dial: 'length: a reachable par 5 to open', decision: 'none (the gentle opener)',
    story: "From the stilt village at the mouth of the Maya island's cove, along a terrace of palms and salt grass inside the cove's west wall, the turquoise cove on your left, to a green on the white beach at its head. The wall on the right gives a wild drive back onto the terrace.", was: 'down a palm valley cut through island A' },
  2: { faces: 'NNW', bend: 'one shot', form: 'par 3', height: 'a drop, 58 m (the only one)', dial: 'a carry: all water from the ledge', decision: 'none', setPiece: 'island green',
    story: "A cliff stair from the 1st green climbs to a ledge 60 m up the cove's head wall. The shot drops out over the cove to a green on a little islet ringed with sand, the cove's mouth and the bay framed beyond. Plays about 150 yd.", was: 'off a headland 24 m up, to an islet out in the bay' },
  3: { faces: 'NE', bend: 'one shot', form: 'par 3', height: 'level, across the water', dial: 'the tide: a sand tongue short of the green at low water', decision: 'none',
    story: "From the islet across the cove to a green on the beach under its east wall, the cliff hung over it. Low tide: a tongue of sand runs out from the beach to meet you, land on it and run up. High tide: all carry.", was: 'the same idea, from the islet to island B' },
  4: { faces: 'N', bend: 'gentle right', form: 'scalloped', height: 'hillside bench, 8% across (bold)', dial: "one hazard's scale: three coves", decision: 'bite off what you dare',
    story: "Over the short crossing from the Maya island's east point to B, then along a shelf 11-16 m up B's west wall, leaning 8% into the wall, the bay below on the left. Three coves bite in from the bay. Carry them and it is reachable in two (the line you liked); skirt them and it is three shots with no water crossed.", was: 'kept, now along the wall of a whole island' },
  5: { faces: 'W', bend: 'left 32°', form: 'ribbon (a sandbar)', height: 'level', dial: 'width: 70 m at low tide, 40 m at high', decision: 'none',
    story: "Off B's north point along a bar of white sand and salt grass, sea both sides, to a green on C's east beach at the mouth of the gap, the Sentinel standing over it. High tide narrows the bar to 40 m with a strip of beach each side.", was: 'kept; it lands on a beach now, not in a valley' },
  6: { faces: 'N, then NW', bend: 'left 36°', form: 'hourglass (the neck is the gap)', height: 'half-pipe (the floor between the walls)', dial: 'width: a 60-70 m floor between walls 150 m tall', decision: 'bottle: drive into the neck, or lay back in its mouth',
    story: "From C's east beach through the gap between C and the Sentinel: a floor of sand and salt grass 60-70 m wide between sheer walls, like the longtail photo, out onto the beach on C's north side and a green under its north wall. Long hitters can drive into the neck; the rest lay back in the wide mouth and play through it.", was: 'the Saddle, up and over between two towers' },
  7: { faces: 'E', bend: 'right 57°', form: 'hook', height: 'level (a beach)', dial: 'length: drivable across the cove', decision: 'drivable par 4',
    story: "A beach hole round a cove in C's south shore, under a cliff that leans out overhead. Safe: an iron round the sand and a wedge. Bold: driver straight across the cove, about 285 yd to the green.", was: 'kept' },
  8: { faces: 'SSW', bend: 'one shot', form: 'par 3', height: 'uphill to a rock top', dial: 'green size: about 320 m² on a sea stack', decision: 'none', setPiece: 'postage stamp',
    story: 'A short iron from C\'s south point out to the flat-topped sea stack in the middle of the bay, a rock rim round its back to hold a long ball. Anything else is the sea.', was: 'kept' },
  9: { faces: 'W', bend: 'S (right 10°, left 22°)', form: 'broken', height: 'dip in front (the tidal channel)', dial: 'scale: through a sea cave 40 m high into a lagoon', decision: 'go or lay up',
    story: "A boat to the cay. Across the tidal flats, firm sand at low tide, then in through the sea cave in the Hong's east wall and out into the hidden lagoon: a ring of cliffs, a crescent of sand, the green and the beach shack. High tide: the flats are under the sea and it plays three shots along the spit to the right.", was: 'kept; the hollow island is whole but for its cave' },
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const total = HOLES.reduce((a, h) => a + yd(h), 0);
const cardRow = h => { const c = CARDS[h.n]; return `<div class="card"><h3>${h.n}. ${esc(h.name)} <span>par ${h.par} · ${yd(h)} yd · faces ${c.faces}</span></h3>
<p>${esc(c.story)}</p><table><tr><td>Shape</td><td>${esc(c.bend)}; ${esc(c.form)}</td></tr><tr><td>Height</td><td>${esc(c.height)}</td></tr><tr><td>Dial</td><td>${esc(c.dial)}</td></tr><tr><td>Decision</td><td>${esc(c.decision)}</td></tr>${c.setPiece ? `<tr><td>Set piece</td><td>${c.setPiece}</td></tr>` : ''}<tr><td>Was</td><td>${esc(c.was)}</td></tr></table></div>`; };
const view = (f, t, s) => `<figure><img src="${img(f)}"><figcaption><b>${t}</b> ${s}</figcaption></figure>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: 297mm 210mm; margin: 9mm; }
body { font: 10.5pt/1.35 'DejaVu Sans', sans-serif; color: #1c1c1c; margin: 0; background: #fff; }
.page { page-break-after: always; height: 190mm; overflow: hidden; }
h1 { font-size: 18pt; margin: 0 0 2mm; } h2 { font-size: 13pt; margin: 0 0 2mm; } h3 { font-size: 10.5pt; margin: 0 0 1mm; } h3 span { font-weight: normal; color: #555; }
.two { display: grid; grid-template-columns: 1.05fr 1fr; gap: 6mm; } .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3mm; } .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
img { width: 100%; display: block; } figure { margin: 0; } figcaption { font-size: 9pt; color: #444; margin-top: 1mm; }
ul { margin: 1mm 0 0 5mm; padding: 0; } li { margin-bottom: 1mm; }
.cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; } .card p { margin: 0 0 1.5mm; font-size: 9.5pt; }
table { border-collapse: collapse; font-size: 8.8pt; width: 100%; } td { border-top: 1px solid #ddd; padding: 0.6mm 1mm; vertical-align: top; } td:first-child { color: #666; width: 18mm; }
.sum td { font-size: 8.6pt; padding: 0.5mm 1.2mm; white-space: nowrap; } .sum td:last-child { white-space: normal; } .sum td:first-child { width: auto; color: #1c1c1c; }
.note { color: #555; font-size: 9pt; }
</style></head><body>
<div class="page"><h1>Emerald Bay · layout round 2: whole islands</h1><p class="note">17 November 2026 · after the island study. Proposal for approval: the routing, the skeleton and each hole's idea. The shapes are schematic (the plan book draws the real ones).</p>
<div class="two" style="grid-template-columns: 0.85fr 1fr"><div><img src="${img('map')}"><p class="note">Low tide. Red: each hole's line, tee number, yellow dot the pin. North up.</p></div>
<div><h2>What changed</h2><ul>
<li style="margin-top:0"><b>Every big island is whole</b>: sheer walls from the sea, jungle over them. The golf sits at their foot on beaches, terraces and shelves.</li>
<li><b>Through the rock, only two places</b>: the gap between C and the Sentinel (6) and the sea cave into the Hong (9).</li>
<li><b>Up top, only the Drop</b> (2), a par 3 off a ledge 60 m up.</li>
<li><b>The Maya island</b> (A, the study's horseshoe) holds the first three: into its cove along the terrace, off the ledge to an islet in the cove, then across to the beach under its east wall.</li>
<li><b>New: the Gap</b> (6) replaces the Saddle.</li>
<li><b>Kept</b>: the Coves (4), the Sandbar (5), the Overhang (7), the Stack (8) and the Hong (9).</li>
<li><b>Par order unchanged</b> (5 3 3 5 4 4 4 3 5, par 36), so the register entry stands. ${total.toLocaleString()} yd from the back, low tide (rough until the plan book).</li></ul>
<h2 style="margin-top:4mm">The nine</h2><table class="sum">${HOLES.map(h => `<tr><td>${h.n}. ${esc(h.name)}</td><td>par ${h.par}</td><td>${yd(h)} yd</td><td>${esc(CARDS[h.n].faces)}</td><td>${esc(CARDS[h.n].decision)}</td></tr>`).join('')}</table></div></div></div>
<div class="page"><h2>The bay, rendered in the game</h2><div class="grid2">${view('baynorth', 'From the north.', 'Back: the Maya island and its cove (1-3). Front: B with the shelf (4), the Sentinel and the gap (6), C (7). Right: the Hong (9).')}${view('bay', 'From the south-east.', 'The Maya island in front, B right, C and the Sentinel behind, the Hong left.')}</div>
<p class="note" style="margin-top:3mm">The cave shows as an open slot here; its roof is rock (as in round 1), drawn in the build. The walls up close, the crowns and the palms are blockout quality.</p></div>
<div class="page"><h2>From the tees</h2><div class="grid3">
${view('cove1', '1 The Village:', 'from the stilt village into the cove.')}${view('drop2', '2 The Drop:', 'off the ledge, the islet below, the bay beyond.')}${view('shelf4', '4 The Coves:', 'the shelf on B\'s west wall.')}
${view('gap6', '6 The Gap:', 'the floor between C and the Sentinel.')}${view('overhang7', '7 The Overhang:', 'round the cove, under the cliff.')}${view('hong9', '9 The Hong:', 'across the flats to the cave.')}</div></div>
<div class="page"><h2>Course card</h2><div class="two"><div><ul>
<li><b>Hook:</b> a warm bay of whole limestone islands, sheer and jungle-clad, white sand and clear turquoise water. Sand always plays and water is a stroke; the tide is high or low each round (3, 5, 9).</li>
<li><b>Skeleton:</b> par 36, 5 3 3 5 4 4 4 3 5 (as approved). Par 3s 135, 187 (plays about 150, 58 m down) and 206; par 4s 323, 416 and 442; par 5s 516, 560 and 583.</li>
<li><b>Decisions (four, four types):</b>
  <ul><li>bite off what you dare (4)</li><li>bottle (6)</li><li>drivable par 4 (7)</li><li>go or lay up (9)</li></ul></li>
<li><b>Set pieces:</b> island green (2), postage stamp (8).</li>
<li><b>Classics:</b> Cape (4), Short (8), Redan (3: the green falls away to the left, a bank kicks the ball on from the right).</li>
<li><b>Height forms:</b>
  <ul><li>bold: the drop (2), hillside bench (4)</li><li>moderate: crest and run (1), half-pipe (6), uphill (8), dip in front (9)</li><li>plain: the Sandbar (5) and the beach (7)</li></ul></li>
<li><b>Fairway forms:</b> fan, scalloped, ribbon, hourglass, hook and broken. No two alike.</li></ul></div><div><ul>
<li><b>Landmarks:</b>
  <ul><li>the stack: seen from 4, 5, 7 and 9, played at 8</li><li>the Sentinel and the gap: seen from 4, 5 and 8, played through at 6</li><li>the overhang: seen from 5 and 8, played under at 7</li><li>the Maya cove: holes 1-3</li></ul></li>
<li><b>Reveals:</b> the cove opening below you from the ledge (2), and the lagoon out of the cave (9).</li>
<li><b>Compass:</b> S, NNW, NE, N, W, N then NW, E, SSW, W: all four quarters.</li>
<li><b>Bends:</b> left 1, 5, 6; right 4, 7; the 9th an S.</li>
<li><b>Walks:</b>
  <ul><li>a cliff stair from 1 to the ledge on 2</li><li>a short crossing (a plank bridge) from A's east point to B for 4</li><li>a boat from the stack to the cay for 9, and from the lagoon round to the stilt village for 1</li></ul></li>
<li><b>Against the Musts</b> (the plan book measures them):
  <ul><li>no forced carry on a par 4 or 5: each cove, the cove on 7 and the channel on 9 has a way round</li><li>water on one side of a landing at most: the Sandbar keeps beach both sides at high tide</li></ul></li></ul></div></div></div>
<div class="page"><h2>Hole cards (1-6)</h2><div class="cards">${HOLES.slice(0, 6).map(cardRow).join('')}</div></div>
<div class="page"><h2>Hole cards (7-9) and what's next</h2><div class="cards">${HOLES.slice(6).map(cardRow).join('')}</div>
<h2 style="margin-top:5mm">Next, once you approve</h2><ul>
<li>Plan book round 2 on white pages: the islands' real outlines, the flats and shelves shaped, greens, tees and tips spots, both tides on 3, 5 and 9, the checks (gate, relief, alike, spread, tips) and views through the game's camera.</li>
<li>Then the build, with the cliff faces drawn properly (as on Cloudrest).</li></ul></div>
</body></html>`;
fs.writeFileSync(`${OUT}/proposal.html`, html);
const pdf = path.join(HERE, '../out/emerald-bay-routing-r2.pdf');
execFileSync(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/proposal.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, fs.statSync(pdf).size);
