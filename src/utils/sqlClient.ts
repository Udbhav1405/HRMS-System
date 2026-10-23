// Client-Side SQL Database Connector for HRMS SQLite Database

import {
  PDF_EMPLOYEES,
  PDF_ATTENDANCE_LOGS,
  PDF_LEAVE_REQUESTS,
  TODAY_PUNCH_IN_TIMES,
  INITIAL_DEPARTMENTS_LIST
} from '../data/pdfAttendanceData.ts';

const CACHE_PREFIX = 'hrms_sqlite_';

export const isExcludedStaff = (item: any): boolean => {
  if (!item) return false;
  try {
    const json = JSON.stringify(item).toLowerCase();
    return json.includes('vishal') || json.includes('paswan');
  } catch {
    const name = String(item.name || item.userName || item.employeeName || '').toLowerCase().trim();
    const email = String(item.email || '').toLowerCase().trim();
    const id = String(item.id || item.userId || item.employeeId || '').toLowerCase().trim();
    return name.includes('vishal') || name.includes('paswan') || email.includes('vishal') || email.includes('paswan') || id.includes('vishal') || id.includes('paswan');
  }
};

export const sanitizeDefaultContactDetails = (emp: any): any => {
  if (!emp) return emp;
  const phone = typeof emp.phone === 'string' ? emp.phone.trim() : (emp.phone ? String(emp.phone).trim() : '');
  const emergency = typeof emp.emergencyContact === 'string' ? emp.emergencyContact.trim() : (emp.emergencyContact ? String(emp.emergencyContact).trim() : '');
  const avatarUrl = typeof emp.avatarUrl === 'string' ? emp.avatarUrl.trim() : (emp.avatarUrl ? String(emp.avatarUrl).trim() : '');
  
  const phoneLower = phone.toLowerCase();
  const emergencyLower = emergency.toLowerCase();
  const avatarLower = avatarUrl.toLowerCase();

  const isDefaultAvatar = 
    avatarLower.includes('unsplash.com') ||
    avatarLower.includes('pravatar.cc') ||
    avatarLower.includes('dicebear.com') ||
    avatarLower.includes('placeholder') ||
    avatarLower === 'default';

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

  return {
    ...emp,
    avatarUrl: isDefaultAvatar ? '' : avatarUrl,
    phone: isDefaultPhone ? '' : phone,
    emergencyContact: isDefaultEmergency ? '' : emergency
  };
};

export const ensureStaffOrder = (emps: any[]): any[] => {
  if (!emps || !Array.isArray(emps)) return PDF_EMPLOYEES.map(sanitizeDefaultContactDetails);
  const sanitized = emps.filter(e => !isExcludedStaff(e)).map(sanitizeDefaultContactDetails);
  const baselineIds = PDF_EMPLOYEES.map(e => e.id);
  const baselineIdSet = new Set(baselineIds);

  const baselineStaff = PDF_EMPLOYEES.map(base => {
    const updated = sanitized.find((e: any) => e.id === base.id || (e.email && base.email && e.email.toLowerCase() === base.email.toLowerCase()));
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

  const customList = sanitized.filter((e: any) => !baselineIdSet.has(e.id)).map(sanitizeDefaultContactDetails);
  return [...baselineStaff, ...customList];
};

export function getLocalCache<T = any>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const item = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (key === 'employees' && Array.isArray(parsed)) {
      return ensureStaffOrder(parsed) as unknown as T;
    }
    if (Array.isArray(parsed)) {
      return parsed.filter(i => !isExcludedStaff(i)) as unknown as T;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

export function setLocalCache(key: string, value: any): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    let cleanVal = value;
    if (key === 'employees' && Array.isArray(value)) {
      cleanVal = ensureStaffOrder(value);
    } else if (Array.isArray(value)) {
      cleanVal = value.filter((item: any) => !isExcludedStaff(item));
    }
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cleanVal));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

// Listeners for live database changes
const syncListeners: Array<(key: string, data: any) => void> = [];

export function subscribeToSQLite(onUpdate: (key: string, data: any) => void): () => void {
  syncListeners.push(onUpdate);
  return () => {
    const idx = syncListeners.indexOf(onUpdate);
    if (idx >= 0) syncListeners.splice(idx, 1);
  };
}

function notifySyncListeners(key: string, data: any) {
  syncListeners.forEach(listener => {
    try {
      listener(key, data);
    } catch (e) {
      console.error('Error in SQLite subscriber:', e);
    }
  });
}

// Fetch all HRMS data from backend SQLite API
export async function fetchAllFromSQLite(): Promise<Record<string, any>> {
  // Fast offline/local fallback baseline
  const fallbackResult: Record<string, any> = {
    employees: ensureStaffOrder(getLocalCache('employees') || PDF_EMPLOYEES),
    attendance: (getLocalCache('attendance') || PDF_ATTENDANCE_LOGS).filter((a: any) => !isExcludedStaff(a)),
    leave_requests: (getLocalCache('leave_requests') || PDF_LEAVE_REQUESTS).filter((l: any) => !isExcludedStaff(l)),
    departments: getLocalCache('departments') || INITIAL_DEPARTMENTS_LIST,
    holidays: getLocalCache('holidays') || [],
    tasks: (getLocalCache('tasks') || []).filter((t: any) => !isExcludedStaff(t)),
    proposals: (getLocalCache('proposals') || []).filter((p: any) => !isExcludedStaff(p)),
    salaries: (getLocalCache('salaries') || []).filter((s: any) => !isExcludedStaff(s)),
    notifications: getLocalCache('notifications') || [],
    officeTime: getLocalCache('officeTime') || '09:30 AM',
    officeEndTime: getLocalCache('officeEndTime') || '05:00 PM',
    punchInTimes: getLocalCache('punchInTimes') || TODAY_PUNCH_IN_TIMES
  };

  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        if (d.employees && Array.isArray(d.employees)) {
          d.employees = ensureStaffOrder(d.employees);
          setLocalCache('employees', d.employees);
        }
        if (d.attendance && Array.isArray(d.attendance)) {
          d.attendance = d.attendance.filter((a: any) => !isExcludedStaff(a));
          setLocalCache('attendance', d.attendance);
        }
        if (d.tasks && Array.isArray(d.tasks)) {
          d.tasks = d.tasks.filter((t: any) => !isExcludedStaff(t));
          setLocalCache('tasks', d.tasks);
        }
        if (d.proposals && Array.isArray(d.proposals)) {
          d.proposals = d.proposals.filter((p: any) => !isExcludedStaff(p));
          setLocalCache('proposals', d.proposals);
        }
        if (d.leave_requests && Array.isArray(d.leave_requests)) {
          d.leave_requests = d.leave_requests.filter((l: any) => !isExcludedStaff(l));
          setLocalCache('leave_requests', d.leave_requests);
        }
        if (d.departments && Array.isArray(d.departments) && d.departments.length > 0) {
          setLocalCache('departments', d.departments);
        }
        if (d.holidays && Array.isArray(d.holidays)) {
          setLocalCache('holidays', d.holidays);
        }
        if (d.salaries && Array.isArray(d.salaries)) {
          d.salaries = d.salaries.filter((s: any) => !isExcludedStaff(s));
          setLocalCache('salaries', d.salaries);
        }
        if (d.notifications && Array.isArray(d.notifications)) {
          setLocalCache('notifications', d.notifications);
        }
        if (d.officeTime) setLocalCache('officeTime', d.officeTime);
        if (d.officeEndTime) setLocalCache('officeEndTime', d.officeEndTime);
        if (d.punchInTimes) setLocalCache('punchInTimes', d.punchInTimes);

        return d;
      }
    }
  } catch (err) {
    console.warn('Backend SQLite API fetch failed, utilizing local database cache:', err);
  }

  return fallbackResult;
}

