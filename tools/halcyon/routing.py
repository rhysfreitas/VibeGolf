# python3 tools/halcyon/routing.py (after routing.mjs): out/routing-map.png, the routing on the ring floor,
# north (spinward, up the curve) at the top. White page, light colours, so it prints.
import json, os, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, Rectangle
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out')
D = json.load(open(f'{OUT}/routing.json')); Wd = D['world']
INK = '#2b2b2b'; YD = 0.9144
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})

def se_outline(w, n=72):
    c, s, p = np.cos(w.get('rot', 0)), np.sin(w.get('rot', 0)), w.get('p', 2)
    t = np.linspace(0, 2 * np.pi, n)
    u = np.sign(np.cos(t)) * np.abs(np.cos(t)) ** (2 / p) * w['ra']; v = np.sign(np.sin(t)) * np.abs(np.sin(t)) ** (2 / p) * w['rs']
    return np.c_[w['a'] + u * c - v * s, w['s'] + u * s + v * c]

def band(pts, widths, n=12):
    pts = np.array(pts, float); widths = np.array(widths, float)
    # smooth the centre line, then offset both sides
    t = np.linspace(0, len(pts) - 1, (len(pts) - 1) * n + 1)
    P = np.c_[np.interp(t, range(len(pts)), pts[:, 0]), np.interp(t, range(len(pts)), pts[:, 1])]
    Wt = np.interp(t, range(len(widths)), widths) / 2
    d = np.gradient(P, axis=0); d /= np.linalg.norm(d, axis=1)[:, None]; nrm = np.c_[-d[:, 1], d[:, 0]]
    return np.r_[P + nrm * Wt[:, None], (P - nrm * Wt[:, None])[::-1]]

fig, ax = plt.subplots(figsize=(7.2, 13.2), dpi=170)
A0, A1, S0, S1 = -470, 470, -120, 1900
ax.set_xlim(A0, A1); ax.set_ylim(S0, S1); ax.set_aspect('equal'); ax.axis('off')
H = Wd['HALF']
# the floor: parkland, terraces toward each rim, the night side south of the terminator
ax.add_patch(Rectangle((-H, S0), 2 * H, S1 - S0, fc=(0.93, 0.95, 0.89), ec='none', zorder=0))
for side in (-1, 1):
    for k, (lo, hi, al) in enumerate([(300, 350, 0.10), (350, 400, 0.18), (400, 450, 0.27)]):
        x0 = lo if side > 0 else -hi
        ax.add_patch(Rectangle((x0, S0), hi - lo, S1 - S0, fc=(0.80, 0.76, 0.66), alpha=al, ec='none', zorder=1))
ax.add_patch(Rectangle((-H, S0), 2 * H, Wd['TERMINATOR'] - S0, fc=(0.55, 0.60, 0.74), alpha=0.28, ec='none', zorder=2))
ax.plot([-H, H], [Wd['TERMINATOR']] * 2, color=(0.35, 0.40, 0.55), lw=0.8, ls=(0, (6, 3)), zorder=3)
ax.text(-H + 12, Wd['TERMINATOR'] - 40, 'the night side (south of the day/night line)', fontsize=6.3, color=(0.25, 0.30, 0.45), zorder=20)
# rim walls (glass)
for x in (-H, H):
    ax.plot([x, x], [S0, S1], color=(0.25, 0.40, 0.62), lw=3.2, zorder=5)
ax.text(-H + 4, S1 - 30, 'west rim glass', fontsize=6, color=(0.2, 0.32, 0.5), rotation=90, va='top', zorder=20)
ax.text(H - 14, S1 - 30, 'east rim glass', fontsize=6, color=(0.2, 0.32, 0.5), rotation=90, va='top', zorder=20)
ax.text(-430, -95, 'west terraces', fontsize=6, color=(0.45, 0.38, 0.28)); ax.text(330, -95, 'east terraces', fontsize=6, color=(0.45, 0.38, 0.28))
# the rim glass: a band along the foot of each rim wall, all the way round (round 3)
rg = Wd['RIM_GLASS']
for x in (-H, H - rg['w']): ax.add_patch(Rectangle((x, S0), rg['w'], S1 - S0, fc=(0.10, 0.12, 0.22), ec='white', lw=0.6, zorder=6))
# the valley (8th)
V = Wd['VALLEY']; ax.add_patch(Polygon(band(V['pts'], [V['half'] * 2] * len(V['pts'])), fc=(0.62, 0.74, 0.55), alpha=0.35, ec='none', zorder=3))
# lake and canal
L = Wd['LAKE']; ax.add_patch(Polygon(band(L['pts'], L['w']), fc=(0.66, 0.80, 0.92), ec=(0.40, 0.58, 0.75), lw=0.6, zorder=6))
C = Wd['CANAL']; ax.add_patch(Polygon(band(C['pts'], [C['w']] * len(C['pts']), n=6), fc=(0.66, 0.80, 0.92), ec=(0.40, 0.58, 0.75), lw=0.5, zorder=6))
lk = C['lock']; ax.add_patch(Rectangle((lk[0] - 9, lk[1] - 4), 18, 8, fc='white', ec=INK, lw=0.5, zorder=7))
aq = Wd['AQUEDUCT']; ax.plot([aq['from'][0], aq['to'][0]], [aq['from'][1], aq['to'][1]], color=(0.55, 0.50, 0.44), lw=4, solid_capstyle='butt', zorder=7)
ax.plot([aq['from'][0], aq['to'][0]], [aq['from'][1], aq['to'][1]], color=(0.66, 0.80, 0.92), lw=1.6, zorder=8)
# floor windows: stars through the glass
rng = np.random.default_rng(4)
for w in Wd['WINDOWS']:
    O = se_outline(w); ax.add_patch(Polygon(O, fc=(0.06, 0.07, 0.14), ec='white', lw=1.0, zorder=8))
    st = rng.uniform([-w['ra'], -w['rs']], [w['ra'], w['rs']], (60, 2)); c, s = np.cos(w['rot']), np.sin(w['rot'])
    for u, v in st:
        if (abs(u / w['ra']) ** w['p'] + abs(v / w['rs']) ** w['p']) < 0.85: ax.plot(w['a'] + u * c - v * s, w['s'] + u * s + v * c, '.', ms=0.9, color='white', zorder=9)
