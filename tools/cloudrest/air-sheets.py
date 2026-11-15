# Cloudrest round 0: thin air, the wall and the mist, on white landscape pages (figures, not descriptions).
# node tools/cloudrest/air-data.mjs > tools/cloudrest/out/air.json && python3 tools/cloudrest/air-sheets.py
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Rectangle, Polygon, FancyArrowPatch

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, 'out', 'air.json')))
OUT = os.path.join(HERE, 'out', 'cloudrest-thin-air-r0.pdf')
plt.rcParams.update({'font.family': 'Inter', 'font.size': 9, 'axes.edgecolor': '#555', 'axes.labelcolor': '#222',
                     'xtick.color': '#444', 'ytick.color': '#444', 'axes.spines.top': False, 'axes.spines.right': False})
SEA, THIN, DAMP, INK, MUTE = '#8a8f98', '#1f6f8b', '#4c9a5b', '#222', '#777'
ALT = D['alt']
W, H = 11.69, 8.27  # A4 landscape, inches


def page(title, sub):
    f = plt.figure(figsize=(W, H), facecolor='white')
    f.text(0.04, 0.95, title, fontsize=17, weight='bold', color=INK)
    f.text(0.04, 0.915, sub, fontsize=9.5, color=MUTE)
    f.text(0.96, 0.025, 'Cloudrest · round 0 · thin air, the wall and the mist · 15 November 2026', fontsize=7.5, color=MUTE, ha='right')
    return f


pct = lambda a, b: (b / a - 1) * 100
pdf = PdfPages(OUT)

# ---- page 1: the proposal at a glance, and the bag club by club ----
f = page('Thin air, the wall and the mist: what I propose',
         f'Every number is the game\'s own flight model (src/physics.js), sea level at 72°F against Cloudrest at {ALT:,} ft. Tour clubs are the game\'s TrackMan averages.')
rows = [
    ('Thin air', f'Cloudrest sits at {ALT:,} ft (COURSE.altFt). A tour driver carries 10% further; the air does the rest itself.',
     'No change to physics.js: altitude is already in the model (Red Mesa plays at 5,200 ft, +8%).'),
    ('The run', 'Damp turf on Cloudrest\'s fairways, so a drive runs about as far as at sea level (21 yd, not 32).',
     'One new surface in physics.js, used only where COURSE.turf = \'damp\' (as the links turf is).'),
    ('What it shows', 'Card yards are the real distance. The hole card adds "plays 393" as it does today; the setup line says "the ball flies about 10% further".',
     'The setup line is the only change (main.js).'),
    ('The wall gives', 'A cliff face soaks a ball like The Reclaim\'s facades (0.45): 73% drop at its foot, the rest come back a few yards. None reach the mist.',
     'A soak chance on the ground\'s cliff faces, from the course (a small change in physics.js).'),
    ('The mist takes', 'A stroke and a drop beside where the ball left the ground, as in the Aerie\'s clouds. Toast: "Into the mist".',
     'Already in the game for any ball lost to open air (relief.js cloudDrop).'),
    ('The alcove\'s roof', 'Keep it 90 m up and solid. Only a skied driver (86 m) reaches it; any iron tops out under 53 m.',
     'Treated like Hollowmere\'s roof.'),
]
ax = f.add_axes([0.04, 0.50, 0.92, 0.39]); ax.axis('off')
y = 1.0
for i, (k, a, b) in enumerate(rows):
    ax.add_patch(Rectangle((0, y - 0.155), 1, 0.15, color='#f3f5f7' if i % 2 == 0 else 'white', transform=ax.transAxes, zorder=0))
    ax.text(0.01, y - 0.05, k, weight='bold', fontsize=10, transform=ax.transAxes, va='center')
    ax.text(0.16, y - 0.05, a, fontsize=9, transform=ax.transAxes, va='center', wrap=True)
    ax.text(0.16, y - 0.11, b, fontsize=8, color=MUTE, transform=ax.transAxes, va='center')
    y -= 0.165

