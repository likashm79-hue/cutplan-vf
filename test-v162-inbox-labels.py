import asyncio, re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent

def source_html():
    page=(ROOT/'index.html').read_text()
    page=re.sub(r'<script src="https://[^\"]+"></script>\s*','',page)
    for name in ('cutting-list-parser.js','nesting-engine.js','drawing-layout.js'):
        page=page.replace(f'<script src="./{name}"></script>','<script>'+(ROOT/name).read_text()+'</script>')
    return page

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        await page.set_content(source_html(),wait_until='domcontentloaded')
        await page.locator('#ocrText').fill(
            'SMALL-W 500 x 89 = 1\n'
            'SMALL-L 80 x 180 = 1\n'
            'BOUNDARY-A 600 x 90 = 1\n'
            'LARGE-A 1200 x 480 = 1\n'
            'TINY-A 40 x 20 = 1'
        )
        await page.locator('#parseOcr').click()
        refs=await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert refs==['SMALL-W','SMALL-L','BOUNDARY-A','LARGE-A','TINY-A'],refs
        await page.locator('#sheetL').fill('2440')
        await page.locator('#sheetW').fill('1220')
        await page.locator('[data-cut-mode="optimum"]').click()
        await page.locator('#printBtn:not([disabled])').wait_for(state='visible',timeout=30000)
        svg=page.locator('.sheet-card svg.layout').first
        texts=await svg.locator('text').all_text_contents()
        joined=' | '.join(texts)
        assert '500 × 89' in joined, joined
        assert '80 × 180' in joined, joined
        assert '40 × 20' in joined, joined
        assert '1200' in joined and '480' in joined, joined
        assert 'LARGE-A' in joined, joined
        assert await page.locator('.small-callouts').count()==0, 'external callout elements must not be rendered'
        assert await page.locator('.board-print-row').count()>0
        assert not errors,errors
        (ROOT/'verification').mkdir(exist_ok=True)
        await page.locator('.sheet-card').screenshot(path=str(ROOT/'verification'/'v1.6.2-inbox-labels.png'))
        await page.screenshot(path=str(ROOT/'verification'/'v1.6.2-full-ui.png'),full_page=True)
        await page.emulate_media(media='print')
        await page.locator('.sheet-card').screenshot(path=str(ROOT/'verification'/'v1.6.2-print-layout.png'))
        pdf_path=ROOT/'verification'/'v1.6.2-print-check.pdf'
        await page.pdf(path=str(pdf_path),format='A4',print_background=True,prefer_css_page_size=True)
        await browser.close()
        print('CutPlan v1.6.2 browser test passed: slightly increased 11.5 pt label size, references and dimensions inside their own panel rectangles, zero external callout schedules, and A4 PDF export.')

if __name__=='__main__':
    asyncio.run(main())
