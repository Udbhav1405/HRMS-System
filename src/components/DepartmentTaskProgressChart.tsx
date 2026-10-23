import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Layers,
  ArrowRight,
  Filter
} from 'lucide-react';
import { AssignedTask, Department, Employee } from '../types';

interface DepartmentTaskProgressChartProps {
  tasks: AssignedTask[];
  departments: Department[];
  employees: Employee[];
  onNavigateToTasks?: () => void;
}

export const DepartmentTaskProgressChart: React.FC<DepartmentTaskProgressChartProps> = ({
  tasks,
  departments,
  employees,
  onNavigateToTasks
}) => {
  const [chartMode, setChartMode] = useState<'stacked' | 'grouped'>('stacked');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Compute department task analytics
  const { chartData, kpis } = useMemo(() => {
    // Map employee IDs to department names
    const empDeptMap = new Map<string, string>();
    employees.forEach(emp => {
      empDeptMap.set(emp.id, emp.department || 'General');
      if (emp.email) empDeptMap.set(emp.email.toLowerCase(), emp.department || 'General');
    });

    // Ensure all registered departments exist in map
    const deptStats: Record<string, {
      department: string;
      pending: number;
      inProgress: number;
      completed: number;
      total: number;
    }> = {};

    departments.forEach(dept => {
      deptStats[dept.name] = {
        department: dept.name,
        pending: 0,
        inProgress: 0,
        completed: 0,
        total: 0
      };
    });

    // Process tasks
    tasks.forEach(task => {
      let deptName = (task as any).department;
      if (!deptName && task.employeeId) {
        deptName = empDeptMap.get(task.employeeId);
      }
      if (!deptName) {
        const emp = employees.find(e => e.id === task.employeeId || e.name === task.employeeName);
        deptName = emp?.department || 'General';
      }

      if (!deptStats[deptName]) {
        deptStats[deptName] = {
          department: deptName,
          pending: 0,
          inProgress: 0,
          completed: 0,
          total: 0
        };
      }

      const status = (task.status || 'pending').toLowerCase();
      if (status === 'completed') {
        deptStats[deptName].completed += 1;
      } else if (status === 'in-progress' || status === 'in progress') {
        deptStats[deptName].inProgress += 1;
      } else {
        deptStats[deptName].pending += 1;
      }
      deptStats[deptName].total += 1;
    });

    let rawData = Object.values(deptStats).map(d => ({
      ...d,
      completionRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
    }));

    if (selectedDeptFilter !== 'all') {
      rawData = rawData.filter(d => d.department.toLowerCase() === selectedDeptFilter.toLowerCase());
    } else {
      // Show departments with tasks first, followed by other departments
      rawData.sort((a, b) => b.total - a.total || a.department.localeCompare(b.department));
    }

    // Overall Totals
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
    const inProgressTasks = tasks.filter(t => ['in-progress', 'in progress'].includes((t.status || '').toLowerCase())).length;
    const pendingTasks = tasks.filter(t => (t.status || '').toLowerCase() === 'pending').length;
    const overallRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      chartData: rawData,
      kpis: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
        overallRate
      }
    };
  }, [tasks, departments, employees, selectedDeptFilter]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[200px]">
          <div className="border-b border-slate-800 pb-1.5 flex justify-between items-center">
            <span className="font-extrabold text-sm text-white">{label}</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {data.total} Tasks
            </span>
          </div>
          <div className="space-y-1 font-medium">
            <div className="flex justify-between items-center text-amber-300">
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5"></span>
                Pending:
              </span>
              <span className="font-bold">{data.pending}</span>
            </div>
            <div className="flex justify-between items-center text-sky-300">
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-sky-400 mr-1.5"></span>
                In-Progress:
              </span>
              <span className="font-bold">{data.inProgress}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-300">
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>
                Completed:
              </span>
              <span className="font-bold">{data.completed}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Completion:</span>
            <span className="font-extrabold text-emerald-400">
              {data.completionRate}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in space-y-5 p-5 sm:p-6">
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight">
                Department Task Completion Progress
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Visualizing task completion distribution (Pending, In-Progress & Completed) by department
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Stacked vs Grouped Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setChartMode('stacked')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                chartMode === 'stacked'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Stacked view showing cumulative totals"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Stacked</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('grouped')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                chartMode === 'grouped'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grouped comparison view"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Grouped</span>
            </button>
          </div>

          {onNavigateToTasks && (
            <button
              type="button"
              onClick={onNavigateToTasks}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200/80 transition-colors cursor-pointer flex items-center space-x-1"
            >
              <span>Manage Directives</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Top Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{kpis.total}</span>
            <span className="text-[11px] text-slate-500">assigned</span>
          </div>
        </div>

        <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-amber-700">{kpis.pending}</span>
            <span className="text-[11px] text-amber-600">
              {kpis.total > 0 ? Math.round((kpis.pending / kpis.total) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-sky-50/60 border border-sky-200/70 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" /> In-Progress
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-sky-700">{kpis.inProgress}</span>
            <span className="text-[11px] text-sky-600">
              {kpis.total > 0 ? Math.round((kpis.inProgress / kpis.total) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-xl p-3 sm:p-4">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{kpis.completed}</span>
            <span className="text-[11px] text-emerald-600 font-bold">
              {kpis.overallRate}% rate
            </span>
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization */}
      <div className="w-full h-72 sm:h-80 pt-2">
        {chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl text-center p-6 text-slate-400">
            <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
            <p className="font-bold text-slate-600 text-sm">No Department Task Data Available</p>
            <p className="text-xs mt-1 max-w-sm">Assign directives or proposals to staff members to visualize real-time progress by department.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="department"
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 600 }}
              />
              <Bar
                dataKey="pending"
                name="Pending"
                fill="#f59e0b"
                stackId={chartMode === 'stacked' ? 'dept' : undefined}
                radius={chartMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                dataKey="inProgress"
                name="In-Progress"
                fill="#3b82f6"
                stackId={chartMode === 'stacked' ? 'dept' : undefined}
                radius={chartMode === 'stacked' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={45}
              />
              <Bar
                dataKey="completed"
                name="Completed"
                fill="#10b981"
                stackId={chartMode === 'stacked' ? 'dept' : undefined}
                radius={chartMode === 'stacked' ? [6, 6, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Department Breakdown Mini-Bars */}
      <div className="pt-3 border-t border-slate-100">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-3">
          Department Completion Breakdown
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {chartData.map(d => (
            <div
              key={d.department}
              className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 hover:bg-slate-100/60 transition-colors"
            >
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-extrabold text-slate-800 truncate" title={d.department}>
                  {d.department}
                </span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                  d.completionRate === 100 && d.total > 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : d.completionRate > 50
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {d.total > 0 ? `${d.completionRate}% Done` : '0 Tasks'}
                </span>
              </div>
              
              {/* Multi-segment mini progress bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                {d.total > 0 ? (
                  <>
                    <div
                      style={{ width: `${(d.completed / d.total) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all duration-300"
                      title={`Completed: ${d.completed}`}
                    />
                    <div
                      style={{ width: `${(d.inProgress / d.total) * 100}%` }}
                      className="bg-blue-500 h-full transition-all duration-300"
                      title={`In-Progress: ${d.inProgress}`}
                    />
                    <div
                      style={{ width: `${(d.pending / d.total) * 100}%` }}
                      className="bg-amber-400 h-full transition-all duration-300"
                      title={`Pending: ${d.pending}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-200 h-full" />
                )}
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-medium">
                <span>{d.completed} of {d.total} completed</span>
                <span>{d.inProgress} active • {d.pending} queued</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
