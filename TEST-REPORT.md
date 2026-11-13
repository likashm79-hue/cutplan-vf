# CutPlan v1.6.3 — Test report

## Automated tests

| Test | Result |
|---|---|
| `node test-drawings.js` | PASS |
| `node test-engine.js` | PASS |
| `node test-v100-parser.js` | PASS |
| `python3 test-v100-ui.py` | PASS |
| `python3 test-v120-manual-panel.py` | PASS |
| `python3 test-v140-label-rules.py` | PASS |
| `python3 test-v163-label-overlap.py` | PASS |

## Label and PDF coverage
- Reference target remains 10 pt, dimension target remains 11.5 pt where space permits.
- Browser checks actual transformed SVG label rectangles against each part rectangle.
- Browser checks pairwise label bounding-box intersections inside each part.
- Reference can move/rotate into a free area; dimension labels try alternate edge/interior positions before using combined `Length × Width`.
- Small panels (<90 mm on either original dimension) always use combined `Length × Width` notation.
- No external part-label schedule is rendered.
- Chromium A4 PDF export was generated and inspected.

## Important limit
Very tiny panels may require smaller/compressed type to keep the reference and dimension data within their physical panel rectangles. Verify print size before production cutting.
