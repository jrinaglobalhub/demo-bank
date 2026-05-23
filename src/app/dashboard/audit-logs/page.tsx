"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Coins, 
  Users, 
  Fingerprint, 
  ShieldCheck, 
  Calendar, 
  ArrowRight,
  Filter,
  UserCheck
} from 'lucide-react';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { AuditLog } from '@/lib/mockData';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const loadLogs = async () => {
    try {
      const logList = await db.getAuditLogs();
      setLogs(logList);
    } catch (err) {
      console.error('Error loading audit log data:', err);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2500);
    return () => clearInterval(interval);
  }, []);

  // Filter logs by type and search query
  const filteredLogs = logs.filter(log => {
    const matchesType = selectedType === 'ALL' || log.log_type === selectedType;
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.performed_by_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const categories = [
    { name: 'All Log Activities', value: 'ALL' },
    { name: 'Gold Loan Desk', value: 'GOLD_LOAN' },
    { name: 'Customer KYC', value: 'KYC' },
    { name: 'Biometric Access', value: 'BIOMETRIC' },
    { name: 'Auth Sessions', value: 'AUTH' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100 display-font">Cryptographic Operations Ledger</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Real-time immutable audit records tracking employee operational events.</p>
        </div>
        <div className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 rounded-xl">
          <ShieldCheck className="h-4 w-4" />
          IMMUTABLE COMPLIANCE ACTIVE
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Search */}
        <div className="lg:col-span-4 glass-panel p-3 rounded-xl flex items-center">
          <Search className="h-4 w-4 text-zinc-500 ml-1" />
          <input
            type="text"
            placeholder="Search logs by Action, Details, or Operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 pl-2 text-xs focus:outline-none text-zinc-200"
          />
        </div>

        {/* Categories Tab selectors */}
        <div className="lg:col-span-8 flex flex-wrap bg-zinc-950 p-1 border border-zinc-900 rounded-xl overflow-x-auto gap-1">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedType(cat.value)}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedType === cat.value 
                  ? 'bg-zinc-900 text-indigo-400 shadow-sm border border-zinc-800' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* TIMELINE DISPLAY */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
        {/* Timeline Center Guideline (only visible on large screens) */}
        <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-zinc-900 pointer-events-none hidden md:block" />

        <div className="space-y-8 relative">
          {filteredLogs.map((log) => {
            // Assign icon & colors based on type
            let badgeBg = 'bg-zinc-900/80 border-zinc-800 text-zinc-400';
            let iconColor = 'text-zinc-400';
            let Icon = FileText;

            if (log.log_type === 'GOLD_LOAN') {
              badgeBg = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300';
              iconColor = 'text-indigo-400';
              Icon = Coins;
            } else if (log.log_type === 'KYC') {
              badgeBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
              iconColor = 'text-emerald-400';
              Icon = Users;
            } else if (log.log_type === 'BIOMETRIC') {
              badgeBg = 'bg-purple-500/10 border-purple-500/20 text-purple-300';
              iconColor = 'text-purple-400';
              Icon = Fingerprint;
            } else if (log.log_type === 'AUTH') {
              badgeBg = 'bg-zinc-800 text-zinc-300 border-zinc-700';
              iconColor = 'text-zinc-300';
              Icon = UserCheck;
            }

            return (
              <div 
                key={log.id} 
                className="relative flex flex-col md:flex-row gap-6 md:gap-8 items-start hover:bg-zinc-900/10 p-4 rounded-2xl transition-colors duration-200"
              >
                {/* Timeline Icon */}
                <div className="h-10 w-10 rounded-xl border flex items-center justify-center z-10 shrink-0 self-start md:self-center bg-zinc-950 shadow-md transition-all duration-300 group-hover:scale-105 border-zinc-800">
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>

                {/* Log Description Card */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-zinc-200 display-font">{log.action}</h4>
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${badgeBg}`}>
                        {log.log_type.replace('_', ' ')}
                      </span>
                    </div>
                    {/* Timestamp */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                      <span>{formatDate(log.created_at)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed max-w-4xl">{log.details}</p>

                  <div className="flex items-center gap-2 pt-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-950 px-2 py-0.5 border border-zinc-900 rounded-md">
                      Operator: {log.performed_by_name}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-medium font-mono">
                      ID: {log.performed_by.substring(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-sm text-zinc-500">
              No operational events found matching the search criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
