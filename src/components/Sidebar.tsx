"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Coins,
  Fingerprint,
  FileText,
  Building2,
  ShieldCheck,
  Menu,
  X,
  Landmark
} from 'lucide-react';
import { db } from '@/lib/db';
import { Profile } from '@/lib/mockData';

export default function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const active = await db.getActiveUser();
      setProfile(active);
    };
    loadProfile();
    const interval = setInterval(loadProfile, 1500);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      name: 'Overview Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['manager', 'clerk', 'teller', 'loan_officer', 'auditor'],
    },
    {
      name: 'Customer KYC',
      href: '/dashboard/kyc',
      icon: Users,
      roles: ['manager', 'clerk', 'teller', 'loan_officer', 'auditor'],
    },
    {
      name: 'Gold Loan Desk',
      href: '/dashboard/gold-loan',
      icon: Coins,
      roles: ['manager', 'clerk', 'teller', 'loan_officer', 'auditor'],
    },
    {
      name: 'Cash Counter Desk',
      href: '/dashboard/cash-desk',
      icon: Landmark,
      roles: ['manager', 'clerk', 'teller', 'loan_officer', 'auditor'],
    },
    {
      name: 'Staff Management Desk',
      href: '/dashboard/staff',
      icon: ShieldCheck,
      roles: ['manager'],
    },
    {
      name: 'Biometrics & Security',
      href: '/dashboard/biometric',
      icon: Fingerprint,
      roles: ['manager', 'clerk', 'teller', 'loan_officer', 'auditor'],
      badge: profile?.role === 'manager' ? 'Admin Approval' : 'Enroll Key',
    },
    {
      name: 'Chronological Audit',
      href: '/dashboard/audit-logs',
      icon: FileText,
      roles: ['manager', 'clerk', 'teller', 'loan_officer', 'auditor'],
    },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden w-full bg-zinc-950 border-b border-zinc-900 px-4 py-3 flex justify-between items-center z-30 sticky top-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-indigo-500" />
          <span className="font-extrabold tracking-wider text-base text-zinc-100 display-font">JRINA BANK</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 text-zinc-400 hover:text-zinc-200 focus:outline-none"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:flex flex-col
        transition-transform duration-300 ease-in-out
        w-64 bg-zinc-950/80 border-r border-zinc-900 z-40 h-full backdrop-blur-md
      `}>
        {/* Branding header */}
        <div className="px-6 py-6 border-b border-zinc-900/60 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-wider text-zinc-100 display-font">JRINA HUB</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Digital Bank Core</p>
          </div>
        </div>

        {/* User Card */}
        <div className="mx-4 my-4 p-4 bg-zinc-900/40 border border-zinc-900 rounded-xl flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${profile?.role === 'manager'
              ? 'bg-indigo-600/15 text-indigo-400'
              : 'bg-emerald-600/15 text-emerald-400'
            }`}>
            {profile?.name.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-zinc-200 truncate">{profile?.name || 'Loading...'}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide truncate">{profile?.role || 'Guest'}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 space-y-1 py-2 overflow-y-auto">
          {navItems
            .filter((item) => !item.roles || (profile && item.roles.includes(profile.role)))
            .map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all group cursor-pointer
                    ${isActive
                      ? 'bg-indigo-600/10 text-indigo-300 border-l-4 border-indigo-500'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 transition-transform group-hover:scale-105 ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-400'
                      }`} />
                    <span>{item.name}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${item.badge.includes('Approval')
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                      }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>

        {/* Sidebar Footer Branding */}
        <div className="p-4 border-t border-zinc-900/60 text-center">
          <div className="flex justify-center items-center gap-1 text-[11px] font-semibold text-zinc-600">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-600" />
            <span>JRINA Banking Core v1.0.0</span>
          </div>
        </div>
      </div>

      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
        />
      )}
    </>
  );
}

const [isMounted, setIsMounted] = useState(false);
const [user, setUser] = useState<any>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  setIsMounted(true);
}, []);