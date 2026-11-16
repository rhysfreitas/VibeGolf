// node tools/emeraldbay/book.mjs : round 0's proposal (the tide and the surfaces) as a white-page A4 landscape PDF,
// out/emerald-bay-round0.pdf, from out/figs (figs.py) and out/checks.json (checks.mjs).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
const C = JSON.parse(fs.readFileSync(path.join(OUT, 'checks.json')));
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'figs', f)).toString('base64');
const page = (title, body, n) => `<section><header><h2>${title}</h2><span>Emerald Bay · round 0 · the tide and the surfaces · ${n}</span></header>${body}</section>`;
const SETS = ['marlin', 'manta', 'turtle', 'clownfish'], NAME = { marlin: 'Marlin', manta: 'Manta', turtle: 'Turtle', clownfish: 'Clownfish', shark: 'Shark (tips)' };
const P = [];
const h3 = C.h3.res, h5 = C.h5.res, h9 = C.h9.res, L = C.lies;

P.push(`<section class=cover><header><h2></h2><span>16 November 2026</span></header>
<h1>Emerald Bay</h1><p class=sub>Round 0: the tide and the surfaces, before the plan book</p>
<p>The layout is approved. Before any hole is drawn, this round settles the course's two logics as numbers: <b>the tide</b> (what is ground at low water and sea at high, how a round picks it and how you see it) and <b>sand, rock and water</b> (what each lie costs). The three tide holes are drawn at both tides from one ground, with the sea at 0 or 2.4 m. The islands elsewhere are still schematic: the plan book draws them.</p>
<table class=sum><tr><th>Question</th><th>What the numbers say</th><th>Proposed</th></tr>
<tr><td>1. The tide</td><td>One ground, two sea levels: low water 0, high water 2.4 m (a Krabi spring range is 2-3 m). Sand between the two is firm wet sand when it is dry. Holes 3, 5 and 9 change; the stack (8) keeps the sea all round at both tides.</td><td>A <b>random roll each round, like the pins</b>, shown on the setup card where you can change it, on the scorecard and on the corner map</td></tr>
<tr><td>2. Sand</td><td>A 7 iron: 173 yd off fairway, 167 off wet sand (−3%, runs like fairway), 160 off dry sand (−8%), 139 out of a bunker (−20%)</td><td><b>Three sands</b>: dry beach plays as firm sand (the Buried Kingdom's), wet sand as the links courses' beach, bunkers soft</td></tr>
<tr><td>3. The Sandbar at high water</td><td>As the layout drew it (40 m of grass and 10 m of beach each side) the sea is 33 yd away on both sides: that fails the penalty-ground Must</td><td>An <b>uneven bar</b>: narrow on the open-sea side (water 42 yd), a band of salt-grass rough and dry sand on the bay side (water 62 yd)</td></tr>
<tr><td>4. Water</td><td>Clear shallows over sand are on screen all the time</td><td><b>Water is water</b>: a stroke and a drop beside where it went in, however shallow</td></tr>
<tr><td>Cliffs (stated)</td><td>As Cloudrest: soak 0.45, so about three balls in four that fly into rock drop at its foot</td><td>Shore rock and fallen boulders at a cliff's foot a rough lie ("Rock", −14%), never a penalty</td></tr></table>
<p class=small><b>Changed from the layout doc to make the tide work</b> (lines, pins and yardages unchanged): the 9th's high-water spit runs on the right as the layout says, but hugs the line for its first 150 m so the stack keeps open water round it; the hollow island is drawn west of where the layout's sketch had it (centre (40, 760), 350 × 380 m, the lagoon 200 × 150 m), so the cave runs 424-505 yd along the line and the green sits on the lagoon's beach 40 yd past it (in the sketch the cave was at the corner, where drives land); the 3rd's forward tee stands on a rock in the shallows beside the tongue's tip.</p>
</section>`);

