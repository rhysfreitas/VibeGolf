# python3 tools/labyrinth/figs.py : the round-0 proposal's figures (white pages), from out/maze.json and
# out/walls.json. Writes out/figs/*.png.
import json, os, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Ellipse, FancyArrowPatch

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'figs'); os.makedirs(OUT, exist_ok=True)
M = json.load(open(os.path.join(HERE, 'out', 'maze.json')))
R = json.load(open(os.path.join(HERE, 'out', 'walls.json')))
YD = 0.9144
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9, 'axes.edgecolor': '#555', 'axes.linewidth': 0.6})
INK, GOLD, RED, BLUE, GREEN = '#2b2b2b', '#c8902e', '#c0392b', '#2e6da4', '#4c8a3a'

def wall_colour(w):
    if w['kind'] == 'door': return '#5a3d2b'
    if w['kind'] == 'lintel': return '#b8b0a2'
    if w['kind'] == 'tower': return '#8a7f6e'
    h = w['h']
    if h < 16: return '#d9c9a3'          # low, broken
    g = max(0.42, min(0.82, 0.86 - h / 120))
    return (g, g * 0.98, g * 0.93)

def draw_walls(ax, key, box, label_h=False):
    x0, x1, z0, z1 = box
    for w in M['walls'][key]:
        P = [(p[0], -p[1]) for p in w['pts']]                     # plot north up: y = -Z
        if all(not (x0 - 50 < p[0] < x1 + 50 and z0 - 50 < p[1] < z1 + 50) for p in P): continue
        ax.add_patch(Polygon(P, closed=True, fc=wall_colour(w), ec='#6b655b', lw=0.25, zorder=3 if w['h'] < 16 else 2))
    ax.set_xlim(x0, x1); ax.set_ylim(z0, z1); ax.set_aspect('equal'); ax.set_facecolor('#f4f1e8')

def line_of(k): return [(p[0], -p[1]) for p in M['lines'][k]]

def green(ax, k, c=GREEN):
    g = M['greens'][k]; ax.add_patch(Ellipse((g['at'][0], -g['at'][1]), 2 * g['rx'], 2 * g['rz'], fc='#9fd07a', ec=c, lw=0.8, zorder=4))

# ---- 1. the plan of holes 1-3, round 0 --------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(11.2, 6.6))
draw_walls(ax, 'brokenL', (-70, 1000, -70, 700))
for k, c in [('1', BLUE), ('2', BLUE), ('3', BLUE), ('3R', '#7aa6d0')]:
    L = line_of(k); ax.plot(*zip(*L), color=c, lw=1.4, ls='-' if k != '3R' else '--', zorder=5)
    ax.plot(*L[0], 's', color=c, ms=5, zorder=6)
for k in ['1', '2', '3', '3R']: green(ax, k)
ax.add_patch(Polygon([(745, 816), (789, 816), (789, 772), (745, 772)], fc='#8a7f6e', ec=INK, lw=0.6, zorder=6))
for t, xy, d in [('1  The Gate  520 yd', (60, 60), (6, -14)), ('2  The Long Corridor  455 yd', (250, 580), (-10, 12)), ('3  The Elbow  380 yd', (720, 540), (12, 4)),
                 ('Tower, 120 m', (767, 794), (-30, -60)), ('inner gate', (210, 306), (14, -12)), ('outer gate', (85, -30), (12, -6)),
                 ('end wall, leaning 12°', (705, 590), (12, 18)), ('court', (815, 410), (0, 0)), ('court', (640, 410), (0, 0)),
                 ('shut door', (550, 334), (-40, -20)), ('left: open', (900, 322), (6, -4))]:
    ax.annotate(t, xy, xytext=(xy[0] + d[0], xy[1] + d[1]), fontsize=8, color=INK, zorder=8, arrowprops=dict(arrowstyle='-', lw=0.4, color='#777') if d != (0, 0) else None)
ax.set_title('Round 0: the maze round the first three holes (walls shaded by height: darker = taller; pale = 9-14 m broken walls). North up, metres.', fontsize=9, loc='left')
ax.text(990, -55, 'Not the plan book\'s wall plan: the walls on and beside the lines of play, a placeholder fill for the rest.\nThe 3rd drawn turning left; dashed: its right-turn version.', ha='right', fontsize=7.5, color='#555')
ax.tick_params(labelsize=7)
fig.tight_layout(); fig.savefig(os.path.join(OUT, 'plan13.png'), dpi=180); plt.close(fig)

