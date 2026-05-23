"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Shield, User, Lock, Fingerprint, HelpCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import BiometricScanner from '@/components/BiometricScanner';

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<'manager' | 'clerk'>('clerk');
  const [username, setUsername] = useState('david.kojo@jrina.com');
  const [password, setPassword] = useState('••••••••••••');
  const [showBiometric, setShowBiometric] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  // Automatically adjust demo credentials when switching roles
  const handleRoleChange = (role: 'manager' | 'clerk') => {
    setSelectedRole(role);
    if (role === 'manager') {
      setUsername('sarah.jenkins@jrina.com');
    } else {
      setUsername('david.kojo@jrina.com');
    }
    setPassword('••••••••••••');
    setErrorMsg('');
  };

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createBrowserSupabaseClient();
      
      if (!supabase) {
        // Fallback to mock session if Supabase isn't configured
        await db.switchActiveUser(selectedRole);
        router.push('/dashboard');
        return;
      }

      // Real Supabase Authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.user) {
        // Log the successful login via RPC or direct insert later, for now just route
        router.push('/dashboard');
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify credentials.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative bg-zinc-950 px-4 overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="ambient-glow-indigo w-[400px] h-[400px]" />
      </div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 pointer-events-none">
        <div className="ambient-glow-emerald w-[400px] h-[400px]" />
      </div>

      <div className="w-full max-w-lg z-10">
        {/* Banking Core Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-3">
            <Building2 className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 display-font">
            JRINA <span className="text-indigo-400">GLOBAL BANK</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1 uppercase tracking-widest font-semibold">
            Enterprise Operations Portal
          </p>
        </div>

        {/* Dynamic Scan Overlay Modal */}
        {showBiometric ? (
          <div className="w-full">
            <BiometricScanner
              mode="login"
              customUserRoleForLogin={selectedRole}
              onSuccess={() => router.push('/dashboard')}
              onCancel={() => setShowBiometric(false)}
            />
          </div>
        ) : (
          /* Main Card Container */
          <div className="glass-panel p-6 sm:p-8 rounded-3xl relative">
            <div className="absolute top-0 right-0 p-4">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 rounded-full">
                <HelpCircle className="h-3 w-3" />
                DEMO SANDBOX
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-zinc-100">Sign In to Your Workspace</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Enter your security credentials or select a pre-configured role to test.
              </p>
            </div>

            {/* Quick-Switch Toggle Buttons */}
            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                1. Select Testing Profile (Quick-Switch Role)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-950 p-1.5 border border-zinc-900 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleRoleChange('clerk')}
                  className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedRole === 'clerk'
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <User className="h-4 w-4" />
                  Teller (David Kojo)
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('manager')}
                  className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedRole === 'manager'
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Manager (Sarah Jenkins)
                </button>
              </div>
            </div>

            {/* Login form */}
            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Workstation ID / Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Security Passcode
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-900/60 text-xs text-red-300 rounded-xl">
                  {errorMsg}
                </div>
              )}

              {/* Login Action Controls */}
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] hover:shadow-indigo-500/30 text-white active:scale-98 cursor-pointer ${
                    selectedRole === 'manager'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-emerald-500/30'
                  }`}
                >
                  {loading ? 'Authenticating workstation...' : `Authorize Workspace as ${selectedRole === 'manager' ? 'Manager' : 'Teller'}`}
                </button>

                {/* Biometric trigger option */}
                <button
                  type="button"
                  onClick={() => setShowBiometric(true)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                >
                  <Fingerprint className="h-4 w-4 text-emerald-400" />
                  Use Biometric Security Login
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-zinc-500">
          <p>© 2026 JRINA Global Digital Hub. All operational events are cryptographically recorded.</p>
        </div>
      </div>
    </main>
  );
}
