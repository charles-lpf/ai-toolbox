import { chromium } from 'playwright';
import path from 'path';

async function getTaobaoLogistics() {
  const context = await chromium.launchPersistentContext(
    '/Users/charles/.ecommerce-logistics/browser-data-taobao',
    { headless: false, viewport: { width: 1280, height: 800 } }
  );

  const page = await context.newPage();
  await page.goto('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm');
  await page.waitForTimeout(3000);

  // First, get all orders with their logistics buttons
  const ordersWithButtons = await page.evaluate(() => {
    const results: Array<{
      orderId: string;
      title: string;
      status: string;
      price: string;
      buttonIndex: number;
    }> = [];
    
    // Find all buttons that contain "查看物流"
    const allButtons = document.querySelectorAll('a, button');
    let buttonIndex = 0;
    
    for (const btn of allButtons) {
      if (!btn.textContent?.includes('查看物流')) continue;
      
      // Find the order container for this button
      let container = btn as Element;
      for (let i = 0; i < 10; i++) {
        if (container.parentElement) {
          container = container.parentElement;
          const text = container.textContent || '';
          if (text.includes('订单号')) {
            break;
          }
        }
      }
      
      const containerText = container.textContent || '';
      
      // Extract order ID
      const orderMatch = containerText.match(/订单号[:：]?\s*(\d{10,})/);
      const orderId = orderMatch ? orderMatch[1] : `btn-${buttonIndex}`;
      
      // Extract title
      let title = '';
      const links = container.querySelectorAll('a');
      for (const link of links) {
        const linkText = link.textContent?.trim() || '';
        if (linkText.length > 10 && 
            !linkText.includes('查看') && 
            !linkText.includes('删除') &&
            !linkText.includes('申请') &&
            !linkText.includes('确认') &&
            !linkText.includes('评价')) {
          title = linkText.replace(/\[交易快照\]/g, '').trim();
          break;
        }
      }
      
      // Extract status
      let status = '';
      if (containerText.includes('交易成功')) status = '交易成功';
      else if (containerText.includes('卖家已发货')) status = '卖家已发货';
      else if (containerText.includes('待发货')) status = '待发货';
      else if (containerText.includes('待收货')) status = '待收货';
      else if (containerText.includes('已发货')) status = '已发货';
      
      // Extract price
      const priceMatches = containerText.match(/￥(\d+\.?\d{0,2})/g);
      const price = priceMatches ? priceMatches[0] : '';
      
      results.push({ orderId, title, status, price, buttonIndex });
      buttonIndex++;
    }
    
    return results;
  });

  console.log(`找到 ${ordersWithButtons.length} 个有物流按钮的订单\n`);

  // Now click each logistics button and extract info
  const logisticsResults = [];
  
  for (const order of ordersWithButtons.slice(0, 5)) {
    console.log(`正在查询订单 ${order.orderId} 的物流...`);
    
    // Click the logistics button
    const clicked = await page.evaluate((index) => {
      const buttons = document.querySelectorAll('a, button');
      let logisticsButtons: Element[] = [];
      for (const btn of buttons) {
        if (btn.textContent?.includes('查看物流')) {
          logisticsButtons.push(btn);
        }
      }
      
      if (logisticsButtons[index]) {
        (logisticsButtons[index] as HTMLElement).click();
        return true;
      }
      return false;
    }, order.buttonIndex);
    
    if (!clicked) {
      console.log(`  点击失败`);
      continue;
    }
    
    // Wait for modal to appear
    await page.waitForTimeout(2000);
    
    // Extract logistics data from modal
    const logisticsData = await page.evaluate(() => {
      const modal = document.querySelector('.next-overlay-wrapper, [class*="modal"], [class*="dialog"]');
      const content = modal?.textContent || document.body.textContent || '';
      
      // Look for tracking info
      let trackingNumber = '';
      let carrier = '';
      
      // Try to find courier and tracking number
      const patterns = [
        { regex: /(顺丰)[^：]*[：:]\s*(SF\d{12,})/, name: '顺丰' },
        { regex: /(中通)[^：]*[：:]\s*(\d{12,})/, name: '中通' },
        { regex: /(圆通)[^：]*[：:]\s*(YT?\d{12,})/, name: '圆通' },
        { regex: /(申通)[^：]*[：:]\s*(ST?\d{12,})/, name: '申通' },
        { regex: /(韵达)[^：]*[：:]\s*(\d{12,})/, name: '韵达' },
        { regex: /(EMS)[^：]*[：:]\s*(\d{9,})/, name: 'EMS' },
        { regex: /(邮政)[^：]*[：:]\s*(\d{9,})/, name: '邮政' },
        { regex: /(极兔)[^：]*[：:]\s*(JT\d{12,})/, name: '极兔' },
        { regex: /运单号[：:]\s*(\d{10,})/, name: '' },
        { regex: /快递单号[：:]\s*(\d{10,})/, name: '' }
      ];
      
      for (const p of patterns) {
        const match = content.match(p.regex);
        if (match) {
          carrier = p.name || match[1] || '未知快递';
          trackingNumber = match[2] || match[1];
          break;
        }
      }
      
      // Extract timeline
      const timeline: Array<{time: string, desc: string}> = [];
      const items = document.querySelectorAll('.logistics-item, .tracking-item, [class*="logistics"] [class*="item"]');
      
      for (const item of items) {
        const time = item.querySelector('.time, [class*="time"]')?.textContent?.trim() || '';
        const desc = item.textContent?.trim() || '';
        if (desc && desc.length > 5) {
          timeline.push({ time, desc: desc.substring(0, 100) });
        }
      }
      
      return { carrier, trackingNumber, timeline, content: content.substring(0, 500) };
    });
    
    console.log(`  快递: ${logisticsData.carrier || '未识别'}`);
    console.log(`  单号: ${logisticsData.trackingNumber || '未识别'}`);
    
    if (logisticsData.timeline.length > 0) {
      console.log(`  最新物流: ${logisticsData.timeline[0].desc}`);
    }
    
    logisticsResults.push({
      ...order,
      ...logisticsData
    });
    
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    // Click outside to close if Escape didn't work
    await page.mouse.click(10, 10);
    await page.waitForTimeout(500);
  }

  console.log(`\n=== 物流信息汇总 ===\n`);
  
  // Filter for in-transit orders
  const inTransitOrders = logisticsResults.filter(o => 
    o.status.includes('发货') || 
    o.status.includes('运输') ||
    o.timeline.some(t => t.desc.includes('运输') || t.desc.includes('派送'))
  );
  
  if (inTransitOrders.length > 0) {
    console.log(`运输中订单 (${inTransitOrders.length}个):\n`);
    for (const order of inTransitOrders) {
      console.log(`订单号: ${order.orderId}`);
      console.log(`商品: ${order.title}`);
      console.log(`快递: ${order.carrier || '未知'}`);
      console.log(`单号: ${order.trackingNumber || '未知'}`);
      console.log(`状态: ${order.status}`);
      console.log('---');
    }
  } else {
    console.log('暂无运输中订单');
    console.log('\n所有订单状态:', logisticsResults.map(o => `${o.orderId}: ${o.status}`).join('\n'));
  }

  await context.close();
}

getTaobaoLogistics();