ax = f.add_axes([0.04, 0.06, 0.92, 0.40]); ax.axis('off')
hdr = ['Club', 'Carry, sea → here', 'Gain', 'Total on fairway\nsea → here (damp)', 'Peak height ft', 'Slice curve yd\n(axis 15°)', 'Drift yd\n(10 mph across)', 'Lands at']
xs = [0.0, 0.17, 0.30, 0.37, 0.53, 0.65, 0.77, 0.89]
for x, h in zip(xs, hdr): ax.text(x, 0.97, h, weight='bold', fontsize=8.5, va='top', transform=ax.transAxes)
runs = {r['club']: r for r in D['run']}
yy = 0.86
for i, c in enumerate(D['clubs']):
    s, h = c['sea'], c['here']
    if i % 2 == 0: ax.add_patch(Rectangle((0, yy - 0.035), 1, 0.075, color='#f3f5f7', transform=ax.transAxes, zorder=0))
    tot = f"{s['total']:.0f} → {h['total']:.0f}" + (f"  ({runs[c['club']]['damp']['total']:.0f})" if c['club'] in runs else '')
    vals = [c['club'], f"{s['carry']:.0f} → {h['carry']:.0f}", f"+{pct(s['carry'], h['carry']):.1f}%", tot,
            f"{s['apexFt']:.0f} → {h['apexFt']:.0f}", f"{s['slice']:.1f} → {h['slice']:.1f}", f"{s['drift']:.1f} → {h['drift']:.1f}",
            f"{s['descent']:.0f}° → {h['descent']:.0f}°"]
    for x, v in zip(xs, vals):
        ax.text(x, yy, v, fontsize=8.6, va='center', transform=ax.transAxes, color=INK if not c['am'] else '#3d3d3d',
                style='italic' if c['am'] else 'normal', weight='bold' if x == 0.30 else 'normal')
    yy -= 0.083
ax.text(0, yy + 0.01, 'Not 10% across the board: the woods and long irons gain 10%, the short irons 12%, the sand wedge 9%, an amateur\'s driver 8%. '
        'Curve and wind drift fall by a tenth to a fifth.', fontsize=8.5, color=MUTE, transform=ax.transAxes, va='top')
pdf.savefig(f); plt.close(f)

# ---- page 2: what the air does, in pictures ----
f = page('What the air does', 'Side view of three flights (grey: sea level, blue: Cloudrest); a stock slice from above; and how high you have to go for 10%.')
ax = f.add_axes([0.06, 0.52, 0.56, 0.34])
for p in D['paths']:
    for key, col, lw in (('sea', SEA, 1.3), ('here', THIN, 1.8)):
        xs_ = [q[0] for q in p[key]]; ys_ = [q[1] * 3 for q in p[key]]
        ax.plot(xs_, ys_, color=col, lw=lw)
    e = p['here'][-1]; ax.text(e[0] + 3, 4, p['club'], fontsize=8.5, color=INK)
ax.set_xlabel('yards downrange'); ax.set_ylabel('height, ft'); ax.set_xlim(0, 320); ax.set_ylim(0, 110)
ax.set_title('Further and flatter: a driver peaks 14 ft lower and lands at 33° not 42°, so it runs nearly twice as far', fontsize=9, loc='left', color=INK)

ax = f.add_axes([0.70, 0.52, 0.26, 0.34])
for key, col, lw in (('sea', SEA, 1.3), ('here', THIN, 1.8)):
    ax.plot([q[2] for q in D['slicePaths'][key]], [q[0] for q in D['slicePaths'][key]], color=col, lw=lw)
s0, s1 = D['slicePaths']['sea'][-1], D['slicePaths']['here'][-1]
ax.text(s0[2] + 1.5, s0[0] - 4, f'sea level:\n{s0[2]:.0f} yd right\nat {s0[0]:.0f} yd', fontsize=7.8, color=SEA, va='top')
ax.text(s1[2] - 1.5, s1[0] + 6, f'Cloudrest: {s1[2]:.0f} yd right at {s1[0]:.0f} yd', fontsize=7.8, color=THIN, ha='right')
ax.axvline(0, color='#ccc', lw=0.8, ls='--'); ax.set_xlim(-10, 40); ax.set_ylim(0, 310)
ax.set_xlabel('yards right of the line'); ax.set_ylabel('yards downrange')
ax.set_title('A tour driver\'s slice (axis 15°)', fontsize=9, loc='left')

