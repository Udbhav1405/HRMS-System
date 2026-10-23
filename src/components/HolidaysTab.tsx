import React, { useState } from 'react';
import { Holiday, Employee } from '../types';
import { Calendar, Plus, Trash2, Info, Gift, ShieldAlert } from 'lucide-react';

interface HolidaysTabProps {
  holidays: Holiday[];
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
  activeUser: Employee;
}

export function HolidaysTab({ holidays, setHolidays, activeUser }: HolidaysTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const isAuthorized = ['admin', 'manager'].includes(activeUser.role);

  // Submit new holiday
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;

    if (startDate > endDate) {
      setFormError("Start Date cannot be after End Date.");
      return;
    }

    // Check if holiday already overlaps for these dates
    const hasOverlap = holidays.some(h => {
      const hStart = h.startDate || h.date || '';
      const hEnd = h.endDate || h.date || '';
      return (startDate <= hEnd && endDate >= hStart);
    });

    if (hasOverlap) {
      setFormError("A holiday overlap has been detected in this date range.");
      return;
    }

    const newHoliday: Holiday = {
      id: `HOL-${Date.now()}`,
      name: name.trim(),
      startDate: startDate,
      endDate: endDate,
      date: startDate
    };

    setHolidays(prev => {
      const updated = [...prev, newHoliday];
      // Sort chronologically by startDate
      return updated.sort((a, b) => {
        const aStart = a.startDate || a.date || '';
        const bStart = b.startDate || b.date || '';
        return aStart.localeCompare(bStart);
      });
    });

    setName('');
    setStartDate('');
    setEndDate('');
    setFormError(null);
    setIsAdding(false);
  };

  const getDayName = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (e) {
      return '';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY formatting
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Holiday & Calendar Registry</h2>
          <p className="text-slate-500 text-xs mt-1">
            View national holidays, festival breaks, and scheduled days off.
          </p>
        </div>
        {isAuthorized && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Holiday
          </button>
        )}
      </div>

      {/* Info Banner for Sundays */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-800">
        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-extrabold uppercase tracking-wider">Default Weekly Off-Day</p>
          <p className="text-slate-600 leading-relaxed font-medium">
            <strong>Sundays</strong> are designated as standard non-working off-days by default. Attendance is not monitored or marked as absent on Sundays, and any skipped punches will automatically be classified as <strong>Sunday Off</strong>.
          </p>
        </div>
      </div>

      {isAdding && isAuthorized && (
        <form onSubmit={handleAddSubmit} className="bg-white border border-indigo-100 p-6 rounded-xl shadow-sm space-y-4 animate-fade-in">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Schedule New Holiday</h3>
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{formError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1 md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Holiday Name / Occasion</label>
              <input
                type="text"
                required
                placeholder="e.g. Diwali Festival, Holi, Christmas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">End Date</label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              Add Holiday
            </button>
          </div>
        </form>
      )}

      {/* Holidays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {holidays.map((hol) => {
          const hStart = hol.startDate || hol.date || '';
          const hEnd = hol.endDate || hol.date || '';
          const isMultiDay = hStart !== hEnd;

          const dayName = isMultiDay 
            ? `${getDayName(hStart)} to ${getDayName(hEnd)}`
            : getDayName(hStart);

          const displayDate = isMultiDay
            ? `${formatDate(hStart)} - ${formatDate(hEnd)}`
            : formatDate(hStart);

          return (
            <div key={hol.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs hover:shadow-sm transition-all flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800 leading-tight">{hol.name}</h4>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">{dayName}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{displayDate}</p>
                </div>
              </div>
              {isAuthorized && (
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove the holiday "${hol.name}"?`)) {
                      setHolidays(prev => prev.filter(h => h.id !== hol.id));
                    }
                  }}
                  className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remove Holiday"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {holidays.length === 0 && (
          <div className="col-span-full bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-500">
            <Gift className="w-8 h-8 mx-auto mb-2 text-slate-300 animate-bounce" />
            <p className="text-xs font-bold uppercase tracking-wider">No Holidays Declared</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Contact administration or add scheduled holiday events.</p>
          </div>
        )}
      </div>
    </div>
  );
}
