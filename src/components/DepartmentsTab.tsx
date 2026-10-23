import React, { useState } from 'react';
import { Department, Employee } from '../types';
import { Plus, Edit2, Check, X, ShieldAlert, Trash2 } from 'lucide-react';

interface DepartmentsTabProps {
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  activeUser: Employee;
  employees?: Employee[];
  setEmployees?: React.Dispatch<React.SetStateAction<Employee[]>>;
}

export function DepartmentsTab({ departments, setDepartments, activeUser, employees, setEmployees }: DepartmentsTabProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // New Department fields
  const [name, setName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [description, setDescription] = useState('');

  // Submit new department
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalName = name.trim();
    const finalManagerName = managerName.trim() || 'Not Assigned';

    const newDept: Department = {
      id: `DEPT-0${departments.length + 1}`,
      name: finalName,
      managerName: finalManagerName,
      description: description.trim() || 'No description provided'
    };

    setDepartments(prev => [...prev, newDept]);

    // Automatically create a Head Of Department employee profile
    if (setEmployees) {
      const hodName = finalManagerName !== 'Not Assigned' ? finalManagerName : `Head of ${finalName}`;
      const emailPrefix = finalName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueSuffix = Date.now().toString().slice(-4);
      
      const nextNum = Math.max(...(employees || []).map(emp => {
        const m = emp.id.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      }), 0) + 1;
      const nextId = `EMP-${String(nextNum).padStart(3, '0')}`;

      const newHod: Employee = {
        id: nextId,
        name: hodName,
        email: `head.${emailPrefix}.${uniqueSuffix}@gmail.com`,
        role: 'head of department',
        department: finalName,
        phone: '',
        address: 'Corporate Headquarters',
        emergencyContact: '',
        salary: 'INR 95,000',
        joinDate: new Date().toISOString().split('T')[0],
        avatarColor: 'bg-indigo-600 text-white',
        status: 'active',
        jobTitle: `Head of ${finalName}`,
        password: 'head123'
      };

      setEmployees(prev => {
        const updated = [...prev, newHod];
        return updated;
      });
    }

    setName('');
    setManagerName('');
    setDescription('');
    setIsAdding(false);
  };

  // Submit edit department
  const handleEditSubmit = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    const trimmedName = (editingDept.name || '').trim();
    if (!trimmedName) {
      setEditError('Department name cannot be empty.');
      return;
    }

    const isDuplicate = departments.some(
      d => d.id !== editingDept.id && d.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setEditError(`A department with name "${trimmedName}" already exists.`);
      return;
    }

    const original = departments.find(d => d.id === editingDept.id);
    const oldName = original ? original.name : '';
    const newName = trimmedName;
    const updatedDept: Department = {
      ...editingDept,
      name: newName,
      managerName: (editingDept.managerName || '').trim() || 'Not Assigned',
      description: (editingDept.description || '').trim() || 'No description provided'
    };

    setDepartments(prev =>
      prev.map(dept => (dept.id === editingDept.id ? updatedDept : dept))
    );

    if (oldName && oldName !== newName && setEmployees) {
      setEmployees(prev => prev.map(emp => emp.department === oldName ? { ...emp, department: newName } : emp));
    }

    setToastMsg(`✓ Successfully saved changes to department "${newName}"!`);
    setTimeout(() => setToastMsg(null), 4000);
    setEditError(null);
    setEditingDept(null);
  };

  const handleDeleteDepartment = (dept: Department) => {
    if (window.confirm(`Are you sure you want to delete the department "${dept.name}"?`)) {
      setDepartments(prev => prev.filter(d => d.id !== dept.id));
      if (setEmployees) {
        setEmployees(prev => prev.map(emp => emp.department === dept.name ? { ...emp, department: 'Unassigned' } : emp));
      }
    }
  };

  const isAuthorized = ['admin', 'manager', 'hr'].includes(activeUser.role);

  if (!isAuthorized) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-800 flex flex-col items-center">
        <ShieldAlert className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="font-extrabold text-sm uppercase tracking-wider">Access Restricted</h3>
        <p className="text-xs mt-1">Only Administrators, Human Resources, and Team Managers are permitted to edit or add departments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-between animate-fade-in shadow-xs">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer">×</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Department Administration</h2>
          <p className="text-slate-500 text-xs mt-1">Configure and assign heads to active business departments.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Department
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubmit} className="bg-white border border-indigo-100 p-6 rounded-xl shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">New Department Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Department Name</label>
              <input
                type="text"
                required
                placeholder="Enter Department Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Assigned Department Head / Manager</label>
              <input
                type="text"
                placeholder="Enter Department Head Name"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Brief Description</label>
            <textarea
              placeholder="Describe the department's focus..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              Save Department
            </button>
          </div>
        </form>
      )}

      {/* Editing State Modal/Inline Form */}
      {editingDept && (
        <form onSubmit={handleEditSubmit} className="bg-white border-2 border-amber-300 p-6 rounded-xl shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-amber-100">
            <h3 className="font-extrabold text-amber-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modify Department: {editingDept.name}</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{editingDept.id}</span>
          </div>

          {editError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-bold flex items-center justify-between">
              <span>{editError}</span>
              <button type="button" onClick={() => setEditError(null)} className="text-rose-500 hover:text-rose-800">×</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Department Name *</label>
              <input
                type="text"
                required
                value={editingDept.name}
                onChange={(e) => {
                  setEditingDept({ ...editingDept, name: e.target.value });
                  if (editError) setEditError(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-semibold text-slate-900"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Assigned Manager</label>
              <input
                type="text"
                value={editingDept.managerName || ''}
                onChange={(e) => setEditingDept({ ...editingDept, managerName: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">Description</label>
            <textarea
              value={editingDept.description || ''}
              onChange={(e) => setEditingDept({ ...editingDept, description: e.target.value })}
              rows={2}
              placeholder="Department purpose and scope"
              className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setEditingDept(null);
                setEditError(null);
              }}
              className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 cursor-pointer shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* Grid List */}
      {departments.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center shadow-xs">
          <p className="text-slate-600 font-bold text-sm">No departments registered</p>
          <p className="text-slate-400 text-xs mt-1">All default departments have been removed. Click "Add Department" above to create a department.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <div key={dept.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">{dept.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{dept.id}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingDept(dept)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer p-1"
                    title="Edit Department"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteDepartment(dept)}
                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1"
                    title="Delete Department"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Department Head:</span>
                  <span className="text-slate-800 font-bold">{dept.managerName}</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed mt-2 italic">
                  {dept.description || 'No description provided.'}
                </p>
              </div>

              {(() => {
                const deptMembers = (employees || []).filter(
                  e => (e.department || '').toLowerCase().trim() === (dept.name || '').toLowerCase().trim()
                );
                return (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-500 uppercase tracking-tight">
                        Assigned Staff ({deptMembers.length}):
                      </span>
                    </div>
                    {deptMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {deptMembers.map(m => (
                          <span
                            key={m.id}
                            className="inline-flex items-center text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200 transition-colors"
                            title={`${m.name} (${m.id}) - ${m.jobTitle || m.role}`}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No staff currently assigned</p>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
