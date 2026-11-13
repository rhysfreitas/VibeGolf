# Proposal mockups

Quick before-and-after pages for hole changes, in the layout of the Halcyon dials-and-heights proposal (the one Rhys
finds clear): a summary table, then a landscape page a hole with what it asks, the profile along the playing line
(now red, proposed coloured by surface, heights exaggerated), the plans now and proposed at one scale with the
changes labelled, the numbers, and cross-sections or a close-up. **They are rough edits of the real ground, not
built geometry**: use them to let Rhys choose, then build the real change in the course's plan tools and show that.

    node tools/review/mock/sample.mjs <course>        # the ground of every hole, with room behind the tees
    python3 tools/review/mock/book.py out.pdf "Title" "Intro" c_reclaim c_emberfell ...

`mock.py` holds the edits (reprofile along the line, raise or level a mask, tilt across, paint, carve, fill, scale a
green, move a tee, make an island); `draw.py` the page; each `c_<course>.py` the pages shown on 12 November 2026
(the variety suggestions for the six built courses, `claude/hole-suggestions-2026-11-12.md` in the project), with
the numbers each proposal used. Output and sampled grids go to `tools/review/out/` (ignored). Needs numpy, scipy,
matplotlib and the Inter font.
