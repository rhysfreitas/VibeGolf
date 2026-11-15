// node tools/labyrinth/book.mjs : round 0's proposal (the view, the walls, the doors) as a white-page A4 landscape
// PDF, out/labyrinth-round0.pdf, from out/views (views.mjs), out/figs (figs.py) and out/walls.json (walls.mjs).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const R = JSON.parse(fs.readFileSync(path.join(OUT, 'walls.json')));
const NOTES = JSON.parse(fs.readFileSync(path.join(OUT, 'views/notes.json')));
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64');

// a view with its callouts
function view(name, cap, w = '100%') {
  const n = (NOTES[name] || []).filter(q => q.at[0] > 0 && q.at[0] < 100 && q.at[1] > -1 && q.at[1] < 98).map(q => ({ ...q, at: [q.at[0], Math.max(1.5, q.at[1])] }));
  // labels stacked so they don't overlap: each at least 8% of the frame below the one above it
  let lastY = -99; const ys = n.map(q => q.at[1] + 1).sort((a, b) => a - b), place = new Map();
  for (const q of [...n].sort((a, b) => a.at[1] - b.at[1])) { const y = Math.max(q.at[1] + 1, lastY + 8); place.set(q, y); lastY = y; }
  const marks = n.map(q => {
    const left = q.at[0] < 62;
    return `<div class=dot style="left:${q.at[0]}%;top:${q.at[1]}%"></div><div class="lab ${left ? 'l' : 'r'}" style="${left ? 'left' : 'right'}:${left ? q.at[0] + 1.2 : 100 - q.at[0] + 1.2}%;top:${place.get(q)}%">${q.t}</div>`;
  }).join('');
  return `<figure style="width:${w}"><div class=shot><img src="${img('views/' + name + '.png')}">${marks}</div><figcaption>${cap}</figcaption></figure>`;
}
const pct = (t, k) => Math.round(100 * (t[k] || 0) / 60);
const E = R.elbow.rows, G = R.gate, C = R.corridor.scat;
const PLAYER = { long: '253 / 271', mid: '238 / 255', short: '201 / 219', shorter: '161 / 181' };

const page = (title, body, n) => `<section><header><h2>${title}</h2><span>The Labyrinth · round 0 · ${n}</span></header>${body}</section>`;
const P = [];
P.push(`<section class=cover><h1>The Labyrinth</h1><p class=sub>Round 0: the view from the camera, how the walls play, and doors that change. Before the plan book.</p>
<p>The layout is approved; this round checks the three things the brief flagged before any hole is drawn: what the game's fixed camera sees inside a corridor, how walls (and the 2nd's end wall) treat a ball, and how a hole with two versions is stored and shown. Every view is rendered through the game's own camera (3.2 m behind the ball, 1.55 m up, 50° tall, 19° above level to 31° below, 844×390) from a round-0 model of the maze round the first three holes, lit by the low evening sun (from the west-south-west, 10° up) with real shadows. Every number is flown with the game's physics.</p>
<table class=sum><tr><th>Question</th><th>What the views and the physics say</th><th>Recommended</th></tr>
<tr><td>1. The 2nd's walls</td><td>From any tee in a 62 m corridor the camera sees two walls and a slot of sky: a 60 m wall fills the top of the frame for 170 m, a 36 m wall for 90 m. Lowering them changes little from the tee; what reads is the lit end wall, the gold band on the left wall, and a break in the wall.</td><td><b>D:</b> 60 m walls, dressed (heights varied, broken tops), with two stretches of the left wall fallen to 14 m where the tower shows over them, from the tee and from the landing area</td></tr>
<tr><td>2. How walls take a ball</td><td>A drive 45 yd offline that would finish in deep ground in the open finishes at the wall's foot, 30 yd offline, instead. Bare stone at 45%: 73% at the foot, 8% back on the fairway, 29 yd shorter. Ivy at 80%: 88%, 4%, 36 yd. Neither a bumper lane nor a gutter.</td><td><b>Bare stone soaks 45%, ivy 80%</b>, and the 3 m at every wall's foot is rubble (a shot with a recovery, never trapped: the corridor floor is open in front of it)</td></tr>
<tr><td>3. The Elbow's corner</td><td>A heap of fallen wall at the corner didn't read from the tee. Instead: both of leg 1's side walls drop to 9-14 m from 80 m out, with a court of rough behind each, and each leg 2's inside wall is low for its first 50 m. The bold line flies both low walls: carry 212 yd from the back tee (the layout said 225).</td><td><b>Low broken walls with a court behind, at both inside corners</b>; an open door slides into its posts (open leaves stood right in the bold line); a ball over the shut leg's low wall is a stroke and a drop</td></tr>
<tr><td>4. Which door, when</td><td>Two versions of a hole share everything but the pin, the targets, the tips spot and which door is shut.</td><td><b>Picked at random each round, like the pins</b>, shown on the setup screen's card before you tee off, on the scorecard and on the corner map</td></tr></table>
<p class=small>Settled by the numbers, no question needed (say if you disagree): the 2nd's end wall leans 12° over a mown kick bank 5 m high (every approach hit 24-80 yd long finished on the green; without the bank none did); the 1st's gate lintel at 40 m never clips a normal second shot (the highest passes at 28 m).</p></section>`);

