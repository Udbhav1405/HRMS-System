import React, { useState } from 'react';
import { LeaveRequest, Employee } from '../types';
import { isExcludedStaff } from '../utils/sqlClient.ts';
import { Send, FileText, Check, X, ArrowRight, UserCheck } from 'lucide-react';

interface LeaveRequestsTabProps {
  leaveRequests: LeaveRequest[];
  setLeaveRequests: React.Dispatch<React.SetStateAction<LeaveRequest[]>>;
  activeUser: Employee;
}

export function LeaveRequestsTab({ leaveRequests, setLeaveRequests, activeUser }: LeaveRequestsTabProps) {
  // Submit leave form
  const [isRequesting, setIsRequesting] = useState(false);
  const [type, setType] = useState<'Leave' | 'Half Day'>('Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !reason.trim()) return;

    const newRequest: LeaveRequest = {
      id: `LEV-${Date.now()}`,
      employeeId: activeUser.id,
      employeeName: activeUser.name,
      type,
      startDate,
      endDate: type === 'Half Day' ? startDate : (endDate || startDate),
      reason: reason.trim(),
      status: activeUser.role === 'hr' ? 'Pending Admin/Manager' : 'Pending HR'
    };

    setLeaveRequests(prev => [newRequest, ...prev]);
    setStartDate('');
    setEndDate('');
    setReason('');
    setIsRequesting(false);
  };

  // HR refers to Manager
  const handleReferToManager = (reqId: string) => {
    setLeaveRequests(prev =>
      prev.map(r =>
        r.id === reqId
          ? {
              ...r,
              status: 'Referred to Manager',
              referredDate: new Date().toISOString().split('T')[0]
            }
          : r
      )
    );
  };

  // Manager approves / declines
  const handleManagerDecision = (reqId: string, approved: boolean) => {
    setLeaveRequests(prev =>
      prev.map(r =>
        r.id === reqId
          ? {
              ...r,
              status: approved ? 'Manager Approved' : 'Manager Declined',
              managerDecisionDate: new Date().toISOString().split('T')[0]
            }
          : r
      )
    );
  };

  // HR final approves / declines
  const handleFinalDecision = (reqId: string, approved: boolean) => {
    setLeaveRequests(prev =>
      prev.map(r =>
        r.id === reqId
          ? {
              ...r,
              status: approved ? 'Approved' : 'Declined',
              finalDecisionDate: new Date().toISOString().split('T')[0]
            }
          : r
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Time Off & Leave Requests</h2>
          <p className="text-slate-500 text-xs mt-1">Multi-stage HR-Manager workflow for employee leave validation.</p>
        </div>
        {!['admin', 'manager'].includes(activeUser.role) && !isRequesting && (
          <button
            onClick={() => setIsRequesting(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm transition-colors self-start sm:self-auto"
          >
            <Send className="w-4 h-4 mr-1.5 shrink-0" />
            Request Leave / Half Day
          </button>
        )}
      </div>

      {isRequesting && (
        <form onSubmit={handleRequestSubmit} className="bg-white border border-indigo-100 p-6 rounded-xl shadow-sm space-y-4 max-w-xl">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Submit Leave Request</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Request Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Leave">Full Day Leave</option>
                <option value="Half Day">Half Day</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {type === 'Leave' && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">End Date (Optional, defaults to start date)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Reason for Request</label>
            <textarea
              required
              placeholder="Provide context for HR & Management..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsRequesting(false)}
              className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              Submit Request
            </button>
          </div>
        </form>
      )}

      {/* Roster list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-100 font-extrabold text-xs text-slate-700 uppercase tracking-wider">
          Request Registry & Routing Pipeline
        </div>
        
        <div className="divide-y divide-slate-100">
          {leaveRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No leave requests registered in the system.
            </div>
          ) : (
            leaveRequests
              .filter(req => {
                if (isExcludedStaff(req)) return false;
                // Visibility filters
                if (activeUser.role === 'employee') {
                  // Employees see only their own
                  return req.employeeId === activeUser.id;
                }
                if (activeUser.role === 'manager') {
                  // Managers see referred ones and pending HR self-requests
                  return req.status === 'Referred to Manager' || req.status.startsWith('Manager') || req.status === 'Approved' || req.status === 'Declined' || req.status === 'Pending Admin/Manager';
                }
                // HR & Admin see all
                return true;
              })
              .map((req, reqIdx) => {
                return (
                  <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-[10px] font-mono font-extrabold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          No. #{reqIdx + 1}
                        </span>

                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                          req.type === 'Half Day' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {req.type}
                        </span>
                        
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          req.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'Declined' ? 'bg-rose-100 text-rose-800' :
                          req.status === 'Pending HR' ? 'bg-slate-100 text-slate-800' :
                          req.status === 'Pending Admin/Manager' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                          req.status === 'Referred to Manager' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{req.employeeName}</span>
                        <span className="text-indigo-600 bg-indigo-50 font-mono text-[10px] px-1.5 py-0.5 rounded border border-indigo-100 font-semibold">(Emp No: {req.employeeId})</span>
                      </p>
                      
                      <p className="text-xs text-slate-600 italic bg-slate-50/50 px-3 py-1.5 rounded border border-slate-100 max-w-xl">
                        "{req.reason}"
                      </p>
                      
                      <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4">
                        <span>Period: <strong>{req.startDate}</strong> {req.type === 'Leave' && req.endDate !== req.startDate && <>to <strong>{req.endDate}</strong></>}</span>
                        {req.referredDate && <span>• Referred on: <strong>{req.referredDate}</strong></span>}
                        {req.managerDecisionDate && <span>• Manager decision: <strong>{req.managerDecisionDate}</strong></span>}
                      </div>
                    </div>

                    {/* Stage actions based on activeUser role */}
                    <div className="shrink-0 flex items-center space-x-2">
                      {req.status !== 'Approved' && req.status !== 'Declined' && (
                        <div className="flex items-center space-x-1 justify-end">
                          {/* HR Refer button if pending HR */}
                          {['hr', 'admin'].includes(activeUser.role) && req.status === 'Pending HR' && (
                            <button
                              onClick={() => handleReferToManager(req.id)}
                              className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold cursor-pointer mr-1 transition-colors"
                            >
                              <ArrowRight className="w-3.5 h-3.5 mr-1" /> Refer
                            </button>
                          )}

                          {/* Direct Approve / Decline for Admin, Manager, and HR */}
                          {['admin', 'manager', 'hr'].includes(activeUser.role) && (
                            <>
                              <button
                                onClick={() => handleFinalDecision(req.id, false)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold cursor-pointer transition-colors"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleFinalDecision(req.id, true)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                              >
                                Approve
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Summary indicator */}
                      {(req.status === 'Approved' || req.status === 'Declined') && (
                        <span className="text-[10px] text-slate-400 italic font-semibold">
                          Workflow Complete ({req.status})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
