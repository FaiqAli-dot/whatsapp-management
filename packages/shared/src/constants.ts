export const API_VERSION = 'v1';

export const BUSINESS_CATEGORIES = ['salon', 'clinic', 'restaurant', 'auto_shop', 'other'] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyRequestLimit: 25,
    customerLimit: 100,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyRequestLimit: 250,
    customerLimit: 1000,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyRequestLimit: 2000,
    customerLimit: 10000,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const OPT_OUT_KEYWORDS = [
  'stop',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'optout',
  'opt-out',
  'parar',
  'arrêt',
  'arret',
] as const;

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
export const LANDING_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DUPLICATE_REQUEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
