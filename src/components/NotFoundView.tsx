import React from 'react';
import { Compass, ArrowLeft, Home, Users, CalendarCheck, ShieldAlert } from 'lucide-react';

interface NotFoundViewProps {
  onNavigateHome: () => void;
  onNavigateTab?: (tab: string) => void;
}

export function NotFoundView({ onNavigateHome, onNavigateTab }: NotFoundViewProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-6">
        
        {/* Graphic Badge */}
        <div className="mx-auto w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-xs">
          <Compass className="w-8 h-8 animate-spin-slow" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
            Error 404 • Resource Not Found
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Workforce Page Not Located
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            The department route, employee record, or dashboard view you are attempting to access does not exist or may have been relocated.
          </p>
        </div>

        {/* Primary Clear CTA */}
        <div className="pt-2">
          <button
            onClick={onNavigateHome}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all duration-150 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Home className="w-4 h-4 mr-1.5" />
            <span>Return to Primary Dashboard</span>
          </button>
        </div>

        {/* Secondary Quick Links */}
        {onNavigateTab && (
          <div className="pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Or Jump Directly To
            </span>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => onNavigateTab('staff-directory')}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>Directory</span>
              </button>
              <button
                onClick={() => onNavigateTab('attendance-logs')}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <CalendarCheck className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>Logs</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
