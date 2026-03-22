// Ads Strategy & Campaign Knowledge Base for Adman
// Focuses on Meta (Facebook/Instagram) and Google Ads for D2C e-commerce

import { bookingConfig } from '../../config/index.js';

// =====================
// CAMPAIGN TYPES
// =====================

export interface AdCampaign {
  id: string;
  name: string;
  platform: 'meta' | 'google' | 'linkedin';
  objective: 'awareness' | 'consideration' | 'conversion';
  budget: {
    daily: number;
    total: number;
    currency: string;
  };
  targeting: TargetingConfig;
  creatives: AdCreative[];
  schedule: CampaignSchedule;
  status: 'draft' | 'active' | 'paused' | 'completed';
}

export interface TargetingConfig {
  audiences: string[];
  interests: string[];
  behaviors: string[];
  demographics: {
    ageMin: number;
    ageMax: number;
    genders: ('male' | 'female' | 'all')[];
    locations: string[];
  };
  exclusions: string[];
  lookalike?: {
    source: string;
    percentage: number;
  };
}

export interface AdCreative {
  id: string;
  type: 'image' | 'video' | 'carousel';
  headline: string;
  primaryText: string;
  description?: string;
  callToAction: string;
  destinationUrl: string;
  mediaUrl?: string;
}

export interface CampaignSchedule {
  startDate: Date;
  endDate?: Date;
  dayParting?: {
    days: number[];
    hours: { start: number; end: number };
  };
}

// =====================
// VARYSE AI VALUE PROPS FOR ADS
// =====================

export const VARYSE_VALUE_PROPS = {
  primary: {
    headline: 'Turn Browsers into Buyers',
    subheadline: 'AI that answers every product question instantly',
    stat: '+23% Conversion Rate',
  },
  intelligence: {
    headline: 'Know What Your Customers Want',
    subheadline: 'Real-time intent analytics from every conversation',
    stat: 'Data-driven PDP improvements',
  },
  conversions: {
    headline: 'Stop Losing Sales to Unanswered Questions',
    subheadline: '60-70% of visitors leave without buying',
    stat: '-45% Support Tickets',
  },
  pricing: {
    headline: 'Start Free. Scale Fast.',
    subheadline: 'From $0 to Enterprise, pay as you grow',
    stat: '100 free conversations',
  },
  aov: {
    headline: 'Boost Average Order Value',
    subheadline: 'AI-powered cross-sell and upsell recommendations',
    stat: '+22% AOV',
  },
};

// =====================
// AUDIENCE SEGMENTS
// =====================

export const AUDIENCE_SEGMENTS = {
  shopify_store_owners: {
    name: 'Shopify Store Owners',
    platform: 'meta',
    interests: [
      'Shopify',
      'E-commerce',
      'Dropshipping',
      'Online retail',
      'Oberlo',
    ],
    behaviors: ['Small business owners', 'Technology early adopters'],
    demographics: { ageMin: 25, ageMax: 55 },
    description: 'D2C founders and store owners on Shopify',
  },
  ecommerce_marketers: {
    name: 'E-commerce Marketers',
    platform: 'meta',
    interests: [
      'E-commerce marketing',
      'Facebook Ads',
      'Google Ads',
      'Conversion optimization',
      'Klaviyo',
    ],
    behaviors: ['Digital marketing professionals'],
    demographics: { ageMin: 24, ageMax: 45 },
    description: 'Marketing managers and growth leads at D2C brands',
  },
  skincare_brand_owners: {
    name: 'Skincare & Beauty Brand Owners',
    platform: 'meta',
    interests: [
      'Skincare business',
      'Beauty industry',
      'Cosmetics manufacturing',
      'Private label cosmetics',
    ],
    behaviors: ['Small business owners'],
    demographics: { ageMin: 25, ageMax: 50 },
    description: 'Founders and owners of skincare/beauty D2C brands',
  },
  supplement_brand_owners: {
    name: 'Health & Wellness Brand Owners',
    platform: 'meta',
    interests: [
      'Supplement business',
      'Health and wellness industry',
      'Nutraceuticals',
      'Vitamins and supplements',
    ],
    behaviors: ['Small business owners', 'Health-conscious consumers'],
    demographics: { ageMin: 28, ageMax: 55 },
    description: 'Founders of supplement and wellness D2C brands',
  },
  fashion_brand_owners: {
    name: 'Fashion & Apparel Brand Owners',
    platform: 'meta',
    interests: [
      'Fashion business',
      'Clothing brand',
      'Apparel manufacturing',
      'Fashion entrepreneurship',
    ],
    behaviors: ['Small business owners'],
    demographics: { ageMin: 22, ageMax: 45 },
    description: 'Founders of fashion and apparel D2C brands',
  },
};

