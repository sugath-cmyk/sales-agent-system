import puppeteer from 'puppeteer';

export interface PlatformInfo {
  platform: 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'custom' | 'unknown';
  confidence: number;
  shopifyPlan?: string;
  wooVersion?: string;
  themeInfo?: {
    name: string;
    version?: string;
  };
  indicators: string[];
}

export async function detectPlatform(domain: string): Promise<PlatformInfo> {
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

    const responses: Map<string, string> = new Map();
    page.on('response', (response) => {
      responses.set(response.url(), response.headers()['content-type'] || '');
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();

    // Check Shopify
    const shopifyResult = detectShopify(html, responses);
    if (shopifyResult.isShopify) {
      return {
        platform: 'shopify',
        confidence: shopifyResult.confidence,
        shopifyPlan: shopifyResult.plan,
        themeInfo: shopifyResult.theme,
        indicators: shopifyResult.indicators,
      };
    }

    // Check WooCommerce
    const wooResult = detectWooCommerce(html, responses);
    if (wooResult.isWoo) {
      return {
        platform: 'woocommerce',
        confidence: wooResult.confidence,
        wooVersion: wooResult.version,
        indicators: wooResult.indicators,
      };
    }

    // Check BigCommerce
    const bigCommerceResult = detectBigCommerce(html, responses);
    if (bigCommerceResult.isBigCommerce) {
      return {
        platform: 'bigcommerce',
        confidence: bigCommerceResult.confidence,
        indicators: bigCommerceResult.indicators,
      };
    }

    // Check Magento
    const magentoResult = detectMagento(html, responses);
    if (magentoResult.isMagento) {
      return {
        platform: 'magento',
        confidence: magentoResult.confidence,
        indicators: magentoResult.indicators,
      };
    }

    return {
      platform: 'unknown',
      confidence: 0,
      indicators: [],
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

interface ShopifyDetection {
  isShopify: boolean;
  confidence: number;
  plan?: string;
  theme?: { name: string; version?: string };
  indicators: string[];
}

function detectShopify(html: string, responses: Map<string, string>): ShopifyDetection {
  const indicators: string[] = [];
  let confidence = 0;

  // Check for Shopify CDN
  for (const [url] of responses) {
    if (url.includes('cdn.shopify.com')) {
      indicators.push('Shopify CDN detected');
      confidence += 30;
      break;
    }
  }

  // Check HTML indicators
  if (html.includes('Shopify.theme')) {
    indicators.push('Shopify.theme object found');
    confidence += 25;
  }

  if (html.includes('myshopify.com')) {
    indicators.push('myshopify.com reference found');
    confidence += 20;
  }

  if (html.includes('/cart.js') || html.includes('/cart/add')) {
    indicators.push('Shopify cart API detected');
    confidence += 15;
  }

  // Extract theme info
  let theme: { name: string; version?: string } | undefined;
  const themeMatch = html.match(/Shopify\.theme\s*=\s*\{[^}]*name:\s*["']([^"']+)["']/);
  if (themeMatch) {
    theme = { name: themeMatch[1] };
  }

  // Detect plan (basic heuristics)
  let plan: string | undefined;
  if (html.includes('shopify_plus') || html.includes('Shopify Plus')) {
    plan = 'Plus';
  }

  return {
    isShopify: confidence >= 30,
    confidence: Math.min(confidence, 100),
    plan,
    theme,
    indicators,
  };
}

interface WooDetection {
  isWoo: boolean;
  confidence: number;
  version?: string;
  indicators: string[];
}

function detectWooCommerce(html: string, responses: Map<string, string>): WooDetection {
  const indicators: string[] = [];
  let confidence = 0;

  // Check for WooCommerce plugins
  if (html.includes('/wp-content/plugins/woocommerce')) {
    indicators.push('WooCommerce plugin directory detected');
    confidence += 40;
  }

  // Check for wc- prefixed classes
  if (html.includes('class="wc-') || html.includes('woocommerce-')) {
    indicators.push('WooCommerce CSS classes detected');
    confidence += 20;
  }

  // Check for add-to-cart
  if (html.includes('add_to_cart') || html.includes('add-to-cart')) {
    indicators.push('WooCommerce cart functionality detected');
    confidence += 15;
  }

  // WordPress indicators
  if (html.includes('/wp-content/') || html.includes('/wp-includes/')) {
    indicators.push('WordPress detected');
    confidence += 10;
  }

  // Extract version
  let version: string | undefined;
  const versionMatch = html.match(/woocommerce[^"']*ver=([0-9.]+)/);
  if (versionMatch) {
    version = versionMatch[1];
  }

  return {
    isWoo: confidence >= 40,
    confidence: Math.min(confidence, 100),
    version,
    indicators,
  };
}

interface BigCommerceDetection {
  isBigCommerce: boolean;
  confidence: number;
  indicators: string[];
}

function detectBigCommerce(
  html: string,
  responses: Map<string, string>
): BigCommerceDetection {
  const indicators: string[] = [];
  let confidence = 0;

  for (const [url] of responses) {
    if (url.includes('cdn.bigcommerce.com') || url.includes('bigcommerce.com/s-')) {
      indicators.push('BigCommerce CDN detected');
      confidence += 40;
      break;
    }
  }

  if (html.includes('BigCommerce') || html.includes('stencil-')) {
    indicators.push('BigCommerce markers found');
    confidence += 30;
  }

  return {
    isBigCommerce: confidence >= 40,
    confidence: Math.min(confidence, 100),
    indicators,
  };
}

interface MagentoDetection {
  isMagento: boolean;
  confidence: number;
  indicators: string[];
}

function detectMagento(html: string, responses: Map<string, string>): MagentoDetection {
  const indicators: string[] = [];
  let confidence = 0;

  if (html.includes('Magento') || html.includes('Mage.')) {
    indicators.push('Magento markers found');
    confidence += 40;
  }

  if (html.includes('/static/frontend/Magento') || html.includes('mage/')) {
    indicators.push('Magento static assets detected');
    confidence += 30;
  }

  for (const [url] of responses) {
    if (url.includes('/static/version') || url.includes('requirejs-config')) {
      indicators.push('Magento asset structure detected');
      confidence += 20;
      break;
    }
  }

  return {
    isMagento: confidence >= 40,
    confidence: Math.min(confidence, 100),
    indicators,
  };
}
