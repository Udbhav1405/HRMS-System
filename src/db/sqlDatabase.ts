import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import {
  PDF_EMPLOYEES,
  PDF_ATTENDANCE_LOGS,
  PDF_LEAVE_REQUESTS,
  INITIAL_DEPARTMENTS_LIST
} from '../data/pdfAttendanceData.ts';

const DB_FILE_PATH = path.resolve(process.cwd(), 'hrms.db');

export interface HRMSDatabaseState {
  employees: any[];
  attendance: any[];
  tasks: any[];
  proposals: any[];
  leave_requests: any[];
  departments: any[];
  holidays: any[];
  salaries: any[];
  notifications: any[];
  settings: Record<string, any>;
  officeTime: string;
  officeEndTime: string;
  punchInTimes: Record<string, any>;
}

const DEFAULT_HOLIDAYS = [
  { id: 'HOL-01', name: "New Year's Day", startDate: '2026-01-01', endDate: '2026-01-01', date: '2026-01-01' },
  { id: 'HOL-02', name: 'Republic Day', startDate: '2026-01-26', endDate: '2026-01-26', date: '2026-01-26' },
  { id: 'HOL-03', name: 'Holi', startDate: '2026-03-04', endDate: '2026-03-04', date: '2026-03-04' },
  { id: 'HOL-04', name: 'Independence Day', startDate: '2026-08-15', endDate: '2026-08-15', date: '2026-08-15' },
  { id: 'HOL-05', name: 'Gandhi Jayanti', startDate: '2026-10-02', endDate: '2026-10-02', date: '2026-10-02' },
  { id: 'HOL-06', name: 'Diwali', startDate: '2026-11-08', endDate: '2026-11-08', date: '2026-11-08' },
  { id: 'HOL-07', name: 'Christmas Day', startDate: '2026-12-25', endDate: '2026-12-25', date: '2026-12-25' }
];

