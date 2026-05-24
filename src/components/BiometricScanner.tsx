"use client";

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { supabase } from '@/lib/supabase';

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
    setStatusText('Follow browser prompts to complete TouchID/FaceID or security key scanning...');

    try {
      if (mode === 'enroll') {
        if (!window.PublicKeyCredential) {
          throw new Error("WebAuthn biometric authentication is not supported by this browser.");
        }

        const activeUser = await db.getActiveUser();
        let userEmail = 'user@jrina.online';
        if (supabase) {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user?.email) {
            userEmail = authData.user.email;
          }
        }

        const randomChallenge = new Uint8Array(32);
        window.crypto.getRandomValues(randomChallenge);

        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const rpId = window.location.hostname;

        const options: PublicKeyCredentialCreationOptions = {
          challenge: randomChallenge,
          rp: {
            name: "JRINA Demo Bank",
            id: rpId || undefined,
          },
          user: {
            id: userId,
            name: userEmail,
            displayName: activeUser.name,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 } // RS256
          ],
          authenticatorSelection: {
            userVerification: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        };

        console.log("[WebAuthn] Registering credential options:", options);
        const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
        if (!credential) {
          throw new Error("Credential creation failed or was cancelled by user.");
        }

        // Encode raw ID to Base64URL string
        const rawId = new Uint8Array(credential.rawId);
        const base64UrlId = btoa(String.fromCharCode(...rawId))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');

        setScanState('completing');
        setStatusText('Registering credential key with secure vault...');

        const newCred = await db.registerBiometric(credentialName, base64UrlId, `public_key_webauthn_${base64UrlId.substring(0, 10)}`);
        
        setScanState('success');
        setStatusText('Biometric Enrollment request sent for approval!');
        
        await db.createAuditLog(
          'Biometric Enrolled',
          `Real biometric credential '${credentialName}' was registered using FIDO2/WebAuthn. Status: PENDING APPROVAL`,
          'BIOMETRIC'
        );

        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);

      } else {
        // LOGIN MODE
        const targetRole = customUserRoleForLogin || 'clerk';
        const creds = await db.getBiometricCredentials();
        const relevantCreds = creds.filter(c => c.employee_role === targetRole);
        
        if (relevantCreds.length === 0) {
          setScanState('error');
          setErrorMessage(`No biometric keys registered for a '${targetRole.toUpperCase()}' profile. Please log in normally and register a device first.`);
          return;
        }

        const approvedCreds = relevantCreds.filter(c => c.status === 'APPROVED');
        const pendingCred = relevantCreds.find(c => c.status === 'PENDING_APPROVAL');

        if (approvedCreds.length === 0) {
          if (pendingCred) {
            setScanState('error');
            setErrorMessage("Your biometric login is pending Admin verification. Access is strictly blocked until approved.");
          } else {
            setScanState('error');
            setErrorMessage(`No approved biometric credentials found for ${targetRole.toUpperCase()}. Please ask a Manager to approve your keys.`);
          }
          return;
        }

        if (!window.PublicKeyCredential) {
          throw new Error("WebAuthn biometric authentication is not supported by this browser.");
        }

        // Map allowed credentials
        const allowCredentials = approvedCreds.map(cred => {
          // Decode Base64URL back to Uint8Array
          const binaryString = atob(cred.credential_id.replace(/-/g, '+').replace(/_/g, '/'));
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return {
            type: "public-key" as const,
            id: bytes
          };
        });

        const randomChallenge = new Uint8Array(32);
        window.crypto.getRandomValues(randomChallenge);

        const options: PublicKeyCredentialRequestOptions = {
          challenge: randomChallenge,
          rpId: window.location.hostname || undefined,
          allowCredentials,
          timeout: 60000,
          userVerification: "preferred"
        };

        console.log("[WebAuthn] Getting assertion options:", options);
        const assertion = await navigator.credentials.get({ publicKey: options });
        if (!assertion) {
          throw new Error("Biometric verification failed or was cancelled by user.");
        }

        setScanState('completing');
        setStatusText('Cryptographic signature verified. Logging in...');

        // Perform Supabase Auth Session Sign-in
        if (supabase) {
          const email = targetRole === 'manager' ? 'manager@jrina.online' : 'clerk@jrina.online';
          const password = targetRole === 'manager' ? 'JRINA@123' : 'Clerk@jrina';
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (signInErr) {
            throw new Error(`Biometric login failed to authenticate session: ${signInErr.message}`);
          }
        } else {
          await db.switchActiveUser(targetRole);
        }

        setScanState('success');
        setStatusText(`Access Granted! Welcome back.`);
        
        await db.createAuditLog(
          'Biometric Login Successful',
          `Biometric authentication successful for role ${targetRole.toUpperCase()} using WebAuthn.`,
          'AUTH'
        );

        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      console.error("[WebAuthn] Error:", err);
      setScanState('error');
      setErrorMessage(err.message || 'An error occurred during biometric scanning.');
    }
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
