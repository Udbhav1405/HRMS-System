import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Database,
  RefreshCw,
  Save,
  Trash2,
  Code,
  CheckCircle,
  AlertCircle,
  Download,
  Upload,
  Plus,
  Search,
  Table,
  X,
  ArrowUpDown,
  Play,
  HardDrive,
  FileCode,
  Layers,
  Terminal
} from 'lucide-react';
import {
  fetchAllFromSQLite,
  saveToSQLite,
  resetSQLiteDB,
  executeSql,
  getDatabaseStats,
  isExcludedStaff
} from '../utils/sqlClient.ts';
import * as XLSX from 'xlsx';

interface SQLiteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

const TABLE_SCHEMAS: Record<string, string[]> = {
  employees: ['id', 'name', 'email', 'role', 'department', 'jobTitle', 'phone', 'address', 'emergencyContact', 'salary', 'joinDate', 'status', 'password'],
  attendance: ['id', 'userId', 'userName', 'userRole', 'date', 'checkIn', 'checkOut', 'duration', 'status'],
  tasks: ['id', 'title', 'description', 'employeeId', 'employeeName', 'assignedBy', 'priority', 'dueDate', 'status', 'completedAt'],
  proposals: ['id', 'title', 'description', 'proposedEmployeeId', 'managerId', 'managerName', 'priority', 'dueDate', 'status', 'createdAt', 'proposedByHR'],
  leave_requests: ['id', 'employeeId', 'employeeName', 'type', 'startDate', 'endDate', 'reason', 'status', 'referredDate', 'managerDecisionDate', 'finalDecisionDate'],
  departments: ['id', 'name', 'managerName', 'description'],
  holidays: ['id', 'name', 'startDate', 'endDate', 'date'],
  salaries: ['id', 'employeeId', 'employeeName', 'employeeRole', 'month', 'baseSalary', 'dailyRate', 'totalWorkingDays', 'presentDays', 'absentDays', 'halfDays', 'approvedLeaves', 'netSalary', 'status', 'paymentDate'],
  notifications: ['id', 'userId', 'title', 'message', 'type', 'createdAt', 'read', 'taskId', 'assignedBy'],
  system_settings: ['key', 'value']
};