const DEFAULT_TASKS = [
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

class SQLDatabaseManager {
  private db: Database | null = null;
  private SQL: any = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.SQL = await initSqlJs();
      let fileBuffer: Buffer | null = null;
      if (fs.existsSync(DB_FILE_PATH)) {
        try {
          const buf = fs.readFileSync(DB_FILE_PATH);
          if (buf.length > 100) {
            fileBuffer = buf;
          }
        } catch (e) {
          console.warn('Could not read existing hrms.db, creating fresh SQLite database:', e);
        }
      }

      if (fileBuffer) {
        try {
          this.db = new this.SQL.Database(fileBuffer);
        } catch (e) {
          console.warn('hrms.db was corrupt or incompatible, re-creating:', e);
          this.db = new this.SQL.Database();
        }
      } else {
        this.db = new this.SQL.Database();
      }

      this.createTables();
      this.seedInitialDataIfEmpty();
      this.saveToDisk();
    })();

    return this.initPromise;
  }

  private createTables() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT,
        phone TEXT,
        address TEXT,
        emergencyContact TEXT,
        salary TEXT,
        joinDate TEXT,
        avatarColor TEXT,
        avatarUrl TEXT,
        status TEXT,
        jobTitle TEXT,
        password TEXT
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        userName TEXT NOT NULL,
        userRole TEXT,
        date TEXT NOT NULL,
        checkIn TEXT,
        checkOut TEXT,
        duration TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        proposalId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT,
        dueDate TEXT,
        employeeId TEXT NOT NULL,
        employeeName TEXT,
        assignedBy TEXT,
        status TEXT,
        completedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT,
        dueDate TEXT,
        proposedEmployeeId TEXT,
        managerId TEXT,
        managerName TEXT,
        status TEXT,
        createdAt TEXT,
        proposedByHR INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        employeeName TEXT NOT NULL,
        type TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL,
        referredDate TEXT,
        managerDecisionDate TEXT,
        finalDecisionDate TEXT
      );

      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        managerName TEXT,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        startDate TEXT,
        endDate TEXT,
        date TEXT
      );

      CREATE TABLE IF NOT EXISTS salaries (
        id TEXT PRIMARY KEY,
        employeeId TEXT NOT NULL,
        employeeName TEXT,
        employeeRole TEXT,
        month TEXT NOT NULL,
        baseSalary REAL,
        dailyRate REAL,
        totalWorkingDays INTEGER,
        presentDays INTEGER,
        absentDays INTEGER,
        halfDays INTEGER,
        approvedLeaves INTEGER,
        clUsed INTEGER,
        halfDaysFreeUsed INTEGER,
        clRemaining INTEGER,
        halfDaysFreeRemaining INTEGER,
        absentDeduction REAL,
        halfDayDeduction REAL,
        leaveDeduction REAL,
        totalDeductions REAL,
        netSalary REAL,
        status TEXT,
        paymentDate TEXT,
        updatedAt TEXT,
        customBonus REAL DEFAULT 0,
        customBonusReason TEXT,
        customDeduction REAL DEFAULT 0,
        customDeductionReason TEXT
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        type TEXT,
        createdAt TEXT,
        read INTEGER DEFAULT 0,
        taskId TEXT,
        assignedBy TEXT
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  private seedInitialDataIfEmpty() {
    if (!this.db) return;

    // Check if employees table is populated
    const empCountRes = this.db.exec('SELECT COUNT(*) as count FROM employees');
    const empCount = empCountRes.length > 0 && empCountRes[0].values[0] ? Number(empCountRes[0].values[0][0]) : 0;

    if (empCount === 0) {
      console.log('[SQLite DB] Seeding default HRMS employee profiles...');
      const insertEmp = this.db.prepare(`
        INSERT OR REPLACE INTO employees 
        (id, name, email, role, department, phone, address, emergencyContact, salary, joinDate, avatarColor, avatarUrl, status, jobTitle, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const emp of PDF_EMPLOYEES) {
        insertEmp.run([
          emp.id,
          emp.name,
          emp.email,
          emp.role,
          emp.department || '',
          emp.phone || '',
          emp.address || '',
          emp.emergencyContact || '',
          emp.salary || 'INR 10,000',
          emp.joinDate || '2026-01-01',
          emp.avatarColor || 'bg-indigo-600 text-white',
          emp.avatarUrl || '',
          emp.status || 'working',
          emp.jobTitle || emp.role,
          emp.password || 'password123'
        ]);
      }
      insertEmp.free();
    }

    // Check departments
    const deptCountRes = this.db.exec('SELECT COUNT(*) as count FROM departments');
    const deptCount = deptCountRes.length > 0 && deptCountRes[0].values[0] ? Number(deptCountRes[0].values[0][0]) : 0;
    if (deptCount === 0) {
      const insertDept = this.db.prepare('INSERT OR REPLACE INTO departments (id, name, managerName, description) VALUES (?, ?, ?, ?)');
      for (const dept of INITIAL_DEPARTMENTS_LIST) {
        insertDept.run([dept.id, dept.name, dept.managerName, dept.description || '']);
      }
      insertDept.free();
    }

    // Check holidays
    const holCountRes = this.db.exec('SELECT COUNT(*) as count FROM holidays');
    const holCount = holCountRes.length > 0 && holCountRes[0].values[0] ? Number(holCountRes[0].values[0][0]) : 0;
    if (holCount === 0) {
      const insertHol = this.db.prepare('INSERT OR REPLACE INTO holidays (id, name, startDate, endDate, date) VALUES (?, ?, ?, ?, ?)');
      for (const hol of DEFAULT_HOLIDAYS) {
        insertHol.run([hol.id, hol.name, hol.startDate, hol.endDate, hol.date]);
      }
      insertHol.free();
    }

    // Check tasks
    const taskCountRes = this.db.exec('SELECT COUNT(*) as count FROM tasks');
    const taskCount = taskCountRes.length > 0 && taskCountRes[0].values[0] ? Number(taskCountRes[0].values[0][0]) : 0;
    if (taskCount === 0) {
      const insertTask = this.db.prepare(`
        INSERT OR REPLACE INTO tasks 
        (id, proposalId, title, description, priority, dueDate, employeeId, employeeName, assignedBy, status, completedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const task of DEFAULT_TASKS) {
        insertTask.run([
          task.id,
          null,
          task.title,
          task.description,
          task.priority,
          task.dueDate,
          task.employeeId,
          task.employeeName,
          task.assignedBy,
          task.status,
          task.completedAt || null
        ]);
      }
      insertTask.free();
    }

    // Check attendance
    const attCountRes = this.db.exec('SELECT COUNT(*) as count FROM attendance');
    const attCount = attCountRes.length > 0 && attCountRes[0].values[0] ? Number(attCountRes[0].values[0][0]) : 0;
    if (attCount === 0) {
      const insertAtt = this.db.prepare(`
        INSERT OR REPLACE INTO attendance 
        (id, userId, userName, userRole, date, checkIn, checkOut, duration, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const att of PDF_ATTENDANCE_LOGS) {
        insertAtt.run([
          att.id,
          att.userId,
          att.userName,
          att.userRole,
          att.date,
          att.checkIn,
          att.checkOut || null,
          att.duration || null,
          att.status || 'On Time'
        ]);
      }
      insertAtt.free();
    }

    // Check leave_requests
    const leaveCountRes = this.db.exec('SELECT COUNT(*) as count FROM leave_requests');
    const leaveCount = leaveCountRes.length > 0 && leaveCountRes[0].values[0] ? Number(leaveCountRes[0].values[0][0]) : 0;
    if (leaveCount === 0) {
      const insertLeave = this.db.prepare(`
        INSERT OR REPLACE INTO leave_requests
        (id, employeeId, employeeName, type, startDate, endDate, reason, status, referredDate, managerDecisionDate, finalDecisionDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const req of PDF_LEAVE_REQUESTS) {
        insertLeave.run([
          req.id,
          req.employeeId,
          req.employeeName,
          req.type,
          req.startDate,
          req.endDate,
          req.reason,
          req.status,
          req.referredDate || null,
          req.managerDecisionDate || null,
          req.finalDecisionDate || null
        ]);
      }
      insertLeave.free();
    }

    // Check settings
    const insertSetting = this.db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
    insertSetting.run(['officeTime', JSON.stringify('09:30 AM')]);
    insertSetting.run(['officeEndTime', JSON.stringify('05:00 PM')]);
    insertSetting.run(['punchInTimes', JSON.stringify({})]);
    insertSetting.free();
  }

  saveToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE_PATH, buffer);
    } catch (err) {
      console.error('[SQLite DB] Failed to save hrms.db to disk:', err);
    }
  }

  // Convert table query results into clean JS object arrays
  private queryTable(tableName: string): any[] {
    if (!this.db) return [];
    try {
      const res = this.db.exec(`SELECT * FROM ${tableName}`);
      if (res.length === 0) return [];
      const { columns, values } = res[0];
      return values.map(row => {
        const obj: Record<string, any> = {};
        columns.forEach((col, idx) => {
          let val: any = row[idx];
          if (typeof val === 'string') {
            const trimmed = val.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              try {
                val = JSON.parse(trimmed);
              } catch {}
            }
          }
          if (tableName === 'proposals' && col === 'proposedByHR') {
            val = Boolean(val);
          }
          if (tableName === 'notifications' && col === 'read') {
            val = Boolean(val);
          }
          obj[col] = val;
        });
        return obj;
      });
    } catch (e) {
      console.warn(`Query on table ${tableName} failed:`, e);
      return [];
    }
  }

  getAllData(): HRMSDatabaseState {
    const employees = this.queryTable('employees');
    const attendance = this.queryTable('attendance');
    const tasks = this.queryTable('tasks');
    const proposals = this.queryTable('proposals');
    const leave_requests = this.queryTable('leave_requests');
    const departments = this.queryTable('departments');
    const holidays = this.queryTable('holidays');
    const salaries = this.queryTable('salaries');
    const notifications = this.queryTable('notifications');
    const settingsRows = this.queryTable('system_settings');

    const settings: Record<string, any> = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    let officeTime = '09:30 AM';
    let officeEndTime = '05:00 PM';
    let punchInTimes: Record<string, any> = {};

    if (settings['officeTime']) {
      try {
        officeTime = typeof settings['officeTime'] === 'string' ? JSON.parse(settings['officeTime']) : settings['officeTime'];
      } catch {
        officeTime = settings['officeTime'];
      }
    }
    if (settings['officeEndTime']) {
      try {
        officeEndTime = typeof settings['officeEndTime'] === 'string' ? JSON.parse(settings['officeEndTime']) : settings['officeEndTime'];
      } catch {
        officeEndTime = settings['officeEndTime'];
      }
    }
    if (settings['punchInTimes']) {
      try {
        punchInTimes = typeof settings['punchInTimes'] === 'string' ? JSON.parse(settings['punchInTimes']) : settings['punchInTimes'];
      } catch {
        punchInTimes = settings['punchInTimes'];
      }
    }

    return {
      employees,
      attendance,
      tasks,
      proposals,
      leave_requests,
      departments,
      holidays,
      salaries,
      notifications,
      settings,
      officeTime,
      officeEndTime,
      punchInTimes
    };
  }

  saveCollection(key: string, data: any): boolean {
    if (!this.db) return false;

    try {
      const tableMap: Record<string, string> = {
        employees: 'employees',
        attendance: 'attendance',
        tasks: 'tasks',
        proposals: 'proposals',
        leave_requests: 'leave_requests',
        departments: 'departments',
        holidays: 'holidays',
        salaries: 'salaries',
        notifications: 'notifications'
      };

      const tableName = tableMap[key];
      if (tableName) {
        const rows = Array.isArray(data) ? data : [];
        this.db.run(`DELETE FROM ${tableName}`);
        if (rows.length > 0) {
          const sample = rows[0];
          const keys = Object.keys(sample);
          const placeholders = keys.map(() => '?').join(', ');
          const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
          const stmt = this.db.prepare(sql);
          for (const row of rows) {
            const values = keys.map(k => {
              const val = row[k];
              if (val === undefined || val === null) return null;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (typeof val === 'object') return JSON.stringify(val);
              return val;
            });
            stmt.run(values);
          }
          stmt.free();
        }
      } else {
        // System settings (officeTime, officeEndTime, punchInTimes, etc.)
        const stmt = this.db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
        const valStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
        stmt.run([key, valStr]);
        stmt.free();
      }

      this.saveToDisk();
      return true;
    } catch (err) {
      console.error(`[SQLite DB] Error saving collection ${key}:`, err);
      return false;
    }
  }

  executeCustomSql(sql: string, params: SqlValue[] = []): { columns: string[]; rows: any[] } {
    if (!this.db) throw new Error('Database not initialized');
    const isSelect = /^\s*SELECT/i.test(sql.trim());
    if (isSelect) {
      const res = this.db.exec(sql, params);
      if (res.length === 0) return { columns: [], rows: [] };
      const { columns, values } = res[0];
      const rows = values.map(vRow => {
        const rowObj: Record<string, any> = {};
        columns.forEach((c, idx) => {
          rowObj[c] = vRow[idx];
        });
        return rowObj;
      });
      return { columns, rows };
    } else {
      this.db.run(sql, params);
      this.saveToDisk();
      return { columns: ['status'], rows: [{ status: 'Query executed successfully' }] };
    }
  }

  resetDatabase(): boolean {
    if (!this.db) return false;
    try {
      this.db.run(`
        DROP TABLE IF EXISTS employees;
        DROP TABLE IF EXISTS attendance;
        DROP TABLE IF EXISTS tasks;
        DROP TABLE IF EXISTS proposals;
        DROP TABLE IF EXISTS leave_requests;
        DROP TABLE IF EXISTS departments;
        DROP TABLE IF EXISTS holidays;
        DROP TABLE IF EXISTS salaries;
        DROP TABLE IF EXISTS notifications;
        DROP TABLE IF EXISTS system_settings;
      `);
      this.createTables();
      this.seedInitialDataIfEmpty();
      this.saveToDisk();
      return true;
    } catch (err) {
      console.error('[SQLite DB] Reset failed:', err);
      return false;
    }
  }

  getTableStats(): Record<string, number> {
    if (!this.db) return {};
    const tables = ['employees', 'attendance', 'tasks', 'proposals', 'leave_requests', 'departments', 'holidays', 'salaries', 'notifications', 'system_settings'];
    const stats: Record<string, number> = {};
    for (const t of tables) {
      try {
        const res = this.db.exec(`SELECT COUNT(*) FROM ${t}`);
        stats[t] = res.length > 0 && res[0].values[0] ? Number(res[0].values[0][0]) : 0;
      } catch {
        stats[t] = 0;
      }
    }
    return stats;
  }
}

export const sqlDb = new SQLDatabaseManager();
