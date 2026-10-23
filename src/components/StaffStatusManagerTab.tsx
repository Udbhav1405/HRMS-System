import React, { useState, useMemo } from 'react';
import { Employee, EmployeeStatus } from '../types';
import { isExcludedStaff } from '../utils/sqlClient.ts';
import {
  Briefcase,
  GraduationCap,
  UserX,
  Award,
  Search,
  CheckCircle2,
  Clock,
  Building,
  Info,
  Sliders,
  Filter
} from 'lucide-react';

interface StaffStatusManagerTabProps {
  employees: Employee[];
  setEmployees: (action: React.SetStateAction<Employee[]>) => void;
  activeUser: Employee;
  onStatusChangeToast?: (msg: string) => void;
}

export const STATUS_OPTIONS: {
  value: EmployeeStatus;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  attendanceRequired: boolean;
  colorClass: string;
  badgeClass: string;
  activeBg: string;
}[] = [
  {
    value: 'working',
    label: 'Working (Regular Staff)',
    shortLabel: 'Working',
    icon: '💼',
    description: 'Active staff member. Daily punch-in and attendance policies apply.',
    attendanceRequired: true,
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-300',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    activeBg: 'bg-emerald-600 text-white'
  },
  {
    value: 'on internship',
    label: 'On Internship (Active Intern)',
    shortLabel: 'On Internship',
    icon: '🎓',
    description: 'Currently enrolled in active internship. Attendance tracking enabled.',
    attendanceRequired: true,
    colorClass: 'text-blue-700 bg-blue-50 border-blue-300',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    activeBg: 'bg-blue-600 text-white'
  },
  {
    value: 'not working',
    label: 'Not Working (Inactive / On Leave)',
    shortLabel: 'Not Working',
    icon: '⛔',
    description: 'No longer working / resigned / paused. Attendance is NOT required.',
    attendanceRequired: false,
    colorClass: 'text-rose-700 bg-rose-50 border-rose-300',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    activeBg: 'bg-rose-600 text-white'
  },
  {
    value: 'internship completed',
    label: 'Internship Completed',
    shortLabel: 'Internship Completed',
    icon: '🎖️',
    description: 'Successfully finished internship period. Attendance is NOT required.',
    attendanceRequired: false,
    colorClass: 'text-purple-700 bg-purple-50 border-purple-300',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    activeBg: 'bg-purple-600 text-white'
  }
];

export const normalizeEmployeeStatus = (status?: string): EmployeeStatus => {
  if (!status) return 'working';
  const s = status.toLowerCase().trim();
  if (s === 'on internship' || s === 'internship' || s === 'intern') return 'on internship';
  if (s === 'internship completed' || s === 'completed' || s === 'completed internship') return 'internship completed';
  if (s === 'not working' || s === 'inactive' || s === 'resigned' || s === 'left') return 'not working';
  return 'working';
};

