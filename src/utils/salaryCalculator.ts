import { Employee, AttendanceLog, LeaveRequest, SalaryRecord, Holiday } from '../types';
import { parseSalary } from '../App';

/**
 * Checks if a date string is Sunday
 */
export const isDateSunday = (dateStr: string): boolean => {
  try {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.getDay() === 0;
  } catch (e) {
    return false;
  }
};

/**
 * Gets the number of days in a given month (format: YYYY-MM)
 */
export const getDaysInMonth = (monthStr: string): number => {
  if (!monthStr || !monthStr.includes('-')) return 30;
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month, 0).getDate();
};

/**
 * Calculates the monthly salary details of an employee based on their attendance records and leave requests.
 * Includes 2 paid Casual Leaves (CL) and 2 paid Half Days per month.
 */
export const calculateMonthlySalary = (
  employee: Employee,
  month: string, // format: "YYYY-MM"
  attendanceLogs: AttendanceLog[],
  leaveRequests: LeaveRequest[],
  holidays: Holiday[] = []
): SalaryRecord => {
  const baseSalary = parseSalary(employee.salary);
  const totalWorkingDays = getDaysInMonth(month);
  const dailyRate = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;

  // Filter logs for this employee and this month
  const empLogs = attendanceLogs.filter(
    (log) => log.userId === employee.id && log.date.startsWith(month)
  );

  // Parse days in month and classify each day
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let approvedLeaves = 0;

  const isExempt = employee.role === 'admin' || employee.role === 'manager';

  if (!isExempt) {
    for (let day = 1; day <= totalWorkingDays; day++) {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      
      // Check if Sunday or Holiday
      const isSunday = isDateSunday(dateStr);
      const isHoliday = holidays.some(h => {
        const hStart = h.startDate || h.date || '';
        const hEnd = h.endDate || h.date || '';
        return dateStr >= hStart && dateStr <= hEnd;
      });

      if (isSunday || isHoliday) {
        // Sundays and Holidays are paid off-days and do not incur deductions or use up leaves
        continue;
      }

      // Check if there is an attendance log
      const log = empLogs.find((l) => l.date === dateStr);
      
      // Check if there is an approved leave request covering this day
      const approvedLeave = leaveRequests.find(
        (r) =>
          r.employeeId === employee.id &&
          r.status === 'Approved' &&
          dateStr >= r.startDate &&
          dateStr <= r.endDate
      );

      if (log) {
        if (log.status === 'On Time' || log.status === 'Late') {
          presentDays++;
        } else if (log.status === 'Casual Leave (CL)' || log.status === 'On Leave') {
          approvedLeaves++;
        } else if (log.status === 'Paid Half Day' || log.status === 'Half Day') {
          halfDays++;
        } else if (log.status === 'Absent') {
          absentDays++;
        }
      } else if (approvedLeave) {
        if (approvedLeave.type === 'Leave') {
          approvedLeaves++;
        } else if (approvedLeave.type === 'Half Day') {
          halfDays++;
        }
      }
    }
  } else {
    // Admins and Managers are not regular employees, attendance is not required/monitored.
    // They are counted as present for payroll purposes to receive full salary.
    presentDays = totalWorkingDays;
  }

  // Exemptions:
  // 1. 2 Casual Leaves (CL) per month are paid (no deduction)
  const clUsed = Math.min(2, approvedLeaves);
  const clRemaining = Math.max(0, 2 - clUsed);
  const unpaidLeaves = Math.max(0, approvedLeaves - clUsed);

  // 2. 2 Half Days per month are paid (no deduction)
  const halfDaysFreeUsed = Math.min(2, halfDays);
  const halfDaysFreeRemaining = Math.max(0, 2 - halfDaysFreeUsed);
  const unpaidHalfDays = Math.max(0, halfDays - halfDaysFreeUsed);

  // Deductions calculations:
  // Absences are always deducted (1 day's pay each)
  const absentDeduction = absentDays * dailyRate;
  
  // Unpaid leaves (beyond the 2 CL limit) deduct 1 day's pay each
  const leaveDeduction = unpaidLeaves * dailyRate;
  
  // Unpaid half days (beyond the 2 free limit) deduct 0.5 day's pay each
  const halfDayDeduction = unpaidHalfDays * (dailyRate * 0.5);

  const totalDeductions = absentDeduction + leaveDeduction + halfDayDeduction;
  const netSalary = Math.max(0, Math.round(baseSalary - totalDeductions));

  const id = `SAL-${employee.id}-${month}`;

  return {
    id,
    employeeId: employee.id,
    employeeName: employee.name,
    employeeRole: employee.role,
    month,
    baseSalary,
    dailyRate: Math.round(dailyRate * 100) / 100,
    totalWorkingDays,
    presentDays,
    absentDays,
    halfDays,
    approvedLeaves,
    clUsed,
    halfDaysFreeUsed,
    clRemaining,
    halfDaysFreeRemaining,
    absentDeduction: Math.round(absentDeduction),
    halfDayDeduction: Math.round(halfDayDeduction),
    leaveDeduction: Math.round(leaveDeduction),
    totalDeductions: Math.round(totalDeductions),
    netSalary,
    status: 'Draft',
    updatedAt: new Date().toISOString()
  };
};
