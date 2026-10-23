import { Employee, AttendanceLog, LeaveRequest, Department } from '../types';

export const INITIAL_DEPARTMENTS_LIST: Department[] = [
  {
    id: 'DEPT-001',
    name: 'Administration',
    managerName: 'Aarav Sharma',
    description: 'Executive administration, corporate governance, and organization oversight.'
  },
  {
    id: 'DEPT-002',
    name: 'Operations',
    managerName: 'Rajesh Malhotra',
    description: 'Operational delivery, client management, business processes, and team directives.'
  },
  {
    id: 'DEPT-003',
    name: 'Human Resources',
    managerName: 'Priya Sharma',
    description: 'Talent recruitment, employee relations, leave policies, and monthly payroll disbursement.'
  },
  {
    id: 'DEPT-004',
    name: 'Engineering',
    managerName: 'Rajesh Malhotra',
    description: 'Product engineering, system architecture, cloud deployment, and software development.'
  }
];

export const PDF_EMPLOYEES: Employee[] = [
  {
    id: "EMP-001",
    name: "Aarav Sharma",
    email: "admin@hrms.demo",
    role: "admin",
    department: "Administration",
    phone: "+91 98765 00001",
    address: "Plot 14, Sector 62, Noida, Uttar Pradesh",
    emergencyContact: "+91 98765 00099",
    salary: "INR 85,000",
    joinDate: "2024-01-10",
    avatarColor: "bg-indigo-600 text-white",
    avatarUrl: "",
    status: "working",
    jobTitle: "System Administrator",
    password: "admin123"
  },
  {
    id: "EMP-002",
    name: "Rajesh Malhotra",
    email: "manager@hrms.demo",
    role: "manager",
    department: "Operations",
    phone: "+91 98765 00002",
    address: "DLF Cyber City, Tower B, Gurugram, Haryana",
    emergencyContact: "+91 98765 00098",
    salary: "INR 65,000",
    joinDate: "2024-03-15",
    avatarColor: "bg-blue-600 text-white",
    avatarUrl: "",
    status: "working",
    jobTitle: "Operations Manager",
    password: "manager123"
  },
  {
    id: "EMP-003",
    name: "Priya Sharma",
    email: "hr@hrms.demo",
    role: "hr",
    department: "Human Resources",
    phone: "+91 98765 00003",
    address: "100 Feet Road, Indiranagar, Bengaluru, Karnataka",
    emergencyContact: "+91 98765 00097",
    salary: "INR 50,000",
    joinDate: "2024-05-01",
    avatarColor: "bg-rose-600 text-white",
    avatarUrl: "",
    status: "working",
    jobTitle: "HR Manager",
    password: "hr123"
  },
  {
    id: "EMP-004",
    name: "Rohan Verma",
    email: "employee@hrms.demo",
    role: "employee",
    department: "Engineering",
    phone: "+91 98765 00004",
    address: "27th Main, Sector 1, HSR Layout, Bengaluru, Karnataka",
    emergencyContact: "+91 98765 00096",
    salary: "INR 40,000",
    joinDate: "2024-07-15",
    avatarColor: "bg-emerald-600 text-white",
    avatarUrl: "",
    status: "working",
    jobTitle: "Software Engineer",
    password: "employee123"
  }
];

export const PDF_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: "LEV-101",
    employeeId: "EMP-004",
    employeeName: "Rohan Verma",
    type: "Leave",
    startDate: "2026-10-14",
    endDate: "2026-10-15",
    reason: "Attending Full-Stack Engineering Symposium and certification exam.",
    status: "Approved",
    referredDate: "2026-10-10",
    managerDecisionDate: "2026-10-11",
    finalDecisionDate: "2026-10-11"
  },
  {
    id: "LEV-102",
    employeeId: "EMP-004",
    employeeName: "Rohan Verma",
    type: "Half Day",
    startDate: "2026-10-21",
    endDate: "2026-10-21",
    reason: "Scheduled dental checkup and routine health appointment.",
    status: "Approved",
    referredDate: "2026-10-19",
    managerDecisionDate: "2026-10-20",
    finalDecisionDate: "2026-10-20"
  },
  {
    id: "LEV-103",
    employeeId: "EMP-003",
    employeeName: "Priya Sharma",
    type: "Leave",
    startDate: "2026-10-27",
    endDate: "2026-10-28",
    reason: "Family function in hometown.",
    status: "Pending Admin/Manager",
    referredDate: "2026-10-22"
  }
];

