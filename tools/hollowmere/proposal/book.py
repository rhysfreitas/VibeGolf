# The Hollowmere proposal, round 1: white pages, now beside proposed at the same scale
import json, sys, textwrap, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
sys.path.insert(0, '/tmp/claude-0/book')
from plan import plan, load, B
G = json.load(open(f'{B}/gate.json'))           # gate and decision numbers, filled from design.mjs
NOW = json.load(open(f'{B}/nums-now.json')); PROP = json.load(open(f'{B}/nums-prop.json'))
W, H = 11, 8.5
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 8})

def page():
    f = plt.figure(figsize=(W, H)); f.patch.set_facecolor('white'); return f
def head(f, t, sub=None):
    f.text(0.04, 0.955, t, fontsize=15, weight='bold')
    if sub: f.text(0.04, 0.925, sub, fontsize=9, color='#444')
def words(f, x, y, w, blocks, size=7.6, gap=0.012):
    """blocks: [(heading, text)], wrapped to w (fraction of the page)"""
    chars = int(w * W * 72 / (size * 0.52))
    for hd, tx in blocks:
        if hd: f.text(x, y, hd, fontsize=size + 0.8, weight='bold'); y -= 0.022
        for para in tx.split('\n'):
            for line in textwrap.wrap(para, chars) or ['']:
                f.text(x, y, line, fontsize=size); y -= size * 0.0022
            y -= 0.004
        y -= gap
    return y
def widths(ax, n):
    a, b = NOW['holes'][str(n)], PROP['holes'][str(n)]
    s = np.linspace(0, 1, len(a['w']))
    ax.plot(s, np.array(a['w']) * a['meanW'], color='#888', lw=1.4, label=f"now: {a['form']}")
    ax.plot(s, np.array(b['w']) * b['meanW'], color='#2a7a2a', lw=1.8, label=f"proposed: {b['form']}")
    ax.set_xlabel('along the fairway, first to last (share of its length)', fontsize=6.5); ax.set_ylabel('width, m', fontsize=6.5)
    ax.tick_params(labelsize=6); ax.legend(fontsize=6.5, frameon=False, loc='upper left'); ax.grid(alpha=0.25)
    ax.set_title('Fairway width along the line (what alike.mjs measures)', fontsize=7.5, loc='left')
def profile(ax, n, tags=(('now', '#888', 'now'), ('prop', '#2a7a2a', 'proposed'))):
    for tag, c, lab in tags:
        m, _, _ = load(tag, n); p = np.array([[a, b if b is not None else np.nan] for a, b in m['prof']], dtype=float)
        ax.plot(p[:, 0], p[:, 1], color=c, lw=1.4, label=lab)
    ax.set_xlabel('m along the line from the Eagle tee', fontsize=6.5); ax.set_ylabel('height, m', fontsize=6.5)
    ax.tick_params(labelsize=6); ax.legend(fontsize=6.5, frameon=False); ax.grid(alpha=0.25)
    ax.set_title('Profile along the playing line', fontsize=7.5, loc='left')
def land(n, tag):
    d = (NOW if tag == 'now' else PROP)['holes'][str(n)]['land']
    return ' / '.join(str(d[k]['w']) for k in ('eagle', 'hawk', 'swift', 'wren'))
KEY = 'Squares: tees (blue Eagle, white Hawk, red Swift, gold Wren). Black diamond: the tips spot (switched off). White x: targets; red x: a bold target. Red triangle: pin. Purple rings: mushroom groves. Dark dots: stalagmites. Grey: cave wall and rock; dark grey: the Deep. Contours every 2 m. Dashed white: the playing line.'

