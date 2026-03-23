import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export interface StoreAnalysis {
  domain: string;
  platform: 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'custom' | 'unknown';
  hasShoppingAssistant: boolean;
  detectedAssistants: string[];
  productCategories: string[];
  estimatedProducts: number;
  brandName: string;
  description: string;
  socialLinks: string[];
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
  };
  techStack: {
    analytics: string[];
    marketing: string[];
    payments: string[];
    other: string[];
  };
}

// Shopping assistant signatures to detect
const ASSISTANT_SIGNATURES = {
  tidio: ['tidio', 'tidiochat'],
  intercom: ['intercom', 'intercomcdn'],
  drift: ['drift', 'driftt'],
  gorgias: ['gorgias'],
  zendesk: ['zendesk', 'zdassets', 'zopim'],
  livechat: ['livechat', 'livechatinc'],
  crisp: ['crisp.chat', 'client.crisp'],
  freshdesk: ['freshdesk', 'freshchat'],
  hubspot: ['hubspot', 'hs-scripts'],
  olark: ['olark'],
  tawk: ['tawk.to', 'embed.tawk'],
  chatra: ['chatra'],
  helpscout: ['helpscout', 'beacon-v2'],
};

// Platform signatures
const PLATFORM_SIGNATURES = {
  shopify: ['shopify', 'cdn.shopify.com', 'myshopify.com', 'Shopify.theme'],
  woocommerce: ['woocommerce', 'wc-', '/wp-content/plugins/woocommerce'],
  bigcommerce: ['bigcommerce', 'cdn.bigcommerce.com'],
  magento: ['magento', 'mage/', 'Magento_'],
};

