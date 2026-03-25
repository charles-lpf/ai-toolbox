import { chromium } from 'playwright';

async function debugTaobao() {
  const context = await chromium.launchPersistentContext(
    '/Users/charles/.ecommerce-logistics/browser-data-taobao',
    { headless: false, viewport: { width: 1280, height: 800 } }
  );

  const page = await context.newPage();
  await page.goto('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm');
  await page.waitForTimeout(3000);

  // Scroll down to load orders
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
  }

  // Get all text containing "查看物流"
  const logisticsInfo = await page.evaluate(() => {
    const results: Array<{text: string, parentText: string}> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent?.includes('查看物流')) {
        const parent = node.parentElement;
        results.push({
          text: node.textContent.trim(),
          parentText: parent?.textContent?.trim().substring(0, 200) || ''
        });
      }
    }
    
    return results;
  });
  
  console.log(`找到 ${logisticsInfo.length} 个"查看物流"文本:\n`);
  logisticsInfo.slice(0, 5).forEach((info, i) => {
    console.log(`[${i}] 文本: ${info.text}`);
    console.log(`    父元素: ${info.parentText.substring(0, 100)}...`);
    console.log('');
  });

  // Try to find and click the first logistics button
  if (logisticsInfo.length > 0) {
    console.log('尝试点击第一个"查看物流"...');
    
    const clicked = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent?.includes('查看物流')) {
          // Find clickable parent
          let el: Element | null = node.parentElement;
          for (let i = 0; i < 5 && el; i++) {
            if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
              (el as HTMLElement).click();
              return `Clicked ${el.tagName}`;
            }
            el = el.parentElement;
          }
          // Try clicking the text node's parent
          if (node.parentElement) {
            (node.parentElement as HTMLElement).click();
            return 'Clicked parent';
          }
        }
      }
      return 'Not found';
    });
    
    console.log('点击结果:', clicked);
    
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: '/Users/charles/.ecommerce-logistics/taobao-clicked.png' });
    console.log('截图已保存');
  }

  await context.close();
}

debugTaobao();