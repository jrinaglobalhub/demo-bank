"use client";

import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  X, 
  Calendar, 
  Smartphone, 
  User, 
  Laptop,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { db } from '@/lib/db';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { BiometricCredential, Profile } from '@/lib/mockData';
import BiometricScanner from '@/components/BiometricScanner';

export default function BiometricPage() {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [credentials, setCredentials] = useState<BiometricCredential[]>([]);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Editing Biometrics states
  const [selectedEditCred, setSelectedEditCred] = useState<BiometricCredential | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState<BiometricCredential['status']>('PENDING_APPROVAL');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] = useState('');

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditCred) return;

    setEditSubmitting(true);
    setEditFeedback('');

    try {
      if (!editName.trim()) {
        throw new Error('Credential name is required.');
      }
      
      await db.updateBiometric(selectedEditCred.id, {
        credential_name: editName,
        status: editStatus
      });

      setEditFeedback('Credential updated successfully!');
      loadData();
      setTimeout(() => {
        setSelectedEditCred(null);
        setEditFeedback('');
      }, 1500);
    } catch (err: any) {
      setEditFeedback(`Error: ${err.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const loadData = async () => {
    try {
      const prof = await db.getActiveUser();
      setCurrentProfile(prof);

      const list = await db.getBiometricCredentials();
      setCredentials(list);
    } catch (err) {
      console.error('Error loading biometric data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('biometric_credentials').update({ status: 'APPROVED' }).eq('id', id);
        if (error) throw new Error(error.message);
      }
      await db.approveBiometric(id);
      setFeedbackMsg('Credential successfully APPROVED and activated.');
      loadData();
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err: any) {
      setFeedbackMsg(`Error: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('biometric_credentials').update({ status: 'REJECTED' }).eq('id', id);
        if (error) throw new Error(error.message);
      }
      await db.rejectBiometric(id);
      setFeedbackMsg('Credential successfully REJECTED and blocked.');
      loadData();
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err: any) {
      setFeedbackMsg(`Error: ${err.message}`);
    }
  };

  const pendingCreds = credentials.filter(c => c.status === 'PENDING_APPROVAL');
  const activeCreds = credentials.filter(c => c.status !== 'PENDING_APPROVAL');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100 display-font">Biometric & Terminal Key Desk</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Enroll secure workstation credentials and manage employee hardware approvals.</p>
        </div>
        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 rounded-xl">
          <Fingerprint className="h-4 w-4" />
          FIDO2/WebAuthn Simulation Active
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 rounded-xl border text-sm font-semibold bg-indigo-950/20 border-indigo-900/50 text-indigo-300">
          {feedbackMsg}
        </div>
      )}

      {/* TWO SECTIONS: ENROLLMENT DECK & ADMIN APPROVALS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT SECTION: WORKSTATION ENROLLMENT CONTAINER */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none" />

            <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Security Registration
            </span>

            <h3 className="text-lg font-bold text-zinc-100 display-font">Workstation Key Enrollment</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-6 leading-relaxed">
              Register a hardware credential for this terminal. Registered keys default to <strong className="text-amber-400">PENDING_APPROVAL</strong> and must be validated by a Manager before you can use them to log in.
            </p>

            {showEnrollmentModal ? (
              <div className="border border-zinc-900 rounded-2xl p-2 bg-zinc-950/50">
                <BiometricScanner
                  mode="enroll"
                  onSuccess={() => {
                    setShowEnrollmentModal(false);
                    setFeedbackMsg('Biometric registration sent for Admin approval!');
                    loadData();
                    setTimeout(() => setFeedbackMsg(''), 4000);
                  }}
                  onCancel={() => setShowEnrollmentModal(false)}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowEnrollmentModal(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] hover:shadow-indigo-500/35 cursor-pointer active:scale-95"
              >
                <Fingerprint className="h-4.5 w-4.5" />
                Register Biometric Fingerprint
              </button>
            )}
          </div>

          {/* Quick instructions */}
          <div className="glass-panel p-5 rounded-2xl border border-zinc-900 text-xs text-zinc-400 space-y-2">
            <h4 className="font-bold text-zinc-300">Biometric Verification Policies:</h4>
            <p>1. Tellers can register biometric workstations from their console.</p>
            <p>2. Hardware tokens remain strictly locked until a Branch Manager clicks "APPROVE".</p>
            <p>3. Blocked or rejected keys immediately trigger a security audit event.</p>
          </div>
        </div>

        {/* RIGHT SECTION: ADMIN APPROVAL PANEL & KEY LEDGERS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* MANAGER PORTAL (Admin-Approved workflow) */}
          {currentProfile?.role?.toLowerCase() === 'manager' ? (
            <div className="glass-panel p-6 rounded-3xl border border-indigo-500/15 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 75%) pointer-events-none" />
              
              <div className="flex justify-between items-center mb-6 border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400 animate-pulse" />
                  <h3 className="text-lg font-bold text-zinc-100 display-font">Manager Security Panel</h3>
                </div>
                <span className="text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded text-indigo-300">
                  {pendingCreds.length} Pending Approval
                </span>
              </div>

              {/* LIST PENDING REGISTRATIONS */}
              <div className="space-y-4">
                {pendingCreds.map((cred) => (
                  <div 
                    key={cred.id} 
                    className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-zinc-400" />
                        <h4 className="text-sm font-bold text-zinc-200">{cred.credential_name}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-zinc-600" />
                          {cred.employee_name} ({cred.employee_role?.toUpperCase()})
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(cred.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* APPROVAL CONTROLS */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(cred.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-[0_4px_10px_rgba(16,185,129,0.15)] active:scale-95"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(cred.id)}
                        className="bg-red-950 hover:bg-red-900 border border-red-900/30 text-red-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}

                {pendingCreds.length === 0 && (
                  <div className="text-center py-6 text-xs text-zinc-500">
                    No pending biometric security key registrations.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Restricted Info */
            <div className="glass-panel p-6 rounded-3xl border border-zinc-900 flex items-center gap-4 bg-zinc-950/40">
              <ShieldAlert className="h-10 w-10 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-zinc-200">Manager Access Restricted</h4>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  The Admin Approval Dashboard is hidden. Log in as 'Sarah Jenkins [Manager]' to view employee security key requests and toggle hardware approvals.
                </p>
              </div>
            </div>
          )}

          {/* ACTIVE / ALL REGISTRATIONS LEDGER */}
          <div className="glass-panel p-6 rounded-3xl border border-zinc-900">
            <h3 className="text-base font-bold text-zinc-100 display-font mb-4">Terminal Security Key Registry</h3>
            <div className="space-y-3">
              {activeCreds.map((cred) => {
                const isApproved = cred.status === 'APPROVED';
                
                return (
                  <div 
                    key={cred.id} 
                    className="p-3.5 bg-zinc-900/10 border border-zinc-900 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 text-zinc-500" />
                      <div>
                        <p className="font-bold text-zinc-200">{cred.credential_name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Owner: {cred.employee_name} ({cred.employee_role?.toUpperCase()})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        isApproved 
                          ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/5 text-red-400 border-red-500/20'
                      }`}>
                        {isApproved ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {cred.status}
                      </span>

                      {currentProfile?.role?.toLowerCase() === 'manager' && (
                        <button
                          onClick={() => {
                            setSelectedEditCred(cred);
                            setEditName(cred.credential_name);
                            setEditStatus(cred.status);
                          }}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                          [ Edit ]
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeCreds.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No active terminal credentials recorded.</p>
              )}
            </div>
          </div>

        </div>

      </div>
      {/* EDIT BIOMETRIC OVERLAY DIALOG MODAL */}
      {selectedEditCred && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
            
            {/* Close [X] */}
            <button
              onClick={() => {
                setSelectedEditCred(null);
                setEditFeedback('');
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Title Header */}
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-4">
              <Fingerprint className="h-5 w-5 text-indigo-400" />
              <h3 className="text-xl font-bold text-zinc-100 display-font">Edit Biometric Key</h3>
            </div>

            {/* Dynamic Feedback Msg */}
            {editFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold border ${
                editFeedback.startsWith('Error')
                  ? 'bg-red-950/20 border-red-900/50 text-red-300'
                  : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
              }`}>
                {editFeedback}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Credential Name / Device Label
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Credential Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="APPROVED">APPROVED (Active)</option>
                  <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                  <option value="REJECTED">REJECTED (Blocked)</option>
                </select>
              </div>

              {/* Controls */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] active:scale-95 cursor-pointer"
                >
                  {editSubmitting ? 'Saving changes...' : '[ Save Changes ]'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEditCred(null);
                    setEditFeedback('');
                  }}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