P.push(page('The bay at both tides', `<img class=full src="${img('bay.png')}">
<div class=row><div class=txt style="width:100%"><p>The ground is the same at both tides; only the sea moves (2.4 m). <b>At low water</b> the tongue reaches out from the 3rd green, the Sandbar carries wide aprons of wet sand, and the flats between the 9th tee and the hollow island are dry: firm, rippled, crossed by the creek. <b>At high water</b> the tongue and the flats are under 0.2-1.9 m of clear water, the Sandbar is a 42 m strip with dry sand either side, and the 9th plays along the spit. Every other hole has the same beaches at both tides, only wider at low water. The dotted line in each map is the other tide's waterline.</p></div></div>`, 2));

const t3 = tide => SETS.concat('shark').map(id => `<tr><td>${NAME[id]}</td><td>${h3.low[id].toPin}</td><td>${h3.low[id].allCarry}</td><td>${h3.high[id].allCarry}</td></tr>`).join('');
P.push(page('3 The Tongue', `<img class=plan src="${img('h3.png')}"><img class=prof src="${img('h3prof.png')}">
<div class=row><div class=txt style="width:58%"><p><b>Low water:</b> the back tee carries about 100 yd of water onto the tongue, which runs up to the green; a ball landing on it rolls on as it would on fairway. <b>High water:</b> the tongue is under the sea and the shot is all carry, 192 yd from the back. The green sits on the beach at 5 m under the cliff that gives a long ball back.</p>
<p><b>The forward tee</b> (Clownfish) is on a rock in the shallows beside the tongue's tip: 87 yd of carry at high water, inside the 90 yd the 60% rule allows the forward set. Turtle stays on the islet: a par 3's back tees may be all carry.</p></div>
<table class=t style="width:40%"><tr><th>Tee</th><th>To the pin, yd</th><th>Carry at low water</th><th>Carry at high water</th></tr>${t3()}</table></div>`, 3));

const t5 = SETS.map(id => `<tr><td>${NAME[id]}</td><td>${h5.low[id].drive}</td><td>${h5.low[id].fairway} m</td><td>${h5.low[id].waterR} / ${h5.low[id].waterL}</td><td>${h5.high[id].waterR} / ${h5.high[id].waterL}</td></tr>`).join('');
P.push(page('5 The Sandbar', `<img class=plan src="${img('h5.png')}"><img class=prof src="${img('h5sec.png')}">
<div class=row><div class=txt style="width:56%"><p><b>The finding.</b> With 40 m of grass and 10 m of beach each side at high water (the layout's numbers), the sea is 33 yd from the line on both sides where drives land: a medium miss either way is a penalty, which the Must forbids. <b>Proposed:</b> the bar's grass stays 42 m at both tides (the nine's one tight hole: soft ground for about 20 m either side, as the dial rule asks); on the open-sea side (north) 19 m of dry sand, then wet sand that floods; on the bay side 19 m of salt-grass rough and 18 m of dry sand before the wet. At low water the wet sand adds about 28 m of ground that runs like fairway on each side.</p></div>
<table class=t style="width:42%"><tr><th>Tee</th><th>Drive, yd</th><th>Fairway</th><th>Yd to the sea, north / south, low water</th><th>High water</th></tr>${t5}</table></div>`, 4));

const s9 = tide => SETS.map(id => { const r = h9[tide].sets[id]; return `<td>${tide === 'low' ? 'flats, ' : `${r.grass} m spit, `}${r.waterR} / ${r.waterL}</td>`; });
const t9 = SETS.map((id, i) => `<tr><td>${NAME[id]}</td>${s9('low')[i]}${s9('high')[i]}</tr>`).join('');
const sh = C.h9.shots;
P.push(page('9 The Hong', `<img class=plan src="${img('h9.png')}"><img class=prof src="${img('h9prof.png')}">
<div class=row><div class=txt style="width:58%"><p><b>Low water</b> (${h9.low.routeYd} yd): drive across the flats (firm wet sand, nowhere to lose a ball), then <b>go or lay up</b>. The creek crosses the line on a diagonal at ${C.h9.creek.map(s => Math.round(s / 0.9144)).join('-')} yd; the cave runs ${C.h9.caveYd.join('-')} yd. From a 260 m drive the green is ${C.h9.goFrom['260']} yd through the cave; the lay-up carries the creek (${C.h9.layup.carry} yd) to the beach at the cave mouth and leaves ${C.h9.layup.left} yd through it. <b>High water</b> (${h9.high.routeYd} yd, three shots): the flats are under the sea and the hole plays along the spit on the right, which has water on its left only.</p>
<p><b>The roof.</b> The go shot and the lay-up's third pass ${Math.min(...sh.map(q => q.clearance))} m or more under the 43 m roof; no tee is under it.</p></div>
<table class=t style="width:40%"><tr><th>Tee</th><th>Low water: where drives land, yd to the sea right / left</th><th>High water</th></tr>${t9}</table></div>`, 5));

