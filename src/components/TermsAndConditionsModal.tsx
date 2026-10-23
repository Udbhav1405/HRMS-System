import React from 'react';
import { Scale, X, ShieldAlert, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsAndConditionsModal({ isOpen, onClose }: TermsAndConditionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Terms &amp; Conditions of Employment Portal</h2>
              <p className="text-[11px] text-slate-500 font-medium">HRMS System Authorized Workspace Agreement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close Terms Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-600 leading-relaxed">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
            <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Authorized Enterprise Use Only</span>
            </div>
            <p className="text-amber-900 text-[11px]">
              Access to this HRMS portal is strictly restricted to active employees, management contractors, and authorized HR personnel of the HRMS System. Unauthorized access attempts are monitored and recorded.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>1. Credential Security &amp; Individual Responsibility</span>
            </h3>
            <p>
              Users are provided individualized login credentials (ID, corporate email, and password). Sharing accounts, delegating login passwords, or clocking punch-in attendance on behalf of another employee ("buddy punching") constitutes a violation of corporate policy.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              <span>2. Attendance &amp; Paid-Leave Rules</span>
            </h3>
            <p>
              The HRMS system automatically calculates pro-rata monthly salary compensation based on verified daily clock-in/out logs:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700 font-medium">
              <li>Each full-time staff member receives an entitlement of <strong>2 Paid Casual Leaves (CL)</strong> and <strong>2 Paid Half Days</strong> per monthly cycle.</li>
              <li>Unapproved absences or leaves exceeding statutory allowances result in pro-rata daily salary deductions.</li>
              <li>Sundays and recognized corporate holidays are recognized as paid non-working off days.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span>3. Confidentiality of Compensation &amp; Proprietary Information</span>
            </h3>
            <p>
              Salary statements, compensation structures, department project pipelines, and task proposals are confidential intellectual property of the organization. Downloading or disseminating reports to unauthorized third parties is strictly prohibited.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm">4. Modifications &amp; Governing Law</h3>
            <p>
              The organization reserves the right to amend corporate operational guidelines, office schedules, or leave allocations in accordance with company bylaws. These terms are governed under the jurisdictional laws of India.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Effective Date: 2026 Season • Human Resources Department, HRMS System.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Acknowledge &amp; Accept
          </button>
        </div>

      </div>
    </div>
  );
}