export const SQLiteEditorModal: React.FC<SQLiteEditorModalProps> = ({
  isOpen,
  onClose,
  onRefreshData
}) => {
  const [dbData, setDbData] = useState<Record<string, any>>({});
  const dbDataRef = useRef<Record<string, any>>({});
  const [selectedTable, setSelectedTable] = useState<string>('employees');
  const [viewMode, setViewMode] = useState<'grid' | 'sql' | 'json'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tableStats, setTableStats] = useState<Record<string, number>>({});

  // SQL Query Console state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM employees LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: any[]; success: boolean; error?: string } | null>(null);
  const [isQueryRunning, setIsQueryRunning] = useState<boolean>(false);

  // Cell editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDatabase();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
      cellInputRef.current.select();
    }
  }, [editingCell]);

  const loadDatabase = async (clearStatus = true) => {
    setLoading(true);
    if (clearStatus) setStatusMsg(null);
    try {
      const data = await fetchAllFromSQLite();
      dbDataRef.current = data;
      setDbData(data);
      const stats = await getDatabaseStats();
      setTableStats(stats);
      setStatusMsg({ type: 'success', text: 'Connected to local SQLite database (hrms.db).' });
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'Failed to load SQLite database: ' + (e.message || String(e)) });
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (tableKey: string) => {
    setSelectedTable(tableKey);
    setEditingCell(null);
    setSortConfig(null);
    setStatusMsg(null);
  };

  // Active rows & columns
  const activeRows = useMemo(() => {
    const data = dbData[selectedTable];
    return Array.isArray(data) ? data : [];
  }, [dbData, selectedTable]);

  const columns = useMemo(() => {
    const colSet = new Set<string>(TABLE_SCHEMAS[selectedTable] || []);
    activeRows.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => colSet.add(k));
      }
    });
    return Array.from(colSet);
  }, [selectedTable, activeRows]);

  const filteredAndSortedRows = useMemo(() => {
    let result = (activeRows || []).filter(r => !isExcludedStaff(r));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => {
        if (!row) return false;
        return Object.values(row).some(val =>
          String(val ?? '').toLowerCase().includes(q)
        );
      });
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key] ?? '';
        const valB = b[sortConfig.key] ?? '';
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [activeRows, searchQuery, sortConfig]);

  const handleSort = (colKey: string) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== colKey) {
        return { key: colKey, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key: colKey, direction: 'desc' };
      }
      return null;
    });
  };

  // Cell editing
  const handleStartEdit = (rowIndex: number, colKey: string, currentVal: any) => {
    setEditingCell({ rowIndex, colKey });
    setCellEditValue(currentVal !== undefined && currentVal !== null ? String(currentVal) : '');
  };

  const handleCommitEdit = () => {
    if (!editingCell) return;
    const { rowIndex, colKey } = editingCell;
    const targetRow = filteredAndSortedRows[rowIndex];
    if (!targetRow) {
      setEditingCell(null);
      return;
    }
    const originalIndex = activeRows.indexOf(targetRow);
    if (originalIndex === -1) {
      setEditingCell(null);
      return;
    }
    let parsedVal: any = cellEditValue;
    if (cellEditValue === 'true') parsedVal = true;
    else if (cellEditValue === 'false') parsedVal = false;
    else if (
      !isNaN(Number(cellEditValue)) &&
      cellEditValue.trim() !== '' &&
      !colKey.endsWith('id') &&
      !colKey.endsWith('Id') &&
      !colKey.endsWith('Date') &&
      colKey !== 'phone' &&
      colKey !== 'password'
    ) {
      parsedVal = Number(cellEditValue);
    }
    const updatedRows = [...activeRows];
    updatedRows[originalIndex] = { ...targetRow, [colKey]: parsedVal };
    dbDataRef.current = { ...dbDataRef.current, [selectedTable]: updatedRows };
    setDbData(prev => ({ ...prev, [selectedTable]: updatedRows }));
    setEditingCell(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommitEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Add Row
  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach(col => {
      if (col === 'id') {
        newRow[col] = `${selectedTable.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      } else if (col.includes('date') || col.includes('Date')) {
        newRow[col] = new Date().toISOString().split('T')[0];
      } else if (col === 'status') {
        newRow[col] = 'active';
      } else {
        newRow[col] = '';
      }
    });
    const updatedRows = [...activeRows, newRow];
    dbDataRef.current = { ...dbDataRef.current, [selectedTable]: updatedRows };
    setDbData(prev => ({ ...prev, [selectedTable]: updatedRows }));
    setStatusMsg({ type: 'success', text: `Added new row to ${selectedTable}. Click "Save & Commit Changes" to persist.` });
  };

  // Delete Row
  const handleDeleteRow = (targetRow: any) => {
    const updatedRows = activeRows.filter(r => r !== targetRow);
    dbDataRef.current = { ...dbDataRef.current, [selectedTable]: updatedRows };
    setDbData(prev => ({ ...prev, [selectedTable]: updatedRows }));
  };

  // Save changes to SQLite database
  const handleSaveDatabase = async () => {
    setLoading(true);
    try {
      if (editingCell) handleCommitEdit();
      const currentRows = dbDataRef.current[selectedTable] ?? dbData[selectedTable];
      const ok = await saveToSQLite(selectedTable, currentRows, { immediate: true });
      if (ok) {
        setStatusMsg({ type: 'success', text: `Successfully saved ${currentRows?.length || 0} records to table "${selectedTable}" in SQLite (hrms.db)!` });
        const stats = await getDatabaseStats();
        setTableStats(stats);
        onRefreshData();
      } else {
        setStatusMsg({ type: 'error', text: `Failed to save changes to table "${selectedTable}".` });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Save failed: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // Reset database back to default schema and seed data
  const handleResetDatabase = async () => {
    if (!confirm('Are you sure you want to RESET the SQLite database back to initial defaults? All current records will be re-seeded.')) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const ok = await resetSQLiteDB();
      if (ok) {
        await loadDatabase(false);
        setStatusMsg({ type: 'success', text: 'SQLite database reset to default staff profiles, attendance and tasks!' });
        onRefreshData();
      } else {
        setStatusMsg({ type: 'error', text: 'Failed to reset SQLite database.' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'Error resetting SQLite database: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  // Execute raw SQL query from console
  const handleRunSqlQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsQueryRunning(true);
    setStatusMsg(null);
    try {
      const res = await executeSql(sqlQuery);
      setSqlResult(res);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `SQL executed successfully (${res.rows.length} rows returned).` });
        // Refresh database tables after query
        if (!/^\s*SELECT/i.test(sqlQuery.trim())) {
          await loadDatabase(false);
          onRefreshData();
        }
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'SQL execution failed.' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: 'SQL error: ' + (e.message || String(e)) });
    } finally {
      setIsQueryRunning(false);
    }
  };

  // Download raw SQLite database file
  const handleDownloadSQLiteFile = () => {
    const link = document.createElement('a');
    link.href = '/api/db/export';
    link.download = `hrms_database_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMsg({ type: 'success', text: 'Downloading SQLite database file (hrms.db)...' });
  };

  // Export current table as Excel
  const handleExportTableExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(activeRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, selectedTable.substring(0, 31));
      XLSX.writeFile(wb, `HRMS_${selectedTable}_Table.xlsx`);
      setStatusMsg({ type: 'success', text: `Exported table "${selectedTable}" to Excel (.xlsx)!` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Export failed: ' + err.message });
    }
  };

  // Export full database as SQL dump script
  const handleExportSQLDump = () => {
    try {
      let dump = `-- HRMS Database SQL Dump\n-- Generated on: ${new Date().toISOString()}\n\n`;
      for (const [tName, rows] of Object.entries(dbData)) {
        if (Array.isArray(rows) && rows.length > 0) {
          dump += `-- Table: ${tName}\n`;
          dump += `DELETE FROM ${tName};\n`;
          const keys = Object.keys(rows[0]);
          for (const row of rows) {
            const vals = keys.map(k => {
              const v = row[k];
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'number') return v;
              if (typeof v === 'boolean') return v ? 1 : 0;
              return `'${String(v).replace(/'/g, "''")}'`;
            });
            dump += `INSERT INTO ${tName} (${keys.join(', ')}) VALUES (${vals.join(', ')});\n`;
          }
          dump += `\n`;
        }
      }
      const blob = new Blob([dump], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hrms_dump_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMsg({ type: 'success', text: 'Exported complete database as SQL dump script (.sql)!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'SQL dump export failed: ' + err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Header Ribbon */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                HRMS SQL Database Manager
                <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                  SQLite (hrms.db)
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Self-contained, server-side relational SQL database. Zero external services, zero billing.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadSQLiteFile}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
              title="Download raw SQLite database file (hrms.db)"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download .sqlite DB</span>
              <span className="sm:hidden">DB</span>
            </button>
            <button
              onClick={() => loadDatabase()}
              disabled={loading}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer border border-slate-700"
              title="Reload from SQLite database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>

        {/* Database Status & Mode Ribbon */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold text-slate-700">Storage Engine:</span>
            <span className="bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              SQLite Engine Active (hrms.db on server disk)
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 font-medium">
              Tables: <strong>{Object.keys(TABLE_SCHEMAS).length}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table Grid</span>
              </button>
              <button
                onClick={() => setViewMode('sql')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'sql'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>SQL Query Console</span>
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                  viewMode === 'json'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar Controls (Grid View) */}
        {viewMode === 'grid' && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center flex-wrap gap-2">
              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedTable}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans shadow-3xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Add Row Button */}
              <button
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-300 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-3xs cursor-pointer"
                title="Insert a new row into this SQL table"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Insert Row</span>
              </button>

              {/* Export Table as Excel */}
              <button
                onClick={handleExportTableExcel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-3xs cursor-pointer"
                title="Download this table as Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Table (.xlsx)</span>
              </button>

              {/* Export SQL Dump */}
              <button
                onClick={handleExportSQLDump}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-3xs cursor-pointer"
                title="Export complete database as standard SQL script (.sql)"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-300" />
                <span>Export .SQL Dump</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Table: <strong className="text-slate-800">{selectedTable}</strong> ({activeRows.length} rows)
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Tables Sidebar */}
          <div className="w-full md:w-56 max-h-36 md:max-h-full bg-slate-100/80 border-b md:border-b-0 md:border-r border-slate-200 p-2 sm:p-3 space-y-1 overflow-y-auto shrink-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 py-1 flex items-center justify-between">
              <span>SQL TABLES</span>
              <span className="text-[9px] text-indigo-700 bg-indigo-100 font-mono px-1.5 rounded">SQLITE</span>
            </div>
            {Object.keys(TABLE_SCHEMAS).map(tableName => {
              const count = tableStats[tableName] ?? (Array.isArray(dbData[tableName]) ? dbData[tableName].length : 0);
              const isSelected = selectedTable === tableName;
              return (
                <button
                  key={tableName}
                  onClick={() => handleTableSelect(tableName)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <Table className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                    <span className="truncate">{tableName}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View: Table Grid */}
          {viewMode === 'grid' && (
            <div className="flex-1 overflow-auto flex flex-col bg-white">
              <table className="w-full border-collapse text-xs font-sans select-text">
                <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300">
                  <tr className="bg-indigo-50/70 text-indigo-950 font-bold border-b-2 border-indigo-600">
                    <th className="w-12 px-2 py-2 text-center border-r border-indigo-200 bg-indigo-100/70 font-mono text-[11px] sticky left-0 z-30 text-indigo-900">
                      #
                    </th>
                    {columns.map(col => {
                      const isSorted = sortConfig?.key === col;
                      return (
                        <th
                          key={`col-${col}`}
                          onClick={() => handleSort(col)}
                          className="px-3 py-2 text-left border-r border-indigo-200 font-extrabold whitespace-nowrap cursor-pointer hover:bg-indigo-100/80 transition-colors select-none"
                          title={`Click to sort by ${col}`}
                        >
                          <div className="flex items-center justify-between space-x-1">
                            <span>{col}</span>
                            <ArrowUpDown className={`w-3 h-3 ${isSorted ? 'text-indigo-700' : 'text-slate-400 hover:text-indigo-600'}`} />
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-10 px-2 py-2 text-center border-r border-indigo-200 font-mono text-[11px] text-indigo-900">
                      Del
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {filteredAndSortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-slate-400 text-xs italic">
                        No records found in table &quot;{selectedTable}&quot;. Click &quot;Insert Row&quot; above to add one.
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedRows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`} className="hover:bg-indigo-50/40 transition-colors group">
                        <td className="w-12 px-2 py-1.5 text-center font-mono text-[10px] text-slate-500 bg-slate-50 border-r border-slate-200 font-bold sticky left-0 z-10 select-none">
                          {rowIndex + 1}
                        </td>
                        {columns.map(colKey => {
                          const val = row[colKey];
                          const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === colKey;
                          const displayVal = val !== undefined && val !== null ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
                          return (
                            <td
                              key={`cell-${rowIndex}-${colKey}`}
                              onDoubleClick={() => handleStartEdit(rowIndex, colKey, val)}
                              className={`px-3 py-1.5 border-r border-slate-200 text-slate-800 text-xs font-mono max-w-xs truncate cursor-cell ${
                                isEditing ? 'bg-amber-50 ring-2 ring-indigo-500 ring-inset p-0' : 'hover:bg-indigo-50/70'
                              }`}
                              title="Double-click to edit cell"
                            >
                              {isEditing ? (
                                <div className="flex items-center h-full">
                                  <input
                                    ref={cellInputRef}
                                    type="text"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onKeyDown={handleCellKeyDown}
                                    onBlur={handleCommitEdit}
                                    className="w-full h-full px-2 py-1 bg-white font-mono text-xs text-slate-900 focus:outline-none"
                                  />
                                </div>
                              ) : (
                                <span className="block truncate">
                                  {displayVal === '' ? (
                                    <span className="text-slate-300 italic">null</span>
                                  ) : (
                                    displayVal
                                  )}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="w-10 px-2 py-1.5 text-center border-r border-slate-200">
                          <button
                            onClick={() => handleDeleteRow(row)}
                            className="text-slate-300 hover:text-rose-600 transition-colors p-1 rounded hover:bg-rose-50 cursor-pointer"
                            title="Delete this row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* View: SQL Query Console */}
          {viewMode === 'sql' && (
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden text-xs">
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-200 font-mono">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold">SQL Query Console</span>
                  <span className="text-[10px] text-slate-400">(SQLite dialect)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400">Presets:</span>
                  <button
                    onClick={() => setSqlQuery('SELECT id, name, role, department, salary FROM employees WHERE status = \'working\';')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-mono text-[10px] cursor-pointer"
                  >
                    Active Staff
                  </button>
                  <button
                    onClick={() => setSqlQuery('SELECT date, COUNT(*) as punch_count FROM attendance GROUP BY date ORDER BY date DESC LIMIT 7;')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-mono text-[10px] cursor-pointer"
                  >
                    Recent Punches
                  </button>
                  <button
                    onClick={() => setSqlQuery('SELECT status, COUNT(*) as total FROM tasks GROUP BY status;')}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-mono text-[10px] cursor-pointer"
                  >
                    Task Metrics
                  </button>
                </div>
              </div>

              {/* Query Input Box */}
              <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex gap-2">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={3}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-indigo-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  placeholder="Enter SQL statement, e.g. SELECT * FROM employees;"
                />
                <button
                  onClick={handleRunSqlQuery}
                  disabled={isQueryRunning || !sqlQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer shadow-md shrink-0"
                >
                  <Play className={`w-4 h-4 fill-white ${isQueryRunning ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] uppercase tracking-wider">Execute</span>
                </button>
              </div>

              {/* Query Results */}
              <div className="flex-1 overflow-auto p-3">
                {sqlResult ? (
                  sqlResult.success ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Query returned {sqlResult.rows.length} row(s) across {sqlResult.columns.length} column(s)</span>
                      </div>
                      <div className="overflow-x-auto border border-slate-800 rounded-lg">
                        <table className="w-full text-left font-mono text-[11px] border-collapse bg-slate-900/80">
                          <thead>
                            <tr className="bg-slate-800 text-slate-300 border-b border-slate-700">
                              {sqlResult.columns.map(col => (
                                <th key={col} className="px-3 py-1.5 border-r border-slate-700 font-bold whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-200">
                            {sqlResult.rows.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-800/50">
                                {sqlResult.columns.map(col => (
                                  <td key={col} className="px-3 py-1 border-r border-slate-800/80 whitespace-nowrap">
                                    {r[col] !== null && r[col] !== undefined ? String(r[col]) : <span className="text-slate-600 italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 font-mono text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">SQL Execution Error</p>
                        <p className="mt-1 text-[11px] leading-relaxed">{sqlResult.error}</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs italic">
                    <Terminal className="w-8 h-8 text-slate-700 mb-2" />
                    <p>Enter an SQL statement above and click Execute to see live database results.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View: Raw JSON */}
          {viewMode === 'json' && (
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 font-mono">
                <span className="flex items-center space-x-2">
                  <Code className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-slate-100">{selectedTable}</span>
                </span>
                <span className="text-[11px] text-slate-400">JSON representation of table rows</span>
              </div>
              <textarea
                value={JSON.stringify(dbData[selectedTable] ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setDbData(prev => ({ ...prev, [selectedTable]: parsed }));
                    dbDataRef.current = { ...dbDataRef.current, [selectedTable]: parsed };
                  } catch {}
                }}
                className="flex-1 w-full p-4 bg-slate-950 text-indigo-300 font-mono text-xs focus:outline-none resize-none leading-relaxed selection:bg-indigo-900"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Status Alert Banner */}
        {statusMsg && (
          <div className={`px-4 py-2 border-t text-xs font-semibold flex items-center justify-between gap-2 shrink-0 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
              : 'bg-rose-900/90 border-rose-700 text-rose-100'
          }`}>
            <div className="flex items-center space-x-2 min-w-0">
              {statusMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-300" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
              )}
              <span className="truncate">{statusMsg.text}</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleResetDatabase}
            disabled={loading}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Reset Database Defaults</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-3xs"
            >
              Close
            </button>
            <button
              onClick={handleSaveDatabase}
              disabled={loading}
              className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save & Commit Changes'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