const lieRow = r => `<tr><td>${r.club}</td><td>${r.fairway}</td><td>${r.beach}</td><td>${r.waste}</td><td>${r.rough}</td><td>${r.sand}</td><td>${r.desert}</td></tr>`;
P.push(page('Sand, rock and water', `<div class=row><div class=txt style="width:50%">
<p><b>Carry by lie</b> (yards, a tour player's swing through the game's flight model and its lie rules, today's numbers):</p>
<table class=t style="width:100%"><tr><th>Club</th><th>Fairway</th><th>Wet sand</th><th>Dry sand</th><th>Rough</th><th>Bunker</th><th>Rock</th></tr>${L.rows.map(lieRow).join('')}</table>
<p><b>Run-out of a drive landing on it</b> (yd): fairway ${L.run.fairway.Driver}, wet sand ${L.run.beach.Driver}, dry sand ${L.run.waste.Driver}, bunker ${L.run.sand.Driver}, rough ${L.run.rough.Driver}. A 7 iron: ${L.run.fairway['7 iron']}, ${L.run.beach['7 iron']}, ${L.run.waste['7 iron']}, ${L.run.sand['7 iron']}, ${L.run.rough['7 iron']}.</p>
<p><b>Proposed: three sands, all existing surfaces</b> (no physics change):</p>
<ul><li><b>Dry beach</b> above high water: firm sand, the game's 'waste' (lie "Sand", −8%, the ball stops). The bail-out everywhere: it costs a lie, never a stroke, and you always find the ball.</li>
<li><b>Wet sand</b> between the tides: 'beach' from Wrecker's Reach (lie "Wet sand", −3%, runs like fairway). It only exists at low water, so low tide plays wider and kinder; high tide tighter.</li>
<li><b>Bunkers</b> by the greens and in the fairways: soft sand, 'sand' (−20%).</li></ul></div>
<div class=txt style="width:48%">
<p><b>Rock</b> (stated in the brief): cliffs are part of the ground and soak a ball at 0.45, as on Cloudrest, where 73% of balls that hit a cliff dropped at its foot and the rest finished within about 10 yd. The foot of every cliff is shore rock and fallen boulders: a rough lie ("Rock", the game's 'desert': −14% and sometimes a bad lie), never a penalty. The cliffs this matters on: behind the 3rd green, the bank along the 4th, the 7th's overhang, the hollow island's walls on the 9th.</p>
<p><b>Water</b>: everything under the sea at that tide is water: a stroke and a drop beside where it went in, as on every course. The other choice is a playable "Shallows" lie where the water is under about 30 cm (a splash shot, like a bunker). It adds a lie that changes with the tide and a new surface, and a phone can't show 30 cm from 20 cm; I'd keep water as water.</p>
<p><b>Drawing the water</b> (for the blockout): one sheet at the round's sea level, turquoise over sand, emerald in the lagoon, darker over reef and in a cliff's shade, coloured by the depth under it from the ground the game already has, so it costs one draw.</p></div></div>`, 6));

