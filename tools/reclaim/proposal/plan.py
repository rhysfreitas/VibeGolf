# python3 plan.py now.json [prop.json] hole out.png [title]: the hole's plan (surfaces, 1 m contours, objects, line,
# tees, targets, each tee set's drive), now beside proposed at the same scale. White page.
import json, sys, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, Ellipse
COL = {'street': (0.86, 0.85, 0.82), 'rough': (0.76, 0.84, 0.64), 'fairway': (0.55, 0.78, 0.42), 'fringe': (0.62, 0.84, 0.48),
       'green': (0.40, 0.75, 0.38), 'tee': (0.62, 0.82, 0.50), 'sand': (0.96, 0.91, 0.70), 'water': (0.66, 0.80, 0.92),
       'rubble': (0.80, 0.75, 0.68), 'stands': (0.82, 0.80, 0.76), 'deck': (0.78, 0.78, 0.78), 'building': (0.70, 0.69, 0.68), 'void': (0.22, 0.22, 0.24)}
INK = '#2b2b2b'; YD = 0.9144
DRIVE = {'spire': 260, 'brick': 230, 'ivy': 200, 'moss': 150}
TCOL = {'spire': '#2f5fa8', 'brick': '#8a8577', 'ivy': '#c94a3a', 'moss': '#d4a017', 'tips': '#111111'}
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 7})
args = sys.argv[1:]
nowD = json.load(open(args[0])); prop = json.load(open(args[1])) if args[1] != '-' else None; n = args[2]; out = args[3]; title = args[4] if len(args) > 4 else ''
def panel(ax, H, sub, bounds):
    S = np.array(H['S']).reshape(H['nz'], H['nx']); Y = np.array([np.nan if v is None else v for v in H['Y']], float).reshape(H['nz'], H['nx'])
    pal = np.array([COL[s] for s in H['SURF']]); img = pal[S]
    # light hillshade from the ground
    gy, gx = np.gradient(np.nan_to_num(Y, nan=np.nanmin(Y)), H['C'])
    shade = np.clip(1 - 0.9 * (gx * -0.6 + gy * -0.6), 0.75, 1.08)[..., None]
    img = np.clip(img * shade, 0, 1)
    ext = [H['x0'] - 1, H['x0'] + H['C'] * (H['nx'] - 1) + 1, H['z0'] + H['C'] * (H['nz'] - 1) + 1, H['z0'] - 1]
    ax.imshow(img, extent=ext, interpolation='nearest', zorder=0)
    xs = H['x0'] + H['C'] * np.arange(H['nx']); zs = H['z0'] + H['C'] * np.arange(H['nz'])
    lv = np.arange(np.floor(np.nanmin(Y)), np.ceil(np.nanmax(Y)) + 1, 1.0)
    cs = ax.contour(xs, zs, Y, levels=lv, colors='#6b5a45', linewidths=0.3, alpha=0.55, zorder=1)
    l5 = lv[lv % 5 == 0]
    if len(l5): ax.contour(xs, zs, Y, levels=l5, colors='#5a4a35', linewidths=0.7, alpha=0.8, zorder=1)
    for o in H['objs']:
        k = o['kind']
        if k == 'bldg': ax.add_patch(Polygon(np.array(o['pts']), fc=(0.58, 0.57, 0.56) if not o.get('open') else (0.82, 0.80, 0.76), ec=INK, lw=0.4, hatch='////' if o.get('open') else None, zorder=6))
        elif k == 'tree': ax.add_patch(Circle((o['x'], o['z']), o['r'], fc=(0.30, 0.48, 0.28), ec=(0.2, 0.32, 0.18), lw=0.2, alpha=0.85, zorder=5))
        elif k == 'box': ax.add_patch(Polygon(np.array(o['pts']), fc=(0.55, 0.42, 0.32), ec=INK, lw=0.2, zorder=5))
        elif k == 'el': P = np.array(o['pts']); ax.plot(P[:, 0], P[:, 1], color='#4a3f35', lw=3, zorder=7)
        elif k == 'span' and not o.get('deck'):
            a, b = np.array(o['a'][:2]), np.array(o['b'][:2]); d = (b - a) / np.linalg.norm(b - a); nn = np.array([-d[1], d[0]]) * o['w'] / 2
            ax.add_patch(Polygon(np.array([a + nn, b + nn, b - nn, a - nn]), fc=(0.6, 0.6, 0.62, 0.45), ec=INK, lw=0.5, ls='--', zorder=7))
    L = np.array(H['line']); ax.plot(L[:, 0], L[:, 1], color=INK, lw=0.7, ls=(0, (4, 3)), zorder=9)
    for k, p in H['teePts'].items():
        ax.plot(*p, marker='s', ms=4.5, color=TCOL[k], mec='k', mew=0.4, zorder=12)
        # where each tee set's drive lands: an arc at its drive length
        r = DRIVE[k] * YD; th = np.linspace(-0.5, 0.5, 40); 
        # direction to the first target that set would aim at: approximate with the line's heading at that distance
        a = np.arctan2(*(np.array(lineAt(L, min(r, 0.999 * llen(L)))) - np.array(p))[::-1] * np.array([1, 1]))
        ang = np.arctan2(lineAt(L, min(r + proj(L, p), llen(L) - 1))[1] - p[1], lineAt(L, min(r + proj(L, p), llen(L) - 1))[0] - p[0])
        ax.plot(p[0] + r * np.cos(ang + th * 0.35), p[1] + r * np.sin(ang + th * 0.35), color=TCOL[k], lw=1.1, zorder=11)
    if H.get('tips'):
        t = H['tips']['tee']; ax.plot(*t, marker='D', ms=4.5, color='white', mec='k', mew=0.8, zorder=12)
    for t in H['targets']:
        ax.plot(*t['at'], marker='*' if t['bold'] else 'o', ms=7 if t['bold'] else 4.5, color='#c0392b' if t['bold'] else '#ffffff', mec='k', mew=0.5, zorder=13)
        ax.annotate(t['name'], t['at'], xytext=(5, 4), textcoords='offset points', fontsize=6, zorder=14, bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
    ax.plot(*H['pin'], marker='^', ms=5, color='#c0392b', mec='k', mew=0.4, zorder=13)
    ax.set_xlim(bounds[0], bounds[1]); ax.set_ylim(bounds[3], bounds[2]); ax.set_aspect('equal')
    ax.set_title(sub, fontsize=9, loc='left', color=INK)
    ax.set_xticks([]); ax.set_yticks([])
    for s in ax.spines.values(): s.set_color('#999'); s.set_linewidth(0.5)
def llen(L): return float(np.sum(np.hypot(*np.diff(L, axis=0).T)))
def lineAt(L, s):
    for i in range(len(L) - 1):
        d = L[i + 1] - L[i]; l = np.hypot(*d)
        if s <= l or i == len(L) - 2: return L[i] + d / l * s
        s -= l
def proj(L, p):
    best, bs, acc = 1e9, 0, 0
    for i in range(len(L) - 1):
        a, b = L[i], L[i + 1]; d = b - a; l = np.hypot(*d); t = np.clip(np.dot(np.array(p) - a, d) / l / l, 0, 1); q = a + d * t; dd = np.hypot(*(np.array(p) - q))
        if dd < best: best, bs = dd, acc + t * l
        acc += l
    return bs
A = nowD[n]; Bp = prop[n] if prop else None
xs = [A['x0'], A['x0'] + A['C'] * (A['nx'] - 1)]; zs = [A['z0'], A['z0'] + A['C'] * (A['nz'] - 1)]
pts = [*A['line'], *A['teePts'].values()] + ([Bp['tips']['tee']] if Bp and Bp.get('tips') else [])
L = np.array(pts); bx0, bx1 = L[:, 0].min() - 85, L[:, 0].max() + 85; bz0, bz1 = L[:, 1].min() - 40, L[:, 1].max() + 22
bounds = [max(bx0, xs[0]), min(bx1, xs[1]), max(bz0, zs[0]), min(bz1, zs[1])]
W = bounds[1] - bounds[0]; Hh = bounds[3] - bounds[2]
cols = 2 if Bp else 1
fig, axs = plt.subplots(1, cols, figsize=(7.6 if cols == 2 else 4.2, min(10, 7.4 * Hh / (W * cols) + 0.6)), dpi=200)
axs = np.atleast_1d(axs)
panel(axs[0], A, 'Now', bounds)
if Bp: panel(axs[1], Bp, 'Proposed', bounds)
# a 50 m scale bar
ax = axs[0]; sx, sz = bounds[0] + 8, bounds[3] - 8; ax.plot([sx, sx + 50], [sz, sz], color='k', lw=1.5, zorder=20); ax.text(sx + 25, sz - 4, '50 m', ha='center', fontsize=6, zorder=20)
if title: fig.suptitle(title, fontsize=10, x=0.02, ha='left')
fig.text(0.02, 0.004, 'Squares: tees (blue Spire, grey Brick, red Ivy, gold Moss); white diamond: the tips tee (switched off). Arcs: each set\'s drive length.\nStar: the bold target; circles: the other targets; triangle: the pin. 1 m contours, every 5 m darker. Same scale both sides.', fontsize=5.6, color='#444')
fig.tight_layout(rect=(0, 0.03, 1, 1)); fig.savefig(out, facecolor='white'); print('wrote', out)
