import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from mock import *

C = 'hollowmere'
TITLE = 'Hollowmere'
NOTE = 'Today: the most clustered course. Par 3s 166 and 168; par 5s 546 and 547; eight of nine greens within 10% of 540 m²; four tee shots off a height; fairways 41–55 m.'
ROWS = [('5 The Geode (3)', '166 → 115', 'Tee forward; a 320 m² green inside the crystal rim', 'green size', 'postage stamp', 'green, tees'),
        ('2 Mirror Lake (3)', '168 → 208', 'An 800 m² green on a spit, water on three sides; tee back', 'length, green size', 'island green (near)', 'green, tees, ground'),
        ('7 The Trestle (5)', '547 → 500', 'Tee forward: the reachable par 5', 'length', '', 'tees'),
        ('3 Stalagmite Forest (5)', '546 → 590', 'The climb in three rimstone steps; tee back', 'stepped (bold)', '', 'tees, ground'),
        ('9 The Cenote (4)', '343', 'Landing shelf lifted level with tee and green', 'valley carry (bold)', '', 'ground'),
        ('6 The Falls (4)', '408', 'A crowned causeway between the Deep and the pool', 'hog\'s back', '', 'ground'),
        ('4 The Rim (4)', '446 → 475', 'Tee back: the long par 4', 'length', '', 'tees')]

def geode(pdf):
    A = Hole(C, 5); B = A.copy(); a0 = A.green_area(); B.scale_green(np.sqrt(320 / a0)); B.tee(47, 0, '115 yd')
    hpage(pdf, A, B, '5 The Geode', ['postage stamp', 'dial: green size'],
          'a wedge up 12 m to a small green in the bowl of the geode. Slightly long is caught by the rim and kicked back; well long is in the crystals.',
          [f'The back tee comes forward 47 m, 166 → about 115 yd, and the green inside the crystal rim is cut from about {a0} m² to about {B.green_area()} m².',
           'The rim, the crystals and the geode\'s upper half stay. Hollowmere\'s par 3s become 115 and 208 (166 and 168 today).'],
          box=(-60, 60, -195, 40), prof=(-10, 180), detail=green_box(A, 16))

def mirror(pdf):
    A = Hole(C, 2); B = A.copy(); a0 = A.green_area()
    lake = A.is_('water'); wl = np.nanmedian(A.h[lake]); gl = np.nanmedian(A.h[A.is_('green')])
    B.paint(A.is_('green', 'fringe', 'sand'), 'rough')
    pool = B.ellipse(150, 0, 34, 44) | lake; spit = B.ellipse(146, 0, 30, 15.5)
    make_island(B, pool & ~spit, wl, 'water'); make_island(B, spit, gl, 'rough')
    g = B.ellipse(137, 0, 17, 15); B.paint(ndimage.binary_dilation(g, iterations=2), 'fringe'); B.paint(g, 'green')
    make_island(B, B.rect(-46, -14, -10, 10), along(A, 0), 'rough'); B.paint(B.rect(-44, -32, -5, 5), 'tee')
    B.tee(-38, 0, '208 yd')
    hpage(pdf, A, B, '2 Mirror Lake', ['island green (near enough)', 'dial: length'],
          'a long iron down 19 m to a big green you can only reach over water; long is the only dry miss. Doubled in the reflection.',
          [f'The green moves 17 m nearer, out into the lake on a spit from the far shore, about {B.green_area()} m² (now {a0}), with water left, right and in front. The lake grows round it.',
           'The back tee goes 38 m back onto a new shelf of the ledge, 168 → about 208 yd: Hollowmere\'s long par 3. The drop and the mirror stay.'],
          box=(-80, 80, -215, 70), prof=(-45, 185), cross=(137,))

