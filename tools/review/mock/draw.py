# Landscape proposal pages in the style of the Halcyon dials-and-heights proposal.
import textwrap, numpy as np, matplotlib
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
from matplotlib.patches import FancyBboxPatch
from scipy import ndimage

COL = {'void': (0.95, 0.96, 0.98), 'tee': (0.62, 0.80, 0.50), 'fairway': (0.52, 0.74, 0.38), 'fringe': (0.60, 0.80, 0.44),
       'firstcut': (0.48, 0.64, 0.36), 'rough': (0.62, 0.70, 0.50), 'desert': (0.86, 0.76, 0.62), 'sand': (0.96, 0.90, 0.70),
       'waste': (0.88, 0.80, 0.66), 'water': (0.45, 0.65, 0.86), 'green': (0.40, 0.78, 0.30), 'rock': (0.66, 0.50, 0.44),
       'ice': (0.78, 0.88, 0.95), 'powder': (0.99, 0.99, 1.0)}
LAVA = (0.95, 0.50, 0.25)
PCOL = dict(COL); PCOL.update({'rough': (0.42, 0.58, 0.30), 'desert': (0.78, 0.62, 0.45), 'green': (0.30, 0.72, 0.22), 'fairway': (0.38, 0.66, 0.24), 'void': (0.75, 0.75, 0.78)})
NEW = '#c2185b'; RED = '#d32f2f'; GREEN = '#2e7d32'
FOOT = ''
PW, PH = 11.0, 8.5

def pal_of(H, P):
    pal = np.array([P.get(s, (1, 0, 1)) for s in H.SURF])
    if H.lava: pal[H.SURF.index('water')] = LAVA
    return pal

def plan_rgb(H):
    hgt = H.h; void = np.isnan(hgt); hf = np.where(void, np.nanmin(hgt) - 5, hgt)
    rgb = pal_of(H, COL)[H.s_].copy()
    shade = LightSource(azdeg=315, altdeg=45).hillshade(hf, vert_exag=1.3, dx=1, dy=1)
    rgb = np.clip(rgb * (0.78 + 0.32 * shade[..., None]), 0, 1)
    rgb[void] = COL['void']
    return rgb

