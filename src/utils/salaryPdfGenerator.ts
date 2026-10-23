import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SalaryRecord, Employee } from '../types';

/**
 * Converts a numeric amount to INR Words representation (e.g. 10000 -> Ten Thousand Rupees Only)
 */
export function numberToWordsINR(num: number): string {
  if (!num || num === 0) return 'Zero Rupees Only';
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
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

  let rem = Math.floor(Math.abs(num));
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
}

/**
 * Formats a currency number into standard Indian Rupee notation (e.g. INR 10,000)
 */
export function formatCurrencyINR(amount: number): string {
  return 'INR ' + Math.round(amount).toLocaleString('en-IN');
}

/**
 * Generates an official, publication-quality Monthly Salary PDF Report for an individual employee
 */
export function generateEmployeeSalaryPDF(
  slip: SalaryRecord,
  employee?: Employee,
  monthLabel?: string
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  // Custom adjustments if any
  const customBonus = (slip as any).customBonus || 0;
  const customBonusReason = (slip as any).customBonusReason || 'Performance Incentive';
  const customDeduction = (slip as any).customDeduction || 0;
  const customDeductionReason = (slip as any).customDeductionReason || 'Advance Repayment';

  // Format month name (e.g. "2026-07" -> "July 2026")
  let displayMonth = monthLabel || slip.month;
  try {
    const [y, m] = slip.month.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    displayMonth = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    // fallback
  }

  // --- HEADER SECTION (Deep Indigo Gradient Banner Effect) ---
  doc.setFillColor(30, 27, 75); // Indigo 950
  doc.roundedRect(margin, margin, contentWidth, 80, 8, 8, 'F');

  // Accent band
  doc.setFillColor(79, 70, 229); // Indigo 600
  doc.rect(margin, margin + 76, contentWidth, 4, 'F');

  // Company Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('HRMS SYSTEM', margin + 18, margin + 28);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254); // Indigo 200
  doc.text('Corporate Human Resources & Payroll Management System', margin + 18, margin + 44);
  doc.text('Enterprise Workforce & Operations Administration', margin + 18, margin + 58);

  // Right-aligned Document Badge
  doc.setFillColor(67, 56, 202); // Indigo 700
  doc.roundedRect(pageWidth - margin - 170, margin + 14, 155, 52, 6, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('MONTHLY SALARY REPORT', pageWidth - margin - 92, margin + 32, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(224, 231, 255);
  doc.text(`Period: ${displayMonth}`, pageWidth - margin - 92, margin + 46, { align: 'center' });
  doc.text(`Status: ${(slip.status || 'Draft').toUpperCase()}`, pageWidth - margin - 92, margin + 58, { align: 'center' });

  // --- EMPLOYEE INFORMATION CARD ---
  let currentY = margin + 96;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: [30, 41, 59]
    },
    body: [
      [
        { content: 'Employee Name:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: slip.employeeName, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
        { content: 'Report Ref ID:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: slip.id, styles: { fontStyle: 'bold', textColor: [79, 70, 229] } }
      ],
      [
        { content: 'Employee ID:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: slip.employeeId, styles: { fontStyle: 'bold' } },
        { content: 'Department:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: employee?.department || 'Information Technology' }
      ],
      [
        { content: 'Designation / Role:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: employee?.jobTitle || slip.employeeRole.toUpperCase() },
        { content: 'Disbursement Date:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: slip.paymentDate || new Date().toISOString().split('T')[0] }
      ],
      [
        { content: 'Email Address:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: employee?.email || 'N/A' },
        { content: 'Days in Month:', styles: { fontStyle: 'bold', textColor: [100, 116, 139] } },
        { content: `${slip.totalWorkingDays} Calendar Days` }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // --- ATTENDANCE & WORKING METRICS SUMMARY ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('ATTENDANCE & LEAVE RECONCILIATION', margin, currentY);

  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
      halign: 'center'
    },
    head: [['Total Days', 'Days Present', 'Absent Days', 'Half Days', 'Approved Leaves', 'CL Used / Left', 'Half-Day Free Used']],
    body: [
      [
        String(slip.totalWorkingDays),
        String(slip.presentDays),
        String(slip.absentDays),
        String(slip.halfDays),
        String(slip.approvedLeaves),
        `${slip.clUsed} / ${slip.clRemaining} left`,
        `${slip.halfDaysFreeUsed} / ${slip.halfDaysFreeRemaining} left`
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 16;

  // --- EARNINGS & DEDUCTIONS BREAKDOWN TABLE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('MONTHLY SALARY BREAKDOWN (INR)', margin, currentY);

  currentY += 6;

  const earningsData: any[] = [
    ['Basic Monthly Salary', formatCurrencyINR(slip.baseSalary)]
  ];
  if (customBonus > 0) {
    earningsData.push([customBonusReason || 'Performance Bonus', formatCurrencyINR(customBonus)]);
  }
  const grossEarnings = slip.baseSalary + customBonus;

  const deductionsData: any[] = [];
  if (slip.absentDeduction > 0) {
    deductionsData.push([`Absence Deduction (${slip.absentDays} day${slip.absentDays > 1 ? 's' : ''})`, `-${formatCurrencyINR(slip.absentDeduction)}`]);
  }
  if (slip.leaveDeduction > 0) {
    deductionsData.push(['Unpaid Leaves (Beyond CL)', `-${formatCurrencyINR(slip.leaveDeduction)}`]);
  }
  if (slip.halfDayDeduction > 0) {
    deductionsData.push(['Unpaid Half Days (Beyond Free)', `-${formatCurrencyINR(slip.halfDayDeduction)}`]);
  }
  if (customDeduction > 0) {
    deductionsData.push([customDeductionReason || 'Advance Repayment', `-${formatCurrencyINR(customDeduction)}`]);
  }
  if (deductionsData.length === 0) {
    deductionsData.push(['No salary deductions applied', 'INR 0']);
  }

  // Combine Earnings and Deductions side-by-side or stacked
  const maxRows = Math.max(earningsData.length, deductionsData.length);
  const tableRows: any[] = [];
  for (let i = 0; i < maxRows; i++) {
    const earn = earningsData[i] || ['', ''];
    const ded = deductionsData[i] || ['', ''];
    tableRows.push([earn[0], earn[1], ded[0], ded[1]]);
  }

  // Add totals row
  tableRows.push([
    { content: 'Total Gross Earnings', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
    { content: formatCurrencyINR(grossEarnings), styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [16, 185, 129] } },
    { content: 'Total Deductions', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
    { content: `-${formatCurrencyINR(slip.totalDeductions)}`, styles: { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [225, 29, 72] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    head: [['Earnings Head', 'Amount', 'Deduction Head', 'Amount']],
    body: tableRows,
    styles: {
      fontSize: 8.5,
      cellPadding: 5.5
    },
    columnStyles: {
      0: { cellWidth: 160 },
      1: { cellWidth: 100, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 160 },
      3: { cellWidth: 103, halign: 'right', fontStyle: 'bold' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 16;

  // --- NET SALARY HIGHLIGHT BOX ---
  doc.setFillColor(245, 243, 255); // Indigo 50
  doc.setDrawColor(199, 210, 254); // Indigo 200
  doc.roundedRect(margin, currentY, contentWidth, 54, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text('CALCULATED NET SALARY PAYABLE:', margin + 14, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const wordsText = numberToWordsINR(slip.netSalary);
  doc.text(wordsText, margin + 14, currentY + 36, { maxWidth: contentWidth - 180 });

  // Right-aligned Big Net Salary Amount
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(67, 56, 202); // Indigo 700
  doc.text(formatCurrencyINR(slip.netSalary), pageWidth - margin - 14, currentY + 34, { align: 'right' });

  currentY += 72;

  // --- NOTES & VERIFICATION INFO ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('• Daily Pro-rata Rate: ' + formatCurrencyINR(slip.dailyRate) + ' / day', margin, currentY);
  doc.text('• Statutory Leaves: Each employee receives 2 Paid Casual Leaves (CL) and 2 Paid Half Days each month.', margin, currentY + 12);
  doc.text('• Sundays and Corporate Gazetted Holidays are recognized as standard paid non-working days.', margin, currentY + 24);

  // --- SIGNATURES & VERIFICATION BLOCK ---
  const signY = pageHeight - margin - 50;

  // Left side signature
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, signY, margin + 140, signY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Employee Signature', margin, signY + 12);

  // Right side signature
  doc.line(pageWidth - margin - 160, signY, pageWidth - margin, signY);
  doc.text('Authorized HR / Finance Officer', pageWidth - margin - 160, signY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('HRMS System', pageWidth - margin - 160, signY + 22);

  // Security Hash footer
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Verified Document • SHA-REF: ${slip.id} • Generated: ${new Date().toLocaleString('en-IN')}`, margin, pageHeight - 16);

  // Save the PDF
  const safeFilename = `Salary_Report_${slip.employeeName.replace(/[^a-zA-Z0-9]/g, '_')}_${slip.month}.pdf`;
  doc.save(safeFilename);
}

/**
 * Generates an executive Monthly Payroll & Salary Summary PDF Report for all employees
 */
export function generateAllEmployeesSalaryReportPDF(
  slips: SalaryRecord[],
  monthStr: string,
  employees: Employee[]
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  let displayMonth = monthStr;
  try {
    const [y, m] = monthStr.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    displayMonth = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  } catch {}

  const totalPayout = slips.reduce((sum, s) => sum + s.netSalary, 0);
  const totalBase = slips.reduce((sum, s) => sum + s.baseSalary, 0);
  const totalDeductions = slips.reduce((sum, s) => sum + s.totalDeductions, 0);
  const paidCount = slips.filter(s => s.status === 'Paid').length;

  // Header Banner
  doc.setFillColor(30, 27, 75); // Indigo 950
  doc.roundedRect(margin, margin, contentWidth, 60, 6, 6, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('HRMS SYSTEM', margin + 16, margin + 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254);
  doc.text(`MONTHLY PAYROLL & SALARY SUMMARY REPORT — ${displayMonth.toUpperCase()}`, margin + 16, margin + 44);

  // Top Stats Badges (Right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`Total Payout: ${formatCurrencyINR(totalPayout)}`, pageWidth - margin - 20, margin + 26, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setTextColor(199, 210, 254);
  doc.text(`Staff Count: ${slips.length} • Disbursed/Paid: ${paidCount}`, pageWidth - margin - 20, margin + 44, { align: 'right' });

  // Table of all employees
  const tableData = slips.map((slip, index) => {
    const emp = employees.find(e => e.id === slip.employeeId);
    return [
      String(index + 1),
      slip.employeeId,
      slip.employeeName,
      emp?.department || 'IT',
      emp?.jobTitle || slip.employeeRole,
      formatCurrencyINR(slip.baseSalary),
      `${slip.presentDays} / ${slip.totalWorkingDays}`,
      String(slip.absentDays),
      String(slip.halfDays),
      String(slip.approvedLeaves),
      formatCurrencyINR(slip.totalDeductions),
      formatCurrencyINR(slip.netSalary),
      (slip.status || 'Draft').toUpperCase()
    ];
  });

  // Summary Row
  tableData.push([
    '',
    '',
    'TOTAL SUMMARY',
    '',
    '',
    formatCurrencyINR(totalBase),
    '',
    '',
    '',
    '',
    formatCurrencyINR(totalDeductions),
    formatCurrencyINR(totalPayout),
    ''
  ]);

  autoTable(doc, {
    startY: margin + 74,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 100, fontStyle: 'bold' },
      3: { cellWidth: 75 },
      4: { cellWidth: 80 },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 55, halign: 'center' },
      7: { cellWidth: 42, halign: 'center' },
      8: { cellWidth: 42, halign: 'center' },
      9: { cellWidth: 50, halign: 'center' },
      10: { cellWidth: 65, halign: 'right', textColor: [225, 29, 72] },
      11: { cellWidth: 70, halign: 'right', fontStyle: 'bold', textColor: [67, 56, 202] },
      12: { cellWidth: 50, halign: 'center', fontStyle: 'bold' }
    },
    head: [[
      '#',
      'Emp ID',
      'Employee Name',
      'Department',
      'Designation',
      'Base Pay',
      'Present',
      'Absent',
      'Half-Day',
      'Leaves',
      'Deductions',
      'Net Salary',
      'Status'
    ]],
    body: tableData,
    didParseCell: (data) => {
      // Highlight summary row
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 20;

  // Authorization Signatures
  if (finalY + 40 < pageHeight) {
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, finalY + 25, margin + 140, finalY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Prepared By (HR Specialist)', margin, finalY + 35);

    doc.line(pageWidth - margin - 150, finalY + 25, pageWidth - margin, finalY + 25);
    doc.text('Authorized Signatory (Finance / Admin)', pageWidth - margin - 150, finalY + 35);
  }

  // Footer Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Executive Monthly Payroll Statement • HRMS System • Generated on ${new Date().toLocaleString('en-IN')}`, margin, pageHeight - 14);

  const safeFilename = `Monthly_Payroll_Salary_Report_${monthStr}.pdf`;
  doc.save(safeFilename);
}
