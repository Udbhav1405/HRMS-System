import * as XLSX from 'xlsx';
import { Employee, AssignedTask, TaskProposal, AttendanceLog, Department, LeaveRequest, SalaryRecord, Holiday } from '../types';
import { sanitizeDefaultContactDetails } from './sqlClient.ts';

/**
 * Utility to format and export HRMS data as a multi-sheet Excel Workbook (.xlsx)
 */
export const exportHRMSToExcel = ({
  employees,
  proposals,
  tasks,
  attendance,
  departments,
  leaveRequests,
  salaries,
  holidays
}: {
  employees: Employee[];
  proposals: TaskProposal[];
  tasks: AssignedTask[];
  attendance: AttendanceLog[];
  departments: Department[];
  leaveRequests: LeaveRequest[];
  salaries: SalaryRecord[];
  holidays: Holiday[];
}) => {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Employees Sheet
    const employeeRows = employees.map(emp => ({
      'Employee ID': emp.id,
      'Full Name': emp.name,
      'Email Address': emp.email,
      'Role / Designation': emp.jobTitle,
      'Access Role': (emp.role || '').toUpperCase(),
      'Department': emp.department,
      'Phone': emp.phone,
      'Address': emp.address,
      'Emergency Contact': emp.emergencyContact,
      'Base Monthly Salary': emp.salary,
      'Date of Joining': emp.joinDate,
      'Status': (emp.status || '').toUpperCase()
    }));
    const wsEmployees = XLSX.utils.json_to_sheet(employeeRows);
    XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employees');

    // 2. Tasks Sheet (Combines assigned tasks and proposed tasks for completeness)
    const taskRows = tasks.map(t => ({
      'Task ID': t.id,
      'Title': t.title,
      'Description': t.description,
      'Assigned Employee ID': t.employeeId,
      'Assigned Employee Name': t.employeeName,
      'Assigned By': t.assignedBy,
      'Priority': (t.priority || '').toUpperCase(),
      'Due Date': t.dueDate,
      'Status': (t.status || '').toUpperCase(),
      'Completion Date': t.completedAt || 'N/A'
    }));
    const wsTasks = XLSX.utils.json_to_sheet(taskRows);
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks');

    // 3. Attendance Sheet
    const sortedAttendance = [...attendance].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      const aCheckIn = a.checkIn || '';
      const bCheckIn = b.checkIn || '';
      const checkInCompare = aCheckIn.localeCompare(bCheckIn);
      if (checkInCompare !== 0) return checkInCompare;
      return a.userName.localeCompare(b.userName);
    });
    const attendanceRows = sortedAttendance.map(log => ({
      'Date': log.date,
      'Employee ID': log.userId,
      'Employee Name': log.userName,
      'Access Role': (log.userRole || '').toUpperCase(),
      'Punch In Time': log.checkIn || 'N/A',
      'Punch Out Time': log.checkOut || 'N/A',
      'Total Duration': log.duration || 'N/A',
      'Status': log.status || 'Present'
    }));
    const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');

    // 4. Payroll Sheet
    const salaryRows = salaries.map(sal => ({
      'Salary Slip ID': sal.id,
      'Employee ID': sal.employeeId,
      'Employee Name': sal.employeeName,
      'Designation': sal.employeeRole,
      'Salary Month': sal.month,
      'Base Salary (INR)': sal.baseSalary,
      'Daily Rate (INR)': sal.dailyRate,
      'Total Working Days': sal.totalWorkingDays,
      'Days Present': sal.presentDays,
      'Half Days': sal.halfDays,
      'Days Absent': sal.absentDays,
      'Approved Leaves': sal.approvedLeaves,
      'Casual Leave Used': sal.clUsed,
      'Remaining CL Balance': sal.clRemaining,
      'Absent Deductions (INR)': sal.absentDeduction,
      'Half Day Deductions (INR)': sal.halfDayDeduction,
      'Leave Deductions (INR)': sal.leaveDeduction,
      'Total Deductions (INR)': sal.totalDeductions,
      'Net Salary Disbursed (INR)': sal.netSalary,
      'Payment Status': (sal.status || '').toUpperCase(),
      'Disbursal Date': sal.paymentDate || 'N/A',
      'Last Calculation Date': sal.updatedAt
    }));
    const wsPayroll = XLSX.utils.json_to_sheet(salaryRows);
    XLSX.utils.book_append_sheet(wb, wsPayroll, 'Payroll & Salaries');

    // 5. Leave Requests Sheet
    const leaveRows = leaveRequests.map(req => ({
      'Request ID': req.id,
      'Employee ID': req.employeeId,
      'Employee Name': req.employeeName,
      'Leave Type': req.type,
      'Start Date': req.startDate,
      'End Date': req.endDate,
      'Reason': req.reason,
      'Approval Status': req.status
    }));
    const wsLeaves = XLSX.utils.json_to_sheet(leaveRows);
    XLSX.utils.book_append_sheet(wb, wsLeaves, 'Time Off & Leaves');

    // 6. Departments Sheet
    const departmentRows = departments.map(dept => ({
      'Department ID': dept.id,
      'Department Name': dept.name,
      'Manager / HOD': dept.managerName,
      'Description': dept.description || 'N/A'
    }));
    const wsDepartments = XLSX.utils.json_to_sheet(departmentRows);
    XLSX.utils.book_append_sheet(wb, wsDepartments, 'Departments');

    // 7. Holidays Sheet
    const holidayRows = holidays.map(hol => ({
      'Holiday ID': hol.id,
      'Holiday Name': hol.name,
      'Start Date': hol.startDate || hol.date || '',
      'End Date': hol.endDate || hol.date || '',
      'Holiday Date': hol.date || hol.startDate || ''
    }));
    const wsHolidays = XLSX.utils.json_to_sheet(holidayRows);
    XLSX.utils.book_append_sheet(wb, wsHolidays, 'Holidays');

    // Write file to device
    XLSX.writeFile(wb, `HRMS_System_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  } catch (error) {
    console.error('Failed to export to Excel:', error);
    alert('An error occurred during Excel generation. Please try again.');
    return false;
  }
};

/**
 * Generates the raw Excel binary Uint8Array from HRMS state for Google Drive syncing.
 */
export const generateExcelBinary = ({
  employees,
  proposals,
  tasks,
  attendance,
  departments,
  leaveRequests,
  salaries,
  holidays,
  settings
}: {
  employees: Employee[];
  proposals: TaskProposal[];
  tasks: AssignedTask[];
  attendance: AttendanceLog[];
  departments: Department[];
  leaveRequests: LeaveRequest[];
  salaries: SalaryRecord[];
  holidays: Holiday[];
  settings?: {
    officeTime: string;
    officeEndTime: string;
    punchInTimes: { [key: string]: string };
  };
}): Uint8Array => {
  const wb = XLSX.utils.book_new();

  // 1. Employees Sheet
  const employeeRows = employees.map(emp => ({
    'Employee ID': emp.id,
    'Full Name': emp.name,
    'Email Address': emp.email,
    'Role / Designation': emp.jobTitle,
    'Access Role': (emp.role || '').toUpperCase(),
    'Department': emp.department,
    'Phone': emp.phone,
    'Address': emp.address,
    'Emergency Contact': emp.emergencyContact,
    'Base Monthly Salary': emp.salary,
    'Date of Joining': emp.joinDate,
    'Status': (emp.status || '').toUpperCase()
  }));
  const wsEmployees = XLSX.utils.json_to_sheet(employeeRows);
  XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employees');

  // 2. Tasks Sheet
  const taskRows = tasks.map(t => ({
    'Task ID': t.id,
    'Title': t.title,
    'Description': t.description,
    'Assigned Employee ID': t.employeeId,
    'Assigned Employee Name': t.employeeName,
    'Assigned By': t.assignedBy,
    'Priority': (t.priority || '').toUpperCase(),
    'Due Date': t.dueDate,
    'Status': (t.status || '').toUpperCase(),
    'Completion Date': t.completedAt || 'N/A'
  }));
  const wsTasks = XLSX.utils.json_to_sheet(taskRows);
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks');

  // 3. Attendance Sheet
  const activeLogs: AttendanceLog[] = [];
  const todayStr = new Date().toLocaleDateString('sv-SE');
  if (settings?.punchInTimes && employees) {
    Object.entries(settings.punchInTimes).forEach(([empId, punchVal]) => {
      const checkInTime = typeof punchVal === 'object' && punchVal !== null ? (punchVal as any).time : null;
      const punchDate = typeof punchVal === 'object' && punchVal !== null ? (punchVal as any).date : null;
      if (checkInTime && punchDate === todayStr) {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
          activeLogs.push({
            id: `ACTIVE-${empId}-${todayStr}`,
            userId: empId,
            userName: emp.name,
            userRole: emp.role,
            date: todayStr,
            checkIn: checkInTime,
            checkOut: undefined,
            duration: undefined,
            status: 'Punched In'
          });
        }
      }
    });
  }

  const combinedAttendance = [...activeLogs, ...attendance];
  const sortedAttendance = combinedAttendance.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const aCheckIn = a.checkIn || '';
    const bCheckIn = b.checkIn || '';
    const checkInCompare = aCheckIn.localeCompare(bCheckIn);
    if (checkInCompare !== 0) return checkInCompare;
    return a.userName.localeCompare(b.userName);
  });

  const attendanceRows = sortedAttendance.map(log => ({
    'Date': log.date,
    'Name': log.userName,
    'Employee ID': log.userId,
    'Company Role': (log.userRole || '').toUpperCase(),
    'Punch In': log.checkIn || 'N/A',
    'Punch Out': log.checkOut || 'N/A',
    'Total time of Punched': log.duration || 'N/A',
    'Attendance Status': log.status || 'Present'
  }));
  const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
  XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');

  // 4. Payroll Sheet
  const salaryRows = salaries.map(sal => ({
    'Salary Slip ID': sal.id,
    'Employee ID': sal.employeeId,
    'Employee Name': sal.employeeName,
    'Designation': sal.employeeRole,
    'Salary Month': sal.month,
    'Base Salary (INR)': sal.baseSalary,
    'Daily Rate (INR)': sal.dailyRate,
    'Total Working Days': sal.totalWorkingDays,
    'Days Present': sal.presentDays,
    'Half Days': sal.halfDays,
    'Days Absent': sal.absentDays,
    'Approved Leaves': sal.approvedLeaves,
    'Casual Leave Used': sal.clUsed,
    'Remaining CL Balance': sal.clRemaining,
    'Absent Deductions (INR)': sal.absentDeduction,
    'Half Day Deductions (INR)': sal.halfDayDeduction,
    'Leave Deductions (INR)': sal.leaveDeduction,
    'Total Deductions (INR)': sal.totalDeductions,
    'Net Salary Disbursed (INR)': sal.netSalary,
    'Payment Status': (sal.status || '').toUpperCase(),
    'Disbursal Date': sal.paymentDate || 'N/A',
    'Last Calculation Date': sal.updatedAt
  }));
  const wsPayroll = XLSX.utils.json_to_sheet(salaryRows);
  XLSX.utils.book_append_sheet(wb, wsPayroll, 'Payroll & Salaries');

  // 5. Leave Requests Sheet
  const leaveRows = leaveRequests.map(req => ({
    'Request ID': req.id,
    'Employee ID': req.employeeId,
    'Employee Name': req.employeeName,
    'Leave Type': req.type,
    'Start Date': req.startDate,
    'End Date': req.endDate,
    'Reason': req.reason,
    'Approval Status': req.status
  }));
  const wsLeaves = XLSX.utils.json_to_sheet(leaveRows);
  XLSX.utils.book_append_sheet(wb, wsLeaves, 'Time Off & Leaves');

  // 6. Departments Sheet
  const departmentRows = departments.map(dept => ({
    'Department ID': dept.id,
    'Department Name': dept.name,
    'Manager / HOD': dept.managerName,
    'Description': dept.description || 'N/A'
  }));
  const wsDepartments = XLSX.utils.json_to_sheet(departmentRows);
  XLSX.utils.book_append_sheet(wb, wsDepartments, 'Departments');

  // 7. Holidays Sheet
  const holidayRows = holidays.map(hol => ({
    'Holiday ID': hol.id,
    'Holiday Name': hol.name,
    'Start Date': hol.startDate || hol.date || '',
    'End Date': hol.endDate || hol.date || '',
    'Holiday Date': hol.date || hol.startDate || ''
  }));
  const wsHolidays = XLSX.utils.json_to_sheet(holidayRows);
  XLSX.utils.book_append_sheet(wb, wsHolidays, 'Holidays');

  // 8. Task Proposals Sheet
  const proposalRows = proposals.map(p => ({
    'Proposal ID': p.id,
    'Title': p.title,
    'Description': p.description,
    'Priority': (p.priority || '').toUpperCase(),
    'Due Date': p.dueDate,
    'Proposed Employee ID': p.proposedEmployeeId,
    'Manager ID': p.managerId,
    'Manager Name': p.managerName,
    'Status': (p.status || '').toUpperCase(),
    'Created At': p.createdAt,
    'Proposed by HR': p.proposedByHR ? 'YES' : 'NO'
  }));
  const wsProposals = XLSX.utils.json_to_sheet(proposalRows);
  XLSX.utils.book_append_sheet(wb, wsProposals, 'Task Proposals');

  // 9. System Settings Sheet
  const settingRows = [
    { 'Setting Name': 'Office Start Time', 'Value': settings?.officeTime || '09:30 AM' },
    { 'Setting Name': 'Office End Time', 'Value': settings?.officeEndTime || '05:00 PM' },
    { 'Setting Name': 'Punch In Times (JSON)', 'Value': JSON.stringify(settings?.punchInTimes || {}) }
  ];
  const wsSettings = XLSX.utils.json_to_sheet(settingRows);
  XLSX.utils.book_append_sheet(wb, wsSettings, 'System Settings');

  const excelBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuf);
};

/**
 * Parses a raw Excel workbook (.xlsx) back into the full HRMS state object.
 */
export const parseExcelToState = (arrayBuffer: ArrayBuffer): any | null => {
  try {
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const state: any = {};

    // 1. Employees Sheet
    if (wb.Sheets['Employees']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Employees']);
      state.employees = rows.map(r => sanitizeDefaultContactDetails({
        id: String(r['Employee ID'] || ''),
        name: String(r['Full Name'] || ''),
        email: String(r['Email Address'] || ''),
        jobTitle: String(r['Role / Designation'] || ''),
        role: String(r['Access Role'] || '').toLowerCase() as any,
        department: String(r['Department'] || ''),
        phone: String(r['Phone'] || ''),
        address: String(r['Address'] || ''),
        emergencyContact: String(r['Emergency Contact'] || ''),
        salary: String(r['Base Monthly Salary'] || ''),
        joinDate: String(r['Date of Joining'] || ''),
        status: String(r['Status'] || '').toLowerCase() as any,
      }));
    }

    // 2. Tasks Sheet
    if (wb.Sheets['Tasks']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Tasks']);
      state.tasks = rows.map(r => ({
        id: String(r['Task ID'] || ''),
        title: String(r['Title'] || ''),
        description: String(r['Description'] || ''),
        employeeId: String(r['Assigned Employee ID'] || ''),
        employeeName: String(r['Assigned Employee Name'] || ''),
        assignedBy: String(r['Assigned By'] || ''),
        priority: String(r['Priority'] || '').toLowerCase() as any,
        dueDate: String(r['Due Date'] || ''),
        status: String(r['Status'] || '').toLowerCase() as any,
        completedAt: r['Completion Date'] === 'N/A' || !r['Completion Date'] ? undefined : String(r['Completion Date']),
      }));
    }

    // 3. Attendance Sheet
    const attendanceSheet = wb.Sheets['Attendance'] || wb.Sheets['Punch In-Out Records'];
    if (attendanceSheet) {
      const rows = XLSX.utils.sheet_to_json<any>(attendanceSheet);
      state.attendance = rows.map((r, idx) => {
        const date = String(r['Date'] || r['Date of Work'] || '');
        const userId = String(r['Employee ID'] || '');
        const userName = String(r['Name'] || r['Employee Name'] || r['Full Name'] || '');
        const userRole = String(r['Company Role'] || r['Access Role'] || 'employee').toLowerCase() as any;
        const checkIn = r['Punch In'] || r['Punch In Time'] || 'N/A';
        const checkOut = r['Punch Out'] || r['Punch Out Time'] || 'N/A';
        const duration = r['Total time of Punched'] || r['Total Duration'] || r['Total timing of punched'] || 'N/A';
        const status = r['Attendance Status'] || r['Status'] || 'Present';

        return {
          id: `ATT-${userId}-${date}-${idx}`,
          date: date,
          userId: userId,
          userName: userName,
          userRole: userRole,
          checkIn: checkIn === 'N/A' ? undefined : String(checkIn),
          checkOut: checkOut === 'N/A' ? undefined : String(checkOut),
          duration: duration === 'N/A' ? undefined : String(duration),
          status: status as any
        };
      });
    }

    // 4. Payroll & Salaries Sheet
    if (wb.Sheets['Payroll & Salaries']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Payroll & Salaries']);
      state.salaries = rows.map(r => ({
        id: String(r['Salary Slip ID'] || ''),
        employeeId: String(r['Employee ID'] || ''),
        employeeName: String(r['Employee Name'] || ''),
        employeeRole: String(r['Designation'] || ''),
        month: String(r['Salary Month'] || ''),
        baseSalary: Number(r['Base Salary (INR)'] || 0),
        dailyRate: Number(r['Daily Rate (INR)'] || 0),
        totalWorkingDays: Number(r['Total Working Days'] || 0),
        presentDays: Number(r['Days Present'] || 0),
        halfDays: Number(r['Half Days'] || 0),
        absentDays: Number(r['Days Absent'] || 0),
        approvedLeaves: Number(r['Approved Leaves'] || 0),
        clUsed: Number(r['Casual Leave Used'] || 0),
        clRemaining: Number(r['Remaining CL Balance'] || 0),
        absentDeduction: Number(r['Absent Deductions (INR)'] || 0),
        halfDayDeduction: Number(r['Half Day Deductions (INR)'] || 0),
        leaveDeduction: Number(r['Leave Deductions (INR)'] || 0),
        totalDeductions: Number(r['Total Deductions (INR)'] || 0),
        netSalary: Number(r['Net Salary Disbursed (INR)'] || 0),
        status: String(r['Payment Status'] || '').toLowerCase() as any,
        paymentDate: r['Disbursal Date'] === 'N/A' || !r['Disbursal Date'] ? undefined : String(r['Disbursal Date']),
        updatedAt: String(r['Last Calculation Date'] || ''),
      }));
    }

    // 5. Time Off & Leaves Sheet
    if (wb.Sheets['Time Off & Leaves']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Time Off & Leaves']);
      state.leaveRequests = rows.map(r => ({
        id: String(r['Request ID'] || ''),
        employeeId: String(r['Employee ID'] || ''),
        employeeName: String(r['Employee Name'] || ''),
        type: String(r['Leave Type'] || '') as any,
        startDate: String(r['Start Date'] || ''),
        endDate: String(r['End Date'] || ''),
        reason: String(r['Reason'] || ''),
        status: String(r['Approval Status'] || 'pending') as any,
      }));
    }

    // 6. Departments Sheet
    if (wb.Sheets['Departments']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Departments']);
      state.departments = rows.map(r => ({
        id: String(r['Department ID'] || ''),
        name: String(r['Department Name'] || ''),
        managerName: String(r['Manager / HOD'] || ''),
        description: r['Description'] === 'N/A' || !r['Description'] ? '' : String(r['Description']),
      }));
    }

    // 7. Holidays Sheet
    if (wb.Sheets['Holidays']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Holidays']);
      state.holidays = rows.map(r => ({
        id: String(r['Holiday ID'] || ''),
        name: String(r['Holiday Name'] || ''),
        startDate: String(r['Start Date'] || r['Holiday Date'] || ''),
        endDate: String(r['End Date'] || r['Holiday Date'] || ''),
        date: String(r['Holiday Date'] || r['Start Date'] || ''),
      }));
    }

    // 8. Task Proposals Sheet
    if (wb.Sheets['Task Proposals']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['Task Proposals']);
      state.proposals = rows.map(r => ({
        id: String(r['Proposal ID'] || ''),
        title: String(r['Title'] || ''),
        description: String(r['Description'] || ''),
        priority: String(r['Priority'] || '').toLowerCase() as any,
        dueDate: String(r['Due Date'] || ''),
        proposedEmployeeId: String(r['Proposed Employee ID'] || ''),
        managerId: String(r['Manager ID'] || ''),
        managerName: String(r['Manager Name'] || ''),
        status: String(r['Status'] || '').toLowerCase() as any,
        createdAt: String(r['Created At'] || ''),
        proposedByHR: r['Proposed by HR'] === 'YES' || r['Proposed by HR'] === true,
      }));
    }

    // 9. System Settings Sheet
    if (wb.Sheets['System Settings']) {
      const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets['System Settings']);
      const settings: any = {};
      rows.forEach(r => {
        const name = r['Setting Name'];
        const val = r['Value'];
        if (name === 'Office Start Time') settings.officeTime = val;
        if (name === 'Office End Time') settings.officeEndTime = val;
        if (name === 'Punch In Times (JSON)') {
          try {
            settings.punchInTimes = JSON.parse(val);
          } catch (e) {
            settings.punchInTimes = {};
          }
        }
      });
      state.settings = settings;
    }

    return state;
  } catch (err) {
    console.error('Failed to parse Excel file to HRMS state:', err);
    return null;
  }
};

/**
 * Generates raw Excel binary specifically for Attendance Logs (Punch In, Punch Out, total timings)
 */
export const generateAttendanceExcelBinary = (
  attendance: AttendanceLog[],
  punchInTimes?: { [key: string]: string },
  employees?: Employee[]
): Uint8Array => {
  const wb = XLSX.utils.book_new();

  // Synthesize currently active punch-ins as live virtual attendance records
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const activeLogs: AttendanceLog[] = [];
  if (punchInTimes && employees) {
    Object.entries(punchInTimes).forEach(([empId, punchVal]) => {
      const checkInTime = typeof punchVal === 'object' && punchVal !== null ? (punchVal as any).time : null;
      const punchDate = typeof punchVal === 'object' && punchVal !== null ? (punchVal as any).date : null;
      if (checkInTime && punchDate === todayStr) {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
          activeLogs.push({
            id: `ACTIVE-${empId}-${todayStr}`,
            userId: empId,
            userName: emp.name,
            userRole: emp.role,
            date: todayStr,
            checkIn: checkInTime,
            checkOut: undefined,
            duration: undefined,
            status: 'Punched In'
          });
        }
      }
    });
  }

  const combinedAttendance = [...activeLogs, ...attendance];
  const sortedAttendance = combinedAttendance.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const aCheckIn = a.checkIn || '';
    const bCheckIn = b.checkIn || '';
    const checkInCompare = aCheckIn.localeCompare(bCheckIn);
    if (checkInCompare !== 0) return checkInCompare;
    return a.userName.localeCompare(b.userName);
  });

  const attendanceRows = sortedAttendance.map(log => ({
    'Date': log.date,
    'Name': log.userName,
    'Employee ID': log.userId,
    'Company Role': (log.userRole || '').toUpperCase(),
    'Punch In': log.checkIn || 'N/A',
    'Punch Out': log.checkOut || 'N/A',
    'Total time of Punched': log.duration || 'N/A',
    'Attendance Status': log.status || 'Present'
  }));

  const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
  
  // Set nice column widths for readability
  wsAttendance['!cols'] = [
    { wch: 15 }, // Date
    { wch: 25 }, // Name
    { wch: 15 }, // Employee ID
    { wch: 15 }, // Company Role
    { wch: 18 }, // Punch In
    { wch: 18 }, // Punch Out
    { wch: 25 }, // Total time of Punched
    { wch: 18 }  // Attendance Status
  ];

  XLSX.utils.book_append_sheet(wb, wsAttendance, 'Punch In-Out Records');

  const excelBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuf);
};

/**
 * Download filtered or complete Attendance Logs as a formatted Excel (.xlsx) workbook.
 */
export const exportAttendanceToExcel = (
  attendance: AttendanceLog[],
  title: string = 'Attendance_Report'
) => {
  try {
    const wb = XLSX.utils.book_new();
    const attendanceRows = attendance.map(log => ({
      'Date': log.date,
      'Employee ID': log.userId,
      'Employee Name': log.userName,
      'Designation / Role': (log.userRole || '').toUpperCase(),
      'Punch In Time': log.checkIn || 'N/A',
      'Punch Out Time': log.checkOut || 'N/A',
      'Total time of Punched': log.duration || 'N/A',
      'Attendance Status': log.status || 'Present'
    }));

    const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
    
    // Set nice column widths for readability
    wsAttendance['!cols'] = [
      { wch: 15 }, // Date
      { wch: 15 }, // Employee ID
      { wch: 25 }, // Employee Name
      { wch: 20 }, // Designation / Role
      { wch: 18 }, // Punch In Time
      { wch: 18 }, // Punch Out Time
      { wch: 25 }, // Total time of Punched
      { wch: 18 }  // Attendance Status
    ];

    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance Records');
    XLSX.writeFile(wb, `${title}_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  } catch (error) {
    console.error('Failed to export attendance to Excel:', error);
    alert('An error occurred during Excel generation. Please try again.');
    return false;
  }
};

