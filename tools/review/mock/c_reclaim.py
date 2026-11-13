import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mock import *

C = 'reclaim'
TITLE = 'The Reclaim'
NOTE = 'Today: both par 3s are drops (135 and 195 yd); par 5s 545 and 560; eight of nine greens within 10% of 527 m²; four plain holes; no hole past real golf.'
ROWS = [('5 The Stadium (3)', '195', 'The green fills the pitch\'s far end: about 1,300 m², three tiers', 'green size, past real golf', '', 'green'),
        ('4 Broken Tower (5)', '545 → 500', 'Tee forward: the reachable par 5', 'length', '', 'tees'),
        ('7 The Bridge (5)', '560 → 610', 'Tee back: the long par 5', 'length', '', 'tees'),
        ('3 The Station (3)', '135 → 112', 'Played level along the concourse to a narrow 310 m² green', 'par 3 level (not a drop)', 'postage stamp', 'green, tees, ground'),
        ('9 The Rift (4)', '430', 'A 6–7 m scarp, the last third on a slab', 'table top (bold)', '', 'ground'),
        ('6 The Square (extra)', '300', 'Plaza opened to 85 m; the basin in the green\'s front', 'width', 'lion\'s mouth', 'ground, green'),
        ('1 The El (extra)', '400', 'A long bunker of fallen girders beside the landing area', 'bunker count', 'church pews', 'sand')]

def stadium(pdf):
    A = Hole(C, 5); B = A.copy(); a0 = A.green_area()
    cs, ch, cw = 178.5, 19.5, 17.5
    sup = (np.abs(B.S - cs) / ch) ** 6 + (np.abs(B.O) / cw) ** 6 <= 1
    B.paint(A.is_('green', 'sand') & ~sup, 'fringe'); B.paint(ndimage.binary_dilation(sup, iterations=2) & ~sup, 'fringe')
    base = np.nanmean(A.h[A.is_('green')]); t = (B.S - (cs - ch)) / (2 * ch)
    tier = smooth01((t - 0.30) / 0.06) + smooth01((t - 0.64) / 0.06)
    B.h = np.where(sup, base - 0.6 + 0.7 * tier, B.h); B.paint(sup, 'green')
    hpage(pdf, A, B, '5 The Stadium', ['dial: green size', 'past real golf'],
          'the same long iron down 28 m into the stadium, to a green you can hardly miss. The test is the tier: a pin on the top one from the bottom is a 40 m putt up two steps.',
          [f'The green grows from about {a0} m² to about {B.green_area()} m², filling the far end of the pitch from touchline to touchline (34 m across, 39 m deep), in three tiers about 0.7 m apart rising away from the tee. Its two bunkers go; the pitch round it is fringe.',
           'The tee, the drop, the stands and the sinkhole in the middle of the pitch stay.',
           'The Reclaim\'s hole past real golf (it has none today): the biggest green on any course.'],
          box=(-80, 80, -230, 40), detail=(-35, 35, -215, -140), marks=[(165, 'front'), (195, 'back')])

def tower_tee(pdf):
    A = Hole(C, 4); B = A.copy(); B.tee(41, 0, '500 yd')
    hpage(pdf, A, B, '4 Broken Tower', ['dial: length', 'reachable par 5'],
          'a good drive, then "Over the crest" as a real second shot at the green.',
          ['The back tee comes forward 41 m, 545 → about 500 yd. Nothing else moves.',
           'With the Bridge at 610 the par 5s are 500 and 610 (545 and 560 today).'],
          box=(-110, 100, -530, 50))

def bridge_tee(pdf):
    A = Hole(C, 7); B = A.copy(); B.tee(-46, 0, '610 yd')
    hpage(pdf, A, B, '7 The Bridge', ['dial: length', 'the long par 5'],
          'three shots along the river and across the fallen spans.',
          ['A new back tee 46 m behind today\'s, 560 → about 610 yd. The tips tee moves back with it. Nothing else moves.'],
          box=(-80, 120, -540, 100), prof=(-55, A.len + 20))

