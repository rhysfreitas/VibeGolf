# python3 tools/emeraldbay/figs.py : round 0's figures (out/figs/*.png) from out/grid-*.json (dump.mjs) and
# out/checks.json (checks.mjs). White pages: every figure on white.
import json, os, sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import to_rgb
from matplotlib.patches import Polygon, Circle, Ellipse

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); FIG = os.path.join(OUT, 'figs')
os.makedirs(FIG, exist_ok=True)
CODES = ['sea', 'wet', 'sand', 'grass', 'rough', 'jungle', 'karst']
COL = { 'wet': '#e2cf9c', 'sand': '#f7efd6', 'grass': '#b6d68a', 'rough': '#8fb866', 'jungle': '#4f8a45', 'karst': '#a8a196' }
LINES = json.load(open(os.path.join(OUT, 'lines.json')))
CHK = json.load(open(os.path.join(OUT, 'checks.json'))) if os.path.exists(os.path.join(OUT, 'checks.json')) else {}
YD = 0.9144

def load(name):
    g = json.load(open(os.path.join(OUT, f'grid-{name}.json')))
    y = np.array(g['y']).reshape(g['nn'], g['nx']); t = np.array(g['t']).reshape(g['nn'], g['nx']); c = np.array(g['cave']).reshape(g['nn'], g['nx'])
    ext = [g['x0'], g['x0'] + g['cell'] * (g['nx'] - 1), g['n0'], g['n0'] + g['cell'] * (g['nn'] - 1)]
    return y, t, c, ext, g['cell']

def water(depth):
    # clear water: turquoise over sand in the shallows, deeper blue-green further out
    a = np.clip(depth / 6.0, 0, 1)[..., None]
    shallow, deep = np.array(to_rgb('#9fe3dc')), np.array(to_rgb('#2f8fa3'))
    return shallow * (1 - a) + deep * a

def paint(y, t, c, tide_m, cell):
    img = np.zeros(y.shape + (3,))
    for k, name in enumerate(CODES):
        if name in COL: img[t == k] = to_rgb(COL[name])
    img[t == 0] = to_rgb(COL['wet'])
    # hillshade on land, so the karst stands up
    gy, gx = np.gradient(y, cell)
    shade = np.clip(0.75 + 0.35 * (-gx * 0.6 + gy * 0.8) / np.sqrt(1 + gx ** 2 + gy ** 2), 0.45, 1.1)
    steep = np.hypot(gx, gy) > 1.0
    img[steep] = to_rgb('#9c9588')
    img = img * shade[..., None]
    wet = y < tide_m
    img[wet] = water(tide_m - y[wet])
    # the tide line at low water when drawing high water (dashed in the plot instead)
    img[c == 1] = img[c == 1] * 0.55
    return np.clip(img, 0, 1)

def draw_map(ax, name, tide, lines=None, title=None):
    y, t, c, ext, cell = load(name)
    tm = {'low': 0.0, 'high': 2.4}[tide]
    ax.imshow(paint(y, t, c, tm, cell), origin='lower', extent=ext, interpolation='bilinear')
    # the other tide's waterline, dotted
    other = 2.4 if tide == 'low' else 0.0
    ax.contour(np.linspace(ext[0], ext[1], y.shape[1]), np.linspace(ext[2], ext[3], y.shape[0]), y, levels=[other], colors=['#1d5f73'], linewidths=0.6, linestyles=':')
    ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3]); ax.set_aspect('equal')
    ax.set_xticks([]); ax.set_yticks([])
    if title: ax.set_title(title, fontsize=10)
    return ext

def lines_on(ax, ks=range(9), lw=1.2, label=True):
    for k in ks:
        L = np.array(LINES[k]); ax.plot(L[:, 0], L[:, 1], '-', color='#c0392b', lw=lw)
        ax.plot(*L[0], 'o', color='#c0392b', ms=3); ax.plot(*L[-1], 'o', mfc='white', mec='#c0392b', ms=4)
        if label: ax.text(L[0][0], L[0][1], f' {k+1}', color='#7b1d14', fontsize=8, fontweight='bold', va='bottom')

