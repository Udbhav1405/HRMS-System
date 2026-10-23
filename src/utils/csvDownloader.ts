import { AttendanceLog } from '../types';

function formatCSVDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${day}-${months[mIdx]}-${year}`;
    }
  }
  return dateStr;
}

export function downloadAttendanceCSV(logs: AttendanceLog[], title: string = 'Attendance_Report') {
  const headers = ['ID', 'Date', 'Employee Name', 'Role', 'Check-In', 'Check-Out', 'Duration', 'Status'];
  
  const csvRows = [
    headers.join(','),
    ...logs.map(log => {
      return [
        `"${log.id}"`,
        `" ${formatCSVDate(log.date)}"`,
        `"${log.userName.replace(/"/g, '""')}"`,
        `"${log.userRole}"`,
        `" ${log.checkIn || '---'}"`,
        `" ${log.checkOut || 'Active Session'}"`,
        `"${log.duration || 'In-Progress'}"`,
        `"${log.status || 'On Time'}"`
      ].join(',');
    })
  ];
  
  const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${title}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