P.push(page('Where everything is (round 0)', `<img class=full src="${img('figs/plan13.png')}"><p class=small>The walls on and beside the first three lines of play, from the layout doc; the rest of the maze is a placeholder fill so the skyline reads (the plan book draws the whole wall plan). Version D's two fallen stretches are shown on the 2nd's left (north) wall.</p>`, 2));

P.push(page('The 2nd from the tee: four ways to build the corridor', `<div class=g2>
${view('h2_tee_A', '<b>A. As approved:</b> plain 60 m walls, 62 m apart.')}
${view('h2_tee_B', '<b>B. Dressed:</b> the same, heights varied 47-60 m, broken tops, ivy, notches high up for light.')}
${view('h2_tee_C', '<b>C. Lower:</b> side walls 30-36 m, the end wall still 60 m. From the tee it barely changes.')}
${view('h2_tee_D', '<b>D. Broken (recommended):</b> B with two stretches of the left wall fallen to 14 m; the tower stands over the first.')}
</div><p class=small>The camera never tips up, so the top 19° of the frame shows whatever is 31 m to the side: wall, until 170 m out. The lit end wall 450 m away is the target either way (the flag at 416 m is a few pixels; the aim line marks it in the game).</p>`, 3));

P.push(page('The 2nd from the landing area (250 m out)', `<div class=g2>
${view('h2_land_A', 'A. As approved.')}${view('h2_land_B', 'B. Dressed.')}
${view('h2_land_C', 'C. Lower.')}${view('h2_land_D', 'D. Broken: the tower again, over the second fallen stretch.')}
</div><p class=small>From the landing area the low sun lights the top of the left wall in a band that falls toward the green, and the end wall's upper left. In D the fallen stretches let that light onto the floor further down, and a hooked drive can fly a 14 m stretch into the next cell (playable ground: a recovery back over it).</p>`, 4));

P.push(page('The 2nd\'s end wall: banking a long approach', `<div class=row>${view('h2_long_D', 'A long approach (200 yd) in version D: the end wall leans in over the back of the green.', '46%')}
<div class=txt style="width:52%"><p><b>What the physics says.</b> A wall on its own doesn't help: a ball that hits it, upright or leaning, soaking or not, drops at its foot 30 m past the pin. The help comes from the ground at its foot: a mown bank from the green's back edge up to the wall, steep enough (over 22%) that a ball can't stop on it. With a bank of 5 m (29%), every approach hit 24 to 80 yd long, from a 9 iron to a 3 wood, rolled back onto the green; at 4 m (23%) a ball landing on the bank's lower half held there. The 12° lean keeps a ball that hits the wall low from sitting in the corner at its foot (an upright wall left 1 in 5 of the 40-yd-long ones there).</p>
<p><b>Proposed:</b> the end wall leans 12°, bare dressed stone; a 5 m kick bank, mown, from the back of the green to its foot. A ball hit 16 yd long stops on the back collar (a putt). It's the course's helper: the brave long approach is safe, which is what a wall set piece is for.</p></div></div>
<img class=full src="${img('figs/bank.png')}">`, 5));

P.push(page('The 3rd, the Elbow: from the tee and from the corner', `<div class=g2>
${view('h3_tee_B', 'Tee, the round the left door is open.')}${view('h3_tee_R', 'Tee, the round the right door is open.')}
${view('h3_corner_B', 'From the corner (a drive to 200 m), down the open left leg.')}${view('h3_corner_R', 'From the corner, down the open right leg.')}
</div><p class=small>From the tee the corridor walls step down to 9-14 m 80 m out, the gate towers stand above them at the corner, and the outer corner wall closes the view. The open door has slid into its posts; the shut one is a slab across its mouth, edge-on from the tee, plain from the corner. The tower is behind you on this hole; the 2nd's end wall is the skyline to the north.</p>`, 6));

