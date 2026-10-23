import React, { useState, useEffect } from 'react';
import { Employee, AttendanceLog, LeaveRequest, SalaryRecord, Holiday } from '../types';
import { calculateMonthlySalary, getDaysInMonth } from '../utils/salaryCalculator';
import { formatINR, parseSalary } from '../App';
import { isExcludedStaff } from '../utils/sqlClient.ts';
import { exportPayrollToExcel } from '../utils/excelExporter';
import { generateEmployeeSalaryPDF, generateAllEmployeesSalaryReportPDF } from '../utils/salaryPdfGenerator';
import { trackEvent } from '../utils/analytics';
import { 
  IndianRupee, 
  Calendar, 
  Clock, 
  User, 
  ShieldAlert, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  FileText, 
  Printer, 
  Plus, 
  Trash2, 
  Sparkles,
  Info,
  Sliders,
  DollarSign,
  Download,
  X,
  ArrowLeft
} from 'lucide-react';

interface PayrollTabProps {
  employees: Employee[];
  attendance: AttendanceLog[];
  leaveRequests: LeaveRequest[];
  salaries: SalaryRecord[];
  setSalaries: React.Dispatch<React.SetStateAction<SalaryRecord[]>>;
  activeUser: Employee;
  holidays: Holiday[];
}