def draw_plan(ax, H, box, title, ref=None, notes=(), show_change=False, lw_line=1.0):
    ext = [H.x0, H.x0 + H.W, H.z0 + H.H, H.z0]
    ax.imshow(plan_rgb(H), extent=ext, interpolation='bilinear')
    lv = np.arange(np.floor(np.nanmin(H.h)), np.nanmax(H.h) + 1, 1)
    if 1 < len(lv) < 400:
        ax.contour(H.X[0], H.Z[:, 0], H.h, levels=lv, colors='k', linewidths=0.2, alpha=0.18)
    g = H.is_('green').astype(float)
    if g.any(): ax.contour(H.X[0], H.Z[:, 0], g, levels=[0.5], colors=['#1b5e20'], linewidths=0.7)
    for t in H.m['trees']: ax.add_patch(plt.Circle((t[0], t[1]), max(2, t[2] * 0.8), color='#2e5d2e', alpha=0.75, lw=0))
    L = np.array(H.line); ax.plot(L[:, 0], L[:, 1], '--', color='#e6a700', lw=lw_line)
    fade = ref is not None and bool(H.tee_marks)
    for s in H.m['teeSets']:
        p = H.m['tees'].get(s['id'])
        if p: ax.plot(p[0], p[1], 'o', ms=4, mfc=s['color'], mec='k', mew=0.5, alpha=0.3 if fade else 1)
    if ref is not None:
        for x, z, lab in H.tee_marks:
            ax.plot(x, z, 's', ms=6, mfc=NEW, mec='white', mew=0.8)
            if lab: ax.annotate(lab, (x, z), xytext=(6, -2), textcoords='offset points', fontsize=6, color=NEW, weight='bold',
                                bbox=dict(boxstyle='round,pad=0.12', fc='white', ec='none', alpha=0.85))
        if show_change:
            dl = np.nan_to_num(H.h - ref.h, nan=0.0); ch = (np.abs(dl) >= 1) | (np.isnan(H.h) != np.isnan(ref.h))
            if ch.any(): ax.contour(H.X[0], H.Z[:, 0], ch.astype(float), levels=[0.5], colors=[NEW], linewidths=0.8, linestyles='--')
    ax.plot(*H.pin, marker='^', ms=6, mfc='white', mec='k', mew=0.6)
    for t in H.m['targets']:
        ax.plot(*t['p'], marker='o', ms=3.2, mfc='#26c6da', mec='k', mew=0.3)
    for (x, z, txt) in notes:
        ax.annotate(txt, (x, z), fontsize=6, color=NEW, weight='bold', ha='center', va='center',
                    bbox=dict(boxstyle='round,pad=0.18', fc='white', ec=NEW, lw=0.5, alpha=0.92))
    ax.set_xlim(box[0], box[1]); ax.set_ylim(box[3], box[2]); ax.set_aspect('equal')
    ax.set_xticks([]); ax.set_yticks([])
    # 50 m scale bar
    x0 = box[0] + 0.06 * (box[1] - box[0]); y0 = box[3] - 0.03 * (box[3] - box[2])
    ax.plot([x0, x0 + 50], [y0, y0], color='k', lw=1.2); ax.text(x0 + 25, y0, '50 m', fontsize=5.5, ha='center', va='bottom')
    for s in ax.spines.values(): s.set_color('#888'); s.set_linewidth(0.6)
    ax.set_title(title, fontsize=8.5, loc='left', color='#222')

def path_points(H, s0, s1, path):
    if path is None:
        ss = np.arange(s0, s1, 1.0); P = [H.at(s) for s in ss]
    else:
        P = []; ss = []; acc = 0.0
        for a, b in zip(path[:-1], path[1:]):
            l = np.hypot(b[0] - a[0], b[1] - a[1])
            for t in np.arange(0, l, 1.0): P.append((a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l)); ss.append(acc + t)
            acc += l
        ss = np.array(ss)
    return np.array(ss), P

def surf_col(H, x, z):
    s = H.surf_at(x, z); c = PCOL.get(s, (0.5, 0.5, 0.5))
    return LAVA if (H.lava and s == 'water') else c

