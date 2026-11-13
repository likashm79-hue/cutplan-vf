# CutPlan v1.6.3

## v1.6.3 change — collision-safe in-box labels

- **No overlapping labels:** each reference/dimension candidate is checked using its actual rotated text bounding box. Intersecting or out-of-panel arrangements are rejected.
- **Move before shrinking:** regular panel dimension labels try alternate positions along the edges and inside the part; the reference can move or rotate to the free space.
- **Combined fallback:** if a clean separate layout is not possible, the part uses an in-box `Length × Width` label.
- **Small panels:** if either original dimension is below 90 mm, combined `Length × Width` notation is always used.
- **Reference size preserved:** reference labels retain the previous 10 pt target. Dimension numbers retain an 11.5 pt target when there is room. Both may adapt down only when required to stay inside the physical part.
- **No outside labels:** no off-panel schedule or external label is rendered, including in Print / Save PDF.
- **Unchanged:** optimizer geometry, parsing, manual Add Panel, edge-banding calculations, board naming and waste display.

## v1.2.0 changes

- **Add Panel is always available:** the `＋ Add Panel` action stays beside the main cutting-list table on the PDF/Image, CSV and Manual tabs. Users can add missing or extra panels after PDF/image/CSV import without switching tabs.
- **Complete manual panel form:** enter a unique reference, whole-number length and width, quantity, rotation permission, and 0.8 mm / 2 mm edge-banding counts for both dimensions.
- **Add multiple panels quickly:** `Add & Add Another` appends the current panel and keeps the form open with the next available numeric reference. `Add Panel` appends and closes the form.
- **Append-only behavior:** manual entries are appended after the imported rows; existing imported rows and their source order are not replaced or reordered.
- **Same production workflow:** manually added panels appear in the main list and Row Editor, contribute to edge-banding totals and piece counts, and are included in the next optimization and PDF output. Adding or changing a panel invalidates the previous optimization until the user optimizes again.
- **Validation:** references must be unique; length and width must be whole millimetres from 1–100000; quantity must be 1–10000; each edge-banding count must be 0, 1 or 2.

## v1.0.0 changes

- **No separate review queue:** all usable part-like candidates detected from PDF, image, OCR text or CSV are inserted directly into the main cutting-list table in source order.
- **Permissive row capture:** quantities above 10 are accepted into the list; decimal-looking OCR dimensions are normalized to whole millimetres; missing quantities default to 1; excess edge markers are capped at two. Any automatic normalization is noted on that row.
- **Duplicate rows are preserved:** repeated references are not discarded. Later duplicates receive a unique suffix (`A1-2`, `A1-3`, etc.) and the original reference stays in the source metadata.
- **Context in the Row Editor:** each imported row displays its original source line and any parser notes while editing. Open Row Editor and use Next / Previous to inspect the full list in order.
- **Document-noise filtering:** common headers, column headings, page counters, board/sheet metadata, totals and lines without a valid dimension pair are excluded from the part rows.
- **Stronger PDF import:** digital text is grouped by geometric baselines and column gaps page-by-page. Pages that look under-read are selectively cross-checked with two Tesseract page segmentation modes (PSM 6 and PSM 11); only OCR pages with a better row yield replace the digital page.
- **Image OCR cross-check:** image uploads are recognized with both PSM 6 and PSM 11, and the result with the stronger row yield (confidence as tie-breaker) is selected.
- **Preserved production features:** nesting optimizer, deterministic search, guillotine cut-tree validation, edge-banding calculations, row editor, board drawings, amber unlabeled offcuts, and A4 print/PDF layout remain in place.

## Import workflow

1. Select a PDF or image and choose **Read PDF / image**.
2. Check the recognized text if needed, then choose **Parse rows**.
3. All detected part rows appear in the main table, in the order they were found in the source. Non-part document lines are filtered.
4. Open **Row Editor** and step through the rows. The editor shows the original source line and any parser notes so the operator can correct reference, length, width, quantity, rotation and edge-banding counts.
5. Verify the full cutting list against the source document before optimizing and before production cutting.