// Save a collection / table to SQLite database
export async function saveToSQLite(
  key: string,
  value: any,
  options: { allowEmpty?: boolean; immediate?: boolean } = {}
): Promise<boolean> {
  // Always update local cache instantly for 0ms UI responsiveness
  setLocalCache(key, value);
  notifySyncListeners(key, value);

  try {
    const res = await fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data: value })
    });
    if (res.ok) {
      const json = await res.json();
      return json.success;
    }
  } catch (err) {
    console.warn(`Failed to persist ${key} to backend SQLite server:`, err);
  }

  return true;
}

// Execute custom SQL query
export async function executeSql(
  sql: string,
  params: any[] = []
): Promise<{ columns: string[]; rows: any[]; success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params })
    });
    const json = await res.json();
    if (!res.ok) {
      return { columns: [], rows: [], success: false, error: json.error || 'SQL Query failed' };
    }
    return json;
  } catch (err: any) {
    return { columns: [], rows: [], success: false, error: err.message || 'Network error' };
  }
}

// Reset SQLite database to defaults
export async function resetSQLiteDB(): Promise<boolean> {
  try {
    const res = await fetch('/api/db/reset', { method: 'POST' });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        Object.entries(json.data).forEach(([k, val]) => {
          setLocalCache(k, val);
          notifySyncListeners(k, val);
        });
      }
      return json.success;
    }
  } catch (err) {
    console.error('Failed to reset SQLite database:', err);
  }
  return false;
}

// Get database table stats
export async function getDatabaseStats(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/db/stats');
    if (res.ok) {
      const json = await res.json();
      return json.stats || {};
    }
  } catch (err) {
    console.warn('Failed to get database stats:', err);
  }
  return {};
}

export async function flushPendingWrites(): Promise<boolean> {
  return true;
}

// Aliases for seamless integration with existing codebase
export const fetchAllFromGoogleSheets = fetchAllFromSQLite;
export const saveToGoogleSheets = saveToSQLite;
export const resetGoogleSheetsDB = resetSQLiteDB;
export const subscribeToGoogleSheets = subscribeToSQLite;
export const subscribeToAllFirestore = subscribeToSQLite;
export const fetchAllFromFirestore = fetchAllFromSQLite;
export const saveToFirestore = saveToSQLite;
export const resetFirestoreDB = resetSQLiteDB;

export function getSavedSpreadsheetUrl(): string | null {
  return null;
}
export function getSavedSpreadsheetId(): string | null {
  return null;
}
export async function getOrCreateSpreadsheet(): Promise<{ id: string; url: string }> {
  return { id: 'sqlite', url: '' };
}