export const StaffStatusManagerTab: React.FC<StaffStatusManagerTabProps> = ({
  employees,
  setEmployees,
  activeUser,
  onStatusChangeToast
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');

  // Authorization check
  const isAuthorized = ['admin', 'hr', 'manager'].includes(activeUser.role);

  const cleanEmployees = useMemo(() => {
    return (employees || []).filter(e => !isExcludedStaff(e));
  }, [employees]);

  // Status breakdown metrics
  const counts = useMemo(() => {
    let working = 0;
    let onInternship = 0;
    let notWorking = 0;
    let completed = 0;

    cleanEmployees.forEach(emp => {
      const norm = normalizeEmployeeStatus(emp.status);
      if (norm === 'working') working++;
      else if (norm === 'on internship') onInternship++;
      else if (norm === 'not working') notWorking++;
      else if (norm === 'internship completed') completed++;
    });

    return {
      all: cleanEmployees.length,
      working,
      onInternship,
      notWorking,
      completed
    };
  }, [cleanEmployees]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    cleanEmployees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [cleanEmployees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return cleanEmployees.filter(emp => {
      const normStatus = normalizeEmployeeStatus(emp.status);

      if (filterStatus !== 'all' && normStatus !== filterStatus) {
        return false;
      }

      if (filterDept !== 'all' && emp.department !== filterDept) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = emp.name.toLowerCase().includes(q);
        const matchEmail = (emp.email || '').toLowerCase().includes(q);
        const matchId = (emp.id || '').toLowerCase().includes(q);
        const matchDept = (emp.department || '').toLowerCase().includes(q);
        const matchJob = (emp.jobTitle || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchId && !matchDept && !matchJob) {
          return false;
        }
      }

      return true;
    });
  }, [employees, filterStatus, filterDept, search]);

  const handleStatusChange = (employeeId: string, newStatus: EmployeeStatus) => {
    const target = employees.find(e => e.id === employeeId);
    if (!target) return;

    const opt = STATUS_OPTIONS.find(o => o.value === newStatus);
    const label = opt ? opt.shortLabel : newStatus;

    setEmployees(prev =>
      prev.map(emp => (emp.id === employeeId ? { ...emp, status: newStatus } : emp))
    );

    if (onStatusChangeToast) {
      onStatusChangeToast(`Updated status of ${target.name} to "${label}"`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Employment & Internship Management</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Staff Status Controller
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Dynamically switch employees between <strong>Working</strong>, <strong>On Internship</strong>, <strong>Not Working</strong>, and <strong>Internship Completed</strong>. Daily attendance requirements and punch gates update automatically in real time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700 rounded-xl p-3 text-xs">
              <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Staff Roster</span>
              <span className="text-xl font-black text-white">{counts.all} Employees</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Status Breakdown KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Working */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'working' ? 'all' : 'working')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            filterStatus === 'working'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
              : 'bg-white hover:bg-emerald-50/50 border-emerald-200 text-slate-800 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${filterStatus === 'working' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              <Briefcase className="w-5 h-5" />
            </div>
            <span className={`text-2xl font-black font-mono ${filterStatus === 'working' ? 'text-white' : 'text-emerald-700'}`}>
              {counts.working}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-black uppercase tracking-tight">💼 Working</h4>
            <p className={`text-[10px] mt-0.5 ${filterStatus === 'working' ? 'text-emerald-100' : 'text-slate-500'}`}>
              Regular active staff • Attendance required
            </p>
          </div>
        </button>

        {/* On Internship */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'on internship' ? 'all' : 'on internship')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            filterStatus === 'on internship'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400'
              : 'bg-white hover:bg-blue-50/50 border-blue-200 text-slate-800 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${filterStatus === 'on internship' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'}`}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className={`text-2xl font-black font-mono ${filterStatus === 'on internship' ? 'text-white' : 'text-blue-700'}`}>
              {counts.onInternship}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-black uppercase tracking-tight">🎓 On Internship</h4>
            <p className={`text-[10px] mt-0.5 ${filterStatus === 'on internship' ? 'text-blue-100' : 'text-slate-500'}`}>
              Active interns in training • Attendance required
            </p>
          </div>
        </button>

        {/* Not Working */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'not working' ? 'all' : 'not working')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            filterStatus === 'not working'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400'
              : 'bg-white hover:bg-rose-50/50 border-rose-200 text-slate-800 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${filterStatus === 'not working' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'}`}>
              <UserX className="w-5 h-5" />
            </div>
            <span className={`text-2xl font-black font-mono ${filterStatus === 'not working' ? 'text-white' : 'text-rose-700'}`}>
              {counts.notWorking}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-black uppercase tracking-tight">⛔ Not Working</h4>
            <p className={`text-[10px] mt-0.5 ${filterStatus === 'not working' ? 'text-rose-100' : 'text-slate-500'}`}>
              Inactive / Paused • Attendance exempted
            </p>
          </div>
        </button>

        {/* Internship Completed */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'internship completed' ? 'all' : 'internship completed')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            filterStatus === 'internship completed'
              ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400'
              : 'bg-white hover:bg-purple-50/50 border-purple-200 text-slate-800 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${filterStatus === 'internship completed' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'}`}>
              <Award className="w-5 h-5" />
            </div>
            <span className={`text-2xl font-black font-mono ${filterStatus === 'internship completed' ? 'text-white' : 'text-purple-700'}`}>
              {counts.completed}
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-black uppercase tracking-tight">🎖️ Internship Completed</h4>
            <p className={`text-[10px] mt-0.5 ${filterStatus === 'internship completed' ? 'text-purple-100' : 'text-slate-500'}`}>
              Alumni / Completed • Attendance exempted
            </p>
          </div>
        </button>
      </div>

      {/* Filter Ribbon & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by staff name, ID, email, role, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setFilterStatus('working')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              filterStatus === 'working'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            💼 Working ({counts.working})
          </button>
          <button
            onClick={() => setFilterStatus('on internship')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              filterStatus === 'on internship'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            🎓 On Internship ({counts.onInternship})
          </button>
          <button
            onClick={() => setFilterStatus('not working')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              filterStatus === 'not working'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            ⛔ Not Working ({counts.notWorking})
          </button>
          <button
            onClick={() => setFilterStatus('internship completed')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              filterStatus === 'internship completed'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            🎖️ Completed ({counts.completed})
          </button>
        </div>

        {/* Department Filter */}
        <div className="flex items-center space-x-2 shrink-0">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Departments ({departments.length})</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table: Staff Status Controller */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              Interactive Status Management Table
            </span>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full font-mono">
              {filteredEmployees.length} of {employees.length} Staff
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            💡 Select any status from the dropdown or quick-action buttons below to update live
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">No.</th>
                <th className="py-3 px-4">Staff Member & ID No.</th>
                <th className="py-3 px-4">Role & Dept</th>
                <th className="py-3 px-4">Current Status</th>
                <th className="py-3 px-4">Attendance Impact</th>
                <th className="py-3 px-4 min-w-[260px]">Change Status (Live)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    No staff records match the current filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, empIdx) => {
                  const normStatus = normalizeEmployeeStatus(emp.status);
                  const currentOpt = STATUS_OPTIONS.find(o => o.value === normStatus) || STATUS_OPTIONS[0];

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Serial Number */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                        {empIdx + 1}
                      </td>
                      {/* Staff Member Avatar & Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={`Profile avatar of ${emp.name}`}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-3xs shrink-0"
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${emp.avatarColor}`}>
                              {emp.name.split(' ').map(n => n[0]).join('')}
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <h4 className="font-extrabold text-slate-900 text-xs truncate">{emp.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">{emp.id} • {emp.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role & Dept */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase text-[9px] tracking-wide">
                            {emp.role}
                          </span>
                          <p className="text-[11px] font-semibold text-slate-800">{emp.jobTitle}</p>
                          <p className="text-[10px] text-slate-400 truncate">{emp.department}</p>
                        </div>
                      </td>

                      {/* Current Status Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-extrabold text-xs border shadow-3xs ${currentOpt.badgeClass}`}>
                          <span>{currentOpt.icon}</span>
                          <span>{currentOpt.shortLabel}</span>
                        </span>
                      </td>

                      {/* Attendance Impact */}
                      <td className="py-3 px-4">
                        {currentOpt.attendanceRequired ? (
                          <span className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Attendance Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3 mr-1 text-amber-600" />
                            Attendance Exempted
                          </span>
                        )}
                      </td>

                      {/* Change Status Dropdown & One-Click Buttons */}
                      <td className="py-3 px-4">
                        {isAuthorized ? (
                          <div className="space-y-1.5">
                            {/* Native Selector */}
                            <select
                              value={normStatus}
                              onChange={(e) => handleStatusChange(emp.id, e.target.value as EmployeeStatus)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-3xs cursor-pointer"
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.icon} {opt.label}
                                </option>
                              ))}
                            </select>

                            {/* One-Click Quick Pills */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {STATUS_OPTIONS.map(opt => {
                                const isCurrent = normStatus === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => handleStatusChange(emp.id, opt.value)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                      isCurrent
                                        ? `${opt.activeBg} shadow-3xs scale-105`
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                    title={opt.description}
                                  >
                                    {opt.icon} {opt.shortLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Admin / HR privilege required to change status
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Policy Info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-slate-800">Status Change Policy:</span>
            <p className="text-[11px] leading-relaxed text-slate-500">
              When an employee is set to <strong>&quot;Not Working&quot;</strong> or <strong>&quot;Internship Completed&quot;</strong>, they are automatically excused from daily punch-in requirements, their individual punch button is safely gated, and they will not appear as unresolved absentees in the daily attendance audit. You can reactivate an employee by setting them back to <strong>&quot;Working&quot;</strong> at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