def scalebar(ax, ext, m=100):
    x0 = ext[0] + (ext[1] - ext[0]) * 0.04; y0 = ext[2] + (ext[3] - ext[2]) * 0.04
    ax.plot([x0, x0 + m], [y0, y0], 'k-', lw=2); ax.text(x0 + m / 2, y0 + (ext[3] - ext[2]) * 0.015, f'{m} m', ha='center', fontsize=7)

def bay():
    fig, axs = plt.subplots(1, 2, figsize=(11.4, 5.9), dpi=150)
    for ax, tide in zip(axs, ['low', 'high']):
        ext = draw_map(ax, 'bay', tide, title=f'{"Low" if tide=="low" else "High"} water ({"0" if tide=="low" else "2.4"} m)')
        lines_on(ax); scalebar(ax, ext, 200)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'bay.png')); plt.close(fig)


# ---- the tide holes: plan at low and high water side by side, tees, green, landing areas
import math
def lineframe(k):
    L = np.array(LINES[k], float)
    def at(s, off=0):
        for i in range(len(L) - 1):
            a, b = L[i], L[i + 1]; l = np.hypot(*(b - a))
            if s <= l or i == len(L) - 2:
                u = (b - a) / l; r = np.array([u[1], -u[0]])   # right of travel in (x east, n north)
                return a + u * s + r * off
            s -= l
    return at
TEE_COL = {'marlin': '#1b3a6b', 'manta': '#2f7fb8', 'turtle': '#3f8f5a', 'clownfish': '#e07b2a', 'shark': '#555555'}
def tees_on(ax, k, hole):
    at = lineframe(k)
    for tid, sp in CHK['tees'][str(hole)].items():
        p = at(*sp); ax.plot(*p, 's', ms=5 if tid != 'shark' else 4, mfc=TEE_COL[tid] if tid != 'shark' else 'white', mec=TEE_COL[tid], mew=1.2)
def green_on(ax, k, s, rx, rz):
    at = lineframe(k); c = at(s); d = at(s + 1) - c; ang = math.degrees(math.atan2(d[1], d[0]))
    ax.add_patch(Ellipse(c, 2 * rz, 2 * rx, angle=ang, fc='#5fb35a', ec='#2d6b2a', lw=0.8))
    ax.plot(*c, 'k+', ms=6)
def legend(fig, extra=()):
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    h = [Patch(fc=COL['grass'], ec='none', label='salt grass / fairway'), Patch(fc=COL['rough'], ec='none', label='rough'), Patch(fc=COL['sand'], ec='#ccc', label='dry sand'),
         Patch(fc=COL['wet'], ec='none', label='wet sand (dry at this tide)'), Patch(fc='#9fe3dc', ec='none', label='sea'), Patch(fc='#9c9588', ec='none', label='cliff, rock'),
         Line2D([], [], color='#1d5f73', ls=':', lw=0.8, label="the other tide's waterline")] + [Line2D([], [], marker='s', ls='', mfc=TEE_COL[t], mec=TEE_COL[t], label=t.capitalize()) for t in ['marlin', 'manta', 'turtle', 'clownfish']] + \
        [Line2D([], [], marker='s', ls='', mfc='white', mec='#555', label='Shark (tips, off)')] + list(extra)
    fig.legend(handles=h, loc='lower center', ncol=6, fontsize=7.2, frameon=False)

