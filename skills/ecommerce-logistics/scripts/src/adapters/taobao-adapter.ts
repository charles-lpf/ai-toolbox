import { BrowserContext } from 'playwright';
import { BaseAdapter } from './base-adapter.js';
import { PlatformConfig, OrderLogistics, LogisticsEvent } from '../types/index.js';

const TAOBAO_CONFIG: PlatformConfig = {
  name: 'taobao',
  baseUrl: 'https://www.taobao.com',
  loginUrl: 'https://login.taobao.com',
  orderListUrl: 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm',
  selectors: {
    loginIndicator: '.login-box, #J_Quick2Static, .login-form',
    orderItem: '.bought-table .order-item',
    orderId: '.order-info .order-no',
    orderTitle: '.item-title a',
    orderStatus: '.order-status',
    logisticsButton: '.view-logistics, .logistics-info',
    trackingNumber: '.logistics-num, .tracking-no',
    carrier: '.logistics-company, .carrier-name',
    timeline: '.logistics-timeline .timeline-item'
  }
};

export class TaobaoAdapter extends BaseAdapter {
  constructor(context: BrowserContext) {
    super(TAOBAO_CONFIG, context);
  }

  getName(): string {
    return '淘宝';
  }

  protected isLoginUrl(url: string): boolean {
    return url.includes('login.taobao.com') || 
           url.includes('login.m.taobao.com') ||
           url.includes('login.alibaba.com');
  }

  async isLoggedIn(): Promise<boolean> {
    const page = await this.initPage();
    await page.goto(this.config.orderListUrl, { timeout: 10000 });
    const isLoginPage = await this.detectLoginPage(page);
    console.log(`  [DEBUG] Taobao isLoggedIn check - isLoginPage: ${isLoginPage}, URL: ${page.url()}`);
    return !isLoginPage;
  }

  async getOrders(): Promise<OrderLogistics[]> {
    await this.safeGoto(this.config.orderListUrl);
    const page = await this.initPage();

    // Wait for order list to load
    await page.waitForSelector(this.config.selectors.orderItem, { timeout: 15000 });

    const orders = await page.evaluate((selectors) => {
      const items = document.querySelectorAll(selectors.orderItem);
      return Array.from(items).map(item => {
        const orderIdEl = item.querySelector(selectors.orderId);
        const titleEl = item.querySelector(selectors.orderTitle);
        const statusEl = item.querySelector(selectors.orderStatus);
        
        return {
          orderId: orderIdEl?.textContent?.replace(/[^\d]/g, '') || '',
          title: titleEl?.textContent?.trim() || '',
          status: statusEl?.textContent?.trim() || ''
        };
      });
    }, this.config.selectors);

    const results: OrderLogistics[] = [];
    for (const order of orders.slice(0, 10)) { // Limit to recent 10 orders
      if (order.orderId) {
        const logistics = await this.getOrderLogistics(order.orderId);
        if (logistics) {
          results.push(logistics);
        }
      }
    }

    return results;
  }

  async getOrderLogistics(orderId: string): Promise<OrderLogistics | null> {
    try {
      const page = await this.initPage();
      
      // Navigate to order detail or logistics page
      const logisticsUrl = `https://detail.i1688.com/page/logistics.htm?orderId=${orderId}`;
      await this.safeGoto(logisticsUrl, { timeout: 15000 });

      // Check if logistics info exists
      const hasLogistics = await page.locator(this.config.selectors.trackingNumber).count() > 0;
      if (!hasLogistics) {
        return null;
      }

      const data = await page.evaluate((selectors) => {
        const trackingEl = document.querySelector(selectors.trackingNumber);
        const carrierEl = document.querySelector(selectors.carrier);
        const timelineEls = document.querySelectorAll(selectors.timeline);

        const timeline: LogisticsEvent[] = Array.from(timelineEls).map(el => ({
          time: el.querySelector('.time')?.textContent?.trim() || '',
          location: el.querySelector('.location')?.textContent?.trim() || '',
          status: el.querySelector('.status')?.textContent?.trim() || '',
          description: el.textContent?.trim() || ''
        }));

        return {
          trackingNumber: trackingEl?.textContent?.replace(/[^\w]/g, '') || '',
          carrier: carrierEl?.textContent?.trim() || '未知快递',
          timeline,
          latestUpdate: timeline[0]?.time || ''
        };
      }, this.config.selectors);

      return {
        platform: 'taobao',
        orderId,
        trackingNumber: data.trackingNumber,
        carrier: data.carrier,
        status: this.parseStatus(data.timeline[0]?.status || ''),
        timeline: data.timeline,
        latestUpdate: data.latestUpdate
      };
    } catch (error) {
      console.error(`Failed to get logistics for Taobao order ${orderId}:`, error);
      return null;
    }
  }
}