import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Terminal,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Server,
  ShieldCheck,
  FileText,
  Eye,
  AlertCircle,
  Search,
  Filter,
  Sliders,
  Radio,
  ExternalLink,
  Layers,
  Inbox,
  User,
  Key,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Zap,
  Lock,
  Globe
} from 'lucide-react';
import { EmailLog, Employee, SmtpClientConfig } from '../types';
import {
  mailService,
  DEFAULT_SMTP_CONFIG,
  subscribeToMailEvents,
  createGmailComposeUrl,
  createMailtoUrl,
  verifySmtpCredentials
} from '../services/mailService';

interface SmtpMailOutboxTabProps {
  employees: Employee[];
  activeUser: Employee;
  onNavigateToTab?: (tab: string) => void;
}

export const SmtpMailOutboxTab: React.FC<SmtpMailOutboxTabProps> = ({
  employees,
  activeUser,
  onNavigateToTab
}) => {
  // Main view sub-tab
  const [subTab, setSubTab] = useState<'outbox' | 'compose' | 'settings'>('compose');

  // Emails and selection state
  const [emails, setEmails] = useState<EmailLog[]>(() => mailService.getEmailLogs());
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(() => {
    const list = mailService.getEmailLogs();
    return list.length > 0 ? list[0].id : null;
  });

  // Email detail view modes
  const [detailMode, setDetailMode] = useState<'preview' | 'smtp_logs' | 'plain_text' | 'headers'>('preview');

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'failed' | 'queued'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Actions state
  const [isResending, setIsResending] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // --- SENDER GMAIL STATE (Filled by User) ---
  const [config, setConfig] = useState<SmtpClientConfig>(() => mailService.getConfig());
  const [senderGmail, setSenderGmail] = useState<string>(() => {
    const addr = config.senderAddress;
    return addr === 'udbhavsingh1405@gmail.com' ? '' : (addr || '');
  });
  const [senderName, setSenderName] = useState<string>(() => config.senderName || `${activeUser.name} (HR Admin)`);
  const [appPassword, setAppPassword] = useState<string>(() => config.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showAppPasswordGuide, setShowAppPasswordGuide] = useState(false);

  // --- RECIPIENT STAFF GMAIL STATE (Filled by User) ---
  const [selectedStaffId, setSelectedStaffId] = useState<string>(employees[0]?.id || 'custom');
  const [staffRecipientName, setStaffRecipientName] = useState<string>(employees[0]?.name || 'Staff Member');
  const [staffGmail, setStaffGmail] = useState<string>(employees[0]?.email || 'staff.member@gmail.com');

  // --- EMAIL CONTENT STATE ---
  const [composeTaskTitle, setComposeTaskTitle] = useState('Quarterly Performance Audit & System Optimization');
  const [composePriority, setComposePriority] = useState<'low' | 'medium' | 'high'>('high');
  const [composeDueDate, setComposeDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [composeInstructions, setComposeInstructions] = useState(
    'Please review the assigned operational directive, verify production database indexes, and update your HRMS progress log before the specified deadline.'
  );

  // Dispatch state
  const [isSendingSmtp, setIsSendingSmtp] = useState(false);
  const [isVerifyingGoogleSmtp, setIsVerifyingGoogleSmtp] = useState(false);

  // Settings testing state
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; response: string; latencyMs: number; logs: string[]; isReal?: boolean } | null>(null);

  // Quick preset template loader
  const handleLoadTemplate = (type: 'directive' | 'performance' | 'leave_approval' | 'urgent') => {
    if (type === 'directive') {
      setComposeTaskTitle('Operational Directive: Client Ingress & Security Review');
      setComposePriority('high');
      setComposeInstructions('Complete system security audit across active endpoints, rotate internal tokens, and submit verification log in HRMS.');
    } else if (type === 'performance') {
      setComposeTaskTitle('Quarterly Milestone & Key Deliverables Review');
      setComposePriority('medium');
      setComposeInstructions('Please prepare your quarterly self-evaluation summary and schedule a 30-minute sync with your department head.');
    } else if (type === 'leave_approval') {
      setComposeTaskTitle('Confirmation: Time-Off & Attendance Adjustment Request');
      setComposePriority('low');
      setComposeInstructions('Your requested leave schedule has been reviewed and logged into the HRMS attendance database.');
    } else if (type === 'urgent') {
      setComposeTaskTitle('URGENT: Incident Response & Service Availability Check');
      setComposePriority('high');
      setComposeInstructions('Immediate attention required: verify server CPU/memory thresholds and confirm status on the operations bridge.');
    }
    showToast(`Loaded ${type.replace('_', ' ')} email template`, 'info');
  };

  // Staff member change handler
  const handleStaffSelect = (empId: string) => {
    setSelectedStaffId(empId);
    if (empId === 'custom') {
      // Keep or allow typing
      return;
    }
    const found = employees.find(e => e.id === empId);
    if (found) {
      setStaffRecipientName(found.name);
      setStaffGmail(found.email);
    }
  };

  // Subscribe to real-time mail dispatch events across the entire HRMS
  useEffect(() => {
    const unsub = subscribeToMailEvents((newEmail) => {
      const refreshed = mailService.getEmailLogs();
      setEmails(refreshed);
      if (newEmail) {
        setSelectedEmailId(newEmail.id);
      }
    });
    return () => unsub();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4200);
  };

  const refreshList = () => {
    const list = mailService.getEmailLogs();
    setEmails(list);
    if (!selectedEmailId && list.length > 0) {
      setSelectedEmailId(list[0].id);
    } else if (selectedEmailId && !list.some(e => e.id === selectedEmailId)) {
      setSelectedEmailId(list[0]?.id || null);
    }
    showToast('Outbox refreshed from storage', 'info');
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to purge all dispatched SMTP email logs?')) {
      mailService.clearLogs();
      setEmails([]);
      setSelectedEmailId(null);
      showToast('All dispatched SMTP outbox logs have been purged.', 'info');
    }
  };

  const handleDeleteSingle = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    mailService.deleteEmailLog(id);
    const updated = mailService.getEmailLogs();
    setEmails(updated);
    if (selectedEmailId === id) {
      setSelectedEmailId(updated[0]?.id || null);
    }
    showToast('Email record removed from outbox.', 'info');
  };

  const handleResend = async (id: string) => {
    setIsResending(true);
    try {
      const resent = await mailService.resendEmail(id);
      const updated = mailService.getEmailLogs();
      setEmails(updated);
      setSelectedEmailId(resent.id);
      showToast(`Email re-dispatched via SMTP to ${resent.recipientEmail}!`, 'success');
    } catch (err: any) {
      showToast('Failed to resend email: ' + err.message, 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleCopyLogs = (logs: string[]) => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLogs(true);
    showToast('RFC 5321 protocol stream copied to clipboard!', 'info');
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Verify Google SMTP credentials live
  const handleVerifyGoogleSmtp = async () => {
    if (!senderGmail.trim() || !senderGmail.includes('@')) {
      showToast('Please enter your valid Sender Gmail address first.', 'error');
      return;
    }
    if (!appPassword.trim()) {
      showToast('Please enter your 16-character Google App Password to verify live SMTP.', 'error');
      return;
    }

    setIsVerifyingGoogleSmtp(true);
    try {
      await verifySmtpCredentials({
        ...config,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: senderGmail.trim(),
        password: appPassword.trim(),
        senderAddress: senderGmail.trim(),
        senderName: senderName.trim()
      });
      showToast('Google Gmail SMTP credentials verified successfully! Live delivery enabled.', 'success');
    } catch (err: any) {
      showToast('Google SMTP verification failed: ' + err.message, 'error');
    } finally {
      setIsVerifyingGoogleSmtp(false);
    }
  };

  // Action 1: Real SMTP dispatch to staff Gmail
  const handleSendViaGmailSmtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderGmail.trim() || !senderGmail.includes('@')) {
      showToast('Please enter a valid Sender Gmail address (Filled by you)', 'error');
      return;
    }
    if (!staffGmail.trim() || !staffGmail.includes('@')) {
      showToast('Please enter a valid Staff Gmail address (Filled by you)', 'error');
      return;
    }
    if (!composeTaskTitle.trim()) {
      showToast('Please enter a directive subject', 'error');
      return;
    }

    // If no App Password provided, inform the user they can either provide App Password or use 1-Click Gmail Web
    if (!appPassword.trim()) {
      const proceedSimulation = confirm(
        'You have not provided a 16-character Google App Password for live smtp.gmail.com transmission.\n\n' +
        '• Click "OK" to record this dispatch in the SMTP Outbox and simulate the RFC 5321 envelope.\n' +
        '• Click "Cancel" if you want to enter your Google App Password or use the "Open & Send in Gmail Web" button.'
      );
      if (!proceedSimulation) {
        setShowAppPasswordGuide(true);
        return;
      }
    }

    setIsSendingSmtp(true);
    try {
      // Save current credentials to service
      const updatedConfig: SmtpClientConfig = {
        ...config,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: senderGmail.trim(),
        password: appPassword.trim(),
        senderAddress: senderGmail.trim(),
        senderName: senderName.trim(),
        provider: 'gmail'
      };
      mailService.saveConfig(updatedConfig);
      setConfig(updatedConfig);

      const deliveryMethod = appPassword.trim() ? 'real_smtp' : 'simulation';

      const newEmail = await mailService.sendCustomEmail({
        fromEmail: senderGmail.trim(),
        fromName: senderName.trim(),
        toEmail: staffGmail.trim(),
        toName: staffRecipientName.trim() || staffGmail.split('@')[0],
        subject: composeTaskTitle.trim(),
        messageBody: composeInstructions.trim(),
        priority: composePriority,
        dueDate: composeDueDate,
        deliveryMethod,
        customConfig: updatedConfig
      });

      const updated = mailService.getEmailLogs();
      setEmails(updated);
      setSelectedEmailId(newEmail.id);
      setSubTab('outbox');

      if (deliveryMethod === 'real_smtp') {
        showToast(`Email dispatched directly through Gmail SMTP to ${staffGmail}!`, 'success');
      } else {
        showToast(`Dispatched to staff Gmail ${staffGmail} (Simulated RFC 5321)!`, 'success');
      }
    } catch (err: any) {
      showToast('SMTP Dispatch Error: ' + err.message, 'error');
    } finally {
      setIsSendingSmtp(false);
    }
  };

  // Action 2: 1-Click Open & Send in Gmail Web Client
  const handleOpenInGmailWeb = async () => {
    if (!staffGmail.trim() || !staffGmail.includes('@')) {
      showToast('Please enter a valid Staff Gmail address (Filled by you)', 'error');
      return;
    }

    const subject = `[HRMS Directive] ${composeTaskTitle.trim()}`;
    const body = `Hello ${staffRecipientName.trim() || 'Team Member'},\n\n` +
      `You have been assigned a task directive by ${senderName} (${senderGmail}).\n\n` +
      `DIRECTIVE: ${composeTaskTitle}\n` +
      `PRIORITY: ${composePriority.toUpperCase()}\n` +
      `DUE DATE: ${composeDueDate}\n\n` +
      `INSTRUCTIONS:\n${composeInstructions}\n\n` +
      `Please log in to your HRMS portal to update progress.\n\n` +
      `--\n${senderName}\n${senderGmail}`;

    const gmailWebUrl = createGmailComposeUrl({
      to: staffGmail.trim(),
      subject,
      body
    });

    // Also record the email in the Outbox
    try {
      const emailRecord = await mailService.sendCustomEmail({
        fromEmail: senderGmail.trim(),
        fromName: senderName.trim(),
        toEmail: staffGmail.trim(),
        toName: staffRecipientName.trim() || staffGmail.split('@')[0],
        subject: composeTaskTitle.trim(),
        messageBody: composeInstructions.trim(),
        priority: composePriority,
        dueDate: composeDueDate,
        deliveryMethod: 'gmail_web'
      });
      const updated = mailService.getEmailLogs();
      setEmails(updated);
      setSelectedEmailId(emailRecord.id);
    } catch (e) {
      console.warn('Could not record outbox log for web compose:', e);
    }

    // Open Gmail web compose in a new window/tab
    window.open(gmailWebUrl, '_blank', 'noopener,noreferrer');
    showToast(`Opened Google Mail compose window for ${staffGmail}!`, 'success');
  };

  // Action 3: Open in Default Mail Client (mailto:)
  const handleOpenMailto = () => {
    if (!staffGmail.trim() || !staffGmail.includes('@')) {
      showToast('Please enter a valid Staff Gmail address', 'error');
      return;
    }
    const subject = `[HRMS Directive] ${composeTaskTitle.trim()}`;
    const body = `${composeInstructions}\n\nDue Date: ${composeDueDate}\nPriority: ${composePriority}\nFrom: ${senderName} (${senderGmail})`;
    window.location.href = createMailtoUrl({
      to: staffGmail.trim(),
      subject,
      body
    });
    showToast(`Triggered native mail compose for ${staffGmail}!`, 'info');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    mailService.saveConfig(config);
    setSenderGmail(config.senderAddress);
    setSenderName(config.senderName);
    setAppPassword(config.password || '');
    showToast('SMTP Gateway configuration saved successfully!', 'success');
  };

  const handleApplyPreset = (preset: 'gmail' | 'internal' | 'custom') => {
    if (preset === 'gmail') {
      const gmailCfg: SmtpClientConfig = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: senderGmail || '',
        password: appPassword,
        senderAddress: senderGmail || '',
        senderName: senderName || 'HR Administration',
        provider: 'gmail'
      };
      setConfig(gmailCfg);
      mailService.saveConfig(gmailCfg);
      showToast('Applied Google Gmail SMTP preset (smtp.gmail.com:465 SSL)!', 'success');
    } else if (preset === 'internal') {
      const intCfg: SmtpClientConfig = {
        host: 'smtp.hrms.internal',
        port: 587,
        secure: true,
        user: 'mailer@hrms.demo',
        password: '',
        senderAddress: 'notifications@hrms.demo',
        senderName: 'HRMS Notification Daemon',
        provider: 'simulation'
      };
      setConfig(intCfg);
      mailService.saveConfig(intCfg);
      showToast('Applied Internal Simulated SMTP relay preset.', 'info');
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    try {
      const res = await mailService.testConnection(config);
      setTestResult(res);
      showToast(
        res.isReal
          ? 'Live Google SMTP credentials verified (220 Ready)!'
          : 'Simulated socket handshake successful!',
        'success'
      );
    } catch (err: any) {
      showToast('Connection test failed: ' + err.message, 'error');
    } finally {
      setIsTestingConn(false);
    }
  };

  // Filtered emails
  const filteredEmails = emails.filter((mail) => {
    const matchesSearch =
      mail.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mail.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mail.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mail.senderEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mail.taskId && mail.taskId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || mail.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || mail.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || filteredEmails[0] || null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-bold shadow-md transition-all animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-indigo-50 border-indigo-300 text-indigo-900'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-4 cursor-pointer font-extrabold text-sm"
          >
            &times;
          </button>
        </div>
      )}

      {/* Hero Header Ribbon */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-indigo-500/15 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md border border-indigo-400/30">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    Direct Gmail &amp; SMTP Outbox Gateway
                  </h1>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Gmail Ready
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Send customized emails directly from <strong>your filled Gmail</strong> to <strong>staff Gmail addresses</strong> with real SMTP transmission, 1-click Google Mail Web compose, and full RFC 5321 protocol stream logging.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSubTab('compose')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm ${
                subTab === 'compose'
                  ? 'bg-indigo-600 text-white shadow-indigo-500/25'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-indigo-300" />
              <span>Send Gmail to Staff</span>
            </button>
            <button
              onClick={() => setSubTab('outbox')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                subTab === 'outbox'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Outbox ({emails.length})</span>
            </button>
            <button
              onClick={() => setSubTab('settings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer ${
                subTab === 'settings'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>SMTP Settings</span>
            </button>
          </div>
        </div>

        {/* Live Identity Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Your Sender Gmail</span>
              <div className="text-xs font-mono font-bold text-white mt-0.5 truncate max-w-[200px]">
                {senderGmail}
              </div>
            </div>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded font-bold">
              Customized
            </span>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active Staff Recipient</span>
              <div className="text-xs font-mono font-bold text-emerald-300 mt-0.5 truncate max-w-[200px]">
                {staffGmail}
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded font-bold">
              Target Staff
            </span>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Gateway Transport</span>
              <div className="text-xs font-mono font-bold text-indigo-300 mt-0.5">
                smtp.gmail.com:465 (SSL)
              </div>
            </div>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
              TLSv1.3
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-2xs">
        <button
          onClick={() => setSubTab('compose')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'compose'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>1. Compose &amp; Send to Staff Gmail</span>
        </button>
        <button
          onClick={() => setSubTab('outbox')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'outbox'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>2. SMTP Outbox Queue ({emails.length})</span>
        </button>
        <button
          onClick={() => setSubTab('settings')}
          className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            subTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>3. SMTP Credentials &amp; Presets</span>
        </button>
      </div>

      {/* SUBTAB 1: COMPOSE & SEND TO STAFF GMAIL */}
      {subTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-7 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Send className="w-5 h-5 text-indigo-600" />
                    <span>Send from Customized Gmail to Staff Gmail</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fill in both your custom Gmail sender identity and the staff member&apos;s custom Gmail address.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Templates:</span>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('directive')}
                    className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Directive
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('performance')}
                    className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadTemplate('urgent')}
                    className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Urgent
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendViaGmailSmtp} className="space-y-6">
                {/* SECTION A: SENDER GMAIL (FILLED BY USER) */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600" />
                      <span>Step 1: Your Sender Identity (Filled by You)</span>
                    </span>
                    <span className="text-[11px] text-indigo-600 font-bold bg-white px-2 py-0.5 rounded border border-indigo-200">
                      From: Header
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Your Sender Gmail Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={senderGmail}
                        onChange={(e) => setSenderGmail(e.target.value)}
                        placeholder="e.g. yourname@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Sender Display Name
                      </label>
                      <input
                        type="text"
                        required
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="e.g. Udbhav Singh (HR Director)"
                        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Google App Password (Optional for Web Compose, required for background SMTP) */}
                  <div className="pt-2 border-t border-indigo-100/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Google App Password (For Real Background SMTP)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAppPasswordGuide(!showAppPasswordGuide)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{showAppPasswordGuide ? 'Hide instructions' : 'How to get 16-char password?'}</span>
                        {showAppPasswordGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={appPassword}
                          onChange={(e) => setAppPassword(e.target.value)}
                          placeholder="e.g. abcd efgh ijkl mnop (16 letters)"
                          className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleVerifyGoogleSmtp}
                        disabled={isVerifyingGoogleSmtp || !appPassword.trim()}
                        className="px-3 py-2 bg-white hover:bg-indigo-100 border border-indigo-300 disabled:opacity-40 text-indigo-700 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-2xs"
                        title="Verify App Password with Google SMTP servers"
                      >
                        <ShieldCheck className={`w-3.5 h-3.5 ${isVerifyingGoogleSmtp ? 'animate-spin' : ''}`} />
                        <span>{isVerifyingGoogleSmtp ? 'Verifying...' : 'Test Password'}</span>
                      </button>
                    </div>

                    {showAppPasswordGuide && (
                      <div className="mt-3 bg-white p-3.5 rounded-lg border border-indigo-200 text-xs text-slate-600 space-y-2 animate-fade-in">
                        <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-indigo-600" />
                          <span>Generating your 16-character Google App Password (Takes 30 seconds):</span>
                        </div>
                        <ol className="list-decimal pl-5 space-y-1 text-[11px] leading-relaxed">
                          <li>Go to your <strong>Google Account</strong> (<a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">myaccount.google.com/security</a>).</li>
                          <li>Under <strong>How you sign in to Google</strong>, ensure <strong>2-Step Verification</strong> is ON.</li>
                          <li>Search or click <strong>App passwords</strong> (<a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">myaccount.google.com/apppasswords</a>).</li>
                          <li>Enter app name (e.g. <code>HRMS Mailer</code>) and click <strong>Create</strong>. Paste the 16 letters above.</li>
                        </ol>
                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                          <em>Tip: If you do not have an App Password right now, you can still click <strong>&quot;Open &amp; Send in Gmail Web&quot;</strong> below to send in 1 click directly from your logged-in Google account!</em>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION B: RECIPIENT STAFF GMAIL (FILLED BY USER) */}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-600" />
                      <span>Step 2: Staff Recipient Gmail (Filled by You)</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                      To: Header
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Quick Pick from Staff Roster (Or Enter Custom Staff Below)
                    </label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => handleStaffSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="custom">✏️ Type Custom Staff Name &amp; Gmail Address Directly</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role.toUpperCase()} - {emp.department}) &bull; {emp.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Staff Gmail Address (Filled by You) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={staffGmail}
                        onChange={(e) => setStaffGmail(e.target.value)}
                        placeholder="e.g. staff.member@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Staff Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={staffRecipientName}
                        onChange={(e) => setStaffRecipientName(e.target.value)}
                        placeholder="e.g. Rohan Verma"
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setStaffGmail(senderGmail)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                    >
                      Use my own Gmail as recipient for a quick self-test
                    </button>
                  </div>
                </div>

                {/* SECTION C: EMAIL CONTENT & DIRECTIVE */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Subject Line <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={composeTaskTitle}
                      onChange={(e) => setComposeTaskTitle(e.target.value)}
                      placeholder="e.g. Production Infrastructure Health Audit & Security Review"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Priority Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['high', 'medium', 'low'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setComposePriority(p)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer border ${
                              composePriority === p
                                ? p === 'high'
                                  ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs'
                                  : p === 'medium'
                                  ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-xs'
                                  : 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Due Date
                      </label>
                      <input
                        type="date"
                        required
                        value={composeDueDate}
                        onChange={(e) => setComposeDueDate(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Instructions &amp; Directive Body <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={composeInstructions}
                      onChange={(e) => setComposeInstructions(e.target.value)}
                      placeholder="Specify deliverables, milestones, access tokens, or instructions..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white leading-relaxed"
                    />
                  </div>
                </div>

                {/* DUAL ACTION DISPATCH TOOLBAR */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Primary Button 1: Real SMTP Direct Send */}
                    <button
                      type="submit"
                      disabled={isSendingSmtp}
                      className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      <Zap className={`w-4 h-4 text-indigo-200 ${isSendingSmtp ? 'animate-spin' : ''}`} />
                      <span>{isSendingSmtp ? 'Transmitting via Gmail SMTP...' : 'Send via Gmail SMTP (Direct to Staff Inbox)'}</span>
                    </button>

                    {/* Primary Button 2: 1-Click Open in Gmail Web */}
                    <button
                      type="button"
                      onClick={handleOpenInGmailWeb}
                      className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                      title="Instantly opens your personal Gmail with To, Subject, and Body ready to send"
                    >
                      <Globe className="w-4 h-4 text-emerald-200" />
                      <span>Open &amp; Send in Gmail Web (1-Click)</span>
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1 text-slate-500">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Every sent message is archived in your <strong>SMTP Outbox</strong> with complete RFC 5321 protocol logs.
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenMailto}
                      className="text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    >
                      Send via Default Mail Client (mailto:)
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Rail: Live Preview & Delivery Overview */}
          <div className="space-y-6">
            {/* Live Message Envelope Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span>Outbound Envelope Preview</span>
                </span>
                <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded font-bold">
                  RFC 5321
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">MAIL FROM (Sender)</div>
                  <div className="text-sky-300 font-bold truncate">
                    &lt;{senderGmail || 'your.gmail@gmail.com'}&gt;
                  </div>
                  <div className="text-[10px] text-slate-400">Name: {senderName}</div>
                </div>

                <div className="flex justify-center text-slate-600">
                  &darr;
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">RCPT TO (Staff Recipient)</div>
                  <div className="text-emerald-300 font-bold truncate">
                    &lt;{staffGmail || 'staff.gmail@gmail.com'}&gt;
                  </div>
                  <div className="text-[10px] text-slate-400">Staff: {staffRecipientName}</div>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 text-slate-300 text-[11px]">
                  <div><strong className="text-slate-400">Subject:</strong> {composeTaskTitle || '(No subject)'}</div>
                  <div><strong className="text-slate-400">Priority:</strong> {composePriority.toUpperCase()}</div>
                  <div><strong className="text-slate-400">Due:</strong> {composeDueDate}</div>
                  <div><strong className="text-slate-400">Transport:</strong> smtp.gmail.com:465 (SSL)</div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800">
                Transfers MIME multipart (Plaintext + HTML responsive card) directly into Google Mail servers.
              </div>
            </div>

            {/* Quick Action Guide */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>How This Works</span>
              </h3>
              <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-indigo-600">&bull;</span>
                  <span><strong>Sender Gmail (Filled by you):</strong> You define the exact Gmail address and display name seen by staff.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600">&bull;</span>
                  <span><strong>Staff Gmail (Filled by you):</strong> You can select any employee or type any custom Gmail address in real time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-600">&bull;</span>
                  <span><strong>Delivery Options:</strong> Choose <em>Send via Gmail SMTP</em> for backend delivery or <em>Open in Gmail Web</em> for 1-click personal dispatch.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: OUTBOX QUEUE & INSPECTOR */}
      {subTab === 'outbox' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[620px]">
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center flex-1 min-w-[240px] max-w-md bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search by sender Gmail, staff Gmail, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-1 cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered (250 OK)</option>
                  <option value="queued">Queued</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-500">Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <button
                onClick={refreshList}
                className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="Refresh outbox list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleClearAll}
                disabled={emails.length === 0}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 disabled:opacity-40 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Outbox</span>
              </button>
            </div>
          </div>

          {/* Master-Detail Split Pane */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0">
            {/* Left: Email List (5 cols) */}
            <div className="md:col-span-5 border-r border-slate-200 overflow-y-auto max-h-[640px] divide-y divide-slate-100">
              {filteredEmails.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-xs">No email records match your filter</p>
                  <button
                    onClick={() => setSubTab('compose')}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-bold underline cursor-pointer"
                  >
                    Compose a new email &rarr;
                  </button>
                </div>
              ) : (
                filteredEmails.map((mail) => {
                  const isSelected = mail.id === selectedEmailId;
                  const isGmailDelivery = mail.deliveryMethod === 'real_smtp' || mail.smtpHost.includes('gmail');
                  const isWebCompose = mail.deliveryMethod === 'gmail_web';

                  return (
                    <div
                      key={mail.id}
                      onClick={() => setSelectedEmailId(mail.id)}
                      className={`p-4 transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-indigo-50/70 border-l-4 border-indigo-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              mail.status === 'delivered'
                                ? 'bg-emerald-500'
                                : mail.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span className="font-bold text-xs text-slate-900 truncate">
                            To: {mail.recipientName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(mail.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Staff Gmail recipient badge */}
                      <div className="text-[11px] font-mono text-emerald-700 truncate font-semibold mb-1">
                        &rarr; {mail.recipientEmail}
                      </div>

                      <div className="text-xs font-medium text-slate-700 line-clamp-1 mb-2">
                        {mail.subject}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-1">
                        <span className="font-mono truncate max-w-[150px] text-slate-400">
                          From: {mail.senderEmail}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isWebCompose ? (
                            <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-blue-100 text-blue-800">
                              Gmail Web
                            </span>
                          ) : isGmailDelivery ? (
                            <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-emerald-100 text-emerald-800">
                              Gmail SMTP
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded font-bold uppercase bg-slate-100 text-slate-700">
                              RFC 5321
                            </span>
                          )}

                          <button
                            onClick={(e) => handleDeleteSingle(mail.id, e)}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                            title="Delete this outbox log"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: Email Detail & Protocol Inspector (7 cols) */}
            <div className="md:col-span-7 flex flex-col bg-slate-50/50 overflow-hidden">
              {selectedEmail ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Detail Header Ribbon */}
                  <div className="p-4 sm:p-5 bg-white border-b border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                            {selectedEmail.messageId}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              selectedEmail.priority === 'high'
                                ? 'bg-rose-100 text-rose-800'
                                : selectedEmail.priority === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {selectedEmail.priority || 'medium'} priority
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Delivered (250 OK)
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1.5 tracking-tight">
                          {selectedEmail.subject}
                        </h3>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Open in Gmail Web button */}
                        <a
                          href={createGmailComposeUrl({
                            to: selectedEmail.recipientEmail,
                            subject: selectedEmail.subject,
                            body: selectedEmail.textContent
                          })}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Open this email directly in Google Mail"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Open in Gmail</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          onClick={() => handleResend(selectedEmail.id)}
                          disabled={isResending}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          title="Resend this message via SMTP"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                          <span>Resend</span>
                        </button>
                      </div>
                    </div>

                    {/* Sender and Recipient Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">From (Custom Sender):</span>
                        <div className="font-bold text-slate-800 truncate">
                          {selectedEmail.senderName || 'HR Management'} &bull; <span className="font-mono text-indigo-700">{selectedEmail.senderEmail}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">To (Staff Gmail):</span>
                        <div className="font-bold text-slate-800 truncate">
                          {selectedEmail.recipientName} &bull; <span className="font-mono text-emerald-700">{selectedEmail.recipientEmail}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sub-view switcher */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
                      <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                        <button
                          onClick={() => setDetailMode('preview')}
                          className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                            detailMode === 'preview'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Rendered HTML Card</span>
                        </button>
                        <button
                          onClick={() => setDetailMode('smtp_logs')}
                          className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                            detailMode === 'smtp_logs'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                          <span>RFC 5321 Protocol Stream</span>
                        </button>
                        <button
                          onClick={() => setDetailMode('plain_text')}
                          className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                            detailMode === 'plain_text'
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Plaintext</span>
                        </button>
                        <button
                          onClick={() => setDetailMode('headers')}
                          className={`px-3 py-1 text-xs font-bold rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                            detailMode === 'headers'
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Envelope Headers</span>
                        </button>
                      </div>

                      {detailMode === 'smtp_logs' && (
                        <button
                          onClick={() => handleCopyLogs(selectedEmail.smtpLogs)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
                        >
                          {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                          <span>{copiedLogs ? 'Copied' : 'Copy Protocol Logs'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mode 1: Rendered HTML Email Preview */}
                  {detailMode === 'preview' && (
                    <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/70 flex justify-center">
                      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        <div
                          className="p-1"
                          dangerouslySetInnerHTML={{
                            __html: selectedEmail.htmlContent.replace(
                              /href="(\?tab=[^"]+)"/g,
                              'href="javascript:void(0)" onclick="window.__hrmsNavigate && window.__hrmsNavigate(\'$1\')"'
                            )
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Mode 2: SMTP Handshake Protocol Stream */}
                  {detailMode === 'smtp_logs' && (
                    <div className="flex-1 overflow-auto p-5 bg-slate-950 font-mono text-xs text-indigo-200 space-y-1.5 select-text">
                      <div className="text-[11px] text-slate-400 pb-2 border-b border-slate-800 mb-3 flex items-center justify-between">
                        <span>RFC 5321 SMTP Client Connection &amp; Transaction Handshake Stream</span>
                        <span className="text-emerald-400 font-bold">250 OK Delivered</span>
                      </div>
                      {selectedEmail.smtpLogs.map((line, idx) => {
                        const isClient = line.includes('-->');
                        const isServer = line.includes('<--');
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
                      <div className="pt-4 border-t border-slate-800 text-emerald-400 font-bold flex items-center gap-2 mt-4">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{selectedEmail.smtpResponse}</span>
                      </div>
                    </div>
                  )}

                  {/* Mode 3: Plaintext MIME */}
                  {detailMode === 'plain_text' && (
                    <div className="flex-1 overflow-auto p-6 bg-slate-900 font-mono text-xs text-slate-200 select-text whitespace-pre-wrap leading-relaxed">
                      {selectedEmail.textContent}
                    </div>
                  )}

                  {/* Mode 4: Envelope Headers */}
                  {detailMode === 'headers' && (
                    <div className="flex-1 overflow-auto p-6 bg-slate-50 font-mono text-xs text-slate-700 space-y-3">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                        <div><strong className="text-slate-900">Message-ID:</strong> {selectedEmail.messageId}</div>
                        <div><strong className="text-slate-900">Date:</strong> {selectedEmail.sentAt}</div>
                        <div><strong className="text-slate-900">From:</strong> &quot;{selectedEmail.senderName || 'HR Management'}&quot; &lt;{selectedEmail.senderEmail}&gt;</div>
                        <div><strong className="text-slate-900">To:</strong> &quot;{selectedEmail.recipientName}&quot; &lt;{selectedEmail.recipientEmail}&gt;</div>
                        <div><strong className="text-slate-900">Subject:</strong> {selectedEmail.subject}</div>
                        <div><strong className="text-slate-900">MIME-Version:</strong> 1.0</div>
                        <div><strong className="text-slate-900">Content-Type:</strong> multipart/alternative; boundary=&quot;----=_NextPart_000_HRMS&quot;</div>
                        <div><strong className="text-slate-900">X-Mailer:</strong> HRMS-Gmail-SMTP-Gateway v3.0 (RFC 5321)</div>
                        <div><strong className="text-slate-900">X-Delivery-Method:</strong> {selectedEmail.deliveryMethod || 'real_smtp'}</div>
                        <div><strong className="text-slate-900">X-Relay-Host:</strong> {selectedEmail.smtpHost}:{selectedEmail.smtpPort}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <Mail className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-bold text-slate-700 text-sm">Select an email to view details</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Dispatched Gmail notifications will render here with full protocol streams, responsive cards, and headers.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SMTP GATEWAY CONFIGURATION & PRESETS */}
      {subTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>SMTP Gateway &amp; Gmail Credentials Configuration</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure Google Gmail SMTP socket parameters, sender identities, and Google App Passwords.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('gmail')}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Apply Gmail Preset
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('internal')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Simulated Preset
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  SMTP Host Address
                </label>
                <input
                  type="text"
                  required
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Port
                </label>
                <input
                  type="number"
                  required
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 465 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sender Gmail Address (From:)
                </label>
                <input
                  type="email"
                  required
                  value={config.senderAddress}
                  onChange={(e) => setConfig({ ...config, senderAddress: e.target.value, user: e.target.value })}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sender Display Name
                </label>
                <input
                  type="text"
                  required
                  value={config.senderName}
                  onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                  placeholder="Udbhav Singh (HR Director)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Google App Password (16 characters)
                </label>
                <input
                  type="password"
                  value={config.password || ''}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Security Encryption
                </label>
                <div className="flex items-center space-x-3 pt-2">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.secure}
                      onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Enforce SSL / TLS Encrypted Socket Handshake</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Test Connection Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Socket Ping &amp; Live Server Verification Diagnostics</span>
                </span>
                <p className="text-[11px] text-slate-500">
                  Tests TCP connectivity and authenticates credentials directly against {config.host}:{config.port}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConn}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Radio className={`w-3.5 h-3.5 text-indigo-400 ${isTestingConn ? 'animate-pulse' : ''}`} />
                <span>{isTestingConn ? 'Verifying Host...' : 'Test Connection'}</span>
              </button>
            </div>

            {testResult && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-indigo-200 space-y-1 animate-fade-in">
                <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800 mb-2 flex items-center justify-between">
                  <span>Diagnostic Socket Probe Logs</span>
                  <span className="text-emerald-400 font-bold">{testResult.latencyMs}ms Latency ({testResult.isReal ? 'Live Google Server' : 'Simulated'})</span>
                </div>
                {testResult.logs.map((l, i) => (
                  <div key={i} className={l.includes('220') || l.includes('250') || l.includes('235') ? 'text-emerald-400' : 'text-indigo-200'}>
                    {l}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                Save Configuration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
