# python3 make.py: the proposal book (HTML, then Chrome prints the PDF). White pages.
import os, re, subprocess, html
S = '/tmp/claude-0/-home-claude/0c0eb480-dd5b-5d01-aa47-32e52973db68/scratchpad'
P = f'{S}/prop'
rd = lambda f: open(f'{P}/{f}').read()
d24, d12, tips = rd('final24.txt'), rd('final12.txt'), rd('finaltips.txt')
def dec(name):
    out = []
    for line in d24.splitlines():
        if f'"{name}"' in line:
            who = 'long' if 'long hitter' in line else 'short'
            m = re.search(r'safe ([\d.]+) strokes \(([\d.]+) pen\), bold ([\d.]+) \(([\d.]+) pen\): (.*)$', line)
            g = re.search(r'leaves (\d+) yd less', line)
            out.append((who, m.groups() if m else None, g.group(1) if g else '', 'out of reach' in line))
    return out
def gate(n):
    lines = d12.splitlines(); i = next(k for k, l in enumerate(lines) if re.match(rf'^{n} ', l))
    return [l.strip() for l in lines[i + 1:i + 3] if 'hitter)' in l]
def decrow(hole, typ, name, rec):
    r = dec(name); cells = []
    for who, m, g, oor in r:
        if m: sn, sp, bn, bp, v = m; cells.append(f'{who}: safe {sn} / bold {bn} ({bp} pen) — {v}')
    return f'<tr><td>{hole}</td><td>{typ}</td><td>{html.escape(name)}</td><td>{r[0][2] if r else ""}</td><td>{"<br>".join(cells)}</td><td>{rec}</td></tr>'
tiprows = ''
for l in tips.splitlines():
    m = re.match(r'^(!\s)?(\d) (.+?): (\d+) yd, (\d+) yd behind the back tee(?:, drive lands on (\d+) m of fairway)?', l)
    if m: tiprows += f'<tr><td>{m.group(2)} {m.group(3)}</td><td>{m.group(5)} yd</td><td>{m.group(4)} yd</td><td>{(m.group(6) + " m") if m.group(6) else "par 3"}</td><td>{"" if not m.group(1) else "check flags it"}</td></tr>'
