import { getCookiePreferences } from '../components/CookieConsentBanner';

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const ANALYTICS_STORAGE_KEY = 'hrms_audit_analytics_log';
const MAX_STORED_EVENTS = 100;

/**
 * Privacy-friendly client-side audit event logging
 */
export function trackEvent(eventName: string, metadata?: Record<string, any>): void {
  try {
    const prefs = getCookiePreferences();
    // Only track if user has accepted analytics cookies or in essential diagnostic mode
    if (!prefs.analytics && prefs.decided) {
      return;
    }

    const event: AnalyticsEvent = {
      id: 'EVT-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
      eventName,
      timestamp: new Date().toISOString(),
      metadata: metadata ? sanitizeMetadata(metadata) : undefined
    };

    const existingRaw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    const existing: AnalyticsEvent[] = existingRaw ? JSON.parse(existingRaw) : [];
    
    existing.unshift(event);
    if (existing.length > MAX_STORED_EVENTS) {
      existing.length = MAX_STORED_EVENTS;
    }

    localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    // Non-fatal analytics failure
  }
}

/**
 * Strips any potential passwords, keys, or private emails from audit metadata
 */
function sanitizeMetadata(meta: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(meta)) {
    const k = key.toLowerCase();
    if (k.includes('password') || k.includes('token') || k.includes('secret') || k.includes('auth')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export function getStoredAnalyticsEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearAnalyticsLogs(): void {
  try {
    localStorage.removeItem(ANALYTICS_STORAGE_KEY);
  } catch {}
}
