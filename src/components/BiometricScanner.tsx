"use client";

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import { db } from '@/lib/db';

interface BiometricScannerProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  mode: 'enroll' | 'login';
  customUserRoleForLogin?: 'manager' | 'clerk'; // used for switching role during simulated login
}

export default function BiometricScanner({ onSuccess, onCancel, mode, customUserRoleForLogin }: BiometricScannerProps) {
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'completing' | 'success' | 'error'>('idle');
  const [statusText, setStatusText] = useState('Ready for biometric scanning');
  const [credentialName, setCredentialName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [devicesList, setDevicesList] = useState<any[]>([]);

  useEffect(() => {
    if (mode === 'login') {
      // Load approved devices to display
      db.getBiometricCredentials().then(creds => {
        setDevicesList(creds.filter(c => c.status === 'APPROVED'));
      });
    }
  }, [mode]);

  const handleStartScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (mode === 'enroll' && !credentialName.trim()) {
      setStatusText('Please enter a device label first!');
      return;
    }

    setScanState('scanning');
    setStatusText('Sensor activated. Place your finger on the scanner...');

    // Phase 1: Simulate scanning action (2.5 seconds)
    setTimeout(() => {
      setScanState('completing');
      setStatusText('Analyzing biometric prints & generating keypair...');
      
      // Phase 2: Save to DB or Authenticate
      setTimeout(async () => {
        try {
          if (mode === 'enroll') {
            // Register biometric credential
            const newCred = await db.registerBiometric(credentialName);
            setScanState('success');
            setStatusText('Enrollment completed successfully!');
            
            // Log it
            await db.createAuditLog(
              'Biometric Enrolled',
              `Biometric credential '${credentialName}' was successfully registered and sent for approval.`,
              'BIOMETRIC'
            );

            setTimeout(() => {
              if (onSuccess) onSuccess();
            }, 1500);

          } else {
            // Login Mode Simulation
            // 1. Get all biometrics
            const creds = await db.getBiometricCredentials();
            
            // Filter by active role target
            const targetRole = customUserRoleForLogin || 'clerk';
            const relevantCreds = creds.filter(c => c.employee_role === targetRole);
            
            if (relevantCreds.length === 0) {
              setScanState('error');
              setErrorMessage(`No biometric keys registered for a '${targetRole.toUpperCase()}' profile. Please log in normally and register a device first.`);
              return;
            }

            // Find if there's any approved credential
            const approvedCred = relevantCreds.find(c => c.status === 'APPROVED');
            const pendingCred = relevantCreds.find(c => c.status === 'PENDING_APPROVAL');

            if (approvedCred) {
              // Switch profile session to this user
              await db.switchActiveUser(targetRole);
              setScanState('success');
              setStatusText(`Access Granted! Welcome back.`);
              
              await db.createAuditLog(
                'Biometric Login Successful',
                `Biometric authentication successful for role ${targetRole.toUpperCase()} using '${approvedCred.credential_name}'.`,
                'AUTH'
              );

              setTimeout(() => {
                if (onSuccess) onSuccess();
              }, 1500);
            } else if (pendingCred) {
              setScanState('error');
              setErrorMessage("Your biometric login is pending Admin verification. Access is strictly blocked until approved.");
              
              await db.createAuditLog(
                'Biometric Login Blocked',
                `Blocked biometric login attempt for ${targetRole.toUpperCase()} using '${pendingCred.credential_name}' (Status: PENDING_APPROVAL).`,
                'AUTH'
              );
            } else {
              setScanState('error');
              setErrorMessage(`No approved biometric credentials found for ${targetRole.toUpperCase()}. Please ask a Manager to approve your keys.`);
            }
          }
        } catch (err: any) {
          setScanState('error');
          setErrorMessage(err.message || 'An error occurred during scanning.');
        }
      }, 1500);
    }, 2500);
  };

  return (
    <div className="glass-panel glass-panel-glow-indigo p-6 rounded-2xl w-full max-w-md mx-auto text-zinc-100 flex flex-col items-center">
      {/* Title */}
      <div className="flex items-center gap-2 mb-6">
        <KeyRound className="h-6 w-6 text-indigo-400" />
        <h3 className="text-xl font-bold text-zinc-100">
          {mode === 'enroll' ? 'Biometric ID Enrollment' : 'Biometric Security Access'}
        </h3>
      </div>

      {/* Sub-text */}
      <p className="text-sm text-zinc-400 text-center mb-6">
        {mode === 'enroll' 
          ? 'Secure your workstation credentials. Registered credentials require Manager verification before first use.'
          : 'Authenticate instantly with your approved fingerprint security credential.'}
      </p>

      {/* Enroll Form Label */}
      {mode === 'enroll' && scanState === 'idle' && (
        <div className="w-full mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Device/Workstation Name</label>
          <input
            type="text"
            placeholder="e.g. Counter-3 Workstation, Sarah's MacBook"
            value={credentialName}
            onChange={(e) => setCredentialName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-100 placeholder-zinc-600"
          />
        </div>
      )}

      {/* Visual Fingerprint Display */}
      <div className="relative w-40 h-40 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-center mb-6 group overflow-hidden">
        {scanState === 'scanning' && <div className="scanner-line" />}
        {scanState === 'completing' && <div className="scanner-line" />}
        
        {scanState === 'idle' && (
          <Fingerprint 
            onClick={() => handleStartScan()} 
            className="h-24 w-24 text-indigo-500/40 group-hover:text-indigo-400 hover:scale-105 transition-all duration-300 cursor-pointer"
          />
        )}
        
        {(scanState === 'scanning' || scanState === 'completing') && (
          <Fingerprint className="h-24 w-24 text-emerald-500 animate-pulse" />
        )}
        
        {scanState === 'success' && (
          <CheckCircle2 className="h-24 w-24 text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
        )}
        
        {scanState === 'error' && (
          <ShieldAlert className="h-24 w-24 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
        )}
      </div>

      {/* Live Status and Alerts */}
      <div className="w-full text-center mb-6">
        <div className={`text-sm font-medium ${
          scanState === 'success' ? 'text-emerald-400' : 
          scanState === 'error' ? 'text-red-400' : 
          scanState === 'scanning' || scanState === 'completing' ? 'text-indigo-400' : 'text-zinc-300'
        }`}>
          {scanState === 'scanning' && <Loader2 className="inline h-4 w-4 animate-spin mr-1 text-indigo-400" />}
          {scanState === 'completing' && <Loader2 className="inline h-4 w-4 animate-spin mr-1 text-emerald-400" />}
          {statusText}
        </div>

        {scanState === 'error' && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-300 text-left">
            <strong>Security Block:</strong> {errorMessage}
          </div>
        )}
      </div>

      {/* Dynamic Controls */}
      <div className="w-full flex gap-3">
        {scanState === 'idle' && (
          <button
            onClick={() => handleStartScan()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] active:scale-95"
          >
            {mode === 'enroll' ? 'Begin Fingerprint Scan' : `Verify ${customUserRoleForLogin?.toUpperCase() || 'Teller'}`}
          </button>
        )}

        {scanState === 'error' && (
          <button
            onClick={() => {
              setScanState('idle');
              setErrorMessage('');
              setStatusText('Ready for biometric scanning');
            }}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold py-3 px-4 rounded-xl text-sm transition-all"
          >
            Retry Verification
          </button>
        )}

        <button
          onClick={onCancel}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-medium py-3 px-4 rounded-xl text-sm transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