// =====================
// AD TEMPLATES BY OBJECTIVE
// =====================

export const AD_TEMPLATES = {
  // Awareness campaigns - introduce Varyse AI
  awareness: [
    {
      headline: 'Your Product Page Is Losing Sales',
      primaryText: `Every question your visitors can't get answered = a lost sale.

60-70% of shoppers leave without buying because they can't find answers about sizing, ingredients, or compatibility.

Varyse AI changes that. ⚡

Our AI answers every product question instantly — 24/7, on every page.

See it in action 👇`,
      callToAction: 'Learn More',
      destinationUrl: bookingConfig.calendlyUrl,
    },
    {
      headline: 'Stop Describing. Start Converting.',
      primaryText: `Your product page talks.
Your customer thinks.
Nothing connects the two.

Until now.

Varyse AI turns every product page into a two-way conversation — so shoppers get answers, build confidence, and buy.

+23% conversion rate for D2C brands 📈`,
      callToAction: 'Book Demo',
      destinationUrl: bookingConfig.calendlyUrl,
    },
  ],

  // Consideration campaigns - show value & social proof
  consideration: [
    {
      headline: '+23% Conversion Rate. Real Results.',
      primaryText: `Here's what happened when D2C brands added Varyse AI:

✅ Conversion rate: +23%
✅ Average order value: +22%
✅ Support tickets: -45%

No more "just browsing" — our AI turns questions into purchases.

Free demo with your actual products 👇`,
      callToAction: 'Book Free Demo',
      destinationUrl: bookingConfig.calendlyUrl,
    },
    {
      headline: 'What Your Customers Are Really Asking',
      primaryText: `Your product page says: "Hydrating. Non-comedogenic."

Your customer thinks: "Will this break me out in humidity?"

That gap = lost sales.

Varyse AI answers every question instantly:
• Ingredient compatibility
• Skin type matching
• Routine recommendations
• Size & fit guidance

Start free. Scale when you're ready.`,
      callToAction: 'Start Free',
      destinationUrl: bookingConfig.calendlyUrl,
    },
  ],

  // Conversion campaigns - direct CTA to book demo
  conversion: [
    {
      headline: 'See Varyse on YOUR Products — Free',
      primaryText: `30-minute personalized demo:

✅ See the AI answer questions about YOUR products
✅ Get a custom conversion estimate
✅ No commitment required

D2C brands using Varyse AI see 23% higher conversions.

Book your free demo now 👇`,
      callToAction: 'Book Demo',
      destinationUrl: bookingConfig.calendlyUrl,
    },
    {
      headline: '100 Free Conversations. Start Today.',
      primaryText: `Install in 5 minutes.
No credit card required.
100 free conversations to try it.

Your visitors have questions. Varyse AI has answers.

Stop losing sales. Start converting. ⚡`,
      callToAction: 'Get Started Free',
      destinationUrl: bookingConfig.calendlyUrl,
    },
  ],

  // Retargeting campaigns
  retargeting: [
    {
      headline: 'Still Losing Sales to Unanswered Questions?',
      primaryText: `You visited our site but didn't book a demo.

Here's what you're missing:

• AI that converts browsers into buyers
• Real-time customer intelligence
• 23% average conversion lift

Let's talk for 30 minutes. No pressure.`,
      callToAction: 'Book Demo',
      destinationUrl: bookingConfig.calendlyUrl,
    },
  ],
};

// =====================
// GOOGLE ADS KEYWORDS
// =====================

export const GOOGLE_AD_KEYWORDS = {
  high_intent: [
    'shopify chatbot',
    'shopify ai assistant',
    'ecommerce chatbot',
    'product recommendation ai',
    'shopify conversion optimization',
    'increase shopify conversion rate',
    'shopify sales bot',
    'ai shopping assistant',
    'ecommerce ai assistant',
  ],
  medium_intent: [
    'shopify abandoned cart',
    'reduce cart abandonment shopify',
    'shopify customer support',
    'shopify product questions',
    'shopify product page optimization',
    'how to increase shopify sales',
    'd2c conversion optimization',
  ],
  competitor: [
    'tidio alternative',
    'gorgias alternative',
    'intercom shopify',
    'drift ecommerce',
    'zendesk chat alternative',
    'livechat shopify alternative',
  ],
  negative: [
    'free',
    'cheap',
    'tutorial',
    'how to build',
    'developer',
    'code',
    'open source',
  ],
};

