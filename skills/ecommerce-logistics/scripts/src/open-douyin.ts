import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function openDouyin() {
  const dataDir = '/Users/charles/.ecommerce-logistics';
  const context = await chromium.launchPersistentContext(path.join(dataDir, 'browser-data-douyin'), {
    headless: false,
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  
  // Load cookies if exists
  const cookieFile = path.join(dataDir, 'cookies', 'douyin.json');
  if (fs.existsSync(cookieFile)) {
    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
    await context.addCookies(cookies.cookies);
  }
  
  // Open Douyin H5
  await page.goto('https://www.douyin.com');
  
  console.log('抖音 H5 已打开，请告诉我订单页面的位置');
  console.log('当前 URL:', page.url());
  
  // Keep browser open
  await new Promise(() => {});
}

openDouyin().catch(console.error);
