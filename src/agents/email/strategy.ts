// Email Strategy & Knowledge Base for Mailman
// Contains all email best practices, sequences, and personalization rules

import { bookingConfig } from '../../config/index.js';

// =====================
// EMAIL SEQUENCE TYPES
// =====================

export interface EmailSequenceStep {
  stepNumber: number;
  type: 'cold' | 'follow_up' | 'value' | 'social_proof' | 'breakup' | 're_engage';
  dayOffset: number;
  subject: string;
  bodyTemplate: string;
  sendTime: {
    preferredHour: number; // 24hr format
    timezone: string;
    avoidDays: number[]; // 0=Sunday, 6=Saturday
  };
  personalizationLevel: 'high' | 'medium' | 'low';
  includeImage: boolean;
  imageType?: 'product_mockup' | 'case_study' | 'comparison' | 'stats';
}

export const EMAIL_SEQUENCES = {
  // Standard 5-touch cold outreach
  standard_cold: {
    name: 'Standard Cold Outreach',
    description: '5-touch sequence for qualified Shopify merchants',
    steps: [
      {
        stepNumber: 1,
        type: 'cold',
        dayOffset: 0,
        subject: '{companyName}\'s checkout drop-off',
        bodyTemplate: 'cold_opener',
        sendTime: { preferredHour: 9, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'high',
        includeImage: false,
      },
      {
        stepNumber: 2,
        type: 'social_proof',
        dayOffset: 3,
        subject: 'Re: {companyName}\'s checkout drop-off',
        bodyTemplate: 'social_proof',
        sendTime: { preferredHour: 10, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'medium',
        includeImage: true,
        imageType: 'stats',
      },
      {
        stepNumber: 3,
        type: 'value',
        dayOffset: 6,
        subject: 'The "just browsing" problem',
        bodyTemplate: 'pain_point',
        sendTime: { preferredHour: 14, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'medium',
        includeImage: false,
      },
      {
        stepNumber: 4,
        type: 'follow_up',
        dayOffset: 10,
        subject: 'Should I close your file?',
        bodyTemplate: 'breakup_warning',
        sendTime: { preferredHour: 11, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'low',
        includeImage: false,
      },
      {
        stepNumber: 5,
        type: 'breakup',
        dayOffset: 14,
        subject: 'Closing the loop',
        bodyTemplate: 'breakup',
        sendTime: { preferredHour: 9, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'low',
        includeImage: false,
      },
    ],
  },

  // High-intent sequence (for hot leads 80+)
  high_intent: {
    name: 'High Intent Outreach',
    description: 'Shorter, more direct sequence for hot leads',
    steps: [
      {
        stepNumber: 1,
        type: 'cold',
        dayOffset: 0,
        subject: 'Quick question about {companyName}',
        bodyTemplate: 'direct_opener',
        sendTime: { preferredHour: 8, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'high',
        includeImage: true,
        imageType: 'product_mockup',
      },
      {
        stepNumber: 2,
        type: 'value',
        dayOffset: 2,
        subject: 'Re: Quick question about {companyName}',
        bodyTemplate: 'value_demo',
        sendTime: { preferredHour: 10, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'high',
        includeImage: true,
        imageType: 'comparison',
      },
      {
        stepNumber: 3,
        type: 'breakup',
        dayOffset: 5,
        subject: 'Last try',
        bodyTemplate: 'soft_breakup',
        sendTime: { preferredHour: 15, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'medium',
        includeImage: false,
      },
    ],
  },

  // Re-engagement sequence (for cold leads coming back)
  re_engage: {
    name: 'Re-engagement',
    description: 'For leads who went cold',
    steps: [
      {
        stepNumber: 1,
        type: 're_engage',
        dayOffset: 0,
        subject: 'Noticed something about {companyName}',
        bodyTemplate: 're_engage_trigger',
        sendTime: { preferredHour: 10, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'high',
        includeImage: false,
      },
      {
        stepNumber: 2,
        type: 'value',
        dayOffset: 4,
        subject: 'Case study for {industry} brands',
        bodyTemplate: 'case_study',
        sendTime: { preferredHour: 11, timezone: 'recipient', avoidDays: [0, 6] },
        personalizationLevel: 'medium',
        includeImage: true,
        imageType: 'case_study',
      },
    ],
  },
};

// =====================
// EMAIL TEMPLATES
// =====================

export function getEmailTemplate(
  templateId: string,
  variables: Record<string, string>
): { subject: string; body: string } {
  const calendarLink = bookingConfig.calendlyUrl;
  const { firstName, companyName, industry, productCategory, domain } = variables;

  const templates: Record<string, { subject: string; body: string }> = {
    // Cold opener - high personalization
    cold_opener: {
      subject: `${companyName}'s checkout drop-off`,
      body: `Hi ${firstName},

Noticed ${companyName} doesn't have a shopping assistant yet — which usually means 60-70% of visitors leave without buying.

I checked out your ${productCategory || 'products'} and think there's a real opportunity here.

We built an AI that answers product questions instantly, reducing drop-off by 30%+ for ${industry || 'D2C'} brands.

Worth a quick chat?

${calendarLink}

Best,
Sugath

P.S. Took a look at ${domain} — your customers would love instant answers about sizing, materials, and shipping.`,
    },

    // Direct opener for hot leads
    direct_opener: {
      subject: `Quick question about ${companyName}`,
      body: `${firstName},

I'll keep this short.

${companyName} is growing fast, but without a shopping assistant, you're losing ~60% of visitors who have questions.

We fix that with AI. 30%+ conversion lift for similar Shopify brands.

Got 30 min this week?

${calendarLink}

Sugath`,
    },

    // Social proof with stats
    social_proof: {
      subject: `Re: ${companyName}'s checkout drop-off`,
      body: `${firstName},

Quick follow-up — here's what happened when a similar ${industry || 'e-commerce'} brand added our AI assistant:

• Conversion rate: 2.1% → 3.4% (+62%)
• Avg order value: +22%
• Support tickets: -45%
• 24/7 instant responses

Would love to show you how this could look on ${companyName}'s store.

30 min this week? ${calendarLink}

Sugath`,
    },

    // Pain point focus
    pain_point: {
      subject: `The "just browsing" problem`,
      body: `${firstName},

Your visitors are researching, comparing, wondering "will this work for me?"

Without instant answers:
→ They bounce to a competitor who does answer
→ Your support team gets flooded with basic questions
→ Cart abandonment stays high

Our AI handles these conversations 24/7, turning browsers into buyers.

Quick demo? ${calendarLink}

Sugath`,
    },

    // Value demo
    value_demo: {
      subject: `Re: Quick question about ${companyName}`,
      body: `${firstName},

Imagine this on ${domain}:

Customer: "Is this good for sensitive skin?"
AI (instant): "Yes! This product is dermatologist-tested and hypoallergenic. Our customers with sensitive skin love it. Would you like me to show you our best-sellers for sensitive skin?"

That's what we do. 24/7, on every product page.

Quick demo: ${calendarLink}

Sugath`,
    },

    // Breakup warning
    breakup_warning: {
      subject: `Should I close your file?`,
      body: `${firstName},

Haven't heard back — totally get it, inboxes are brutal.

If conversion optimization isn't a priority right now, no worries. I'll close out your file.

But if you're losing sales to "I'll think about it" visitors, let's chat for 30 min.

Last chance: ${calendarLink}

Sugath`,
    },

    // Soft breakup
    soft_breakup: {
      subject: `Last try`,
      body: `${firstName},

I'll stop reaching out after this.

If you ever want to explore how AI can boost ${companyName}'s conversions, here's my calendar: ${calendarLink}

Good luck with everything!

Sugath`,
    },

    // Final breakup
    breakup: {
      subject: `Closing the loop`,
      body: `${firstName},

Closing your file for now.

If boosting ${companyName}'s conversion rate becomes a priority, here's my calendar: ${calendarLink}

Wishing you continued success!

Sugath`,
    },

    // Re-engagement trigger
    re_engage_trigger: {
      subject: `Noticed something about ${companyName}`,
      body: `${firstName},

Been a while! Noticed ${companyName} is still crushing it in ${industry || 'your space'}.

Quick thought: you're probably leaving 30-40% more conversions on the table without a shopping assistant.

We've helped 50+ Shopify brands fix this. Want to see how?

${calendarLink}

Sugath`,
    },

    // Case study email
    case_study: {
      subject: `Case study for ${industry || 'D2C'} brands`,
      body: `${firstName},

Just published a case study that might interest you.

A ${industry || 'Shopify'} brand similar to ${companyName} was struggling with:
• High bounce rate on product pages
• Support tickets piling up
• Cart abandonment at 78%

After adding our AI shopping assistant:
• Conversion rate jumped 62%
• Support tickets dropped 45%
• AOV increased 22%

Want me to walk you through it?

${calendarLink}

Sugath`,
    },
  };

  return templates[templateId] || templates.cold_opener;
}

// =====================
// TIMING RULES
// =====================

export const SEND_TIME_RULES = {
  // Best times by day
  bestTimes: {
    monday: [9, 10, 14], // 9am, 10am, 2pm
    tuesday: [8, 10, 14, 16],
    wednesday: [9, 10, 14],
    thursday: [8, 10, 15],
    friday: [9, 10], // Avoid afternoon
  },

  // Avoid these times
  avoidTimes: {
    beforeHour: 8, // Too early
    afterHour: 17, // Too late
    lunchHour: [12, 13], // Lunch
  },

  // Geographic considerations
  timezoneRules: {
    US: { startHour: 9, endHour: 17, timezone: 'America/New_York' },
    UK: { startHour: 9, endHour: 17, timezone: 'Europe/London' },
    AU: { startHour: 9, endHour: 17, timezone: 'Australia/Sydney' },
    IN: { startHour: 10, endHour: 18, timezone: 'Asia/Kolkata' },
  },
};

// =====================
// PERSONALIZATION RULES
// =====================

export const PERSONALIZATION_RULES = {
  // High personalization (step 1)
  high: {
    requiredVariables: ['firstName', 'companyName', 'domain', 'productCategory'],
    optionalVariables: ['industry', 'recentActivity', 'techStack'],
    customOpener: true,
    mentionSpecificProduct: true,
  },

  // Medium personalization (steps 2-3)
  medium: {
    requiredVariables: ['firstName', 'companyName'],
    optionalVariables: ['industry'],
    customOpener: false,
    mentionSpecificProduct: false,
  },

  // Low personalization (breakup emails)
  low: {
    requiredVariables: ['firstName', 'companyName'],
    optionalVariables: [],
    customOpener: false,
    mentionSpecificProduct: false,
  },
};

// =====================
// IMAGE GENERATION RULES
// =====================

export interface ImageRequest {
  type: 'product_mockup' | 'case_study' | 'comparison' | 'stats';
  companyName: string;
  domain: string;
  data?: Record<string, any>;
}

export const IMAGE_TEMPLATES = {
  product_mockup: {
    description: 'Shows their store with our chat widget overlaid',
    dimensions: { width: 600, height: 400 },
    elements: ['store_screenshot', 'chat_widget_overlay', 'brand_colors'],
  },

  case_study: {
    description: 'Before/after comparison with metrics',
    dimensions: { width: 600, height: 300 },
    elements: ['before_after_split', 'metric_badges', 'arrow_improvement'],
  },

  comparison: {
    description: 'Side-by-side comparison of with/without assistant',
    dimensions: { width: 600, height: 400 },
    elements: ['split_view', 'customer_journey', 'conversion_rate'],
  },

  stats: {
    description: 'Key statistics in visual format',
    dimensions: { width: 600, height: 200 },
    elements: ['metric_cards', 'percentage_increases', 'brand_styling'],
  },
};

// =====================
// A/B TESTING
// =====================

export const AB_TEST_VARIANTS = {
  subject_lines: {
    cold_opener: [
      '{companyName}\'s checkout drop-off',
      'Quick question about {companyName}',
      '{firstName}, noticed something on {domain}',
      'Idea for {companyName}',
    ],
  },
  cta_styles: {
    direct: 'Book a time here: {calendarLink}',
    soft: 'Worth a quick chat? {calendarLink}',
    question: 'Got 30 min this week? {calendarLink}',
    casual: 'Here\'s my calendar if easier: {calendarLink}',
  },
};

// =====================
// REPLY HANDLING
// =====================

export const REPLY_HANDLERS = {
  interested: {
    keywords: ['interested', 'tell me more', 'sounds good', 'yes', 'sure'],
    action: 'send_calendar',
    response: `Great to hear from you!

Here's my calendar to find a time that works: ${bookingConfig.calendlyUrl}

Looking forward to showing you what we can do for {companyName}.

Sugath`,
  },

  objection_price: {
    keywords: ['expensive', 'cost', 'price', 'budget', 'afford'],
    action: 'handle_objection',
    response: `Totally understand budget concerns.

Quick context: most of our clients see ROI within the first month. A 30% conversion lift on your current traffic usually pays for itself many times over.

Happy to run the numbers specific to {companyName}'s traffic if helpful.

${bookingConfig.calendlyUrl}`,
  },

  objection_timing: {
    keywords: ['not now', 'later', 'busy', 'next quarter', 'maybe'],
    action: 'nurture',
    response: `No problem at all — timing is everything.

I'll check back in a few weeks. In the meantime, here's a quick case study that might be useful: [link]

Whenever you're ready: ${bookingConfig.calendlyUrl}`,
  },

  meeting_request: {
    keywords: ['calendar', 'schedule', 'meet', 'call', 'demo', 'available'],
    action: 'send_calendar',
    response: `Perfect! Here's my calendar:

${bookingConfig.calendlyUrl}

Pick any time that works for you — looking forward to it!

Sugath`,
  },

  not_interested: {
    keywords: ['not interested', 'no thanks', 'stop', 'unsubscribe', 'remove'],
    action: 'stop_sequence',
    response: `Understood, thanks for letting me know.

I'll stop reaching out. If things change, feel free to reach out anytime.

Best of luck with {companyName}!

Sugath`,
  },
};
