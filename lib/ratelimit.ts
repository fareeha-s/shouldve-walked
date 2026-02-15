// Simple in-memory rate limiting
// For production, use Redis or a proper rate limiting service

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const GLOBAL_LIMIT = 1500; // Max requests before stopping (keeps you under $20)
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

let globalCount = 0;
let globalResetTime = Date.now() + WINDOW_MS;

export function checkRateLimit(identifier: string = 'global'): {
  allowed: boolean;
  remaining: number;
  error?: string;
} {
  const now = Date.now();

  // Reset global counter if window expired
  if (now > globalResetTime) {
    globalCount = 0;
    globalResetTime = now + WINDOW_MS;
  }

  // Check global limit first
  if (globalCount >= GLOBAL_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      error: 'daily limit reached. this app got too popular. check back tomorrow.',
    };
  }

  // Per-IP rate limit (10 requests per hour)
  const record = store[identifier];
  const ipLimit = 10;
  const ipWindowMs = 60 * 60 * 1000; // 1 hour

  if (!record || now > record.resetTime) {
    store[identifier] = {
      count: 1,
      resetTime: now + ipWindowMs,
    };
    globalCount++;
    return { allowed: true, remaining: GLOBAL_LIMIT - globalCount };
  }

  if (record.count >= ipLimit) {
    return {
      allowed: false,
      remaining: GLOBAL_LIMIT - globalCount,
      error: "you've analyzed enough routes for now. take a walk.",
    };
  }

  record.count++;
  globalCount++;

  return { allowed: true, remaining: GLOBAL_LIMIT - globalCount };
}

export function getRemainingGlobalLimit(): number {
  const now = Date.now();
  if (now > globalResetTime) {
    globalCount = 0;
    globalResetTime = now + WINDOW_MS;
  }
  return Math.max(0, GLOBAL_LIMIT - globalCount);
}