ax = f.add_axes([0.06, 0.09, 0.56, 0.33])
sw = D['sweep']; a = [r['altFt'] for r in sw]
ax.plot(a, [r['tour'] * 100 for r in sw], color=THIN, lw=1.8, label='tour driver')
ax.plot(a, [r['am'] * 100 for r in sw], color='#5c3d8a', lw=1.6, label='amateur driver (140 mph ball)')
ax.plot(a, [r['wedge'] * 100 for r in sw], color='#c07a2c', lw=1.3, label='pitching wedge')
ax.axhline(10, color='#bbb', lw=0.8, ls=':')
for o in D['others']:
    ax.plot([o['altFt']], [o['tour'] * 100], 'o', color='#999', ms=4)
    if o['altFt'] > 3000: ax.text(o['altFt'] + 150, o['tour'] * 100 - 1.0, f"{o['name']} ({o['altFt']:,} ft)", fontsize=7.5, color=MUTE)
ax.text(1300, 0.6, 'the Lost Valley, Rimeholm, Eldergrove (1,200-1,320 ft)', fontsize=7.5, color=MUTE)
for alt, lab, col, yl in ((ALT, f'{ALT:,} ft (proposed)', THIN, 15.6), (8500, '8,500 ft', '#5c3d8a', 14.4)):
    ax.axvline(alt, color=col, lw=1, ls='--'); ax.text(alt + 100, yl, lab, fontsize=8, color=col)
ax.set_xlim(0, 12000); ax.set_ylim(0, 17); ax.set_xlabel('altitude, ft (72°F)'); ax.set_ylabel('carry gain over sea level, %')
ax.legend(frameon=False, fontsize=8, loc='upper left')
ax.set_title('Ten per cent for a tour driver at 6,600 ft; for an amateur\'s driver at 8,500 ft', fontsize=9, loc='left')

ax = f.add_axes([0.70, 0.09, 0.26, 0.33]); ax.axis('off')
ax.text(0, 1.0, 'The temperature setting still matters', weight='bold', fontsize=9.5, va='top')
yy = 0.86
for t in D['temps']:
    lab = {55: 'Cool, 55°F', 72: 'Mild, 72°F', 95: 'Hot, 95°F'}[t['tempF']]
    ax.add_patch(Rectangle((0, yy - 0.05), t['tour'] * 100 / 20, 0.07, color=THIN, alpha=0.8))
    ax.text(t['tour'] * 100 / 20 + 0.02, yy - 0.015, f"{lab}: +{t['tour'] * 100:.1f}%", fontsize=8.5, va='center')
    yy -= 0.13
ax.text(0, 0.42, 'Tour driver at 6,600 ft, by the setup\nscreen\'s temperature. The signature\nconditions would be Cool (mist, late\nafternoon), so +9% as it opens.', fontsize=8.5, color=MUTE, va='top')
pdf.savefig(f); plt.close(f)

# ---- page 3: the run, the greens and the roof ----
f = page('Where the ball stops', 'Thin air lands the ball flatter, so it runs further. Damp turf takes most of that back. And how high the highest shots go under the alcove\'s roof.')
ax = f.add_axes([0.06, 0.48, 0.55, 0.37])
import numpy as np
cl = [r['club'] for r in D['run']]; x = np.arange(len(cl)); bw = 0.26
for k, (key, col, lab) in enumerate((('sea', SEA, 'sea level, fairway'), ('thin', THIN, 'Cloudrest, today\'s fairway'), ('damp', DAMP, 'Cloudrest, damp turf'))):
    car = [r[key]['carry'] for r in D['run']]; rn = [r[key]['run'] for r in D['run']]
    ax.bar(x + (k - 1) * bw, car, bw * 0.92, color=col, alpha=0.35)
    ax.bar(x + (k - 1) * bw, rn, bw * 0.92, bottom=car, color=col, label=lab)
    for xi, c_, r_ in zip(x, car, rn): ax.text(xi + (k - 1) * bw, c_ + r_ + 3, f'{r_:.0f}', ha='center', fontsize=7.5, color=col)
