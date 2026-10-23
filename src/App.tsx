import React, { useState, useEffect, useRef } from 'react';
import { saveToSQLite, fetchAllFromSQLite, resetSQLiteDB, subscribeToSQLite, getLocalCache, flushPendingWrites } from './utils/sqliteClient';
import { PDF_EMPLOYEES, PDF_ATTENDANCE_LOGS, PDF_LEAVE_REQUESTS, TODAY_PUNCH_IN_TIMES, INITIAL_DEPARTMENTS_LIST } from './data/pdfAttendanceData';
import {
  Clock,
  User,
  Users,
  CheckSquare,
  Plus,
  Edit2,
  X,
  Calendar,
  Building,
  IndianRupee,
  Phone,
  MapPin,
  UserCheck,
  Briefcase,
  Send,
  Lock,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
  Activity,
  CheckCircle2,
  Trash2,
  Download,
  Gift,
  Settings,
  ShieldCheck,
  Menu,
  LogOut,
  FileSpreadsheet,
  FileText,
  Mail,
  Bell,
  BellRing,
  Check,
  ArrowUpDown,
  ExternalLink,
  RefreshCw,
  LogIn,
  Eye,
  Database,
  Sliders,
  HardDrive,
  Terminal,
  Table,
  GraduationCap,
  Award,
  UserX
} from 'lucide-react';

import { Employee, EmployeeStatus, TaskProposal, AssignedTask, AttendanceLog, Department, LeaveRequest, SalaryRecord, Holiday, UserNotification } from './types';
import { calculateDurationStr, checkIsLate, getAttendanceStatus, isDateSaturday, isDateSunday, getSaturdayEndTime, format12HourTime, parseTimeToDate, resolveUnpunchedStatus, resolveHalfDayStatus, getMonthlyQuotaCounts } from './utils/timeHelpers';
import { downloadAttendanceCSV } from './utils/csvDownloader';
import { exportHRMSToExcel, generateExcelBinary, generateAttendanceExcelBinary, parseExcelToState, exportAttendanceToExcel } from './utils/excelExporter';
import { calculateMonthlySalary } from './utils/salaryCalculator';
import { DepartmentsTab } from './components/DepartmentsTab';
import { LeaveRequestsTab } from './components/LeaveRequestsTab';
import { PayrollTab } from './components/PayrollTab';
import { HolidaysTab } from './components/HolidaysTab';
import { SQLiteEditorModal } from './components/SQLiteEditorModal';
import { SmtpMailClientModal } from './components/SmtpMailClientModal';
import { SmtpMailOutboxTab } from './components/SmtpMailOutboxTab';
import { StaffStatusManagerTab, normalizeEmployeeStatus, STATUS_OPTIONS } from './components/StaffStatusManagerTab';
import { DepartmentTaskProgressChart } from './components/DepartmentTaskProgressChart';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { TermsAndConditionsModal } from './components/TermsAndConditionsModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { NotFoundView } from './components/NotFoundView';
import { trackEvent } from './utils/analytics';
import { checkRateLimit, isHoneypotTriggered } from './utils/spamProtection';
import { HrmsLogo } from './components/HrmsLogo';
import { mailService, subscribeToMailEvents } from './services/mailService';

export const isEmployeeInactiveOrCompleted = (emp?: { status?: string }) => {
  if (!emp) return false;
  const norm = normalizeEmployeeStatus(emp.status);
  return norm === 'not working' || norm === 'internship completed';
};

// INR Formatting Utility
export const formatINR = (salary: string | number) => {
  if (salary === undefined || salary === null || salary === '') return 'INR 0';
  const str = String(salary);
  // Remove any currency symbol and non-numeric characters, except numbers
  const clean = str.replace(/[^\d]/g, '');
  if (!clean) {
    // If it already has INR, return as is
    if (str.toUpperCase().includes('INR')) return str;
    return 'INR ' + str;
  }
  const num = parseInt(clean, 10);
  return 'INR ' + num.toLocaleString('en-IN');
};

// Extract numeric value from salary string for statistics
export const parseSalary = (salaryStr: string | number) => {
  if (!salaryStr) return 0;
  const str = String(salaryStr);
  const cleaned = str.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
};

// Indian Phone Format Utility (+91 XXXXX XXXXX)
export const formatIndianPhone = (phoneStr: string) => {
  if (!phoneStr) return '';
  // Remove all non-digit characters
  const clean = phoneStr.replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  } else if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  } else if (clean.length > 10) {
    // If it already contains country code, format the last 10 digits
    const last10 = clean.slice(-10);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }
  return phoneStr;
};

// Convert 24-hour time "HH:MM" (HTML input value) to 12-hour AM/PM string
export const convertTo12Hour = (time24: string): string => {
  if (!time24) return '09:30 AM';
  const [hrsStr, minsStr] = time24.split(':');
  let hrs = parseInt(hrsStr, 10);
  const mins = parseInt(minsStr, 10);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  const formattedHrs = String(hrs).padStart(2, '0');
  const formattedMins = String(mins).padStart(2, '0');
  return `${formattedHrs}:${formattedMins} ${ampm}`;
};