export const PDF_ATTENDANCE_LOGS: AttendanceLog[] = [
  // --- Rohan Verma (EMP-004, Employee) ---
  { id: "ATT-101", userId: "EMP-004", userName: "Rohan Verma", userRole: "employee", date: "2026-10-16", checkIn: "09:18 AM", checkOut: "05:15 PM", duration: "7h 57m", status: "On Time" },
  { id: "ATT-102", userId: "EMP-004", userName: "Rohan Verma", userRole: "employee", date: "2026-10-17", checkIn: "09:42 AM", checkOut: "05:20 PM", duration: "7h 38m", status: "Late" },
  { id: "ATT-103", userId: "EMP-004", userName: "Rohan Verma", userRole: "employee", date: "2026-10-19", checkIn: "09:15 AM", checkOut: "05:10 PM", duration: "7h 55m", status: "On Time" },
  { id: "ATT-104", userId: "EMP-004", userName: "Rohan Verma", userRole: "employee", date: "2026-10-20", checkIn: "09:24 AM", checkOut: "05:18 PM", duration: "7h 54m", status: "On Time" },
  { id: "ATT-105", userId: "EMP-004", userName: "Rohan Verma", userRole: "employee", date: "2026-10-21", checkIn: "09:30 AM", checkOut: "01:30 PM", duration: "4h 00m", status: "Paid Half Day" },
  { id: "ATT-106", userId: "EMP-004", userName: "Rohan Verma", userRole: "employee", date: "2026-10-22", checkIn: "09:20 AM", checkOut: "05:12 PM", duration: "7h 52m", status: "On Time" },

  // --- Priya Sharma (EMP-003, HR) ---
  { id: "ATT-107", userId: "EMP-003", userName: "Priya Sharma", userRole: "hr", date: "2026-10-16", checkIn: "09:25 AM", checkOut: "05:14 PM", duration: "7h 49m", status: "On Time" },
  { id: "ATT-108", userId: "EMP-003", userName: "Priya Sharma", userRole: "hr", date: "2026-10-17", checkIn: "09:22 AM", checkOut: "05:08 PM", duration: "7h 46m", status: "On Time" },
  { id: "ATT-109", userId: "EMP-003", userName: "Priya Sharma", userRole: "hr", date: "2026-10-19", checkIn: "09:30 AM", checkOut: "05:15 PM", duration: "7h 45m", status: "On Time" },
  { id: "ATT-110", userId: "EMP-003", userName: "Priya Sharma", userRole: "hr", date: "2026-10-20", checkIn: "09:20 AM", checkOut: "05:12 PM", duration: "7h 52m", status: "On Time" },
  { id: "ATT-111", userId: "EMP-003", userName: "Priya Sharma", userRole: "hr", date: "2026-10-21", checkIn: "09:32 AM", checkOut: "05:18 PM", duration: "7h 46m", status: "On Time" },
  { id: "ATT-112", userId: "EMP-003", userName: "Priya Sharma", userRole: "hr", date: "2026-10-22", checkIn: "09:26 AM", checkOut: "05:15 PM", duration: "7h 49m", status: "On Time" },

  // --- Rajesh Malhotra (EMP-002, Manager) ---
  { id: "ATT-113", userId: "EMP-002", userName: "Rajesh Malhotra", userRole: "manager", date: "2026-10-16", checkIn: "09:15 AM", checkOut: "05:30 PM", duration: "8h 15m", status: "On Time" },
  { id: "ATT-114", userId: "EMP-002", userName: "Rajesh Malhotra", userRole: "manager", date: "2026-10-17", checkIn: "09:20 AM", checkOut: "05:25 PM", duration: "8h 05m", status: "On Time" },
  { id: "ATT-115", userId: "EMP-002", userName: "Rajesh Malhotra", userRole: "manager", date: "2026-10-19", checkIn: "09:18 AM", checkOut: "05:20 PM", duration: "8h 02m", status: "On Time" },
  { id: "ATT-116", userId: "EMP-002", userName: "Rajesh Malhotra", userRole: "manager", date: "2026-10-20", checkIn: "09:15 AM", checkOut: "05:15 PM", duration: "8h 00m", status: "On Time" },
  { id: "ATT-117", userId: "EMP-002", userName: "Rajesh Malhotra", userRole: "manager", date: "2026-10-21", checkIn: "09:22 AM", checkOut: "05:28 PM", duration: "8h 06m", status: "On Time" },
  { id: "ATT-118", userId: "EMP-002", userName: "Rajesh Malhotra", userRole: "manager", date: "2026-10-22", checkIn: "09:16 AM", checkOut: "05:22 PM", duration: "8h 06m", status: "On Time" },

  // --- Aarav Sharma (EMP-001, Admin) ---
  { id: "ATT-119", userId: "EMP-001", userName: "Aarav Sharma", userRole: "admin", date: "2026-10-16", checkIn: "09:12 AM", checkOut: "05:35 PM", duration: "8h 23m", status: "On Time" },
  { id: "ATT-120", userId: "EMP-001", userName: "Aarav Sharma", userRole: "admin", date: "2026-10-17", checkIn: "09:15 AM", checkOut: "05:30 PM", duration: "8h 15m", status: "On Time" },
  { id: "ATT-121", userId: "EMP-001", userName: "Aarav Sharma", userRole: "admin", date: "2026-10-19", checkIn: "09:15 AM", checkOut: "05:30 PM", duration: "8h 15m", status: "On Time" },
  { id: "ATT-122", userId: "EMP-001", userName: "Aarav Sharma", userRole: "admin", date: "2026-10-20", checkIn: "09:10 AM", checkOut: "05:40 PM", duration: "8h 30m", status: "On Time" },
  { id: "ATT-123", userId: "EMP-001", userName: "Aarav Sharma", userRole: "admin", date: "2026-10-21", checkIn: "09:14 AM", checkOut: "05:32 PM", duration: "8h 18m", status: "On Time" },
  { id: "ATT-124", userId: "EMP-001", userName: "Aarav Sharma", userRole: "admin", date: "2026-10-22", checkIn: "09:12 AM", checkOut: "05:30 PM", duration: "8h 18m", status: "On Time" }
];

export const TODAY_PUNCH_IN_TIMES: { [empId: string]: { time: string; date: string } } = {};
