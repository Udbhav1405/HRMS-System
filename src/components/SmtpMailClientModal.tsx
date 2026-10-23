import React, { useState, useEffect } from 'react';
import {
  Mail,
  X,
  Send,
  Terminal,
  CheckCircle2,
  Clock,
  Trash2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Server,
  ShieldCheck,
  FileText,
  Eye,
  AlertCircle,
  Globe,
  Zap,
  Key
} from 'lucide-react';
import { EmailLog, Employee, SmtpClientConfig } from '../types';
import {
  mailService,
  DEFAULT_SMTP_CONFIG,
  subscribeToMailEvents,
  createGmailComposeUrl
} from '../services/mailService';

interface SmtpMailClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onOpenFullTab?: () => void;
}

export const SmtpMailClientModal: React.FC<SmtpMailClientModalProps> = ({
  isOpen,
  onClose,
  employees,
  onOpenFullTab
}) => {
  const [emails, setEmails] = useState<EmailLog[]>(() => mailService.getEmailLogs());
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(() => {
    const list = mailService.getEmailLogs();
    return list.length > 0 ? list[0] : null;
  });
  const [activeTab, setActiveTab] = useState<'preview' | 'smtp_logs' | 'plain_text'>('preview');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Customized fields
  const config = mailService.getConfig();
  const [customSenderGmail, setCustomSenderGmail] = useState<string>(() => {
    const addr = config.senderAddress;
    return addr === 'udbhavsingh1405@gmail.com' ? '' : (addr || '');
  });
  const [testRecipientId, setTestRecipientId] = useState(employees[3]?.id || employees[0]?.id || '');
  const [customStaffGmail, setCustomStaffGmail] = useState<string>(() => {
    const emp = employees[3] || employees[0];
    return emp ? emp.email : 'staff@gmail.com';
  });

  const refreshEmails = () => {
    const list = mailService.getEmailLogs();
    setEmails(list);
    if (!selectedEmail && list.length > 0) {
      setSelectedEmail(list[0]);
    } else if (selectedEmail && !list.some(e => e.id === selectedEmail.id)) {
      setSelectedEmail(list[0] || null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshEmails();
      const currentCfg = mailService.getConfig();
      const addr = currentCfg.senderAddress;
      setCustomSenderGmail(addr === 'udbhavsingh1405@gmail.com' ? '' : (addr || ''));
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeToMailEvents((newMail) => {
      const list = mailService.getEmailLogs();
      setEmails(list);
      if (newMail) {
        setSelectedEmail(newMail);
      }
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleRecipientSelect = (empId: string) => {
    setTestRecipientId(empId);
    const targetEmp = employees.find(e => e.id === empId);
    if (targetEmp) {
      setCustomStaffGmail(targetEmp.email);
    }
  };

  const handleSendTest = async () => {
    const targetEmp = employees.find(e => e.id === testRecipientId) || employees[0];
    if (!targetEmp) return;
    if (!customStaffGmail.trim() || !customStaffGmail.includes('@')) {
      setStatusToast('Please enter a valid Staff Gmail address');
      return;
    }

    setIsSendingTest(true);
    try {
      const emailRecord = await mailService.sendCustomEmail({
        fromEmail: customSenderGmail.trim() || 'notifications@company.com',
        fromName: config.senderName || 'HR Management',
        toEmail: customStaffGmail.trim(),
        toName: targetEmp.name,
        subject: `[HRMS Test Directive] Automated Delivery to ${targetEmp.name}`,
        messageBody: 'This test confirms that your customized sender Gmail can deliver directives directly to staff Gmail addresses.',
        priority: 'medium',
        deliveryMethod: config.password ? 'real_smtp' : 'simulation'
      });
      refreshEmails();
      setSelectedEmail(emailRecord);
      setStatusToast(`Dispatched to staff Gmail ${customStaffGmail}!`);
      setTimeout(() => setStatusToast(null), 3800);
    } catch (err: any) {
      setStatusToast('SMTP Error: ' + err.message);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleOpenWebGmail = () => {
    if (!customStaffGmail.trim()) return;
    const url = createGmailComposeUrl({
      to: customStaffGmail.trim(),
      subject: '[HRMS Directive] Directive Notification',
      body: `Hello,\n\nPlease review your operational directives in the HRMS System.\n\n--\n${customSenderGmail}`
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatusToast(`Opened Google Mail compose for ${customStaffGmail}`);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all dispatched SMTP email logs?')) {
      mailService.clearLogs();
      setEmails([]);
      setSelectedEmail(null);
    }
  };

  const handleCopyLogs = (logs: string[]) => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white border border-slate-300 shadow-2xl rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Ribbon */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  SMTP Mail Gateway &amp; Staff Dispatcher
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Gmail Ready
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Send from your custom Gmail to any staff Gmail with live SMTP and Gmail Web compose.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onOpenFullTab && (
              <button
                onClick={() => {
                  onClose();
                  onOpenFullTab();
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Open full dedicated SMTP Mail Outbox tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Full Tab</span>
              </button>
            )}
            <button
              onClick={refreshEmails}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer border border-slate-700"
              title="Refresh inbox"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>

        {/* Top Info & Quick Dispatch Bar */}
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center flex-wrap gap-2 text-slate-700 font-medium">
            <span className="font-bold text-slate-900">Your Sender Gmail:</span>
            <input
              type="email"
              value={customSenderGmail}
              onChange={(e) => setCustomSenderGmail(e.target.value)}
              placeholder="e.g. yourname@gmail.com"
              className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Staff Member:</span>
              <select
                value={testRecipientId}
                onChange={(e) => handleRecipientSelect(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Staff Gmail:</span>
              <input
                type="email"
                value={customStaffGmail}
                onChange={(e) => setCustomStaffGmail(e.target.value)}
                placeholder="staff@gmail.com"
                className="bg-transparent text-xs font-mono font-bold text-emerald-700 focus:outline-none w-44"
              />
            </div>

            <button
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-3xs cursor-pointer flex items-center space-x-1"
            >
              <Zap className={`w-3.5 h-3.5 mr-1 ${isSendingTest ? 'animate-spin' : ''}`} />
              <span>{isSendingTest ? 'Sending...' : 'Send SMTP'}</span>
            </button>

            <button
              onClick={handleOpenWebGmail}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-3xs cursor-pointer flex items-center space-x-1"
              title="Open Google Mail Web compose"
            >
              <Globe className="w-3.5 h-3.5 mr-1" />
              <span>Gmail Web</span>
            </button>
          </div>
        </div>

        {/* Toast status alert */}
        {statusToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-5 py-2 text-xs font-bold flex items-center justify-between animate-fade-in shrink-0">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {statusToast}
            </span>
            <button onClick={() => setStatusToast(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">✕</button>
          </div>
        )}

        {/* Main Body: Two-column Email Client Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Sent Mails Outbox */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
              <span className="uppercase text-[10px] tracking-wider text-slate-400">
                Dispatched Outbox ({emails.length})
              </span>
              {emails.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-rose-600 hover:text-rose-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Clear mail logs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {emails.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                  <Mail className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600">No Sent Emails in Outbox</p>
                  <p className="text-[11px] leading-relaxed">
                    Click <strong>&quot;Send SMTP&quot;</strong> or <strong>&quot;Gmail Web&quot;</strong> above to dispatch directives directly to staff!
                  </p>
                </div>
              ) : (
                emails.map((email) => {
                  const isSelected = selectedEmail?.id === email.id;
                  const dateObj = new Date(email.sentAt);
                  const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateFormatted = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={`p-3.5 transition-colors cursor-pointer text-left space-y-1.5 ${
                        isSelected
                          ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                          : 'hover:bg-slate-100/70 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-800 truncate">
                          {email.recipientName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dateFormatted} {timeFormatted}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {email.subject}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-emerald-700 font-mono truncate max-w-[170px] font-bold">
                          {email.recipientEmail}
                        </span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded uppercase">
                          Delivered
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Email Content & SMTP Handshake Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {selectedEmail ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Email Meta Ribbon */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/60 space-y-2 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="font-black text-sm text-slate-900 leading-snug">
                      {selectedEmail.subject}
                    </h3>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <a
                        href={createGmailComposeUrl({
                          to: selectedEmail.recipientEmail,
                          subject: selectedEmail.subject,
                          body: selectedEmail.textContent
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Open in Gmail Web"
                      >
                        <Globe className="w-3 h-3" />
                        <span>Gmail Web</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                    <div>
                      <span className="text-slate-400 font-medium">To (Staff Gmail): </span>
                      <strong className="text-emerald-800 font-mono">{selectedEmail.recipientEmail}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">From (Custom Sender): </span>
                      <strong className="text-indigo-800 font-mono">{selectedEmail.senderEmail}</strong>
                    </div>
                  </div>

                  {/* Mode Navigation Bar */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200/80">
                    <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                      <button
                        onClick={() => setActiveTab('preview')}
                        className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                          activeTab === 'preview'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Rendered Card</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('smtp_logs')}
                        className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                          activeTab === 'smtp_logs'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Protocol Stream</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('plain_text')}
                        className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                          activeTab === 'plain_text'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Plaintext</span>
                      </button>
                    </div>

                    {activeTab === 'smtp_logs' && (
                      <button
                        onClick={() => handleCopyLogs(selectedEmail.smtpLogs)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
                      >
                        {copiedLogs ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                        <span>{copiedLogs ? 'Copied!' : 'Copy Logs'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* View 1: Rendered HTML Email Preview */}
                {activeTab === 'preview' && (
                  <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/70 flex justify-center">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                      <div
                        className="p-1"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.htmlContent }}
                      />
                    </div>
                  </div>
                )}

                {/* View 2: Raw SMTP Handshake Terminal Logs */}
                {activeTab === 'smtp_logs' && (
                  <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-indigo-200 space-y-1 select-text">
                    <div className="text-[11px] text-slate-500 pb-2 border-b border-slate-800 mb-2">
                      // --- RFC 5321 SMTP Client Connection &amp; Transaction Handshake Stream ---
                    </div>
                    {selectedEmail.smtpLogs.map((line, idx) => {
                      const isClient = line.includes('-->');
                      const isSuccess = line.includes('250') || line.includes('220') || line.includes('235');

                      return (
                        <div
                          key={idx}
                          className={`leading-relaxed ${
                            isClient
                              ? 'text-sky-300 font-semibold'
                              : isSuccess
                              ? 'text-emerald-400'
                              : 'text-indigo-200'
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t border-slate-800 text-emerald-400 font-bold flex items-center gap-1.5 mt-3">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{selectedEmail.smtpResponse}</span>
                    </div>
                  </div>
                )}

                {/* View 3: Plaintext MIME View */}
                {activeTab === 'plain_text' && (
                  <div className="flex-1 overflow-auto p-6 bg-slate-900 font-mono text-xs text-slate-200 select-text whitespace-pre-wrap leading-relaxed">
                    {selectedEmail.textContent}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Mail className="w-12 h-12 text-slate-300 mb-2" />
                <p className="font-bold text-slate-600">Select an email to view details</p>
                <p className="text-xs text-slate-400 mt-1">Dispatched emails will appear here with full protocol streams.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Direct Gmail &amp; RFC 5321 Outbox Engine Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