# ---- 2. corridor misses ------------------------------------------------------------------------------------
sweep = R['corridor']['sweep']
fig, axs = plt.subplots(1, 3, figsize=(11.2, 3.6), sharey=True)
for ax, (key, name) in zip(axs, [('s0', 'Every ball comes back (soak 0)'), ('s0.45', 'Bare stone: soaks 45%'), ('s0.8', 'Ivy: soaks 80%')]):
    ax.axvspan(-25 / YD, 25 / YD, color='#cfe6b8', zorder=0); ax.axvspan(25 / YD, 28 / YD, color='#e3ecd2', zorder=0); ax.axvspan(-28 / YD, -25 / YD, color='#e3ecd2', zorder=0)
    ax.axvspan(28 / YD, 31 / YD, color='#e6dccb', zorder=0); ax.axvline(31 / YD, color='#6b655b', lw=3)
    for row in sweep:
        o = row['open']
        if abs(o['x']) < 31: continue
        ax.plot(o['x'] / YD, o['d'] / YD, 'o', mfc='none', mec='#999', ms=4)
        for q in row[key]: ax.plot(q['x'] / YD, q['d'] / YD, '.', color=RED if abs(q['x']) < 25 else INK, ms=2.2, alpha=0.5)
    ax.set_title(name, fontsize=9); ax.set_xlim(-5, 95); ax.set_xlabel('yd right of the line')
    c = R['corridor']['scat'][key]
    ax.text(2, 120, f"Of {c['hit']} drives in 2,000 that reach a wall:\n{round(100*c['foot']/c['hit'])}% at its foot (3 m), {round(100*c['rough']/c['hit'])}% rough, {round(100*c['fairway']/c['hit'])}% back on the fairway;\n{c['lostHit']} yd shorter than the same drive in the open", fontsize=7.2, va='bottom', bbox=dict(fc='white', ec='#bbb', lw=0.5))
axs[0].set_ylabel('yd down the hole')
axs[0].set_ylim(110, 280)
fig.suptitle('Drives pushed and sliced into the right wall of the 2nd (a 255 yd drive). Open circles: where each finishes with no wall. Dots: with the wall (40 flights each; red = back on the fairway).', fontsize=8.5, x=0.01, ha='left')
fig.tight_layout(rect=(0, 0, 1, 0.93)); fig.savefig(os.path.join(OUT, 'corridor.png'), dpi=180); plt.close(fig)

# ---- 3. the bank shot --------------------------------------------------------------------------------------
B = R['bank']
fig = plt.figure(figsize=(11.2, 4.4))
ax = fig.add_axes([0.05, 0.14, 0.56, 0.76])
# ground: approach and green flat, the bank from the green's back edge (z = -17) up 5 m to the wall's foot (z = -34)
zs = [40, -17, -34]; ys = [0, 0, 5]
ax.fill_between([-x for x in [40, -17, -34, -48]], [0, 0, 5, 5], -3, color='#dfe9cf', zorder=1)
ax.plot([-40, 17, 34], [0, 0, 5], color='#557a3c', lw=1.2, zorder=2)
ax.plot([-16, 16], [0.05, 0.05], color='#4c8a3a', lw=5, solid_capstyle='butt', zorder=3)
lean = math.tan(math.radians(12)); wx = lambda y: 34 - y * lean
ax.add_patch(Polygon([(34, -1), (48, -1), (48 - 60 * lean, 60), (34 - 60 * lean, 60)], fc='#cfc6b4', ec='#6b655b', lw=0.6, zorder=4))
for name, ls, col in [('no wall', '--', '#999'), ('leaning 12°, bank 5 m', '-', RED)]:
    for t in B['tracks'][name]:
        z = [-p[0] for p in t['pts']]; y = [p[1] for p in t['pts']]
        ax.plot(z, y, ls=ls, color=col, lw=0.9, zorder=5)
        ax.plot(z[-1], y[-1], 'o', color=col, ms=3.5, zorder=6)
        if name != 'no wall': ax.text(z[0] - 3 if False else -38, 0, '', fontsize=6)
ax.plot([0], [0.1], marker='|', color=INK, ms=12, zorder=7); ax.text(0, 2.6, 'pin', ha='center', fontsize=7)
ax.text(0, -2.2, 'green, 32 m deep', ha='center', fontsize=7, color='#3a6a2a')
ax.text(25, 3.6, 'kick bank, mown,\n5 m up (29%)', ha='center', fontsize=7, color='#3a6a2a')
ax.text(46, 16, 'end wall,\nleaning 12°,\nbare stone', ha='center', fontsize=7, bbox=dict(fc='white', ec='none', alpha=0.85), zorder=8)
ax.set_xlim(-40, 52); ax.set_ylim(-3, 34); ax.set_aspect('equal'); ax.set_xlabel('metres past the pin'); ax.set_ylabel('m')
ax.set_title('A 7 iron from 165 yd, hit 0, 24, 40 and 65 yd long. Dashed: no wall. Red: the proposed wall and bank.', fontsize=8.5, loc='left')
ax2 = fig.add_axes([0.68, 0.14, 0.3, 0.76])
show = [('no wall', '#999', '--'), ('upright, soaks 45%, no bank', '#7f8c8d', ':'), ('leaning 12°, no bank', BLUE, ':'), ('upright, bank 5 m', GOLD, '-'), ('leaning 12°, bank 4 m', '#8e6bb0', '-'), ('leaning 12°, bank 5 m', RED, '-')]
for name, col, ls in show:
    ys2 = []
    for l in B['longs']:
        rs = [q for r in B['rows'] if r['long'] == l for q in r[name]]
        ys2.append(100 * sum(1 for q in rs if q['on']) / len(rs))
    ax2.plot(B['longs'], ys2, ls=ls, color=col, lw=1.4 if name.startswith('leaning 12°, bank 5') else 1, marker='o', ms=2.5, label=name)
