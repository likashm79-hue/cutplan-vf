import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent

def source_html():
    page = (ROOT / 'index.html').read_text()
    page = re.sub(r'<script src="https://[^\"]+"></script>\s*', '', page)
    for name in ('cutting-list-parser.js', 'nesting-engine.js', 'drawing-layout.js'):
        page = page.replace(f'<script src="./{name}"></script>', '<script>' + (ROOT / name).read_text() + '</script>')
    return page

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = await browser.new_page(viewport={'width': 1400, 'height': 980}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.set_content(source_html(), wait_until='domcontentloaded')

        # Small 250 × 180 panel should use a marker plus Length × Width schedule.
        # Large 1200 × 480 panel should retain regular dimensions along the edges.
        await page.locator('#ocrText').fill('SMALL-A 250 x 180 = 2\nTINY-A 80 x 50 = 1\nLARGE-A 1200 x 480 = 1')
        await page.locator('#parseOcr').click()
        refs = await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert refs == ['SMALL-A', 'TINY-A', 'LARGE-A'], refs
        await page.locator('#sheetL').fill('2440')
        await page.locator('#sheetW').fill('1220')
        await page.locator('[data-cut-mode="optimum"]').click()
        await page.locator('#printBtn:not([disabled])').wait_for(state='visible', timeout=30000)

        # A physically small panel should show its reference and combined dimensions
        # inside the rectangle, at a consistent font size with no rotated edge labels.
        svg = page.locator('.sheet-card svg.layout')
        svg_text_nodes = await svg.locator('text').all_text_contents()
        assert 'SMALL-A' in svg_text_nodes and '250 × 180' in svg_text_nodes, svg_text_nodes
        assert '250 mm' not in svg_text_nodes and '180 mm' not in svg_text_nodes, svg_text_nodes
        svg_text = ''.join(svg_text_nodes)

        # An exceptionally tiny panel cannot fit the combined label and falls back
        # to a marker plus the same Length × Width format in the adjacent schedule.
        schedule = page.locator('.small-callouts')
        await schedule.wait_for(state='visible')
        callout_text = await schedule.inner_text()
        assert 'TINY-A · 80 × 50 mm' in callout_text, callout_text
        assert 'SMALL-A ·' not in callout_text, callout_text

        # A regular panel remains inside the drawing, with dimensions along board edges.
        assert 'LARGE-A' in svg_text, svg_text
        assert '1200 mm' in svg_text and '480 mm' in svg_text, svg_text
        assert 'LARGE-A ·' not in callout_text, callout_text
        assert not errors, errors

        (ROOT / 'verification').mkdir(exist_ok=True)
        await page.locator('.sheet-card').screenshot(path=str(ROOT / 'verification' / 'v1.3.0-small-panel-labels.png'))
        await page.screenshot(path=str(ROOT / 'verification' / 'v1.3.0-full-ui.png'), full_page=True)
        await page.emulate_media(media='print')
        assert await page.locator('.small-callouts').is_visible(), 'small-panel schedule must remain visible in print media'
        await page.locator('.sheet-card').screenshot(path=str(ROOT / 'verification' / 'v1.3.0-print-layout.png'))
        await browser.close()
        print('CutPlan v1.3.0 UI test passed: small panel uses combined Length × Width inside the panel; tiny panel falls back to marker/schedule; regular panel retains edge-aligned dimensions; no browser errors.')

if __name__ == '__main__':
    asyncio.run(main())
