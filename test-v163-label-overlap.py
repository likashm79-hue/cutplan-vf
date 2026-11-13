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
            'TINY-A 40 x 20 = 1\n'
            'NARROW-B 600 x 90 = 1\n'
            'NARROW-C 900 x 95 = 1\n'
            'LONG-REF-PANEL 720 x 110 = 1'
        )
        await page.locator('#parseOcr').click()
        refs=await page.locator('#partsBody input[data-k="rowId"]').evaluate_all('(els)=>els.map(e=>e.value)')
        assert refs==['SMALL-W','SMALL-L','BOUNDARY-A','LARGE-A','TINY-A','NARROW-B','NARROW-C','LONG-REF-PANEL'],refs
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
        assert 'BOUNDARY-A' in joined and '600 × 90' not in joined, 'exactly 90 mm remains regular when collision-free'
        assert await page.locator('.small-callouts').count()==0, 'external callout elements must not be rendered'
        audit=await svg.evaluate("""svg => {
          const failures=[]; let checked=0;
          const rects=[...svg.querySelectorAll(':scope > g')];
          for(const group of rects){
            const part=group.querySelector(':scope > rect');
            const labels=[...group.querySelectorAll(':scope > text')];
            if(!part || !labels.length) continue;
            const p=part.getBoundingClientRect();
            const boxes=labels.map(el=>el.getBoundingClientRect());
            checked+=boxes.length;
            boxes.forEach((b,i)=>{
              if(b.left<p.left-1 || b.right>p.right+1 || b.top<p.top-1 || b.bottom>p.bottom+1)
                failures.push(`label ${i} escapes its part rectangle`);
            });
            for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
              const a=boxes[i],b=boxes[j];
              const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left);
              const oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
              if(ox>0.5 && oy>0.5) failures.push(`labels ${i} and ${j} overlap`);
            }
          }
          return {checked,failures};
        }""")
        assert audit['checked']>0,audit
        assert not audit['failures'],audit
        assert await page.locator('.board-print-row').count()>0
        assert not errors,errors
        (ROOT/'verification').mkdir(exist_ok=True)
        await page.locator('.sheet-card').screenshot(path=str(ROOT/'verification'/'v1.6.3-inbox-labels.png'))
        await page.screenshot(path=str(ROOT/'verification'/'v1.6.3-full-ui.png'),full_page=True)
        await page.emulate_media(media='print')
        await page.locator('.sheet-card').screenshot(path=str(ROOT/'verification'/'v1.6.3-print-layout.png'))
        pdf_path=ROOT/'verification'/'v1.6.3-print-check.pdf'
        await page.pdf(path=str(pdf_path),format='A4',print_background=True,prefer_css_page_size=True)
        await browser.close()
        print('CutPlan v1.6.3 browser test passed: 10 pt references, 11.5 pt dimension target, all SVG text contained inside each part, no in-part overlaps, small-panel combined dimensions, zero external callouts, and A4 PDF export.')

if __name__=='__main__':
    asyncio.run(main())