total = re.search(r'(\d+) yd for the nine', tips).group(1)
img = lambda f, w=100, mh=None: f'<img src="file://{P}/{f}" style="max-width:{w}%;{f"max-height:{mh}mm;" if mh else ""}display:block;margin:0 auto">'
css = '''@page { size: Letter; margin: 13mm 13mm 12mm 13mm; } body { font: 10.2px/1.42 "DejaVu Sans", Helvetica, Arial, sans-serif; color: #222; background: #fff; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 0 0 6px; border-bottom: 1.5px solid #222; padding-bottom: 3px; } h3 { font-size: 11.5px; margin: 10px 0 3px; }
.page { page-break-after: always; } .page:last-child { page-break-after: auto; } table { border-collapse: collapse; width: 100%; margin: 4px 0 8px; } td, th { border: 0.6px solid #aaa; padding: 3px 5px; vertical-align: top; text-align: left; } th { background: #f1f1f1; }
.card td:first-child { width: 22%; font-weight: 600; } .sub { color: #555; } .note { border-left: 3px solid #999; padding: 3px 8px; margin: 6px 0; } .lines { border-top: 0.6px solid #bbb; height: 16px; } ul { margin: 2px 0 6px 16px; padding: 0; }'''
def card(rows): return '<table class="card">' + ''.join(f'<tr><td>{k}</td><td>{v}</td></tr>' for k, v in rows) + '</table>'
def notes(n=4): return '<h3>Notes</h3>' + '<div class="lines"></div>' * n
pages = []
pages.append(f'''<div class="page"><h1>The Reclaim: reshape proposal</h1><div class="sub">Round 4, 11 November 2026. For review before anything changes in the game. Plans are drawn from the plan data; "now" is the course as it plays today.</div>
<h3>What this proposes</h3><ul>
<li><b>Three fairways reshaped</b> so no two measure alike: <b>4 Broken Tower</b> an hourglass (the bottle) pinched at the crest, <b>8 Riverside</b> a hook round the dock basin, <b>9 The Rift</b> a fan opening up the climb. 2 The Atrium and 6 The Square stay the two plain strips.</li>
<li><b>Two small changes</b>: an apron on <b>6</b> so the drivable green takes a running shot from the right; the El station platform on <b>1</b> runs 24 m further back to carry its tips tee.</li>
<li><b>A tips tee on every hole</b>, switched off (Girder tees, {total} yd for the nine). Four of the nine (2, 3, 5, 7) were on ground that already exists and are already in the game's data, nothing on screen. The other five come with these changes.</li>
<li><b>Which holes carry the decisions</b>: the data marks seven bold lines; the rules want two to four.</li></ul>
<h3>Before and after</h3><table><tr><th></th><th>Now</th><th>Proposed</th></tr>
<tr><td>Fairway forms (<code>alike.mjs</code>)</td><td>spindle 5, broken 2</td><td>broken 2, spindle 2, hourglass, hook, fan</td></tr>
<tr><td>Pairs that measure alike</td><td>6 of 21 (every pair among 2, 4, 8, 9)</td><td>0 of 21 (closest: 2 and 4 at 0.32; alike is under 0.25)</td></tr>
<tr><td>Plain strips / same form twice running</td><td>5 / 8 and 9 both spindles</td><td>2 / none</td></tr>
<tr><td>Against the other courses (<code>alike.mjs all</code>)</td><td>26 pairs with another course's fairway</td><td>6</td></tr>
<tr><td>Par 4 lengths</td><td>300, 380, 380, 400, 430</td><td>300, 365, 380, 400, 430 (8 measured on its new line)</td></tr>
<tr><td>Tips tee</td><td>none</td><td>all nine, {total} yd</td></tr>
<tr><td>Gate (every hole finishes, no hole over +1.5)</td><td>passes</td><td>passes (numbers on each hole page)</td></tr></table>
<h3>What moves besides the fairways</h3><ul>
<li>The ground matches each new form (each page says what moves). Hole 8's playing line now cuts across the basin's corner; its green keeps its frame and everything else round it stays put. The city between the holes and the river were laid out round the old line, and stay so (<code>cityLine</code>), so no other hole changes.</li>
<li>The scattered trees and stopped cars off the lines of play are placed from each hole's surfaces, so they re-scatter on 4, 8 and 9. Behind the back tees on 1, 2, 4, 6, 8 and 9 the few within 45 m (trees) or 16 m (cars) of a tips spot go; nothing else moves on those holes.</li></ul>
<div class="note">Nothing here is in the game yet. The questions are in the chat; once you pick, I build what you approve and show you the tee, landing and green views.</div></div>''')
def holepage(title, sub, planimg, ximg, rows, extra=''):
    return (f'<div class="page"><h2>{title}: the plan</h2><div class="sub">{sub}</div>{img(planimg, 100, 228)}</div>'
            f'<div class="page"><h2>{title}: the ground and the card</h2>{img(ximg, 100, 85) if ximg else ""}{card(rows)}{extra}{notes(4)}</div>')
g4, g8, g9, g6 = gate(4), gate(8), gate(9), gate(6)
pages.append(holepage('4 Broken Tower: an hourglass, the bottle', 'Par 5, 545 yd, S-bend. Fairway form: spindle → hourglass.', 'plan4.png', 'x4.png', [
 ('Story', 'Drive under the fallen top of the tower, then thread the neck between the heaps of its rubble on the crest to the pavilion green.'),
 ('Why this form', 'The tower\'s rubble came to rest on the crest; heaps either side leave one gap over it. Wide where the drive and the lay-up land (60–70 m), 15–20 m through the neck at 346–382 m, wide again in the hill park. It gives the hole its question (the Bottle, a classic nobody has used yet) and a shape no other hole has.'),
 ('Decision', 'The bottle: lay back to the wide part short of the neck ("Short of the gap", 322 m), or thread the second through it ("Through the gap", 418 m, bold). From the drive the bold second is about 170 yd; it leaves 98 yd less than the lay-up.'),
 ('Ground that moves', 'Two heaps of grassed rubble on the crest either side of the gap, 6 m and 7 m high, 32–48 m across, with four young trees on each. A miss off the neck finishes on rubble (plays as rough) or in the branches. The crest itself is unchanged.'),
 ('What stays', 'The tees, the span, the tower and its prop, the pavilion green and its columns, the bunkers, the profile.'),
 ('Checks', 'Form: hourglass. Each tee set\'s drive lands on 60–63 m of fairway. Tips tee 38 yd behind the back tee (583 yd), a 290 yd drive lands on 61 m. Gate: ' + '; '.join(g4) + '.'),
 ('What the numbers say', 'The bold second pays both players a lot (long hitter 6.04 → 4.71 strokes, short 7.88 → 4.75, no penalties): missing the gap only costs a rough lie, and the tool\'s player has no lie costs. As measured, threading it is simply the line, not a choice. Question 3 in the chat.')]))