export function PayrollTab({ 
  employees, 
  attendance, 
  leaveRequests, 
  salaries, 
  setSalaries, 
  activeUser,
  holidays
}: PayrollTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [activeSlip, setActiveSlip] = useState<SalaryRecord | null>(null);
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustingSlipId, setAdjustingSlipId] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Form states for manual adjustments
  const [bonusAmount, setBonusAmount] = useState<string>('');
  const [bonusLabel, setBonusLabel] = useState<string>('');
  const [deductAmount, setDeductAmount] = useState<string>('');
  const [deductLabel, setDeductLabel] = useState<string>('');

  // Extended Salary Record type with custom adjustments
  interface SalaryAdjustment {
    bonus: number;
    bonusReason: string;
    deduction: number;
    deductionReason: string;
  }

  const [adjustments, setAdjustments] = useState<Record<string, SalaryAdjustment>>(() => {
    try {
      const saved = sessionStorage.getItem('payroll_manual_adjustments');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    sessionStorage.setItem('payroll_manual_adjustments', JSON.stringify(adjustments));
  }, [adjustments]);

  useEffect(() => {
    if (activeSlip && isAutoPrinting) {
      const timer = setTimeout(() => {
        window.print();
        setIsAutoPrinting(false);
        setActiveSlip(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeSlip, isAutoPrinting]);

  // Months list for selection
  const months = [
    { value: '2026-05', label: 'May 2026' },
    { value: '2026-06', label: 'June 2026' },
    { value: '2026-07', label: 'July 2026' },
    { value: '2026-08', label: 'August 2026' },
    { value: '2026-09', label: 'September 2026' },
  ];

  // Helper to get or calculate salary record
  const getSalaryForEmployee = (emp: Employee, monthStr: string): SalaryRecord => {
    // Check if we have a saved salary record in the state (e.g. from Google Sheets database)
    const saved = salaries.find(s => s.employeeId === emp.id && s.month === monthStr);
    
    // Calculate a fresh one
    const calculated = calculateMonthlySalary(emp, monthStr, attendance, leaveRequests, holidays);
    
    // Apply manual adjustments if they exist
    const adj = adjustments[`${emp.id}-${monthStr}`];
    if (adj) {
      const netWithAdj = Math.max(0, calculated.netSalary + adj.bonus - adj.deduction);
      return {
        ...calculated,
        id: saved?.id || calculated.id,
        status: saved?.status || 'Draft',
        paymentDate: saved?.paymentDate,
        netSalary: netWithAdj,
        totalDeductions: calculated.totalDeductions + adj.deduction,
        // We store custom values dynamically
        ...({
          customBonus: adj.bonus,
          customBonusReason: adj.bonusReason,
          customDeduction: adj.deduction,
          customDeductionReason: adj.deductionReason
        } as any)
      };
    }

    if (saved) {
      const isBaseSalaryOutdated = Boolean(saved.baseSalary && saved.baseSalary !== calculated.baseSalary);
      return {
        ...calculated,
        id: saved.id,
        status: saved.status,
        paymentDate: saved.paymentDate,
        netSalary: isBaseSalaryOutdated && saved.status !== 'Paid' ? calculated.netSalary : saved.netSalary
      };
    }

    return calculated;
  };

  // Process and list salaries for selected month (excluding removed staff)
  const cleanEmployees = employees.filter(emp => !isExcludedStaff(emp));
  const monthlySalaries = cleanEmployees.map(emp => getSalaryForEmployee(emp, selectedMonth));

  const totalPayout = monthlySalaries.reduce((sum, s) => sum + s.netSalary, 0);
  const paidSlipsCount = monthlySalaries.filter(s => s.status === 'Paid').length;
  const pendingSlipsCount = monthlySalaries.filter(s => s.status !== 'Paid').length;

  // Change status of a salary slip
  const updateSlipStatus = (empId: string, status: 'Draft' | 'Approved' | 'Paid') => {
    const freshSlip = getSalaryForEmployee(employees.find(e => e.id === empId)!, selectedMonth);
    const updatedSlip: SalaryRecord = {
      ...freshSlip,
      status,
      paymentDate: status === 'Paid' ? new Date().toISOString().split('T')[0] : undefined,
      updatedAt: new Date().toISOString()
    };

    setSalaries(prev => {
      const index = prev.findIndex(s => s.employeeId === empId && s.month === selectedMonth);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = updatedSlip;
        return copy;
      } else {
        return [...prev, updatedSlip];
      }
    });

    if (activeSlip && activeSlip.employeeId === empId) {
      setActiveSlip(updatedSlip);
    }
  };

  // Bulk status update
  const handleBulkStatusChange = (status: 'Approved' | 'Paid') => {
    const updatedRecords: SalaryRecord[] = [];
    
    monthlySalaries.forEach(freshSlip => {
      const updatedSlip: SalaryRecord = {
        ...freshSlip,
        status,
        paymentDate: status === 'Paid' ? new Date().toISOString().split('T')[0] : undefined,
        updatedAt: new Date().toISOString()
      };
      updatedRecords.push(updatedSlip);
    });

    setSalaries(prev => {
      // Merge new records, replacing matching ones
      const filtered = prev.filter(s => s.month !== selectedMonth);
      return [...filtered, ...updatedRecords];
    });
  };

  // Handle Adjustment submission
  const handleSaveAdjustments = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingSlipId) return;

    const bonus = parseFloat(bonusAmount) || 0;
    const deduction = parseFloat(deductAmount) || 0;

    setAdjustments(prev => ({
      ...prev,
      [adjustingSlipId]: {
        bonus,
        bonusReason: bonusLabel || 'Performance Incentive',
        deduction,
        deductionReason: deductLabel || 'Advance Repayment'
      }
    }));

    // Reset form states
    setBonusAmount('');
    setBonusLabel('');
    setDeductAmount('');
    setDeductLabel('');
    setIsAdjustmentModalOpen(false);
    setAdjustingSlipId(null);
  };

  const handleClearAdjustments = (key: string) => {
    setAdjustments(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // PDF download function for individual employee monthly salary report
  const handleDownloadPDF = (slip: SalaryRecord) => {
    try {
      const emp = employees.find(e => e.id === slip.employeeId);
      const mLabel = months.find(m => m.value === selectedMonth)?.label;
      generateEmployeeSalaryPDF(slip, emp, mLabel);
      trackEvent('download_salary_pdf', {
        employeeId: slip.employeeId,
        employeeName: slip.employeeName,
        month: selectedMonth,
        netSalary: slip.netSalary
      });
      setDownloadToast(`Generated Monthly Salary PDF Report for ${slip.employeeName}`);
      setTimeout(() => setDownloadToast(null), 3500);
    } catch (err) {
      console.error('Error generating salary PDF report:', err);
      alert('Failed to generate salary PDF report. Please try again.');
    }
  };

  // PDF download function for executive monthly payroll ledger for all employees
  const handleDownloadMonthlyPDFReport = () => {
    try {
      generateAllEmployeesSalaryReportPDF(monthlySalaries, selectedMonth, employees);
      trackEvent('download_batch_salary_pdf', {
        month: selectedMonth,
        staffCount: monthlySalaries.length
      });
      const mLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;
      setDownloadToast(`Generated Monthly Payroll PDF Summary Report for ${mLabel}`);
      setTimeout(() => setDownloadToast(null), 3500);
    } catch (err) {
      console.error('Error generating batch salary PDF report:', err);
      alert('Failed to generate monthly payroll PDF report. Please try again.');
    }
  };

  // Excel download function for current month salaries
  const handleDownloadExcel = () => {
    exportPayrollToExcel(monthlySalaries, selectedMonth);
  };

  // Convert numbers to words (for elegant payslip payable summary)
  const numberToWordsINR = (num: number): string => {
    if (num === 0) return 'Zero Rupees Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const gWords = (n: number): string => {
      let str = '';
      if (n > 99) {
        str += a[Math.floor(n / 100)] + 'Hundred ';
        n %= 100;
      }
      if (n > 19) {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      } else if (n > 0) {
        str += a[n];
      }
      return str;
    };

    let rem = num;
    let words = '';

    // Crores
    if (Math.floor(rem / 10000000) > 0) {
      words += gWords(Math.floor(rem / 10000000)) + 'Crore ';
      rem %= 10000000;
    }
    // Lakhs
    if (Math.floor(rem / 100000) > 0) {
      words += gWords(Math.floor(rem / 100000)) + 'Lakh ';
      rem %= 100000;
    }
    // Thousands
    if (Math.floor(rem / 1000) > 0) {
      words += gWords(Math.floor(rem / 1000)) + 'Thousand ';
      rem %= 1000;
    }
    // Hundreds & Tens
    words += gWords(rem);

    return words.trim() + ' Rupees Only';
  };

  const escapeHtml = (str: string) => {
    return (str || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Function to download detailed salary slip as a beautifully styled self-contained HTML file
  const downloadSalarySlipAsHTML = (slip: SalaryRecord) => {
    const customBonus = (slip as any).customBonus || 0;
    const customBonusReason = (slip as any).customBonusReason || 'Performance Incentive';
    const customDeduction = (slip as any).customDeduction || 0;
    const customDeductionReason = (slip as any).customDeductionReason || 'Advance / Other Deductions';

    const safeName = escapeHtml(slip.employeeName);
    const safeMonth = escapeHtml(slip.month);
    const safeId = escapeHtml(slip.id);
    const safeEmpId = escapeHtml(slip.employeeId);
    const safeRole = escapeHtml(slip.employeeRole);
    const safeBonusReason = escapeHtml(customBonusReason);
    const safeDeductReason = escapeHtml(customDeductionReason);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip - ${safeName} - ${safeMonth}</title>
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      padding: 40px;
      background-color: #f8fafc;
      margin: 0;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 36px;
      max-width: 800px;
      margin: 0 auto;
      box-shadow: 0 4px 10px rgb(0 0 0 / 0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-b: 2px solid #e2e8f0;
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .company-name {
      font-size: 26px;
      font-weight: 900;
      color: #4f46e5;
      letter-spacing: -0.025em;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
      font-weight: 500;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 8px;
    }
    .grid-cols-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.05em;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 6px 0;
      font-size: 13px;
    }
    .meta-table td.label {
      color: #64748b;
      font-weight: 600;
      width: 45%;
    }
    .meta-table td.value {
      color: #0f172a;
      font-weight: 700;
    }
    .salary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
    }
    .salary-table th {
      background-color: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      padding: 12px;
      text-align: left;
      font-size: 11px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .salary-table td {
      padding: 14px 12px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
    }
    .text-right {
      text-align: right;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .text-emerald {
      color: #16a34a;
      font-weight: 700;
    }
    .text-rose {
      color: #dc2626;
    }
    .total-row {
      font-weight: 800;
      background-color: #f8fafc;
    }
    .total-row td {
      border-top: 2px solid #e2e8f0;
      border-bottom: 2px solid #e2e8f0;
      font-size: 14px;
    }
    .net-salary-banner {
      background: #e0e7ff;
      border: 1px solid #c7d2fe;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      margin-top: 32px;
    }
    .net-salary-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: 0.1em;
    }
    .net-salary-value {
      font-size: 28px;
      font-weight: 900;
      color: #3730a3;
      margin-top: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .net-salary-words {
      font-size: 12px;
      font-weight: 700;
      color: #4f46e5;
      margin-top: 4px;
      font-style: italic;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 44px;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-weight: 500;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .card {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="company-name">HRMS Management System</div>
        <div class="subtitle">Secure Corporate Payroll Portal</div>
        <div class="title">Official Salary Pay Slip</div>
      </div>
      <div class="text-right">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;">PAY PERIOD</div>
        <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 4px;">${safeMonth}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Doc Ref ID: ${safeId}</div>
      </div>
    </div>

    <div class="grid-cols-2">
      <div>
        <div class="section-title">Employee Information</div>
        <table class="meta-table">
          <tr><td class="label">Full Name:</td><td class="value">${safeName}</td></tr>
          <tr><td class="label">Employee ID:</td><td class="value font-mono">${safeEmpId}</td></tr>
          <tr><td class="label">Job Title:</td><td class="value">${safeRole}</td></tr>
        </table>
      </div>
      <div>
        <div class="section-title">Attendance Summary</div>
        <table class="meta-table">
          <tr><td class="label">Calendar Days:</td><td class="value">${slip.totalWorkingDays}</td></tr>
          <tr><td class="label">Present Days:</td><td class="value text-emerald">${slip.presentDays}</td></tr>
          <tr><td class="label">Absents / Leaves:</td><td class="value text-rose">${slip.absentDays} Abs / ${slip.approvedLeaves} Lvs</td></tr>
        </table>
      </div>
    </div>

    <div class="section-title">Salary Computation Details</div>
    <table class="salary-table">
      <thead>
        <tr>
          <th>Earnings & Deductions Descriptions</th>
          <th class="text-right">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Base Basic Salary (Contracted Rate)</td>
          <td class="text-right font-mono font-bold">${formatINR(slip.baseSalary)}</td>
        </tr>
        ${customBonus > 0 ? `
        <tr>
          <td class="text-emerald">Incentive / Compensation Bonus (${safeBonusReason})</td>
          <td class="text-right font-mono text-emerald font-bold">+${formatINR(customBonus)}</td>
        </tr>
        ` : ''}
        ${slip.absentDeduction > 0 ? `
        <tr>
          <td class="text-rose">Absenteeism Deductions (Unapproved absence of ${slip.absentDays} days)</td>
          <td class="text-right font-mono text-rose">-${formatINR(slip.absentDeduction)}</td>
        </tr>
        ` : ''}
        ${slip.leaveDeduction > 0 ? `
        <tr>
          <td class="text-rose">Approved Leave Deductions (Exceeded casual leave threshold)</td>
          <td class="text-right font-mono text-rose">-${formatINR(slip.leaveDeduction)}</td>
        </tr>
        ` : ''}
        ${slip.halfDayDeduction > 0 ? `
        <tr>
          <td class="text-rose">Half-Day / Late-In Deductions (Excessive late check-ins)</td>
          <td class="text-right font-mono text-rose">-${formatINR(slip.halfDayDeduction)}</td>
        </tr>
        ` : ''}
        ${customDeduction > 0 ? `
        <tr>
          <td class="text-rose">Custom Statutory Deductions ("${safeDeductReason}")</td>
          <td class="text-right font-mono text-rose">-${formatINR(customDeduction)}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td>Net Take-Home Payable Amount</td>
          <td class="text-right font-mono text-indigo-700">${formatINR(slip.netSalary)}</td>
        </tr>
      </tbody>
    </table>

    <div class="net-salary-banner">
      <div class="net-salary-label">Net Take-Home Payable Salary</div>
      <div class="net-salary-value">${formatINR(slip.netSalary)}</div>
      <div class="net-salary-words">${numberToWordsINR(slip.netSalary)}</div>
    </div>

    <div class="footer">
      <p>This is an official computer-generated salary documentation statement issued via the HRMS Secure Database Portal.</p>
      <p style="margin-top: 6px; font-weight: 700; color: #475569;">Verification Signature Cryptographic ID: ${safeId}</p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SalarySlip_${slip.employeeName.replace(/\s+/g, '_')}_${slip.month}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 relative">
      {/* Download Success Feedback Toast */}
      {downloadToast && (
        <div className="fixed top-20 right-6 z-50 max-w-sm bg-slate-900 text-white p-3.5 rounded-xl shadow-2xl border border-indigo-500 animate-slide-down flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-600 rounded-lg shrink-0">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 text-xs font-semibold leading-snug">{downloadToast}</div>
          <button onClick={() => setDownloadToast(null)} className="text-slate-400 hover:text-white text-xs p-1 cursor-pointer">✕</button>
        </div>
      )}

      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <IndianRupee className="w-6 h-6 mr-2 text-indigo-600 shrink-0" />
            Monthly Payroll & Salary Records
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Calculated employee salary slips with built-in attendance deduction rules and automatic PDF salary reports.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Selected Month:</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {['admin', 'hr', 'manager'].includes(activeUser.role) && (
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleDownloadMonthlyPDFReport}
                className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer space-x-1"
                title="Download Comprehensive Monthly Payroll & Salary PDF Summary for All Staff"
              >
                <FileText className="w-3.5 h-3.5 mr-1" />
                <span>Monthly PDF Summary</span>
              </button>
              <button 
                onClick={handleDownloadExcel}
                className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer space-x-1"
                title="Export Payroll Data to Excel"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>Export (Excel)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* POLICY INFOGRAPHICS CARD */}
      <div className="bg-indigo-900 text-indigo-100 rounded-xl p-5 shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-4 translate-x-4">
          <Sparkles className="w-48 h-48" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <span className="bg-indigo-700 text-indigo-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block">
              Exemption & Deduction Rules Enforced
            </span>
            <h3 className="text-lg font-black text-white tracking-tight">Standardized Paid-Leave Framework</h3>
            <p className="text-xs text-indigo-200 leading-relaxed">
              Our automated system evaluates salaries by computing the daily rate <code className="bg-indigo-950 px-1 py-0.5 rounded text-white text-[10px] font-mono">baseSalary / daysInMonth</code>. Each employee benefits from two exemption tiers:
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0 lg:max-w-md w-full">
            <div className="bg-indigo-800/60 rounded-lg p-3 border border-indigo-700">
              <div className="flex items-center space-x-2 text-white">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide">2 Casual Leaves (CL)</h4>
              </div>
              <p className="text-[10px] text-indigo-200 mt-1 leading-normal">
                Approved full leaves are credited as Paid Casual Leaves. No salary deductions are applied.
              </p>
            </div>
            <div className="bg-indigo-800/60 rounded-lg p-3 border border-indigo-700">
              <div className="flex items-center space-x-2 text-white">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide">2 Paid Half Days</h4>
              </div>
              <p className="text-[10px] text-indigo-200 mt-1 leading-normal">
                First 2 half-days (from late check-ins &approved requests) are paid. Excess deducts 0.5 daily wage.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN / HR / MANAGER: COMPREHENSIVE VIEW */}
      {['admin', 'hr', 'manager'].includes(activeUser.role) ? (
        <div className="space-y-6">
          {/* STATS STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Estimated Month Payout</p>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">{formatINR(totalPayout)}</h4>
                <p className="text-[9px] text-slate-400 font-medium">Sum of all employee net salaries</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Paid Salary Slips</p>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">{paidSlipsCount} / {monthlySalaries.length}</h4>
                <p className="text-[9px] text-emerald-600 font-bold font-sans">Slips finalized & marked Paid</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center space-x-4">
              <div className="bg-amber-50 text-amber-600 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Slips Pending Review</p>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">{pendingSlipsCount}</h4>
                <p className="text-[9px] text-amber-600 font-bold font-sans">Drafts requiring verification</p>
              </div>
            </div>
          </div>

          {/* BULK ACTIONS STRIP (Admin/HR Only) */}
          {['admin'].includes(activeUser.role) && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs font-sans">
              <div className="flex items-center space-x-2 text-slate-600">
                <Sliders className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-bold">Bulk Management Operations</span>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => handleBulkStatusChange('Approved')}
                  className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-[10px] font-extrabold uppercase tracking-wide transition-colors cursor-pointer"
                >
                  Approve All Drafts
                </button>
                <button 
                  onClick={() => handleBulkStatusChange('Paid')}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-extrabold uppercase tracking-wide transition-colors cursor-pointer shadow-sm"
                >
                  Finalize & Pay All
                </button>
              </div>
            </div>
          )}

          {/* MAIN PAYROLL TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Active Staff Payroll</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-extrabold border-b border-slate-200 select-none uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3 w-12 text-center">No.</th>
                    <th className="py-3 px-4">Employee & ID No.</th>
                    <th className="py-3 px-4">Base Salary</th>
                    <th className="py-3 px-4 text-center">Stats (P/A/H/L)</th>
                    <th className="py-3 px-4 text-center">Exemptions Used</th>
                    <th className="py-3 px-4 text-right">Deductions</th>
                    <th className="py-3 px-4 text-right font-black text-slate-700">Net Payable</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlySalaries.map((slip, slipIdx) => {
                    const empIdAndMonth = `${slip.employeeId}-${slip.month}`;
                    const adjustment = adjustments[empIdAndMonth];

                    return (
                      <tr key={slip.employeeId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                          {slipIdx + 1}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-slate-800">{slip.employeeName}</div>
                          <div className="text-[10px] text-slate-400 font-medium uppercase mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>ID: {slip.employeeId} • {(slip.employeeRole || '').toUpperCase()}</span>
                            {(() => {
                              const empRecord = employees.find(e => e.id === slip.employeeId);
                              const empStatus = empRecord?.status?.toLowerCase();
                              if (empStatus === 'internship completed') {
                                return (
                                  <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold lowercase">
                                    🎓 internship completed (attendance not required)
                                  </span>
                                );
                              }
                              if (empStatus === 'not working') {
                                return (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 font-bold lowercase">
                                    ⏸️ not working (attendance not required)
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono font-medium text-slate-600">
                          {formatINR(slip.baseSalary)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex space-x-1 font-bold">
                            <span className="text-emerald-600" title="Present Days">{slip.presentDays}P</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-rose-600" title="Absent Days">{slip.absentDays}A</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-amber-600" title="Half Days">{slip.halfDays}H</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-indigo-600" title="Approved Leaves">{slip.approvedLeaves}L</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center space-y-0.5 text-[10px]">
                            <span className="text-indigo-600 font-semibold">CL: {slip.clUsed}/2</span>
                            <span className="text-amber-600 font-semibold">Half: {slip.halfDaysFreeUsed}/2</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-rose-600 font-mono font-medium">
                          -{formatINR(slip.totalDeductions)}
                          {adjustment && (
                            <span className="block text-[8px] text-indigo-500 font-sans" title="Includes manual adjustments">
                              (Adjusted)
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right font-extrabold text-indigo-700 font-mono text-sm bg-indigo-50/20">
                          {formatINR(slip.netSalary)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center space-x-2">
                            {/* View detailed Slip */}
                            <button
                              onClick={() => setActiveSlip(slip)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                              title="View Pay Slip"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Download Monthly Salary PDF Report (Admin/Manager/HR) */}
                            {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                              <button
                                onClick={() => handleDownloadPDF(slip)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-extrabold uppercase transition-all duration-150 transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center space-x-1"
                                title="Download Official Monthly Salary PDF Report"
                              >
                                <Download className="w-3.5 h-3.5 mr-0.5 shrink-0 text-indigo-600" />
                                <span className="text-[9px] font-black">Salary PDF</span>
                              </button>
                            )}

                            {/* Download HTML Payslip */}
                            {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                              <button
                                onClick={() => downloadSalarySlipAsHTML(slip)}
                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                                title="Download Raw HTML Payslip"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Adjustment Actions (Admin/HR) */}
                            {['admin'].includes(activeUser.role) && (
                              <button
                                onClick={() => {
                                  setAdjustingSlipId(empIdAndMonth);
                                  if (adjustment) {
                                    setBonusAmount(String(adjustment.bonus));
                                    setBonusLabel(adjustment.bonusReason);
                                    setDeductAmount(String(adjustment.deduction));
                                    setDeductLabel(adjustment.deductionReason);
                                  }
                                  setIsAdjustmentModalOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                                title="Add Adjustments / Bonus"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Process Slip Status Button */}
                            {['admin'].includes(activeUser.role) && slip.status === 'Draft' && (
                              <button
                                onClick={() => updateSlipStatus(slip.employeeId, 'Approved')}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                            )}

                            {['admin'].includes(activeUser.role) && slip.status === 'Approved' && (
                              <button
                                onClick={() => updateSlipStatus(slip.employeeId, 'Paid')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-extrabold uppercase transition-colors cursor-pointer"
                              >
                                Mark Paid
                              </button>
                            )}

                            {adjustment && ['admin'].includes(activeUser.role) && (
                              <button
                                onClick={() => handleClearAdjustments(empIdAndMonth)}
                                className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                                title="Clear Custom Adjustments"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* INDIVIDUAL EMPLOYEE SALARY SLIP VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* STATS SECTION */}
          <div className="lg:col-span-1 space-y-6">
            {/* LARGE SALARY BANNER CARD */}
            {(() => {
              const mySlip = getSalaryForEmployee(activeUser, selectedMonth);
              return (
                <div className="bg-gradient-to-br from-indigo-700 to-slate-900 text-white rounded-xl p-6 shadow-md relative overflow-hidden space-y-4">
                  <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform -translate-y-4 translate-x-4">
                    <IndianRupee className="w-36 h-36" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold tracking-widest bg-white/20 px-2 py-0.5 rounded uppercase">
                      My Net Salary Slip
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                      mySlip.status === 'Paid' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/30' : 'bg-slate-500/30 text-slate-300'
                    }`}>
                      {mySlip.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] text-indigo-200 uppercase tracking-wider font-bold">Estimated Net Payable</p>
                    <h2 className="text-3xl font-black tracking-tight">{formatINR(mySlip.netSalary)}</h2>
                    {mySlip.paymentDate && (
                      <p className="text-[9px] text-emerald-300 font-medium font-sans mt-1">
                        Credited on {mySlip.paymentDate}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-indigo-600/50 pt-4 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-tight font-bold">Base Pay</p>
                      <p className="font-bold font-mono text-slate-200">{formatINR(mySlip.baseSalary)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-indigo-300 uppercase tracking-tight font-bold">Deductions</p>
                      <p className="font-bold font-mono text-rose-300">-{formatINR(mySlip.totalDeductions)}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() => setActiveSlip(mySlip)}
                      className="flex-1 py-2.5 bg-white text-indigo-900 hover:bg-slate-100 active:bg-slate-200 transition-all rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center shadow-sm cursor-pointer border border-slate-200"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Slip
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(mySlip)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center shadow-sm cursor-pointer space-x-1.5"
                      title="Download Official Monthly Salary PDF Report"
                    >
                      <Download className="w-4 h-4 mr-1 shrink-0" />
                      <span>Salary PDF</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* EXEMPTIONS TRACKER */}
            {(() => {
              const mySlip = getSalaryForEmployee(activeUser, selectedMonth);
              return (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Leaves & Exemptions Remaining</h3>
                  
                  <div className="space-y-4">
                    {/* CL BAR */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-600">Casual Leave (CL) Balance</span>
                        <span className="font-mono font-bold text-indigo-600">{mySlip.clRemaining} / 2 left</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${(mySlip.clRemaining / 2) * 100}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400">Used {mySlip.clUsed} approved leave days which were fully compensated</p>
                    </div>

                    {/* HALF DAY BAR */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-600">Paid Half Day Balance</span>
                        <span className="font-mono font-bold text-amber-600">{mySlip.halfDaysFreeRemaining} / 2 left</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${(mySlip.halfDaysFreeRemaining / 2) * 100}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-400">Used {mySlip.halfDaysFreeUsed} half-days without salary deduction</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ATTENDANCE RECAP & DEDUCTION CARD */}
          {(() => {
            const mySlip = getSalaryForEmployee(activeUser, selectedMonth);
            return (
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-wider">Salary Deduction Analysis</h3>
                  
                  <div className="divide-y divide-slate-100">
                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Days Logged Present</p>
                        <p className="text-[10px] text-slate-400 font-medium">On Time / Late punch-ins during the month</p>
                      </div>
                      <div className="text-right font-mono font-bold text-emerald-600 text-sm">
                        {mySlip.presentDays} days
                      </div>
                    </div>

                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Unresolved Absence Days</p>
                        <p className="text-[10px] text-slate-400 font-medium">Marked absent. Deducts 1 day's daily wage each.</p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-700 text-sm">{mySlip.absentDays} days</div>
                        <div className="text-[10px] text-rose-600 font-bold font-mono">-{formatINR(mySlip.absentDeduction)}</div>
                      </div>
                    </div>

                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Leaves Taken</p>
                        <p className="text-[10px] text-slate-400 font-medium">Approved leaves. First 2 CL are free.</p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-700 text-sm">{mySlip.approvedLeaves} days</div>
                        <div className="text-[10px] text-rose-600 font-bold font-mono">-{formatINR(mySlip.leaveDeduction)}</div>
                      </div>
                    </div>

                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-700">Half-Day Check-Ins</p>
                        <p className="text-[10px] text-slate-400 font-medium">Check-ins exceeding 90m delay. First 2 are free, then deducts 0.5 daily wage.</p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-700 text-sm">{mySlip.halfDays} times</div>
                        <div className="text-[10px] text-rose-600 font-bold font-mono">-{formatINR(mySlip.halfDayDeduction)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex justify-between items-center font-mono font-extrabold text-xs text-slate-700">
                    <span>Total Deductions Calculated</span>
                    <span className="text-rose-600">-{formatINR(mySlip.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* --- MANUAL ADJUSTMENT MODAL (ADMIN/HR ONLY) --- */}
      {isAdjustmentModalOpen && adjustingSlipId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full shadow-2xl p-6 space-y-4 animate-fade-in">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center">
                  <Sliders className="w-5 h-5 mr-2 text-indigo-600 shrink-0" />
                  Custom Salary Adjustments
                </h3>
                <p className="text-[10px] text-slate-400">
                  Add custom bonuses or deductions for <span className="font-mono font-bold text-slate-600">{adjustingSlipId.split('-')[0]}</span> for the month of <span className="font-mono font-bold text-slate-600">{adjustingSlipId.substring(adjustingSlipId.indexOf('-') + 1)}</span>.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsAdjustmentModalOpen(false);
                  setAdjustingSlipId(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustments} className="space-y-4 text-xs font-sans">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-800 space-y-1">
                <p className="font-bold">Important Notice</p>
                <p>Manual adjustments are compiled instantly. Bonus increments are added to Net Pay; custom deductions are subtracted directly.</p>
              </div>

              {/* Bonus Fields */}
              <div className="space-y-3 p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                <span className="font-extrabold uppercase text-[9px] tracking-wide text-indigo-600">Earnings Adjustment (Bonus)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bonus Amount (INR)</label>
                    <input 
                      type="number"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason Description</label>
                    <input 
                      type="text"
                      value={bonusLabel}
                      onChange={(e) => setBonusLabel(e.target.value)}
                      placeholder="e.g. Perf Bonus"
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Deduction Fields */}
              <div className="space-y-3 p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                <span className="font-extrabold uppercase text-[9px] tracking-wide text-rose-600">Deduction Adjustment</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Deduct Amount (INR)</label>
                    <input 
                      type="number"
                      value={deductAmount}
                      onChange={(e) => setDeductAmount(e.target.value)}
                      placeholder="e.g. 2000"
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason Description</label>
                    <input 
                      type="text"
                      value={deductLabel}
                      onChange={(e) => setDeductLabel(e.target.value)}
                      placeholder="e.g. Tax / Advance"
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustmentModalOpen(false);
                    setAdjustingSlipId(null);
                  }}
                  className="flex-1 py-2 text-center border border-slate-200 hover:bg-slate-50 text-slate-700 rounded font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-center bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer transition-colors"
                >
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FORMAL PAYSLIP MODAL (PRINT-FRIENDLY) --- */}
      {activeSlip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full shadow-2xl overflow-hidden animate-fade-in relative">
            
            {/* Top Toolbar (Non-printable) */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center print:hidden">
              <button 
                onClick={() => setActiveSlip(null)}
                className="inline-flex items-center px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-black uppercase rounded-lg border border-slate-200 shadow-xs cursor-pointer transition-all duration-150 transform hover:-translate-x-0.5"
                title="Go back to the previous list"
                id="back-button-top"
              >
                <ArrowLeft className="w-4 h-4 mr-2 text-indigo-600" />
                Back
              </button>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => handleDownloadPDF(activeSlip)}
                  className="inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded shadow-xs cursor-pointer transition-colors space-x-1"
                  title="Download Official Monthly Salary PDF Report"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>Download PDF</span>
                </button>
                <button 
                  onClick={() => downloadSalarySlipAsHTML(activeSlip)}
                  className="inline-flex items-center px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
                  title="Download HTML Payslip"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  <span>HTML</span>
                </button>
                <button 
                  onClick={handlePrintSlip}
                  className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded shadow-xs cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print
                </button>
                <button 
                  onClick={() => setActiveSlip(null)}
                  className="inline-flex items-center px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>

            {/* FORMAL PAYSLIP (PRINT TARGET AREA) */}
            <div className="p-8 space-y-6 font-sans text-slate-800 print:p-0 print:border-none" id="formal-payslip-print">
              
              {/* Slip Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h1 className="text-xl font-black text-indigo-700 tracking-tight">HRMS SYSTEM</h1>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Enterprise Workforce &amp; Payroll Management Portal</p>
                  <p className="text-[9px] text-slate-400">Email: payroll@hrms.demo • Confidential Salary Documentation</p>
                </div>
                <div className="text-right">
                  <span className="text-xs bg-indigo-50 text-indigo-800 font-black px-3 py-1 rounded border border-indigo-200 inline-block">
                    PAYSLIP RECEIPT
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">Month: {activeSlip.month}</p>
                </div>
              </div>

              {/* Employee & Pay Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Employee Name</p>
                  <p className="font-extrabold text-slate-800 mt-0.5">{activeSlip.employeeName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Employee Designation</p>
                  <p className="font-bold text-slate-600 mt-0.5 uppercase">{activeSlip.employeeRole}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Employee ID Reference</p>
                  <p className="font-bold font-mono text-slate-600 mt-0.5">{activeSlip.employeeId}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">Total Working Days</p>
                  <p className="font-bold text-slate-600 mt-0.5">{activeSlip.totalWorkingDays} Calendar Days</p>
                </div>
              </div>

              {/* Attendance Summary */}
              <div className="space-y-2">
                <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-wider">Attendance registry & Leave Breakdown</h3>
                <div className="grid grid-cols-4 gap-4 text-center border border-slate-100 rounded bg-white text-[10px] py-2">
                  <div>
                    <span className="block text-emerald-600 font-black">{activeSlip.presentDays}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-tight font-bold">Days Present</span>
                  </div>
                  <div>
                    <span className="block text-rose-600 font-black">{activeSlip.absentDays}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-tight font-bold">Absences</span>
                  </div>
                  <div>
                    <span className="block text-amber-600 font-black">{activeSlip.halfDays}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-tight font-bold">Half Days</span>
                  </div>
                  <div>
                    <span className="block text-indigo-600 font-black">{activeSlip.approvedLeaves}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-tight font-bold">Leaves Approved</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[8px] text-slate-400 px-1 italic">
                  <span>* CL Balance applied: Used {activeSlip.clUsed} Casual Leaves, remaining balance is {activeSlip.clRemaining}</span>
                  <span>* Paid Half Day Allowance: {activeSlip.halfDaysFreeUsed} credit used, remaining balance is {activeSlip.halfDaysFreeRemaining}</span>
                </div>
              </div>

              {/* Earnings vs Deductions Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 bg-slate-50 text-[10px] font-extrabold uppercase border-b border-slate-200 tracking-wider">
                  <div className="p-2 border-r border-slate-200">Earnings (Incentives)</div>
                  <div className="p-2">Deductions (Adjustments)</div>
                </div>

                <div className="grid grid-cols-2 text-[10px] min-h-[140px] divide-x divide-slate-200">
                  {/* Earnings Left Side */}
                  <div className="p-3 space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Basic Salary (Monthly)</span>
                      <span className="font-mono font-bold text-slate-700">{formatINR(activeSlip.baseSalary)}</span>
                    </div>
                    {/* Custom Bonus if applicable */}
                    {(activeSlip as any).customBonus > 0 && (
                      <div className="flex justify-between animate-fade-in text-indigo-600">
                        <span className="font-bold flex items-center">
                          <Sparkles className="w-3 h-3 mr-1" />
                          {(activeSlip as any).customBonusReason || 'Performance Incentive'}
                        </span>
                        <span className="font-mono font-black">+{formatINR((activeSlip as any).customBonus)}</span>
                      </div>
                    )}
                  </div>

                  {/* Deductions Right Side */}
                  <div className="p-3 space-y-2.5 bg-slate-50/20">
                    {activeSlip.absentDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unresolved Absence Deductions ({activeSlip.absentDays}d)</span>
                        <span className="font-mono text-rose-600">-{formatINR(activeSlip.absentDeduction)}</span>
                      </div>
                    )}
                    {activeSlip.leaveDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unpaid Leaves Deductions</span>
                        <span className="font-mono text-rose-600">-{formatINR(activeSlip.leaveDeduction)}</span>
                      </div>
                    )}
                    {activeSlip.halfDayDeduction > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unpaid Half Day Deductions</span>
                        <span className="font-mono text-rose-600">-{formatINR(activeSlip.halfDayDeduction)}</span>
                      </div>
                    )}
                    {/* Custom Deduction if applicable */}
                    {(activeSlip as any).customDeduction > 0 && (
                      <div className="flex justify-between animate-fade-in text-rose-600">
                        <span className="font-bold">
                          {(activeSlip as any).customDeductionReason || 'Advance / Taxes Adjustment'}
                        </span>
                        <span className="font-mono font-black">-{formatINR((activeSlip as any).customDeduction)}</span>
                      </div>
                    )}
                    {activeSlip.totalDeductions === 0 && (activeSlip as any).customDeduction === undefined && (
                      <div className="text-slate-400 text-center py-6 italic select-none">
                        ✓ No deductions applicable this month!
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-totals Row */}
                <div className="grid grid-cols-2 bg-slate-50/50 border-t border-slate-200 text-[10px] font-bold">
                  <div className="p-2 flex justify-between border-r border-slate-200">
                    <span>Gross Earnings</span>
                    <span className="font-mono font-extrabold text-slate-700">
                      {formatINR(activeSlip.baseSalary + ((activeSlip as any).customBonus || 0))}
                    </span>
                  </div>
                  <div className="p-2 flex justify-between text-rose-600">
                    <span>Total Deductions</span>
                    <span className="font-mono font-extrabold">
                      -{formatINR(activeSlip.totalDeductions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Summary Row */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
                <div>
                  <p className="text-[9px] text-indigo-400 uppercase font-black tracking-wide">Net Salary Payable (In Words)</p>
                  <p className="font-bold text-indigo-800 capitalize italic mt-0.5">
                    {numberToWordsINR(activeSlip.netSalary)}
                  </p>
                </div>
                <div className="text-right shrink-0 md:border-l md:border-indigo-200 md:pl-6">
                  <p className="text-[9px] text-indigo-400 uppercase font-black tracking-wide">Net Payable Amount</p>
                  <p className="text-lg font-black text-indigo-700 font-mono mt-0.5">{formatINR(activeSlip.netSalary)}</p>
                </div>
              </div>

              {/* Bottom Watermarks / Verification Info */}
              <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] text-slate-400 font-medium">
                <div>
                  <p>Computer generated payment slip verification receipt.</p>
                  <p className="font-mono mt-0.5">System Reference SHA-HASH: {activeSlip.id}</p>
                </div>
                <div className="text-center md:text-right">
                  <div className="h-8 border-b border-slate-300 w-32 mx-auto md:ml-auto" />
                  <p className="mt-1 font-bold">Authorized Payroll Officer</p>
                  <p>HRMS System</p>
                </div>
              </div>

            </div>

            {/* Bottom Actions Bar (Non-printable) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center items-center print:hidden">
              <button 
                onClick={() => setActiveSlip(null)}
                className="inline-flex items-center px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer transition-all duration-150 transform hover:-translate-y-0.5 shadow-md"
                id="back-button-bottom"
              >
                <ArrowLeft className="w-4 h-4 mr-2 text-indigo-300 animate-pulse" />
                Back to Payroll Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
