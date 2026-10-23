import React, { useState, useEffect } from 'react';
import { Cookie, Shield, Check, Settings, X } from 'lucide-react';

export interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  decided: boolean;
  timestamp?: string;
}

const COOKIE_STORAGE_KEY = 'hrms_cookie_consent';

export function getCookiePreferences(): CookiePreferences {
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { necessary: true, functional: true, analytics: false, decided: false };
}

interface CookieConsentBannerProps {
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function CookieConsentBanner({ onOpenPrivacy, onOpenTerms }: CookieConsentBannerProps) {
  const [preferences, setPreferences] = useState<CookiePreferences>(getCookiePreferences);
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    const prefs = getCookiePreferences();
    if (!prefs.decided) {
      setIsOpen(true);
    }
  }, []);

  const savePreferences = (newPrefs: CookiePreferences) => {
    const updated = { ...newPrefs, decided: true, timestamp: new Date().toISOString() };
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setPreferences(updated);
    setIsOpen(false);
    setIsCustomizing(false);
  };

  const handleAcceptAll = () => {
    savePreferences({
      necessary: true,
      functional: true,
      analytics: true,
      decided: true
    });
  };

  const handleEssentialOnly = () => {
    savePreferences({
      necessary: true,
      functional: false,
      analytics: false,
      decided: true
    });
  };

  const handleSaveCustom = () => {
    savePreferences(preferences);
  };

  if (!isOpen) return null;

  return (
    <aside 
      aria-label="Cookie and Privacy Consent" 
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-50 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl p-5 shadow-2xl animate-slide-up"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Cookie className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white tracking-tight">Cookie &amp; Local Storage Consent</h3>
              <p className="text-[11px] text-slate-400">HRMS System Enterprise Security &amp; Session Continuity</p>
            </div>
          </div>
          <button
            onClick={handleEssentialOnly}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close and accept essential only"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Text */}
        <p className="text-xs text-slate-300 leading-relaxed">
          We use strictly essential local storage and security tokens to maintain your verified session state, punch-in logs, and multi-role privileges. We never deploy commercial tracking or marketing ad-trackers.
        </p>

        {/* Customization Details Accordion */}
        {isCustomizing && (
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2.5 text-xs text-slate-300">
            <label className="flex items-center justify-between cursor-not-allowed opacity-90">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">Strictly Necessary Cookies</span>
                <span className="text-[11px] text-slate-400 block">Session authentication tokens, CSRF protection, and role state.</span>
              </div>
              <input type="checkbox" checked disabled className="rounded text-indigo-600 focus:ring-0 w-4 h-4" />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-700/60">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">Functional Preferences</span>
                <span className="text-[11px] text-slate-400 block">Saves active UI filter tabs, table sorting, and office timing offsets.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.functional}
                onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-700/60">
              <div className="space-y-0.5">
                <span className="font-bold text-white block">System Analytics &amp; Audit Logs</span>
                <span className="text-[11px] text-slate-400 block">Anonymized performance metrics for system speed and error diagnosis.</span>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        )}

        {/* Links */}
        <div className="flex items-center space-x-3 text-[11px] text-indigo-300">
          <button 
            type="button"
            onClick={onOpenPrivacy} 
            className="hover:underline font-semibold cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button 
            type="button"
            onClick={onOpenTerms} 
            className="hover:underline font-semibold cursor-pointer"
          >
            Terms &amp; Conditions
          </button>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 mr-1" />
            <span>{isCustomizing ? 'Hide Options' : 'Preferences'}</span>
          </button>

          {isCustomizing ? (
            <button
              onClick={handleSaveCustom}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Save Preferences
            </button>
          ) : (
            <>
              <button
                onClick={handleEssentialOnly}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Essential Only
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                <span>Accept All</span>
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
