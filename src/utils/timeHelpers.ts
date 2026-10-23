// Time and duration helper functions for HRMS Attendance
import { AttendanceLog, LeaveRequest } from '../types.ts';

export function parseTimeToDate(timeStr: string, dateStr: string): Date {
  // Parse dateStr "YYYY-MM-DD" robustly in the local timezone
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day, 0, 0, 0, 0);

  // Normalize string: replace non-breaking spaces, narrow spaces, or multiple spaces with standard space
  const cleanTime = timeStr.replace(/[\u202f\u00a0\s]+/g, ' ').trim();

  // Matches "09:15:00 AM", "09:15 AM", "14:30:10", etc.
  const match = cleanTime.match(/^(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const ampm = match[4];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
    }
    date.setHours(hours, minutes, seconds, 0);
  }
  return date;
}

export function calculateDurationStr(checkInStr: string, checkOutStr: string, dateStr: string): string {
  try {
    const inDate = parseTimeToDate(checkInStr, dateStr);
    const outDate = parseTimeToDate(checkOutStr, dateStr);
    
    let diffMs = outDate.getTime() - inDate.getTime();
    if (diffMs < 0) {
      // Adjust if punch out is next day, or order is inverted
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    return `${hours}h ${mins}m`;
  } catch (e) {
    return '8h 00m';
  }
}

export function isDateSaturday(dateStr: string): boolean {
  try {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.getDay() === 6; // Saturday is 6
  } catch (e) {
    return false;
  }
}

export function isDateSunday(dateStr: string): boolean {
  try {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.getDay() === 0; // Sunday is 0
  } catch (e) {
    return false;
  }
}

export function format12HourTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${strMinutes} ${ampm}`;
}

export function getSaturdayEndTime(officeTimeStr: string, officeEndTimeStr: string): string {
  try {
    const baseDate = '2026-01-01';
    const startDate = parseTimeToDate(officeTimeStr, baseDate);
    const endDate = parseTimeToDate(officeEndTimeStr, baseDate);
    let diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    const halfMs = diffMs / 2;
    const saturdayEnd = new Date(startDate.getTime() + halfMs);
    return format12HourTime(saturdayEnd);
  } catch (e) {
    return '01:00 PM';
  }
}

export function checkIsLate(checkInStr: string, officeTimeStr: string, dateStr: string): boolean {
  try {
    const checkInDate = parseTimeToDate(checkInStr, dateStr);
    const officeDate = parseTimeToDate(officeTimeStr, dateStr);
    
    checkInDate.setFullYear(2026, 0, 1);
    
    const isSaturday = isDateSaturday(dateStr);
    const graceMins = 15;
    
    // grace period
    const thresholdDate = new Date(officeDate.getTime() + graceMins * 60 * 1000);
    thresholdDate.setFullYear(2026, 0, 1);
    
    return checkInDate.getTime() > thresholdDate.getTime();
  } catch (e) {
    return false;
  }
}

/**
 * Calculates used and remaining CL (Casual Leaves) and Paid Half Days for an employee in a given month (YYYY-MM).
 * Quota per month: 2 CL (Paid full days off) and 2 Paid Half Days.
 */
export function getMonthlyQuotaCounts(
  employeeId: string,
  monthStr: string,
  attendanceLogs: AttendanceLog[] = [],
  leaveRequests: LeaveRequest[] = []
): {
  clUsed: number;
  clRemaining: number;
  paidHalfDaysUsed: number;
  paidHalfDaysRemaining: number;
  unpaidAbsentDays: number;
  unpaidHalfDays: number;
} {
  const empLogs = attendanceLogs.filter(
    l => l.userId === employeeId && l.date.startsWith(monthStr)
  );

  // Collect unique dates where full-day off / absence was taken
  const fullOffDates = new Set<string>();
  empLogs.forEach(l => {
    if (l.status === 'Casual Leave (CL)' || l.status === 'Absent' || l.status === 'On Leave') {
      fullOffDates.add(l.date);
    }
  });

  leaveRequests.forEach(req => {
    if (req.employeeId === employeeId && (req.status === 'Approved' || req.status === 'Manager Approved') && req.type === 'Leave') {
      const start = req.startDate;
      if (start.startsWith(monthStr)) {
        fullOffDates.add(start);
      }
    }
  });

  const totalFullOff = fullOffDates.size;
  const clUsed = Math.min(2, totalFullOff);
  const clRemaining = Math.max(0, 2 - clUsed);
  const unpaidAbsentDays = Math.max(0, totalFullOff - 2);

  // Collect half days
  let totalHalfDays = 0;
  empLogs.forEach(l => {
    if (l.status === 'Paid Half Day' || l.status === 'Half Day') {
      totalHalfDays++;
    }
  });
  leaveRequests.forEach(req => {
    if (req.employeeId === employeeId && (req.status === 'Approved' || req.status === 'Manager Approved') && req.type === 'Half Day') {
      if (req.startDate.startsWith(monthStr)) {
        totalHalfDays++;
      }
    }
  });

  const paidHalfDaysUsed = Math.min(2, totalHalfDays);
  const paidHalfDaysRemaining = Math.max(0, 2 - paidHalfDaysUsed);
  const unpaidHalfDays = Math.max(0, totalHalfDays - 2);

  return {
    clUsed,
    clRemaining,
    paidHalfDaysUsed,
    paidHalfDaysRemaining,
    unpaidAbsentDays,
    unpaidHalfDays
  };
}

/**
 * Resolves whether an unpunched/absent day should be marked as "Casual Leave (CL)" or "Absent"
 * based on whether the employee still has CL available (<= 2 per month).
 * When 2 CL quota is exhausted in the month, marked as "Absent".
 */
export function resolveUnpunchedStatus(
  employeeId: string,
  dateStr: string,
  attendanceLogs: AttendanceLog[] = [],
  leaveRequests: LeaveRequest[] = [],
  currentLogId?: string
): 'Casual Leave (CL)' | 'Absent' {
  const monthStr = dateStr.substring(0, 7);
  // Count full-day off occurrences in this month before this date
  const priorFullOffDates = new Set<string>();
  
  attendanceLogs.forEach(l => {
    if (l.userId === employeeId && l.date.startsWith(monthStr)) {
      if (currentLogId && l.id === currentLogId) return;
      if (l.date === dateStr) return; // exclude same date to avoid double counting
      if (l.date < dateStr) {
        if (l.status === 'Casual Leave (CL)' || l.status === 'Absent' || l.status === 'On Leave') {
          priorFullOffDates.add(l.date);
        }
      }
    }
  });

  leaveRequests.forEach(req => {
    if (req.employeeId === employeeId && (req.status === 'Approved' || req.status === 'Manager Approved') && req.type === 'Leave') {
      if (req.startDate.startsWith(monthStr) && req.startDate < dateStr) {
        priorFullOffDates.add(req.startDate);
      }
    }
  });

  // If prior count < 2, this day is covered as Casual Leave (CL) (paid leave)
  // Once 2 CLs are exhausted in this month, marked as Absent (unpaid)
  return priorFullOffDates.size < 2 ? 'Casual Leave (CL)' : 'Absent';
}

/**
 * Resolves whether a half-day punch should be marked as "Paid Half Day" or "Half Day" (unpaid)
 * based on whether the employee still has Paid Half Day allowance available (<= 2 per month).
 * When 2 Paid Half Day quota is exhausted in the month, marked as "Half Day".
 */
export function resolveHalfDayStatus(
  employeeId: string,
  dateStr: string,
  attendanceLogs: AttendanceLog[] = [],
  leaveRequests: LeaveRequest[] = [],
  currentLogId?: string
): 'Paid Half Day' | 'Half Day' {
  const monthStr = dateStr.substring(0, 7);
  let priorHalfDays = 0;

  attendanceLogs.forEach(l => {
    if (l.userId === employeeId && l.date.startsWith(monthStr)) {
      if (currentLogId && l.id === currentLogId) return;
      if (l.date === dateStr) return; // exclude same date to avoid double counting
      if (l.date < dateStr) {
        if (l.status === 'Paid Half Day' || l.status === 'Half Day') {
          priorHalfDays++;
        }
      }
    }
  });

  leaveRequests.forEach(req => {
    if (req.employeeId === employeeId && (req.status === 'Approved' || req.status === 'Manager Approved') && req.type === 'Half Day') {
      if (req.startDate.startsWith(monthStr) && req.startDate < dateStr) {
        priorHalfDays++;
      }
    }
  });

  // If prior count < 2, this is covered as Paid Half Day
  // Once 2 Paid Half Days are exhausted in this month, marked as Half Day (unpaid deduction)
  return priorHalfDays < 2 ? 'Paid Half Day' : 'Half Day';
}

/**
 * Evaluates attendance status for a punch-in. If late beyond 90m (or 15m on Saturday),
 * or worked less than half day on punch-out, applies the 2 Paid Half Days quota condition:
 * - Marked as "Paid Half Day" if <= 2 paid half days used in the month
 * - Marked as "Half Day" (unpaid) when paid half day quota is exceeded.
 */
export function getAttendanceStatus(
  checkInStr: string,
  officeTimeStr: string,
  dateStr: string,
  employeeId?: string,
  attendanceLogs?: AttendanceLog[],
  leaveRequests?: LeaveRequest[],
  checkOutStr?: string,
  currentLogId?: string
): 'On Time' | 'Late' | 'Paid Half Day' | 'Half Day' {
  try {
    const checkInDate = parseTimeToDate(checkInStr, dateStr);
    const officeDate = parseTimeToDate(officeTimeStr, dateStr);
    
    checkInDate.setFullYear(2026, 0, 1);
    
    const isSaturday = isDateSaturday(dateStr);
    let isHalfDay = false;
    
    if (isSaturday) {
      // Saturday is half-day office, so late mark threshold is 15 mins
      const saturdayLateThresholdDate = new Date(officeDate.getTime() + 15 * 60 * 1000);
      saturdayLateThresholdDate.setFullYear(2026, 0, 1);
      
      if (checkInDate.getTime() > saturdayLateThresholdDate.getTime()) {
        isHalfDay = true;
      }
    } else {
      const halfDayThresholdDate = new Date(officeDate.getTime() + 90 * 60 * 1000);
      halfDayThresholdDate.setFullYear(2026, 0, 1);
      
      if (checkInDate.getTime() > halfDayThresholdDate.getTime()) {
        isHalfDay = true;
      }
    }

    // Also check duration if checkOutStr is provided
    if (!isHalfDay && checkOutStr && checkOutStr !== '---') {
      const outDate = parseTimeToDate(checkOutStr, dateStr);
      outDate.setFullYear(2026, 0, 1);
      let diffMs = outDate.getTime() - checkInDate.getTime();
      if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
      const workedMins = Math.floor(diffMs / 60000);
      // Half-day duration threshold: < 240 mins (4 hrs) on weekday, < 120 mins (2 hrs) on Saturday
      if (isSaturday && workedMins < 120) {
        isHalfDay = true;
      } else if (!isSaturday && workedMins < 240) {
        isHalfDay = true;
      }
    }
    
    if (isHalfDay) {
      if (employeeId && attendanceLogs) {
        return resolveHalfDayStatus(employeeId, dateStr, attendanceLogs, leaveRequests, currentLogId);
      }
      return 'Paid Half Day';
    }
    
    if (isSaturday) {
      return 'On Time';
    }

    const lateThresholdDate = new Date(officeDate.getTime() + 15 * 60 * 1000);
    lateThresholdDate.setFullYear(2026, 0, 1);
    
    if (checkInDate.getTime() > lateThresholdDate.getTime()) {
      return 'Late';
    } else {
      return 'On Time';
    }
  } catch (e) {
    return 'On Time';
  }
}