P.push(page('The Elbow\'s carry', `<div class=row><img src="${img('figs/elbow.png')}" style="width:50%">
<div class=txt style="width:48%"><table class=t><tr><th>Tee set (round 0 spot)</th><th>Player carry / total yd</th><th>Carry to clear</th><th>Straight drive over the far wall</th><th>60 drives: made leg 2 · court · leg 1</th></tr>
${E.map(r => `<tr><td>${r.set} (+${r.from} m)</td><td>${PLAYER[r.player]}</td><td>${r.need} yd</td><td>${r.crest ? r.crest.h + ' m up' : '-'}</td><td>${pct(r.tally, 'leg 2 (bold line made)')}% · ${pct(r.tally, 'the court (behind the low walls)')}% · ${pct(r.tally, 'leg 1 (the tee side)')}%</td></tr>`).join('')}</table>
<p><b>The geometry.</b> The layout's heap of fallen wall at the corner didn't read from the tee (it sat behind the standing wall). Now both of leg 1's side walls drop to 9-14 m from 80 m out, and each leg 2's inside wall is low for its first 50 m; behind them is a court of rough about 100 m square. The bold line flies the near low wall about 90 m out and the far one about 200 m out, into leg 2 about 60 yd from the green. Every tee set's player clears it with a straight drive; the misses finish in the court (a shot lost: a recovery back over a 12 m wall) or back in leg 1. Nobody's drive finished in the shut leg here; one hooked over its low wall would be a stroke and a drop.</p>
<p><b>The numbers to set in the plan book.</b> From round 0's back tee (it sits 10 m in front of the 2nd's corridor wall) the carry is 212 yd, not the layout's 225; moving the far low wall's crest 12 m further from the tee makes it 225. The forward tees' spots and carries are placeholders until the plan book sets them; the decision check (bold line pays for one player, not the other) runs then.</p></div></div>`, 7));

P.push(page('The 1st: the gate', `<div class=g2>${view('h1_tee_B', 'Tee: the inner gate at 290 yd across the forecourt, its banks either side.')}${view('h1_land_B', 'From the drive\'s landing area: through the gate into the first court.')}</div>
<div class=row><div class=txt style="width:56%"><p>The gate reads from the tee without help: two gate towers (50 m) with a lintel at 40 m over a 36 m opening in a 28 m wall, the doors standing open into the first court. The tower doesn't show from this hole's tee in round 0: the forecourt's walls and the fill hide it (the layout has it glimpsed from 1: the plan book opens a sightline over the gate wall, which is 6.5° high from the tee against the tower top's 6.8°).</p>
<p><b>The lintel never clips a normal shot.</b> A second shot passes through the gate at the height in the table; the highest is a 7 iron or a hybrid from 100-140 m short, about 28 m up. Nothing overhead is near a tee (the gate is 265 m out).</p></div>
<table class=t style="width:42%"><tr><th>Metres short of the gate</th><th>3 wood</th><th>Hybrid</th><th>5 iron</th><th>7 iron</th></tr>
${G.map(r => `<tr><td>${r.short}</td>${['3 wood', 'hybrid', '5 iron', '7 iron'].map(c => `<td>${r[c].h == null ? 'down' : r[c].h + ' m'}</td>`).join('')}</tr>`).join('')}</table></div>`, 8));

P.push(page('How walls take a ball', `<img class=full src="${img('figs/corridor.png')}">
<div class=row><div class=txt style="width:100%"><p>The rule written for caves and facades ("a wall must not keep a shank in play") meets a course where walls are everywhere. On the 2nd, 2,000 drives with a wider scatter than the tool's (a bad day) put 268 into a wall. With every ball coming back (soak 0) the corridor helps a little: a 45 yd miss finishes 30 yd offline, only 18 yd shorter, 12% of them on the fairway. With bare stone soaking 45% (as The Reclaim's facades and Cloudrest's cliffs) 73% drop at the foot and the miss costs 29 yd; with ivy at 80%, 88% and 36 yd. The graded-miss table asks a 35-55 yd miss for "a shot, with a recovery": a ball at the foot of a wall in rubble is that. From the foot there is always a shot on (the corridor floor is open in front of it); a ball on a wall's top drops to its foot on the side it came from, as a ball on a roof does on The Reclaim.</p>
<p><b>Proposed:</b> bare stone ${'45%'}, ivy 80% (the ivy's share of each wall is an art-pass choice, so it can be tuned hole by hole), the 3 m at every wall's foot rubble. The 2nd's end wall is bare dressed stone and doesn't need to soak: its bank does the work.</p></div></div>`, 9));

