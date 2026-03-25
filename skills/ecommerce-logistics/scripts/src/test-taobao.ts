import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const dataDir = '/Users/charles/.ecommerce-logistics';

async function testTaobao() {
  // Use persistent context to maintain login state
  const context = await chromium.launchPersistentContext(path.join(dataDir, 'browser-data-taobao'), {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Load existing cookies if any
  const cookieFile = path.join(dataDir, 'cookies', 'taobao.json');
  if (fs.existsSync(cookieFile)) {
    try {
      const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
      await context.addCookies(cookieData.cookies);
      console.log('Loaded existing cookies');
    } catch (e) {
      console.log('Failed to load cookies:', e);
    }
  }

  // Navigate to order list
  console.log('Navigating to order list...');
  await page.goto('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm', { timeout: 30000 });

  // Check if login required
  const isLoginPage = await page.locator('.login-box, #J_Quick2Static, .login-form').count() > 0;
  
  if (isLoginPage || page.url().includes('login.taobao.com')) {
    console.log('Login required, waiting for manual login...');
    
    // Wait for navigation away from login page
    await page.waitForFunction(() => !window.location.href.includes('login.taobao.com'), { timeout: 120000 });
    console.log('Login detected, waiting for order page...');
    
    // Wait for order page to load
    await page.waitForSelector('.bought-table, .order-item', { timeout: 30000 });
    
    // Save cookies
    const cookies = await context.cookies();
    fs.writeFileSync(cookieFile, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
    console.log('Cookies saved');
  }

  console.log('Current URL:', page.url());

  // Take screenshot
  await page.screenshot({ path: path.join(dataDir, 'taobao-test.png'), fullPage: true });
  console.log('Screenshot saved');

  // Try to extract orders
  const hasOrders = await page.locator('.bought-table .order-item').count() > 0;
  console.log('Has orders:', hasOrders);

  if (hasOrders) {
    const orders = await page.evaluate(() => {
      const items = document.querySelectorAll('.bought-table .order-item');
      return Array.from(items).slice(0, 5).map(item => {
        const orderIdEl = item.querySelector('.order-info .order-no');
        const titleEl = item.querySelector('.item-title a');
        const statusEl = item.querySelector('.order-status');
        
        return {
          orderId: orderIdEl?.textContent?.replace(/[^\d]/g, '') || '',
          title: titleEl?.textContent?.trim() || '',
          status: statusEl?.textContent?.trim() || ''
        };
      });
    });
    
    console.log('Orders found:', JSON.stringify(orders, null, 2));
  }

  // Keep browser open for inspection
  console.log('Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);

  await context.close();
}

testTaobao().catch(console.error);