def draw_profile(fig, rect, A, B, s0, s1, path=None, marks=(), title=None):
    ax = fig.add_axes(rect)
    sa, P = path_points(A, s0, s1, path); ha = np.array([A.ground(*p) for p in P])
    hb = np.array([B.ground(*p) for p in P])
    allh = np.concatenate([ha[~np.isnan(ha)], hb[~np.isnan(hb)]])
    L = sa[-1] - sa[0]
    wpx = rect[2] * PW; hpx = rect[3] * PH
    want = L * hpx / wpx / 4.0
    rng = max(want, allh.max() - allh.min() + 6)
    ex = L * hpx / wpx / rng
    mid = (allh.max() + allh.min()) / 2
    lo, hi = mid - rng / 2, mid + rng / 2
    ax.fill_between(sa, lo, np.where(np.isnan(hb), lo, hb), color='#eef3e6', lw=0)
    ax.plot(sa, ha, color=RED, lw=0.9, label='now')
    for i in range(len(sa) - 1):
        if not (np.isnan(hb[i]) or np.isnan(hb[i + 1])):
            ax.plot(sa[i:i + 2], hb[i:i + 2], color=surf_col(B, *P[i]), lw=2.4, solid_capstyle='butt')
    ax.plot([], [], color=GREEN, lw=2.4, label='proposed')
    # tees and the pin
    def proj(pt):
        d = [np.hypot(p[0] - pt[0], p[1] - pt[1]) for p in P]; i = int(np.argmin(d)); return sa[i], d[i]
    for s in A.m['teeSets']:
        p = A.m['tees'].get(s['id'])
        if p:
            sp, d = proj(p)
            if d < 12: ax.plot(sp, A.ground(*p) + 0.02 * rng, marker='v', ms=4, mfc=s['color'], mec='k', mew=0.4, alpha=0.5 if B.tee_marks else 1)
    for x, z, lab in B.tee_marks:
        sp, d = proj((x, z))
        if d < 12:
            ax.plot(sp, B.ground(x, z) + 0.02 * rng, marker='v', ms=6, mfc=NEW, mec='white', mew=0.6)
    sp, _ = proj(A.pin); gy = A.ground(*A.pin)
    ax.plot([sp, sp], [gy, gy + 0.12 * rng], color='k', lw=1)
    for s, lab in marks:
        ax.axvline(s, color='#999', lw=0.5, ls=':'); ax.text(s, hi - 0.04 * rng, lab, fontsize=5.5, color='#555', ha='center', va='top')
    ax.set_xlim(sa[0], sa[-1]); ax.set_ylim(lo, hi)
    ax.tick_params(labelsize=5.5); ax.grid(alpha=0.3, lw=0.3)
    ax.set_ylabel('m', fontsize=6)
    ax.legend(fontsize=5.5, loc='upper left', frameon=False)
    cap = (title or 'Along the playing line from the back tee') + (' (metres along it)') + f': now (red), proposed (coloured by surface); heights {ex:.0f}× too tall; the bar is the pin, triangles the tees (pink = moved).'
    fig.text(rect[0], rect[1] - 0.035, cap, fontsize=6.3, color='#444')
    return ax

def draw_cross(ax, A, B, s, half=70):
    oo = np.arange(-half, half, 1.0)
    PA = [A.at(s, o) for o in oo]
    ha = np.array([A.ground(*p) for p in PA]); hb = np.array([B.ground(*p) for p in PA])
    allh = np.concatenate([ha[~np.isnan(ha)], hb[~np.isnan(hb)]])
    lo = allh.min() - 2; hi = allh.max() + 2
    ax.fill_between(oo, lo, np.where(np.isnan(hb), lo, hb), color='#eef3e6', lw=0)
    ax.plot(oo, ha, color=RED, lw=0.9, label='now')
    for i in range(len(oo) - 1):
        if not (np.isnan(hb[i]) or np.isnan(hb[i + 1])): ax.plot(oo[i:i + 2], hb[i:i + 2], color=surf_col(B, *PA[i]), lw=2.2, solid_capstyle='butt')
    ax.plot([], [], color=GREEN, lw=2.2, label='proposed')
    ax.set_ylim(lo, hi); ax.set_xlim(-half, half)
    ax.set_title(f'{s:.0f} m out (metres left −, right +)', fontsize=6.5, loc='left'); ax.tick_params(labelsize=5.5); ax.grid(alpha=0.3, lw=0.3)
    ax.legend(fontsize=5.5, loc='upper left', frameon=False)

def chip(fig, x, y, txt):
    t = fig.text(x, y, txt, fontsize=8.5, color=GREEN, weight='bold', va='center',
                 bbox=dict(boxstyle='round,pad=0.25,rounding_size=0.6', fc='#f1f8ee', ec=GREEN, lw=0.8))
    fig.canvas.draw(); bb = t.get_window_extent(); W = fig.get_window_extent().width
    return x + bb.width / W + 0.012

def footer(fig, n):
    fig.text(0.04, 0.025, FOOT, fontsize=6.5, color='#888'); fig.text(0.96, 0.025, str(n), fontsize=6.5, color='#888', ha='right')

PAGE_NO = [1]

