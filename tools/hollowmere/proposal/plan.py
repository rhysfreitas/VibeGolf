# shared drawing for the Hollowmere proposal: a plan of a sampled grid in its hole frame (tee at the bottom), white page
import json, numpy as np, matplotlib
matplotlib.use('Agg')
from matplotlib.colors import LightSource
B = '/tmp/claude-0/book'
COL = {'void': (0.30, 0.30, 0.33), 'tee': (0.55, 0.78, 0.42), 'fairway': (0.47, 0.72, 0.33), 'fringe': (0.55, 0.78, 0.40),
       'firstcut': (0.40, 0.58, 0.30), 'rough': (0.33, 0.47, 0.27), 'desert': (0.70, 0.62, 0.52), 'sand': (0.94, 0.87, 0.64),
       'waste': (0.82, 0.71, 0.52), 'water': (0.35, 0.58, 0.80), 'green': (0.62, 0.88, 0.45), 'rock': (0.56, 0.53, 0.50)}
SETC = {'eagle': '#2f5fa8', 'hawk': '#ffffff', 'swift': '#c94a3a', 'wren': '#e0b84a'}
def load(tag, n):
    m = json.load(open(f'{B}/{tag}_h{n}.json')); raw = open(f'{B}/{tag}_h{n}.bin', 'rb').read(); nx, nz = m['nx'], m['nz']
    H = np.frombuffer(raw[:nx * nz * 4], dtype=np.float32).reshape(nz, nx).copy(); S = np.frombuffer(raw[nx * nz * 4:], dtype=np.uint8).reshape(nz, nx)
    return m, H, S
def plan(ax, tag, n, title=None, contours=2, marks=True, extra=None):
    m, H, S = load(tag, n); x0, x1, z0, z1, res = m['box']
    pal = np.array([COL[s] for s in m['SURF']]); rgb = pal[S].copy()
    hf = np.where(np.isnan(H), np.nanmin(H) - 8, H)
    sh = LightSource(azdeg=315, altdeg=45).hillshade(hf, vert_exag=2.0, dx=res, dy=res)
    rgb = rgb * (0.62 + 0.38 * sh[..., None])
    rgb[np.isnan(H)] = COL['void']
    # rows run z0 -> z1 (downrange is -z): plot with -z up, so flip
    ext = [x0, x1, -z1, -z0]
    ax.imshow(rgb, extent=ext, interpolation='bilinear', origin='upper')
    if contours:
        Hm = np.ma.masked_invalid(H); lo, hi = np.nanmin(H), np.nanmax(H)
        lv = np.arange(np.floor(lo / contours) * contours, hi + contours, contours)
        if len(lv) > 1: ax.contour(x0 + (np.arange(m['nx']) + 0.5) * res, -(z0 + (np.arange(m['nz']) + 0.5) * res), Hm, levels=lv, colors='k', linewidths=0.25, alpha=0.35)
    if marks:
        L = np.array(m['line']); ax.plot(L[:, 0], -L[:, 1], color='white', lw=0.8, ls=(0, (4, 3)), alpha=0.9)
        for k, p in m['tees'].items(): ax.plot(p[0], -p[1], 's', ms=5, mfc=SETC.get(k, 'w'), mec='k', mew=0.6)
        if m.get('tips'): t = m['tips']['tee']; ax.plot(t[0], -t[1], 'D', ms=6, mfc='#23272d', mec='white', mew=0.8)
        ax.plot(m['pin'][0], -m['pin'][1], marker='^', ms=6, mfc='#d33', mec='k', mew=0.6)
        for t in m['targets']:
            if t.get('pin'): continue
            ax.plot(t['x'], -t['z'], 'x', ms=6, mew=1.4, color='#c0392b' if t.get('bold') else 'white')
        for g in m['groves']: ax.add_patch(matplotlib.patches.Circle((g[0], -g[1]), g[2], fill=False, ec='#8e44ad', lw=0.8, ls='--'))
        for r in m['rocks']:
            if r[3] == 'hoodoo': ax.plot(r[0], -r[1], 'o', ms=1.6, color='#3d3d3d')
    if extra: extra(ax, m)
    ax.set_xlim(x0, x1); ax.set_ylim(-z1, -z0); ax.set_aspect('equal')
    ax.tick_params(labelsize=6); ax.set_xlabel('m across (+ right)', fontsize=6); ax.set_ylabel('m downrange', fontsize=6)
    if title: ax.set_title(title, fontsize=9, loc='left')
    return m, H, S
