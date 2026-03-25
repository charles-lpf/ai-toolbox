import { chromium } from 'playwright';
import path from 'path';

async function queryTaobaoOrders() {
  const context = await chromium.launchPersistentContext(
    '/Users/charles/.ecommerce-logistics/browser-data-taobao',
    { headless: false, viewport: { width: 1280, height: 800 } }
  );

  const page = await context.newPage();
  await page.goto('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm');
  await page.waitForTimeout(3000);

  // Extract orders using container-based approach
  const orders = await page.evaluate(() => {
    const results: Array<{
      orderId: string;
      title: string;
      status: string;
      price: string;
      hasLogistics: boolean;
      logisticsText?: string;
    }> = [];
    
    // Find all divs that contain order number
    const allDivs = document.querySelectorAll('div');
    const processedOrders = new Set<string>();
    
    for (const div of allDivs) {
      const text = div.textContent || '';
      
      // Check if this div contains an order number
      const orderMatch = text.match(/订单号[:：]?\s*(\d{10,})/);
      if (!orderMatch) continue;
      
      const orderId = orderMatch[1];
      if (processedOrders.has(orderId)) continue;
      processedOrders.add(orderId);
      
      // Get the parent container that holds the full order info
      let container = div;
      for (let i = 0; i < 5; i++) {
        if (container.parentElement && container.parentElement.textContent?.includes(orderId)) {
          container = container.parentElement;
        } else {
          break;
        }
      }
      
      const containerText = container.textContent || '';
      
      // Extract title - look for product name patterns
      let title = '';
      // Try to find title in links
      const links = container.querySelectorAll('a');
      for (const link of links) {
        const linkText = link.textContent?.trim() || '';
        // Skip if it's just navigation or button text
        if (linkText.length > 10 && 
            !linkText.includes('查看') && 
            !linkText.includes('删除') &&
            !linkText.includes('申请') &&
            !linkText.includes('确认') &&
            !linkText.includes('评价')) {
          title = linkText;
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
      else if (containerText.includes('退款')) status = '退款中';
      
      // Check for logistics
      const hasLogistics = containerText.includes('查看物流');
      let logisticsText = '';
      if (hasLogistics) {
        // Try to find logistics info
        const logisticsMatch = containerText.match(/查看物流[\s\S]{0,200}/);
        if (logisticsMatch) {
          logisticsText = logisticsMatch[0].substring(0, 100);
        }
      }
      
      // Extract price - look for the main price
      const priceMatches = containerText.match(/￥(\d+\.?\d{0,2})/g);
      const price = priceMatches ? priceMatches[0] : '';
      
      results.push({ orderId, title, status, price, hasLogistics, logisticsText });
    }
    
    return results;
  });

  console.log(`\n找到 ${orders.length} 个订单:\n`);
  
  // Filter and display orders with logistics
  const ordersWithLogistics = orders.filter(o => o.hasLogistics);
  console.log(`其中 ${ordersWithLogistics.length} 个订单有物流信息:\n`);
  
  for (const order of ordersWithLogistics) {
    console.log(`订单号: ${order.orderId}`);
    console.log(`商品: ${order.title || '(未提取到名称)'}`);
    console.log(`状态: ${order.status}`);
    console.log(`价格: ${order.price}`);
    console.log('---');
  }
  
  // Also show recent orders without logistics
  console.log(`\n最近 5 个订单（无物流）:\n`);
  const ordersWithoutLogistics = orders.filter(o => !o.hasLogistics).slice(0, 5);
  for (const order of ordersWithoutLogistics) {
    console.log(`订单号: ${order.orderId}`);
    console.log(`商品: ${order.title || '(未提取到名称)'}`);
    console.log(`状态: ${order.status}`);
    console.log(`价格: ${order.price}`);
    console.log('---');
  }

  await context.close();
}

queryTaobaoOrders();