/**
 * Download Monthly Payroll Summary as a formatted Excel (.xlsx) workbook.
 */
export const exportPayrollToExcel = (
  monthlySalaries: any[],
  selectedMonth: string
) => {
  try {
    const wb = XLSX.utils.book_new();
    const rows = monthlySalaries.map(s => ({
      'Employee ID': s.employeeId,
      'Employee Name': s.employeeName,
      'Role / Designation': (s.employeeRole || '').toUpperCase(),
      'Salary Month': s.month,
      'Base Salary (INR)': s.baseSalary,
      'Daily Rate (INR)': s.dailyRate,
      'Total Working Days': s.totalWorkingDays,
      'Days Present': s.presentDays,
      'Days Absent': s.absentDays,
      'Half Days': s.halfDays,
      'Approved Leaves': s.approvedLeaves,
      'Casual Leave Used': s.clUsed,
      'Remaining CL Balance': s.clRemaining,
      'Free Half Days Used': s.halfDaysFreeUsed || 0,
      'Total Deductions (INR)': s.totalDeductions,
      'Net Salary Paid (INR)': s.netSalary,
      'Payment Status': (s.status || '').toUpperCase()
    }));

    const wsPayroll = XLSX.utils.json_to_sheet(rows);

    // Set nice column widths for readability
    wsPayroll['!cols'] = [
      { wch: 15 }, // Employee ID
      { wch: 25 }, // Employee Name
      { wch: 20 }, // Role / Designation
      { wch: 15 }, // Salary Month
      { wch: 18 }, // Base Salary
      { wch: 15 }, // Daily Rate
      { wch: 18 }, // Total Working Days
      { wch: 15 }, // Days Present
      { wch: 15 }, // Days Absent
      { wch: 12 }, // Half Days
      { wch: 15 }, // Approved Leaves
      { wch: 15 }, // CL Used
      { wch: 20 }, // Remaining CL Balance
      { wch: 20 }, // Free Half Days Used
      { wch: 20 }, // Total Deductions
      { wch: 22 }, // Net Salary Paid
      { wch: 15 }  // Payment Status
    ];

    XLSX.utils.book_append_sheet(wb, wsPayroll, 'Payroll Summary');
    XLSX.writeFile(wb, `Payroll_Summary_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  } catch (error) {
    console.error('Failed to export payroll to Excel:', error);
    alert('An error occurred during Excel generation. Please try again.');
    return false;
  }
};