def trestle_tee(pdf):
    A = Hole(C, 7); B = A.copy(); B.tee(43, 0, '500 yd')
    hpage(pdf, A, B, '7 The Trestle', ['dial: length', 'reachable par 5'],
          'a good drive, then "Over the trestle" as a second shot worth trying.',
          ['The back tee comes forward 43 m, 547 → about 500 yd. Nothing else moves. With Stalagmite Forest at 590 the par 5s are 500 and 590 (546 and 547 today).'],
          box=(-100, 110, -560, 50))

def stalagmite(pdf):
    A = Hole(C, 3); B = A.copy()
    B.reprofile([(290, along(A, 290)), (335, -50.5), (345, -43.5), (392, -42.5), (402, -35.0), (442, -34.0), (452, -27.0), (A.len - 10, along(A, A.len - 10))], half=50, edge=20, smooth=6)
    B.tee(-40, 0, '590 yd')
    hpage(pdf, A, B, '3 Stalagmite Forest', ['stepped', 'bold', 'the long par 5'],
          'three shots; the second and third each play up onto a rimstone terrace. Short of a step, the ball sits below it, blind.',
          ['The 25 m climb to the green, one ramp today, comes in three rimstone steps of about 7 m with near-level terraces between (340, 397 and 447 m out). The terraces are already in the hole\'s story.',
           'A new back tee 40 m further back, 546 → about 590 yd. The forest, the stream and the green stay.'],
          box=(-110, 130, -560, 90), prof=(-45, 525), marks=[(340, 'step'), (397, 'step'), (447, 'step')])

def cenote(pdf):
    A = Hole(C, 9); B = A.copy()
    B.reprofile([(35, along(A, 35)), (75, -21), (150, -25), (184, -20), (204, -12), (270, -10.5), (300, along(A, 300))], half=45, edge=25, smooth=8)
    hpage(pdf, A, B, '9 The Cenote', ['valley carry', 'bold'],
          'carry the dip, about 205 m, for a flat lie and a short pitch, or take the drivable line through the eyelet as now. Short of the shelf, the ball rolls back to the bottom.',
          ['The landing shelf 200–270 m out is lifted about 11 m, level with the tee and the green. The dip in front of it stays deep, so the hole reads tee, dip, shelf, green.',
           'The eyelet, the cenote and the green stay. A form no course has used, and it removes one of Hollowmere\'s four tee shots off a height.'],
          box=(-100, 80, -360, 40), prof=(-10, 330), marks=[(150, 'dip'), (205, 'shelf')])

def falls(pdf):
    A = Hole(C, 6); B = A.copy()
    ws = smooth01((B.S - 70) / 25) * (1 - smooth01((B.S - 245) / 20))
    crown = 3.2 * (1 - smooth01(np.abs(B.O) / 30)) - 1.2 * smooth01((np.abs(B.O) - 18) / 20)
    B.h = np.where(np.isnan(B.h), B.h, B.h + crown * ws)
    hpage(pdf, A, B, '6 The Falls', ['hog\'s back'],
          'only the spine holds: a drive off it kicks toward the pool or the Deep and leaves a sidehill lie.',
          ['The landing area, 90–250 m out, becomes a causeway of high ground between the Deep and the falls\' pool: a spine about 3 m up, shedding to both sides. The cross-sections show it.',
           'The tee, the Deep and the falls stay. Check first: this hole failed the gate on 11 November.'],
          box=(-110, 90, -410, 40), cross=(150, 210), marks=[(170, 'the spine')])

def rim_tee(pdf):
    A = Hole(C, 4); B = A.copy(); B.tee(-27, 0, '475 yd')
    hpage(pdf, A, B, '4 The Rim', ['dial: length', 'the long par 4'],
          'a long par 4 that plays downhill, so the length is fair.',
          ['The back tee goes 27 m back along the ledge, 446 → about 475 yd: the course\'s long par 4. Nothing else moves.'],
          box=(-100, 110, -460, 60), prof=(-35, A.len + 20))

PAGES = (geode, mirror, trestle_tee, stalagmite, cenote, falls, rim_tee)
