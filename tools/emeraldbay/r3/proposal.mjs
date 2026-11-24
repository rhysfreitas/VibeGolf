// node proposal.mjs : the round 3 routing proposal (out/emerald-bay-routing-r3.pdf), white landscape pages: the map
// with the nine, the bay from the air, the tee views, the course card, the hole cards, what changed and the checks.
// Needs map.mjs + map.py and render.mjs first. Prints with Chrome (CHROME).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { HOLES, W, polyLen } from './bay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../out/r3');
execFileSync('python3', ['-c', `from PIL import Image; import glob; [(lambda im: (im.crop((0, 125, im.width, im.height)) if f.endswith(('/bay.png', '/baynorth.png')) else im).save(f[:-4] + '.jpg', quality=86))(Image.open(f).convert('RGB')) for f in glob.glob('${OUT}/*.png')]`]);
const img = f => `file://${OUT}/${f}.jpg`;
const yd = h => Math.round(polyLen(h.line.map(p => W(...p))) / 0.9144);
const CARDS = {
  1: { faces: 'N', bend: 'right 32°', form: 'fan', height: 'crest and run', dial: 'length: a reachable par 5 to open', decision: 'none (the gentle opener)',
    story: "From the stilt village on the south tip of the Maya island's west arm, up its outer west shore: a terrace of salt grass and palms at the foot of the wall, the beach and the open channel on your left with the Hong across the water. The wall on the right gives a wild drive back onto the terrace.", was: 'inside the cove, along its west terrace' },
  2: { faces: 'WSW', bend: 'one shot', form: 'par 3', height: 'a drop, 56 m (the only hole up top)', dial: 'a carry: all water from the ledge', decision: 'none', setPiece: 'island green',
    story: "A cliff stair climbs to a ledge 60 m up the cove's east wall. The green sits alone on a sand islet in the middle of the cove, as in the island study: the head beach behind it, the cove's mouth and the open bay to the left. Plays about 158 yd.", was: 'off the head wall; the 1st and 3rd shared the cove with it' },
  3: { faces: 'ESE', bend: 'one shot', form: 'par 3', height: 'level, across the water', dial: 'the tide: a sand tongue in front at low water', decision: 'none',
    story: "From the beach on the east arm's south tip across the mouth of the channel between the Maya island and B, to a green on a small islet. Low tide: a tongue of sand runs out toward you; land on it and run up. High tide: all carry.", was: 'across the inside of the cove' },
  4: { faces: 'N', bend: 'gentle left (two turns, 48°)', form: 'scalloped', height: 'hillside bench, 8% into the wall (bold)', dial: "one hazard's scale: three coves", decision: 'bite off what you dare',
    story: "On B's outer east side: a shelf 11-16 m up the wall, leaning into it, the open sea below on the right. Coves bite in from the sea. Carry them and it is reachable in two; skirt them and it is three shots with no water crossed.", was: "on B's west wall, facing the Maya island" },
  5: { faces: 'NW', bend: 'right 16°', form: 'ribbon (a sandbar)', height: 'level', dial: 'width: 70 m at low tide, 40 m at high', decision: 'none',
    story: "Off B's north point along a bar of white sand and salt grass across the open channel to C, sea on both sides, to a green on the beach at the gap's mouth with the Sentinel over it. High tide narrows the bar to 40 m with a strip of beach each side.", was: 'kept, the channel it crosses about twice as wide' },
  6: { faces: 'N, then NW', bend: 'left 50°', form: 'hourglass (the neck is the gap)', height: 'half-pipe (the floor between the walls)', dial: 'width: a 60-70 m floor between walls 150 m tall', decision: 'bottle: drive into the neck, or lay back in its mouth',
    story: "From the gap's mouth through the slot between C and the Sentinel, out onto C's north beach facing the open sea, the green turned left along it.", was: 'kept' },
  7: { faces: 'W', bend: 'right 55°', form: 'hook', height: 'level (a beach)', dial: 'length: drivable across the cove (268 yd straight)', decision: 'drivable par 4',
    story: "Along C's outer north shore round a cove under a cliff that leans out overhead, the open sea on the right. Safe: an iron round the cove's beach and a wedge. Bold: driver across the cove's mouth.", was: "on C's inner south shore" },
  8: { faces: 'SW', bend: 'one shot', form: 'par 3', height: 'uphill to a rock top', dial: 'green size: about 320 m² on a sea stack', decision: 'none', setPiece: 'postage stamp',
    story: "From C's west point out to the flat-topped stack standing alone in the open middle of the bay, a rock rim round its back. Anything else is the sea.", was: 'kept; the stack now stands in open water' },
  9: { faces: 'W', bend: 'S (left 12°, then 18°)', form: 'broken', height: 'dip in front (the tidal channel)', dial: 'scale: through a sea cave 40 m high into a lagoon', decision: 'go or lay up',
    story: "A boat to the cay. Across the tidal flats (firm sand at low tide) to the Hong's east wall, in through the sea cave and out into the hidden lagoon. High tide: the flats are under the sea and it plays three shots along the spit to the right.", was: 'kept; the Hong stands off on its own now' },
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
<div class="page"><h1>Emerald Bay · layout round 3: water between the islands</h1><p class="note">24 November 2026 · after your note on round 2 ("everything is a bit tight and the holes are all on the inside of their islands"). Proposal for approval: the routing, the skeleton and each hole's idea. The shapes are schematic (the plan book draws the real ones).</p>
<div class="two" style="grid-template-columns: 0.95fr 1fr"><div><img src="${img('map')}"><p class="note">Low tide. Red: each hole's line, tee number, yellow dot the pin. North up; about 2.4 km across.</p></div>
<div><h2>What changed from round 2</h2><ul>
<li style="margin-top:0"><b>The islands spread out</b> over about 1.8 by 1.6 km (round 2: 1.2 by 1.4), with open channels between every pair: about 290 m between the Maya island and B, 290 m from B to C (the Sandbar crosses it), 180 m to the Hong, and the open middle of the bay with the stack and the cay in it.</li>
<li><b>The golf is on the outer shores.</b> 1 up the Maya island's west side, 4 on B's east side, 7 on C's north side: each with the open sea beside it.</li>
<li><b>Only the Drop's green is inside the horseshoe</b>, alone on an islet in the cove, as in the island study. The cove's head beach is left as beach.</li>
<li><b>The 3rd crosses water</b> from the east arm's tip to an islet in the channel's mouth.</li>
<li><b>Par order unchanged</b> (5 3 3 5 4 4 4 3 5, par 36). I tried 5 3 4 5 3 4 4 3 5, but it matches Halcyon Ring on six holes. ${total.toLocaleString()} yd from the back at low tide (rough until the plan book).</li></ul>
<h2 style="margin-top:3mm">The nine</h2><table class="sum">${HOLES.map(h => `<tr><td>${h.n}. ${esc(h.name)}</td><td>par ${h.par}</td><td>${yd(h)} yd</td><td>${esc(CARDS[h.n].faces)}</td><td>${esc(CARDS[h.n].decision)}</td></tr>`).join('')}</table></div></div></div>
<div class="page"><h2>The bay, rendered in the game</h2><div class="grid2">${view('baynorth', 'From the north.', 'Front: C with the Sentinel (6, 7) and the Hong (9), the stack between. Back: the Maya island (1-3) and B (4).')}${view('bay', 'From the south-east.', 'B in front (4, 5), the Maya island left (1-3), C and the Sentinel behind, the Hong far left.')}</div>
<p class="note" style="margin-top:3mm">The cave shows as an open slot here; its roof is rock (as in round 1), drawn in the build. The walls up close, the crowns and the palms are blockout quality.</p></div>
<div class="page"><h2>From the tees (1-6)</h2><div class="grid3">
${view('cove1', '1 The Village:', 'up the outer west shore.')}${view('drop2', '2 The Drop:', 'off the ledge to the islet in the cove.')}${view('tongue3', '3 The Tongue:', 'across the channel\'s mouth.')}
${view('shelf4', '4 The Coves:', 'up the shelf on B\'s outer east wall.')}${view('sandbar5', '5 The Sandbar:', 'across the channel to C.')}${view('gap6', '6 The Gap:', 'between C and the Sentinel.')}</div></div>
<div class="page"><h2>From the tees (7-9)</h2><div class="grid3">
${view('overhang7', '7 The Overhang:', 'round the cove on C\'s north shore.')}${view('stack8', '8 The Stack:', 'out to the stack in the open bay.')}${view('hong9', '9 The Hong:', 'across the flats to the cave.')}</div>
<p class="note" style="margin-top:4mm">The cave shows as an open slot here; its roof is rock (as in round 1), drawn in the build. The walls close up, the crowns and the palms are blockout quality.</p></div>
<div class="page"><h2>Course card</h2><div class="two"><div><ul>
<li><b>Hook:</b> a warm bay of whole limestone islands with open water between them: sheer and jungle-clad, white sand and clear turquoise water. Sand always plays and water is a stroke; the tide is high or low each round (3, 5, 9).</li>
<li><b>Skeleton:</b> par 36, 5 3 3 5 4 4 4 3 5 (as approved). Par 3s 126, 185 (plays about 158, 56 m down) and 197; par 4s 302, 402 and 414; par 5s 523, 556 and 583.</li>
<li><b>Decisions (four, four types):</b>
  <ul><li>bite off what you dare (4)</li><li>bottle (6)</li><li>drivable par 4 (7)</li><li>go or lay up (9)</li></ul></li>
<li><b>Set pieces:</b> island green (2), postage stamp (8).</li>
<li><b>Classics:</b> Cape (4), Short (8), Redan (3: the green falls away to the left, a bank kicks the ball on from the right).</li>
<li><b>Height forms:</b>
  <ul><li>bold: the drop (2), hillside bench (4)</li><li>moderate: crest and run (1), half-pipe (6), uphill (8), dip in front (9)</li><li>plain: the Sandbar (5) and the beach (7)</li></ul></li>
<li><b>Fairway forms:</b> fan, scalloped, ribbon, hourglass, hook and broken. No two alike.</li></ul></div><div><ul>
<li><b>Landmarks:</b>
  <ul><li>the stack, alone in the bay: seen from 5, 7 and 9, played at 8</li><li>the Sentinel and the gap: seen from 4 and 5, played through at 6</li><li>the Maya island's cove: seen from the boats, played into at 2</li><li>the Hong: across the water from 1, played into at 9</li></ul></li>
<li><b>Reveals:</b> the cove opening below you from the ledge (2), and the lagoon out of the cave (9).</li>
<li><b>Compass:</b> N, WSW, ESE, N, NW, N then NW, W, SW, W: all four quarters.</li>
<li><b>Bends:</b> right 1, 5, 7; left 4, 6; the 9th an S.</li>
<li><b>Getting round:</b>
  <ul><li>a cliff path over the head of the island from 1 to the ledge on 2</li><li>longtail boats: out of the cove to the 3rd tee, from the Tongue islet to B, from the stack to the cay, and from the lagoon back to the stilt village</li><li>on foot round C's beaches (5 to 8)</li></ul></li>
<li><b>Against the Musts</b> (the plan book measures them):
  <ul><li>no forced carry on a par 4 or 5: each cove on 4, the cove on 7 and the channel on 9 have a way round</li><li>water on one side of a landing at most: the Sandbar keeps beach both sides at high tide</li></ul></li></ul></div></div></div>
<div class="page"><h2>Hole cards (1-6)</h2><div class="cards">${HOLES.slice(0, 6).map(cardRow).join('')}</div></div>
<div class="page"><h2>Hole cards (7-9) and what's next</h2><div class="cards">${HOLES.slice(6).map(cardRow).join('')}</div>
<h2 style="margin-top:5mm">Next, once you approve</h2><ul>
<li>Plan book round 2 on white pages: the islands' real outlines, the flats and shelves shaped, greens, tees and tips spots, both tides on 3, 5 and 9, the checks (gate, relief, alike, spread, tips) and views through the game's camera.</li>
<li>Then the build, with the cliff faces drawn properly (as on Cloudrest).</li></ul></div>
</body></html>`;
fs.writeFileSync(`${OUT}/proposal.html`, html);
const pdf = path.join(HERE, '../out/emerald-bay-routing-r3.pdf');
execFileSync(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, `file://${OUT}/proposal.html`], { stdio: 'ignore', timeout: 300000 });
console.log(pdf, fs.statSync(pdf).size);