ax.set_xticks(x); ax.set_xticklabels(cl); ax.set_ylabel('yards (pale: carry, solid: run)'); ax.set_ylim(0, 360)
ax.legend(frameon=False, fontsize=8, loc='upper right')
ax.set_title('The run, yards: a drive runs 32 yd in thin air on today\'s fairway against 17 at sea level; on damp turf 21', fontsize=9, loc='left')

ax = f.add_axes([0.68, 0.48, 0.28, 0.37]); ax.axis('off')
ax.text(0, 1.0, 'Why it matters for the layout', weight='bold', fontsize=9.5, va='top')
ax.text(0, 0.9, ('Without damp turf a tour drive totals 321 yd,\n+15% not +10%: the 5th\'s notch at 275 yd\n'
                 'swallows lay-ups that ran on, and the 9th\'s\nbold line (287 yd to the green) is reached\n'
                 'by a drive that only runs. With it, 310 yd:\nthe layout\'s numbers hold.\n\n'
                 'Damp turf is a fairway surface for this\ncourse only (mu 0.42, COR 0.92, turf 0.65,\n'
                 'roll 0.19; today\'s fairway 0.40, 1.00,\n0.70, 0.16). It suits the place: green, wet\nand misty. Rough, sand and greens unchanged.'),
        fontsize=8.5, va='top', color='#333', linespacing=1.35)
ax.text(0, 0.08, 'On the greens', weight='bold', fontsize=9.5, va='top')
ax.text(0, 0.0, '\n'.join(f"{g['club']}: {g['sea']:.1f} → {g['here']:.1f} yd" for g in D['greenRun']) +
        '\nA little more release; no change proposed.', fontsize=8.2, va='top', color='#333', linespacing=1.35)

ax = f.add_axes([0.16, 0.08, 0.45, 0.3])
tl = D['tall']; y_ = np.arange(len(tl))
ax.barh(y_ - 0.18, [t['sea'] for t in tl], 0.34, color=SEA, label='sea level')
ax.barh(y_ + 0.18, [t['here'] for t in tl], 0.34, color=THIN, label='Cloudrest')
ax.axvline(90, color='#a33', lw=1.2); ax.text(90.5, len(tl) - 0.6, 'the alcove\'s roof, 90 m', color='#a33', fontsize=8)
ax.axvline(45, color='#a33', lw=0.8, ls=':'); ax.text(45.5, len(tl) - 0.6, 'the rule: 45 m', color='#a33', fontsize=8)
ax.set_yticks(y_); ax.set_yticklabels([t['shot'] for t in tl]); ax.invert_yaxis(); ax.set_xlabel('peak height, m'); ax.set_xlim(0, 100)
ax.legend(frameon=False, fontsize=8, loc='center right')
ax.set_title('The highest shots: thin air barely raises the very high ones; only a skied driver reaches 86 m', fontsize=9, loc='left')
ax = f.add_axes([0.68, 0.08, 0.28, 0.3]); ax.axis('off')
ax.text(0, 1.0, 'The alcove (7th, 225 yd)', weight='bold', fontsize=9.5, va='top')
ax.text(0, 0.88, ('A hybrid or a long iron peaks at about\n23 m. The roof stays 85-90 m up over the\n'
                  'tee, the line and the green, and solid as\nHollowmere\'s: a skied driver that clips\n'
                  'it drops. Nothing lower over any tee.'), fontsize=8.5, va='top', color='#333', linespacing=1.35)
pdf.savefig(f); plt.close(f)