export async function scanStore(domain: string): Promise<StoreAnalysis> {
  const url = domain.startsWith('http') ? domain : `https://${domain}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    );

    // Collect all scripts/resources
    const resources: string[] = [];
    page.on('response', (response) => {
      resources.push(response.url());
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    // Detect platform
    const platform = detectPlatformFromHtml(html, resources);

    // Detect shopping assistants
    const { hasAssistant, detectedAssistants } = detectAssistants(html, resources);

    // Extract product categories
    const productCategories = extractCategories($);

    // Extract brand info
    const brandName = extractBrandName($, url);
    const description = extractDescription($);

    // Extract social links
    const socialLinks = extractSocialLinks($);

    // Extract contact info
    const contactInfo = extractContactInfo($);

    // Extract tech stack
    const techStack = extractTechStack(html, resources);

    // Estimate products
    const estimatedProducts = await estimateProductCount(page, $);

    return {
      domain: new URL(url).hostname,
      platform,
      hasShoppingAssistant: hasAssistant,
      detectedAssistants,
      productCategories,
      estimatedProducts,
      brandName,
      description,
      socialLinks,
      contactInfo,
      techStack,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function detectPlatformFromHtml(
  html: string,
  resources: string[]
): StoreAnalysis['platform'] {
  const combined = html.toLowerCase() + resources.join(' ').toLowerCase();

  for (const [platform, signatures] of Object.entries(PLATFORM_SIGNATURES)) {
    for (const sig of signatures) {
      if (combined.includes(sig.toLowerCase())) {
        return platform as StoreAnalysis['platform'];
      }
    }
  }

  return 'unknown';
}

function detectAssistants(
  html: string,
  resources: string[]
): { hasAssistant: boolean; detectedAssistants: string[] } {
  const combined = html.toLowerCase() + resources.join(' ').toLowerCase();
  const detected: string[] = [];

  for (const [name, signatures] of Object.entries(ASSISTANT_SIGNATURES)) {
    for (const sig of signatures) {
      if (combined.includes(sig.toLowerCase())) {
        if (!detected.includes(name)) {
          detected.push(name);
        }
        break;
      }
    }
  }

  return {
    hasAssistant: detected.length > 0,
    detectedAssistants: detected,
  };
}

function extractCategories($: cheerio.CheerioAPI): string[] {
  const categories: string[] = [];

  // Try navigation menus
  $('nav a, .nav a, .menu a, .navigation a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 50 && !text.includes('http')) {
      categories.push(text);
    }
  });

  // Dedupe and limit
  return [...new Set(categories)].slice(0, 20);
}

function extractBrandName($: cheerio.CheerioAPI, url: string): string {
  // Try meta tags
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) return ogSiteName;

  // Try title
  const title = $('title').text().split(/[|\-–]/)[0].trim();
  if (title) return title;

  // Fallback to domain
  return new URL(url).hostname.replace('www.', '').split('.')[0];
}

function extractDescription($: cheerio.CheerioAPI): string {
  const ogDesc = $('meta[property="og:description"]').attr('content');
  if (ogDesc) return ogDesc;

  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc) return metaDesc;

  return '';
}

function extractSocialLinks($: cheerio.CheerioAPI): string[] {
  const socials: string[] = [];
  const socialPatterns = [
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'youtube.com',
    'tiktok.com',
    'pinterest.com',
  ];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      for (const pattern of socialPatterns) {
        if (href.includes(pattern) && !socials.includes(href)) {
          socials.push(href);
          break;
        }
      }
    }
  });

  return socials;
}

function extractContactInfo($: cheerio.CheerioAPI): StoreAnalysis['contactInfo'] {
  const contact: StoreAnalysis['contactInfo'] = {};

  // Email
  const emailMatch = $.html().match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  if (emailMatch) {
    contact.email = emailMatch[0];
  }

  // Phone
  const phoneMatch = $.html().match(
    /(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/
  );
  if (phoneMatch) {
    contact.phone = phoneMatch[0];
  }

  return contact;
}

function extractTechStack(
  html: string,
  resources: string[]
): StoreAnalysis['techStack'] {
  const combined = html.toLowerCase() + resources.join(' ').toLowerCase();

  const techStack: StoreAnalysis['techStack'] = {
    analytics: [],
    marketing: [],
    payments: [],
    other: [],
  };

  // Analytics
  const analytics = ['google-analytics', 'gtag', 'facebook pixel', 'hotjar', 'mixpanel', 'segment'];
  for (const tool of analytics) {
    if (combined.includes(tool.toLowerCase())) {
      techStack.analytics.push(tool);
    }
  }

  // Marketing
  const marketing = ['klaviyo', 'mailchimp', 'omnisend', 'yotpo', 'stamped', 'judge.me'];
  for (const tool of marketing) {
    if (combined.includes(tool.toLowerCase())) {
      techStack.marketing.push(tool);
    }
  }

  // Payments
  const payments = ['stripe', 'paypal', 'shop pay', 'afterpay', 'klarna', 'affirm'];
  for (const tool of payments) {
    if (combined.includes(tool.toLowerCase())) {
      techStack.payments.push(tool);
    }
  }

  return techStack;
}

async function estimateProductCount(
  page: puppeteer.Page,
  $: cheerio.CheerioAPI
): Promise<number> {
  // Try to find product count from collection pages or sitemap
  const productLinks = $('a[href*="/products/"], a[href*="/product/"]').length;

  if (productLinks > 0) {
    return Math.min(productLinks * 5, 1000); // Rough estimate
  }

  return 0;
}

/**
 * LIGHTWEIGHT SCANNER - Uses fetch instead of Puppeteer
 * Much faster and doesn't require a headless browser
 */
export async function scanStoreLite(domain: string): Promise<StoreAnalysis> {
  const url = domain.startsWith('http') ? domain : `https://${domain}`;
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');

  try {
    // Fetch the page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Detect platform from HTML only
    const platform = detectPlatformLite(html);

    // Detect shopping assistants
    const { hasAssistant, detectedAssistants } = detectAssistantsLite(html);

    // Extract basic info
    const brandName = extractBrandName($, url);
    const description = extractDescription($);
    const socialLinks = extractSocialLinks($);
    const contactInfo = extractContactInfo($);
    const categories = extractCategories($);
    const techStack = extractTechStackLite(html);

    // Estimate products from HTML
    const productLinks = $('a[href*="/products/"], a[href*="/product/"]').length;
    const estimatedProducts = Math.min(productLinks * 5, 1000);

    return {
      domain: cleanDomain,
      platform,
      hasShoppingAssistant: hasAssistant,
      detectedAssistants,
      productCategories: categories,
      estimatedProducts,
      brandName,
      description,
      socialLinks,
      contactInfo,
      techStack,
    };
  } catch (error) {
    // Return minimal info on error
    return {
      domain: cleanDomain,
      platform: 'unknown',
      hasShoppingAssistant: false,
      detectedAssistants: [],
      productCategories: [],
      estimatedProducts: 0,
      brandName: cleanDomain.split('.')[0],
      description: '',
      socialLinks: [],
      contactInfo: {},
      techStack: { analytics: [], marketing: [], payments: [], other: [] },
    };
  }
}

function detectPlatformLite(html: string): StoreAnalysis['platform'] {
  const lower = html.toLowerCase();

  // Shopify signatures
  if (
    lower.includes('cdn.shopify.com') ||
    lower.includes('shopify.com') ||
    lower.includes('myshopify.com') ||
    lower.includes('shopify.theme') ||
    lower.includes('/shopify_assets/') ||
    lower.includes('shopify-section') ||
    lower.includes('data-shopify')
  ) {
    return 'shopify';
  }

  // WooCommerce signatures
  if (
    lower.includes('woocommerce') ||
    lower.includes('wc-block') ||
    lower.includes('/wp-content/plugins/woocommerce')
  ) {
    return 'woocommerce';
  }

  // BigCommerce signatures
  if (lower.includes('bigcommerce') || lower.includes('cdn.bigcommerce.com')) {
    return 'bigcommerce';
  }

  // Magento signatures
  if (lower.includes('magento') || lower.includes('mage/')) {
    return 'magento';
  }

  return 'unknown';
}