ax2.set_xlabel('yd past the pin it was hit'); ax2.set_ylabel('% finishing on the green'); ax2.set_ylim(-4, 104)
ax2.legend(fontsize=6.6, loc='center right', frameon=False)
ax2.set_title('9 iron to 3 wood, 140-230 yd', fontsize=8.5, loc='left')
ax2.text(16, 8, '16 yd long: stops\non the back edge', fontsize=6.5, color='#555')
fig.savefig(os.path.join(OUT, 'bank.png'), dpi=180); plt.close(fig)

# ---- 4. the Elbow's carry ----------------------------------------------------------------------------------
E = R['elbow']
fig, ax = plt.subplots(figsize=(7.4, 6.4))
draw_walls(ax, 'dressedL', (560, 930, 270, 590))
for k, c, ls in [('3', BLUE, '-'), ('3R', '#7aa6d0', '--')]: L = line_of(k); ax.plot(*zip(*L), color=c, lw=1.1, ls=ls, zorder=5)
green(ax, '3'); green(ax, '3R')
cols = {'leg 2 (bold line made)': GREEN, 'the court (behind the low walls)': GOLD, 'leg 1 (the tee side)': BLUE, 'the corner': '#777', 'the shut leg': RED}
mk = {'Tower': 'o', 'Rampart': 's', 'Gate': '^', 'Court': 'D'}
for r in E['rows']:
    tx, tz = r['tee']; ax.plot(tx, -tz, mk[r['set']], color=INK, ms=5, zorder=7)
    ax.text(tx + 6, -tz, r['set'], fontsize=7, va='center', zorder=8)
    tr = r['track']; ax.plot([p[0] for p in tr], [-p[2] for p in tr], color=RED, lw=0.6, alpha=0.8, zorder=6)
    for x, z, w in r['ends']: ax.plot(x, -z, mk[r['set']], color=cols.get(w, '#777'), ms=2.6, alpha=0.75, zorder=6)
for w, c in cols.items():
    if w != 'the corner': ax.plot([], [], 'o', color=c, ms=4, label=w)
ax.legend(fontsize=7, loc='upper right', frameon=True, facecolor='white', edgecolor='#ccc')
ax.text(812, 395, 'court\n(rough)', fontsize=7, ha='center'); ax.text(645, 395, 'court', fontsize=7, ha='center')
ax.annotate('low walls, 9-14 m', (760, 420), xytext=(860, 480), fontsize=7, arrowprops=dict(arrowstyle='-', lw=0.4))
ax.annotate('', (795, 356), xytext=(860, 470), arrowprops=dict(arrowstyle='-', lw=0.4))
ax.annotate('shut door', (594, 334), xytext=(600, 285), fontsize=7, arrowprops=dict(arrowstyle='-', lw=0.4))
ax.set_title('The Elbow (left this round): 60 drives a tee set aimed down the bold line, each set\'s player.\nRed: the straight one\'s flight. Round 0\'s tee spots 0, 20, 45 and 80 m down leg 1.', fontsize=8.5, loc='left')
ax.tick_params(labelsize=7)
fig.tight_layout(); fig.savefig(os.path.join(OUT, 'elbow.png'), dpi=180); plt.close(fig)

# ---- 5. the doors: the corner map in each version ----------------------------------------------------------
fig, axs = plt.subplots(1, 2, figsize=(7.0, 3.4))
for ax, (key, k, title) in zip(axs, [('dressedL', '3', 'Round A: the left door open'), ('dressedR', '3R', 'Round B: the right door open')]):
    draw_walls(ax, key, (560, 930, 270, 590))
    L = line_of(k); ax.plot(*zip(*L), color=BLUE, lw=1.4, zorder=5); green(ax, k)
    other = '3R' if k == '3' else '3'; Lo = line_of(other)
    ax.plot(*zip(*Lo[1:]), color='#bbb', lw=1, ls=':', zorder=4)
    g = M['greens'][other]; ax.add_patch(Ellipse((g['at'][0], -g['at'][1]), 2 * g['rx'], 2 * g['rz'], fc='#e6e6e6', ec='#bbb', lw=0.6, zorder=4))
    ax.set_title(title, fontsize=8.5); ax.set_xticks([]); ax.set_yticks([])
fig.tight_layout(); fig.savefig(os.path.join(OUT, 'doors.png'), dpi=180); plt.close(fig)
print('figs ->', OUT)