# ---- page 4: the wall gives, the mist takes ----
f = page('The wall gives, the mist takes', '4,000 drives at a 62 m shelf in thin air, aimed and curving toward the wall (half tour, half amateur). Of the ones that hit the wall, where they finish.')
ax = f.add_axes([0.03, 0.50, 0.40, 0.36]); ax.set_aspect('equal'); ax.axis('off')
# a section across a shelf: the wall right, the shelf, the kerb, the drop to the mist left
ax.add_patch(Polygon([[31, 0], [31, 60], [36, 75], [44, 78], [48, 0]], color='#b9b2a6'))
ax.add_patch(Polygon([[-31, 0], [31, 0], [31, -3], [-31, -3]], color='#9cbf88'))
ax.add_patch(Polygon([[-31, 0], [-28, 0], [-28, 1.2], [-30.5, 1.6], [-31, 1]], color='#6b6b6b'))
ax.add_patch(Polygon([[-31, -3], [31, -3], [36, -40], [-38, -40], [-31, 0]], color='#cfc8bc'))
ax.add_patch(Rectangle((-70, -40), 39, 30, color='#e8eef3'))
ax.text(-52, -24, 'the mist\na stroke and a drop\nbeside where it left', ha='center', fontsize=8, color='#557')
ax.text(39, 40, 'the wall', fontsize=8.5, ha='center', rotation=90, color='#333')
ax.text(0, 4, 'the shelf, 62 m', fontsize=8.5, ha='center')
ax.text(-29, 7, 'kerb', fontsize=8, ha='center', color='#444')
ax.annotate('', (29, 2), (-5, 22), arrowprops=dict(arrowstyle='->', color=THIN, lw=1.4, connectionstyle='arc3,rad=-0.3'))
ax.annotate('', (26, 0.5), (30.5, 14), arrowprops=dict(arrowstyle='->', color=DAMP, lw=1.4))
ax.text(13, 16, 'drops at its foot\n(73%)', fontsize=8, color=DAMP)
ax.set_xlim(-70, 50); ax.set_ylim(-42, 80)

ax = f.add_axes([0.66, 0.50, 0.22, 0.36])
wl = D['wall']; y_ = np.arange(len(wl))
for i, w in enumerate(wl):
    l = 0
    for k, col in (('foot', DAMP), ('back', '#9cbf88'), ('mist', '#a33')):
        ax.barh(i, w[k] * 100, left=l, color=col, height=0.6)
        if w[k] > 0.025: ax.text(l + w[k] * 50, i, f'{w[k] * 100:.0f}%', ha='center', va='center', fontsize=8, color='white' if k != 'back' else INK)
        l += w[k] * 100
    ax.text(102, i, f"back out: half within\n{w['p50']:.0f} yd, 9 in 10 within {w['p90']:.0f}", fontsize=7.4, va='center', color=MUTE)
ax.set_yticks(y_); ax.set_yticklabels([w['model'] for w in wl], fontsize=8.2); ax.invert_yaxis(); ax.set_xlim(0, 100)
ax.set_xlabel('% of drives that hit the wall\ndark: at its foot · pale: back onto the shelf · red: into the mist', fontsize=8)
ax.spines['left'].set_visible(False)

ax = f.add_axes([0.05, 0.07, 0.9, 0.33]); ax.axis('off')
txt = [
    ('What I found', 'Today\'s engine treats a cliff that is part of the ground as a wall that knocks the ball back a quarter of its speed, toward the tee as well '
     'as away from the wall. 4% of the balls that hit it rolled all the way back across the shelf and into the mist. A kerb stops those; a soaking wall never sends them.'),
    ('What I propose', 'Cliff faces soak like The Reclaim\'s facades (0.45): about three in four drop at the foot, the rest come back a few yards onto the shelf. '
     'The kerb at the outer edge as well, so a ball that only runs toward the drop stops: only a ball that flies the kerb is lost. At the foot of every wall, '
     'a lie with a shot back to the fairway (rubble or rough, never a trap), as the brief asks.'),
    ('The mist', 'A stroke and a drop on firm grass within two club lengths of where the ball left the ground, no nearer the hole: the game already does this for any ball '
     'lost to open air. The toast reads "Into the mist". The mist is penalty ground on one side of a landing area at most, as the rules require.'),
    ('How often', 'Here 1,294 of 4,000 drives hit the wall, because they were aimed and curved toward it on purpose; on a real shelf hole far fewer will. '
     'Of the ones that do, the soak keeps 73% at the foot, sends the rest back half of them within 3 yd, and none reach the mist.'),
]
yy = 1.0
for k, v in txt:
    ax.text(0, yy, k, weight='bold', fontsize=9.5, va='top')
    ax.text(0.14, yy, v, fontsize=8.6, va='top', wrap=True, color='#333')
    yy -= 0.25
pdf.savefig(f); plt.close(f)
pdf.close()
print(OUT)
