import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import draw
from mock import *
from matplotlib.backends.backend_pdf import PdfPages
import importlib, textwrap

def summary(pdf, title, intro, mods):
    fig = plt.figure(figsize=(draw.PW, draw.PH)); fig.patch.set_facecolor('white')
    fig.text(0.04, 0.95, title, fontsize=17, weight='bold', va='center')
    fig.text(0.04, 0.915, '\n'.join(textwrap.wrap(intro, 200)), fontsize=7.6, va='top', color='#333', linespacing=1.4)
    cols = [(0.04, 'Hole'), (0.205, 'Yards'), (0.27, 'What changes'), (0.62, 'Height form or dial'), (0.77, 'Set piece'), (0.885, 'Cost')]
    y = 0.835
    for x, h in cols: fig.text(x, y, h, fontsize=7.2, weight='bold', color='#555')
    y -= 0.008; fig.add_artist(plt.Line2D([0.04, 0.96], [y, y], color='#999', lw=0.6, transform=fig.transFigure)); y -= 0.02
    for M in mods:
        fig.text(0.04, y, M.TITLE, fontsize=9, weight='bold'); fig.text(0.13, y, M.NOTE, fontsize=6.6, color='#555', va='center'); y -= 0.022
        for r in M.ROWS:
            for (x, _), v in zip(cols, r): fig.text(x, y, v, fontsize=7.2, va='center')
            y -= 0.0185
        y -= 0.008
    fig.text(0.04, 0.05, 'Pages after this: each hole that changes, its profile along the playing line and its plan, now and proposed at one scale. These are quick edits of the real ground sampled from the game, '
             'not built geometry:\nshapes and numbers are close, not exact. Nothing has been built or changed. Cost: tees = tees and yardage only; green = the green and its surrounds; sand = bunkers; ground = landforms reshaped.',
             fontsize=6.8, color='#444', linespacing=1.4)
    draw.footer(fig, draw.PAGE_NO[0]); draw.PAGE_NO[0] += 1
    pdf.savefig(fig); plt.close(fig)

if __name__ == '__main__':
    out, title, intro = sys.argv[1], sys.argv[2], sys.argv[3]
    mods = [importlib.import_module(m) for m in sys.argv[4:]]
    draw.FOOT = title + ' · proposal · 12 November 2026'
    with PdfPages(out) as pdf:
        summary(pdf, title, intro, mods)
        for M in mods:
            for f in M.PAGES: f(pdf)
    print(out, draw.PAGE_NO[0] - 1, 'pages')
