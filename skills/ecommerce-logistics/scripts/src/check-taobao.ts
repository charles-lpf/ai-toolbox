import { chromium } from 'playwright';
import path from 'path';

async function check() {
  const context = await chromium.launchPersistentContext(
    '/Users/charles/.ecommerce-logistics/browser-data-taobao',
    { headless: false, viewport: { width: 1280, height: 800 } }
  );
  const page = await context.newPage();
  await page.goto('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm');
  await page.waitForTimeout(3000);
  
  // Get all class names that contain "order"
  const classes = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const classSet = new Set<string>();
    allElements.forEach(el => {
      el.classList.forEach(c => {
        if (c.toLowerCase().includes('order') || c.toLowerCase().includes('trade')) {
          classSet.add(c);
        }
      });
    });
    return Array.from(classSet).slice(0, 20);
  });
  
  console.log('Classes with order/trade:', classes);
  
  // Count elements with different selectors
  const counts = await page.evaluate(() => ({
    jsOrderContainer: document.querySelectorAll('.js-order-container').length,
    orderItem: document.querySelectorAll('.order-item').length,
    tradeOrder: document.querySelectorAll('.trade-order').length,
    dataOrderid: document.querySelectorAll('[data-orderid]').length,
    tbody: document.querySelectorAll('tbody').length,
    tables: document.querySelectorAll('table').length
  }));
  
  console.log('Element counts:', counts);
  
  await page.screenshot({ path: '/Users/charles/.ecommerce-logistics/taobao-check.png', fullPage: true });
  
  await context.close();
}

check();