// Shared Types and Interfaces for HRMS System

export type EmployeeStatus = 'working' | 'not working' | 'on internship' | 'internship completed' | 'active' | 'inactive';

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  phone: string;
  address: string;
  emergencyContact: string;
  salary: string;
  joinDate: string;
  avatarColor: string;
  avatarUrl?: string;
  status: EmployeeStatus;
  jobTitle: string;
  password?: string; // Optional or required, let's make it optional to be safe, but let's treat it as required in implementation.
}

export interface TaskProposal {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  proposedEmployeeId: string;
  managerId: string;
  managerName: string;
  status: 'pending' | 'assigned' | 'manager_pending' | 'approved_by_manager';
  createdAt: string;
  proposedByHR?: boolean;
}

export interface AssignedTask {
  id: string;
  proposalId?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  employeeId: string;
  employeeName: string;
  assignedBy: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedAt?: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  duration?: string;
  status?: 'On Time' | 'Late' | 'Absent' | 'Half Day' | 'Paid Half Day' | 'Casual Leave (CL)' | 'Sunday Off' | 'Holiday' | 'Punched In' | 'On Leave';
}

export interface Department {
  id: string;
  name: string;
  managerName: string;
  description?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'Leave' | 'Half Day';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending HR' | 'Referred to Manager' | 'Manager Approved' | 'Manager Declined' | 'Approved' | 'Declined' | 'Pending Admin/Manager';
  referredDate?: string;
  managerDecisionDate?: string;
  finalDecisionDate?: string;
}

export interface OfficeTiming {
  officeTime: string; // e.g., "09:00"
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  date?: string; // Fallback for backward compatibility
}

export interface SalaryRecord {
  id: string; // "SAL-EMP123-2026-07"
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  month: string; // "2026-07"
  baseSalary: number;
  dailyRate: number;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  approvedLeaves: number;
  clUsed: number;
  halfDaysFreeUsed: number;
  clRemaining: number;
  halfDaysFreeRemaining: number;
  absentDeduction: number;
  halfDayDeduction: number;
  leaveDeduction: number;
  totalDeductions: number;
  netSalary: number;
  status: 'Draft' | 'Approved' | 'Paid';
  paymentDate?: string;
  updatedAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'leave_status' | 'general';
  createdAt: string;
  read: boolean;
  taskId?: string;
  assignedBy?: string;
}

export interface SmtpClientConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string; // 16-character Google App Password or SMTP password
  senderAddress: string; // The customized sender Gmail address (filled by user)
  senderName: string; // The customized sender display name
  provider?: 'gmail' | 'custom' | 'simulation';
}

export interface EmailLog {
  id: string;
  messageId: string;
  recipientEmail: string; // The staff Gmail address (customized/filled by user)
  recipientName: string;
  senderEmail: string; // The customized sender Gmail address
  senderName?: string;
  subject: string;
  taskTitle?: string;
  taskId?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  assignedBy?: string;
  htmlContent: string;
  textContent: string;
  smtpHost: string;
  smtpPort: number;
  smtpResponse: string;
  smtpLogs: string[];
  status: 'delivered' | 'queued' | 'failed';
  sentAt: string;
  deliveryMethod?: 'real_smtp' | 'gmail_web' | 'simulation';
  realMessageId?: string;
}


