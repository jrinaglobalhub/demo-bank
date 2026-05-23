"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Coins, 
  Fingerprint, 
  FileText, 
  UserPlus, 
  TrendingUp, 
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Landmark
} from 'lucide-react';
import { db } from '@/lib/db';
import { formatRupee } from '@/lib/utils';
import { Customer, GoldLoan, BiometricCredential, AuditLog } from '@/lib/mockData';

export default function DashboardOverview() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<GoldLoan[]>([]);
  const [biometrics, setBiometrics] = useState<BiometricCredential[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalDisbursed: 0,
    todayKyc: 0,
    pendingBiometrics: 0,
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [cList, lList, bList, logList] = await Promise.all([
          db.getCustomers(),
          db.getGoldLoans(),
          db.getBiometricCredentials(),
          db.getAuditLogs()
        ]);

        setCustomers(cList);
        setLoans(lList);
        setBiometrics(bList);
        setLogs(logList.slice(0, 4)); // Get last 4 logs for overview display

        // Calculate statistics
        const totalLoans = lList.length;
        const totalDisbursed = lList.reduce((sum, loan) => sum + Number(loan.loan_amount), 0);
        
        // Count KYC registered today
        const todayStr = new Date().toISOString().split('T')[0];
        const todayKyc = cList.filter(c => c.created_at.startsWith(todayStr)).length;

        // Pending biometrics count
        const pendingBiometrics = bList.filter(b => b.status === 'PENDING_APPROVAL').length;

        setStats({
          totalLoans,
          totalDisbursed,
          todayKyc,
          pendingBiometrics
        });
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      }
    };

    loadDashboardData();
    // Poll stats every 2.5 seconds to reflect state mutations instantly
    const interval = setInterval(loadDashboardData, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative glass-panel p-6 md:p-8 rounded-3xl overflow-hidden glass-panel-glow-indigo">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-600/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-widest text-indigo-400 mb-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              JRINA Operations Hub
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-100 display-font">
              Simplify Branch Workflows
            </h2>
            <p className="text-zinc-400 text-sm mt-1 max-w-xl">
              Access customer registrations, loan applications, and system audits from a central command dashboard built for rapid processing.
            </p>
          </div>
          <div className="text-xs font-semibold text-zinc-500 bg-zinc-950/60 border border-zinc-900 rounded-xl px-4 py-3 text-left">
            <div>Workstation status: <span className="text-emerald-400">ONLINE</span></div>
            <div className="mt-1">Crypto security: <span className="text-indigo-400">ACTIVE</span></div>
          </div>
        </div>
      </div>

      {/* GIANT "QUICK ACTION" CARDS */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
          Branch Operations - Quick Access Deck
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quick Action: Register KYC */}
          <Link href="/dashboard/kyc" className="group">
            <div className="h-full glass-panel p-6 rounded-2xl border border-zinc-800 hover:border-emerald-500/35 hover:shadow-[0_4px_20px_rgba(16,185,129,0.08)] transition-all duration-300 flex flex-col justify-between cursor-pointer">
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                  <UserPlus className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-zinc-100 display-font group-hover:text-emerald-400 transition-colors">
                  Register Customer KYC
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Onboard new bank customers. Record identities, personal details, and upload Aadhaar / PAN documentation.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 mt-6">
                <span>Launch KYC Module</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          {/* Quick Action: New Gold Loan */}
          <Link href="/dashboard/gold-loan" className="group">
            <div className="h-full glass-panel p-6 rounded-2xl border border-zinc-800 hover:border-indigo-500/35 hover:shadow-[0_4px_20px_rgba(99,102,241,0.08)] transition-all duration-300 flex flex-col justify-between cursor-pointer">
              <div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
                  <Coins className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-zinc-100 display-font group-hover:text-indigo-400 transition-colors">
                  Issue New Gold Loan
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Open weight calculator, evaluate gold values, assign package shelf-location, and print customer loan records.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-indigo-400 mt-6">
                <span>Launch Loan Calculator</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          {/* Quick Action: Biometric Approval Console */}
          <Link href="/dashboard/biometric" className="group">
            <div className="h-full glass-panel p-6 rounded-2xl border border-zinc-800 hover:border-indigo-500/35 hover:shadow-[0_4px_20px_rgba(99,102,241,0.08)] transition-all duration-300 flex flex-col justify-between cursor-pointer">
              <div>
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
                  <Fingerprint className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-zinc-100 display-font group-hover:text-indigo-400 transition-colors">
                  Manage Biometrics
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Enroll new terminal credentials or check pending approvals. Only managers can approve keys.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-indigo-400 mt-6">
                <span>Launch Security Desk</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>

          {/* Quick Action: Smart Cash Counter */}
          <Link href="/dashboard/cash-desk" className="group">
            <div className="h-full glass-panel p-6 rounded-2xl border border-zinc-800 hover:border-emerald-500/35 hover:shadow-[0_4px_20px_rgba(16,185,129,0.08)] transition-all duration-300 flex flex-col justify-between cursor-pointer">
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                  <Landmark className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-zinc-100 display-font group-hover:text-emerald-400 transition-colors">
                  Cash Inward / Outward
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Process physical deposits & withdrawals. Read count machines and calculate teller notes.
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 mt-6">
                <span>Open Cash Counter</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* VISUAL SUMMARY METRIC WIDGETS */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
          Operational Statistics & Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Loans */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Gold Loans</p>
              <h3 className="text-4xl font-extrabold text-zinc-100 display-font mt-2">{stats.totalLoans}</h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Stable growth</span>
            </div>
          </div>

          {/* Amount Disbursed */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/5 to-transparent pointer-events-none" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Disbursed Capital</p>
              <h3 className="text-2xl font-extrabold text-emerald-400 display-font mt-3">
                {formatRupee(stats.totalDisbursed)}
              </h3>
            </div>
            <div className="mt-4 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              Cumulative Branch Loan Book
            </div>
          </div>

          {/* Today's KYC Submissions */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/5 to-transparent pointer-events-none" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Today's KYC Submissions</p>
              <h3 className="text-4xl font-extrabold text-zinc-100 display-font mt-2">
                {stats.todayKyc}
              </h3>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs text-zinc-400">
              <span className={`inline-block h-2 w-2 rounded-full ${stats.todayKyc > 0 ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              <span>{stats.todayKyc > 0 ? 'Submissions received today' : 'No new registrations yet'}</span>
            </div>
          </div>

          {/* Pending Biometrics */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-900 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/5 to-transparent pointer-events-none" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pending Biometrics</p>
              <h3 className={`text-4xl font-extrabold display-font mt-2 ${
                stats.pendingBiometrics > 0 ? 'text-amber-400 animate-pulse' : 'text-zinc-100'
              }`}>
                {stats.pendingBiometrics}
              </h3>
            </div>
            <div className="mt-4">
              {stats.pendingBiometrics > 0 ? (
                <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Requires manager sign-off</span>
                </div>
              ) : (
                <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  All terminal devices audited
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RECENT OPERATIONAL AUDITS (Ledger) */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-900">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-100 display-font">Recent Operational Activities</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Real-time ledger of security, KYC, and gold loan actions.</p>
          </div>
          <Link href="/dashboard/audit-logs">
            <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all cursor-pointer">
              <span>View Full Audit Logs</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>

        <div className="space-y-3">
          {logs.map((log) => {
            let badgeBg = 'bg-zinc-900/60 border-zinc-800 text-zinc-400';
            let Icon = FileText;

            if (log.log_type === 'GOLD_LOAN') {
              badgeBg = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300';
              Icon = Coins;
            } else if (log.log_type === 'KYC') {
              badgeBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
              Icon = Users;
            } else if (log.log_type === 'BIOMETRIC') {
              badgeBg = 'bg-purple-500/10 border-purple-500/20 text-purple-300';
              Icon = Fingerprint;
            }

            return (
              <div 
                key={log.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900 rounded-xl gap-3 hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg border flex items-center justify-center ${badgeBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-zinc-200">{log.action}</h5>
                    <p className="text-xs text-zinc-400 mt-0.5">{log.details}</p>
                  </div>
                </div>
                <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 bg-zinc-950 px-2.5 py-1 border border-zinc-900 rounded-md">
                    By: {log.performed_by_name}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-medium">
                    {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {logs.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-6">No operational logs recorded in the ledger.</p>
          )}
        </div>
      </div>
    </div>
  );
}