def hole3():
    fig, axs = plt.subplots(1, 2, figsize=(11.4, 5.0), dpi=150)
    G = {'s': 183, 'rx': 13.5, 'rz': 18}
    for ax, tide in zip(axs, ['low', 'high']):
        draw_map(ax, 'h3', tide, title=('Low water: the tongue is dry' if tide == 'low' else 'High water: all carry'))
        lines_on(ax, [1, 2, 3], label=False); green_on(ax, 2, **G); tees_on(ax, 2, 3)
        r = CHK['h3']['res'][tide]
        at = lineframe(2)
        for tid in ['marlin', 'clownfish']:
            sp = CHK['tees']['3'][tid]; t = at(*sp); pin = at(183); u = (pin - t) / np.hypot(*(pin - t))
            d = r[tid]['allCarry'] * YD
            ax.annotate('', xy=t + u * d, xytext=t, arrowprops=dict(arrowstyle='->', color=TEE_COL[tid], lw=1.3))
            ax.text(*(t + u * d * 0.5 + np.array([0, -14 if tid == 'marlin' else 10])), f"{r[tid]['allCarry']} yd carry", color=TEE_COL[tid], fontsize=8, ha='center', fontweight='bold')
        scalebar(ax, [640, 960, 300, 560], 50)
        ax.text(*at(183, -26), 'green on the beach\nunder the cliff', fontsize=7, ha='center')
        ax.text(*at(135, -45), 'the tongue' if tide == 'low' else 'the tongue,\n0.2-1.9 m under', fontsize=7.5, ha='center', style='italic')
        ax.text(*at(-10, -50), 'the islet\n(2nd green)', fontsize=7, ha='center')
    legend(fig); fig.tight_layout(rect=[0, 0.07, 1, 1]); fig.savefig(os.path.join(FIG, 'h3.png')); plt.close(fig)
    # the profile along the line
    fig, ax = plt.subplots(figsize=(11.4, 2.3), dpi=150)
    P = np.array(CHK['h3']['prof']); s = P[:, 0] / YD
    ax.fill_between(s, -3, P[:, 1], color='#e9dcb5'); ax.plot(s, P[:, 1], color='#7a6a40', lw=1)
    for lvl, c, lab in [(0, '#2f8fa3', 'low water'), (2.4, '#1d5f73', 'high water')]:
        ax.fill_between(s, P[:, 1], lvl, where=P[:, 1] < lvl, color=c, alpha=0.25); ax.axhline(lvl, color=c, lw=0.8, ls='--'); ax.text(s[-1], lvl + 0.1, lab, color=c, fontsize=7, ha='right')
    ax.set_xlim(s[0], s[-1]); ax.set_ylim(-3, 7); ax.set_xlabel('yards from the Marlin tee along the line'); ax.set_ylabel('m above low water', fontsize=8)
    ax.text(105, 0.8, 'tongue', fontsize=8); ax.text(196, 5.4, 'green', fontsize=8, ha='center')
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'h3prof.png')); plt.close(fig)

def hole5():
    fig, axs = plt.subplots(1, 2, figsize=(11.4, 4.6), dpi=150)
    at = lineframe(4)
    for ax, tide in zip(axs, ['low', 'high']):
        draw_map(ax, 'h5', tide, title=('Low water' if tide == 'low' else 'High water'))
        lines_on(ax, [3, 4, 5], label=False); green_on(ax, 4, 366, 12, 14.5); tees_on(ax, 4, 5)
        r = CHK['h5']['res'][tide]['marlin']; p = at(r['s'])
        ax.plot(*p, 'o', color='#1b3a6b', ms=5)
        a, b = at(r['s'], r['right']), at(r['s'], -r['left'])
        ax.plot([a[0], b[0]], [a[1], b[1]], '-', color='#1b3a6b', lw=1.2)
        ax.text(*(a + np.array([4, 6])), f"{r['waterR']} yd to the sea", fontsize=7.5, color='#1b3a6b')
        ax.text(*(b + np.array([-4, -14])), f"{r['waterL']} yd", fontsize=7.5, color='#1b3a6b', ha='right')
        ax.text(*at(140, 52), 'open sea (north)', fontsize=7.5, style='italic', ha='center')
        ax.text(*at(140, -100), 'the bay (south)', fontsize=7.5, style='italic', ha='center')
        scalebar(ax, [560, 1040, 900, 1200], 50)
    legend(fig); fig.tight_layout(rect=[0, 0.08, 1, 1]); fig.savefig(os.path.join(FIG, 'h5.png')); plt.close(fig)
    # the section where drives land
    S = CHK['h5']['sec']; o = np.array([q[0] for q in S]); y = np.array([q[1] for q in S]); t = [q[2] for q in S]
    fig, ax = plt.subplots(figsize=(11.4, 2.5), dpi=150)
    for i in range(len(o) - 1):
        c = {'grass': '#b6d68a', 'rough': '#8fb866', 'sand': '#f2e6c4', 'wet': '#e2cf9c', 'sea': '#e2cf9c'}[t[i]]
        ax.fill_between(o[i:i + 2], -4.5, y[i:i + 2], color=c, lw=0)
    ax.plot(o, y, color='#7a6a40', lw=1)
    for lvl, c, lab in [(0, '#2f8fa3', 'low water'), (2.4, '#1d5f73', 'high water')]:
        ax.fill_between(o, y, lvl, where=y < lvl, color=c, alpha=0.25); ax.axhline(lvl, color=c, lw=0.8, ls='--'); ax.text(o[0] + 2, lvl + 0.12, lab, color=c, fontsize=7)
    for x, lab in [(0, 'fairway 42 m'), (-30, 'rough'), (-49, 'dry'), (30, 'dry'), (54, 'wet sand'), (-72, 'wet sand')]:
        ax.text(x, 3.8, lab, fontsize=7, ha='center')
    ax.set_xlim(-120, 120); ax.set_ylim(-4.5, 4.6); ax.invert_xaxis()
    ax.set_xlabel('metres across the line where drives land, 220 yd out (left: the open sea, north · right: the bay, south)', fontsize=8); ax.set_ylabel('m', fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'h5sec.png')); plt.close(fig)

