"use client";

import React, { useState, useEffect } from 'react';
import { User, Shield, Calendar, Database, Sparkles, RefreshCw } from 'lucide-react';
import { db } from '@/lib/db';
import { Profile } from '@/lib/mockData';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TopBanner() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isSupabase, setIsSupabase] = useState<boolean>(false);
  const router = useRouter();

  // Load session profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      const active = await db.getActiveUser();
      setProfile(active);
      setIsSupabase(db.isSupabaseEnabled());
    };
    
    loadProfile();

    // Check for updates every 1.5 seconds in case of role switches
    const interval = setInterval(loadProfile, 1500);

    // Format current date/time
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      setCurrentTime(now.toLocaleDateString('en-US', options));
    };

    updateTime();
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    // Audit log before leaving
    if (profile) {
      await db.createAuditLog(
        'User logout',
        `User ${profile.name} logged out from the enterprise session.`,
        'AUTH'
      );
    }
    
    if (supabase) {
      localStorage.removeItem('session_start_time');
      await supabase.auth.signOut();
    }
    
    // Simple redirect back to login screen
    router.push('/');
  };

  if (!profile) return null;

  return (
    <div className="w-full glass-panel border-b border-zinc-800/80 px-4 py-3 md:px-6 md:py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-0 right-1/4 w-96 h-20 bg-indigo-500/5 blur-3xl pointer-events-none" />
      
      {/* Left Welcoming Details */}
      <div className="flex items-center gap-3 md:gap-4 z-10">
        <div className={`h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center shrink-0 ${
          profile.role === 'manager' 
            ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
            : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
        }`}>
          <User className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base md:text-xl font-bold tracking-tight text-zinc-100">{profile.name}</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold uppercase tracking-wider ${
              profile.role === 'manager' 
                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' 
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            }`}>
              <Shield className="h-3 w-3" />
              {profile.role === 'manager' ? 'Manager' : 'Teller'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium mt-0.5 hidden sm:block">Welcome back to your operations command dashboard</p>
        </div>
      </div>

      {/* Right Metadata widgets */}
      <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
        {/* Date and Time widget */}
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-4 py-2 text-xs font-semibold text-zinc-300">
          <Calendar className="h-4 w-4 text-indigo-400" />
          {currentTime || 'Loading date...'}
        </div>

        {/* Database Status Engine Pill */}
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border ${
          isSupabase 
            ? 'bg-indigo-500/5 text-indigo-300 border-indigo-500/20' 
            : 'bg-amber-500/5 text-amber-300 border-amber-500/20'
        }`}>
          <Database className="h-4 w-4" />
          <span>
            {isSupabase ? 'Supabase Live' : 'Demo Mode (LocalStorage)'}
          </span>
          <span className="relative flex h-2 w-2 ml-1">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isSupabase ? 'bg-indigo-400' : 'bg-amber-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isSupabase ? 'bg-indigo-500' : 'bg-amber-500'
            }`}></span>
          </span>
        </div>

        {/* Quick logout */}
        <button
          onClick={handleLogout}
          className="bg-red-950/20 hover:bg-red-950/50 border border-red-900/30 text-red-300 font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
        >
          Exit Session
        </button>
      </div>
    </div>
  );
}