P.push(page('How the tide is stored, picked and shown', `<div class=row><div class=txt style="width:52%">
<p><b>One mechanism with the Labyrinth.</b> Its round 0 proposed holes with versions (its two door holes); the tide is the same idea with one roll for three holes. So:</p>
<pre>COURSE.rolls = [{ id: 'tide', name: 'Tide',
  options: [{ id: 'low', name: 'Low tide', sea: 0 },
            { id: 'high', name: 'High tide', sea: 2.4 }] }]
hole.versions = [
  { id: 'low',  yards, targets, pins?, tips? },
  { id: 'high', yards, targets, pins?, tips? } ]
hole.versionBy = 'tide'   // the Labyrinth's doors: versionBy unset,
                          // each hole rolls its own</pre>
<p>A version overrides only what differs (yards, targets, pins, the tips spot). <b>The ground is one field</b> sampled once; the version's sea level decides what is water (ground below it plays as water, with no bed offset), so the module doesn't carry two copies of a hole.</p>
<p><b>Tools and tests</b> expand every tide hole into both versions and run each: the gate, pins, targets on fairway, landing widths, penalty sides, carries, tips spots, tee views.</p></div>
<div class=txt style="width:46%">
<p><b>How a round picks it.</b> A random roll when the round starts, as the pins are, saved with the round (a resumed round keeps its tide). Proposed: the setup screen shows it beside wind and weather (<i>Tide: Low · Random</i>), so you can set it when you want to play one or the other.</p>
<p><b>How you see it.</b></p><ul>
<li>The setup card: <i>Tide: High. The tongue on the 3rd and the flats on the 9th are under water.</i></li>
<li>The scorecard row: <i>9 The Hong · high tide · ${h9.high.routeYd}</i>; the card's yardage is the route that tide plays (the 9th is ${h9.low.routeYd} at low water, ${h9.high.routeYd} at high).</li>
<li>The corner map paints the round's waterline, so the flats and the tongue show dry or flooded.</li>
<li>The hole's targets are the version's: at high water the 9th's targets sit on the spit.</li></ul>
<p class=small>Nothing moves during play: the sea stands where the round set it.</p></div></div>`, 7));

const css = `@page { size: A4 landscape; margin: 0 } body { margin: 0; font: 10.5px/1.42 'DejaVu Sans', Arial, sans-serif; color: #222; background: #fff }
section { width: 297mm; height: 210mm; box-sizing: border-box; padding: 8mm 11mm; page-break-after: always; overflow: hidden; position: relative }
header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #bbb; margin-bottom: 3mm } header h2 { font-size: 15px; margin: 0 } header span { color: #888; font-size: 9px }
.cover h1 { font-size: 30px; margin: 3mm 0 1mm } .cover .sub { font-size: 14px; color: #555; margin: 0 0 4mm }
table { border-collapse: collapse } .sum { width: 100%; margin: 3mm 0 } .sum td, .sum th, .t td, .t th { border: 1px solid #ccc; padding: 3px 6px; vertical-align: top; text-align: left } .sum th, .t th { background: #eef4f2 }
.sum td:first-child { width: 15%; font-weight: bold } .sum td:last-child { width: 33% } .t { font-size: 9.5px; margin-bottom: 2mm }
.row { display: flex; gap: 4mm; align-items: flex-start; margin-top: 1.5mm } .txt p { margin: 0 0 2mm } .txt ul { margin: 0 0 2mm; padding-left: 16px } .full { width: 100%; display: block; margin: 0.5mm 0 }
.plan { display: block; height: 92mm; margin: 0 auto } .prof { display: block; height: 37mm; margin: 0 auto }
.small { font-size: 9.5px; color: #444 } pre { background: #f3f6f5; padding: 5px 7px; font-size: 9px; margin: 0 0 2mm }`;
const html = `<!doctype html><html><head><meta charset=utf-8><style>${css}</style></head><body>${P.join('')}</body></html>`;
fs.writeFileSync(path.join(OUT, 'emerald-bay-round0.html'), html);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const pg = await b.newPage(); await pg.setContent(html, { waitUntil: 'load' });
await pg.pdf({ path: path.join(OUT, 'emerald-bay-round0.pdf'), format: 'A4', landscape: true, printBackground: true });
const over = await pg.evaluate(() => [...document.querySelectorAll('section')].map((s, i) => s.scrollHeight > s.clientHeight + 2 ? i + 1 : 0).filter(Boolean));
console.log('pages', P.length, 'overflow', over);
await b.close();