with PdfPages(f'{B}/hollowmere-proposal-r1.pdf') as pdf:
    # ---------- cover and summary ----------
    f = page(); head(f, 'Hollowmere: reshaping proposal, round 1', '11 November 2026 · from claude/brief-hollowmere-rework.md and the tips-tee addendum · nothing on these pages is in the game until you approve it')
    y = words(f, 0.04, 0.87, 0.44, [
        ('Already in the game (data only, nothing in the ground moved; ed57bc8, deployed)', G['done']),
        ('Proposed, waiting for you', 'Two fairways reshaped (pages 2–5):\n• 1 The Adit, a spindle, becomes a fan: a narrow throat where the breakdown slope meets the floor, opening out as the hall does.\n• 8 Glowworm Grotto, a spindle, becomes a funnel: broad where the drive lands round the mushrooms, closing in up the ridge to the punchbowl.\nThe brief offered 1 and 8 or 1 and 9. I chose 1 and 8: it breaks the 8th and 9th running back to back as spindles, and the 9th\'s shape is tied to its fin and eyelet, which are its decision.\nTips ground on four holes (page 6): a shelf behind the 2nd tee, the 4th\'s ledge run back, a level shelf cut into the back of the 6th\'s knoll, and the 7th\'s first fairway run on 12 m. The 8th\'s tips spot goes with its new fairway.\nOne option on the 8th: lower its blind crest so the landing area comes into view.'),
        ('What I did not change', 'The par 3s already play 30 yd apart as they play (Mirror Lake ~149 yd down 19 m, the Geode ~179 yd up 12 m), so no tee moves. The par 4 range is 343–446 yd; the rule wants one at 340 or less: three yards, left alone. The two blind tee shots (the Geode by design, the 8th) are inside the limit of two.'),
    ])
    ax = f.add_axes([0.50, 0.50, 0.47, 0.37]); ax.axis('off')
    rows = [['', 'now', 'proposed'],
            ['Fairway forms (par 4s and 5s)', NOW['forms'] if 'forms' in NOW else ' '.join(f"{k} {v['form']}" for k, v in NOW['holes'].items()), ' '.join(f"{k} {v['form']}" for k, v in PROP['holes'].items())],
            ['Plain strips (two at most)', '4 (1, 4, 8, 9)', '2 (4, 9)'],
            ['Pairs that measure alike (under 0.25)', '4: 1-4, 1-8, 1-9, 8-9', 'none (closest 4-9, 0.26)'],
            ['Same form two holes running', '8 and 9', 'none'],
            ['Alike with fairways on other courses', '26 pairs', '9 pairs'],
            ['Gate: worst hole for its player', G['worst_before'], G['worst_after']],
            ['Tips tees in the data', '4 of 9, 1,574 yd', '9 of 9, 3,674 yd'],
            ['Blind tee shots', '2 (5, 8)', '2, or 1 if the 8th\'s crest is lowered']]
    for r in rows: r[1:] = [textwrap.fill(c, 30) for c in r[1:]]
    t = ax.table(cellText=rows, cellLoc='left', colWidths=[0.34, 0.33, 0.33], loc='upper left')
    t.auto_set_font_size(False); t.set_fontsize(7)
    for (r, c), cell in t.get_celld().items():
        cell.set_edgecolor('#bbb'); cell.set_height(0.16 if r == 1 else 0.095)
        if r == 0: cell.set_text_props(weight='bold'); cell.set_facecolor('#f0f0f0')
    words(f, 0.52, 0.42, 0.44, [('Tips tees, all nine (Condor, switched off: nothing shows in the game)', G['tips_table']),
                                 ('How to read the plans', KEY)], size=7.2)
    pdf.savefig(f); plt.close(f)

    # ---------- the reshaped holes ----------
    for n, title, sub, blocks in [
        (1, '1 The Adit: a spindle becomes a fan', 'Par 4, 406 yd (Condor 430). The opener: off the ledge at the mine entrance, 25 m down the breakdown slope into the first hall, bending right.', [
            ('The problem, in numbers', f"A spindle: 26–54 m wide, widest at 200–250 m, narrow at both ends. alike.mjs measures it alike with three other fairways on the course: the 4th (0.22), the 8th (0.21) and the 9th (0.18); under 0.25 is alike. Four of the seven fairways are spindles; the rule is two."),
            ('The form, from the story', 'A fan. You step out of the mine\'s mouth and down the slope of fallen roof, and the hall opens out as you walk into it, so the fairway does: a throat about 30 m wide where the slope meets the floor, between two banks of rubble, spreading to 65 m by the approach. It is gentle for an opener: every tee set\'s drive lands where it is 46–47 m wide, and the longer the drive the more room. It is fuller on the left, the outside of the bend; the right edge holds the inside of the corner. One clear line: the Adit\'s Bite the corner target is gone (already in), so the Rim keeps that decision.'),
            ('What moves', '• Two banks of fallen roof frame the throat at 170–180 m: 3.0 m high on the left, 2.6 m on the right, 52–60 m long. They replace the two rolls that stood at 250 m, where the fan is now wide.\n• The swale across the landing area moves 10 m on and broadens (70 × 60 m, 1.2 m deep).\n• Bunkers: the right one moves to the inside of the throat at 196 m, touching it; the left one out to the fan\'s new left edge at 262 m; the one short left of the green 11 m out to the new edge.\n• The left grove of glowing mushrooms moves 18 m out, off the wider fairway.'),
            ('What stays', 'The tees and their ledge, the 3% lean right into the bend, the green and its bunkers, the cart and rails, the crystal cave, the stalagmite stands, the roof.'),
            ('What the checks say for this shape', f"Fan, 15–65 m wide (mean 45). Each tee set's drive (Eagle / Hawk / Swift / Wren) lands on {land(1, 'prop')} m of fairway (now {land(1, 'now')}): inside 45–65 for the back tees. Alike with nothing (the closest pair on the course is 4 and 9 at 0.26). The tips drive (290 yd) lands on 55 m. Normal drives clear, targets on fairway, tees off it, tests pass. Gate: {G['h1']}."),
        ]),
        (8, '8 Glowworm Grotto: a spindle becomes a funnel', 'Par 4, 383 yd (Condor 418). The darkest hole, under the glowworm ceiling: up over a crest, bending right round a stand of giant mushrooms, to a punchbowl.', [
            ('The problem, in numbers', 'A spindle: 8–59 m wide. Alike with the 1st (0.21) and the 9th (0.18), and the 8th and 9th are spindles back to back (the rule: never the same form two holes running).'),
            ('The form, from the story', 'A funnel: the grotto floor is broad where the drive comes down round the corner, then the passage closes in up the ridge to the punchbowl. Generous off the tee, tighter all the way in: past about 200 m the fairway narrows, so the long drive is the hard one and the hole rewards restraint. Fuller on the left, the outside of the bend; the right edge stays clear of the giant mushrooms inside the corner (cutting over them is still there for the bold).'),
            ('What moves', '• Two banks of flowstone rise either side of the closing approach, 230–340 m: 4.5 m on the left, 4 m on the right, 100–110 m long, so the funnel\'s sides stand up and a ball that misses the narrow part feeds back toward it or hangs on the bank.\n• The two fairway bunkers move to the new left edge, at 110 m and 178 m, touching it (one was 26 m out, the other inside the new mouth).\n• The mushroom grove left of the approach moves 30 m left, off the narrowing fairway.'),
            ('What stays', 'The flowstone column in front of the back tee, the crest at 145 m (unless you pick the option below), the two floor ramps (7 m and 10 m up), the ridge up the approach, the punchbowl green, the lanterns, the mushrooms inside the corner, the glowworm ceiling.'),
            ('What the checks say for this shape', f"Funnel, 21–65 m wide (mean 44). Each tee set's drive lands on {land(8, 'prop')} m of fairway (now {land(8, 'now')}). Alike with nothing; 8 and 9 now measure 0.31 apart. The tips spot is chosen with it: 35 yd behind the Eagle tee, its 290 yd drive lands on 47 m. Drives clear; the medium drive from the back tee now finishes on fairway (it found rough). Gate: {G['h8']}."),
            ('Option: the blind crest', 'Today the crest at 145 m (3.4 m high) stands 3.3 m into the sight line, so the landing area is blind from the back tee. Lowered to 1.2 m it is still a crest you feel underfoot, and the landing area comes into view (design.mjs no longer calls it blind); the Geode would then be the course\'s only blind tee shot. The profile below shows both.'),
        ])]:
        f = page(); head(f, title, sub)
        a1 = f.add_axes([0.02, 0.07, 0.30, 0.83]); plan(a1, 'now', n, 'Now')
        a2 = f.add_axes([0.30, 0.07, 0.30, 0.83]); plan(a2, 'prop', n, 'Proposed')
        a2.set_ylabel(''); a2.tick_params(labelleft=False)
        words(f, 0.62, 0.88, 0.36, blocks, size=7.0, gap=0.006)
        pdf.savefig(f); plt.close(f)
        f = page(); head(f, title.split(':')[0] + ': the measurements', 'Same hole, the fairway\'s width along the line and the ground along it, now and proposed.')
        widths(f.add_axes([0.07, 0.56, 0.86, 0.32]), n)
        if n == 8: profile(f.add_axes([0.07, 0.12, 0.86, 0.34]), n, (('now', '#888', 'now (crest 3.4 m)'), ('prop', '#2a7a2a', 'proposed, crest kept'), ('crest', '#c0392b', 'proposed, crest lowered to 1.2 m')))
        else: profile(f.add_axes([0.07, 0.12, 0.86, 0.34]), n)
        f.text(0.07, 0.04, 'The profile follows the playing line through the middle of the fairway; banks and bunkers beside it do not show here.', fontsize=7, color='#555')
        pdf.savefig(f); plt.close(f)

    # ---------- tips ground ----------
    f = page(); head(f, 'Tips tees that need ground: 2, 4, 6 and 7', 'Each spot is 10 × 12 m of real ground, level within about a metre, off the fairway, nothing overhead within 45 m. Crops are 0.5 m a cell; the black diamond is the spot.')
    for k, (n, txt) in enumerate([
        (2, '2 Mirror Lake (par 3, 181 yd, 13 yd back). The ledge ends 8 m behind the Eagle tee, so a pad there hung half over the drop (1.2 m fall). A small shelf, 9 × 9 m at the ledge\'s height, runs it on.'),
        (4, '4 The Rim (471 yd, 26 yd back). The tee ledge is 14 m deep; the only ground 20 yd back was the floor 36 m below. A second shelf at the ledge\'s height (−31 m), 15 m deep, runs the ledge back. The tips drive lands on 67 m.'),
        (6, '6 The Falls (435 yd, 27 yd back). The knoll falls away behind the tee (2–5 m across a pad). A shelf is cut into its back, 2.5 m below the Eagle tee: the far side lifted, the near side lowered, 30 × 30 m. The tips drive lands on 44 m, the inlet in play.')]):
        a = f.add_axes([0.03 + k * 0.32, 0.47, 0.14, 0.40]); plan(a, 'now', n, f'{n}: now', contours=1)
        b = f.add_axes([0.18 + k * 0.32, 0.47, 0.14, 0.40]); plan(b, 'prop', n, f'{n}: proposed', contours=1); b.set_ylabel('')
        words(f, 0.03 + k * 0.32, 0.44, 0.29, [(None, txt)], size=7.0)
    a = f.add_axes([0.03, 0.04, 0.22, 0.30]); plan(a, 'now', 7, '7: now (first leg)')
    b = f.add_axes([0.25, 0.04, 0.22, 0.30]); plan(b, 'prop', 7, '7: proposed'); b.set_ylabel('')
    for ax in (a, b): ax.set_ylim(-20, 300)
    words(f, 0.52, 0.30, 0.44, [(None, '7 The Trestle (595 yd, 48 yd back). The ground is there, but a 290 yd drive from the tips reaches the end of the first fairway, where it was 35 m wide with the fissure beyond. The first fairway runs on 12 m toward the fissure, so the tips drive lands on 43 m with the fissure very much in play. Nothing else on the hole moves; the Eagle tee\'s drives and targets are unchanged (the existing long drive into the fissure from the Eagle tee is noted on page 7).'),
                                 (None, '8 Glowworm Grotto (418 yd, 35 yd back) goes with its new fairway (page 4). 1, 3, 5 and 9 were on ground that already passed and are already in.')], size=7.2)
    pdf.savefig(f); plt.close(f)

    # ---------- the 6th, done ----------
    f = page(); head(f, '6 The Falls: why it failed the gate, and the fix (already in)', 'Data only: two targets. Nothing in the ground moved.')
    def old6(ax, m):
        ax.plot(-50.3, 191.6, 'x', ms=7, mew=1.6, color='#888'); ax.annotate('old drive target', (-50.3, 191.6), (-140, 150), fontsize=6.5, arrowprops=dict(arrowstyle='-', color='#888', lw=0.6))
        ax.annotate('drive target (moved 20 m on)', (-52, 212), (-145, 250), fontsize=6.5, arrowprops=dict(arrowstyle='-', color='k', lw=0.6))
        ax.annotate('Round the top (new lay-up)', (-76, 292), (-148, 330), fontsize=6.5, arrowprops=dict(arrowstyle='-', color='k', lw=0.6))
        ax.annotate('the crest', (-25, 200), (30, 170), fontsize=6.5, arrowprops=dict(arrowstyle='-', color='k', lw=0.6))
        ax.annotate('the inlet into the Deep', (-5, 290), (30, 250), fontsize=6.5, arrowprops=dict(arrowstyle='-', color='k', lw=0.6))
    plan(f.add_axes([0.02, 0.06, 0.40, 0.84]), 'now6', 6, 'Now (with the old target shown grey)', extra=old6)
    words(f, 0.45, 0.88, 0.51, [
        ('What the gate found', G['h6_before']),
        ('Why', 'Two things. The drive target sat 10 m short of the crest that hides the landing area, so the second shot was struck into the crest\'s back face (a 14% rise in the first 10 m); the review player\'s solver then chose a driver that ran into the inlet. In the game an uphill lie launches higher, so that part is mostly the tool\'s. The real gap: the safe way round the top of the inlet had no target, so auto-aim had nowhere to play to, and a short hitter tried to carry the inlet with a 3-wood every time.'),
        ('The fix', 'The drive target moves 20 m on, past the crest, onto the middle of the fairway; and the lay-up round the top of the inlet is a target, Round the top, about 105 m from the green. A long hitter still takes the carry over the inlet (it is in reach); a short one goes round and pitches in.'),
        ('After', G['h6_after']),
        ('Decisions, measured at 24 rounds (already in: bold targets marked)', G['dec']),
        ('Seen, not changed', G['seen']),
    ], size=7.2)
    pdf.savefig(f); plt.close(f)
print('ok')