P.push(page('Doors that change', `<div class=row><img src="${img('figs/doors.png')}" style="width:52%">
<div class=txt style="width:46%"><p><b>How it's stored.</b> One hole, built once with both second legs, both greens and both doors in it. A list of versions overrides only what differs:</p>
<pre>versions: [
  { id: 'left',  name: 'Left',  yards, pin, pins, targets, tips, shut: 'west' },
  { id: 'right', name: 'Right', yards, pin, pins, targets, tips, shut: 'east' },
]</pre>
<p>The shut door's slab is a rock that exists only in the other version, and the shut leg beyond it plays as a penalty area (a stroke and a drop, like water). The Two Doors (7th) is the same with two greens about 80° apart.</p>
<p><b>How a round picks.</b> At random when the round starts, as pins are, saved with the round (a resumed round keeps its doors).</p>
<p><b>How you see it.</b> The setup screen's card lists the two holes' doors before you tee off; the scorecard row reads "3 The Elbow · left"; the corner map draws the open leg and greys the shut one, its door a bar across.</p>
<p><b>Tools and tests.</b> Every check expands a hole into its versions and runs each: the gate, pins, targets on fairway, tips spots, nothing overhead, the tee views. Two holes only, as the brief says.</p></div></div>`, 10));

const css = `@page { size: A4 landscape; margin: 0 } body { margin: 0; font: 10.5px/1.42 'DejaVu Sans', Arial, sans-serif; color: #222; background: #fff }
section { width: 297mm; height: 210mm; box-sizing: border-box; padding: 9mm 11mm; page-break-after: always; overflow: hidden; position: relative }
header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #bbb; margin-bottom: 4mm } header h2 { font-size: 15px; margin: 0 } header span { color: #888; font-size: 9px }
.cover h1 { font-size: 30px; margin: 4mm 0 1mm } .cover .sub { font-size: 14px; color: #555; margin: 0 0 5mm }
table { border-collapse: collapse } .sum { width: 100%; margin: 4mm 0 } .sum td, .sum th, .t td, .t th { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; text-align: left } .sum th, .t th { background: #f1efe9 }
.sum td:first-child { width: 17%; font-weight: bold } .sum td:last-child { width: 33% } .t { font-size: 9.5px; margin-bottom: 3mm }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 4mm } figure { margin: 0 } figcaption { font-size: 9.5px; margin-top: 1mm }
.shot { position: relative } .shot img { width: 100%; display: block; border: 1px solid #999 }
.dot { position: absolute; width: 7px; height: 7px; margin: -4px 0 0 -4px; border-radius: 50%; background: #e23b2e; border: 1.5px solid #fff }
.lab { position: absolute; background: rgba(255,255,255,.9); border: 1px solid #e23b2e; padding: 1px 4px; font-size: 8.6px; max-width: 42%; line-height: 1.25 }
.row { display: flex; gap: 4mm; align-items: flex-start; margin-top: 2mm } .txt p { margin: 0 0 2.2mm } .full { width: 100%; display: block; margin: 1mm 0 }
.small { font-size: 9.5px; color: #444 } pre { background: #f6f4ef; padding: 5px 7px; font-size: 9px; margin: 0 0 2.2mm }`;
const html = `<!doctype html><html><head><meta charset=utf-8><style>${css}</style></head><body>${P.join('')}</body></html>`;
fs.writeFileSync(path.join(OUT, 'labyrinth-round0.html'), html);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const pg = await b.newPage(); await pg.setContent(html, { waitUntil: 'load' });
await pg.pdf({ path: path.join(OUT, 'labyrinth-round0.pdf'), format: 'A4', landscape: true, printBackground: true });
// a check that nothing ran off a page
const over = await pg.evaluate(() => [...document.querySelectorAll('section')].map((s, i) => s.scrollHeight > s.clientHeight + 2 ? i + 1 : 0).filter(Boolean));
console.log('pages', P.length, 'overflow', over);
await b.close();
