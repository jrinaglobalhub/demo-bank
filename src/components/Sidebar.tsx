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
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";

interface Profile {
  id: string;
  name: string;
  role: 'manager' | 'clerk' | 'teller' | 'loan_officer' | 'auditor';
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    if (!supabase) {
      setLoading(false);
      return;
    }

    // Cache object to store credentials for synchronous keepalive calls during page unload
    const sessionCredentials = { userId: '', token: '' };

    // 1. Hard Refresh (Reload) Detection
    const navigation = typeof window !== 'undefined' && performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const isReload = navigation && navigation.type === 'reload';
    
    if (isReload) {
      console.log("[Auth] Page reload detected. Forcing logout as requested.");
      localStorage.removeItem('session_start_time');
      supabase.auth.signOut().then(() => {
        window.location.href = '/';
      });
      return;
    }

    // 2. Fetch session immediately on mount to prevent perpetual loading
    const loadSession = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Cache session details
          sessionCredentials.userId = session.user.id;
          sessionCredentials.token = session.access_token;

          // Initialize session start time if not set
          if (!localStorage.getItem('session_start_time')) {
            localStorage.setItem('session_start_time', Date.now().toString());
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            // Set online status in database
            if (profile.status !== 'ONLINE') {
              await db.updateProfileStatus(session.user.id, 'ONLINE');
            }
          }

          setUser({
            id: session.user.id,
            email: session.user.email,
            name: profile?.name || profile?.full_name || '',
            role: profile?.role || null
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Error loading session on mount:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSession();

    // 3. Setup auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (session?.user) {
        sessionCredentials.userId = session.user.id;
        sessionCredentials.token = session.access_token;

        if (!localStorage.getItem('session_start_time')) {
          localStorage.setItem('session_start_time', Date.now().toString());
        }
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && profile.status !== 'ONLINE') {
            await db.updateProfileStatus(session.user.id, 'ONLINE');
          }

          setUser({
            id: session.user.id,
            email: session.user.email,
            name: profile?.name || profile?.full_name || '',
            role: profile?.role || null
          });
        } catch (e) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: '',
            role: null
          });
        }
      } else {
        localStorage.removeItem('session_start_time');
        setUser(null);
        sessionCredentials.userId = '';
        sessionCredentials.token = '';
      }
      setLoading(false);
    });

    // 4. Session timeout check (1 hour)
    const timeoutInterval = setInterval(async () => {
      const startTimeStr = localStorage.getItem('session_start_time');
      if (startTimeStr) {
        const startTime = parseInt(startTimeStr, 10);
        const elapsed = Date.now() - startTime;
        if (elapsed > 1 * 60 * 60 * 1000) { // 1 hour
          console.log("[Auth] Session expired (1 hour limit reached). Logging out.");
          localStorage.removeItem('session_start_time');
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await db.updateProfileStatus(session.user.id, 'OFFLINE');
          }
          await supabase.auth.signOut();
          window.location.href = '/';
        }
      }
    }, 5000);

    // 5. Handle Tab / Window Close to set status to OFFLINE
    const handleBeforeUnload = () => {
      if (sessionCredentials.userId && sessionCredentials.token) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${sessionCredentials.userId}`;
        fetch(url, {
          method: 'PATCH',
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${sessionCredentials.token}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ status: 'OFFLINE' }),
          keepalive: true
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      subscription.unsubscribe();
      clearInterval(timeoutInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 💡 PERFECT CASE-INSENSITIVE FALLBACK LOGIC (Domain collision fixed)
  const emailLower = user?.email?.toLowerCase() || '';

  // ഇമെയിലിൽ കൃത്യമായി 'manager' എന്ന് ഉണ്ടോ എന്ന് മാത്രം നോക്കുന്നു ('jrina.online' ഇവിടെ ഒഴിവാക്കി)
  const isManagerEmail = emailLower.includes('manager');
  const dbRole = user?.role ? String(user.role).toLowerCase() : null;

  // ഒന്നുകിൽ ഇമെയിലിൽ manager വേണം അല്ലെങ്കിൽ dbRole manager ആയിരിക്കണം
  const currentRole = isManagerEmail || dbRole === 'manager' ? 'manager' : (dbRole || 'clerk');

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
      badge: currentRole === 'manager' ? 'Admin Approval' : 'Enroll Key',
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

        {/* User Card (പ്രൊഫൈൽ സെക്ഷൻ) */}
        <div className="mx-4 my-4 p-4 bg-zinc-900/40 border border-zinc-900 rounded-xl flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-8 rounded-lg bg-zinc-800 animate-pulse" />
          ) : (
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${currentRole === 'manager'
              ? 'bg-indigo-600/15 text-indigo-400'
              : 'bg-emerald-600/15 text-emerald-400'
              }`}>
              {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          )}

          <div className="overflow-hidden flex-1">
            {loading ? (
              <div className="space-y-2">
                <div className="h-3 w-20 bg-zinc-800 animate-pulse rounded" />
                <div className="h-2 w-12 bg-zinc-800 animate-pulse rounded" />
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-zinc-200 truncate">
                  {user?.name || user?.email || 'Guest'}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide truncate">
                  {user ? currentRole : 'Guest'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 space-y-1 py-2 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 px-4 py-2">
              <div className="h-9 w-full bg-zinc-900/30 animate-pulse rounded-xl" />
              <div className="h-9 w-full bg-zinc-900/30 animate-pulse rounded-xl" />
              <div className="h-9 w-full bg-zinc-900/30 animate-pulse rounded-xl" />
            </div>
          ) : (
            navItems
              .filter((item) => {
                if (!item.roles) return true;
                return item.roles.includes(currentRole);
              })
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
              })
          )}
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