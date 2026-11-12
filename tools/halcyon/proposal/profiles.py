# python3 tools/halcyon/proposal/profiles.py : the height-form proposal's profiles, now and proposed at one scale
# (out/heights/now.json and proposed.json from heights.mjs). Side profiles along the playing line, heights drawn
# four times too tall as on docs/height-forms.png; cross-sections at the landing area for the 1st and the 6th.
import json, os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'out', 'heights')
A = json.load(open(os.path.join(OUT, 'now.json'))); B = json.load(open(os.path.join(OUT, 'proposed.json')))
COL = {'fairway': '#7cbf5a', 'fringe': '#7cbf5a', 'green': '#4fa83a', 'tee': '#9fcf80', 'sand': '#e0c890', 'water': '#5fa0d0', 'window': '#1a1f38', 'stone': '#9b958a'}
def draw(ax, H, col, lw, label, fill=False):
    xs = [p[0] for p in H['along']]; ys = [p[1] for p in H['along']]
    if fill: ax.fill_between(xs, ys, min(ys) - 30, color='#eef3e6', zorder=0)
    ax.plot(xs, ys, color=col, lw=lw, label=label, zorder=3)
    if fill:
        for (x0, y0, s0), (x1, y1, s1) in zip(H['along'], H['along'][1:]):
            c = COL.get(s0)
            if c: ax.plot([x0, x1], [y0, y1], color=c, lw=4.5, solid_capstyle='butt', zorder=2)
for a, b in zip(A, B):
    n = a['n']
    fig, ax = plt.subplots(figsize=(9, 2.6), dpi=170); fig.patch.set_facecolor('white')
    draw(ax, b, '#1f5f2a', 1.4, 'proposed', fill=True); draw(ax, a, '#b03a2e', 1.1, 'now')
    ax.plot([b['along'][-1][0] - 25] * 2, [b['along'][-1][1] - 0, b['along'][-1][1] + 6], color='#333', lw=0.8)
    ys = [p[1] for p in a['along'] + b['along']]; lo, hi = min(ys) - 4, max(ys) + 8
    ax.set_ylim(lo, hi); ax.set_xlim(-10, b['along'][-1][0])
    ax.set_aspect(4 * 0.9144 / 0.9144 * 1.0)   # heights 4x
    ax.set_aspect(4)
    ax.set_xlabel('metres from the back tee along the line', fontsize=7); ax.set_ylabel('m', fontsize=7)
    ax.tick_params(labelsize=6); ax.grid(color='#ddd', lw=0.4); ax.legend(fontsize=6.5, loc='upper left', frameon=False)
    ax.axvline(b['sL'], color='#888', lw=0.6, ls=':'); ax.text(b['sL'] + 2, hi - 2.5, 'landing area', fontsize=6, color='#666')
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, f'prof{n}.png'), facecolor='white'); plt.close(fig)
    fig, ax = plt.subplots(figsize=(4.2, 2.2), dpi=170); fig.patch.set_facecolor('white')
    for H, col, lab in ((a, '#b03a2e', 'now'), (b, '#1f5f2a', 'proposed')):
        ax.plot([p[0] for p in H['across']], [p[1] for p in H['across']], color=col, lw=1.3, label=lab)
    ax.set_aspect(2); ax.set_xlabel('metres across, at the landing area (left −, right +)', fontsize=6.5); ax.tick_params(labelsize=6)
    ax.grid(color='#ddd', lw=0.4); ax.legend(fontsize=6, frameon=False)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    fig.tight_layout(); fig.savefig(os.path.join(OUT, f'across{n}.png'), facecolor='white'); plt.close(fig)
print('profiles written')