## Parsing policy and important limits

- Parsed length and width are always whole-number millimetres. Decimal-looking OCR values are rounded to the nearest millimetre and flagged in the row editor's parser note; check and correct these values against the source.
- Missing or unreadable quantity defaults to 1 with a parser note. Quantities above 10 are not blocked; valid values up to 10,000 are retained.
- Edge counts are limited to two per material per dimension. Larger OCR marker runs are capped at two and noted.
- Repeated part references are retained with unique display references. Check whether the duplicate represents a genuinely separate line or a repeated OCR capture.
- A line must yield at least two plausible dimensions to become a part row. Headers, totals, page numbers and document metadata are filtered.
- OCR is not guaranteed to be correct on every scan. Always inspect the main list before optimization/cutting. The actual large workshop PDF should be used for final acceptance testing.

## Run on Ubuntu / Linux

Extract the ZIP, then run from the project directory:

```bash
cd ~/Downloads/CutPlan-v1.6.3
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000` in Chrome or Chromium. Keep `index.html`, `cutting-list-parser.js`, `nesting-engine.js`, `drawing-layout.js` and `nesting-worker.js` together. Use localhost rather than opening `index.html` as a `file://` URL.

The optimizer and parser run in the browser. PDF.js and Tesseract.js load from jsDelivr for PDF/image extraction and OCR, so those import features require an internet connection.

## v1.6.3 label verification

Run the drawing and browser collision checks with:

```bash
node test-drawings.js
python3 test-v140-label-rules.py
python3 test-v163-label-overlap.py
```

The checks cover actual transformed SVG text bounds, no overlap between labels within a part, containment inside each part rectangle, moving/rotating labels to open positions, combined small-panel dimensions, the strict 90 mm boundary and A4 PDF export.

## Tests

Run these commands from the project directory:

```bash
node backup-v0.5.0/test-engine.js
node test-engine.js
node test-drawings.js
node test-v100-parser.js
python3 test-v100-ui.py
python3 test-v120-manual-panel.py
python3 test-v140-label-rules.py
python3 test-v163-label-overlap.py
```

`test-v100-ui.py` runs the interface in headless Chromium and saves the UI/PDF verification files in `verification/`.

## Verification boundary

The v1.0.0 baseline automated suite tests a 12-page synthetic PDF with 96 rows, order preservation, duplicate references, high quantities, decimal OCR normalization, packed same-line rows, document-noise filtering, selective page OCR, both OCR segmentation modes, row-editor navigation, optimizer execution and PDF rendering. The exact workshop PDF that previously mis-parsed was not supplied with this task, so accuracy on that particular file is not yet independently confirmed.


## Manual panel entry verification (v1.2.0)

Run `python3 test-v120-manual-panel.py` to verify that Add Panel remains available while the PDF/Image tab is active after import, imported rows retain their order, all form fields are stored, Add & Add Another works, manual rows are editable in Row Editor, invalid/duplicate values are rejected, and the new rows are included in optimization.


## Historical v1.6.0 label rules (superseded by v1.6.3)

- Drawing labels use a bold 20 pt target, double the previous 10 pt target. The renderer does not silently shrink dimension text below this target.
- Regular panels keep separate horizontal width and vertical length labels when both edge labels and the reference fit at 20 pt.
- If those edge labels do not fit, the panel uses a horizontal `Length × Width` label at 20 pt; if that still cannot fit, a marker links to a larger external schedule.
- Panels with either source dimension below 90 mm continue to use combined `Length × Width` notation.
- Drawing dimension values and the external schedule omit the repeated `mm` suffix.
- The external schedule typography has also been enlarged substantially for screen and print.


## v1.6.3 collision-safe label verification

References retain their previous 10 pt target; dimensions target 11.5 pt when space permits. The browser test uses real SVG text bounding boxes after rotation to check that every label remains inside its corresponding panel and that no text boxes overlap. It also generates an A4 PDF for visual inspection. Tiny panels may still need adaptive/compressed text to fit all information inside their physical boundaries.