// =====================
// BUDGET RECOMMENDATIONS
// =====================

export const BUDGET_RECOMMENDATIONS = {
  testing: {
    daily: 50,
    duration: 14,
    description: 'Initial testing phase - 3-5 ad sets, identify winners',
  },
  scaling: {
    daily: 150,
    duration: 30,
    description: 'Scale winning audiences and creatives',
  },
  aggressive: {
    daily: 500,
    duration: 30,
    description: 'Full-scale campaign with multiple audiences',
  },
};

// =====================
// A/B TEST FRAMEWORK
// =====================

export const AB_TEST_ELEMENTS = {
  headlines: [
    'Turn Browsers into Buyers',
    'Stop Losing Sales to Silence',
    '+23% Conversion Rate Guaranteed',
    'Your Product Page Needs an AI',
    'Answer Every Question. Instantly.',
  ],
  ctas: [
    'Book Free Demo',
    'See It In Action',
    'Start Free',
    'Get Started',
    'Learn More',
  ],
  hooks: [
    '60% of visitors leave without buying...',
    'Your product page is losing sales...',
    'What if every visitor got instant answers?',
    'D2C brands are seeing 23% more conversions...',
    'Stop describing. Start converting.',
  ],
};

// =====================
// CAMPAIGN METRICS
// =====================

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionRate: number;
  costPerConversion: number;
  spend: number;
  roas: number;
}

export const BENCHMARK_METRICS = {
  meta: {
    ctr: 1.5, // %
    cpc: 2.5, // $
    conversionRate: 3.0, // %
    costPerLead: 50, // $
  },
  google: {
    ctr: 3.5, // %
    cpc: 4.0, // $
    conversionRate: 4.5, // %
    costPerLead: 65, // $
  },
};

// =====================
// CAMPAIGN TYPES
// =====================

export const CAMPAIGN_TYPES = {
  cold_prospecting: {
    name: 'Cold Prospecting',
    platforms: ['meta', 'google'],
    objective: 'conversion',
    audienceType: 'interests',
    budgetAllocation: 0.5, // 50% of budget
    description: 'Reach new audiences who match ICP but havent heard of us',
  },
  retargeting: {
    name: 'Website Retargeting',
    platforms: ['meta', 'google'],
    objective: 'conversion',
    audienceType: 'custom',
    budgetAllocation: 0.3, // 30% of budget
    description: 'Re-engage website visitors who didnt convert',
  },
  lookalike: {
    name: 'Lookalike Expansion',
    platforms: ['meta'],
    objective: 'conversion',
    audienceType: 'lookalike',
    budgetAllocation: 0.2, // 20% of budget
    description: 'Find new users similar to existing converters',
  },
};

// =====================
// HELPER FUNCTIONS
// =====================

export function selectAudienceForVertical(vertical: string): string[] {
  const verticalMap: Record<string, string[]> = {
    skincare: ['skincare_brand_owners', 'ecommerce_marketers'],
    beauty: ['skincare_brand_owners', 'ecommerce_marketers'],
    supplements: ['supplement_brand_owners', 'ecommerce_marketers'],
    health: ['supplement_brand_owners', 'ecommerce_marketers'],
    fashion: ['fashion_brand_owners', 'ecommerce_marketers'],
    apparel: ['fashion_brand_owners', 'ecommerce_marketers'],
    default: ['shopify_store_owners', 'ecommerce_marketers'],
  };

  return verticalMap[vertical.toLowerCase()] || verticalMap.default;
}

export function generateCampaignName(
  platform: string,
  objective: string,
  audience: string,
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().split('T')[0];
  return `${platform.toUpperCase()}_${objective}_${audience}_${dateStr}`;
}

export function calculateRecommendedBudget(
  targetLeads: number,
  platform: 'meta' | 'google'
): { daily: number; total: number; duration: number } {
  const costPerLead = BENCHMARK_METRICS[platform].costPerLead;
  const totalBudget = targetLeads * costPerLead;
  const duration = Math.max(14, Math.ceil(totalBudget / 100)); // At least $100/day or 14 days

  return {
    daily: Math.ceil(totalBudget / duration),
    total: totalBudget,
    duration,
  };
}
