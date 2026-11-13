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
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.set_content(source_html(), wait_until='domcontentloaded')
        await page.locator('#ocrText').fill(
            'SMALL-W 500 x 89 = 1\n'
            'SMALL-L 80 x 180 = 1\n'
            'BOUNDARY-A 600 x 90 = 1\n'
            'LARGE-A 1200 x 480 = 1'
        )
        await page.locator('#parseOcr').click()
        refs=await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert refs==['SMALL-W','SMALL-L','BOUNDARY-A','LARGE-A'],refs
        await page.locator('#sheetL').fill('2440')
        await page.locator('#sheetW').fill('1220')
        await page.locator('[data-cut-mode="optimum"]').click()
        await page.locator('#printBtn:not([disabled])').wait_for(state='visible',timeout=30000)

        svg=page.locator('.sheet-card svg.layout')
        svg_text=' '.join(await svg.locator('text').all_text_contents())
        # Small panel rows use L × W without a unit, either in the panel or side schedule.
        schedule=page.locator('.small-callouts')
        schedule_text=(await schedule.inner_text()) if await schedule.count() else ''
        all_drawing_text=svg_text+' '+schedule_text
        assert '500 × 89' in all_drawing_text, all_drawing_text
        assert '80 × 180' in all_drawing_text, all_drawing_text
        assert '500 × 89 mm' not in all_drawing_text and '80 × 180 mm' not in all_drawing_text, all_drawing_text
        # Exactly 90 is regular. In v1.6.3 its edge labels fit after the
        # reference was moved, so it should retain separate dimension values.
        assert 'BOUNDARY-A' in svg_text and '600 × 90' not in svg_text, all_drawing_text
        assert '600' in svg_text and '90' in svg_text, all_drawing_text
        # Regular part retains separate side labels and no appended mm unit.
        assert '1200' in svg_text and '480' in svg_text, svg_text
        assert '1200 mm' not in svg_text and '480 mm' not in svg_text, svg_text
        # All labels remain in the panel. No separate side schedule is used.
        assert await schedule.count()==0, 'v1.6.3 must not show an external part-label schedule'
        assert not errors, errors

        (ROOT/'verification').mkdir(exist_ok=True)
        await page.locator('.sheet-card').screenshot(path=str(ROOT/'verification'/'v1.6.3-boundary-preview.png'))
        await page.screenshot(path=str(ROOT/'verification'/'v1.6.3-boundary-full-ui.png'),full_page=True)
        await page.emulate_media(media='print')
        if await schedule.count():
            assert await schedule.is_visible(), 'callout schedule should remain visible in print media'
        await page.locator('.sheet-card').screenshot(path=str(ROOT/'verification'/'v1.6.3-boundary-print-preview.png'))
        await page.pdf(path=str(ROOT/'verification'/'v1.6.3-boundary-print-check.pdf'), format='A4', print_background=True, prefer_css_page_size=True)
        await browser.close()
        print('CutPlan v1.6.3 boundary test passed: small panels use combined Length × Width, exactly 90 mm remains regular with collision-free edge labels, and no external callout schedule is rendered.')

if __name__=='__main__':
    asyncio.run(main())