def hole9():
    fig, axs = plt.subplots(1, 2, figsize=(11.4, 4.7), dpi=150)
    at = lineframe(8)
    R = np.array(CHK['h9']['routes'])
    for ax, tide in zip(axs, ['low', 'high']):
        draw_map(ax, 'h9', tide, title=('Low water: across the flats' if tide == 'low' else 'High water: along the spit'))
        lines_on(ax, [6, 7, 8], label=False); green_on(ax, 8, 498, 14.5, 18.5); tees_on(ax, 8, 9)
        if tide == 'high':
            ax.plot(R[:, 0], R[:, 1], '--', color='#7b1d14', lw=1.2)
        r = CHK['h9']['res'][tide]['sets']['marlin']
        ax.text(*at(410, -70), 'cave', fontsize=7.5, ha='center'); ax.text(*at(530, -70), 'lagoon', fontsize=7.5, ha='center', style='italic')
        ax.text(*at(330, -120), 'creek', fontsize=7.5, ha='center', style='italic')
        ax.text(*at(110, 150), 'sea stack (8th)', fontsize=7, ha='center')
        scalebar(ax, [60, 680, 520, 880], 100)
    legend(fig); fig.tight_layout(rect=[0, 0.08, 1, 1]); fig.savefig(os.path.join(FIG, 'h9.png')); plt.close(fig)
    fig, ax = plt.subplots(figsize=(11.4, 2.4), dpi=150)
    P = np.array(CHK['h9']['prof']); s = P[:, 0] / YD; y = np.minimum(P[:, 1], 60)
    ax.fill_between(s, -3, y, color='#e9dcb5'); ax.plot(s, y, color='#7a6a40', lw=1)
    cv = P[:, 2] == 1; ax.fill_between(s, 43, 60, where=cv, color='#9c9588'); ax.text(s[cv].mean(), 50, 'cave roof 43 m', ha='center', fontsize=7.5)
    for lvl, c, lab in [(0, '#2f8fa3', 'low water'), (2.4, '#1d5f73', 'high water')]:
        ax.fill_between(s, y, lvl, where=y < lvl, color=c, alpha=0.25); ax.axhline(lvl, color=c, lw=0.8, ls='--'); ax.text(s[0] + 2, lvl + 0.4, lab, color=c, fontsize=7)
    for q, c in zip(CHK['h9']['shots'], ['#c0392b', '#8e44ad', '#2c7a3f']):
        T = np.array(q['pts']); ax.plot(T[:, 0] / YD, T[:, 1], '-', color=c, lw=1, label=f"{q['name']}: {q['clearance']} m under the roof")
    ax.legend(fontsize=7, loc='upper left', frameon=False)
    ax.set_xlim(s[0], s[-1]); ax.set_ylim(-3, 60); ax.set_xlabel('yards from the Marlin tee along the line (the low-water route)'); ax.set_ylabel('m', fontsize=8)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, 'h9prof.png')); plt.close(fig)

if __name__ == '__main__':
    if len(sys.argv) == 1: bay(); hole3(); hole5(); hole9()
    for f in sys.argv[1:]: globals()[f]()
