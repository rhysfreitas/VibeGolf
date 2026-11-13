import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mock import *

C = 'redmesa'
TITLE = 'Red Mesa'
NOTE = 'Today: the most varied course. Both par 3s are drops (265 and 175 yd); par 5s 515 and 535; no fairway wider than 56 m.'
ROWS = [('6 Trestle (3)', '175', 'Back tees on a shelf at the green\'s height: level across the gorge', 'par 3 across a gulf', '', 'tees, ground'),
        ('9 The Climb (5)', '515 → 597', 'Tee back; the tiers as two true steps', 'stepped (bold)', '', 'tees, ground'),
        ('5 Switchback (5)', '535 → 495', 'Tee forward: the reachable par 5', 'length', '', 'tees'),
        ('2 The Chute (4)', '410', 'A 27 m slot in the rim, then an 80 m fairway below', 'width', 'the chute', 'ground'),
        ('8 Dry Wash (4)', '450 → 475', 'The wash as a burn across the line twice and the green\'s front', 'one hazard\'s scale', 'the burn', 'tees, ground'),
        ('4 Needle\'s Eye (4)', '370', 'Perched green cut to about 380 m²', 'green size', '', 'green')]

def trestle(pdf):
    A = Hole(C, 6); B = A.copy()
    lvl = np.nanmedian(A.h[A.is_('green')])
    shelf = B.rect(-28, 75, -24, 24) & ~np.isnan(B.h); B.level_to(shelf, lvl, edge=5)
    B.paint(shelf & B.is_('rough', 'desert', 'firstcut', 'fairway', 'tee'), 'rough'); B.paint(B.rect(-6, 6, -5, 5), 'tee')
    B.tee(0, 0, 'at green height')
    hpage(pdf, A, B, '6 Trestle', ['par 3 across a gulf'],
          'the full 175 yd over open air, with no help from the height, the trestle framing the shot. Today it plays as a drop and a club less.',
          ['The back tees drop onto a shelf cut into the near wall of the gorge, at the green\'s height, about 18 m below today\'s tee; the forward tees step down with it. The shelf opens straight onto the gorge.',
           'The yardage, the gorge, the trestle and the Biarritz green stay. Red Mesa\'s first par 3 across a gulf; Kestrel keeps the course\'s drop.'],
          box=(-70, 70, -200, 50), prof=(-30, 185), cross=(5,))

def climb(pdf):
    A = Hole(C, 9); B = A.copy()
    B.reprofile([(150, 0), (228, 0.2), (246, 14.0), (395, 14.5), (412, 28.0), (A.len - 15, along(A, A.len - 15))], half=40, edge=20, smooth=6)
    B.tee(-75, 0, '597 yd')
    hpage(pdf, A, B, '9 The Climb', ['stepped', 'bold', 'the long par 5'],
          'three shots, each from a level lie up onto the next tier: the second climbs the first step, the third climbs the second to the green.',
          ['The two ramps become two clear steps, each about 14 m in 15–20 m, with level ground between (240–400 m out at +14 m).',
           'A new back tee 75 m behind today\'s, past the tips spot, makes it about 597 yd. The climb, +29 m, and the green stay.'],
          box=(-90, 110, -540, 120), prof=(-80, 500), marks=[(237, 'step 1'), (403, 'step 2')])

def switch_tee(pdf):
    A = Hole(C, 5); B = A.copy(); B.tee(37, 0, '495 yd')
    hpage(pdf, A, B, '5 Switchback', ['dial: length', 'reachable par 5'],
          'a good drive, then "Over the waste" as a second shot a long hitter can try.',
          ['The back tee comes forward 37 m, 535 → about 495 yd. Nothing else moves. With the Climb at 597 the par 5s are 495 and 597.'],
          box=(-100, 110, -560, 50))

def chute(pdf):
    A = Hole(C, 2); B = A.copy()
    for side in (-1, 1):
        r = B.rect(35, 85, 13.5, 45) if side > 0 else B.rect(35, 85, -45, -13.5)
        B.raise_mask(r, 9, edge=2); B.paint(r, 'rock')
    B.paint(B.rect(230, 360, -40, 40) & B.is_('rough', 'desert', 'firstcut'), 'fairway')
    hpage(pdf, A, B, '2 The Chute', ['the chute', 'dial: width'],
          'thread the drive through the slot and it drops 34 m to the widest landing area on the course. Tight and wide on one hole.',
          ['The rim closes in where the tee shot leaves it: rock about 9 m high either side of a slot 27 m wide, 35–85 m from the tee. Below, on the canyon floor, the fairway opens to 80 m (56 today).',
           'The drop, the shelf and the green stay.'],
          box=(-90, 90, -420, 50), cross=(60, 300), marks=[(60, 'slot 27 m'), (300, 'fairway 80 m')])

def drywash(pdf):
    A = Hole(C, 8); B = A.copy()
    old = A.is_('water'); B.fill(old, 'desert'); smooth_fill(B, old, 9)
    pts = [(95, -70), (130, 0), (165, 55), (230, 50), (285, 0), (320, -55), (365, -45), (382, -12), (392, 22), (398, 60)]
    from scipy.interpolate import splprep, splev
    P = np.array([B.at(s, o) for s, o in pts]); tck, _ = splprep([P[:, 0], P[:, 1]], s=0, k=3); X, Z = splev(np.linspace(0, 1, 400), tck)
    d = np.full(B.X.shape, np.inf)
    for x, z in zip(X, Z): d = np.minimum(d, np.hypot(B.X - x, B.Z - z))
    burn = d < 3.2
    B.h[burn] = ndimage.uniform_filter(np.nan_to_num(B.h), 9)[burn] - 1.2; B.paint(burn, 'water')
    B.paint((d < 6) & ~burn & B.is_('fairway', 'rough', 'firstcut', 'desert'), 'firstcut')
    B.tee(-23, 0, '475 yd')
    hpage(pdf, A, B, '8 Dry Wash', ['the burn', 'dial: one hazard'],
          'carry the burn\'s first crossing or lay up short of its second; then an approach over the burn where it runs across the front of the green, at an angle, so the further right the shorter the carry.',
          ['The wash, which runs down the left today and crosses once, becomes a burn: a channel of water about 6 m wide that crosses the line diagonally at about 130 m and 285 m out and then runs across the front of the green.',
           'A new back tee 23 m back, 450 → about 475 yd. The drop off the tee and the green stay.'],
          box=(-110, 110, -470, 70), prof=(-25, 440))

def needle(pdf):
    A = Hole(C, 4); B = A.copy(); a0 = A.green_area(); B.scale_green(np.sqrt(380 / a0))
    hpage(pdf, A, B, '4 Needle\'s Eye', ['dial: green size'],
          'a short hole to a small target up on its knob.',
          [f'The perched green is cut from about {a0} m² to about {B.green_area()} m². Its bunkers and surrounds would close in with it. The arch, the play and the yardage stay.'],
          box=(-80, 100, -370, 40), detail=green_box(A, 14))

PAGES = (trestle, climb, switch_tee, chute, drywash, needle)