pages.append(holepage('8 Riverside: a hook round the dock basin', 'Par 4, 380 → 365 yd, dogleg right. Fairway form: spindle → hook.', 'plan8.png', 'x8.png', [
 ('Story', 'From the waterline round the dock basin to the wharf green; the straight line to the flag crosses the basin\'s corner.'),
 ('Why this form', 'The basin is the hole\'s hazard and sits inside the bend: a hook wraps round it, and the line to the green crosses it, so the question is how much to cut off. It makes the bold line a real carry (the brief\'s point: before, "Across the basin" cost both players nearly a stroke with a penalty every other time).'),
 ('Decision', 'Bite off what you dare: "Round the basin" (212 m, wide left) or "Bite off the basin" (247 m, along its edge, bold), which leaves 45 yd less.'),
 ('Ground that moves', 'The playing line now turns at 130 m instead of 228 m and runs across the basin\'s corner to the same pin, so the card is 365 yd. The fairway is widened at the corner (63 m where drives land) and carried round the basin\'s north side; the quay leans 2% away from the basin across the fairway (the hole already asks a lot, so it leans away from its trouble); the basin moves 7 m south-east; the left bunker moves out to the corner\'s edge; the profile is measured on the new line (the same heights at the tee, the corner and the wharf). The basin\'s south bank stands 1–2 m higher than now (a quay wall).'),
 ('What stays', 'The tees, the green and its frame, the grass bunker by the green, the wharf, the cranes, the sheds, the wrecks; the river and the city round the hole.'),
 ('Checks', 'Form: hook (its middle swings 50 m off the line). Drives land on 63 m from every tee set. Tips tee 38 yd behind (403 yd), a 290 yd drive lands on 69 m. Gate: ' + '; '.join(g8) + '.'),
 ('What the numbers say', 'Long hitter: bold costs 0.17 (0.13 penalties); short hitter: bold pays 0.12. Both are inside the noise at 24 rounds: as measured it is not yet a choice. The tool\'s player gains little from 90 m in against 140 m. Question 4 in the chat.')]))
pages.append(holepage('9 The Rift: a fan up the climb', 'Par 4, 430 yd, climbs 28 m. Fairway form: spindle → fan.', 'plan9.png', 'x9.png', [
 ('Story', 'Climb the heaved street beside the rift; it opens into the old civic plaza under the leaning clubhouse.'),
 ('Why this form', 'At the foot of the climb the street is squeezed between the rift and the rubble; at the top the slab flattens into the plaza. A fan says that: the further up you drive, the more room. It also ends the run of spindles on 8 and 9.'),
 ('Decision', 'None, one clear line. "Top terrace" becomes a plain target (it was marked bold, and as a second-shot choice it cost both players 0.8). The fan rewards the long drive; the feature is the rift on the left and the two steps.'),
 ('Ground that moves', 'Very little: the rubble heap on the right of the top terrace moves 14 m out to make room for the plaza, and the bunker right of the landing area moves 8 m up and 6 m out. The slopes, the steps, the rift and the green are unchanged.'),
 ('What stays', 'Everything else: tees, green, the rift, the clubhouse, the buildings.'),
 ('Checks', 'Form: fan, 24 m at the foot to 76 m at the top. Drives land on 48–50 m. Tips tee 39 yd behind, to the right (469 yd), a 290 yd drive lands on 50 m. Gate: ' + '; '.join(g9) + '.')]))
