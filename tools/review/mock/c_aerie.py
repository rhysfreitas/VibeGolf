import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mock import *

C = 'aerie'
TITLE = 'The Aerie'
NOTE = 'Today: both par 3s are drops (171 and 126 yd); par 5s 510 and 530; six of nine greens within 10% of 554 m²; one bold hole; no hole past real golf.'
ROWS = [('6 Drift (3)', '126 → 110', 'Green island lifted level with the tee and cut to a rock; 300 m² green', 'green size, past real golf', 'postage stamp', 'green, tees'),
        ('2 Lantern (3)', '171 → 210', 'A new tee island 37 m back; keeps the drop', 'length', '', 'tees'),
        ('9 The Ascent (5)', '530 → 590', 'Islands rising in three steps to an 850 m² green; tee back', 'stepped (bold)', '', 'tees, green, ground'),
        ('3 Long Way Round (5)', '510 → 490', 'Tee forward; the short way marked as the bold line', 'length', '', 'tees, a target'),
        ('8 Long Roll (4)', '457 → 478', 'A crest 210 m out whose far slope runs the ball on', 'crest and run', '', 'tees, ground'),
        ('4 The Stair (4)', '320', 'Green cut to about 380 m²', 'green size', '', 'green')]

def drift(pdf):
    A = Hole(C, 6); B = A.copy(); a0 = A.green_area()
    isl = island_of(B, 112); B.h[isl] += 9.6
    B.scale_green(np.sqrt(300 / a0))
    gz = B.is_('green'); cz, cx = ndimage.center_of_mass(gz)
    rr, cc = np.mgrid[0:B.H, 0:B.W]; keep = np.hypot(rr - cz, cc - cx) < 17
    B.carve(isl & ~keep & ~gz); B.paint(isl & keep & ~B.is_('green', 'fringe'), 'rough')
    t = B.ellipse(13, 0, 7, 7); make_island(B, t & np.isnan(B.h), along(A, 0), 'rough'); B.paint(B.ellipse(13, 0, 4, 3.5), 'tee')
    B.tee(13, 0, '110 yd')
    hpage(pdf, A, B, '6 Drift', ['postage stamp', 'past real golf'],
          'a wedge to a tiny green on a rock in the sky, level with you. The eye says drop; the yardage says no. Off the rock is the clouds (a drop, as now).',
          ['The green\'s island is lifted about 10 m, level with the tee, and cut down to a small rock about 34 m across. The green on it is cut to about 300 m² (466 today) with a thin rim of rough.',
           'A new back tee island 13 m in front of today\'s makes it about 110 yd. Open sky between tee and green, as now.',
           'The course\'s hole past real golf. Lantern keeps the Aerie\'s drop par 3.'],
          box=(-60, 60, -150, 40), prof=(-15, 135), cross=(112,))

def lantern_tee(pdf):
    A = Hole(C, 2); B = A.copy(); t = B.ellipse(-37, 0, 8, 8); make_island(B, t, along(A, 0), 'rough'); B.paint(B.ellipse(-37, 0, 4.5, 3.5), 'tee'); B.tee(-37, 0, '210 yd')
    hpage(pdf, A, B, '2 Lantern', ['dial: length', 'the long par 3'],
          'a long iron or wood, down 13 m, across open sky.',
          ['A new tee island 37 m behind today\'s back tee (and beyond the tips island), 171 → about 210 yd. Nothing else moves.',
           'It stays the Aerie\'s one drop par 3. With Drift at 110 the par 3s are 110 and 210, 100 yd apart.'],
          box=(-60, 60, -190, 70), prof=(-45, A.len + 20))

def ascent(pdf):
    A = Hole(C, 9); B = A.copy(); a0 = A.green_area()
    fw = island_of(B, 220, 24) | island_of(B, 220, -2); B.h[fw] += 6.5
    B.reprofile([(338, 9.0), (405, 9.5), (420, 14.0), (575, 14.0)], half=90, edge=10, smooth=6)
    B.scale_green(np.sqrt(850 / a0))
    t = B.ellipse(-55, 0, 8, 8); make_island(B, t, along(A, 0), 'rough'); B.paint(B.ellipse(-55, 0, 4.5, 3.5), 'tee')
    B.tee(-55, 0, '590 yd')
    hpage(pdf, A, B, '9 The Ascent', ['stepped', 'bold', 'the long par 5'],
          'three shots up a staircase in the sky, each onto the next step. From the upper step you see the green; from the lower it is above you.',
          ['The islands rise in three clear steps of 4–5 m: the fairway island lifted from −3 to about +3.5 m, the approach island at +9 and the green\'s top at +14 (today the hole climbs a gentle 5 m with a bump before the green).',
           f'The finishing green grows from about {a0} m² to about {B.green_area()} m². A new tee island 55 m back makes it about 590 yd.'],
          box=(-90, 100, -590, 100), prof=(-60, 520), detail=green_box(B, 14))

def lwr_tee(pdf):
    A = Hole(C, 3); B = A.copy(); B.tee(18, 0, '490 yd'); add_target(B, 330, 0, 'bold line')
    hpage(pdf, A, B, '3 Long Way Round', ['dial: length', 'reachable par 5'],
          'the long way round, or the short way straight over the gap, now marked as the bold line, for a green in two.',
          ['The back tee comes forward 18 m, 510 → about 490 yd. The short way, straight over the gap from the fairway island to the green, is marked as the bold line (it has none today). Data only: no ground moves.',
           'With the Ascent at 590 the par 5s are 490 and 590.'],
          box=(-100, 100, -520, 60))

def longroll(pdf):
    A = Hole(C, 8); B = A.copy()
    B.reprofile([(170, along(A, 172)), (192, -0.6), (205, -1.0), (238, -6.6), (300, -6.0), (330, along(A, 330))], half=80, edge=10, smooth=8)
    B.tee(-20, 0, '478 yd')
    hpage(pdf, A, B, '8 Long Roll', ['crest and run', 'dial: length'],
          'carry the crest and its far slope runs the ball on about 35 yd, leaving a mid-iron. Land short of it and the ball stops on the upslope, 200 yd out.',
          ['A crest about 5 m high rises at the near end of the fairway island, 210 m from a new back tee; its far slope falls 6 m over 35 m into the landing area.',
           'The back tee goes 20 m back, 457 → about 478 yd: the first par 4 over 465 on any course, made fair by the run. The green island stays.'],
          box=(-80, 80, -460, 60), prof=(-25, 420), marks=[(192, 'crest'), (238, 'foot of the run')])

def stair(pdf):
    A = Hole(C, 4); B = A.copy(); a0 = A.green_area(); B.scale_green(np.sqrt(380 / a0))
    hpage(pdf, A, B, '4 The Stair', ['dial: green size'],
          'the same drivable hole up 16 m, to a small green: defended at the green, not by length.',
          [f'The green is cut from about {a0} m² to about {B.green_area()} m². Its bunkers and surrounds would close in with it. The play and the yardage stay.'],
          box=(-80, 80, -330, 40), detail=green_box(A, 14))

PAGES = (drift, lantern_tee, ascent, lwr_tee, longroll, stair)