def station(pdf):
    A = Hole(C, 3); B = A.copy()
    lvl = along(A, 90)
    conc = B.rect(-5, 75, -24, 24); B.level_to(conc, lvl, edge=6)
    B.paint(B.rect(0, 112, -8.5, 8.5) & ~B.is_('green'), 'fairway')
    B.paint(B.is_('green'), 'rough')
    g = B.ellipse(121, 0, 15, 6.6); B.level_to(g, lvl + 0.6, edge=2)
    B.paint(ndimage.binary_dilation(g, iterations=2), 'fringe'); B.paint(g, 'green')
    for side in (-1, 1):
        bed = B.rect(40, 150, 9.5, 17.5) if side > 0 else B.rect(40, 150, -17.5, -9.5)
        B.h[bed] = lvl - 1.3; B.paint(bed, 'waste')
    B.paint(B.is_('sand') & (B.S > 100), 'rough')
    B.tee(20, 0, '112 yd')
    hpage(pdf, A, B, '3 The Station', ['postage stamp', 'par 3 level, not a drop'],
          'a wedge along the platform to a green 13 m wide. Left or right is down in a track bed; short is the platform.',
          ['The tee comes down from the concourse onto the platform\'s level (about 10 m lower, where the concourse floor has fallen in) and forward to about 112 yd (135 today). The hole is now level, tee to green.',
           f'The green is cut from about {A.green_area()} m² to about 310 m², long and narrow on the platform. The two track beds either side are sunk 1.3 m in ballast and rubble and run past the green. No sand.',
           'The Reclaim\'s first par 3 that isn\'t a drop; the Stadium keeps the drop.'],
          box=(-60, 60, -170, 40), prof=(-10, 160), cross=(110,), marks=[(20, 'tee on the platform'), (121, 'green')])

def rift(pdf):
    A = Hole(C, 9); B = A.copy()
    B.reprofile([(60, along(A, 60)), (150, 10.5), (248, 19.5), (262, 26.0), (330, 27.0), (A.len - 5, along(A, A.len - 5)), (A.len + 15, along(A, A.len + 15))], half=48, edge=20, smooth=10)
    hpage(pdf, A, B, '9 The Rift', ['table top', 'bold'],
          'lay up below the scarp for a blind second up onto the slab, or carry it, about 265 m from the back tee, for a flat lie and a view of the green.',
          ['The steady 28 m climb is regathered: a steeper street up to about 250 m out, a broken scarp of 6–7 m where the street has buckled, then the last third on the slab above it, nearly level, to the green.',
           'The green and its height, the rift beside the hole and the yardage stay. A plain ramp on the last hole becomes the course\'s table top.'],
          box=(-100, 80, -460, 40), prof=(-10, 420), marks=[(220, 'lay-up'), (255, 'scarp 6–7 m'), (300, 'the slab')])

def square(pdf):
    A = Hole(C, 6); B = A.copy()
    wide = B.rect(95, 235, -42.5, 42.5) & ~B.is_('green', 'fringe', 'sand')
    pond = A.is_('water'); B.fill(pond, 'fairway'); B.paint(wide, 'fairway')
    gs = A.S[A.is_('green')]; front = gs.min()
    mouth = B.ellipse(front + 4, 0, 7, 9); B.h[mouth] = np.nanmin(B.h[mouth]) - 1.0; B.paint(mouth, 'water')
    B.m = dict(B.m); B.m['trees'] = [t for t in A.m['trees'] if not (95 < -t[1] < 235 and abs(t[0]) < 45)]
    hpage(pdf, A, B, '6 The Square (extra)', ['dial: width', 'lion\'s mouth'],
          'anyone finds the fairway; the drivable green\'s front is now the fountain\'s basin, so run it in either side of the water or fly it.',
          ['The plaza is opened to 85 m (about 60 today), the widest fairway on any course. The fountain\'s basin moves from the left of the plaza into the front of the green, biting into it.',
           'The yardage, the green\'s back and its bunker stay.'],
          box=(-90, 90, -320, 40), detail=green_box(A, 20))

def el(pdf):
    A = Hole(C, 1); B = A.copy()
    pews = B.rect(190, 262, 21, 35); B.h[pews] -= 1.1; B.paint(pews, 'sand')
    for k in range(9):
        rib = pews & (np.abs(B.S - (195 + k * 8)) < 1.4); B.h[rib] += 1.1; B.paint(rib, 'rough')
    hpage(pdf, A, B, '1 The El (extra)', ['dial: bunker count', 'church pews'],
          'the same drive, with a long bunker of girders and sand waiting on the right of the landing area.',
          ['The El\'s fallen girders lie across one long bunker on the right of the landing area, 70 m long: ribs of rust and grass every 8 m with sand between. Nothing else on the hole changes.'],
          box=(-100, 80, -420, 40), detail=(-90, 50, -290, -150))

PAGES = (stadium, tower_tee, bridge_tee, station, rift, square, el)
