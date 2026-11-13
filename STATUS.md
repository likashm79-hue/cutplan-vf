# CutPlan v1.6.3 — Delivery status

**State:** Collision-safe in-box label update. References retain their previous 10 pt target; dimensions target 11.5 pt when space permits.

## Delivered
- Corrected the label collision check to compare actual rotated text bounding boxes.
- Added alternate positions along top/bottom/left/right edges and inside open areas of each panel.
- Moves/rotates reference labels when they collide with dimension values.
- Uses combined `Length × Width` in-box format for small panels (<90 mm on either source dimension) and as a fallback where separate labels cannot be placed safely.
- Preserves no-off-panel-label rule and keeps labels within their own part rectangles.
- Optimizer, parsing, manual panel entry, banding totals and board geometry are unchanged.

## Verification boundary
- Node regression and drawing tests passed.
- Chromium UI geometry audit checked actual rendered text boxes for containment and pairwise collision.
- A4 PDF was generated and inspected.
- Verify real workshop drawings at actual print scale before production cutting.