# the spoke's legs, the clubhouse, the tram stop
for lg in Wd['SPOKE']['legs']: ax.add_patch(Rectangle((lg[0] - 17, lg[1] - 17), 34, 34, fc=(0.80, 0.82, 0.86), ec=INK, lw=0.7, zorder=10))
sp = Wd['SPOKE']; ax.plot([sp['legs'][0][0], sp['legs'][1][0]], [sp['s'], sp['s']], color=(0.5, 0.52, 0.58), lw=0.6, ls=(0, (2, 2)), zorder=9)
ax.text(sp['a'] + 60, sp['s'] - 34, 'the spoke (A-frame, 260 m up to the shaft)', ha='center', fontsize=6, zorder=20, bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
cb = Wd['CLUBHOUSE']; ax.add_patch(Rectangle((cb['a'] - cb['w'] / 2, cb['s'] - cb['d'] / 2), cb['w'], cb['d'], fc='white', ec=INK, lw=0.9, zorder=10))
ax.text(cb['a'], cb['s'] + 30, 'clubhouse', ha='center', fontsize=6.5, zorder=20)
tm = Wd['TRAM']; ax.add_patch(Rectangle((tm['a'] - 6, tm['s'] - 22), 12, 44, fc=(0.85, 0.85, 0.80), ec=INK, lw=0.5, zorder=10)); ax.text(tm['a'] + 14, tm['s'], 'tram stop', fontsize=6, va='center', zorder=20)
ax.plot([0, 0], [S0, S1], color=(0.6, 0.6, 0.55), lw=0.5, ls=(0, (1, 3)), zorder=2)
ax.text(4, 1880, 'ring tram (centre line)', fontsize=5.5, color=(0.45, 0.45, 0.4), va='top')

# holes
TEECOL = {'zenith': '#1f3b5c', 'meridian': '#c9a24a', 'horizon': '#bdb8aa', 'nadir': '#8fb3c9'}
for h in D['holes']:
    Lh = np.array(h['line'], float)
    ax.plot(Lh[:, 0], Lh[:, 1], color=INK, lw=1.4, zorder=12)
    # a corridor 25 m either side, faint (where the fairway will be)
    ax.add_patch(Polygon(band(Lh, [50] * len(Lh), n=1), fc=(0.62, 0.80, 0.50), alpha=0.55, ec='none', zorder=4))
    g = Lh[-1]; ax.add_patch(Circle(g, 16, fc=(0.55, 0.84, 0.45), ec=INK, lw=0.6, zorder=13))
    for k, p in h['tees'].items(): ax.add_patch(Circle(p, 5.5, fc=TEECOL[k], ec=INK, lw=0.4, zorder=13))
    ax.add_patch(Circle(h['tips'], 5.5, fc='white', ec='#1d7fa6', lw=1.0, zorder=13))
    T = np.array(h['tees']['zenith'], float); d = Lh[1] - Lh[0]; d /= np.linalg.norm(d); off = np.array([-d[1], d[0]]) * 34
    ax.annotate(f"{h['n']}", T - d * 30 + off * 0.0, fontsize=10, fontweight='bold', ha='center', va='center', zorder=21,
                bbox=dict(boxstyle='circle,pad=0.25', fc='white', ec=INK, lw=0.8))
    mid = Lh[len(Lh) // 2] if len(Lh) > 2 else (Lh[0] + Lh[-1]) / 2
    lab = f"{h['name']}\npar {h['par']} · {h['yards']['zenith']} yd"
    ax.annotate(lab, mid + off * 1.4, fontsize=6.2, ha='center', va='center', zorder=21, bbox=dict(boxstyle='round,pad=0.25', fc='white', ec='none', alpha=0.9))
b4 = np.array(D['bold4']); ax.plot(b4[:, 0], b4[:, 1], color=(0.75, 0.20, 0.15), lw=1.0, ls=(0, (4, 2)), zorder=12)
ax.text(b4[1][0] + 10, b4[1][1] - 6, 'bold', color=(0.7, 0.2, 0.15), fontsize=6, zorder=21)
# scale and legend
ax.plot([A1 - 230, A1 - 30], [S0 + 30, S0 + 30], color=INK, lw=1.2); ax.text(A1 - 130, S0 + 40, '200 m', ha='center', fontsize=6)
ax.annotate('', xy=(A1 - 120, S1 - 20), xytext=(A1 - 120, S1 - 90), arrowprops=dict(arrowstyle='->', lw=1.0, color=INK))
ax.text(A1 - 108, S1 - 60, 'N, spinward\n(up the curve)', fontsize=6, va='center')
ax.set_title('Halcyon Ring: routing check · R = 5 km, 900 m between the rims', fontsize=9, loc='left')
fig.savefig(f'{OUT}/routing-map.png', bbox_inches='tight', facecolor='white'); print('wrote', f'{OUT}/routing-map.png')