pages.append(f'''<div class="page"><h2>6 The Square: a small change</h2>
<div class="sub">An apron so the drivable green takes a running shot.</div>{img('plan6.png', 100, 180)}
{card([('Change', 'Fairway carried from the right lane up to the green\'s front right (two free shapes, about 32 × 22 m and 18 × 14 m); the bold target becomes "Run it on from the right", 54 yd less than the lay-up.'),
 ('Why', 'The rule for a drivable par 4: a green that takes a running shot from one side. Before, the only way to drive it was over the fountain: as a bold line that cost the long hitter 1.5 strokes and 0.83 penalties a hole.'),
 ('Numbers', '"Run it on" pays the short hitter from the Ivy tees 0.33 and costs the long hitter 0.5 (0.42 penalties: the fountain left): a real choice as the rules measure it. Gate: ' + '; '.join(g6) + '. Tips tee 31 yd behind (331 yd); with the apron a 290 yd drive lands on 40 m, so it passes.')])}
</div><div class="page"><h2>1 The El: the station platform runs on behind the back tee</h2>{img('plan1.png', 100, 165)}{img('x1.png', 90, 45)}
{card([('Change', 'The El station platform is 24 m longer at the back (70 m instead of 46), and the tips tee sits on its back end, 27 yd behind the Spire tee (427 yd).'),
 ('Why', 'The only ground 20 yd behind the back tee is the boulevard 12 m below, and a tee there would drive into the back of the platform.'),
 ('What stays', 'Everything else on the hole; the El runs on beside the platform as it does now.')])}</div>''')
pages.append(f'''<div class="page"><h2>Decisions: which holes carry them</h2>
<div class="sub">From <code>design.mjs reclaim --only=decisions --seeds=24</code> on this proposal. Long hitter: about 295 yd from the Spire tees; short hitter: the Ivy tees at 82%. A choice is real when the bold line pays for one and not the other (or pays at a clear risk of a penalty). The tool's player has no lie costs or wind, so read differences; under about 0.3 strokes is noise. Second-shot choices (4, 7) are now scored too: the drive plays safe, then the second goes at the bold target.</div>
<table><tr><th>Hole</th><th>Type</th><th>Bold target</th><th>Gains (yd)</th><th>Strokes (24 rounds)</th><th>Proposal</th></tr>
{decrow('1 The El', 'see the flag', 'Round the low end', 'one clear line: unmark')}
{decrow('2 The Atrium', 'the long way round', 'Through the Atrium', 'the lobby stays as a helper: unmark')}
{decrow('4 Broken Tower', 'the bottle', 'Through the gap', 'decision')}
{decrow('6 The Square', 'drivable par 4', 'Run it on from the right', 'decision')}
{decrow('7 The Bridge', 'go or lay up', 'Over the inlet', 'one line: unmark (6, 7, 8 would be three in a row)')}
{decrow('8 Riverside', 'bite off what you dare', 'Bite off the basin', 'decision (the one in the last two)')}
<tr><td>9 The Rift</td><td>none</td><td>Top terrace</td><td></td><td>cost both 0.8 as a second-shot choice (before)</td><td>one clear line (already unmarked here)</td></tr></table>
<div class="note">Recommended: 4, 6 and 8: three decisions, each a different type, none three in a row, one in the last two. As measured only 6 is a real choice today; 4 and 8 are the layout's questions and are best judged by playing them in the game, where lies cost and the wind blows.</div>
</div><div class="page"><h2>The tips tees (Girder), switched off</h2>
<table><tr><th>Hole</th><th>Behind the back tee</th><th>Card</th><th>A 290 yd drive lands on</th><th></th></tr>{tiprows}</table>
<div class="sub">{total} yd for the nine (the aim is 3,600–3,700). Already in the data: 2, 3, 5 and 7. With this proposal: 1 (on the longer platform), 4, 6, 8 and 9. Each sits on real ground, level within a metre, off the fairway, nothing overhead. Turning them on later is data: put the Girder set first in the tee sets and copy each hole's tips spot and yardage in.</div>
{notes(4)}</div>''')
open(f'{S}/book/book.html', 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>The Reclaim reshape proposal</title><style>{css}</style></head><body>{"".join(pages)}</body></html>')
pdf = f'{S}/book/the-reclaim-reshape-proposal-r4.pdf'
subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--no-pdf-header-footer', f'--print-to-pdf={pdf}', f'file://{S}/book/book.html'], check=True, capture_output=True, timeout=300)
print('wrote', pdf)
