"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  UserPlus, 
  Edit, 
  Trash2, 
  Lock, 
  UserCheck, 
  RefreshCw, 
  Search, 
  X, 
  AlertTriangle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { db } from '@/lib/db';
import { Profile } from '@/lib/mockData';

export default function StaffManagementDesk() {
  const router = useRouter();
  const [activeUser, setActiveUser] = useState<Profile | null>(null);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isError, setIsError] = useState(false);

  // Modals state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);

  // Forms state
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    username: '',
    role: 'clerk' as Profile['role'],
    counter_number: '',
  });

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    role: 'clerk' as Profile['role'],
    counter_number: '',
  });

  const [selectedStaffForTermination, setSelectedStaffForTermination] = useState<Profile | null>(null);

  // Load active user session & staff database
  const loadData = async () => {
    try {
      const user = await db.getActiveUser();
      setActiveUser(user);

      // Security access check: Clerks are redirected out of here immediately
      if (user && user.role !== 'manager') {
        router.replace('/dashboard');
        return;
      }

      const list = await db.getAllProfiles();
      setStaffList(list);
      setLoading(false);
    } catch (err) {
      console.error('Error loading staff details:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg('');
    setIsError(false);

    if (!onboardForm.name || !onboardForm.username || !onboardForm.counter_number) {
      setIsError(true);
      setFeedbackMsg('Error: Please populate all onboarding parameters.');
      return;
    }

    try {
      await db.createStaffProfile({
        name: onboardForm.name,
        username: onboardForm.username,
        role: onboardForm.role,
        counter_number: onboardForm.counter_number,
      });

      // Clear Form & Close
      setOnboardForm({
        name: '',
        username: '',
        role: 'clerk',
        counter_number: '',
      });
      setIsOnboardingOpen(false);
      setFeedbackMsg('Success! Staff member onboarded to active registry.');
      loadData();
    } catch (err: any) {
      setIsError(true);
      setFeedbackMsg(`Error: ${err.message || 'Failed to onboard staff.'}`);
    } finally {
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg('');
    setIsError(false);

    try {
      await db.updateStaffProfileDetails(editForm.id, {
        role: editForm.role,
        counter_number: editForm.counter_number,
      });

      setIsEditOpen(false);
      setFeedbackMsg(`Success! Updated positions and desk logs for ${editForm.name}.`);
      loadData();
    } catch (err: any) {
      setIsError(true);
      setFeedbackMsg(`Error: ${err.message || 'Failed to update details.'}`);
    } finally {
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const handleTerminateConfirm = async () => {
    if (!selectedStaffForTermination) return;
    setFeedbackMsg('');
    setIsError(false);

    try {
      await db.deleteStaffProfile(selectedStaffForTermination.id);
      setIsTerminateOpen(false);
      setFeedbackMsg(`Success! Access revoked for employee ${selectedStaffForTermination.name}.`);
      setSelectedStaffForTermination(null);
      loadData();
    } catch (err: any) {
      setIsError(true);
      setFeedbackMsg(`Error: ${err.message || 'Failed to revoke employee access.'}`);
    } finally {
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const openEditModal = (staff: Profile) => {
    setEditForm({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      counter_number: staff.counter_number || '',
    });
    setIsEditOpen(true);
  };

  const openTerminateModal = (staff: Profile) => {
    setSelectedStaffForTermination(staff);
    setIsTerminateOpen(true);
  };

  // Filter staff based on query
  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.counter_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If loading or if activeUser is Clerk, render a loading/blocked screen
  if (loading || (activeUser && activeUser.role !== 'manager')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-zinc-400">Authenticating access privileges...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Administrative Controls</span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-100 tracking-tight sm:text-3xl display-font">
            Staff Workforce Management
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Audit, promote, onboard, or revoke banking access parameters for corporate employees.
          </p>
        </div>

        <button
          onClick={() => setIsOnboardingOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] hover:shadow-indigo-500/30 cursor-pointer active:scale-95 shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>+ Onboard New Staff</span>
        </button>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <div className={`p-4 rounded-xl border text-sm font-semibold ${
          isError 
            ? 'bg-red-950/20 border-red-900/50 text-red-300' 
            : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
        }`}>
          {feedbackMsg}
        </div>
      )}

      {/* Main Glass Workspace Grid */}
      <div className="glass-panel rounded-3xl overflow-hidden relative border border-zinc-900">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        
        {/* Table Toolbar */}
        <div className="p-5 border-b border-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider display-font">
              Active Bank Staff Registry ({filteredStaff.length})
            </h3>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by name, role, username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-900 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-300 placeholder-zinc-550"
            />
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] uppercase font-bold text-zinc-400 tracking-wider bg-zinc-950/25">
                <th className="px-6 py-4">Staff Name</th>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Username / Email</th>
                <th className="px-6 py-4">Assigned Position</th>
                <th className="px-6 py-4">Counter / Desk</th>
                <th className="px-6 py-4">Session Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/40 text-xs">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => (
                  <tr 
                    key={staff.id} 
                    className="hover:bg-zinc-900/10 transition-colors"
                  >
                    <td className="px-6 py-4.5 font-bold text-zinc-200">
                      {staff.name}
                    </td>
                    <td className="px-6 py-4.5 font-mono text-[10px] text-zinc-400">
                      {staff.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4.5 text-zinc-400">
                      {staff.username || 'unregistered@jrina.com'}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                        staff.role === 'manager' 
                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          : staff.role === 'clerk' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : staff.role === 'teller'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-455'
                          : staff.role === 'loan_officer'
                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      }`}>
                        {staff.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 font-semibold text-zinc-300">
                      {staff.counter_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        staff.status === 'ONLINE' ? 'text-emerald-400' : 'text-zinc-500'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          staff.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                        }`} />
                        {staff.status || 'OFFLINE'}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      {/* Safety Restriction: Manager cannot edit/delete themselves */}
                      {staff.id === activeUser?.id ? (
                        <span className="text-[10px] text-zinc-650 flex justify-end items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Self Profile
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(staff)}
                            className="p-1.5 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-all"
                            title="Edit Role & Desk"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openTerminateModal(staff)}
                            className="p-1.5 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 text-zinc-450 hover:text-red-400 rounded-lg transition-all"
                            title="Revoke Banking Access"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No active staff matching query details found in records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ONBOARD NEW STAFF */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl relative border border-zinc-900">
            <button
              onClick={() => setIsOnboardingOpen(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <UserPlus className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-200 display-font">Onboard New Employee</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Internal Registry Access</p>
              </div>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amina Al-Mansoor"
                  value={onboardForm.name}
                  onChange={(e) => setOnboardForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Corporate Username / Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. amina.almansoor@jrina.com"
                  value={onboardForm.username}
                  onChange={(e) => setOnboardForm(prev => ({ ...prev, username: e.target.value }))}
                  required
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Position Role
                  </label>
                  <select
                    value={onboardForm.role}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, role: e.target.value as Profile['role'] }))}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200 font-semibold"
                  >
                    <option value="clerk">Clerk</option>
                    <option value="teller">Teller</option>
                    <option value="loan_officer">Loan Officer</option>
                    <option value="auditor">Auditor</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Assigned Desk / Counter
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COUNTER-03"
                    value={onboardForm.counter_number}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, counter_number: e.target.value }))}
                    required
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(false)}
                  className="w-1/2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 py-3 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer shadow-[0_4px_10px_rgba(99,102,241,0.25)] transition-all"
                >
                  Confirm Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT POSITION & REASSIGN DESK */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl relative border border-zinc-900">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Edit className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-200 display-font">Modify Position Parameters</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Configure Role/Counter: {editForm.name}</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Assigned Position
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value as Profile['role'] }))}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200 font-semibold"
                  >
                    <option value="clerk">Clerk</option>
                    <option value="teller">Teller</option>
                    <option value="loan_officer">Loan Officer</option>
                    <option value="auditor">Auditor</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Assigned Counter / Desk
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COUNTER-05"
                    value={editForm.counter_number}
                    onChange={(e) => setEditForm(prev => ({ ...prev, counter_number: e.target.value }))}
                    required
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="w-1/2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 py-3 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer shadow-[0_4px_10px_rgba(16,185,129,0.25)] transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REVOKE ACCESS (TERMINATE WARNING) */}
      {isTerminateOpen && selectedStaffForTermination && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl relative border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.07)]">
            <button
              onClick={() => setIsTerminateOpen(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center p-2">
              <div className="h-12 w-12 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-455 mb-3 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                <AlertTriangle className="h-6 w-6 animate-pulse" />
              </div>
              <h4 className="text-base font-extrabold text-zinc-200 display-font uppercase tracking-wide">
                Revoke System Access?
              </h4>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-1">High-Priority Security Revocation</p>
              
              <div className="my-4 p-3 bg-zinc-950/50 border border-zinc-900/60 rounded-2xl w-full">
                <p className="text-[11px] text-zinc-300 leading-relaxed font-semibold">
                  Employee: <span className="text-zinc-100 font-extrabold">{selectedStaffForTermination.name}</span>
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  ID: {selectedStaffForTermination.id.toUpperCase()}
                </p>
              </div>

              <p className="text-xs text-zinc-450 leading-relaxed mb-6 font-semibold">
                Are you sure you want to permanently revoke all banking system access for this employee?
              </p>

              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setIsTerminateOpen(false)}
                  className="w-1/2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 py-3 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTerminateConfirm}
                  className="w-1/2 bg-red-650 hover:bg-red-600 text-white py-3 rounded-xl text-xs uppercase font-bold tracking-wider cursor-pointer shadow-[0_4px_10px_rgba(239,68,68,0.25)] transition-all"
                >
                  Revoke & Purge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