function detectAssistantsLite(html: string): { hasAssistant: boolean; detectedAssistants: string[] } {
  const lower = html.toLowerCase();
  const detected: string[] = [];

  // Check each assistant
  const checks: [string, string[]][] = [
    ['tidio', ['tidio', 'tidiochat', 'tidio.co']],
    ['intercom', ['intercom', 'intercomcdn', 'intercom-frame']],
    ['drift', ['drift', 'driftt.com', 'js.driftt']],
    ['gorgias', ['gorgias', 'gorgias-chat']],
    ['zendesk', ['zendesk', 'zdassets', 'zopim', 'web_widget']],
    ['livechat', ['livechat', 'livechatinc']],
    ['crisp', ['crisp.chat', 'client.crisp']],
    ['freshdesk', ['freshdesk', 'freshchat']],
    ['hubspot', ['hubspot', 'hs-scripts', 'js.hs-scripts']],
    ['olark', ['olark']],
    ['tawk', ['tawk.to', 'embed.tawk']],
    ['chatra', ['chatra']],
    ['helpscout', ['helpscout', 'beacon-v2']],
    ['gladly', ['gladly']],
    ['kustomer', ['kustomer']],
    ['re:amaze', ['reamaze']],
    ['front', ['frontapp']],
  ];

  for (const [name, signatures] of checks) {
    for (const sig of signatures) {
      if (lower.includes(sig)) {
        if (!detected.includes(name)) {
          detected.push(name);
        }
        break;
      }
    }
  }

  return {
    hasAssistant: detected.length > 0,
    detectedAssistants: detected,
  };
}

function extractTechStackLite(html: string): StoreAnalysis['techStack'] {
  const lower = html.toLowerCase();

  const techStack: StoreAnalysis['techStack'] = {
    analytics: [],
    marketing: [],
    payments: [],
    other: [],
  };

  // Analytics
  const analyticsTools: [string, string[]][] = [
    ['Google Analytics', ['google-analytics', 'gtag(', 'ga.js', 'analytics.js']],
    ['Facebook Pixel', ['fbq(', 'facebook.com/tr', 'facebook-pixel']],
    ['Hotjar', ['hotjar']],
    ['Mixpanel', ['mixpanel']],
    ['Segment', ['segment.com', 'analytics.segment']],
    ['Heap', ['heap-']],
    ['Amplitude', ['amplitude.com']],
  ];

  for (const [name, sigs] of analyticsTools) {
    if (sigs.some(s => lower.includes(s))) {
      techStack.analytics.push(name);
    }
  }

  // Marketing
  const marketingTools: [string, string[]][] = [
    ['Klaviyo', ['klaviyo']],
    ['Mailchimp', ['mailchimp']],
    ['Omnisend', ['omnisend']],
    ['Yotpo', ['yotpo']],
    ['Stamped', ['stamped.io']],
    ['Judge.me', ['judge.me']],
    ['Loox', ['loox.io']],
    ['Okendo', ['okendo']],
    ['Attentive', ['attentive']],
    ['Postscript', ['postscript']],
    ['SMSBump', ['smsbump']],
  ];

  for (const [name, sigs] of marketingTools) {
    if (sigs.some(s => lower.includes(s))) {
      techStack.marketing.push(name);
    }
  }

  // Payments
  const paymentTools: [string, string[]][] = [
    ['Stripe', ['stripe.com', 'js.stripe']],
    ['PayPal', ['paypal']],
    ['Shop Pay', ['shop-pay', 'shopify.com/pay']],
    ['Afterpay', ['afterpay']],
    ['Klarna', ['klarna']],
    ['Affirm', ['affirm.com']],
    ['Sezzle', ['sezzle']],
    ['Quadpay', ['quadpay']],
  ];

  for (const [name, sigs] of paymentTools) {
    if (sigs.some(s => lower.includes(s))) {
      techStack.payments.push(name);
    }
  }

  return techStack;
}

/**
 * Wrapper that tries lite scanner first, falls back to full scanner
 */
export async function scanStoreAuto(domain: string): Promise<StoreAnalysis> {
  try {
    // Try lite scanner first (fast)
    const result = await scanStoreLite(domain);

    // If we got useful info, return it
    if (result.platform !== 'unknown' || result.hasShoppingAssistant) {
      return result;
    }

    // If lite didn't work well, try full scanner (if available)
    // For now, just return lite result
    return result;
  } catch (error) {
    // Fallback to lite scanner
    return scanStoreLite(domain);
  }
}
