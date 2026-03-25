import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function debug() {
  const dataDir = '/Users/charles/.ecommerce-logistics';
  const context = await chromium.launchPersistentContext(path.join(dataDir, 'browser-data'), {
    headless: false,
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  
  // Load cookies
  const cookieFile = path.join(dataDir, 'cookies', 'pdd.json');
  if (fs.existsSync(cookieFile)) {
    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    await context.addCookies(cookies.cookies);
  }
  
  await page.goto('https://mobile.yangkeduo.com/orders.html');
  await page.waitForTimeout(3000);
  
  // Find all buttons and their data-test attributes
  const buttons = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button, [role="button"], a');
    const results: Array<{ text: string; dataTest: string | null; className: string }> = [];
    allButtons.forEach(btn => {
      const text = btn.textContent?.trim() || '';
      const dataTest = btn.getAttribute('data-test');
      if (text.includes('物流') || text.includes('查看') || dataTest) {
        results.push({
          text: text.substring(0, 50),
          dataTest,
          className: btn.className?.substring(0, 50) || ''
        });
      }
    });
    return results;
  });
  
  console.log('Buttons found:', JSON.stringify(buttons, null, 2));
  
  await page.screenshot({ path: '/Users/charles/.ecommerce-logistics/pdd-debug-buttons.png', fullPage: true });
  
  await context.close();
}

debug().catch(console.error);