// Convert 12-hour AM/PM string to 24-hour time "HH:MM" for HTML input value
export const convertTo24Hour = (time12: string): string => {
  if (!time12) return '09:00';
  const cleanTime = time12.replace(/[\u202f\u00a0\s]+/g, ' ').trim();
  const match = cleanTime.match(/^(\d+):(\d+)(?::\d+)?\s*(AM|PM)?$/i);
  if (!match) return '09:00';
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Sort Attendance Logs chronologically (defaults to newest first)
export const sortAttendanceLogs = (logs: AttendanceLog[], order: 'asc' | 'desc' = 'desc'): AttendanceLog[] => {
  return [...logs].sort((a, b) => {
    // 1. Compare Date
    const dateCompare = order === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;

    // 2. Compare Time (Ascending: earlier time first, empty/absent/leave records go to the end of that day)
    const isAEmpty = !a.checkIn || a.checkIn === '---' || a.status === 'Absent' || a.status === 'On Leave';
    const isBEmpty = !b.checkIn || b.checkIn === '---' || b.status === 'Absent' || b.status === 'On Leave';

    if (isAEmpty && !isBEmpty) return 1;
    if (!isAEmpty && isBEmpty) return -1;
    if (!isAEmpty && !isBEmpty) {
      const aTime24 = convertTo24Hour(a.checkIn);
      const bTime24 = convertTo24Hour(b.checkIn);
      const timeCompare = aTime24.localeCompare(bTime24);
      if (timeCompare !== 0) return timeCompare;
    }

    // 3. Compare Employee Name (Ascending: A to Z)
    return a.userName.localeCompare(b.userName);
  });
};

// 12-Hour interactive Time Picker component with changeable AM/PM
const TimePicker12 = ({ 
  value, 
  onChange, 
  idPrefix 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  idPrefix: string 
}) => {
  const match = value.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
  const hour = match ? match[1] : "09";
  const minute = match ? match[2] : "00";
  const ampm = match ? match[3].toUpperCase() : "AM";

  const handleHourChange = (newHour: string) => {
    onChange(`${newHour}:${minute} ${ampm}`);
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(`${hour}:${newMinute} ${ampm}`);
  };

  const handleAmpmChange = (newAmpm: string) => {
    onChange(`${hour}:${minute} ${newAmpm}`);
  };

  return (
    <div className="flex items-center space-x-1 bg-slate-800 border border-slate-700 rounded-lg p-1 text-white font-mono text-xs shadow-inner">
      <select
        id={`${idPrefix}-hour`}
        value={hour}
        onChange={(e) => handleHourChange(e.target.value)}
        className="bg-slate-900 text-white border border-slate-700 rounded px-1.5 py-0.5 cursor-pointer focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-mono select-none"
      >
        {Array.from({ length: 12 }, (_, i) => {
          const h = String(i + 1).padStart(2, '0');
          return <option key={h} className="bg-slate-950 text-white" value={h}>{h}</option>;
        })}
      </select>
      <span className="text-slate-400 font-extrabold">:</span>
      <select
        id={`${idPrefix}-minute`}
        value={minute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        className="bg-slate-900 text-white border border-slate-700 rounded px-1.5 py-0.5 cursor-pointer focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-mono select-none"
      >
        {Array.from({ length: 60 }, (_, i) => {
          const m = String(i).padStart(2, '0');
          return <option key={m} className="bg-slate-950 text-white" value={m}>{m}</option>;
        })}
      </select>
      <select
        id={`${idPrefix}-ampm`}
        value={ampm}
        onChange={(e) => handleAmpmChange(e.target.value)}
        className="bg-slate-900 text-indigo-300 border border-slate-700 rounded px-1.5 py-0.5 cursor-pointer font-extrabold focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs font-mono select-none"
      >
        <option className="bg-slate-950 text-white" value="AM">AM</option>
        <option className="bg-slate-950 text-white" value="PM">PM</option>
      </select>
    </div>
  );
};

// Add minutes to 12-hour time string
const addMinutesTo12HourTime = (timeStr: string, minsToAdd: number): string => {
  try {
    const cleanTime = timeStr.replace(/[\u202f\u00a0\s]+/g, ' ').trim();
    const match = cleanTime.match(/^(\d+):(\d+)(?::\d+)?\s*(AM|PM)?$/i);
    if (!match) return timeStr;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : 'AM';
    
    if (ampm === 'PM' && hours < 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }
    
    let totalMinutes = hours * 60 + minutes + minsToAdd;
    let newHours = Math.floor(totalMinutes / 60) % 24;
    let newMinutes = totalMinutes % 60;
    
    const newAmpm = newHours >= 12 ? 'PM' : 'AM';
    newHours = newHours % 12;
    if (newHours === 0) newHours = 12;
    
    const formattedHrs = String(newHours).padStart(2, '0');
    const formattedMins = String(newMinutes).padStart(2, '0');
    return `${formattedHrs}:${formattedMins} ${newAmpm}`;
  } catch (e) {
    return timeStr;
  }
};


// Helper to remove default mock emergency contact details and default contact numbers
export const sanitizeDefaultContactDetails = (emp: any): any => {
  if (!emp) return emp;
  const phone = typeof emp.phone === 'string' ? emp.phone.trim() : (emp.phone ? String(emp.phone).trim() : '');
  const emergency = typeof emp.emergencyContact === 'string' ? emp.emergencyContact.trim() : (emp.emergencyContact ? String(emp.emergencyContact).trim() : '');
  
  const phoneLower = phone.toLowerCase();
  const emergencyLower = emergency.toLowerCase();

  const isDefaultPhone = 
    phoneLower.includes('default') ||
    phoneLower.includes('(default)') ||
    phone.includes('98765') ||
    phone.includes('99999') ||
    phone.includes('12345') ||
    phone.includes('00000') ||
    phoneLower === 'not provided' ||
    phoneLower === 'n/a' ||
    phoneLower === 'none' ||
    phone === '-' ||
    phone === '--';

  const isDefaultEmergency = 
    emergencyLower.includes('default') ||
    emergencyLower.includes('(default)') ||
    emergency.includes('98765') ||
    emergency.includes('99999') ||
    emergency.includes('12345') ||
    emergencyLower.includes('emergency hq') ||
    emergencyLower.includes('(mother)') ||
    emergencyLower.includes('(father)') ||
    emergencyLower.includes('(brother)') ||
    emergencyLower.includes('(sister)') ||
    emergencyLower.includes('hq') ||
    emergencyLower === 'not provided' ||
    emergencyLower === 'n/a' ||
    emergencyLower === 'none' ||
    emergency === '-' ||
    emergency === '--';

  const avatarUrl = typeof emp.avatarUrl === 'string' ? emp.avatarUrl.trim() : (emp.avatarUrl ? String(emp.avatarUrl).trim() : '');
  const avatarLower = avatarUrl.toLowerCase();
  const isDefaultAvatar = 
    avatarLower.includes('unsplash.com') ||
    avatarLower.includes('pravatar.cc') ||
    avatarLower.includes('dicebear.com') ||
    avatarLower.includes('placeholder') ||
    avatarLower === 'default';

  const address = typeof emp.address === 'string' ? emp.address : '';
  const isDefaultAddress = address.includes('Heritage Enclave') || 
    address.includes('Galaxy Apartments') || 
    address.includes('Gurugram') ||
    ((emp.id === 'TT26SM02' || emp.id === 'TT26DM02' || emp.id === 'TT26IT014') && address.includes('Noida'));

  return {
    ...emp,
    avatarUrl: isDefaultAvatar ? '' : avatarUrl,
    phone: isDefaultPhone ? '' : phone,
    emergencyContact: isDefaultEmergency ? '' : emergency,
    address: isDefaultAddress ? '' : address
  };
};

// Clean up any stale storage on script load
if (typeof window !== 'undefined') {
  try {
    if (window.localStorage) {
      const cached = window.localStorage.getItem('hrms_sqlite_employees') || window.localStorage.getItem('employees');
      if (cached && (cached.includes('Udbhav') || cached.includes('Abhishek') || cached.includes('Thread') || cached.includes('threadtechnologies'))) {
        window.localStorage.clear();
      }
    }
    if (window.sessionStorage) {
      const activeUserRaw = window.sessionStorage.getItem('activeUser');
      if (activeUserRaw && (activeUserRaw.includes('Udbhav') || activeUserRaw.includes('Abhishek') || activeUserRaw.includes('Thread') || activeUserRaw.includes('threadtechnologies'))) {
        window.sessionStorage.clear();
      }
    }
  } catch {}
}

// Initial Mock Data with 4 dummy staff members (Admin, Manager, HR, Employee)
const INITIAL_EMPLOYEES: Employee[] = PDF_EMPLOYEES.map(sanitizeDefaultContactDetails);

// Helper to check for excluded/removed employees
export const isExcludedStaff = (emp: any): boolean => {
  if (!emp) return false;
  try {
    const json = JSON.stringify(emp).toLowerCase();
    return json.includes('vishal') || json.includes('paswan');
  } catch {
    return false;
  }
};

// Helper to guarantee baseline staff stay first in their canonical order
export const ensureStaffOrder = (emps: Employee[]): Employee[] => {
  if (!emps || !Array.isArray(emps)) return INITIAL_EMPLOYEES.map(sanitizeDefaultContactDetails);
  const sanitized = emps.filter(e => !isExcludedStaff(e)).map(sanitizeDefaultContactDetails);
  const baselineIds = INITIAL_EMPLOYEES.map(e => e.id);
  const baselineIdSet = new Set(baselineIds);
  
  // Baseline staff always remain first in their canonical order
  const baselineStaff = INITIAL_EMPLOYEES.map(base => {
    const updated = sanitized.find(e => e.id === base.id || (e.email && base.email && e.email.toLowerCase() === base.email.toLowerCase()));
    if (!updated) return base;
    return sanitizeDefaultContactDetails({
      ...base,
      ...updated,
      id: base.id,
      role: base.role,
      name: updated.name || base.name,
      email: updated.email || base.email,
      jobTitle: updated.jobTitle || base.jobTitle,
      department: updated.department || base.department,
      phone: updated.phone || base.phone,
      address: updated.address || base.address,
      salary: updated.salary || base.salary,
      password: updated.password || base.password,
      status: updated.status || base.status || 'working',
      joinDate: updated.joinDate || base.joinDate,
      avatarColor: base.avatarColor,
      avatarUrl: updated.avatarUrl || ''
    });
  });
  
  // Any newly added employees strictly go after baseline staff, preserving their addition order
  const customList = sanitized.filter(e => !baselineIdSet.has(e.id)).map(sanitizeDefaultContactDetails);
  return [...baselineStaff, ...customList];
};

const INITIAL_DEPARTMENTS: Department[] = INITIAL_DEPARTMENTS_LIST;

const INITIAL_PROPOSALS: TaskProposal[] = [];

const INITIAL_TASKS: AssignedTask[] = [
  {
    id: 'TSK-101',
    title: 'Full-Stack System Architecture & Query Optimization',
    description: 'Optimize local SQLite database layer, query execution indexes, and server endpoints.',
    priority: 'high',
    dueDate: '2026-10-31',
    employeeId: 'EMP-004',
    employeeName: 'Rohan Verma',
    assignedBy: 'Priya Sharma (HR)',
    status: 'completed',
    completedAt: '2026-10-20 17:00 PM'
  },
  {
    id: 'TSK-102',
    title: 'REST API Endpoints & Data Model Validation',
    description: 'Verify relational SQLite schema tables, transactional queries, and error handlers.',
    priority: 'high',
    dueDate: '2026-10-28',
    employeeId: 'EMP-004',
    employeeName: 'Rohan Verma',
    assignedBy: 'Priya Sharma (HR)',
    status: 'in-progress'
  },
  {
    id: 'TSK-103',
    title: 'Automated Backup & Disaster Recovery Scripting',
    description: 'Implement automated database backup export utilities and integrity checks.',
    priority: 'medium',
    dueDate: '2026-11-05',
    employeeId: 'EMP-004',
    employeeName: 'Rohan Verma',
    assignedBy: 'Rajesh Malhotra (MANAGER)',
    status: 'pending'
  },
  {
    id: 'TSK-104',
    title: 'Monthly Payroll Reconciliation & Salary PDF Reports',
    description: 'Audit monthly attendance records, leave balances, and generate salary disbursement statements.',
    priority: 'high',
    dueDate: '2026-10-25',
    employeeId: 'EMP-003',
    employeeName: 'Priya Sharma',
    assignedBy: 'Rajesh Malhotra (MANAGER)',
    status: 'completed',
    completedAt: '2026-10-18 16:30 PM'
  },
  {
    id: 'TSK-105',
    title: 'Quarterly Staff Performance Evaluation & Feedback',
    description: 'Coordinate review sessions and collect feedback across engineering and operations teams.',
    priority: 'medium',
    dueDate: '2026-11-10',
    employeeId: 'EMP-003',
    employeeName: 'Priya Sharma',
    assignedBy: 'Rajesh Malhotra (MANAGER)',
    status: 'in-progress'
  },
  {
    id: 'TSK-106',
    title: 'Operational Resource Allocation & Infrastructure Review',
    description: 'Review departmental staffing projections, project milestones, and server requirements.',
    priority: 'high',
    dueDate: '2026-10-24',
    employeeId: 'EMP-002',
    employeeName: 'Rajesh Malhotra',
    assignedBy: 'Aarav Sharma (ADMIN)',
    status: 'completed',
    completedAt: '2026-10-17 15:45 PM'
  },
  {
    id: 'TSK-107',
    title: 'Process Automation & Service Level Agreement Tracking',
    description: 'Audit cross-departmental delivery metrics, workflow routing, and operational timelines.',
    priority: 'medium',
    dueDate: '2026-11-02',
    employeeId: 'EMP-002',
    employeeName: 'Rajesh Malhotra',
    assignedBy: 'Aarav Sharma (ADMIN)',
    status: 'in-progress'
  }
];

const INITIAL_ATTENDANCE: AttendanceLog[] = PDF_ATTENDANCE_LOGS;

const INITIAL_HOLIDAYS: Holiday[] = [
  { id: 'HOL-01', name: "New Year's Day", startDate: '2026-01-01', endDate: '2026-01-01', date: '2026-01-01' },
  { id: 'HOL-02', name: 'Republic Day', startDate: '2026-01-26', endDate: '2026-01-26', date: '2026-01-26' },
  { id: 'HOL-03', name: 'Holi', startDate: '2026-03-04', endDate: '2026-03-04', date: '2026-03-04' },
  { id: 'HOL-04', name: 'Independence Day', startDate: '2026-08-15', endDate: '2026-08-15', date: '2026-08-15' },
  { id: 'HOL-05', name: 'Gandhi Jayanti', startDate: '2026-10-02', endDate: '2026-10-02', date: '2026-10-02' },
  { id: 'HOL-06', name: 'Diwali', startDate: '2026-11-08', endDate: '2026-11-08', date: '2026-11-08' },
  { id: 'HOL-07', name: 'Christmas Day', startDate: '2026-12-25', endDate: '2026-12-25', date: '2026-12-25' }
];

export default function App() {
  // Time & Live Clock Simulation Offset
  const [timeOffset, setTimeOffset] = useState<number>(() => {
    const saved = sessionStorage.getItem('hrms_time_offset');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date(Date.now() + timeOffset));

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSQLiteModalOpen, setIsSQLiteModalOpen] = useState<boolean>(false);

  const [employeesState, setEmployeesState] = useState<Employee[]>(() => {
    const cached = getLocalCache<Employee[]>('employees');
    return cached && Array.isArray(cached) && cached.length > 0 ? ensureStaffOrder(cached) : INITIAL_EMPLOYEES;
  });
  const [proposalsState, setProposalsState] = useState<TaskProposal[]>([]);
  const [tasksState, setTasksState] = useState<AssignedTask[]>(() => {
    const cached = getLocalCache<AssignedTask[]>('tasks');
    return cached && Array.isArray(cached) && cached.length > 0 ? cached : INITIAL_TASKS;
  });
  const [attendanceState, setAttendanceState] = useState<AttendanceLog[]>([]);
  const [departmentsState, setDepartmentsState] = useState<Department[]>(() => {
    const cached = getLocalCache<Department[]>('departments');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    return INITIAL_DEPARTMENTS;
  });
  const [leaveRequestsState, setLeaveRequestsState] = useState<LeaveRequest[]>([]);
  const [salariesState, setSalariesState] = useState<SalaryRecord[]>([]);
  const [holidaysState, setHolidaysState] = useState<Holiday[]>(() => {
    const cached = getLocalCache<Holiday[]>('holidays');
    return cached && Array.isArray(cached) && cached.length > 0 ? cached : INITIAL_HOLIDAYS;
  });
  const [officeTimeState, setOfficeTimeState] = useState<string>(() => {
    return getLocalCache<string>('officeTime') || '09:30 AM';
  });
  const [officeEndTimeState, setOfficeEndTimeState] = useState<string>(() => {
    return getLocalCache<string>('officeEndTime') || '05:00 PM';
  });
  const [punchInTimesState, setPunchInTimesState] = useState<{ [key: string]: any }>({});
  const [notificationsState, setNotificationsState] = useState<UserNotification[]>([]);

  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [assignSuccessToast, setAssignSuccessToast] = useState<string | null>(null);

  const employees = employeesState;
  const proposals = proposalsState;
  const tasks = tasksState;
  const attendance = attendanceState;
  const departments = departmentsState;
  const leaveRequests = leaveRequestsState;
  const salaries = salariesState;
  const holidays = holidaysState;
  const officeTime = officeTimeState;
  const officeEndTime = officeEndTimeState;
  const punchInTimes = punchInTimesState;
  const notifications = notificationsState;

  const ignoreSyncRef = useRef(false);
  const isLoadedRef = useRef(false);
  const lastMutationTimeRef = useRef<number>(0);

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailLogCount, setMailLogCount] = useState<number>(() => mailService.getEmailLogs().length);

  useEffect(() => {
    const unsub = subscribeToMailEvents(() => {
      setMailLogCount(mailService.getEmailLogs().length);
    });
    return () => unsub();
  }, []);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveModalType, setLeaveModalType] = useState<'Leave' | 'Half Day'>('Leave');
  const [leaveModalStartDate, setLeaveModalStartDate] = useState('');
  const [leaveModalEndDate, setLeaveModalEndDate] = useState('');
  const [leaveModalReason, setLeaveModalReason] = useState('');

  const handleDashboardLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveModalStartDate || !leaveModalReason.trim()) return;

    // Spam Protection: Rate limit leave submissions
    const rateCheck = checkRateLimit(`leave_${activeUser.id}`, 6, 60000);
    if (!rateCheck.allowed) {
      alert(rateCheck.message);
      return;
    }

    const newReq: LeaveRequest = {
      id: `LEV-${Date.now()}`,
      employeeId: activeUser.id,
      employeeName: activeUser.name,
      type: leaveModalType,
      startDate: leaveModalStartDate,
      endDate: leaveModalType === 'Half Day' ? leaveModalStartDate : (leaveModalEndDate || leaveModalStartDate),
      reason: leaveModalReason.trim(),
      status: ['admin', 'manager'].includes(activeUser.role) ? 'Approved' : 'Pending HR'
    };

    setLeaveRequests(prev => [newReq, ...prev]);
    trackEvent('apply_leave', { employeeId: activeUser.id, type: leaveModalType, startDate: leaveModalStartDate });
    setIsLeaveModalOpen(false);
    setLeaveModalStartDate('');
    setLeaveModalEndDate('');
    setLeaveModalReason('');
  };

  const triggerSyncNotification = () => {
    setIsSyncing(true);
    setLastSyncTime(new Date());
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  const setEmployees = (action: React.SetStateAction<Employee[]>) => {
    lastMutationTimeRef.current = Date.now();
    setEmployeesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      // Strictly maintain staff order: baseline team first, newly added staff strictly at the end
      const ordered = ensureStaffOrder(next);
      if (isLoadedRef.current) {
        saveToSQLite('employees', ordered, { immediate: true });
        triggerSyncNotification();
      }
      return ordered;
    });
  };

  const setProposals = (action: React.SetStateAction<TaskProposal[]>) => {
    lastMutationTimeRef.current = Date.now();
    setProposalsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('proposals', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setTasks = (action: React.SetStateAction<AssignedTask[]>) => {
    lastMutationTimeRef.current = Date.now();
    setTasksState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('tasks', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setAttendance = (
    action: React.SetStateAction<AttendanceLog[]>,
    options?: { allowEmpty?: boolean; immediate?: boolean } | boolean
  ) => {
    const opts = typeof options === 'boolean' ? { allowEmpty: options, immediate: true } : { immediate: true, ...(options || {}) };
    lastMutationTimeRef.current = Date.now();
    setAttendanceState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('attendance', next, opts);
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setDepartments = (action: React.SetStateAction<Department[]>) => {
    lastMutationTimeRef.current = Date.now();
    setDepartmentsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('departments', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setLeaveRequests = (action: React.SetStateAction<LeaveRequest[]>) => {
    lastMutationTimeRef.current = Date.now();
    setLeaveRequestsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('leave_requests', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setSalaries = (action: React.SetStateAction<SalaryRecord[]>) => {
    lastMutationTimeRef.current = Date.now();
    setSalariesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('salaries', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setHolidays = (action: React.SetStateAction<Holiday[]>) => {
    lastMutationTimeRef.current = Date.now();
    setHolidaysState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('holidays', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setOfficeTime = (action: React.SetStateAction<string>) => {
    lastMutationTimeRef.current = Date.now();
    setOfficeTimeState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('officeTime', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setOfficeEndTime = (action: React.SetStateAction<string>) => {
    lastMutationTimeRef.current = Date.now();
    setOfficeEndTimeState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('officeEndTime', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setPunchInTimes = (
    action: React.SetStateAction<{ [key: string]: any }>,
    options: { immediate?: boolean } = {}
  ) => {
    lastMutationTimeRef.current = Date.now();
    setPunchInTimesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('punchInTimes', next, { immediate: true, ...options });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const setNotifications = (action: React.SetStateAction<UserNotification[]>) => {
    lastMutationTimeRef.current = Date.now();
    setNotificationsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (isLoadedRef.current) {
        saveToSQLite('notifications', next, { immediate: true });
        triggerSyncNotification();
      }
      return next;
    });
  };

  const markNotificationAsRead = (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => n.userId === activeUser.id ? { ...n, read: true } : n));
  };

  const deleteNotification = (notifId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceRoleFilter, setAttendanceRoleFilter] = useState('all');
  const [attendanceDeptFilter, setAttendanceDeptFilter] = useState('all');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('all');
  const [attendanceDateFilter, setAttendanceDateFilter] = useState('all');
  const [attendanceCustomDate, setAttendanceCustomDate] = useState('');
  const [attendanceSortOrder, setAttendanceSortOrder] = useState<'desc' | 'asc'>('desc');

  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Saturday/Half Day State Calculations
  const getLocalDateString = () => currentTime.toLocaleDateString('sv-SE');
  const todayStrStr = getLocalDateString();
  const isTodaySaturday = isDateSaturday(todayStrStr);
  const satEndTime = getSaturdayEndTime(officeTime, officeEndTime);

  // Range-aware Holiday Helper
  const getHolidayForDate = (dateStr: string) => {
    return holidays.find(h => {
      const hStart = h.startDate || h.date || '';
      const hEnd = h.endDate || h.date || '';
      return dateStr >= hStart && dateStr <= hEnd;
    });
  };

  // Helper to get approved leave for a given date and employee
  const getLeaveForDateAndEmployee = (employeeId: string, dateStr: string) => {
    return leaveRequests.find(req => {
      if (req.employeeId !== employeeId) return false;
      const isApproved = req.status === 'Approved' || req.status === 'Manager Approved';
      if (!isApproved) return false;
      return dateStr >= req.startDate && dateStr <= req.endDate;
    });
  };

  // Authentication and Login States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('isLoggedIn') === 'true';
  });
  const [loginEmailOrId, setLoginEmailOrId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Active User Persona
  const [activeUser, setActiveUser] = useState<Employee>(() => {
    const savedUserJSON = sessionStorage.getItem('activeUser');
    if (savedUserJSON) {
      try {
        const u = sanitizeDefaultContactDetails(JSON.parse(savedUserJSON));
        if (!isExcludedStaff(u)) {
          const canonical = PDF_EMPLOYEES.find(e => e.id === u.id || (e.email && e.email.toLowerCase() === u.email?.toLowerCase()));
          if (canonical && !isExcludedStaff(canonical)) {
            const merged = sanitizeDefaultContactDetails({ ...u, ...canonical, avatarUrl: u.avatarUrl || canonical.avatarUrl });
            sessionStorage.setItem('activeUser', JSON.stringify(merged));
            return merged;
          }
          return u;
        }
      } catch (e) {}
    }
    // Default to Aarav Sharma (System Administrator / Admin)
    return sanitizeDefaultContactDetails(INITIAL_EMPLOYEES[0]);
  });

  useEffect(() => {
    if (isExcludedStaff(activeUser)) {
      setActiveUser(INITIAL_EMPLOYEES[0]);
      sessionStorage.removeItem('activeUser');
      sessionStorage.removeItem('activeUserId');
    }
  }, [activeUser]);

  // Employee Detail View Modal (shows full profile & address for any employee)
  const [viewingEmployeeDetail, setViewingEmployeeDetail] = useState<Employee | null>(null);

  // Track original ID of employee currently being edited
  const [editingEmployeeOriginalId, setEditingEmployeeOriginalId] = useState<string>('');
  const [employeeIdPendingDelete, setEmployeeIdPendingDelete] = useState<string | null>(null);

  // Role-based profile edit permission checks
  const canEditEmployee = (emp: Employee) => {
    if (activeUser.role === 'admin') return true;
    if (activeUser.role === 'hr') {
      return emp.role === 'employee';
    }
    if (activeUser.role === 'manager') {
      return ['employee', 'hr'].includes(emp.role);
    }
    return false;
  };

  const canDeleteEmployee = (emp: Employee) => {
    if (activeUser.role === 'admin' && emp.id !== activeUser.id) return true;
    return false;
  };

  // Safe helper to extract active punch-in time for today only
  const getPunchInTime = (empId: string): string | null => {
    const val = punchInTimes[empId];
    if (!val) return null;
    const todayStr = getLocalDateString();
    if (typeof val === 'object' && val !== null) {
      if ((val as any).date === todayStr) return (val as any).time;
      return null;
    }
    // String format without date property is legacy/unanchored. Ignore to prevent false automatic punch-ins.
    return null;
  };

  // Role-based attendance records visibility
  const getVisibleAttendance = () => {
    const todayStr = getLocalDateString();
    const activePunchInLogs: AttendanceLog[] = [];
    employees.forEach(emp => {
      const checkInTime = getPunchInTime(emp.id);
      if (checkInTime) {
        activePunchInLogs.push({
          id: `ACTIVE-PUNCH-${emp.id}`,
          userId: emp.id,
          userName: emp.name,
          userRole: emp.role,
          date: todayStr,
          checkIn: checkInTime,
          checkOut: '---',
          duration: 'In-Progress',
          status: isDateSunday(todayStr) ? 'Sunday Off' : (getHolidayForDate(todayStr) ? 'Holiday' : getAttendanceStatus(checkInTime, officeTime, todayStr, emp.id, attendance, leaveRequests))
        });
      }
    });

    const allLogs = [...activePunchInLogs, ...attendance].filter(log => {
      // If employee is currently punched in, don't display a duplicate Absent or CL log for today
      if ((log.status === 'Absent' || log.status === 'Casual Leave (CL)') && log.date === todayStr && getPunchInTime(log.userId)) {
        return false;
      }
      return true;
    });

    if (activeUser.role === 'admin') {
      return allLogs; // Admin can see everyone
    }
    if (activeUser.role === 'manager') {
      // Manager can see everyone's records EXCEPT Admin's records
      return allLogs.filter(log => log.userId === activeUser.id || log.userRole !== 'admin');
    }
    if (activeUser.role === 'hr') {
      // HR can see their own logs, employee logs, and manager logs for attendance and payroll oversight. Cannot see admin logs.
      return allLogs.filter(log => log.userId === activeUser.id || log.userRole === 'employee' || log.userRole === 'manager');
    }
    // Employees can only see their own attendance record
    return allLogs.filter(log => log.userId === activeUser.id);
  };

  const getFilteredAttendance = () => {
    let logs = getVisibleAttendance();
    const todayStr = getLocalDateString();
    if (attendanceSearch.trim()) {
      const q = attendanceSearch.toLowerCase();
      logs = logs.filter(log => 
        (log.userName || '').toLowerCase().includes(q) || 
        (log.date || '').toLowerCase().includes(q) || 
        (log.userRole || '').toLowerCase().includes(q) ||
        (log.status || '').toLowerCase().includes(q)
      );
    }
    if (attendanceRoleFilter !== 'all') {
      logs = logs.filter(log => log.userRole === attendanceRoleFilter);
    }
    if (attendanceDeptFilter !== 'all') {
      logs = logs.filter(log => {
        const emp = employees.find(e => e.id === log.userId);
        return (emp?.department || '').toLowerCase() === attendanceDeptFilter.toLowerCase();
      });
    }
    if (attendanceStatusFilter !== 'all') {
      logs = logs.filter(log => (log.status || 'On Time').toLowerCase() === attendanceStatusFilter.toLowerCase());
    }
    if (attendanceDateFilter !== 'all') {
      if (attendanceDateFilter === 'today') {
        logs = logs.filter(log => log.date === todayStr);
      } else if (attendanceDateFilter.startsWith('month-')) {
        const monthPrefix = attendanceDateFilter.replace('month-', '');
        logs = logs.filter(log => (log.date || '').startsWith(monthPrefix));
      } else if (attendanceDateFilter === 'custom') {
        if (attendanceCustomDate) {
          logs = logs.filter(log => log.date === attendanceCustomDate);
        }
      } else {
        logs = logs.filter(log => log.date === attendanceDateFilter);
      }
    }
    return sortAttendanceLogs(logs, attendanceSortOrder);
  };

  const handleDeleteAttendanceLog = (logId: string, userId: string) => {
    if (logId.startsWith('ACTIVE-PUNCH-')) {
      setPunchInTimes(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } else {
      setAttendance(prev => prev.filter(item => item.id !== logId));
    }
  };

  // Role-based tasks pipeline visibility
  const getVisibleTasks = () => {
    if (activeUser.role === 'admin') {
      return tasks; // Admin sees all tasks
    }
    if (activeUser.role === 'employee') {
      return tasks.filter(t => t.employeeId === activeUser.id); // Employee sees only tasks assigned to them
    }
    if (activeUser.role === 'hr') {
      // HR sees tasks assigned to employees (role === 'employee') or to themselves
      return tasks.filter(t => {
        if (t.employeeId === activeUser.id) return true;
        const assignee = employees.find(e => e.id === t.employeeId);
        return assignee?.role === 'employee';
      });
    }
    if (activeUser.role === 'manager') {
      // Manager sees all tasks
      return tasks;
    }
    return tasks;
  };

  // Valid tabs list for navigation, role authorization, and custom 404 validation
  const VALID_TABS = [
    'dashboard',
    'directory',
    'status-manager',
    'assign-task',
    'propose-task',
    'departments',
    'leave-requests',
    'attendance-logs',
    'holidays',
    'payroll',
    'my-profile',
    'department-staff',
    'smtp-outbox'
  ];

  // Modals for Compliance, Privacy, Terms, and Cookies
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  // Navigation states per role
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && [
        'dashboard', 'directory', 'status-manager', 'assign-task', 'propose-task',
        'departments', 'leave-requests', 'attendance-logs', 'holidays', 'payroll',
        'my-profile', 'department-staff', 'smtp-outbox'
      ].includes(tabParam)) {
        return tabParam;
      }
    } catch {}
    return sessionStorage.getItem('hrms_active_tab') || 'dashboard';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const selectTab = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem('hrms_active_tab', tab);
    setIsSidebarOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  // Expose selectTab globally for rich email preview link navigation
  useEffect(() => {
    (window as any).__hrmsNavigate = (paramOrTab: string) => {
      const cleanTab = paramOrTab.startsWith('?tab=') ? paramOrTab.replace('?tab=', '') : paramOrTab;
      if (VALID_TABS.includes(cleanTab)) {
        selectTab(cleanTab);
      }
    };
  }, []);

  // Sync activeTab to sessionStorage, URL search query, and handle deep-link modals
  useEffect(() => {
    sessionStorage.setItem('hrms_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const viewParam = params.get('view');
      if (tabParam) {
        if (VALID_TABS.includes(tabParam)) {
          setActiveTab(tabParam);
        } else {
          setActiveTab('404');
        }
      }
      if (viewParam === 'privacy-policy') {
        setIsPrivacyModalOpen(true);
      } else if (viewParam === 'terms' || viewParam === 'terms-and-conditions') {
        setIsTermsModalOpen(true);
      }
    } catch {}
  }, []);

  // Dynamic meta title and audit analytics tracking on navigation
  useEffect(() => {
    const titles: Record<string, string> = {
      dashboard: 'Dashboard | HRMS System - Enterprise Workforce Management',
      directory: 'Staff Directory | HRMS System',
      'status-manager': 'Employee Status Manager | HRMS System',
      'assign-task': 'Task Delegation Pipeline | HRMS System',
      'propose-task': 'Propose Department Tasks | HRMS System',
      departments: 'Departments Directory | HRMS System',
      'leave-requests': 'Leave & Half-Day Requests | HRMS System',
      'attendance-logs': 'Verified Attendance Logs | HRMS System',
      holidays: 'Corporate Calendar & Holidays | HRMS System',
      payroll: 'Payroll & Monthly Salary Reports | HRMS System',
      'my-profile': 'My Employee Profile | HRMS System',
      'department-staff': 'My Department Staff | HRMS System',
      '404': '404 - Page Not Found | HRMS System'
    };
    document.title = titles[activeTab] || 'HRMS System - Enterprise Workforce & Payroll Management';
    trackEvent('page_view', { tab: activeTab, role: activeUser.role });
  }, [activeTab, activeUser.role]);

  // Search & Filters
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  // Modals / Editing states
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editProfileError, setEditProfileError] = useState<string | null>(null);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isProposingTask, setIsProposingTask] = useState(false);
  const [assigningProposal, setAssigningProposal] = useState<TaskProposal | null>(null);
  const [isAssigningDirectly, setIsAssigningDirectly] = useState(false);
  const [showClearAttendanceConfirm, setShowClearAttendanceConfirm] = useState(false);
  const [showWipeAttendanceConfirm, setShowWipeAttendanceConfirm] = useState(false);
  
  // Add Attendance Form State (Admin manual override)
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false);
  const [addAttendanceEmpId, setAddAttendanceEmpId] = useState('');
  const [addAttendanceDate, setAddAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [addAttendanceCheckIn, setAddAttendanceCheckIn] = useState('09:30');
  const [addAttendanceCheckOut, setAddAttendanceCheckOut] = useState('17:00');
  const [addAttendanceStatus, setAddAttendanceStatus] = useState('On Time');

  // New Employee Form State
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'admin' | 'manager' | 'hr' | 'employee'>('employee');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpAddress, setNewEmpAddress] = useState('');
  const [newEmpEmergency, setNewEmpEmergency] = useState('');
  const [newEmpSalary, setNewEmpSalary] = useState('INR 80,000');
  const [newEmpTitle, setNewEmpTitle] = useState('');
  const [newEmpJoinDate, setNewEmpJoinDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newEmpAvatarUrl, setNewEmpAvatarUrl] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('password123');
  const [newEmpStatus, setNewEmpStatus] = useState<EmployeeStatus>('working');

  // Propose Task Form State
  const [propTitle, setPropTitle] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propPriority, setPropPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [propDueDate, setPropDueDate] = useState('');
  const [propEmpId, setPropEmpId] = useState('');

  // HR Assign Form State (from scratch)
  const [directTitle, setDirectTitle] = useState('');
  const [directDesc, setDirectDesc] = useState('');
  const [directPriority, setDirectPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [directDueDate, setDirectDueDate] = useState('');
  const [directEmpId, setDirectEmpId] = useState('');

  const isFirstLoad = useRef(true);

  // Load initial data from SQLite Database engine on mount and keep live synced
  useEffect(() => {
    setDbError(null);
    setLoading(true);
    isFirstLoad.current = false;

    async function loadSQLiteData() {
      try {
        const data = await fetchAllFromSQLite();
        if (data.employees && Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployeesState(ensureStaffOrder(data.employees));
        } else {
          setEmployeesState(INITIAL_EMPLOYEES);
          saveToSQLite('employees', INITIAL_EMPLOYEES, { immediate: true, allowEmpty: false });
        }
        if (data.attendance && Array.isArray(data.attendance)) {
          setAttendanceState(data.attendance);
        }
        if (data.leave_requests && Array.isArray(data.leave_requests)) {
          setLeaveRequestsState(data.leave_requests);
        }
        if (data.tasks && Array.isArray(data.tasks)) {
          setTasksState(data.tasks);
        }
        if (data.proposals && Array.isArray(data.proposals)) {
          setProposalsState(data.proposals);
        }
        if (data.salaries && Array.isArray(data.salaries)) {
          setSalariesState(data.salaries);
        }
        if (data.notifications && Array.isArray(data.notifications)) {
          setNotificationsState(data.notifications);
        }
        if (data.punchInTimes && typeof data.punchInTimes === 'object') {
          setPunchInTimesState(data.punchInTimes);
        }
        if (data.departments && Array.isArray(data.departments) && data.departments.length > 0) {
          setDepartmentsState(data.departments);
        } else {
          setDepartmentsState(INITIAL_DEPARTMENTS);
          saveToSQLite('departments', INITIAL_DEPARTMENTS, { immediate: true, allowEmpty: false });
        }
        if (data.holidays && Array.isArray(data.holidays)) {
          setHolidaysState(data.holidays);
        }
        if (data.officeTime) {
          setOfficeTimeState(data.officeTime);
        }
        if (data.officeEndTime) {
          setOfficeEndTimeState(data.officeEndTime);
        }
        const currentEmployees = (data.employees && Array.isArray(data.employees) && data.employees.length > 0) ? data.employees : employees;
        const savedUserId = sessionStorage.getItem('activeUserId');
        const isLoggedInVal = sessionStorage.getItem('isLoggedIn') === 'true';

        if (isLoggedInVal && savedUserId) {
          const found = currentEmployees.find((e: any) => e.id === savedUserId);
          if (found) {
            if (isEmployeeInactiveOrCompleted(found)) {
              setIsLoggedIn(false);
              sessionStorage.removeItem('isLoggedIn');
              sessionStorage.removeItem('activeUserId');
              sessionStorage.removeItem('activeUser');
            } else {
              setActiveUser(found);
              setIsLoggedIn(true);
            }
          }
        } else if (currentEmployees.length > 0) {
          setActiveUser(prev => {
            if (prev && currentEmployees.some((d: any) => d.id === prev.id)) {
              return currentEmployees.find((d: any) => d.id === prev.id) || currentEmployees[0];
            }
            return currentEmployees[0];
          });
        }
      } catch (err) {
        console.error("Failed to load SQLite database:", err);
      } finally {
        isLoadedRef.current = true;
        setLoading(false);
      }
    }

    let unsubscribe: (() => void) | null = null;

    loadSQLiteData().then(() => {
      // Live Real-Time SQLite Database Sync Subscription
      unsubscribe = subscribeToSQLite((key, data) => {
        // Pause incoming remote sync if local user action occurred in the last 3500ms to avoid overwriting ongoing edits
        if (Date.now() - lastMutationTimeRef.current < 3500) return;

        if (key === 'employees' && Array.isArray(data) && data.length > 0) {
          setEmployeesState(ensureStaffOrder(data));
        } else if (key === 'attendance' && Array.isArray(data)) {
          setAttendanceState(data);
        } else if (key === 'leave_requests' && Array.isArray(data)) {
          setLeaveRequestsState(data);
        } else if (key === 'departments' && Array.isArray(data)) {
          if (data.length > 0) {
            setDepartmentsState(data);
          }
        } else if (key === 'holidays' && Array.isArray(data)) {
          if (data.length > 0) {
            setHolidaysState(data);
          }
        } else if (key === 'tasks' && Array.isArray(data)) {
          setTasksState(data);
        } else if (key === 'proposals' && Array.isArray(data)) {
          setProposalsState(data);
        } else if (key === 'salaries' && Array.isArray(data)) {
          setSalariesState(data);
        } else if (key === 'notifications' && Array.isArray(data)) {
          setNotificationsState(data);
        } else if (key === 'officeTime' && typeof data === 'string') {
          setOfficeTimeState(data);
        } else if (key === 'officeEndTime' && typeof data === 'string') {
          setOfficeEndTimeState(data);
        } else if (key === 'punchInTimes' && typeof data === 'object' && data !== null) {
          setPunchInTimesState(data);
        }
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Reload database from SQLite Database Engine
  const handleReloadSQLiteDatabase = async () => {
    setLoading(true);
    try {
      const data = await fetchAllFromSQLite();
      if (data.employees && Array.isArray(data.employees)) setEmployeesState(ensureStaffOrder(data.employees));
      if (data.attendance && Array.isArray(data.attendance)) setAttendanceState(data.attendance);
      if (data.leave_requests && Array.isArray(data.leave_requests)) setLeaveRequestsState(data.leave_requests);
      if (data.departments && Array.isArray(data.departments)) setDepartmentsState(data.departments);
      if (data.holidays && Array.isArray(data.holidays)) setHolidaysState(data.holidays);
      if (data.tasks && Array.isArray(data.tasks)) setTasksState(data.tasks);
      if (data.proposals && Array.isArray(data.proposals)) setProposalsState(data.proposals);
      if (data.salaries && Array.isArray(data.salaries)) setSalariesState(data.salaries);
      triggerSyncNotification();
    } catch (e) {
      console.error("Failed to reload SQLite DB:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) return;

        const parsedState = parseExcelToState(buffer);
        if (!parsedState || !parsedState.employees || parsedState.employees.length === 0) {
          alert("Could not parse valid HRMS sheets in this Excel file. Please ensure you are importing a file generated by this system.");
          return;
        }

        if (confirm(`Excel parsed successfully!\nFound ${parsedState.employees?.length || 0} Employees, ${parsedState.tasks?.length || 0} Tasks, ${parsedState.attendance?.length || 0} Attendance records.\n\nDo you want to overwrite your current system data with this Excel file?`)) {
          setEmployees(parsedState.employees || []);
          setProposals(parsedState.proposals || []);
          setTasks(parsedState.tasks || []);
          setAttendance(parsedState.attendance || []);
          setDepartments(parsedState.departments || []);
          setLeaveRequests(parsedState.leaveRequests || []);
          setSalaries(parsedState.salaries || []);
          setHolidays(parsedState.holidays || []);
          if (parsedState.settings) {
            setOfficeTime(parsedState.settings.officeTime || '09:30 AM');
            setOfficeEndTime(parsedState.settings.officeEndTime || '05:00 PM');
            setPunchInTimes(parsedState.settings.punchInTimes || {});
          }
          alert("Database successfully restored from Excel!");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      alert("An error occurred while importing the Excel file.");
    }
  };

  const handleJSONBackupExport = () => {
    try {
      const dbDump = {
        employees,
        proposals,
        tasks,
        attendance,
        departments,
        leaveRequests,
        salaries,
        holidays,
        settings: {
          officeTime,
          officeEndTime,
          punchInTimes
        },
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(dbDump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hrms_database_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerSyncNotification();
    } catch (err) {
      console.error("Failed to export JSON backup:", err);
      alert("Failed to export JSON backup.");
    }
  };

  const handleJSONBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || !parsed.employees || !Array.isArray(parsed.employees)) {
          alert("Invalid backup file structure. Ensure it is a valid backup JSON file exported from this system.");
          return;
        }

        if (confirm(`JSON Backup parsed successfully!\nExported At: ${parsed.exportedAt || 'Unknown'}\nFound ${parsed.employees.length} Employees, ${parsed.tasks?.length || 0} Tasks.\n\nDo you want to restore the entire database from this backup?`)) {
          setEmployees(parsed.employees);
          setProposals(parsed.proposals || []);
          setTasks(parsed.tasks || []);
          setAttendance(parsed.attendance || []);
          setDepartments(parsed.departments || []);
          setLeaveRequests(parsed.leaveRequests || []);
          setSalaries(parsed.salaries || []);
          setHolidays(parsed.holidays || []);
          if (parsed.settings) {
            setOfficeTime(parsed.settings.officeTime || '09:30 AM');
            setOfficeEndTime(parsed.settings.officeEndTime || '05:00 PM');
            setPunchInTimes(parsed.settings.punchInTimes || {});
          }
          alert("Database successfully restored from JSON backup file!");
          triggerSyncNotification();
        }
      } catch (err) {
        console.error("Error importing JSON backup:", err);
        alert("Could not parse JSON backup. Please make sure the file is valid.");
      }
    };
    reader.readAsText(file);
  };

  const handlePurgeAndRebuildDatabase = async () => {
    if (confirm("⚠️ PERMANENT DATABASE RESET ⚠️\n\nAre you sure you want to PERMANENTLY RESET the SQLite database to initial default staff records?")) {
      setLoading(true);
      try {
        await resetSQLiteDB();
        const data = await fetchAllFromSQLite();
        if (data.employees) setEmployeesState(ensureStaffOrder(data.employees));
        if (data.attendance) setAttendanceState(data.attendance);
        if (data.leave_requests) setLeaveRequestsState(data.leave_requests);
        if (data.departments) setDepartmentsState(data.departments);
        if (data.holidays) setHolidaysState(data.holidays);
        if (data.tasks) setTasksState(data.tasks);
        if (data.proposals) setProposalsState(data.proposals);
        if (data.salaries) setSalariesState(data.salaries);
        if (data.officeTime) setOfficeTimeState(data.officeTime);
        if (data.officeEndTime) setOfficeEndTimeState(data.officeEndTime);
        if (data.punchInTimes) setPunchInTimesState(data.punchInTimes);

        alert("✅ SQLite Database successfully reset with default staff and department profiles.");
      } catch (err) {
        console.error(err);
        alert("Failed to reset database: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetDriveConnection = async () => {
    setLoading(true);
    sessionStorage.clear();
    window.location.reload();
  };

  const handleClearAndReauthorize = async () => {
    setLoading(true);
    sessionStorage.clear();
    window.location.reload();
  };

  // Live Timer Update
  useEffect(() => {
    sessionStorage.setItem('hrms_time_offset', timeOffset.toString());
    setCurrentTime(new Date(Date.now() + timeOffset));
    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeOffset]);

  const formatTimeStr = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateStr = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  };

  const activePunchTime = getPunchInTime(activeUser.id);
  const isPunchedIn = !!activePunchTime;

  // Punch Action (Mandatory Daily Punch In / Punch Out for Employees, HR, and Managers)
  const handlePunchToggle = async () => {
    if (activeUser.role === 'admin') return;

    // Spam Protection: Rate limit punch toggles
    const rateCheck = checkRateLimit(`punch_${activeUser.id}`, 5, 20000);
    if (!rateCheck.allowed) {
      alert(rateCheck.message);
      return;
    }

    const now = new Date();
    const timeString = format12HourTime(now);
    const dateString = getLocalDateString();

    if (!isPunchedIn) {
      // Punching In
      if (getHolidayForDate(dateString)) {
        return; // Prevent accidental punch in on holiday
      }
      trackEvent('attendance_punch_in', { userId: activeUser.id, role: activeUser.role, time: timeString });
      const punchStatus = getAttendanceStatus(timeString, officeTime, dateString, activeUser.id, attendance, leaveRequests);
      // Immediately register the active attendance record in permanent storage
      const activeLog: AttendanceLog = {
        id: `ATT-${activeUser.id}-${dateString}`,
        userId: activeUser.id,
        userName: activeUser.name || 'Unknown Employee',
        userRole: activeUser.role || 'employee',
        date: dateString,
        checkIn: timeString,
        checkOut: '---',
        duration: 'Active',
        status: punchStatus
      };

      const nextAttendance = [activeLog, ...attendance.filter(log => !(log.userId === activeUser.id && log.date === dateString))];
      const nextPunches = {
        ...punchInTimes,
        [activeUser.id]: { time: timeString, date: dateString } as any
      };

      setAttendance(nextAttendance, { immediate: true });
      setPunchInTimes(nextPunches, { immediate: true });

      // Instantly flush to SQLite Database
      try {
        await flushPendingWrites();
      } catch (err) {
        console.warn('Instant punch-in SQLite sync warning:', err);
      }
    } else {
      // Punching Out
      const checkInTime = activePunchTime || '09:30 AM';
      // Compute accurate duration
      const duration = calculateDurationStr(checkInTime, timeString, dateString);
      const status = getAttendanceStatus(checkInTime, officeTime, dateString, activeUser.id, attendance, leaveRequests, timeString);

      const existingIdx = attendance.findIndex(log => log.userId === activeUser.id && log.date === dateString);
      const finishedLog: AttendanceLog = {
        id: existingIdx >= 0 ? attendance[existingIdx].id : `ATT-${activeUser.id}-${dateString}`,
        userId: activeUser.id,
        userName: activeUser.name || 'Unknown Employee',
        userRole: activeUser.role || 'employee',
        date: dateString,
        checkIn: checkInTime,
        checkOut: timeString,
        duration: duration,
        status: status
      };

      let nextAttendance: AttendanceLog[];
      if (existingIdx >= 0) {
        nextAttendance = [...attendance];
        nextAttendance[existingIdx] = finishedLog;
      } else {
        nextAttendance = [finishedLog, ...attendance];
      }

      const nextPunches = { ...punchInTimes };
      delete nextPunches[activeUser.id];

      setAttendance(nextAttendance, { immediate: true });
      setPunchInTimes(nextPunches, { immediate: true });

      // Instantly flush to SQLite Database
      try {
        await flushPendingWrites();
      } catch (err) {
        console.warn('Instant punch-out SQLite sync warning:', err);
      }
      trackEvent('attendance_punch_out', { userId: activeUser.id, role: activeUser.role, time: timeString, duration });
    }
  };

  // Automated Daily Attendance Auto-Fill for past days
  const hasAutoFilled = useRef(false);

  const autoFillAttendance = (
    _currentEmployees: Employee[],
    _currentAttendance: AttendanceLog[],
    _currentHolidays: Holiday[]
  ) => {
    // Disabled automatic attendance filling per user request.
    // Attendance is ONLY recorded when an employee manually Punches In / Punches Out.
    return;
  };

  useEffect(() => {
    if (!isLoadedRef.current) return;
    // Clean up any previously auto-generated absent records from state & storage
    setAttendance(prev => {
      const hasAutoAbs = prev.some(log => log.id.startsWith('AUTO-ABS-'));
      if (hasAutoAbs) {
        return prev.filter(log => !log.id.startsWith('AUTO-ABS-'));
      }
      return prev;
    });
  }, [loading]);

  // Synchronize attendance logs when leave requests change (e.g. replacing 'Absent' logs with 'On Leave')
  useEffect(() => {
    if (loading || !isLoadedRef.current || employees.length === 0) return;
    
    setAttendance(prev => {
      let hasChanges = false;
      const updated = prev.map(log => {
        if (log.status === 'Absent') {
          const leaveReq = getLeaveForDateAndEmployee(log.userId, log.date);
          if (leaveReq) {
            hasChanges = true;
            return {
              ...log,
              status: 'On Leave' as const
            };
          }
        }
        if (log.status === 'On Leave') {
          const leaveReq = getLeaveForDateAndEmployee(log.userId, log.date);
          if (!leaveReq) {
            hasChanges = true;
            return {
              ...log,
              status: 'Absent' as const
            };
          }
        }
        return log;
      });
      return hasChanges ? updated : prev;
    });
  }, [leaveRequests, loading, employees]);

  // Auto-cleanup stale punch-ins from previous days by converting them to permanent completed logs
  useEffect(() => {
    if (loading || !isLoadedRef.current) return;
    const todayStr = getLocalDateString();
    let hasStale = false;
    const cleaned = { ...punchInTimes };

    Object.entries(punchInTimes).forEach(([empId, val]) => {
      if (!val) return;
      if (typeof val === 'object' && val !== null) {
        const punchDate = (val as any).date;
        if (punchDate && punchDate !== todayStr) {
          const punchTime = (val as any).time || '09:30 AM';
          const defaultOut = officeEndTime || '05:00 PM';
          const dur = calculateDurationStr(punchTime, defaultOut, punchDate);
          const stat = getAttendanceStatus(punchTime, officeTime, punchDate, empId, attendance, leaveRequests, defaultOut);
          const emp = employees.find(e => e.id === empId);

          setAttendance(prev => {
            if (prev.some(l => l.userId === empId && l.date === punchDate)) return prev;
            return [{
              id: `ATT-${empId}-${punchDate}`,
              userId: empId,
              userName: emp?.name || 'Unknown Employee',
              userRole: emp?.role || 'employee',
              date: punchDate,
              checkIn: punchTime,
              checkOut: defaultOut,
              duration: dur,
              status: stat
            }, ...prev];
          });

          delete cleaned[empId];
          hasStale = true;
        }
      }
    });

    if (hasStale) {
      setPunchInTimes(cleaned);
    }
  }, [loading, employees]);

  const handleUserSwitch = async (userId: string) => {
    const found = employees.find(e => e.id === userId);
    if (found) {
      if (isEmployeeInactiveOrCompleted(found)) {
        const norm = normalizeEmployeeStatus(found.status);
        const statusLabel = norm === 'internship completed' ? 'Internship Completed' : 'Not Working';
        alert(`Access Denied: Account "${found.name}" is marked as ${statusLabel}. Login is disabled; employee details are available in the directory for administrative review only.`);
        return;
      }
      if (activeUser.role === 'manager' && found.role === 'admin') {
        alert("Access Denied: Managers cannot supervise Admin dashboard.");
        return;
      }
      setActiveUser(found);
      sessionStorage.setItem('activeUserId', found.id);
      sessionStorage.setItem('activeUser', JSON.stringify(found));
      setActiveTab('dashboard');
    }
  };

  // Add Employee Handler
  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail) return;

    // Spam Protection: Rate limit employee additions
    const rateCheck = checkRateLimit('add_employee', 10, 60000);
    if (!rateCheck.allowed) {
      alert(rateCheck.message);
      return;
    }

    // Validate Gmail Format
    if (!newEmpEmail.toLowerCase().endsWith('@gmail.com')) {
      alert("Please enter a valid Gmail address (ending with @gmail.com).");
      return;
    }

    // Validate Indian Phone Format if provided
    const cleanPhone = newEmpPhone.replace(/\D/g, '');
    if (newEmpPhone.trim() && cleanPhone.length < 10) {
      alert("Please enter a valid 10-digit Indian mobile number or leave blank.");
      return;
    }

    const customId = newEmpId.trim().toUpperCase() || `EMP-${String(employees.length + 1).padStart(3, '0')}`;
    if (employees.some(emp => emp.id === customId)) {
      alert("Employee ID already exists. Please enter a unique ID.");
      return;
    }

    if (isExcludedStaff({ name: newEmpName, email: newEmpEmail, id: customId })) {
      alert("Cannot add employee with these credentials.");
      return;
    }

    const colors = [
      'bg-indigo-600 text-white',
      'bg-emerald-600 text-white',
      'bg-pink-600 text-white',
      'bg-blue-600 text-white',
      'bg-amber-600 text-white',
      'bg-purple-600 text-white',
      'bg-teal-600 text-white'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newEmp: Employee = {
      id: customId,
      name: newEmpName.trim(),
      email: newEmpEmail.trim(),
      role: newEmpRole,
      department: newEmpDept,
      phone: newEmpPhone.trim() ? formatIndianPhone(newEmpPhone) : '',
      address: newEmpAddress.trim() || 'Not Provided',
      emergencyContact: newEmpEmergency.trim() || '',
      salary: formatINR(newEmpSalary || 'INR 60,000'),
      joinDate: newEmpJoinDate || new Date().toISOString().split('T')[0],
      avatarColor: randomColor,
      avatarUrl: newEmpAvatarUrl.trim() || '',
      status: newEmpStatus,
      jobTitle: newEmpTitle.trim() || `${newEmpDept} Associate`,
      password: newEmpPassword || 'password123'
    };

    setEmployees(prev => {
      const existing = prev.filter(e => e.id !== newEmp.id && !isExcludedStaff(e));
      // STRICT REQUIREMENT: Newly added employee goes on last, never on 1 in staff directory
      return [...existing, newEmp];
    });

    setAssignSuccessToast(`✓ New staff profile ${newEmp.name} (${newEmp.id}) added to staff directory at the end (Position #${employees.length + 1}).`);
    setTimeout(() => setAssignSuccessToast(null), 4500);

    // Ensure department exists in departments list if not present
    if (newEmpDept && !departments.some(d => d.name.toLowerCase() === newEmpDept.toLowerCase())) {
      const nextDeptId = `DEPT-0${departments.length + 1}`;
      setDepartments(prev => [...prev, {
        id: nextDeptId,
        name: newEmpDept,
        managerName: 'Not Assigned',
      }]);
    }

    trackEvent('add_employee', { employeeId: newEmp.id, role: newEmp.role, department: newEmp.department });
    setIsAddingEmployee(false);

    // Reset Form Fields
    setNewEmpId('');
    setNewEmpName('');
    setNewEmpEmail('');
    setNewEmpRole('employee');
    setNewEmpDept('Engineering');
    setNewEmpPhone('');
    setNewEmpAddress('');
    setNewEmpEmergency('');
    setNewEmpSalary('INR 80,000');
    setNewEmpTitle('');
    setNewEmpJoinDate(new Date().toISOString().split('T')[0]);
    setNewEmpAvatarUrl('');
    setNewEmpPassword('password123');
  };

  // Edit Employee Handler (HR, Admin, and Manager can all edit employee profiles depending on permissions)
  const handleUpdateEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    // Validate email format
    const email = (editingEmployee.email || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEditProfileError("Please enter a valid email address (e.g. name@gmail.com).");
      return;
    }

    // Validate mobile number (at least 10 digits if provided)
    const cleanPhone = (editingEmployee.phone || '').replace(/\D/g, '');
    if (cleanPhone.length > 0 && cleanPhone.length < 10) {
      setEditProfileError("Please enter a valid 10-digit mobile number.");
      return;
    }

    // Format salary to INR and phone to Indian format
    const formattedSalary = formatINR(editingEmployee.salary || '35000');
    const formattedPhone = cleanPhone.length >= 10 ? formatIndianPhone(editingEmployee.phone) : (editingEmployee.phone ? editingEmployee.phone.trim() : '');
    const updatedEmployee = {
      ...editingEmployee,
      email,
      phone: formattedPhone,
      emergencyContact: editingEmployee.emergencyContact ? editingEmployee.emergencyContact.trim() : '',
      salary: formattedSalary,
    };

    // Check if ID was changed
    if (updatedEmployee.id !== editingEmployeeOriginalId) {
      // Validate unique ID
      if (employees.some(emp => emp.id === updatedEmployee.id && emp.id !== editingEmployeeOriginalId)) {
        setEditProfileError("This Employee ID is already taken. Please use a unique Employee ID.");
        return;
      }

      // Re-map punch in times for changed ID
      setPunchInTimes(prev => {
        const copy = { ...prev };
        if (copy[editingEmployeeOriginalId]) {
          copy[updatedEmployee.id] = copy[editingEmployeeOriginalId];
          delete copy[editingEmployeeOriginalId];
        }
        return copy;
      });
    }

    // Always perform cascading updates to maintain state consistency everywhere
    setAttendance(prev => prev.map(log => 
      (log.userId === editingEmployeeOriginalId || log.userId === updatedEmployee.id) 
        ? { ...log, userId: updatedEmployee.id, userName: updatedEmployee.name, userRole: updatedEmployee.role } 
        : log
    ));

    setProposals(prev => prev.map(prop => {
      const updated = { ...prop };
      if (prop.proposedEmployeeId === editingEmployeeOriginalId) updated.proposedEmployeeId = updatedEmployee.id;
      if (prop.managerId === editingEmployeeOriginalId) updated.managerId = updatedEmployee.id;
      return updated;
    }));

    setTasks(prev => prev.map(task => {
      const updated = { ...task };
      if (task.employeeId === editingEmployeeOriginalId || task.employeeId === updatedEmployee.id) {
        updated.employeeId = updatedEmployee.id;
        updated.employeeName = updatedEmployee.name;
      }
      return updated;
    }));

    setLeaveRequests(prev => prev.map(req => 
      (req.employeeId === editingEmployeeOriginalId || req.employeeId === updatedEmployee.id)
        ? { ...req, employeeId: updatedEmployee.id, employeeName: updatedEmployee.name }
        : req
    ));

    // Update active user state if the current logged-in user was updated
    if (activeUser.id === editingEmployeeOriginalId || activeUser.id === updatedEmployee.id) {
      setActiveUser(updatedEmployee);
      sessionStorage.setItem('activeUser', JSON.stringify(updatedEmployee));
      sessionStorage.setItem('activeUserId', updatedEmployee.id);
    }

    // Auto-create department if updated employee belongs to a new department
    if (updatedEmployee.department && !departments.some(d => d.name.toLowerCase() === updatedEmployee.department.toLowerCase())) {
      const nextDeptId = `DEPT-0${departments.length + 1}`;
      setDepartments(prev => [...prev, {
        id: nextDeptId,
        name: updatedEmployee.department,
        managerName: 'Not Assigned',
        description: `${updatedEmployee.department} Department`
      }]);
    }

    // Cascadingly update or recalculate salaries to reflect employee edits (ID, Name, Role, Base Salary)
    setSalaries(prev => prev.map(sal => {
      if (sal.employeeId === editingEmployeeOriginalId || sal.employeeId === updatedEmployee.id) {
        // Re-calculate based on updated employee configurations
        const calculated = calculateMonthlySalary(updatedEmployee, sal.month, attendance, leaveRequests, holidays);
        return {
          ...calculated,
          id: sal.id, // preserve database ID
          employeeId: updatedEmployee.id,
          employeeName: updatedEmployee.name,
          employeeRole: updatedEmployee.role,
          status: sal.status,
          paymentDate: sal.paymentDate,
          customBonus: (sal as any).customBonus || 0,
          customBonusReason: (sal as any).customBonusReason || '',
          customDeduction: (sal as any).customDeduction || 0,
          customDeductionReason: (sal as any).customDeductionReason || '',
          netSalary: Math.max(0, calculated.netSalary + ((sal as any).customBonus || 0) - ((sal as any).customDeduction || 0))
        };
      }
      return sal;
    }));

    setEmployees(prev =>
      prev.map(emp => (emp.id === editingEmployeeOriginalId ? updatedEmployee : emp))
    );
    setEditProfileError(null);
    setEditingEmployee(null);
    setAssignSuccessToast(`✓ Successfully saved profile changes for ${updatedEmployee.name} (${updatedEmployee.id})!`);
    setTimeout(() => setAssignSuccessToast(null), 4000);
  };

  // Propose Task (Manager to HR details) or Direct Task Assignment
  const handleProposeTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propTitle || !propDesc || !propEmpId) return;

    const emp = employees.find(e => e.id === propEmpId);
    if (!emp) return;

    // Admin, HR, or Manager assigning directly to staff
    const isDirectAssign = activeUser.role === 'admin' || activeUser.role === 'hr' || (activeUser.role === 'manager' && (emp.role === 'employee' || emp.role === 'hr'));

    if (isDirectAssign) {
      const newTask: AssignedTask = {
        id: `TASK-${Date.now()}`,
        title: propTitle,
        description: propDesc,
        priority: propPriority,
        dueDate: propDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        employeeId: propEmpId,
        employeeName: emp.name,
        assignedBy: `${activeUser.name} (${activeUser.role.toUpperCase()})`,
        status: 'pending'
      };
      setTasks(prev => [newTask, ...prev]);

      // Create notification alert for employee
      const notif: UserNotification = {
        id: `NOTIF-${Date.now()}`,
        userId: propEmpId,
        title: 'New Task Assigned 📋',
        message: `You have been assigned task "${newTask.title}" by ${activeUser.name} (${activeUser.role.toUpperCase()}). Priority: ${newTask.priority.toUpperCase()}, Due: ${newTask.dueDate}.`,
        type: 'task_assigned',
        createdAt: new Date().toISOString(),
        read: false,
        taskId: newTask.id,
        assignedBy: activeUser.name
      };
      setNotifications(prev => [notif, ...prev]);

      // Trigger Mock SMTP email notification service layer
      mailService.sendTaskAssignmentEmail({
        task: newTask,
        recipient: emp,
        assignedBy: `${activeUser.name} (${activeUser.role.toUpperCase()})`
      }).catch(err => console.warn('Mock SMTP send error:', err));

      setAssignSuccessToast(`Task "${newTask.title}" assigned to ${emp.name}! Simulated SMTP email sent to ${emp.email} (smtp.hrms.internal:587) ✉️`);
      setTimeout(() => setAssignSuccessToast(null), 5000);
    } else {
      const newProposal: TaskProposal = {
        id: `PROP-${Date.now()}`,
        title: propTitle,
        description: propDesc,
        priority: propPriority,
        dueDate: propDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        proposedEmployeeId: propEmpId,
        managerId: activeUser.id,
        managerName: activeUser.name,
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0]
      };
      setProposals(prev => [newProposal, ...prev]);
    }

    setIsProposingTask(false);

    // Reset
    setPropTitle('');
    setPropDesc('');
    setPropPriority('medium');
    setPropDueDate('');
    setPropEmpId('');
  };

  // HR assigns Manager-proposed Task
  const handleAssignProposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningProposal) return;

    const emp = employees.find(emp => emp.id === assigningProposal.proposedEmployeeId);
    const empName = emp ? emp.name : 'Unknown Employee';

    const newTask: AssignedTask = {
      id: `TASK-${Date.now()}`,
      proposalId: assigningProposal.id,
      title: assigningProposal.title,
      description: assigningProposal.description,
      priority: assigningProposal.priority,
      dueDate: assigningProposal.dueDate,
      employeeId: assigningProposal.proposedEmployeeId,
      employeeName: empName,
      assignedBy: activeUser.name, // The logged in HR user
      status: 'pending'
    };

    // Add to formal tasks, mark proposal as assigned
    setTasks(prev => [newTask, ...prev]);
    setProposals(prev =>
      prev.map(p => (p.id === assigningProposal.id ? { ...p, status: 'assigned' as const } : p))
    );

    // Create notification alert for employee
    const notif: UserNotification = {
      id: `NOTIF-${Date.now()}`,
      userId: assigningProposal.proposedEmployeeId,
      title: 'New Task Assigned 📋',
      message: `You have been assigned task "${newTask.title}" by ${activeUser.name} (${activeUser.role.toUpperCase()}). Priority: ${newTask.priority.toUpperCase()}, Due: ${newTask.dueDate}.`,
      type: 'task_assigned',
      createdAt: new Date().toISOString(),
      read: false,
      taskId: newTask.id,
      assignedBy: activeUser.name
    };
    setNotifications(prev => [notif, ...prev]);

    // Trigger Mock SMTP email notification service layer
    if (emp) {
      mailService.sendTaskAssignmentEmail({
        task: newTask,
        recipient: emp,
        assignedBy: `${activeUser.name} (${activeUser.role.toUpperCase()})`
      }).catch(err => console.warn('Mock SMTP send error:', err));
    }

    setAssignSuccessToast(`Task "${newTask.title}" assigned to ${empName}! Simulated SMTP email sent to ${emp?.email} (smtp.hrms.internal:587) ✉️`);
    setTimeout(() => setAssignSuccessToast(null), 5000);

    setAssigningProposal(null);
  };

  // HR assigns Task directly from scratch - initially proposed to Managers first
  const handleDirectAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTitle || !directDesc || !directEmpId) return;

    const emp = employees.find(e => e.id === directEmpId);
    if (!emp) return;

    // Find the department manager to approve this task
    let managerId = '';
    let managerName = 'Department Manager';

    if (emp.role === 'manager' || emp.role === 'admin') {
      const adminUser = employees.find(e => e.role === 'admin');
      managerId = adminUser ? adminUser.id : '';
      managerName = adminUser ? adminUser.name : 'System Administrator';
    } else {
      const deptManager = employees.find(e => e.role === 'manager' && e.department === emp.department);
      if (deptManager) {
        managerId = deptManager.id;
        managerName = deptManager.name;
      } else {
        const adminUser = employees.find(e => e.role === 'admin');
        managerId = adminUser ? adminUser.id : '';
        managerName = adminUser ? adminUser.name : 'System Administrator';
      }
    }

    const newProposal: TaskProposal = {
      id: `PROP-${Date.now()}`,
      title: directTitle,
      description: directDesc,
      priority: directPriority,
      dueDate: directDueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      proposedEmployeeId: directEmpId,
      managerId: managerId,
      managerName: managerName,
      status: 'manager_pending',
      createdAt: new Date().toISOString().split('T')[0],
      proposedByHR: true
    };

    setProposals(prev => [newProposal, ...prev]);
    setIsAssigningDirectly(false);

    // Reset
    setDirectTitle('');
    setDirectDesc('');
    setDirectPriority('medium');
    setDirectDueDate('');
    setDirectEmpId('');
  };

  // Manager approves HR-proposed task
  const handleManagerApproveProposal = (proposalId: string) => {
    setProposals(prev =>
      prev.map(p =>
        p.id === proposalId
          ? { ...p, status: 'approved_by_manager' as const }
          : p
      )
    );
  };

  // Employee update task status
  const handleUpdateTaskStatus = (taskId: string, newStatus: 'pending' | 'in-progress' | 'completed') => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completedAt: newStatus === 'completed' 
                ? `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` 
                : undefined
            }
          : t
      )
    );
  };

  // Add manual attendance (Admin override helper)
  const handleAddAttendanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addAttendanceEmpId || !addAttendanceDate) return;

    const emp = employees.find(empItem => empItem.id === addAttendanceEmpId);
    if (!emp) return;

    const isAbsentOrLeave = ['Absent', 'On Leave', 'Casual Leave (CL)', 'Sunday Off', 'Holiday'].includes(addAttendanceStatus);
    const checkInStr = isAbsentOrLeave ? '---' : convertTo12Hour(addAttendanceCheckIn);
    const checkOutStr = isAbsentOrLeave ? '---' : convertTo12Hour(addAttendanceCheckOut);
    const duration = isAbsentOrLeave ? '0h 00m' : calculateDurationStr(checkInStr, checkOutStr, addAttendanceDate);

    let finalStatus: AttendanceLog['status'];
    if (addAttendanceStatus === 'Auto Calculate') {
      if (isAbsentOrLeave || checkInStr === '---') {
        finalStatus = resolveUnpunchedStatus(emp.id, addAttendanceDate, attendance, leaveRequests);
      } else {
        finalStatus = getAttendanceStatus(checkInStr, officeTime, addAttendanceDate, emp.id, attendance, leaveRequests, checkOutStr);
      }
    } else {
      finalStatus = addAttendanceStatus as AttendanceLog['status'];
    }

    const newLog: AttendanceLog = {
      id: `ATT-${Date.now()}`,
      userId: emp.id,
      userName: emp.name || 'Unknown Employee',
      userRole: emp.role || 'employee',
      date: addAttendanceDate,
      checkIn: checkInStr,
      checkOut: checkOutStr,
      duration: duration,
      status: finalStatus
    };

    setAttendance(prev => [newLog, ...prev]);
    setShowAddAttendanceModal(false);
    
    // Reset form
    setAddAttendanceEmpId('');
    setAddAttendanceDate(new Date().toISOString().split('T')[0]);
    setAddAttendanceCheckIn('09:30');
    setAddAttendanceCheckOut('17:00');
    setAddAttendanceStatus('On Time');
  };

  // Delete employee (Admin only helper)
  const handleDeleteEmployee = (empId: string) => {
    setEmployees(prev => prev.filter(e => e.id !== empId));
    setSalaries(prev => prev.filter(s => s.employeeId !== empId));
    setAttendance(prev => prev.filter(a => a.userId !== empId));
    setLeaveRequests(prev => prev.filter(l => l.employeeId !== empId));
    setTasks(prev => prev.filter(t => t.employeeId !== empId));
  };

  // Helper lists & filtered data
  const deptNames = ['All', ...departments.map(d => d.name)];
  
  const filteredEmployees = employees.filter(emp => {
    // Strictly filter out any excluded staff (e.g. Vishal Paswan)
    if (isExcludedStaff(emp)) return false;

    // If logged-in user is HR, show only HRs and Employees profiles (not Manager or Admin)
    if (activeUser.role === 'hr') {
      if (emp.role === 'manager' || emp.role === 'admin') {
        return false;
      }
    }
    const matchSearch = (emp.name || '').toLowerCase().includes((employeeSearch || '').toLowerCase()) ||
                        (emp.email || '').toLowerCase().includes((employeeSearch || '').toLowerCase()) ||
                        (emp.jobTitle || '').toLowerCase().includes((employeeSearch || '').toLowerCase()) ||
                        (emp.id || '').toLowerCase().includes((employeeSearch || '').toLowerCase());
    const matchDept = deptFilter === 'All' ? true : emp.department === deptFilter;
    return matchSearch && matchDept;
  });

  if (dbError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans animate-fade-in">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-950/50 border border-amber-700/60 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl text-amber-500">⚠️</span>
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight uppercase">
            SQLite Database Issue
          </h2>
          <p className="text-slate-400 text-xs mt-3 leading-relaxed">
            We encountered a connection or reading error trying to access the local SQLite database.
          </p>

          <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 text-left overflow-auto max-h-32">
            <p className="text-[11px] font-mono text-amber-400/90 break-all leading-normal">{dbError}</p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              id="btn-retry-db"
              onClick={() => {
                setDbError(null);
                window.location.reload();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition duration-150 shadow-lg text-sm cursor-pointer"
            >
              Retry Connection
            </button>
            <button
              id="btn-local-fallback"
              onClick={handleReloadSQLiteDatabase}
              className="w-full bg-slate-800/20 hover:bg-slate-800/40 text-slate-400 border border-slate-800 font-semibold py-2 px-4 rounded-xl transition duration-150 text-xs cursor-pointer"
            >
              Launch Offline Sandbox Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <h2 className="text-lg font-black mt-6 tracking-tight text-slate-100 uppercase">Connecting to SQL Database</h2>
        <p className="text-indigo-400 text-xs mt-2 font-mono tracking-wider font-semibold uppercase">Loading SQLite Tables (hrms.db)...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    const performLoginForUser = (user: Employee) => {
      if (isEmployeeInactiveOrCompleted(user)) {
        const norm = normalizeEmployeeStatus(user.status);
        const statusLabel = norm === 'internship completed' ? 'Internship Completed' : 'Not Working';
        setLoginError(`Access Denied: Login is disabled for account "${user.name}" (${statusLabel}). Employee details remain available in the directory for administrative review only.`);
        return;
      }
      setActiveUser(user);
      sessionStorage.setItem('activeUserId', user.id);
      sessionStorage.setItem('activeUser', JSON.stringify(user));
      setIsLoggedIn(true);
      sessionStorage.setItem('isLoggedIn', 'true');
      setActiveTab('dashboard'); // Automatically open Overview Dashboard
      setLoginEmailOrId('');
      setLoginPassword('');
      setLoginError('');
    };

    const handleLoginSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const rawInput = loginEmailOrId.trim();
      if (!rawInput) {
        setLoginError('Please enter your Username, Employee ID, or Email.');
        return;
      }

      const input = rawInput.toLowerCase();
      const inputClean = input.replace(/[-\s_.]/g, '');

      // 1. Match by Employee ID (exact or stripped)
      let found = employees.find(emp => {
        const empId = emp.id.toLowerCase();
        const empIdClean = empId.replace(/[-\s_.]/g, '');
        return empId === input || empIdClean === inputClean;
      });

      // 2. Match by Email Address or Email Prefix (username before @)
      if (!found) {
        found = employees.find(emp => {
          const empEmail = emp.email.toLowerCase();
          const emailPrefix = empEmail.split('@')[0];
          return empEmail === input || emailPrefix === input;
        });
      }

      // 3. Match by Name (full name, first name, or clean name)
      if (!found) {
        found = employees.find(emp => {
          const empName = emp.name.toLowerCase();
          const empNameClean = empName.replace(/[-\s_.]/g, '');
          const firstName = empName.split(' ')[0];
          return empName === input || empNameClean === inputClean || firstName === input;
        });
      }

      // 4. Match by Mobile / Phone Number (exact digits or suffix match)
      if (!found) {
        const inputDigits = rawInput.replace(/\D/g, '');
        if (inputDigits.length >= 10) {
          found = employees.find(emp => {
            if (!emp.phone) return false;
            const empDigits = emp.phone.replace(/\D/g, '');
            return empDigits === inputDigits || empDigits.endsWith(inputDigits) || inputDigits.endsWith(empDigits);
          });
        }
      }

      // 4. Role aliases: "admin", "superadmin", "administrator"
      if (!found && (input === 'admin' || input === 'superadmin' || inputClean === 'superadmin' || input === 'administrator')) {
        found = employees.find(emp => emp.role === 'admin') || employees[0];
      }

      // 5. Role aliases: "manager", "operations", "ops"
      if (!found && (input === 'manager' || input === 'ops' || inputClean === 'operations' || input === 'testmanager')) {
        found = employees.find(emp => emp.role === 'manager') || employees[1];
      }

      // 6. Role aliases: "hr", "hrmanager", "humanresources"
      if (!found && (input === 'hr' || inputClean === 'hrmanager' || input === 'humanresources')) {
        found = employees.find(emp => emp.role === 'hr') || employees[2];
      }

      // 7. Role aliases: "employee", "emp", "staff", "developer", "dev"
      if (!found && (input === 'employee' || input === 'emp' || input === 'staff' || input === 'developer' || input === 'dev')) {
        found = employees.find(emp => emp.role === 'employee') || employees[3];
      }

      // 8. Substring match fallback (if query has at least 3 characters)
      if (!found && input.length >= 3) {
        found = employees.find(emp => 
          emp.name.toLowerCase().includes(input) || 
          emp.id.toLowerCase().includes(input) ||
          emp.email.toLowerCase().includes(input)
        );
      }

      if (found) {
        if (isEmployeeInactiveOrCompleted(found)) {
          const norm = normalizeEmployeeStatus(found.status);
          const statusLabel = norm === 'internship completed' ? 'Internship Completed' : 'Not Working';
          setLoginError(`Access Denied: Login is disabled for account "${found.name}" (${statusLabel}).`);
          return;
        }

        const expectedPassword = found.password || (found.role === 'admin' ? 'admin123' : found.role === 'manager' ? 'manager123' : found.role === 'hr' ? 'hr123' : 'employee123');
        const pass = loginPassword.trim();
        const passLower = pass.toLowerCase();

        let isPasswordCorrect = expectedPassword === pass || expectedPassword.toLowerCase() === passLower;
        if (!isPasswordCorrect) {
          if (found.role === 'admin' && (passLower === 'admin' || passLower === 'admin123' || passLower === 'password' || passLower === 'password123')) {
            isPasswordCorrect = true;
          } else if (found.role === 'manager' && (passLower === 'manager' || passLower === 'manager123' || passLower === 'password' || passLower === 'password123')) {
            isPasswordCorrect = true;
          } else if (found.role === 'hr' && (passLower === 'hr' || passLower === 'hr123' || passLower === 'password' || passLower === 'password123')) {
            isPasswordCorrect = true;
          } else if (found.role === 'employee' && (passLower === 'emp' || passLower === 'employee' || passLower === 'employee123' || passLower === 'emp123' || passLower === 'password' || passLower === 'password123' || passLower === found.id.toLowerCase())) {
            isPasswordCorrect = true;
          }
        }

        if (!isPasswordCorrect) {
          setLoginError(`Incorrect password for ${found.name}. Please enter your valid credentials.`);
          return;
        }

        performLoginForUser(found);
      } else {
        setLoginError(`Username or Employee ID "${rawInput}" was not found. Please verify your credentials.`);
      }
    };

    return (
      <div className="min-h-screen w-full bg-slate-100/80 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200/90 shadow-2xl rounded-3xl overflow-hidden p-6 sm:p-8 space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-1">
              <HrmsLogo size={52} className="shadow-sm rounded-2xl" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              HRMS System
            </h1>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              Enterprise Workforce, Attendance &amp; Automated Payroll Management Portal
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Username, Employee ID or Email
              </label>
              <input
                type="text"
                required
                placeholder="e.g. admin, manager, hr, employee or EMP-001"
                value={loginEmailOrId}
                onChange={(e) => setLoginEmailOrId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {loginError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl animate-shake">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
            >
              Sign In to HRMS
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="bg-slate-50 text-slate-900 font-sans w-full min-h-screen flex overflow-hidden relative">
      
      {/* Sidebar Overlay (Mobile & Tablet) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-screen transition-transform duration-300 lg:static lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } lg:flex`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <HrmsLogo size={32} className="shrink-0 rounded-lg shadow-xs" />
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">HRMS System</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded tracking-wide">v1.2</span>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User profile card & Role quick switch */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
          <div className="flex items-center space-x-3">
            {activeUser.avatarUrl ? (
              <img
                src={activeUser.avatarUrl}
                alt={activeUser.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${activeUser.avatarColor}`}>
                {activeUser.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <h2 className="text-sm font-semibold text-slate-800 truncate leading-tight">{activeUser.name}</h2>
              <span className="text-[10px] uppercase font-extrabold tracking-tight text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                {activeUser.role} (ID: {activeUser.id})
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setIsLoggedIn(false);
              sessionStorage.removeItem('isLoggedIn');
              sessionStorage.removeItem('activeUserId');
              sessionStorage.removeItem('activeUser');
            }}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 border border-slate-200 hover:border-slate-300 bg-white rounded text-[10px] font-bold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Account</span>
          </button>

          {['admin', 'manager'].includes(activeUser.role) && (
            <div className="pt-2.5 border-t border-slate-200/60 space-y-1">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Supervisory Sandbox Switcher:</label>
              <select
                value={activeUser.id}
                onChange={(e) => handleUserSwitch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded px-2.5 py-1 text-[10px] font-bold text-indigo-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                {employees
                  .filter((emp) => !(activeUser.role === 'manager' && emp.role === 'admin') && !isEmployeeInactiveOrCompleted(emp))
                  .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({(emp.role || '').toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sidebar Nav Buttons based on selected active sandbox role */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {(activeUser?.role || '').toUpperCase()} Portal
          </div>
          
          <button
            onClick={() => selectTab('dashboard')}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4 mr-2.5 shrink-0" />
            Overview Dashboard
          </button>

          {/* Team and Staff Operations (Dynamic Permissions) */}
          {(['admin', 'hr', 'manager'].includes(activeUser.role)) && (
            <>
              <button
                onClick={() => selectTab('directory')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'directory'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 mr-2.5 shrink-0" />
                Staff Directory
              </button>

              <button
                onClick={() => selectTab('status-manager')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'status-manager'
                    ? 'bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-emerald-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-4 h-4 mr-2.5 shrink-0 text-emerald-600" />
                <span>Status & Internship</span>
                <span className="ml-auto text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold font-mono">
                  NEW
                </span>
              </button>
            </>
          )}

          {/* Admin & HR Task Assigning */}
          {(['admin', 'hr'].includes(activeUser.role)) && (
            <button
              onClick={() => selectTab('assign-task')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'assign-task'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-4 h-4 mr-2.5 shrink-0" />
              Assign Tasks
              {proposals.filter(p => p.status === 'pending').length > 0 && (
                <span className="ml-auto bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {proposals.filter(p => p.status === 'pending').length}
                </span>
              )}
            </button>
          )}

          {/* Manager Propose Task Option */}
          {activeUser.role === 'manager' && (
            <>
              <button
                onClick={() => selectTab('propose-task')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'propose-task'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Send className="w-4 h-4 mr-2.5 shrink-0" />
                Assign Task
              </button>

              <button
                onClick={() => selectTab('department-staff')}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'department-staff'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 mr-2.5 shrink-0 text-indigo-600" />
                Team Profiles
              </button>
            </>
          )}

          {/* Department Administration (Admin, Manager, and HR) */}
          {(['admin', 'manager', 'hr'].includes(activeUser.role)) && (
            <button
              onClick={() => selectTab('departments')}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'departments'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              <Building className="w-4 h-4 mr-2.5 shrink-0" />
              Departments
            </button>
          )}

          <div className="pt-6 px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            General Portal
          </div>

          <button
            onClick={() => selectTab('leave-requests')}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'leave-requests'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 mr-2.5 shrink-0" />
            Time Off & Leaves
            {leaveRequests.filter(r => r.status === 'Pending HR' || r.status === 'Referred to Manager').length > 0 && (
              <span className="ml-auto bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {leaveRequests.filter(r => r.status === 'Pending HR' || r.status === 'Referred to Manager').length}
              </span>
            )}
          </button>

          <button
            onClick={() => selectTab('attendance-logs')}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'attendance-logs'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 mr-2.5 shrink-0" />
            Attendance History
          </button>

          <button
            onClick={() => selectTab('holidays')}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'holidays'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Gift className="w-4 h-4 mr-2.5 shrink-0" />
            Holidays & Calendar
          </button>

          <button
            onClick={() => selectTab('payroll')}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'payroll'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <IndianRupee className="w-4 h-4 mr-2.5 shrink-0" />
            Payroll & Salaries
          </button>
          
          <button
            onClick={() => selectTab('my-profile')}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'my-profile'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4 mr-2.5 shrink-0" />
            My Personal Profile
          </button>

          <button
            onClick={() => selectTab('smtp-outbox')}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
              activeTab === 'smtp-outbox'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Open Mock SMTP Mail Client & Outbox"
          >
            <div className="flex items-center">
              <Mail className={`w-4 h-4 mr-2.5 shrink-0 ${activeTab === 'smtp-outbox' ? 'text-indigo-600' : 'text-indigo-500'}`} />
              <span>SMTP Mail Outbox</span>
            </div>
            {mailLogCount > 0 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                activeTab === 'smtp-outbox' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {mailLogCount}
              </span>
            )}
          </button>

          {['admin', 'manager'].includes(activeUser.role) && (
            <>
              <div className="pt-5 px-3 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>SQL Database</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => setIsSQLiteModalOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 transition-all cursor-pointer group"
                  title="Open SQLite Database Manager & SQL Query Console"
                >
                  <div className="flex items-center">
                    <Database className="w-4 h-4 mr-2 text-indigo-600 shrink-0" />
                    <span>SQL Database</span>
                  </div>
                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded shadow-3xs">
                    SQLite
                  </span>
                </button>

                <a
                  href="/api/db/export"
                  download="hrms_database.sqlite"
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50/60 transition-colors cursor-pointer"
                  title="Download raw SQLite database file (hrms.db)"
                >
                  <span className="flex items-center">
                    <HardDrive className="w-3.5 h-3.5 mr-1.5 text-indigo-500 shrink-0" />
                    <span>Download .sqlite DB</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-mono">↓</span>
                </a>
              </div>
            </>
          )}
        </div>

        <div className="p-3.5 border-t border-slate-100 space-y-1.5 text-center">
          <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 font-medium">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <span>•</span>
            <button
              onClick={() => setIsTermsModalOpen(true)}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Terms
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            © 2026 HRMS System • All Rights Reserved
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center space-x-3 md:space-x-6 min-w-0">
            {/* Hamburger Button for Mobile/Tablet */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer focus:outline-none shrink-0"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile/Tablet Brand Logo & Text */}
            <div className="flex lg:hidden items-center space-x-2 mr-2 shrink-0">
              <HrmsLogo size={24} className="shrink-0 rounded-md shadow-3xs" />
              <span className="font-extrabold text-sm tracking-tight text-slate-900 truncate">HRMS System</span>
            </div>

            {activeUser.role !== 'admin' && activeUser.role !== 'manager' && (() => {
              const todayLog = attendance.find(a => a.userId === activeUser.id && a.date === todayStrStr);
              const hasPunchedOutToday = todayLog && todayLog.checkOut && todayLog.checkOut !== '---';
              
              if (isPunchedIn) {
                return (
                  <div className="flex items-center space-x-2 truncate">
                    <span className="hidden sm:inline text-xs text-slate-500 font-semibold uppercase tracking-wider">Device Punch Status:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold leading-none shrink-0 bg-emerald-100 text-emerald-800">
                      ● Punched In
                    </span>
                    <p className="hidden md:block text-xs text-indigo-600 font-medium truncate ml-2">
                      Active Session check-in: <strong className="font-mono">{activePunchTime}</strong>
                    </p>
                  </div>
                );
              } else if (hasPunchedOutToday) {
                return (
                  <div className="flex items-center space-x-2 truncate">
                    <span className="hidden sm:inline text-xs text-slate-500 font-semibold uppercase tracking-wider">Device Punch Status:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold leading-none shrink-0 bg-amber-100 text-amber-800">
                      ○ Punched Out Today
                    </span>
                    <p className="hidden md:block text-xs text-amber-700 font-medium truncate ml-2">
                      Punched Out at: <strong className="font-mono">{todayLog.checkOut}</strong>
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="flex items-center space-x-2 truncate">
                    <span className="hidden sm:inline text-xs text-slate-500 font-semibold uppercase tracking-wider">Device Punch Status:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold leading-none shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
                      ○ Not Punched In Today
                    </span>
                  </div>
                );
              }
            })()}
          </div>

          <div className="flex space-x-3 md:space-x-5 items-center shrink-0">
            {/* Database Sync Status Badge & Direct SQLite Access */}
            {activeUser && ['admin', 'manager'].includes(activeUser.role) && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setIsSQLiteModalOpen(true)}
                  className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-3xs transition-all cursor-pointer"
                  title="Open SQLite Database Manager & SQL Query Console"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>SQL Database</span>
                </button>
                <button
                  onClick={() => setIsSQLiteModalOpen(true)}
                  className="flex items-center space-x-2 bg-slate-50 hover:bg-indigo-50/80 border border-slate-200/85 hover:border-indigo-300 rounded-lg px-2.5 py-1 shadow-3xs transition-all cursor-pointer group"
                  title="SQLite Database (hrms.db) Live on Server"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isSyncing ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    ) : (
                      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isSyncing ? 'bg-indigo-600' : 'bg-emerald-500'}`}></span>
                  </span>
                  <div className="text-left leading-none">
                    <p className="text-[9px] text-slate-400 group-hover:text-indigo-600 uppercase tracking-wider font-bold">SQL Database</p>
                    <p className="text-[10px] font-extrabold text-slate-700 group-hover:text-indigo-900 mt-0.5 whitespace-nowrap">
                      {isSyncing ? 'Writing DB...' : 'SQLite Active'}
                    </p>
                  </div>
                </button>
              </div>
            )}

            <div className="hidden sm:block text-right border-r border-slate-200 pr-3 md:pr-5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">System Time</p>
              <p className="text-sm font-bold font-mono text-slate-700 leading-none mb-0.5">{formatTimeStr(currentTime)}</p>
              <p className="text-[9px] text-slate-400 leading-none">{formatDateStr(currentTime)}</p>
            </div>

            {/* SMTP Mail Client Outbox Trigger */}
            <button
              onClick={() => selectTab('smtp-outbox')}
              className={`p-2 rounded-lg relative cursor-pointer transition-colors ${
                activeTab === 'smtp-outbox'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
              }`}
              title="Open Mock SMTP Mail Outbox"
            >
              <Mail className="w-5 h-5" />
              {mailLogCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-black text-white shadow-sm">
                  {mailLogCount > 99 ? '99+' : mailLogCount}
                </span>
              )}
            </button>

            {/* Notification Bell Center */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-slate-100 relative cursor-pointer transition-colors"
                title="Notifications & Task Alerts"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => n.userId === activeUser.id && !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white animate-pulse">
                    {notifications.filter(n => n.userId === activeUser.id && !n.read).length}
                  </span>
                )}
              </button>

              {/* Notification Center Popover */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-scale-up">
                  <div className="p-3.5 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Notifications & Task Alerts</h4>
                    </div>
                    {notifications.filter(n => n.userId === activeUser.id && !n.read).length > 0 && (
                      <button
                        onClick={markAllNotificationsAsRead}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.filter(n => n.userId === activeUser.id).length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs font-medium">
                        No notifications yet. Task alerts assigned to you will appear here!
                      </div>
                    ) : (
                      notifications
                        .filter(n => n.userId === activeUser.id)
                        .map(notif => (
                          <div
                            key={notif.id}
                            className={`p-3.5 transition-colors flex items-start justify-between space-x-2 ${
                              !notif.read ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-black text-slate-800">{notif.title}</span>
                                {!notif.read && (
                                  <span className="text-[8px] font-extrabold bg-rose-500 text-white px-1.5 py-0.2 rounded-full uppercase">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 leading-snug">{notif.message}</p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                  onClick={() => {
                                    markNotificationAsRead(notif.id);
                                    setIsNotificationOpen(false);
                                    selectTab('dashboard');
                                  }}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer underline"
                                >
                                  View Details ↗
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteNotification(notif.id)}
                              className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer shrink-0"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {activeUser.role !== 'admin' && (
              <button
                onClick={handlePunchToggle}
                disabled={isEmployeeInactiveOrCompleted(activeUser) || (!isPunchedIn && (!!getHolidayForDate(todayStrStr) || !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)))}
                className={`px-3 py-1.5 md:px-5 md:py-2.5 text-[10px] md:text-xs font-extrabold uppercase tracking-wider rounded-lg shadow-sm transition-all duration-150 shrink-0 ${
                  isEmployeeInactiveOrCompleted(activeUser)
                    ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-90'
                    : isPunchedIn
                      ? 'bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700 cursor-pointer'
                      : !!getHolidayForDate(todayStrStr)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-70 border border-slate-300'
                        : !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)
                          ? 'bg-amber-100 text-amber-600 border border-amber-200 cursor-not-allowed opacity-80 font-bold'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 cursor-pointer'
                }`}
              >
                {isEmployeeInactiveOrCompleted(activeUser)
                  ? (normalizeEmployeeStatus(activeUser.status) === 'internship completed'
                      ? 'Attendance Not Required (Internship Completed)'
                      : 'Attendance Not Required (Not Working)')
                  : isPunchedIn 
                    ? 'Punch Out' 
                    : !!getHolidayForDate(todayStrStr) 
                      ? 'Punch Blocked (Holiday)' 
                      : !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)
                        ? 'Punch Not Required (On Leave)'
                        : 'Punch In'}
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Content Area */}
        <div className="p-4 md:p-8 flex-1 space-y-6">

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Overview Dashboard</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Real-time core parameters, task queue updates, and staff roster actions.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!['admin', 'manager', 'hr'].includes(activeUser.role) && (
                    <button
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Apply for Leave / Half Day
                    </button>
                  )}
                  {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                    <button
                      onClick={() => selectTab('attendance-logs')}
                      className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      View Punch In & Out Details ↗
                    </button>
                  )}
                  <div className="flex bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-2 rounded-lg items-center">
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Logged in: {activeUser.name} ({(activeUser?.role || '').toUpperCase()})
                  </div>
                </div>
              </div>

              {/* SINGLE CLEAR PRIMARY CTA HERO CARD */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-fade-in">
                <div className="space-y-1.5 max-w-2xl relative z-10">
                  <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-black uppercase tracking-wider">
                    <span>★ Primary Operational Action</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {activeUser.role === 'admin'
                      ? 'Monthly Payroll & Automated Salary Slip Reports'
                      : activeUser.role === 'hr'
                        ? 'HR Daily Attendance Punch & Department Operations'
                        : activeUser.role === 'manager'
                          ? 'Manager Daily Attendance Punch & Department Operations'
                          : 'Biometric Daily Attendance Punch & Work Session'}
                  </h3>
                  <p className="text-xs text-indigo-200 leading-relaxed">
                    {activeUser.role === 'admin'
                      ? 'Review calculated net salary amounts, reconcile attendance and casual leaves, and generate official monthly salary PDF reports for download.'
                      : activeUser.role === 'hr'
                        ? 'Punch in and punch out daily to record mandatory HR attendance (instantly stored to SQLite Database), manage employee payroll, and oversee team attendance.'
                        : activeUser.role === 'manager'
                          ? 'Punch in and punch out daily to record mandatory Manager attendance (persisted in SQLite Database), monitor active team punches, and assign departmental directives.'
                          : 'Verify shift timing, punch in or out for the day with automated grace calculations, and review personal attendance logs.'}
                  </p>
                </div>

                <div className="shrink-0 relative z-10 w-full md:w-auto">
                  {activeUser.role === 'admin' ? (
                    <button
                      onClick={() => selectTab('payroll')}
                      className="w-full md:w-auto px-6 py-3.5 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 cursor-pointer border border-indigo-300/30"
                    >
                      <IndianRupee className="w-4 h-4 mr-1.5 text-indigo-200" />
                      <span>Open Payroll &amp; Download Salary PDFs ↗</span>
                    </button>
                  ) : activeUser.role === 'hr' ? (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={handlePunchToggle}
                        disabled={isEmployeeInactiveOrCompleted(activeUser) || (!isPunchedIn && (!!getHolidayForDate(todayStrStr) || !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)))}
                        className={`w-full sm:w-auto px-6 py-3.5 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 cursor-pointer ${
                          isEmployeeInactiveOrCompleted(activeUser)
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                            : isPunchedIn
                              ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40 shadow-rose-900/50'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black border border-emerald-300/40 shadow-emerald-900/50'
                        }`}
                      >
                        <Clock className="w-4 h-4 mr-1.5" />
                        <span>{isPunchedIn ? 'Punch Out HR Session Now' : 'Punch In HR Attendance Now'}</span>
                      </button>
                      <button
                        onClick={() => selectTab('payroll')}
                        className="w-full sm:w-auto px-5 py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center justify-center space-x-2 cursor-pointer border border-white/20"
                      >
                        <IndianRupee className="w-4 h-4 mr-1.5 text-indigo-300" />
                        <span>Payroll ↗</span>
                      </button>
                    </div>
                  ) : activeUser.role === 'manager' ? (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={handlePunchToggle}
                        disabled={isEmployeeInactiveOrCompleted(activeUser) || (!isPunchedIn && (!!getHolidayForDate(todayStrStr) || !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)))}
                        className={`w-full sm:w-auto px-6 py-3.5 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 cursor-pointer ${
                          isEmployeeInactiveOrCompleted(activeUser)
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                            : isPunchedIn
                              ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40 shadow-rose-900/50'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black border border-emerald-300/40 shadow-emerald-900/50'
                        }`}
                      >
                        <Clock className="w-4 h-4 mr-1.5" />
                        <span>{isPunchedIn ? 'Punch Out Manager Session' : 'Punch In Manager Attendance Now'}</span>
                      </button>
                      <button
                        onClick={() => selectTab('propose-task')}
                        className="w-full sm:w-auto px-5 py-3.5 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 cursor-pointer border border-indigo-300/30"
                      >
                        <Send className="w-4 h-4 mr-1.5 text-indigo-200" />
                        <span>Assign Task Directive ↗</span>
                      </button>
                      <button
                        onClick={() => selectTab('attendance-logs')}
                        className="w-full sm:w-auto px-5 py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center justify-center space-x-2 cursor-pointer border border-white/20"
                      >
                        <Clock className="w-4 h-4 mr-1.5 text-indigo-300" />
                        <span>Attendance Logs ↗</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePunchToggle}
                      disabled={isEmployeeInactiveOrCompleted(activeUser) || (!isPunchedIn && (!!getHolidayForDate(todayStrStr) || !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)))}
                      className={`w-full md:w-auto px-6 py-3.5 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 cursor-pointer ${
                        isEmployeeInactiveOrCompleted(activeUser)
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed border border-slate-600'
                          : isPunchedIn
                            ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/40'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black border border-emerald-300/40'
                      }`}
                    >
                      <Clock className="w-4 h-4 mr-1.5" />
                      <span>{isPunchedIn ? 'Punch Out Session Now' : 'Punch In Attendance Now'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Prominent Holiday Banner */}
              {(() => {
                const todayHoliday = getHolidayForDate(todayStrStr);
                if (todayHoliday) {
                  return (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-xl p-5 shadow-sm flex items-start gap-4 animate-fade-in">
                      <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                        <Gift className="w-5 h-5 animate-bounce" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black text-amber-700 tracking-wider">OFFICIAL HOLIDAY OBSERVED</span>
                        <h4 className="text-base font-black text-slate-900 tracking-tight">Today is {todayHoliday.name}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                          The system has recognized today, <strong className="font-bold text-slate-800">{todayStrStr}</strong>, as a configured holiday. 
                          {todayHoliday.startDate !== todayHoliday.endDate ? (
                            <span> (Holiday range: <strong className="font-semibold text-slate-700">{todayHoliday.startDate}</strong> to <strong className="font-semibold text-slate-700">{todayHoliday.endDate}</strong>)</span>
                          ) : null}
                          .
                          <span className="block mt-1 font-bold text-amber-800">
                            🔒 Direct punch-ins are temporarily disabled to prevent accidental or double attendance records. Enjoy your holiday!
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Official Office Time and Live Info Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Shift Parameter Configuration</span>
                  <h3 className="text-lg font-black tracking-tight">Official Office Hours</h3>
                  <p className="text-xs text-slate-300">
                    {isTodaySaturday ? (
                      <span>
                        Today is <strong className="text-emerald-400 font-bold">Saturday (Half Day Office)</strong>. Shift timing is halved. Start: <strong className="text-white font-mono">{officeTime}</strong>, Saturday Punch Out End: <strong className="text-white font-mono">{satEndTime}</strong>.
                      </span>
                    ) : (
                      <span>
                        The current standard start time for calculations is <strong className="text-white font-mono">{officeTime}</strong> and regular punch out is <strong className="text-white font-mono">{officeEndTime}</strong>.
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {isTodaySaturday ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded font-bold font-mono">
                        Half Day if punch after {addMinutesTo12HourTime(officeTime, 15)} (+15m grace on Saturday)
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded font-bold font-mono">
                          Late if punch after {addMinutesTo12HourTime(officeTime, 15)} (+15m grace)
                        </span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded font-bold font-mono">
                          Half Day if punch after {addMinutesTo12HourTime(officeTime, 90)} (+1.5h)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {['admin', 'manager'].includes(activeUser.role) ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-4 bg-white/10 p-3 rounded-lg border border-white/10 w-full md:w-auto">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-extrabold uppercase text-indigo-300">Update Shift Start Time:</label>
                        <TimePicker12
                          idPrefix="office-start"
                          value={officeTime}
                          onChange={(new12Hr) => setOfficeTime(new12Hr)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-extrabold uppercase text-indigo-300">Update Regular Punch Out (End):</label>
                        <TimePicker12
                          idPrefix="office-end"
                          value={officeEndTime}
                          onChange={(new12Hr) => setOfficeEndTime(new12Hr)}
                        />
                      </div>
                      <div className="text-[10px] text-indigo-200 font-semibold max-w-[150px] leading-tight">
                        Changes apply instantly to all subsequent calculations.
                      </div>
                    </div>
                    {isTodaySaturday && (
                      <div className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 rounded px-2.5 py-1">
                        Saturday half-day timing automatically calculated as: {officeTime} - {satEndTime}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-lg text-xs font-medium text-slate-300">
                    Shift Today: <strong className="text-white font-mono">{officeTime}</strong> - <strong className="text-white font-mono">{isTodaySaturday ? satEndTime : officeEndTime}</strong> {isTodaySaturday && <span className="text-emerald-400 font-bold ml-1">(Sat Half Day)</span>}
                  </div>
                )}
              </div>

              {/* SQLite Database & Excel Management Section */}
              {activeUser && ['admin', 'manager'].includes(activeUser.role) && (
                <div className="bg-white border border-indigo-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-fade-in">
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-xs border border-indigo-100 shrink-0">
                      <Database className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center">
                        <span>Self-Contained SQLite Database</span>
                        <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      </h3>
                      <p className="text-slate-500 text-xs mt-1 max-w-xl leading-relaxed">
                        Data is stored locally in relational tables within <strong className="text-indigo-700 font-medium">hrms.db</strong> on your server disk. All staff records, punch-ins, tasks, and monthly salaries persist with full ACID integrity. No external cloud databases, zero billing.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
                    <button
                      onClick={() => setIsSQLiteModalOpen(true)}
                      className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                      title="Open SQLite Database Manager & SQL Query Console"
                    >
                      <Terminal className="w-4 h-4" />
                      <span>Open SQL Manager</span>
                    </button>

                    <a
                      href="/api/db/export"
                      download="hrms_database.sqlite"
                      className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                      title="Download raw SQLite database file"
                    >
                      <HardDrive className="w-4 h-4 text-indigo-600" />
                      <span>Download .sqlite DB</span>
                    </a>

                    <button
                      onClick={() => setIsSQLiteModalOpen(true)}
                      className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                      title="View all data tables stored in SQLite"
                    >
                      <Table className="w-4 h-4 text-indigo-600" />
                      <span>View SQL Tables</span>
                    </button>

                    {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                      <>
                        <label
                          htmlFor="import-excel-file"
                          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                          title="Restore / Import Excel file"
                        >
                          <Download className="w-3.5 h-3.5 text-teal-600" />
                          <span>Import Excel</span>
                          <input
                            type="file"
                            id="import-excel-file"
                            accept=".xlsx"
                            onChange={handleLocalExcelImport}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => {
                            try {
                              exportHRMSToExcel({
                                employees,
                                proposals,
                                tasks,
                                attendance,
                                departments,
                                leaveRequests,
                                salaries,
                                holidays
                              });
                            } catch (err) {
                              console.error("Failed to export to Excel:", err);
                            }
                          }}
                          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                          title="Export organization database to Excel backup"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Backup Excel</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              {(() => {
                const todayStr = getLocalDateString();
                const isTodaySunday = isDateSunday(todayStr);
                const todayHoliday = getHolidayForDate(todayStr);

                const absentEmployeesList = (isTodaySunday || todayHoliday) ? [] : employees.filter(emp => {
                  if (emp.role === 'admin') return false; // Exclude system administrator; Manager and HR attendance is required
                  if (isEmployeeInactiveOrCompleted(emp)) return false; // Attendance not required for inactive/completed employees
                  const isPunched = !!getPunchInTime(emp.id);
                  if (isPunched) return false;
                  if (getLeaveForDateAndEmployee(emp.id, todayStr)) return false;
                  const logToday = attendance.find(a => a.userId === emp.id && a.date === todayStr);
                  if (logToday) {
                    return logToday.status === 'Absent';
                  }
                  return true;
                });

                const lateEmployeesList = (isTodaySunday || todayHoliday) ? [] : employees.filter(emp => {
                  if (emp.role === 'admin') return false; // Exclude system administrator; Manager and HR attendance is required
                  if (isEmployeeInactiveOrCompleted(emp)) return false; // Attendance not required for inactive/completed employees
                  const activePunch = getPunchInTime(emp.id);
                  if (activePunch) {
                    const status = getAttendanceStatus(activePunch, officeTime, todayStr, emp.id, attendance, leaveRequests);
                    return status === 'Late' || status === 'Half Day' || status === 'Paid Half Day';
                  }
                  const logToday = attendance.find(a => a.userId === emp.id && a.date === todayStr);
                  if (logToday) {
                    return logToday.status === 'Late' || logToday.status === 'Half Day' || logToday.status === 'Paid Half Day';
                  }
                  return false;
                });

                if (activeUser.role === 'employee') {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Card 1: Total Tasks Assigned */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-0 top-0 h-full w-1 bg-indigo-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Tasks Assigned</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {tasks.filter(t => t.employeeId === activeUser.id).length}
                        </p>
                        <div className="text-[10px] text-indigo-600 font-semibold mt-3 flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" /> Your Personal Task Queue
                        </div>
                      </div>

                      {/* Card 2: Tasks Completed */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Tasks Completed</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {tasks.filter(t => t.employeeId === activeUser.id && t.status === 'completed').length}
                        </p>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-3 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Completed Successfully
                        </div>
                      </div>

                      {/* Card 3: Pending Tasks */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-amber-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Pending Tasks</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {tasks.filter(t => t.employeeId === activeUser.id && t.status !== 'completed').length}
                        </p>
                        <div className="text-[10px] text-amber-600 font-semibold mt-3 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" /> Awaiting Action
                        </div>
                      </div>

                      {/* Card 4: Today's Status */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        {(() => {
                          const activePunch = getPunchInTime(activeUser.id);
                          const todayLog = attendance.find(a => a.userId === activeUser.id && a.date === todayStr);
                          const isPunched = !!activePunch;
                          
                          let status = 'Not Punched In';
                          if (isPunched) {
                            status = getAttendanceStatus(activePunch, officeTime, todayStr, activeUser.id, attendance, leaveRequests);
                          } else if (todayLog) {
                            status = todayLog.status || 'On Time';
                          } else if (getLeaveForDateAndEmployee(activeUser.id, todayStr)) {
                            status = 'On Leave';
                          } else if (isDateSunday(todayStr)) {
                            status = 'Sunday Off';
                          } else {
                            const holiday = getHolidayForDate(todayStr);
                            if (holiday) {
                              status = `Holiday: ${holiday.name}`;
                            } else {
                              const projected = resolveUnpunchedStatus(activeUser.id, todayStr, attendance, leaveRequests);
                              status = projected === 'Casual Leave (CL)' ? 'Not Punched In (CL)' : 'Not Punched In (Absent)';
                            }
                          }

                          const isAbsent = status === 'Absent' || status === 'Not Punched In (Absent)';
                          const isCL = status === 'Casual Leave (CL)' || status === 'Not Punched In (CL)';
                          const isNotPunched = status.startsWith('Not Punched In');
                          const isOnLeave = status === 'On Leave';
                          const isHoliday = status.startsWith('Holiday') || status === 'Sunday Off' || isOnLeave;
                          const barColor = isAbsent ? 'bg-rose-500' : (isCL ? 'bg-teal-500' : (isNotPunched ? 'bg-amber-500' : (isOnLeave ? 'bg-sky-500' : (isHoliday ? 'bg-indigo-500' : 'bg-emerald-500'))));
                          const textColor = isAbsent ? 'text-rose-600' : (isCL ? 'text-teal-700' : (isNotPunched ? 'text-amber-600' : (isOnLeave ? 'text-sky-600' : (isHoliday ? 'text-indigo-600' : 'text-emerald-600'))));
                          
                          return (
                            <>
                              <div className={`absolute right-0 top-0 h-full w-1 ${barColor}`}></div>
                              <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Today's Status</p>
                              <p className={`text-2xl font-black mt-2 ${textColor}`}>
                                {status}
                              </p>
                              <div className={`text-[10px] ${textColor} font-semibold mt-3 flex items-center`}>
                                <UserCheck className="w-3 h-3 mr-1" /> Attendance Checked
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                } else if (activeUser.role === 'admin' || activeUser.role === 'manager') {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-0 top-0 h-full w-1 bg-indigo-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Staff Roster</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">{employees.length}</p>
                        <div className="text-[10px] text-indigo-600 font-semibold mt-3 flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" /> {employees.filter(e => e.status !== 'inactive').length} Active • {employees.filter(e => e.status === 'inactive').length} Inactive / Completed
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-indigo-600"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Assigned Tasks Active</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {tasks.filter(t => t.status !== 'completed').length}
                        </p>
                        <div className="text-[10px] text-indigo-600 font-semibold mt-3 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Pending or In-Progress
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Today's Attendance Logs</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {getVisibleAttendance().filter(a => a.date === todayStr).length}
                        </p>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-3 flex items-center">
                          <UserCheck className="w-3 h-3 mr-1" /> Verified Punch Entries
                        </div>
                      </div>

                      {/* Card 4: Absent Employees */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-0 top-0 h-full w-1 bg-rose-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Absent Employees</p>
                        <p className="text-3xl font-extrabold text-rose-600 mt-2">
                          {absentEmployeesList.length}
                        </p>
                        {absentEmployeesList.length > 0 ? (
                          <div className="mt-3 space-y-1 max-h-[60px] overflow-y-auto pr-1">
                            {absentEmployeesList.map(emp => (
                              <div key={emp.id} className="text-[10px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 font-semibold flex justify-between items-center">
                                <span className="truncate">{emp.name}</span>
                                <span className="text-[8px] uppercase text-rose-500 font-bold font-mono ml-2 shrink-0">{emp.department}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-600 font-semibold mt-3 flex items-center">
                            <UserCheck className="w-3 h-3 mr-1" /> Perfect Attendance!
                          </div>
                        )}
                      </div>

                      {/* Card 5: Late Employees */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-amber-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Late Employees</p>
                        <p className="text-3xl font-extrabold text-amber-600 mt-2">
                          {lateEmployeesList.length}
                        </p>
                        {lateEmployeesList.length > 0 ? (
                          <div className="mt-3 space-y-1 max-h-[60px] overflow-y-auto pr-1">
                            {lateEmployeesList.map(emp => {
                              const log = attendance.find(a => a.userId === emp.id && a.date === todayStr);
                              const activePunch = getPunchInTime(emp.id);
                              const timeStr = log ? log.checkIn : (activePunch || '');
                              const status = log ? log.status : (activePunch ? getAttendanceStatus(activePunch, officeTime, todayStr, emp.id, attendance, leaveRequests) : 'Late');
                              const isPaidHalf = status === 'Paid Half Day';
                              const isHalf = status === 'Half Day';
                              const badgeClass = isPaidHalf 
                                ? 'bg-amber-100 text-amber-700 border-amber-200' 
                                : isHalf 
                                ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                : 'bg-rose-100 text-rose-700 border-rose-200';
                              const labelText = isPaidHalf ? 'Paid Half' : isHalf ? 'Unpaid Half' : 'Late';

                              return (
                                <div key={emp.id} className="text-[10px] text-slate-600 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 font-semibold flex justify-between items-center gap-1">
                                  <span className="truncate">{emp.name}</span>
                                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${badgeClass} font-mono shrink-0`}>
                                    {timeStr} ({labelText})
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-600 font-semibold mt-3 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> No late arrivals today!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  // Fallback for HR: Original 4 cards
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute right-0 top-0 h-full w-1 bg-indigo-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Staff Roster</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">{employees.length}</p>
                        <div className="text-[10px] text-indigo-600 font-semibold mt-3 flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" /> {employees.filter(e => e.status !== 'inactive').length} Active • {employees.filter(e => e.status === 'inactive').length} Inactive / Completed
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-amber-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Assigned Tasks Active</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {tasks.filter(t => t.status !== 'completed').length}
                        </p>
                        <div className="text-[10px] text-amber-600 font-semibold mt-3 flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Pending or In-Progress
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Today's Attendance Logs</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {getVisibleAttendance().filter(a => a.date === todayStr).length}
                        </p>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-3 flex items-center">
                          <UserCheck className="w-3 h-3 mr-1" /> Verified Punch Entries
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 h-full w-1 bg-pink-500"></div>
                        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Pending Mgr Proposals</p>
                        <p className="text-3xl font-extrabold text-slate-800 mt-2">
                          {proposals.filter(p => p.status === 'pending').length}
                        </p>
                        <div className="text-[10px] text-pink-600 font-semibold mt-3 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" /> Awaiting HR Action
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Department Task Completion Progress Chart (Recharts) */}
              <DepartmentTaskProgressChart
                tasks={tasks}
                departments={departments}
                employees={employees}
                onNavigateToTasks={() => {
                  if (activeUser.role === 'hr') selectTab('assign-task');
                  else if (activeUser.role === 'manager') selectTab('propose-task');
                  else selectTab('dashboard');
                }}
              />

              {/* Grid content depending on Role */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left side: Tasks Pipeline & Directives list (Universal for Admin / Manager / HR) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Pending Leave Requests Widget for Admin, Manager, HR */}
                  {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden animate-fade-in">
                      <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                              Pending Leave Requests Awaiting Approval
                            </h3>
                            <p className="text-slate-500 text-[10px]">Staff leave applications requiring Admin, Manager, or HR authorization</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                            {leaveRequests.filter(r => r.status !== 'Approved' && r.status !== 'Declined').length} Pending
                          </span>
                          <button
                            onClick={() => selectTab('leave-requests')}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          >
                            View All ↗
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {leaveRequests.filter(r => r.status !== 'Approved' && r.status !== 'Declined').length === 0 ? (
                          <div className="p-5 text-center text-slate-400 text-xs font-medium">
                            No pending leave requests requiring review. All staff requests up to date!
                          </div>
                        ) : (
                          leaveRequests
                            .filter(r => r.status !== 'Approved' && r.status !== 'Declined')
                            .slice(0, 5)
                            .map((req) => (
                              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                      req.type === 'Half Day' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    }`}>
                                      {req.type}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800">
                                      {req.employeeName} <span className="text-slate-400 font-normal">({req.employeeId})</span>
                                    </span>
                                    <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                      {req.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 italic max-w-xl">"{req.reason}"</p>
                                  <p className="text-[10px] text-slate-400">
                                    Dates: <strong>{req.startDate}</strong> {req.type === 'Leave' && req.endDate !== req.startDate && <>to <strong>{req.endDate}</strong></>}
                                  </p>
                                </div>

                                <div className="flex items-center space-x-1.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setLeaveRequests(prev => prev.map(item => item.id === req.id ? { ...item, status: 'Declined', finalDecisionDate: getLocalDateString() } : item));
                                    }}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold cursor-pointer transition-colors"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    onClick={() => {
                                      setLeaveRequests(prev => prev.map(item => item.id === req.id ? { ...item, status: 'Approved', finalDecisionDate: getLocalDateString() } : item));
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                                  >
                                    Approve Leave
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                  
                  {activeUser.role === 'manager' && proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').length > 0 && (
                    <div className="bg-amber-50/40 rounded-xl border border-amber-200/80 shadow-sm overflow-hidden animate-fade-in">
                      <div className="p-5 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
                        <div>
                          <h3 className="font-extrabold text-amber-900 text-sm uppercase tracking-wider flex items-center">
                            <Clock className="w-4 h-4 mr-1.5 text-amber-600 animate-pulse" /> HR Task Proposals Awaiting Your Approval
                          </h3>
                          <p className="text-amber-700/80 text-[10px]">These tasks were proposed by HR for your department's staff. Review and approve them.</p>
                        </div>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                          {proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').length} Pending
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white">
                        {proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').map((prop) => {
                          const emp = employees.find(e => e.id === prop.proposedEmployeeId);
                          return (
                            <div key={prop.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-amber-50/10 transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                    prop.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                                    prop.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                                  }`}>
                                    {prop.priority}
                                  </span>
                                  <span className="text-[10px] text-pink-600 font-bold uppercase tracking-tight bg-pink-50 px-1.5 py-0.5 rounded">Proposed by HR</span>
                                  <span className="text-slate-400 text-[10px]">• Created: {prop.createdAt}</span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-800">{prop.title}</h4>
                                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">{prop.description}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Target Employee: <strong className="text-slate-600">{emp?.name || 'Unknown'}</strong> | Target Due Date: <strong className="text-slate-600">{prop.dueDate}</strong>
                                </p>
                              </div>

                              <div className="flex space-x-2 shrink-0">
                                <button
                                  onClick={() => handleManagerApproveProposal(prop.id)}
                                  className="bg-emerald-600 text-white font-extrabold text-xs px-3.5 py-2 rounded hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                                >
                                  Approve & Clear to Assign
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Active Task Pipeline & Directives</h3>
                        <p className="text-slate-400 text-[10px]">Manager proposed details formalized by HR for Employee execution</p>
                      </div>
                      {activeUser.role === 'hr' && (
                        <button
                          onClick={() => setActiveTab('assign-task')}
                          className="text-xs bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-md hover:bg-indigo-700 cursor-pointer"
                        >
                          + Create Directive
                        </button>
                      )}
                      {activeUser.role === 'manager' && (
                        <button
                          onClick={() => setActiveTab('propose-task')}
                          className="text-xs bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-md hover:bg-indigo-700 cursor-pointer"
                        >
                          + Assign Task
                        </button>
                      )}
                    </div>
                    
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold">
                          <tr>
                            <th className="px-6 py-3 border-b border-slate-200">Task Title & Details</th>
                            <th className="px-6 py-3 border-b border-slate-200">Owner</th>
                            <th className="px-6 py-3 border-b border-slate-200">Source</th>
                            <th className="px-6 py-3 border-b border-slate-200">Status</th>
                            <th className="px-6 py-3 border-b border-slate-200">Completed At</th>
                            {(activeUser.role === 'employee' || activeUser.role === 'admin') && <th className="px-6 py-3 border-b border-slate-200">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {getVisibleTasks().length === 0 ? (
                            <tr key="empty-tasks">
                              <td colSpan={(activeUser.role === 'employee' || activeUser.role === 'admin') ? 6 : 5} className="px-6 py-8 text-center text-slate-400 text-xs">
                                No active assigned tasks found.
                              </td>
                            </tr>
                          ) : (
                            getVisibleTasks().map((task) => {
                              const showTaskAction = activeUser.role === 'employee' && task.employeeId === activeUser.id;
                              return (
                                <tr key={task.id} className="hover:bg-slate-50">
                                  <td className="px-6 py-4">
                                    <p className="text-xs font-bold text-slate-800">{task.title}</p>
                                    <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap break-words max-w-xl bg-slate-50 p-2 rounded border border-slate-100/60 leading-relaxed">{task.description}</p>
                                    <div className="flex space-x-2 mt-1">
                                      <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                                        Due: {task.dueDate}
                                      </span>
                                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                        task.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                                        task.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                                      }`}>
                                        {task.priority}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                                    {task.employeeName}
                                  </td>
                                  <td className="px-6 py-4 text-[10px] text-slate-500">
                                    <p className="font-semibold">{task.assignedBy}</p>
                                    <p className="text-[9px] text-slate-400">via HR Directive</p>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`px-2 py-1 text-[10px] font-extrabold uppercase rounded ${
                                      task.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                      task.status === 'in-progress' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {task.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                                    {task.status === 'completed' ? (task.completedAt || 'N/A') : '---'}
                                  </td>
                                  {(activeUser.role === 'employee' || activeUser.role === 'admin') && (
                                    <td className="px-6 py-4">
                                      {activeUser.role === 'admin' ? (
                                        <button
                                          onClick={() => {
                                            setTasks(prev => prev.filter(t => t.id !== task.id));
                                            if (task.proposalId) {
                                              setProposals(prev => prev.filter(p => p.id !== task.proposalId));
                                            }
                                          }}
                                          className="text-rose-600 hover:text-rose-800 font-bold text-[10px] flex items-center bg-rose-50 hover:bg-rose-100 border border-rose-100/70 px-2 py-1 rounded-md cursor-pointer transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                                          Delete
                                        </button>
                                      ) : showTaskAction ? (
                                        <select
                                          value={task.status}
                                          onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as any)}
                                          className="bg-white border border-slate-200 rounded text-[10px] font-bold px-1.5 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                          <option value="pending">Pending</option>
                                          <option value="in-progress">In-Progress</option>
                                          <option value="completed">Completed</option>
                                        </select>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-mono">Restricted</span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Today's Attendance Log Widget on Dashboard (Admin/Manager/HR Quickview) */}
                  {["admin", "manager", "hr"].includes(activeUser.role) && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col animate-fade-in mt-6">
                      <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center">
                            <span>Today's Attendance Registry</span>
                            <span className="ml-2 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-200">
                              {getVisibleAttendance().filter(a => a.date === getLocalDateString()).length} entries
                            </span>
                          </h3>
                          <p className="text-slate-400 text-[10px]">Real-time live registry and punch logs for today ({getLocalDateString()})</p>
                        </div>
                        {activeUser.role === "admin" && (
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded">
                            Admin Mode: Changes propagate instantly
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold">
                            <tr>
                              <th className="px-6 py-3 border-b border-slate-200">Employee Name</th>
                              <th className="px-6 py-3 border-b border-slate-200">Punch-In</th>
                              <th className="px-6 py-3 border-b border-slate-200">Punch-Out</th>
                              <th className="px-6 py-3 border-b border-slate-200">Duration</th>
                              <th className="px-6 py-3 border-b border-slate-200">Status</th>
                              {activeUser.role === "admin" && <th className="px-6 py-3 border-b border-slate-200 text-center">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {(() => {
                              const todayStr = getLocalDateString();
                              const logs = sortAttendanceLogs(getVisibleAttendance().filter(a => a.date === todayStr));
                              if (logs.length === 0) {
                                return (
                                  <tr key="empty-today-att">
                                    <td colSpan={activeUser.role === "admin" ? 6 : 5} className="px-6 py-8 text-center text-slate-400 text-xs">
                                      No attendance records punched for today yet.
                                    </td>
                                  </tr>
                                );
                              }
                              return logs.map((log) => (
                                <tr key={`dash-att-${log.id}`} className="hover:bg-slate-50">
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{log.userName}</div>
                                    <span className="uppercase text-[8px] font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                      {log.userRole}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 font-mono text-slate-600">{log.checkIn}</td>
                                  <td className="px-6 py-4 font-mono text-slate-600">
                                    {log.checkOut || "Active Session"}
                                  </td>
                                  <td className="px-6 py-4">
                                    {log.duration ? (
                                      <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                                        {log.duration}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium animate-pulse">
                                        In-Progress
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${
                                      log.status === "Late" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                      log.status === "Absent" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                                      log.status === "On Leave" ? "bg-sky-100 text-sky-800 border border-sky-200" :
                                      "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    }`}>
                                      {log.status || "On Time"}
                                    </span>
                                  </td>
                                  {activeUser.role === "admin" && (
                                    <td className="px-6 py-4 text-center">
                                      <button
                                        onClick={() => handleDeleteAttendanceLog(log.id, log.userId)}
                                        className="text-rose-600 hover:text-rose-800 font-bold text-[10px] flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-100/70 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors mx-auto"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                        Delete
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                {/* Right side: Quick actions or summary based on current user role */}
                <div className="space-y-6">
                  
                  {/* Role-Specific Overview Snapshot instead of Quick Profile Modifier */}
                  {activeUser.role === 'admin' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                          <TrendingUp className="w-4 h-4" />
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Admin System Insights</h4>
                        </div>
                        <p className="text-[10px] text-slate-400">High-level organization performance & financial metrics.</p>
                      </div>

                      {/* Financials block */}
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Estimated Monthly Payroll</span>
                        <div className="flex items-baseline space-x-1.5">
                          <p className="text-xl font-black text-slate-800">
                            {formatINR(employees.reduce((acc, emp) => acc + parseSalary(emp.salary), 0))}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">/ month</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                          <span>Average Package</span>
                          <span className="font-bold text-slate-700">
                            {employees.length > 0
                              ? formatINR(Math.round(employees.reduce((acc, emp) => acc + parseSalary(emp.salary), 0) / employees.length))
                              : '0'}
                          </span>
                        </div>
                      </div>

                      {/* Role Metrics */}
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Role Distribution</span>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-slate-500 font-medium">Admins</span>
                            <span className="font-extrabold text-slate-800 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">
                              {employees.filter(e => e.role === 'admin').length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-slate-500 font-medium">Managers</span>
                            <span className="font-extrabold text-slate-800 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">
                              {employees.filter(e => e.role === 'manager').length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-slate-500 font-medium">HRs</span>
                            <span className="font-extrabold text-slate-800 bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded text-[10px]">
                              {employees.filter(e => e.role === 'hr').length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                            <span className="text-slate-500 font-medium">Employees</span>
                            <span className="font-extrabold text-slate-800 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                              {employees.filter(e => e.role === 'employee').length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Employment & Internship Status Breakdown */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Employment Status</span>
                          <button
                            onClick={() => selectTab('status-manager')}
                            className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-0.5"
                          >
                            <span>Manage</span>
                            <Sliders className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex justify-between items-center p-2 bg-emerald-50/60 rounded border border-emerald-100">
                            <span className="text-emerald-800 font-semibold text-[10px]">💼 Working</span>
                            <span className="font-extrabold text-emerald-700 bg-white px-1.5 py-0.5 rounded text-[10px] shadow-3xs">
                              {employees.filter(e => normalizeEmployeeStatus(e.status) === 'working').length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-blue-50/60 rounded border border-blue-100">
                            <span className="text-blue-800 font-semibold text-[10px]">🎓 On Intern</span>
                            <span className="font-extrabold text-blue-700 bg-white px-1.5 py-0.5 rounded text-[10px] shadow-3xs">
                              {employees.filter(e => normalizeEmployeeStatus(e.status) === 'on internship').length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-rose-50/60 rounded border border-rose-100">
                            <span className="text-rose-800 font-semibold text-[10px]">⛔ Not Working</span>
                            <span className="font-extrabold text-rose-700 bg-white px-1.5 py-0.5 rounded text-[10px] shadow-3xs">
                              {employees.filter(e => normalizeEmployeeStatus(e.status) === 'not working').length}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-purple-50/60 rounded border border-purple-100">
                            <span className="text-purple-800 font-semibold text-[10px]">🎖️ Completed</span>
                            <span className="font-extrabold text-purple-700 bg-white px-1.5 py-0.5 rounded text-[10px] shadow-3xs">
                              {employees.filter(e => normalizeEmployeeStatus(e.status) === 'internship completed').length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Organization Roster Health */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Department Footprint</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {departments.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic py-1">No departments registered yet.</p>
                          ) : (
                            departments.map(dept => {
                              const count = employees.filter(e => e.department === dept.name).length;
                              const pct = employees.length > 0 ? (count / employees.length) * 100 : 0;
                              return (
                                <div key={dept.id} className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-medium text-slate-600">
                                    <span>{dept.name}</span>
                                    <span className="font-bold">{count} staff ({Math.round(pct)}%)</span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeUser.role === 'manager' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2 text-indigo-700 mb-0.5">
                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                              Manager Team Snapshot
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Real-time status of your {activeUser.department} department.
                          </p>
                        </div>
                      </div>

                      {/* Department attendance/size status */}
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                            Department Staff
                          </span>
                          <p className="text-xl font-black text-slate-800">
                            {employees.filter(e => e.department === activeUser.department).length}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Punched In Today</span>
                          <p className="text-xl font-black text-emerald-600">
                            {employees.filter(e => {
                              if (e.department !== activeUser.department) return false;
                              const isPunched = !!getPunchInTime(e.id);
                              const hasLog = attendance.some(a => a.userId === e.id && a.date === getLocalDateString() && a.status !== 'Absent');
                              return isPunched || hasLog;
                            }).length}
                          </p>
                        </div>
                      </div>

                      {/* Manager's Personal Attendance Status */}
                      <div className="bg-indigo-50/70 p-3.5 rounded-lg border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-1.5 text-indigo-700">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase font-black tracking-wider">Your Daily Attendance</span>
                          </div>
                          <p className="text-xs font-bold text-slate-800 mt-1">
                            {isPunchedIn ? (
                              <span className="text-emerald-700 font-extrabold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Currently Punched In ({activePunchTime})
                              </span>
                            ) : (() => {
                              const todayLog = attendance.find(a => a.userId === activeUser.id && a.date === getLocalDateString());
                              if (todayLog) {
                                return <span className="text-indigo-800">Completed Session: {todayLog.checkIn} - {todayLog.checkOut} ({todayLog.status})</span>;
                              }
                              return <span className="text-amber-700 font-semibold">Not Yet Punched In Today</span>;
                            })()}
                          </p>
                        </div>
                        <button
                          onClick={handlePunchToggle}
                          disabled={isEmployeeInactiveOrCompleted(activeUser) || (!isPunchedIn && (!!getHolidayForDate(todayStrStr) || !!getLeaveForDateAndEmployee(activeUser.id, todayStrStr)))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0 ${
                            isEmployeeInactiveOrCompleted(activeUser)
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : isPunchedIn
                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          {isPunchedIn ? 'Punch Out' : 'Punch In'}
                        </button>
                      </div>

                      {/* Quick Shortcuts */}
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => selectTab('department-staff')}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-[10px] font-bold transition-colors text-center cursor-pointer border border-slate-200"
                        >
                          Team Profiles ↗
                        </button>
                        <button
                          onClick={() => selectTab('leave-requests')}
                          className="px-2.5 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-[10px] font-bold transition-colors text-center cursor-pointer border border-slate-200"
                        >
                          Staff Leaves ↗
                        </button>
                      </div>

                      {/* HR task proposals alert */}
                      {(() => {
                        const count = proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').length;
                        if (count === 0) return null;
                        return (
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-[11px] text-amber-800 animate-pulse">
                            <div className="flex items-center space-x-1.5 font-bold">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{count} HR Proposals Awaiting Approval</span>
                            </div>
                            <button
                              onClick={() => setActiveTab('propose-task')}
                              className="text-[10px] font-black text-amber-700 hover:underline cursor-pointer shrink-0"
                            >
                              REVIEW
                            </button>
                          </div>
                        );
                      })()}

                      {/* Team Task Completion Progress */}
                      {(() => {
                        const teamEmpIds = employees.filter(e => e.department === activeUser.department).map(e => e.id);
                        const teamTasks = tasks.filter(t => teamEmpIds.includes(t.employeeId));
                        const completedCount = teamTasks.filter(t => t.status === 'completed').length;
                        const pct = teamTasks.length > 0 ? (completedCount / teamTasks.length) * 100 : 0;
                        return (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Department Tasks Progress</span>
                              <span className="text-[10px] font-extrabold text-slate-600">{completedCount} / {teamTasks.length} Done</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                            </div>
                            <p className="text-[9px] text-slate-400 italic">Completion Rate: {teamTasks.length > 0 ? `${Math.round(pct)}%` : '0%'}</p>
                          </div>
                        );
                      })()}

                      {/* Department Members Status */}
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Department Roster</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {employees.filter(e => e.department === activeUser.department).map(emp => {
                            const isPunched = !!getPunchInTime(emp.id);
                            return (
                              <div key={emp.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100 text-[11px]">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${isPunched ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                  <span className="font-bold text-slate-700">{emp.name}</span>
                                </div>
                                <span className="text-slate-400 text-[9px]">{emp.jobTitle}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeUser.role === 'hr' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2 text-pink-700 mb-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">HR Action Center</h4>
                        </div>
                        <p className="text-[10px] text-slate-400">Awaiting your authorization and workflow review.</p>
                      </div>

                      {/* HR Pending Actions overview */}
                      <div className="space-y-2">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Action Queue</span>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 bg-slate-50 rounded border border-slate-100 flex flex-col">
                            <span className="text-slate-400 text-[9px] uppercase font-bold">Leave Requests</span>
                            <span className="text-lg font-black text-slate-800 mt-1">
                              {leaveRequests.filter(req => ['Pending HR Approval', 'Manager Approved'].includes(req.status)).length}
                            </span>
                            <span className="text-[8px] text-rose-500 font-extrabold mt-1">Needs Review</span>
                          </div>
                          
                          <div className="p-2.5 bg-slate-50 rounded border border-slate-100 flex flex-col">
                            <span className="text-slate-400 text-[9px] uppercase font-bold">Task Proposals</span>
                            <span className="text-lg font-black text-slate-800 mt-1">
                              {proposals.filter(p => p.status === 'pending').length}
                            </span>
                            <span className="text-[8px] text-indigo-500 font-extrabold mt-1">Awaiting Assignment</span>
                          </div>
                        </div>
                      </div>

                      {/* Attendance metrics */}
                      <div className="space-y-2 pt-1">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Today's Presence Audit</span>
                        {(() => {
                          const todayStr = getLocalDateString();
                          const activeEmployees = employees.filter(emp => emp.role !== 'admin');
                          const present = activeEmployees.filter(emp => {
                            const isPunched = !!getPunchInTime(emp.id);
                            const hasLog = attendance.some(a => a.userId === emp.id && a.date === todayStr && a.status !== 'Absent');
                            return isPunched || hasLog;
                          }).length;
                          const total = activeEmployees.length;
                          const absent = total - present;
                          const pct = total > 0 ? (present / total) * 100 : 0;
                          return (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] text-slate-600 font-medium">
                                <span>Attendance Compliance</span>
                                <span className="font-bold text-slate-800">{present} / {total} Present</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-pink-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-400 italic">
                                <span>Absent count: {absent}</span>
                                <span>Compliance: {Math.round(pct)}%</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Onboarding block */}
                      <div className="p-3 bg-pink-50/50 rounded-lg border border-pink-100 space-y-1">
                        <span className="text-[8px] uppercase font-extrabold text-pink-700 tracking-wider">Latest Addition</span>
                        {employees.length > 0 ? (
                          (() => {
                            const sorted = [...employees].sort((a, b) => b.joinDate.localeCompare(a.joinDate));
                            const newest = sorted[0];
                            return (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-slate-700">{newest.name}</span>
                                <span className="text-slate-500">{newest.department} ({newest.joinDate})</span>
                              </div>
                            );
                          })()
                        ) : (
                          <p className="text-[10px] text-slate-400">No employees listed</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeUser.role === 'employee' && (
                    // For typical Employees: Show their direct assigned tasks and work metrics
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">My Direct Tasks</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Assigned to you by the HR coordinator</p>
                      </div>

                      <div className="space-y-2.5">
                        {tasks.filter(t => t.employeeId === activeUser.id).length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs font-medium">
                            No tasks assigned directly to you!
                          </div>
                        ) : (
                          tasks.filter(t => t.employeeId === activeUser.id).map(task => (
                            <div key={task.id} className="p-3 border border-slate-100 rounded-lg space-y-2">
                              <div className="flex items-start justify-between">
                                <h5 className="text-xs font-bold text-slate-800 leading-snug">{task.title}</h5>
                                <span className={`text-[9px] font-extrabold px-1 py-0.5 uppercase rounded ${
                                  task.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                  task.status === 'in-progress' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {task.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap break-words bg-slate-50 p-2 rounded border border-slate-100/60 mt-1">{task.description}</p>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                                <span className="text-[9px] text-slate-400">Due: {task.dueDate}</span>
                                <button
                                  onClick={() => handleUpdateTaskStatus(task.id, task.status === 'pending' ? 'in-progress' : 'completed')}
                                  disabled={task.status === 'completed'}
                                  className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                                    task.status === 'completed'
                                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                      : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                                  }`}
                                >
                                  {task.status === 'pending' ? 'Start Task' : task.status === 'in-progress' ? 'Complete Task' : 'Done'}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}



                </div>

              </div>

            </div>
          )}

          {/* TAB 2: STAFF DIRECTORY (Admin, HR and Manager) */}
          {activeTab === 'directory' && ['admin', 'hr', 'manager'].includes(activeUser.role) && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Staff Master Directory</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Manage profiles, view core financial data, and issue updates.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => selectTab('status-manager')}
                    className="inline-flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer shadow-sm transition-colors"
                    title="Open dedicated Status & Internship Management Controller"
                  >
                    <Sliders className="w-4 h-4 mr-1.5" />
                    Status & Internship Controller
                  </button>
                  <button
                    onClick={() => {
                      const maxNum = Math.max(...employees.map(e => {
                        const m = e.id.match(/\d+/);
                        return m ? parseInt(m[0], 10) : 0;
                      }), 0);
                      const nextId = `EMP-${String(maxNum + 1).padStart(3, '0')}`;
                      setNewEmpId(nextId);
                      setNewEmpName('');
                      setNewEmpEmail('');
                      setNewEmpRole('employee');
                      setNewEmpDept(departments[0]?.name || 'Information Technology');
                      setNewEmpPhone('');
                      setNewEmpAddress('');
                      setNewEmpEmergency('');
                      setNewEmpSalary('INR 60,000');
                      setNewEmpTitle('');
                      setNewEmpAvatarUrl('');
                      setNewEmpStatus('working');
                      setNewEmpPassword('password123');
                      setIsAddingEmployee(true);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add New Employee Profile
                  </button>
                </div>
              </div>

              {/* Filters Area */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, role or title..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex space-x-2 w-full md:w-auto">
                  <label className="text-xs font-semibold text-slate-400 self-center shrink-0">Dept Filter:</label>
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {deptNames.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid of employees */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredEmployees.map((emp, empIndex) => (
                  <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden relative">
                    <div className="p-5 flex-1 space-y-4">
                      {/* Avatar, Name, Title, and Numbers */}
                      <div className="flex items-center space-x-3.5 pb-3 border-b border-slate-100 relative">
                        <div className="relative shrink-0">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.name}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-lg object-cover shadow-sm border border-slate-200"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-base shadow-sm ${emp.avatarColor}`}>
                              {emp.name.split(' ').map(n => n[0]).join('')}
                            </div>
                          )}
                          <span className="absolute -top-1.5 -left-1.5 bg-slate-900 text-white font-mono text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border border-white shadow-2xs">
                            #{empIndex + 1}
                          </span>
                        </div>
                        <div className="overflow-hidden flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-extrabold text-sm text-slate-800 truncate leading-snug">{emp.name}</h3>
                            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                              No: {emp.id}
                            </span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{emp.jobTitle}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="inline-block text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded tracking-wider bg-slate-100 text-slate-600">
                              {emp.role}
                            </span>
                            {(() => {
                              const normSt = normalizeEmployeeStatus(emp.status);
                              const curOpt = STATUS_OPTIONS.find(o => o.value === normSt) || STATUS_OPTIONS[0];
                              return (
                                <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded border shadow-3xs ${curOpt.badgeClass}`}>
                                  <span>{curOpt.icon}</span>
                                  <span>{curOpt.shortLabel}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Info details */}
                      <div className="space-y-2.5 text-xs text-slate-600">
                        {isEmployeeInactiveOrCompleted(emp) && (
                          <div className="bg-rose-50/70 border border-dashed border-rose-200 rounded p-2 text-[10px] text-rose-800 font-medium space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 font-bold">Access &amp; Login:</span>
                              <span className="font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 text-[9px]">
                                Login Disabled
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5 border-t border-rose-100">
                              <span>Attendance:</span>
                              <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Not Required ({normalizeEmployeeStatus(emp.status) === 'internship completed' ? 'Internship Completed' : 'Not Working'})
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Building className="w-3.5 h-3.5 text-slate-400 mr-2.5 shrink-0" />
                          <span className="font-semibold text-slate-700">Department:</span>
                          <span className="ml-auto font-medium text-slate-500">{emp.department}</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="w-3.5 h-3.5 text-slate-400 mr-2.5 shrink-0" />
                          <span className="font-semibold text-slate-700">Mobile No:</span>
                          <span className="ml-auto font-medium text-slate-500">{emp.phone || <span className="text-slate-400 text-xs italic font-normal">Not Provided</span>}</span>
                        </div>
                        <div className="flex items-start">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mr-2.5 shrink-0 mt-0.5" />
                          <span className="font-semibold text-slate-700 shrink-0">Address:</span>
                          <span className="ml-auto font-medium text-slate-600 text-right pl-2 leading-snug text-[11px]" title={emp.address}>{emp.address}</span>
                        </div>
                        <div className="flex items-center">
                          <IndianRupee className="w-3.5 h-3.5 text-slate-400 mr-2.5 shrink-0" />
                          <span className="font-semibold text-slate-700">Salary:</span>
                          <span className="ml-auto font-extrabold text-slate-700">{formatINR(emp.salary)}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2.5 shrink-0" />
                          <span className="font-semibold text-slate-700">Join Date:</span>
                          <span className="ml-auto font-medium text-slate-500">{emp.joinDate}</span>
                        </div>

                        {/* Inline Status Controller on card */}
                        {canEditEmployee(emp) && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                              <Sliders className="w-3 h-3 text-indigo-500" />
                              Status:
                            </span>
                            <select
                              value={normalizeEmployeeStatus(emp.status)}
                              onChange={(e) => {
                                const nextSt = e.target.value as EmployeeStatus;
                                setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, status: nextSt } : item));
                                const opt = STATUS_OPTIONS.find(o => o.value === nextSt);
                                setAssignSuccessToast(`Updated status of ${emp.name} to "${opt?.shortLabel || nextSt}"`);
                                setTimeout(() => setAssignSuccessToast(null), 3000);
                              }}
                              className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-800 text-[10px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-3xs"
                            >
                              {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.icon} {opt.shortLabel}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center shrink-0">
                      <button
                        onClick={() => setViewingEmployeeDetail(emp)}
                        className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors flex items-center cursor-pointer"
                        title="View Complete Profile & Residential Address"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-slate-400 hover:text-indigo-600" />
                        View Details
                      </button>

                      <div className="flex items-center space-x-2">
                        {canEditEmployee(emp) ? (
                          <button
                            onClick={() => {
                              setEditingEmployee(emp);
                              setEditingEmployeeOriginalId(emp.id);
                            }}
                            className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Modify
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Locked</span>
                        )}

                      {canDeleteEmployee(emp) && (
                        employeeIdPendingDelete === emp.id ? (
                          <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-100 p-1 rounded animate-fade-in">
                            <span className="text-[10px] text-rose-800 font-bold">Remove?</span>
                            <button
                              onClick={() => {
                                handleDeleteEmployee(emp.id);
                                setEmployeeIdPendingDelete(null);
                              }}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-extrabold uppercase cursor-pointer transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setEmployeeIdPendingDelete(null)}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[9px] font-extrabold uppercase cursor-pointer transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEmployeeIdPendingDelete(emp.id)}
                            className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors flex items-center cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </button>
                        )
                      )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredEmployees.length === 0 && (
                  <div className="col-span-full bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 text-xs">
                    No staff profiles match the criteria. Try a different query.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ASSIGN TASK (HR only - sees manager requests and can assign) */}
          {activeTab === 'assign-task' && ['admin', 'hr'].includes(activeUser.role) && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Assign Employee Tasks</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Evaluate task proposals received from department managers or initiate tasks proposed to managers first.
                  </p>
                </div>
                <button
                  onClick={() => setIsAssigningDirectly(true)}
                  className="bg-indigo-600 text-white font-extrabold text-xs px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm cursor-pointer"
                >
                  + Propose Direct Task (To Manager First)
                </button>
              </div>

              {/* Proposals and Approvals List */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Manager Proposals & HR Initatives</h3>
                    <p className="text-slate-400 text-[10px]">Track approvals and finalize assignments to standard employee roles.</p>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-extrabold uppercase">
                    Total: {proposals.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {proposals.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No task proposals found in the pipeline.
                    </div>
                  ) : (
                    proposals.map((prop) => {
                      const suggestedEmployee = employees.find(e => e.id === prop.proposedEmployeeId);
                      
                      // HR proposed tasks to Managers
                      if (prop.proposedByHR) {
                        return (
                          <div key={prop.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/20">
                            <div className="space-y-1.5 max-w-2xl">
                              <div className="flex items-center space-x-2">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                  prop.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                                  prop.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                                }`}>
                                  {prop.priority}
                                </span>
                                <span className="text-[10px] text-pink-600 font-mono font-bold uppercase tracking-wider bg-pink-50/50 px-1 py-0.5 rounded">
                                  HR Initiative
                                </span>
                                <span className="text-[10px] text-slate-400">• Approver: <strong>{prop.managerName}</strong></span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">{prop.title}</h4>
                              <p className="text-xs text-slate-500 leading-relaxed">{prop.description}</p>
                              <div className="flex space-x-3 text-[10px] text-slate-400">
                                <span>Due date: <strong>{prop.dueDate}</strong></span>
                                <span>•</span>
                                <span>Target Employee: <strong>{suggestedEmployee?.name || 'Unassigned'} ({suggestedEmployee?.department})</strong></span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center space-x-2">
                              {prop.status === 'assigned' ? (
                                <span className="inline-flex items-center text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                  <UserCheck className="w-3.5 h-3.5 mr-1" /> Formalized & Assigned
                                </span>
                              ) : prop.status === 'approved_by_manager' ? (
                                <button
                                  onClick={() => setAssigningProposal(prop)}
                                  className="bg-emerald-600 text-white font-extrabold text-xs px-3.5 py-2 rounded hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm animate-pulse"
                                >
                                  Provide Task to Employee
                                </button>
                              ) : (
                                <span className="inline-flex items-center text-xs text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                                  <Clock className="w-3.5 h-3.5 mr-1 text-amber-500" /> Awaiting Manager Approval
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Standard Manager proposed tasks to HR
                      return (
                        <div key={prop.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1.5 max-w-2xl">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                prop.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                                prop.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                              }`}>
                                {prop.priority}
                              </span>
                              <span className="text-[10px] text-indigo-600 font-mono font-bold">
                                Proposed by: {prop.managerName}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{prop.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{prop.description}</p>
                            <div className="flex space-x-3 text-[10px] text-slate-400">
                              <span>Due date: <strong>{prop.dueDate}</strong></span>
                              <span>•</span>
                              <span>Suggested Employee: <strong>{suggestedEmployee?.name || 'Unassigned'} ({suggestedEmployee?.department})</strong></span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-2">
                            {prop.status === 'assigned' ? (
                              <span className="inline-flex items-center text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                <UserCheck className="w-3.5 h-3.5 mr-1" /> Formalized & Assigned
                              </span>
                            ) : (
                              <button
                                onClick={() => setAssigningProposal(prop)}
                                className="bg-indigo-600 text-white font-extrabold text-xs px-3.5 py-2 rounded hover:bg-indigo-700 transition-colors cursor-pointer"
                              >
                                Review & Assign Formal Task
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROPOSE TASK (Manager only) */}
          {activeTab === 'propose-task' && activeUser.role === 'manager' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Assign Task</h2>
                  <p className="text-slate-500 text-xs mt-1">
                    Directly assign tasks to Employees and HRs with no review needed.
                  </p>
                </div>
                <button
                  onClick={() => setIsProposingTask(true)}
                  className="bg-indigo-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg hover:bg-indigo-700 shadow-sm cursor-pointer"
                >
                  + Assign Task
                </button>
              </div>

              {/* HR PROPOSALS FOR APPROVAL (Manager only) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-amber-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center text-amber-700">
                      <Clock className="w-4 h-4 mr-1.5" /> HR Task Proposals Awaiting Your Approval
                    </h3>
                    <p className="text-slate-400 text-[10px]">These tasks were proposed by HR for your department's staff. Review and approve them.</p>
                  </div>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').length} Pending
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No HR task proposals awaiting your approval.
                    </div>
                  ) : (
                    proposals.filter(p => p.proposedByHR && p.managerId === activeUser.id && p.status === 'manager_pending').map((prop) => {
                      const emp = employees.find(e => e.id === prop.proposedEmployeeId);
                      return (
                        <div key={prop.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                prop.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                                prop.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                              }`}>
                                {prop.priority}
                              </span>
                              <span className="text-[10px] text-pink-600 font-bold uppercase tracking-tight">Proposed by HR</span>
                              <span className="text-slate-400 text-[10px]">• Created: {prop.createdAt}</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{prop.title}</h4>
                            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">{prop.description}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Target Employee: <strong className="text-slate-600">{emp?.name || 'Unknown'}</strong> | Target Due Date: <strong className="text-slate-600">{prop.dueDate}</strong>
                            </p>
                          </div>

                          <div className="flex space-x-2 shrink-0">
                            <button
                              onClick={() => handleManagerApproveProposal(prop.id)}
                              className="bg-emerald-600 text-white font-extrabold text-xs px-3.5 py-2 rounded hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                            >
                              Approve & Clear to Assign
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Proposals history list */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Your Assigned & Proposed Tasks</h3>
                  <p className="text-slate-400 text-[10px]">Your directly assigned tasks and proposed tasks.</p>
                </div>

                <div className="divide-y divide-slate-100">
                  {proposals.filter(p => p.managerId === activeUser.id && !p.proposedByHR).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No task assignments or proposals created yet. Click "Assign Task" to start.
                    </div>
                  ) : (
                    proposals.filter(p => p.managerId === activeUser.id && !p.proposedByHR).map((prop) => {
                      const emp = employees.find(e => e.id === prop.proposedEmployeeId);
                      return (
                        <div key={prop.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                prop.priority === 'high' ? 'bg-rose-50 text-rose-600' :
                                prop.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                              }`}>
                                {prop.priority}
                              </span>
                              <span className="text-[10px] text-slate-400">Created: {prop.createdAt}</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{prop.title}</h4>
                            <p className="text-xs text-slate-500 max-w-xl">{prop.description}</p>
                            <p className="text-[10px] text-slate-400">
                              Suggested: <strong className="text-slate-600">{emp?.name || 'Unassigned'}</strong> | Due Date: <strong className="text-slate-600">{prop.dueDate}</strong>
                            </p>
                          </div>

                          <div>
                            {prop.status === 'assigned' ? (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Formally Assigned
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" /> Pending HR Review
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TEAM PROFILES (Manager only - views and edits department profiles) */}
          {activeTab === 'department-staff' && activeUser.role === 'manager' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Your Team Profiles</h2>
                <p className="text-slate-500 text-xs mt-1">
                  View and manage employee profiles belonging to your active team. Managers can edit details of their department staff.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees
                  .filter(emp => emp.id !== activeUser.id) // Exclude oneself
                  .map((emp) => (
                    <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex items-center space-x-3.5 pb-3 border-b border-slate-100">
                          <div className={`w-11 h-11 rounded-lg flex items-center justify-center font-bold text-base shadow-sm ${emp.avatarColor}`}>
                            {emp.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-slate-800 leading-snug">{emp.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{emp.jobTitle}</p>
                            <span className="inline-block text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded tracking-wider bg-slate-100 text-slate-600 mt-1">
                              {emp.department}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600">
                          <p><strong>Phone:</strong> {emp.phone || <span className="text-slate-400 italic font-normal">Not Provided</span>}</p>
                          <p><strong>Address:</strong> {emp.address || <span className="text-slate-400 italic font-normal">Not Provided</span>}</p>
                          <p><strong>Emergency:</strong> {emp.emergencyContact || <span className="text-slate-400 italic font-normal">Not Provided</span>}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 mr-1" /> Modify Team Profile
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 6: ATTENDANCE LOGS (Universal view) */}
          {activeTab === 'attendance-logs' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verified Attendance Logs</h2>
                <p className="text-slate-500 text-xs mt-1">
                  History of verified punch-in and punch-out events. Showing chronological attendance registry.
                </p>
              </div>

              {/* Mark Absentees & Quota Enforcement Panel (Admin/Manager/HR) */}
              {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                <div className="bg-white rounded-xl border border-indigo-100 p-5 shadow-xs space-y-4 animate-fade-in">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-50/80 pb-3">
                    <div className="flex items-center space-x-2 text-indigo-700">
                      <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                      </div>
                      <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                          Unresolved Daily Attendance & Quota Rules (Today)
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Staff allowance policy: <strong>2 Casual Leaves (CL)</strong> and <strong>2 Paid Half Days</strong> per month. Unpunched days are credited as <strong>CL (Paid)</strong> until 2 are exhausted, then marked as <strong>Absent (Unpaid)</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const todayStr = getLocalDateString();
                          if (isDateSunday(todayStr) || getHolidayForDate(todayStr)) return;

                          const pending = employees.filter(emp => {
                            if (emp.role === 'admin') return false;
                            if (isEmployeeInactiveOrCompleted(emp)) return false;
                            if (getPunchInTime(emp.id)) return false;
                            if (getLeaveForDateAndEmployee(emp.id, todayStr)) return false;
                            const hasLog = attendance.some(log => log.userId === emp.id && log.date === todayStr);
                            return !hasLog;
                          });

                          if (pending.length === 0) {
                            alert('All staff attendances for today are already resolved!');
                            return;
                          }

                          const newLogs: AttendanceLog[] = [];
                          let simulatedLogs = [...attendance];

                          pending.forEach(emp => {
                            const status = resolveUnpunchedStatus(emp.id, todayStr, simulatedLogs, leaveRequests);
                            const newLog: AttendanceLog = {
                              id: `ATT-${Date.now()}-${emp.id}`,
                              userId: emp.id,
                              userName: emp.name || 'Unknown Employee',
                              userRole: emp.role || 'employee',
                              date: todayStr,
                              checkIn: '---',
                              checkOut: '---',
                              duration: '0h 00m',
                              status: status
                            };
                            newLogs.push(newLog);
                            simulatedLogs.push(newLog);
                          });

                          setAttendance(prev => [...newLogs, ...prev]);
                          flushPendingWrites();
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
                        title="Auto-resolve every missing staff member today based on 2 CL & Absent rules"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Auto-Resolve All Today (2 CL Quota)</span>
                      </button>

                      <button
                        onClick={() => {
                          // Scan all past working days of the current month up to yesterday
                          const todayStr = getLocalDateString();
                          const parts = todayStr.split('-');
                          const year = parseInt(parts[0], 10);
                          const month = parseInt(parts[1], 10);
                          const currentDay = parseInt(parts[2], 10);

                          let addedCount = 0;
                          let simulatedLogs = [...attendance];
                          const newLogs: AttendanceLog[] = [];

                          for (let d = 1; d < currentDay; d++) {
                            const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            if (isDateSunday(dayStr) || getHolidayForDate(dayStr)) continue;

                            employees.forEach(emp => {
                              if (emp.role === 'admin') return;
                              if (isEmployeeInactiveOrCompleted(emp)) return;
                              if (getLeaveForDateAndEmployee(emp.id, dayStr)) return;
                              const hasLog = simulatedLogs.some(l => l.userId === emp.id && l.date === dayStr);
                              if (hasLog) return;

                              const status = resolveUnpunchedStatus(emp.id, dayStr, simulatedLogs, leaveRequests);
                              const newLog: AttendanceLog = {
                                id: `ATT-${Date.now()}-${emp.id}-${d}`,
                                userId: emp.id,
                                userName: emp.name || 'Unknown Employee',
                                userRole: emp.role || 'employee',
                                date: dayStr,
                                checkIn: '---',
                                checkOut: '---',
                                duration: '0h 00m',
                                status: status
                              };
                              newLogs.push(newLog);
                              simulatedLogs.push(newLog);
                              addedCount++;
                            });
                          }

                          if (addedCount === 0) {
                            alert('All past working days in this month are already recorded and resolved.');
                          } else {
                            setAttendance(prev => [...newLogs, ...prev]);
                            flushPendingWrites();
                            alert(`Resolved ${addedCount} past unpunched day(s) across staff according to 2 CL & Absent rules!`);
                          }
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
                        title="Scan past days of this month and fill any unpunched working days"
                      >
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Scan Past Days in Month</span>
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const todayStr = getLocalDateString();
                    const isTodaySunday = isDateSunday(todayStr);
                    const todayHoliday = getHolidayForDate(todayStr);
                    const isHolidayOrSunday = isTodaySunday || !!todayHoliday;

                    if (isHolidayOrSunday) {
                      return (
                        <p className="text-xs text-indigo-600 font-semibold bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 inline-block">
                          🏖️ Today is {isTodaySunday ? "Sunday (Weekly Off)" : `a Holiday: ${todayHoliday?.name}`}. No attendance resolves or punch-ins are required.
                        </p>
                      );
                    }

                    const pendingAbsentees = employees.filter(emp => {
                      if (emp.role === 'admin') return false;
                      if (isEmployeeInactiveOrCompleted(emp)) return false;
                      if (getPunchInTime(emp.id)) return false;
                      if (getLeaveForDateAndEmployee(emp.id, todayStr)) return false;
                      const hasLogToday = attendance.some(log => log.userId === emp.id && log.date === todayStr);
                      return !hasLogToday;
                    });

                    if (pendingAbsentees.length === 0) {
                      return (
                        <div className="flex items-center space-x-2 text-xs text-emerald-700 font-bold bg-emerald-50/60 p-3 rounded-lg border border-emerald-100/60">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>✓ All active employee attendances are resolved for today ({todayStr})!</span>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {pendingAbsentees.map(emp => {
                          const quota = getMonthlyQuotaCounts(emp.id, todayStr.substring(0, 7), attendance, leaveRequests);
                          const resolvedStatus = resolveUnpunchedStatus(emp.id, todayStr, attendance, leaveRequests);
                          const isCL = resolvedStatus === 'Casual Leave (CL)';

                          return (
                            <div key={emp.id} className="flex flex-col justify-between bg-slate-50 border border-slate-200/70 p-3 rounded-xl hover:shadow-xs transition-shadow">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-bold text-slate-800 leading-tight">{emp.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-0.5">
                                    {emp.department} • <span className="font-mono">{emp.id}</span>
                                  </p>
                                </div>
                                {isCL ? (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 shrink-0">
                                    CL: {quota.clUsed}/2 used ({quota.clRemaining} left)
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                                    CL Exhausted (2/2)
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-slate-500">
                                  Policy Mark: <strong className={isCL ? "text-teal-700" : "text-rose-700"}>{resolvedStatus}</strong>
                                </span>

                                <div className="flex items-center space-x-1.5">
                                  <button
                                    onClick={() => {
                                      const newLog: AttendanceLog = {
                                        id: `ATT-${Date.now()}-${emp.id}`,
                                        userId: emp.id,
                                        userName: emp.name || 'Unknown Employee',
                                        userRole: emp.role || 'employee',
                                        date: todayStr,
                                        checkIn: '---',
                                        checkOut: '---',
                                        duration: '0h 00m',
                                        status: resolvedStatus
                                      };
                                      setAttendance(prev => [newLog, ...prev]);
                                      flushPendingWrites();
                                    }}
                                    className={`px-2.5 py-1 text-white rounded text-[10px] font-extrabold uppercase transition-colors cursor-pointer shadow-xs ${
                                      isCL ? 'bg-teal-600 hover:bg-teal-700' : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                                  >
                                    {isCL ? 'Mark as CL (Paid)' : 'Mark Absent (Unpaid)'}
                                  </button>

                                  <button
                                    onClick={() => {
                                      const override = isCL ? 'Absent' : 'Casual Leave (CL)';
                                      const newLog: AttendanceLog = {
                                        id: `ATT-${Date.now()}-${emp.id}`,
                                        userId: emp.id,
                                        userName: emp.name || 'Unknown Employee',
                                        userRole: emp.role || 'employee',
                                        date: todayStr,
                                        checkIn: '---',
                                        checkOut: '---',
                                        duration: '0h 00m',
                                        status: override
                                      };
                                      setAttendance(prev => [newLog, ...prev]);
                                      flushPendingWrites();
                                    }}
                                    className="px-1.5 py-1 text-[9px] font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                                    title={`Manually override to ${isCL ? 'Absent' : 'Casual Leave (CL)'}`}
                                  >
                                    or {isCL ? 'Absent' : 'CL'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                   <div>
                     <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Verified Registry</h3>
                     <p className="text-[10px] text-slate-400 mt-0.5">Showing filtered records according to your role permissions</p>
                   </div>
                   <div className="flex items-center space-x-2">
                     {activeUser.role === 'admin' && (
                       <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                         {showClearAttendanceConfirm ? (
                           <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 p-1 rounded animate-fade-in">
                             <span className="text-[10px] text-rose-800 font-bold font-sans">
                               Clear {getFilteredAttendance().length} logs?
                             </span>
                             <button
                               onClick={() => {
                                 const visibleLogs = getFilteredAttendance();
                                 const visibleIds = new Set(visibleLogs.map(l => l.id));
                                 setAttendance(prev => prev.filter(item => !visibleIds.has(item.id)));
                                 setPunchInTimes(prev => {
                                   const copy = { ...prev };
                                   visibleLogs.forEach(log => {
                                     if (log.id.startsWith('ACTIVE-PUNCH-')) {
                                       const empId = log.id.replace('ACTIVE-PUNCH-', '');
                                       delete copy[empId];
                                     }
                                   });
                                   return copy;
                                 });
                                 setShowClearAttendanceConfirm(false);
                               }}
                               className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-extrabold uppercase cursor-pointer transition-colors"
                             >
                               Yes, Clear
                             </button>
                             <button
                               onClick={() => setShowClearAttendanceConfirm(false)}
                               className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-extrabold uppercase cursor-pointer transition-colors"
                             >
                               Cancel
                             </button>
                           </div>
                         ) : (
                           <button
                             onClick={() => setShowClearAttendanceConfirm(true)}
                             className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition-colors shadow-xs cursor-pointer"
                             title="Delete currently filtered logs"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                             <span>Clear Filtered Logs</span>
                           </button>
                         )}

                         {showWipeAttendanceConfirm ? (
                           <div className="flex items-center space-x-2 bg-red-100 border border-red-300 p-1.5 rounded animate-fade-in shadow-xs animate-pulse">
                             <span className="text-[10px] text-red-900 font-extrabold font-sans uppercase tracking-tight">
                               Wipe SQLite DB?
                             </span>
                             <button
                               onClick={() => {
                                 setAttendance([], true);
                                 setPunchInTimes({});
                                 setShowWipeAttendanceConfirm(false);
                               }}
                               className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-black uppercase cursor-pointer transition-colors shadow-xs"
                             >
                               Confirm Wipe All
                             </button>
                             <button
                               onClick={() => setShowWipeAttendanceConfirm(false)}
                               className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-extrabold uppercase cursor-pointer transition-colors"
                             >
                               Cancel
                             </button>
                           </div>
                         ) : (
                           <button
                             onClick={() => setShowWipeAttendanceConfirm(true)}
                             className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-bold transition-colors shadow-xs cursor-pointer animate-fade-in"
                             title="Permanently wipe all attendance records from the database"
                           >
                             <Trash2 className="w-3.5 h-3.5 text-red-600" />
                             <span className="text-red-700 font-extrabold">Permanently Delete All Database Attendance</span>
                           </button>
                         )}
                       </div>
                     )}
                     <button
                       onClick={() => {
                         const visibleLogs = getFilteredAttendance();
                         exportAttendanceToExcel(visibleLogs, `${activeUser.name}_Attendance_Report`);
                       }}
                       className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors shadow-xs cursor-pointer"
                     >
                       <Download className="w-3.5 h-3.5" />
                       <span>Download Report (Excel)</span>
                     </button>

                     {activeUser.role === 'admin' && (
                       <button
                         onClick={() => {
                           const nonAdminEmployees = employees.filter(e => e.role !== 'admin');
                           const firstEmp = nonAdminEmployees[0]?.id || employees[0]?.id || '';
                           setAddAttendanceEmpId(firstEmp);
                           setShowAddAttendanceModal(true);
                         }}
                         className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors shadow-xs cursor-pointer animate-fade-in"
                       >
                         <span>+ Add Attendance Log</span>
                       </button>
                     )}

                   </div>
                 </div>

                 {/* Search and Filter Row */}
                 <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 space-y-3">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
                     <div className="relative w-full">
                       <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                         <Search className="w-3.5 h-3.5" />
                       </span>
                       <input
                         type="text"
                         placeholder="Search name, date, role..."
                         value={attendanceSearch}
                         onChange={(e) => setAttendanceSearch(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
                       />
                       {attendanceSearch && (
                         <button
                           onClick={() => setAttendanceSearch('')}
                           className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                         >
                           <X className="w-3 h-3" />
                         </button>
                       )}
                     </div>

                     <div className="flex items-center space-x-2 w-full">
                       <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                         <Calendar className="w-3 h-3 text-indigo-600" />
                         <span>Date:</span>
                       </label>
                       <select
                         value={attendanceDateFilter}
                         onChange={(e) => setAttendanceDateFilter(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg text-xs font-bold px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
                       >
                         <option value="all">All Dates</option>
                         <option value="today">Today ({getLocalDateString()})</option>
                         <option value="month-2026-10">October 2026</option>
                         <option value="month-2026-09">September 2026</option>
                         <option value="month-2026-08">August 2026</option>
                         <option value="month-2026-07">July 2026</option>
                         <option value="custom">Pick Specific Date...</option>
                       </select>
                     </div>

                     <div className="flex items-center space-x-2 w-full">
                       <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Role:</label>
                       <select
                         value={attendanceRoleFilter}
                         onChange={(e) => setAttendanceRoleFilter(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
                       >
                         <option value="all">All Roles</option>
                         <option value="admin">Admin</option>
                         <option value="manager">Manager</option>
                         <option value="hr">HR</option>
                         <option value="employee">Employee</option>
                       </select>
                     </div>

                     <div className="flex items-center space-x-2 w-full">
                       <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Dept:</label>
                       <select
                         value={attendanceDeptFilter}
                         onChange={(e) => setAttendanceDeptFilter(e.target.value)}
                         className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
                       >
                         <option value="all">All Departments</option>
                         {departments.map(dept => (
                           <option key={dept.id} value={dept.name}>{dept.name}</option>
                         ))}
                       </select>
                     </div>

                     <div className="flex items-center space-x-2 w-full">
                       <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status:</label>
                       <select
                        value={attendanceStatusFilter}
                        onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-xs"
                      >
                        <option value="all">All Statuses</option>
                        <option value="On Time">On Time</option>
                        <option value="Late">Late</option>
                        <option value="Casual Leave (CL)">Casual Leave (CL)</option>
                        <option value="Paid Half Day">Paid Half Day</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Absent">Absent</option>
                        <option value="On Leave">On Leave</option>
                        <option value="Sunday Off">Sunday Off</option>
                        <option value="Holiday">Holiday</option>
                      </select>
                     </div>
                   </div>

                   <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 text-xs">
                     <div className="flex items-center space-x-3">
                       {attendanceDateFilter === 'custom' && (
                         <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
                           <span className="text-[10px] font-bold text-indigo-700 uppercase">Select Date:</span>
                           <input
                             type="date"
                             value={attendanceCustomDate}
                             onChange={(e) => setAttendanceCustomDate(e.target.value)}
                             className="bg-white border border-indigo-200 rounded px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                           />
                         </div>
                       )}
                       <span className="text-slate-500 text-[11px] font-medium">
                         Showing <strong className="text-slate-900 font-extrabold">{getFilteredAttendance().length}</strong> verified records
                         {attendanceDateFilter === '2026-09-07' && <span className="text-indigo-600 font-bold ml-1">(for 07/09/2026)</span>}
                         {attendanceDateFilter === '2026-09-08' && <span className="text-indigo-600 font-bold ml-1">(for Today 08/09/2026)</span>}
                         {attendanceDateFilter === '2026-09-09' && <span className="text-indigo-600 font-bold ml-1">(for Tomorrow 09/09/2026)</span>}
                       </span>
                     </div>

                     <div className="flex items-center space-x-2">
                       <button
                         onClick={() => setAttendanceSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                         className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                         title="Toggle date sorting order"
                       >
                         <ArrowUpDown className="w-3 h-3 text-slate-500" />
                         <span>Order: <strong className="text-indigo-600">{attendanceSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</strong></span>
                       </button>

                       {(attendanceSearch || attendanceRoleFilter !== 'all' || attendanceDeptFilter !== 'all' || attendanceStatusFilter !== 'all' || attendanceDateFilter !== 'all') && (
                         <button
                           onClick={() => {
                             setAttendanceSearch('');
                             setAttendanceRoleFilter('all');
                             setAttendanceDeptFilter('all');
                             setAttendanceStatusFilter('all');
                             setAttendanceDateFilter('all');
                             setAttendanceCustomDate('');
                           }}
                           className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded cursor-pointer transition-colors"
                         >
                           Reset Filters
                         </button>
                       )}
                     </div>
                   </div>
                 </div>

                   <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left border-collapse border border-slate-200">
                     <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold">
                       <tr>
                         <th className="w-12 px-3 py-3 border border-slate-200 text-center">No.</th>
                         <th className="px-4 py-3 border border-slate-200">Date</th>
                         <th className="px-4 py-3 border border-slate-200">Emp ID (No.)</th>
                         <th className="px-4 py-3 border border-slate-200">Employee Name</th>
                         <th className="px-4 py-3 border border-slate-200">Department</th>
                         <th className="px-4 py-3 border border-slate-200">Role</th>
                         <th className="px-4 py-3 border border-slate-200">Punch-In Time</th>
                         <th className="px-4 py-3 border border-slate-200">Punch-Out Time</th>
                         <th className="px-4 py-3 border border-slate-200">Duration</th>
                         <th className="px-4 py-3 border border-slate-200">Status</th>
                         {activeUser.role === "admin" && (
                           <th className="px-4 py-3 border border-slate-200 text-center">Action</th>
                         )}
                       </tr>
                     </thead>
                     <tbody className="text-xs text-slate-700">
                       {getFilteredAttendance().map((log, logIdx) => {
                         const employeeRecord = employees.find(e => e.id === log.userId);
                         const departmentName = employeeRecord?.department || 'General';
                         return (
                           <tr key={log.id} className="hover:bg-slate-50/70 odd:bg-slate-50/10 even:bg-white transition-colors">
                             <td className="px-3 py-3 border border-slate-200 text-center font-mono font-bold text-slate-400 text-[11px]">
                               {logIdx + 1}
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                               {activeUser.role === 'admin' ? (
                                 <input
                                   type="date"
                                   value={log.date}
                                   onChange={(e) => {
                                     const newDate = e.target.value;
                                     if (!newDate) return;
                                     setAttendance(prev => prev.map(item => {
                                       if (item.id === log.id) {
                                         const isAbsentOrLeave = ['Absent', 'On Leave'].includes(item.status || 'On Time');
                                         const duration = isAbsentOrLeave ? '0h 00m' : calculateDurationStr(item.checkIn, item.checkOut || '---', newDate);
                                         return {
                                           ...item,
                                           date: newDate,
                                           duration
                                         };
                                       }
                                       return item;
                                     }));
                                   }}
                                   className="border border-slate-200 rounded px-1.5 py-1 text-xs font-bold bg-white text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                 />
                               ) : (
                                 log.date
                               )}
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-mono text-xs text-slate-500 whitespace-nowrap">
                               {log.userId}
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-bold text-slate-800">
                               {log.userName}
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-medium text-slate-600 whitespace-nowrap">
                               {departmentName}
                             </td>
                             <td className="px-4 py-3 border border-slate-200">
                               <span className="uppercase text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide bg-slate-100 text-slate-600 border border-slate-200/50">
                                 {log.userRole}
                                </span>
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-mono text-slate-600">
                               {['admin', 'manager', 'hr'].includes(activeUser.role) && !['Absent', 'On Leave', 'Casual Leave (CL)', 'Sunday Off', 'Holiday'].includes(log.status || '') ? (
                                 <div className="flex items-center space-x-2">
                                   <input
                                     type="time"
                                     value={convertTo24Hour(log.checkIn)}
                                     onChange={(e) => {
                                        const new12Hr = convertTo12Hour(e.target.value);
                                        if (log.id.startsWith('ACTIVE-PUNCH-')) {
                                          const empId = log.id.replace('ACTIVE-PUNCH-', '');
                                          setPunchInTimes(prev => ({ ...prev, [empId]: new12Hr }));
                                        } else {
                                          setAttendance(prev => prev.map(item => {
                                            if (item.id === log.id) {
                                              const updatedCheckOut = item.checkOut === '---' ? '05:00 PM' : item.checkOut || '05:00 PM';
                                              const duration = calculateDurationStr(new12Hr, updatedCheckOut, item.date);
                                              const status = getAttendanceStatus(new12Hr, officeTime, item.date, item.userId, attendance, leaveRequests, updatedCheckOut, item.id);
                                              return {
                                                ...item,
                                                checkIn: new12Hr,
                                                checkOut: updatedCheckOut,
                                                duration: duration,
                                                status: status
                                              };
                                            }
                                            return item;
                                          }));
                                        }
                                      }}
                                     className="bg-white border border-slate-200 rounded px-1 py-0.5 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500 cursor-pointer w-[90px]"
                                   />
                                   <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold font-mono whitespace-nowrap">{log.checkIn}</span>
                                 </div>
                               ) : (
                                 log.checkIn
                               )}
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-mono text-slate-600">
                               {['admin', 'manager', 'hr'].includes(activeUser.role) && !['Absent', 'On Leave', 'Casual Leave (CL)', 'Sunday Off', 'Holiday'].includes(log.status || '') ? (
                                 <div className="flex items-center space-x-2">
                                   <input
                                     type="time"
                                     value={convertTo24Hour(log.checkOut && log.checkOut !== '---' ? log.checkOut : '05:00 PM')}
                                     onChange={(e) => {
                                        const new12Hr = convertTo12Hour(e.target.value);
                                        if (log.id.startsWith('ACTIVE-PUNCH-')) {
                                          const empId = log.id.replace('ACTIVE-PUNCH-', '');
                                          const updatedCheckIn = log.checkIn;
                                          const duration = calculateDurationStr(updatedCheckIn, new12Hr, log.date);
                                          const status = getAttendanceStatus(updatedCheckIn, officeTime, log.date, empId, attendance, leaveRequests, new12Hr, log.id);
                                          const newFinishedLog = {
                                            id: `ATT-${Date.now()}`,
                                            userId: empId,
                                            userName: log.userName,
                                            userRole: log.userRole,
                                            date: log.date,
                                            checkIn: updatedCheckIn,
                                            checkOut: new12Hr,
                                            duration: duration,
                                            status: status
                                          };
                                          setAttendance(prev => [newFinishedLog, ...prev]);
                                          setPunchInTimes(prev => {
                                            const copy = { ...prev };
                                            delete copy[empId];
                                            return copy;
                                          });
                                        } else {
                                          setAttendance(prev => prev.map(item => {
                                            if (item.id === log.id) {
                                              const updatedCheckIn = item.checkIn === '---' ? '09:30 AM' : item.checkIn || '09:30 AM';
                                              const duration = calculateDurationStr(updatedCheckIn, new12Hr, item.date);
                                              return {
                                                ...item,
                                                checkOut: new12Hr,
                                                duration: duration
                                              };
                                            }
                                            return item;
                                          }));
                                        }
                                      }}
                                     className="bg-white border border-slate-200 rounded px-1 py-0.5 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500 cursor-pointer w-[90px]"
                                   />
                                   <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-bold font-mono whitespace-nowrap">{log.checkOut || 'Active Session'}</span>
                                 </div>
                               ) : (
                                 log.checkOut || 'Active Session'
                               )}
                             </td>
                             <td className="px-4 py-3 border border-slate-200 font-medium text-slate-800 whitespace-nowrap">
                               {log.duration ? (
                                 <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded font-bold font-mono">
                                   {log.duration}
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded animate-pulse font-bold font-mono">
                                   In-Progress
                                 </span>
                               )}
                             </td>
                             <td className="px-4 py-3 border border-slate-200">
                                {['admin', 'manager', 'hr'].includes(activeUser.role) ? (
                                  <select
                                    value={log.status || 'On Time'}
                                    onChange={(e) => {
                                       const newStatus = e.target.value as any;
                                       const isFullOff = ['Absent', 'On Leave', 'Casual Leave (CL)', 'Sunday Off', 'Holiday'].includes(newStatus);
                                       if (log.id.startsWith('ACTIVE-PUNCH-')) {
                                         const empId = log.id.replace('ACTIVE-PUNCH-', '');
                                         if (isFullOff) {
                                           const newFinishedLog = {
                                             id: `ATT-${Date.now()}`,
                                             userId: empId,
                                             userName: log.userName,
                                             userRole: log.userRole,
                                             date: log.date,
                                             checkIn: '---',
                                             checkOut: '---',
                                             duration: '0h 00m',
                                             status: newStatus
                                           };
                                           setAttendance(prev => [newFinishedLog, ...prev]);
                                           setPunchInTimes(prev => {
                                             const copy = { ...prev };
                                             delete copy[empId];
                                             return copy;
                                           });
                                         } else {
                                           const updatedCheckIn = log.checkIn || '09:30 AM';
                                           const updatedCheckOut = '05:00 PM';
                                           const duration = calculateDurationStr(updatedCheckIn, updatedCheckOut, log.date);
                                           const newFinishedLog = {
                                             id: `ATT-${Date.now()}`,
                                             userId: empId,
                                             userName: log.userName,
                                             userRole: log.userRole,
                                             date: log.date,
                                             checkIn: updatedCheckIn,
                                             checkOut: updatedCheckOut,
                                             duration: duration,
                                             status: newStatus
                                           };
                                           setAttendance(prev => [newFinishedLog, ...prev]);
                                           setPunchInTimes(prev => {
                                             const copy = { ...prev };
                                             delete copy[empId];
                                             return copy;
                                           });
                                         }
                                       } else {
                                         setAttendance(prev => prev.map(item => {
                                           if (item.id === log.id) {
                                             let updatedCheckIn = item.checkIn;
                                             let updatedCheckOut = item.checkOut;
                                             let updatedDuration = item.duration;
                                             if (isFullOff) {
                                               updatedCheckIn = '---';
                                               updatedCheckOut = '---';
                                               updatedDuration = '0h 00m';
                                             } else if (item.checkIn === '---' || !item.checkIn) {
                                               updatedCheckIn = '09:30 AM';
                                               updatedCheckOut = '05:00 PM';
                                               updatedDuration = '7h 30m';
                                             }
                                             return {
                                               ...item,
                                               status: newStatus,
                                               checkIn: updatedCheckIn,
                                               checkOut: updatedCheckOut,
                                               duration: updatedDuration
                                             };
                                           }
                                           return item;
                                         }));
                                       }
                                     }}
                                    className="bg-white border border-slate-200 rounded text-[10px] font-bold px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800"
                                  >
                                    <option value="On Time">On Time</option>
                                    <option value="Late">Late</option>
                                    <option value="Casual Leave (CL)">Casual Leave (CL) (Paid)</option>
                                    <option value="Paid Half Day">Paid Half Day (Paid)</option>
                                    <option value="Half Day">Half Day (Unpaid)</option>
                                    <option value="Absent">Absent (Unpaid)</option>
                                    <option value="On Leave">On Leave</option>
                                    <option value="Sunday Off">Sunday Off</option>
                                    <option value="Holiday">Holiday</option>
                                  </select>
                                ) : (
                                  <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                                    log.status === 'Casual Leave (CL)' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                                    log.status === 'Paid Half Day' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                    log.status === 'Half Day' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                    log.status === 'Late' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                    log.status === 'Absent' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                    log.status === 'On Leave' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                                    log.status === 'Sunday Off' ? 'bg-slate-100 text-slate-800 border-slate-200' :
                                    log.status === 'Holiday' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                    'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}>
                                    {log.status || 'On Time'}
                                  </span>
                                )}
                              </td>
                             {activeUser.role === "admin" && (
                               <td className="px-4 py-3 border border-slate-200 text-center">
                                 <button
                                   onClick={() => handleDeleteAttendanceLog(log.id, log.userId)}
                                   className="text-rose-600 hover:text-rose-800 font-bold text-[10px] flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-100/70 px-2 py-1.5 rounded-md cursor-pointer transition-colors mx-auto"
                                   title="Delete attendance record"
                                 >
                                   <Trash2 className="w-3 h-3 mr-1" />
                                   Delete
                                 </button>
                               </td>
                             )}
                           </tr>
                         );
                       })}
                       {getFilteredAttendance().length === 0 && (
                         <tr key="empty-attendance">
                           <td colSpan={activeUser.role === "admin" ? 10 : 9} className="px-6 py-8 text-center text-slate-400 text-xs font-semibold">
                             No attendance records visible for the selected filters.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>

              {showAddAttendanceModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-indigo-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Add Attendance Record</h3>
                      </div>
                      <button 
                        onClick={() => setShowAddAttendanceModal(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    <form onSubmit={handleAddAttendanceSubmit} className="p-6 space-y-4">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Select Employee
                        </label>
                        <select
                          value={addAttendanceEmpId}
                          onChange={(e) => setAddAttendanceEmpId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          required
                        >
                          <option value="">-- Choose Employee --</option>
                          {employees.filter(emp => (emp.role || '') !== "admin").map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.id} • {(emp.role || '').toUpperCase()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={addAttendanceDate}
                          onChange={(e) => setAddAttendanceDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Attendance Status
                        </label>
                        <select
                          value={addAttendanceStatus}
                          onChange={(e) => setAddAttendanceStatus(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="On Time">On Time</option>
                          <option value="Late">Late</option>
                          <option value="Casual Leave (CL)">Casual Leave (CL) (Paid)</option>
                          <option value="Paid Half Day">Paid Half Day (Paid)</option>
                          <option value="Half Day">Half Day (Unpaid)</option>
                          <option value="Absent">Absent (Unpaid)</option>
                          <option value="On Leave">On Leave</option>
                          <option value="Auto Calculate">Auto Calculate (Quota Rules)</option>
                        </select>
                      </div>

                      {!["Absent", "On Leave", "Casual Leave (CL)", "Sunday Off", "Holiday"].includes(addAttendanceStatus) && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                              Punch-In Time
                            </label>
                            <input
                              type="time"
                              value={addAttendanceCheckIn}
                              onChange={(e) => setAddAttendanceCheckIn(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                              required={!["Absent", "On Leave", "Casual Leave (CL)", "Sunday Off", "Holiday"].includes(addAttendanceStatus)}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                              Punch-Out Time
                            </label>
                            <input
                              type="time"
                              value={addAttendanceCheckOut}
                              onChange={(e) => setAddAttendanceCheckOut(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                              required={!["Absent", "On Leave", "Casual Leave (CL)", "Sunday Off", "Holiday"].includes(addAttendanceStatus)}
                            />
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowAddAttendanceModal(false)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                        >
                          Add Record
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: PERSONAL PROFILE (Universal view) */}
          {activeTab === 'my-profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">My Personal Profile</h2>
                <p className="text-slate-500 text-xs mt-1">
                  View your secure identity, phone, address, and financial variables. Profiles can be modified by managers, HRs, or administrators.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm max-w-3xl overflow-hidden">
                <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center font-bold text-xl sm:text-2xl shadow-sm shrink-0 ${activeUser.avatarColor}`}>
                    {activeUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 leading-snug">{activeUser.name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{activeUser.jobTitle}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {activeUser.role}
                      </span>
                      {activeUser.department && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {activeUser.department}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Employee ID</span>
                      <p className="font-bold text-slate-800 text-xs">{activeUser.id}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</span>
                      <p className="font-bold text-slate-800 text-xs">{activeUser.email}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Phone Number</span>
                      <p className="font-bold text-slate-800 text-xs">{activeUser.phone || <span className="text-slate-400 italic font-normal">Not Provided</span>}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Residential Address</span>
                      <p className="font-bold text-slate-800 text-xs">{activeUser.address || <span className="text-slate-400 italic font-normal">Not Provided</span>}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Emergency Contact Details</span>
                      <p className="font-bold text-slate-800 text-xs">{activeUser.emergencyContact || <span className="text-slate-400 italic font-normal">Not Provided</span>}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Annually Gross Salary</span>
                      <p className="font-mono font-bold text-slate-800 text-xs">{activeUser.salary}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Enrollment Join Date</span>
                      <p className="font-bold text-slate-800 text-xs">{activeUser.joinDate}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">System Profile Status</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-800 mt-1">
                        Active Employee
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs text-slate-400">
                    <Lock className="w-4 h-4 text-slate-300" />
                    <span>Profiles can only be edited by authorized administrators, HR specialists, or direct department managers.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: STAFF STATUS & INTERNSHIP CONTROLLER */}
          {activeTab === 'status-manager' && ['admin', 'hr', 'manager'].includes(activeUser.role) && (
            <div className="space-y-6 animate-fade-in">
              <StaffStatusManagerTab
                employees={employees}
                setEmployees={setEmployees}
                activeUser={activeUser}
                onStatusChangeToast={(msg) => {
                  setAssignSuccessToast(msg);
                  setTimeout(() => setAssignSuccessToast(null), 3000);
                }}
              />
            </div>
          )}

          {/* TAB: DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="space-y-6 animate-fade-in">
              <DepartmentsTab
                departments={departments}
                setDepartments={setDepartments}
                activeUser={activeUser}
                employees={employees}
                setEmployees={setEmployees}
              />
            </div>
          )}

          {/* TAB: LEAVE REQUESTS */}
          {activeTab === 'leave-requests' && (
            <div className="space-y-6 animate-fade-in">
              <LeaveRequestsTab
                leaveRequests={leaveRequests}
                setLeaveRequests={setLeaveRequests}
                activeUser={activeUser}
              />
            </div>
          )}

          {/* TAB: HOLIDAYS & CALENDAR */}
          {activeTab === 'holidays' && (
            <div className="space-y-6 animate-fade-in">
              <HolidaysTab
                holidays={holidays}
                setHolidays={setHolidays}
                activeUser={activeUser}
              />
            </div>
          )}

          {/* TAB: PAYROLL */}
          {activeTab === 'payroll' && (
            <div className="space-y-6 animate-fade-in">
              <PayrollTab
                employees={employees}
                attendance={attendance}
                leaveRequests={leaveRequests}
                salaries={salaries}
                setSalaries={setSalaries}
                activeUser={activeUser}
                holidays={holidays}
              />
            </div>
          )}

          {/* TAB: SMTP MAIL OUTBOX & SERVICE LAYER */}
          {activeTab === 'smtp-outbox' && (
            <div className="space-y-6 animate-fade-in">
              <SmtpMailOutboxTab
                employees={employees}
                activeUser={activeUser}
                onNavigateToTab={(tab) => selectTab(tab)}
              />
            </div>
          )}

          {/* TAB: 404 NOT FOUND VIEW */}
          {!VALID_TABS.includes(activeTab) && (
            <NotFoundView
              onNavigateHome={() => selectTab('dashboard')}
              onNavigateTab={(tab) => selectTab(tab)}
            />
          )}

        </div>

        {/* ENTERPRISE COMPLIANCE & ACCESSIBILITY FOOTER */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-6 px-4 md:px-8 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center space-x-2 text-center sm:text-left">
              <span className="font-extrabold text-slate-800">HRMS System</span>
              <span>•</span>
              <span>Enterprise Workforce &amp; Payroll Management</span>
            </div>
            <div className="flex items-center flex-wrap justify-center gap-4 text-xs font-semibold">
              <button
                onClick={() => setIsPrivacyModalOpen(true)}
                className="hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <span>•</span>
              <button
                onClick={() => setIsTermsModalOpen(true)}
                className="hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Terms &amp; Conditions
              </button>
              <span>•</span>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('hrms_cookie_consent');
                    window.location.reload();
                  } catch {}
                }}
                className="hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Cookie Preferences
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* --- ALL SYSTEM MODALS --- */}

      {/* 1. EDIT PROFILE MODAL (Available to Admin, Manager, HR) */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Edit Employee Profile Details</h3>
                <p className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">Authorizing User: {activeUser.name}</p>
              </div>
              <button
                onClick={() => { setEditingEmployee(null); setEditProfileError(null); }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmployeeSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {editProfileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{editProfileError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Employee ID</label>
                  <input
                    type="text"
                    required
                    disabled={activeUser.role === 'hr'}
                    value={editingEmployee.id}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, id: e.target.value.toUpperCase() })}
                    className={`w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Email address (Gmail Format)</label>
                  <input
                    type="email"
                    required
                    value={editingEmployee.email}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Job Title</label>
                  <input
                    type="text"
                    required
                    disabled={activeUser.role === 'hr'}
                    value={editingEmployee.jobTitle}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, jobTitle: e.target.value })}
                    className={`w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Department</label>
                  <select
                    disabled={activeUser.role === 'hr'}
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    className={`w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {departments.length === 0 ? (
                      <option value="">Unassigned / No Department</option>
                    ) : (
                      <>
                        <option value="">Select Department...</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Mobile No (Optional)</label>
                  <input
                    type="text"
                    placeholder="Enter 10-digit Mobile No (Optional)"
                    value={editingEmployee.phone || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Gross Salary (INR, e.g. INR 80,000)</label>
                  <input
                    type="text"
                    required
                    disabled={activeUser.role === 'hr'}
                    placeholder="Enter Gross Salary in INR"
                    value={editingEmployee.salary}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, salary: e.target.value })}
                    className={`w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Joining Date</label>
                  <input
                    type="date"
                    required
                    disabled={activeUser.role === 'hr'}
                    value={editingEmployee.joinDate}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, joinDate: e.target.value })}
                    className={`w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>

                {activeUser.role === 'admin' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">System Role Privilege</label>
                    <select
                      value={editingEmployee.role}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                      <option value="admin">Admin</option>
                      {departments.map((d) => (
                        <option key={d.id} value={`Head of ${d.name}`}>Head of {d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {activeUser.role === 'manager' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">System Role Privilege</label>
                    <select
                      value={editingEmployee.role}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      <option value="hr">HR</option>
                      {departments.map((d) => (
                        <option key={d.id} value={`Head of ${d.name}`}>Head of {d.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {['admin', 'manager'].includes(activeUser.role) && 
                 (editingEmployee.role !== 'admin' || activeUser.role === 'admin') && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Login Password</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter login password"
                      value={editingEmployee.password || ''}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Employment & Internship Status</label>
                  <select
                    value={normalizeEmployeeStatus(editingEmployee.status)}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Profile Picture URL (Optional)</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    disabled={activeUser.role === 'hr'}
                    placeholder="Enter Profile Picture URL"
                    value={editingEmployee.avatarUrl || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, avatarUrl: e.target.value })}
                    className={`flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  {editingEmployee.avatarUrl && (
                    <img
                      src={editingEmployee.avatarUrl}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Residential Address</label>
                <textarea
                  required
                  placeholder="Enter Residential Address"
                  value={editingEmployee.address}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, address: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Emergency Contact (Optional)</label>
                <input
                  type="text"
                  disabled={activeUser.role === 'hr'}
                  placeholder="Enter Emergency Contact Details"
                  value={editingEmployee.emergencyContact || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, emergencyContact: e.target.value })}
                  className={`w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${activeUser.role === 'hr' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              {editProfileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{editProfileError}</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => { setEditingEmployee(null); setEditProfileError(null); }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 cursor-pointer flex items-center space-x-1.5 shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Profile Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW EMPLOYEE DETAIL MODAL */}
      {viewingEmployeeDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden ${viewingEmployeeDetail.avatarColor}`}>
                  {viewingEmployeeDetail.avatarUrl ? (
                    <img
                      src={viewingEmployeeDetail.avatarUrl}
                      alt={viewingEmployeeDetail.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    viewingEmployeeDetail.name.split(' ').map(n => n[0]).join('')
                  )}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm leading-tight">{viewingEmployeeDetail.name}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{viewingEmployeeDetail.jobTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingEmployeeDetail(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Department</span>
                  <p className="font-extrabold text-indigo-950 text-xs">{viewingEmployeeDetail.department}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Status</span>
                  {(() => {
                    const normSt = normalizeEmployeeStatus(viewingEmployeeDetail.status);
                    const opt = STATUS_OPTIONS.find(o => o.value === normSt) || STATUS_OPTIONS[0];
                    return (
                      <span className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-0.5 rounded text-[10px] border shadow-3xs ml-1 ${opt.badgeClass}`}>
                        <span>{opt.icon}</span>
                        <span>{opt.shortLabel}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              {isEmployeeInactiveOrCompleted(viewingEmployeeDetail) && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-rose-800">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                    <span className="font-bold text-xs">Login Status:</span>
                    <span className="font-extrabold uppercase text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded border border-rose-300">
                      Login Disabled
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-600 font-medium">
                    {normalizeEmployeeStatus(viewingEmployeeDetail.status) === 'internship completed' ? 'Internship Completed' : 'Not Working'} • Retained for administrative review
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</span>
                  <span className="font-extrabold text-slate-800 font-mono mt-0.5 block">{viewingEmployeeDetail.id}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email (Username)</span>
                  <span className="font-extrabold text-slate-800 break-all mt-0.5 block">{viewingEmployeeDetail.email}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</span>
                  <span className="font-extrabold text-slate-800 mt-0.5 block">{viewingEmployeeDetail.phone || <span className="text-slate-400 font-normal italic">Not Provided</span>}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Salary</span>
                  <span className="font-extrabold text-slate-800 mt-0.5 block">{formatINR(viewingEmployeeDetail.salary)}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date of Joining</span>
                  <span className="font-extrabold text-slate-800 mt-0.5 block">{viewingEmployeeDetail.joinDate}</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role Privilege</span>
                  <span className="font-extrabold text-slate-800 uppercase mt-0.5 block">{viewingEmployeeDetail.role}</span>
                </div>
              </div>

              {/* Prominent Residential Address Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <div className="flex items-center text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 mr-1.5 shrink-0" />
                  Residential Address
                </div>
                <p className="font-bold text-slate-800 text-xs pl-5 leading-relaxed">{viewingEmployeeDetail.address || 'Not Provided'}</p>
              </div>

              {viewingEmployeeDetail.emergencyContact && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emergency Contact Details</span>
                  <span className="font-semibold text-slate-700 mt-0.5 block">{viewingEmployeeDetail.emergencyContact}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setViewingEmployeeDetail(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>

              {canEditEmployee(viewingEmployeeDetail) && (
                <button
                  type="button"
                  onClick={() => {
                    const emp = viewingEmployeeDetail;
                    setViewingEmployeeDetail(null);
                    setEditingEmployee(emp);
                    setEditingEmployeeOriginalId(emp.id);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer flex items-center space-x-1"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  <span>Modify Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. ADD EMPLOYEE MODAL (HR, Manager, and Admin) */}
      {isAddingEmployee && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Add New Staff Profile</h3>
                <p className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">Authorizing User: {activeUser.name}</p>
              </div>
              <button
                onClick={() => setIsAddingEmployee(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Employee ID"
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Full Name"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Email address (Gmail Format)</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter Gmail address"
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Job Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Job Title"
                    value={newEmpTitle}
                    onChange={(e) => setNewEmpTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Department</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {departments.length === 0 ? (
                      <option value="">Unassigned / No Department</option>
                    ) : (
                      <>
                        <option value="">Select Department...</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Mobile No (Optional)</label>
                  <input
                    type="text"
                    placeholder="Enter 10-digit Mobile No (Optional)"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Gross Salary (INR, e.g. INR 80,000)</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Gross Salary in INR"
                    value={newEmpSalary}
                    onChange={(e) => setNewEmpSalary(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={newEmpJoinDate}
                    onChange={(e) => setNewEmpJoinDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">System Privilege Role</label>
                  {activeUser.role === 'admin' ? (
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="hr">HR</option>
                      <option value="admin">Admin</option>
                      {departments.map((d) => (
                        <option key={d.id} value={`Head of ${d.name}`}>Head of {d.name}</option>
                      ))}
                    </select>
                  ) : activeUser.role === 'manager' ? (
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      <option value="hr">HR</option>
                      {departments.map((d) => (
                        <option key={d.id} value={`Head of ${d.name}`}>Head of {d.name}</option>
                      ))}
                    </select>
                  ) : (
                    // HR role can only add employees or head of departments
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      {departments.map((d) => (
                        <option key={d.id} value={`Head of ${d.name}`}>Head of {d.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                 {['admin', 'manager'].includes(activeUser.role) && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Login Password</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter login password"
                      value={newEmpPassword}
                      onChange={(e) => setNewEmpPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Employment & Internship Status</label>
                  <select
                    value={newEmpStatus}
                    onChange={(e) => setNewEmpStatus(e.target.value as EmployeeStatus)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Profile Picture URL (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter Profile Picture URL"
                  value={newEmpAvatarUrl}
                  onChange={(e) => setNewEmpAvatarUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Residential Address</label>
                <textarea
                  required
                  placeholder="Enter Residential Address"
                  value={newEmpAddress}
                  onChange={(e) => setNewEmpAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Emergency Contact Information (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter Emergency Contact Details"
                  value={newEmpEmergency}
                  onChange={(e) => setNewEmpEmergency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddingEmployee(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. PROPOSE TASK MODAL (Manager to HR details) */}
      {isProposingTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                  {['admin', 'manager', 'hr'].includes(activeUser.role) ? "Assign Task" : "Propose Task to Human Resources"}
                </h3>
                <p className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">
                  {['admin', 'manager', 'hr'].includes(activeUser.role) 
                    ? "Direct Assignment to Staff & Managers (No review needed)" 
                    : "Manager Request Pipeline"
                  }
                </p>
              </div>
              <button
                onClick={() => setIsProposingTask(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProposeTaskSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Task Title"
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">
                    {['admin', 'manager', 'hr'].includes(activeUser.role) ? "Target Employee / Assignee" : "Suggest Employee"}
                  </label>
                  <select
                    required
                    value={propEmpId}
                    onChange={(e) => setPropEmpId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.filter(e => e.id !== activeUser.id).map(e => (
                      <option key={e.id} value={e.id}>
                        [No: {e.id}] {e.name} ({e.department} - {e.role === 'head of department' ? 'HOD' : (e.role || '').toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Priority level</label>
                  <select
                    value={propPriority}
                    onChange={(e) => setPropPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              {(() => {
                const emp = employees.find(e => e.id === propEmpId);
                if (activeUser.role === 'manager' && emp) {
                  if (emp.role === 'employee' || emp.role === 'hr') {
                    return (
                      <div className="p-2.5 bg-emerald-50 rounded border border-emerald-100 text-[10px] text-emerald-800 leading-relaxed font-semibold">
                        ✓ Direct Assignment: Since {emp.name} is an Employee or HR, this task will be assigned directly with NO review needed.
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-2.5 bg-amber-50 rounded border border-amber-100 text-[10px] text-amber-800 leading-relaxed font-semibold">
                        i Proposal Pipeline: Tasks for other roles will be forwarded to HR for assignment review.
                      </div>
                    );
                  }
                }
                return null;
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Target Due Date</label>
                  <input
                    type="date"
                    required
                    value={propDueDate}
                    onChange={(e) => setPropDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Task Details / Instructions</label>
                <textarea
                  required
                  placeholder="Provide precise details, target outcomes, or tools the employee should use."
                  value={propDesc}
                  onChange={(e) => setPropDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProposingTask(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  {['admin', 'manager', 'hr'].includes(activeUser.role) ? "Assign Task" : "Send Proposal to HR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. HR FORMALIZE / ASSIGN PROPOSED TASK MODAL */}
      {assigningProposal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Formalize HR Task Directive</h3>
                <p className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">
                  {assigningProposal.proposedByHR 
                    ? `Initiative Approved by Manager: ${assigningProposal.managerName}`
                    : `Formalizing request by Manager: ${assigningProposal.managerName}`
                  }
                </p>
              </div>
              <button
                onClick={() => setAssigningProposal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignProposalSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <p className="text-xs text-slate-500 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 leading-relaxed">
                  {assigningProposal.proposedByHR
                    ? `You are assigning this direct task initiative that was approved by manager ${assigningProposal.managerName}.`
                    : `You are assigning this task proposed by ${assigningProposal.managerName}.`
                  } 
                  Below are the finalized details that will be logged under employee task list.
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Finalized Title</span>
                <p className="text-xs font-bold text-slate-800">{assigningProposal.title}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Finalized Description</span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">{assigningProposal.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Employee</span>
                  <p className="text-xs font-bold text-slate-800">
                    {employees.find(e => e.id === assigningProposal.proposedEmployeeId)?.name || 'Unknown'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Due date</span>
                  <p className="text-xs font-bold text-slate-800">{assigningProposal.dueDate}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAssigningProposal(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Confirm & Formally Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. HR ASSIGN DIRECT TASK MODAL */}
      {isAssigningDirectly && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-scale-up max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Propose Direct Task (HR Initiative)</h3>
                <p className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5">Will be forwarded to department manager for approval first</p>
              </div>
              <button
                onClick={() => setIsAssigningDirectly(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDirectAssignSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <p className="text-xs text-slate-500 bg-amber-50/50 p-3 rounded-lg border border-amber-200 leading-relaxed font-medium">
                  Note: Tasks assigned by HR must first be approved by the employee's department manager. 
                  Once approved, you will be notified on your Assign Task dashboard to finalize the directive.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Task Title"
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Select Employee Target</label>
                  <select
                    required
                    value={directEmpId}
                    onChange={(e) => setDirectEmpId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Target --</option>
                    {employees.filter(e => {
                      const userRole = activeUser?.role || '';
                      if (userRole === 'admin') return true;
                      if (userRole === 'hr') return ['employee', 'head of department'].includes(e.role || '');
                      if (userRole === 'manager') return ['employee', 'hr', 'head of department'].includes(e.role || '');
                      return false;
                    }).map(e => (
                      <option key={e.id} value={e.id}>[No: {e.id}] {e.name} ({e.department} - {e.role === 'head of department' ? 'HOD' : (e.role || '').toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Priority level</label>
                  <select
                    value={directPriority}
                    onChange={(e) => setDirectPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Target Due Date</label>
                  <input
                    type="date"
                    required
                    value={directDueDate}
                    onChange={(e) => setDirectDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-tight">Task Details / Instructions</label>
                <textarea
                  required
                  placeholder="Provide precise details for the employee."
                  value={directDesc}
                  onChange={(e) => setDirectDesc(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAssigningDirectly(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Send Proposal to Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Application Modal (Accessible from Dashboard & Overview) */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-up max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Apply for Leave / Half Day</h3>
                  <p className="text-xs text-slate-500">Submit leave request for management authorization</p>
                </div>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDashboardLeaveSubmit} className="space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Leave Category</label>
                  <select
                    value={leaveModalType}
                    onChange={(e) => setLeaveModalType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Leave">Full Day Leave</option>
                    <option value="Half Day">Half Day</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveModalStartDate}
                    onChange={(e) => setLeaveModalStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {leaveModalType === 'Leave' && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date (Optional for single day)</label>
                  <input
                    type="date"
                    value={leaveModalEndDate}
                    onChange={(e) => setLeaveModalEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason for Request</label>
                <textarea
                  required
                  placeholder="Provide valid reason for leave application..."
                  rows={3}
                  value={leaveModalReason}
                  onChange={(e) => setLeaveModalReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SQLite Database Raw Editor Modal */}
      <SQLiteEditorModal
        isOpen={isSQLiteModalOpen && ['admin', 'manager'].includes(activeUser?.role)}
        onClose={() => setIsSQLiteModalOpen(false)}
        onRefreshData={async () => {
          const data = await fetchAllFromSQLite();
          if (data.employees && Array.isArray(data.employees)) {
            setEmployeesState(ensureStaffOrder(data.employees));
            const savedUserId = sessionStorage.getItem('activeUserId') || 'EMP-001';
            const found = data.employees.find((e: any) => e.id === savedUserId) || data.employees[0];
            if (found) {
              setActiveUser(found);
              sessionStorage.setItem('activeUser', JSON.stringify(found));
              sessionStorage.setItem('activeUserId', found.id);
            }
          }
          if (data.attendance && Array.isArray(data.attendance)) setAttendanceState(data.attendance);
          if (data.leave_requests && Array.isArray(data.leave_requests)) setLeaveRequestsState(data.leave_requests);
          if (data.departments && Array.isArray(data.departments)) setDepartmentsState(data.departments);
          if (data.holidays && Array.isArray(data.holidays)) setHolidaysState(data.holidays);
          if (data.tasks && Array.isArray(data.tasks)) setTasksState(data.tasks);
          if (data.proposals && Array.isArray(data.proposals)) setProposalsState(data.proposals);
          if (data.salaries && Array.isArray(data.salaries)) setSalariesState(data.salaries);
          if (data.officeTime) setOfficeTimeState(data.officeTime);
          if (data.officeEndTime) setOfficeEndTimeState(data.officeEndTime);
          if (data.punchInTimes) setPunchInTimesState(data.punchInTimes);
        }}
      />

      {/* Success Toast Banner for Task Assigner */}
      {assignSuccessToast && (
        <div className="fixed top-20 right-6 z-50 max-w-sm bg-emerald-900 text-white p-4 rounded-xl shadow-2xl border border-emerald-600 animate-slide-down flex items-center space-x-3">
          <div className="p-1.5 bg-emerald-600 rounded-lg shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-xs font-semibold leading-snug">
            {assignSuccessToast}
          </div>
          <button onClick={() => setAssignSuccessToast(null)} className="text-emerald-300 hover:text-white text-xs p-1 cursor-pointer">✕</button>
        </div>
      )}

      {/* Active Unread Task Notification Toast for Assigned Employee */}
      {activeUser && (() => {
        const unreadNotif = notifications.find(n => n.userId === activeUser.id && !n.read && n.type === 'task_assigned');
        if (!unreadNotif) return null;
        return (
          <div className="fixed bottom-6 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-indigo-500/60 animate-slide-up flex items-start space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-md">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  New Task Assigned Alert ⚡
                </span>
                <button
                  onClick={() => markNotificationAsRead(unreadNotif.id)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  title="Close Alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-bold text-white leading-snug pt-0.5">{unreadNotif.title}</p>
              <p className="text-xs text-slate-300 leading-relaxed">{unreadNotif.message}</p>
              <div className="pt-2 flex items-center space-x-2">
                <button
                  onClick={() => {
                    markNotificationAsRead(unreadNotif.id);
                    selectTab('dashboard');
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  View Task Details
                </button>
                <button
                  onClick={() => markNotificationAsRead(unreadNotif.id)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MOCK SMTP MAIL CLIENT OUTBOX MODAL */}
      <SmtpMailClientModal
        isOpen={isMailModalOpen}
        onClose={() => setIsMailModalOpen(false)}
        employees={employees}
        onOpenFullTab={() => selectTab('smtp-outbox')}
      />

      {/* PRIVACY POLICY MODAL */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* TERMS AND CONDITIONS MODAL */}
      <TermsAndConditionsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />

      {/* COOKIE CONSENT BANNER */}
      <CookieConsentBanner
        onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
        onOpenTerms={() => setIsTermsModalOpen(true)}
      />

    </div>
  );
}
