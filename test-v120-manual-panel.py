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
        page = await browser.new_page(viewport={'width': 1365, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.set_content(source_html(), wait_until='domcontentloaded')
        (ROOT / 'verification').mkdir(exist_ok=True)

        # Import two rows while the PDF/Image tab is active.
        await page.locator('#ocrText').fill('''A1 1200__ x 480 = 2\nB2 600_ x 300 = 1''')
        await page.locator('#parseOcr').click()
        before = await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert before == ['A1', 'B2'], before

        # Add Panel is visible and usable without switching to Manual.
        assert await page.locator('#addPanelBtn').is_visible()
        await page.locator('#addPanelBtn').click()
        assert await page.locator('#addPanelDialog').is_visible()
        await page.locator('#addPanelDialog').screenshot(path=str(ROOT / 'verification' / 'v1.2.0-add-panel-form.png'))
        await page.locator('#newPanelRef').fill('EXTRA-01')
        await page.locator('#newPanelLength').fill('720')
        await page.locator('#newPanelWidth').fill('350')
        await page.locator('#newPanelQty').fill('4')
        await page.locator('#newPanelRotate').uncheck()
        await page.locator('#newPanel08Length').fill('2')
        await page.locator('#newPanel08Width').fill('1')
        await page.locator('#newPanel2Length').fill('1')
        await page.locator('#newPanel2Width').fill('0')
        await page.locator('#saveAddAnother').click()

        refs = await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert refs == ['A1', 'B2', 'EXTRA-01'], refs
        assert await page.locator('#rowSummary').inner_text() == '3 rows · 7 pieces'
        assert await page.evaluate("rows[2].length === 720 && rows[2].width === 350 && rows[2].qty === 4 && rows[2].rotate === false")
        assert await page.evaluate("rows[2].edgeBandingSpec['0.8'].length === 2 && rows[2].edgeBandingSpec['0.8'].width === 1 && rows[2].edgeBandingSpec['2'].length === 1")

        # The multi-add form remains open and proposes another unique reference.
        assert await page.locator('#addPanelDialog').is_visible()
        proposed = await page.locator('#newPanelRef').input_value()
        assert proposed and proposed not in refs, proposed
        await page.locator('#newPanelLength').fill('250')
        await page.locator('#newPanelWidth').fill('180')
        await page.locator('#newPanelQty').fill('2')
        await page.locator('#saveAddPanel').click()
        assert not await page.locator('#addPanelDialog').is_visible()
        refs = await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert refs[:2] == ['A1', 'B2'] and len(refs) == 4, refs

        # Manual entries participate in the existing full-row editor.
        await page.locator('#openBanding').click()
        assert await page.locator('#bandingCurrentRef').inner_text() == refs[3]
        assert 'Manually added' in await page.locator('#bandingSourceInfo').inner_text()
        for _ in range(3):
            await page.locator('#bandingPrev').click()
        assert await page.locator('#bandingCurrentRef').inner_text() == refs[0]
        await page.locator('#closeBanding').click()

        # Duplicate references and decimal dimensions are blocked in the manual form.
        await page.locator('#addPanelBtn').click()
        await page.locator('#newPanelRef').fill('A1')
        await page.locator('#saveAddPanel').click()
        assert 'already exists' in await page.locator('#addPanelError').inner_text()
        await page.locator('#newPanelRef').fill('EXTRA-03')
        await page.locator('#newPanelLength').fill('700.5')
        await page.locator('#saveAddPanel').click()
        assert 'whole number' in await page.locator('#addPanelError').inner_text()
        await page.locator('#cancelAddPanel').click()

        # Optimize after manual additions; all quantities are included.
        await page.locator('#sheetL').fill('2440')
        await page.locator('#sheetW').fill('1220')
        await page.locator('[data-cut-mode="optimum"]').click()
        await page.locator('#printBtn:not([disabled])').wait_for(state='visible', timeout=30000)
        assert await page.locator('#mPieces').inner_text() == '9'
        assert not errors, errors
        await page.screenshot(path=str(ROOT / 'verification' / 'v1.2.0-manual-add.png'), full_page=True)
        await browser.close()
        print('CutPlan v1.2.0 manual-panel UI tests passed: always-visible Add Panel on PDF tab; imported order preserved; manual fields and banding saved; Add & Add Another; unique refs; editor navigation; validation; optimization includes new panels.')

if __name__ == '__main__':
    asyncio.run(main())