def hpage(pdf, A, B, title, chips, asks, body, box, prof=None, cross=(), path=None, path_title=None, marks=(),
          notes_now=(), notes_new=(), detail=None):
    """one hole: title and chips, what it asks, the profile on top, the plans now and proposed, the words and a
    cross-section or close-up on the right"""
    fig = plt.figure(figsize=(PW, PH)); fig.patch.set_facecolor('white')
    t = fig.text(0.04, 0.945, title, fontsize=16, weight='bold', va='center')
    fig.canvas.draw(); x = 0.04 + t.get_window_extent().width / fig.get_window_extent().width + 0.012
    for c in chips: x = chip(fig, x, 0.945, c)
    fig.text(0.04, 0.905, '\n'.join(textwrap.wrap('Asks: ' + asks, 190)), fontsize=8, va='top')
    s0, s1 = prof or (-15, A.len + 20)
    draw_profile(fig, [0.07, 0.64, 0.86, 0.2], A, B, s0, s1, path, marks, path_title)
    h = 0.5; y = 0.065
    a1 = fig.add_axes([0.03, y, 0.29, h]); a2 = fig.add_axes([0.33, y, 0.29, h])
    draw_plan(a1, A, box, 'Now', notes=notes_now)
    draw_plan(a2, B, box, 'Proposed', ref=A, notes=notes_new, show_change=True)
    for s, lab in marks:
        x, z = B.at(s, 0); a2.plot(x, z, marker='o', ms=3, color=NEW)
        a2.annotate(lab, (x, z), xytext=(10, 0), textcoords='offset points', fontsize=6, color=NEW, weight='bold', va='center',
                    bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.85))
    for s in cross:
        p0, p1 = A.at(s, -70), A.at(s, 70)
        for ax in (a1, a2): ax.plot([p0[0], p1[0]], [p0[1], p1[1]], color='#555', lw=0.6, ls='-.')
    if path is not None:
        Pp = np.array(path)
        for ax in (a1, a2): ax.plot(Pp[:, 0], Pp[:, 1], color='#00838f', lw=0.9, ls='-.')
    # the words
    yy = 0.565
    for para in body:
        lines = textwrap.wrap(para, 64)
        fig.text(0.645, yy, '\n'.join(lines), fontsize=7.8, va='top', linespacing=1.35)
        yy -= 0.0215 * len(lines) + 0.014
    # bottom right: cross-sections or a close-up of the green
    bottom = 0.075; top = min(yy - 0.03, 0.33)
    if cross:
        n = len(cross); w = 0.31 / n
        for i, s in enumerate(cross):
            ax = fig.add_axes([0.665 + i * w, bottom + 0.03, w - 0.035, top - bottom - 0.05]); draw_cross(ax, A, B, s, half=60 if n == 1 else 50)
        fig.text(0.645, bottom - 0.005, 'Across the line (dash-dot on the plans), now and proposed, looking down the hole.', fontsize=6.3, color='#444')
    elif detail is not None:
        hgt = top - bottom - 0.03; w = 0.15
        d1 = fig.add_axes([0.645, bottom + 0.02, w, hgt]); d2 = fig.add_axes([0.645 + w + 0.01, bottom + 0.02, w, hgt])
        draw_plan(d1, A, detail, 'Close-up, now', lw_line=0.6); draw_plan(d2, B, detail, 'Close-up, proposed', ref=A, lw_line=0.6)
        for ax in (d1, d2): ax.title.set_fontsize(7)
    footer(fig, PAGE_NO[0]); PAGE_NO[0] += 1
    pdf.savefig(fig); plt.close(fig)

def green_box(H, pad=18):
    g = H.is_('green'); xs, zs = H.X[g], H.Z[g]
    cx, cz = (xs.min() + xs.max()) / 2, (zs.min() + zs.max()) / 2
    r = max(xs.max() - xs.min(), zs.max() - zs.min()) / 2 + pad
    return (cx - r, cx + r, cz - r * 1.25, cz + r * 1.25)

def merge_boxes(a, b):
    return (min(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), max(a[3], b[3]))
