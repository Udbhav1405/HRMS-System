/**
 * Client-side spam protection, debounce, and rate limiting helpers
 */

interface RateLimitRecord {
  timestamps: number[];
  lockedUntil?: number;
}

const actionMap = new Map<string, RateLimitRecord>();

/**
 * Checks whether an action is permitted within a rolling rate limit window.
 * Returns { allowed: true } or { allowed: false, message: string }
 */
export function checkRateLimit(
  actionKey: string,
  maxAttempts: number = 5,
  windowMs: number = 30000,
  lockoutMs: number = 60000
): { allowed: boolean; message?: string } {
  const now = Date.now();
  let record = actionMap.get(actionKey);

  if (!record) {
    record = { timestamps: [now] };
    actionMap.set(actionKey, record);
    return { allowed: true };
  }

  // Check if temporarily locked out
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `Too many rapid attempts. Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before trying again.`
    };
  }

  // Clean old timestamps outside the window
  record.timestamps = record.timestamps.filter(t => now - t < windowMs);

  if (record.timestamps.length >= maxAttempts) {
    record.lockedUntil = now + lockoutMs;
    const remainingSeconds = Math.ceil(lockoutMs / 1000);
    return {
      allowed: false,
      message: `Spam protection triggered: Rate limit exceeded. Locked for ${remainingSeconds} seconds.`
    };
  }

  record.timestamps.push(now);
  return { allowed: true };
}

/**
 * Detects if a hidden honeypot form field was filled by an automated bot.
 */
export function isHoneypotTriggered(val: string | undefined): boolean {
  if (val && val.trim().length > 0) {
    console.warn('[Spam Protection] Honeypot trap triggered. Rejecting automated submission.');
    return true;
  }
  return false;
}

/**
 * Debounce utility to prevent accidental double-submits
 */
export function createDebouncedHandler<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number = 400
): (...args: Parameters<T>) => void {
  let timer: any = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delayMs);
  };
}
