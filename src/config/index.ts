import 'dotenv/config';
import { z } from 'zod';

const isDev = process.env.NODE_ENV !== 'production';

const envSchema = z.object({
  // Anthropic
  ANTHROPIC_API_KEY: isDev ? z.string().default('sk-ant-dev-placeholder') : z.string().min(1),

  // Database
  DATABASE_URL: isDev ? z.string().default('postgresql://localhost:5432/sales_agent') : z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Email
  RESEND_API_KEY: isDev ? z.string().default('re_dev_placeholder') : z.string().min(1),
  FROM_EMAIL: isDev ? z.string().default('dev@example.com') : z.string().email(),
  FROM_NAME: z.string().default('Sales Team'),

  // Lead Enrichment (optional)
  APOLLO_API_KEY: z.string().optional(),
  CLEARBIT_API_KEY: z.string().optional(),
  BUILTWITH_API_KEY: z.string().optional(),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// ICP Configuration - Focused on Shopify Merchants
export const icpConfig = {
  weights: {
    noAssistant: 30,
    trafficRange: 25,
    platformMatch: 25, // Increased weight for Shopify
    regionMatch: 10,
    growthSignals: 10,
  },
  thresholds: {
    HOT: 70,
    WARM: 50,
    COLD: 30,
  },
  targetRegions: ['US', 'UK', 'AU', 'IN'],
  targetPlatforms: ['shopify'] as const, // Shopify only
  disqualifyingAssistants: [
    'tidio',
    'gorgias',
    'drift',
    'intercom',
    'zendesk',
    'livechat',
    'crisp',
    'freshdesk',
    'hubspot',
    're:amaze',
    'reamaze',
  ],
  trafficRange: {
    min: 10000,
    max: 500000,
  },
  // Shopify-specific signals
  shopifySignals: {
    preferredPlans: ['Basic', 'Shopify', 'Advanced', 'Plus'],
    preferredApps: ['klaviyo', 'yotpo', 'stamped', 'judge.me', 'loox'],
  },
};

// Calendar/Booking Configuration
export const bookingConfig = {
  calendlyUrl: 'https://calendly.com/sugath-flash/30min',
  meetingDuration: 30,
  meetingName: 'Flash AI Discovery Call',
};

// Email Sequence Configuration
export const emailSequenceConfig = {
  defaultSequence: [
    { dayOffset: 0, templateId: 'hook' },
    { dayOffset: 3, templateId: 'social_proof' },
    { dayOffset: 6, templateId: 'pain_point' },
    { dayOffset: 10, templateId: 'breakup_warning' },
    { dayOffset: 14, templateId: 'breakup' },
  ],
  sendWindow: {
    startHour: 9,
    endHour: 17,
    timezone: 'America/New_York',
  },
  calendarLink: 'https://calendly.com/sugath-flash/30min',
};
