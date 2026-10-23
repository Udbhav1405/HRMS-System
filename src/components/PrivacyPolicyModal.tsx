import React from 'react';
import { ShieldCheck, X, Lock, Eye, Database, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Privacy Policy &amp; Data Protection</h2>
              <p className="text-[11px] text-slate-500 font-medium">HRMS System Enterprise Compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close Privacy Policy Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-600 leading-relaxed">
          <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
            <div className="flex items-center space-x-1.5 text-indigo-700 font-bold text-xs">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Enterprise Confidentiality Guarantee</span>
            </div>
            <p className="text-indigo-900 text-[11px]">
              HRMS System respects the confidentiality of personal employee data, salary compensation metrics, and attendance punch logs. This policy governs how information is collected, stored, and protected within the HRMS portal.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <span>1. Information We Collect</span>
            </h3>
            <p>
              To manage operational staffing and compensation, the HRMS system records:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700 font-medium">
              <li><strong>Profile Information:</strong> Full name, employee ID, company email address, job title, and residential address.</li>
              <li><strong>Attendance &amp; Verification Logs:</strong> Daily check-in/check-out timestamps, shift duration calculations, and leave applications.</li>
              <li><strong>Payroll &amp; Financial Variables:</strong> Base monthly salary, pro-rata calculations, deductions, and generated salary PDF statements.</li>
              <li><strong>Emergency Contact Records:</strong> Strictly optional emergency contacts provided explicitly by authorized personnel.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>2. Role-Based Access Control (RBAC)</span>
            </h3>
            <p>
              Access to employee records is strictly segmented according to verified administrative roles:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li><strong>Employees:</strong> Restricted exclusively to viewing their personal attendance history, task pipeline, and private monthly salary slips.</li>
              <li><strong>Department Managers:</strong> Limited to managing assigned team tasks, department staff status, and leave requests.</li>
              <li><strong>HR Specialists &amp; Administrators:</strong> Authorized for organization-wide employee lifecycle administration and payroll calculation.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>3. Data Security &amp; Encryption</span>
            </h3>
            <p>
              All traffic between your browser and our cloud servers is encrypted using modern TLS (HTTPS) protocols. Stored data is safeguarded against unauthorized modification or external exposure, and frontend code contains no secret API keys or credentials.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>4. Cookies &amp; Local Storage</span>
            </h3>
            <p>
              We utilize local storage and session tokens strictly to sustain user authentication state, security verification, and user interface preferences (such as time simulation offsets). We do not deploy third-party advertising cookies or cross-site tracking trackers.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm">5. Contact Administration</h3>
            <p>
              For inquiries regarding personal data privacy, records correction, or compliance auditing, please contact the administration desk at <span className="font-semibold text-slate-800">admin@hrms.demo</span>.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Last Updated: October 2026 • Compliant with Indian IT Act &amp; Enterprise Corporate Guidelines.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            I Understand &amp; Agree
          </button>
        </div>

      </div>
    </div>
  );
}
