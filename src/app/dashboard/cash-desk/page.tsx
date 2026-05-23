"use client";

import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Landmark, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles, 
  X,
  FileText,
  Calculator
} from 'lucide-react';
import { db } from '@/lib/db';
import { formatRupee } from '@/lib/utils';
import { Customer } from '@/lib/mockData';
import { createBrowserSupabaseClient } from '@/lib/supabase';

// Available Indian Rupee denominations including the demo ₹5000 imaginary note
const DENOMINATIONS = [5000, 2000, 500, 200, 100, 50, 20, 10];

export default function CashDeskModule() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  
  // Tab control: 'deposit' or 'withdrawal'
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdrawal'>('deposit');
  
  // Deposit States
  const [depositCounts, setDepositCounts] = useState<Record<number, number>>({
    5000: 0, 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0
  });
  const [loadingMachine, setLoadingMachine] = useState(false);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // Withdrawal States
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalCounts, setWithdrawalCounts] = useState<Record<number, number>>({
    5000: 0, 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0
  });
  const [withdrawalTotal, setWithdrawalTotal] = useState(0);
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);

  // Global Alerts
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load verified customer list
  const loadCustomers = async () => {
    try {
      const list = await db.getCustomers();
      // Cash operations are only valid for fully verified customers! Excellent banking logic!
      setCustomers(list.filter(c => c.status === 'VERIFIED'));
    } catch (err) {
      console.error('Error loading customer list:', err);
    }
  };

  useEffect(() => {
    loadCustomers();
    const interval = setInterval(loadCustomers, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update active customer when selection changes
  useEffect(() => {
    if (selectedCustomerId) {
      const cust = customers.find(c => c.id === selectedCustomerId) || null;
      setActiveCustomer(cust);
    } else {
      setActiveCustomer(null);
    }
  }, [selectedCustomerId, customers]);

  // Reset counts helper
  const resetDepositCounts = () => {
    setDepositCounts({
      5000: 0, 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0
    });
  };

  const resetWithdrawalCounts = () => {
    setWithdrawalCounts({
      5000: 0, 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0
    });
    setWithdrawalTotal(0);
    setWithdrawalAmount('');
  };

  // Deposit Actions: Simulate Fetching from Counting Machine
  const handleFetchFromMachine = () => {
    setLoadingMachine(true);
    setFeedback(null);
    
    setTimeout(() => {
      // Seed high-fidelity, distinct mock note counts automatically
      setDepositCounts({
        5000: 5,   // Imaginary Note: ₹25,000
        2000: 10,  // Note: ₹20,000
        500: 50,   // Note: ₹25,000
        200: 30,   // Note: ₹6,000
        100: 100,  // Note: ₹10,000
        50: 50,    // Note: ₹2,500
        20: 100,   // Note: ₹2,000
        10: 200    // Note: ₹2,000
      });
      setLoadingMachine(false);
      
      setFeedback({
        message: 'Success: Optical note denominations successfully fetched from physical cash counter.',
        type: 'success'
      });
    }, 2000);
  };

  // Compute Deposit totals
  const getDepositTotal = () => {
    return Object.entries(depositCounts).reduce(
      (sum, [denom, count]) => sum + (Number(denom) * count), 
      0
    );
  };

  // Confirm Deposit
  const handleDepositConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) {
      setFeedback({ message: 'Error: Please select a verified customer profile first.', type: 'error' });
      return;
    }

    const total = getDepositTotal();
    if (total <= 0) {
      setFeedback({ message: 'Error: Cash Inward total must be greater than ₹0.', type: 'error' });
      return;
    }

    setDepositSubmitting(true);
    try {
      const currentBalance = activeCustomer.balance || 0;
      const newBalance = currentBalance + total;
      
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        // Log transaction concurrently with balance update
        const { error } = await supabase.from('cash_transactions').insert([{
          customer_id: activeCustomer.id,
          transaction_type: 'DEPOSIT',
          amount: total,
          denomination_matrix: depositCounts
        }]);
        if (error) throw new Error(error.message);
      }

      await db.updateCustomerBalance(activeCustomer.id, newBalance, 'DEPOSIT', total);
      
      setFeedback({
        message: `Success! Deposit of ₹${total.toLocaleString('en-IN')} successfully processed for ${activeCustomer.name}. New available balance: ₹${newBalance.toLocaleString('en-IN')}.`,
        type: 'success'
      });
      
      resetDepositCounts();
    } catch (err: any) {
      setFeedback({ message: `Error: ${err.message || 'Failed to process deposit.'}`, type: 'error' });
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Withdrawal Actions: Greedy Note Breakdown Calculator
  const handleFetchDisbursal = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    
    const amt = parseFloat(withdrawalAmount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ message: 'Error: Please enter a valid withdrawal amount.', type: 'error' });
      return;
    }

    if (amt % 10 !== 0) {
      setFeedback({ 
        message: 'Error: Withdrawal amount must be a multiple of ₹10 (smallest note denomination).', 
        type: 'error' 
      });
      return;
    }

    if (activeCustomer && amt > (activeCustomer.balance || 0)) {
      setFeedback({ 
        message: `Error: Insufficient balance. Customer has only ${formatRupee(activeCustomer.balance || 0)} available.`, 
        type: 'error' 
      });
      return;
    }

    // Greedy change-making algorithm
    let remaining = amt;
    const tempCounts: Record<number, number> = {
      5000: 0, 2000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0
    };

    for (const denom of DENOMINATIONS) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        tempCounts[denom] = count;
        remaining = remaining % denom;
      }
    }

    setWithdrawalCounts(tempCounts);
    setWithdrawalTotal(amt);
    
    setFeedback({
      message: 'Success: Disbursal note counts calculated. Please retrieve notes from secure drawer.',
      type: 'success'
    });
  };

  // Confirm Withdrawal
  const handleWithdrawalConfirm = async () => {
    if (!activeCustomer) {
      setFeedback({ message: 'Error: Please select a verified customer profile first.', type: 'error' });
      return;
    }

    if (withdrawalTotal <= 0) {
      setFeedback({ message: 'Error: Cash Outward total must be greater than ₹0.', type: 'error' });
      return;
    }

    if (withdrawalTotal > (activeCustomer.balance || 0)) {
      setFeedback({ message: 'Error: Insufficient customer ledger balance.', type: 'error' });
      return;
    }

    setWithdrawalSubmitting(true);
    try {
      const currentBalance = activeCustomer.balance || 0;
      const newBalance = currentBalance - withdrawalTotal;
      
      const supabase = createBrowserSupabaseClient();
      if (supabase) {
        // Log transaction concurrently with balance update
        const { error } = await supabase.from('cash_transactions').insert([{
          customer_id: activeCustomer.id,
          transaction_type: 'WITHDRAWAL',
          amount: withdrawalTotal,
          denomination_matrix: withdrawalCounts
        }]);
        if (error) throw new Error(error.message);
      }

      await db.updateCustomerBalance(activeCustomer.id, newBalance, 'WITHDRAWAL', withdrawalTotal);
      
      setFeedback({
        message: `Success! Cash withdrawal of ₹${withdrawalTotal.toLocaleString('en-IN')} successfully processed for ${activeCustomer.name}. New available balance: ₹${newBalance.toLocaleString('en-IN')}.`,
        type: 'success'
      });
      
      resetWithdrawalCounts();
    } catch (err: any) {
      setFeedback({ message: `Error: ${err.message || 'Failed to process withdrawal.'}`, type: 'error' });
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">OPERATIONAL TRANSACTIONS DESK</span>
          <h2 className="text-3xl font-extrabold text-zinc-100 display-font mt-1">Smart Cash Inward/Outward Counter</h2>
          <p className="text-xs text-zinc-400 mt-1">Dual-Engine Vault Interface. Live counting machine optical note hydration.</p>
        </div>
        
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-full text-xs text-zinc-400">
          <Landmark className="h-4 w-4 text-indigo-400" />
          <span>Locker Balance: <span className="text-emerald-400 font-extrabold">₹48,50,000</span></span>
        </div>
      </div>

      {/* Global Alerts Feed */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs border ${
          feedback.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
            : 'bg-red-950/40 border-red-900/50 text-red-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="h-4.5 w-4.5 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-zinc-500 hover:text-zinc-300 p-1 hover:bg-zinc-900/30 rounded-full"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Select Client Profile */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-900 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Select Customer Identity</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">Verified Bank Accounts</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setFeedback(null);
                resetDepositCounts();
                resetWithdrawalCounts();
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
            >
              <option value="">-- Choose verified customer profile --</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name} ({cust.email})
                </option>
              ))}
            </select>
          </div>

          {activeCustomer && (
            <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-xl grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="block text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold">Aadhaar Profile</span>
                <span className="font-mono text-zinc-300 font-bold">
                  •••• •••• {activeCustomer.aadhaar_number.replace(/\s+/g, '').slice(-4)}
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold">Ledger Balance</span>
                <span className="text-emerald-400 font-extrabold text-sm">
                  {formatRupee(activeCustomer.balance || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary Operation Tabs */}
      <div className="flex border-b border-zinc-900 gap-1.5">
        <button
          onClick={() => {
            setActiveTab('deposit');
            setFeedback(null);
          }}
          className={`px-6 py-3.5 text-sm font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'deposit'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          [ + Cash Deposit ]
        </button>

        <button
          onClick={() => {
            setActiveTab('withdrawal');
            setFeedback(null);
          }}
          className={`px-6 py-3.5 text-sm font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'withdrawal'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-950/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          [ - Cash Withdrawal ]
        </button>
      </div>

      {/* CASH DEPOSIT TAB PANEL */}
      {activeTab === 'deposit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Side: Simulation counting controls */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-zinc-900 space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4.5 w-4.5 text-emerald-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-300">OCR counting machine</h4>
              </div>
              
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect the workstation to the branch's secure optical cash reading machine to automatically scan, sort, and record incoming note values.
              </p>

              <button
                onClick={handleFetchFromMachine}
                disabled={loadingMachine || !selectedCustomerId}
                className="w-full bg-emerald-900/10 hover:bg-emerald-900/20 disabled:bg-zinc-900 disabled:text-zinc-600 border border-emerald-500/20 disabled:border-zinc-800 text-emerald-400 font-extrabold py-4 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${loadingMachine ? 'animate-spin' : ''}`} />
                {loadingMachine ? 'Reading Machine Data...' : 'Fetch from Counting Machine'}
              </button>

              {!selectedCustomerId && (
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold justify-center">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Choose customer to enable scanner</span>
                </div>
              )}
            </div>

            {/* Massive Summary Card */}
            <div className="p-6 bg-emerald-950/20 border border-emerald-500/25 rounded-3xl relative overflow-hidden flex flex-col justify-between h-44 shadow-[0_4px_30px_rgba(16,185,129,0.05)]">
              <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-emerald-500/5 to-transparent pointer-events-none" />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">DEPOSIT VAULT REVENUE</span>
                <h3 className="text-2xl font-black text-emerald-400 display-font mt-2">
                  Physical Cash Received
                </h3>
              </div>
              <div className="text-3xl font-black text-zinc-100 display-font mt-4">
                {formatRupee(getDepositTotal())}
              </div>
            </div>
          </div>

          {/* Right Side: Denomination matrix */}
          <div className="lg:col-span-8">
            <form onSubmit={handleDepositConfirm} className="glass-panel p-6 rounded-2xl border border-zinc-900 space-y-6">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Denomination Matrix Table</h4>
                <button
                  type="button"
                  onClick={resetDepositCounts}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 font-semibold uppercase tracking-wider"
                >
                  Clear All
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Note Value</th>
                      <th className="px-4 py-3 w-40">Count</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60 font-semibold">
                    {DENOMINATIONS.map((denom) => {
                      const count = depositCounts[denom] || 0;
                      return (
                        <tr key={denom} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              denom === 5000 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : denom === 2000
                                ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                : denom === 500
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}>
                              ₹{denom} {denom === 5000 ? '(Imaginary)' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              value={count === 0 ? '' : count}
                              placeholder="0"
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setDepositCounts(prev => ({
                                  ...prev,
                                  [denom]: val
                                }));
                              }}
                              className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-bold text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-300">
                            {formatRupee(denom * count)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Controls */}
              <div className="flex gap-4 pt-4 border-t border-zinc-900 justify-end">
                <button
                  type="submit"
                  disabled={depositSubmitting || getDepositTotal() <= 0 || !selectedCustomerId}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900 disabled:text-zinc-600 border border-emerald-500/20 disabled:border-transparent text-white font-extrabold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)] cursor-pointer"
                >
                  {depositSubmitting ? 'Recording Deposit...' : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

      {/* CASH WITHDRAWAL TAB PANEL */}
      {activeTab === 'withdrawal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Side: Enter target amount and trigger count */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleFetchDisbursal} className="glass-panel p-6 rounded-2xl border border-zinc-900 space-y-5">
              <div className="flex items-center gap-2">
                <Calculator className="h-4.5 w-4.5 text-indigo-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Disbursal calculator</h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Enter Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  placeholder="Enter amount (multiples of ₹10)..."
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-400 placeholder-zinc-700"
                />
                <span className="block text-[10px] text-zinc-500 mt-2 leading-relaxed">
                  The disbursal engine will greedily determine the optimal note breakdown to optimize secure drawer storage.
                </span>
              </div>

              <button
                type="submit"
                disabled={!selectedCustomerId || !withdrawalAmount}
                className="w-full bg-indigo-900/10 hover:bg-indigo-900/20 disabled:bg-zinc-900 disabled:text-zinc-600 border border-indigo-500/20 disabled:border-zinc-800 text-indigo-400 font-extrabold py-4 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Fetch Disbursal Count
              </button>
            </form>

            {/* Massive Disbursal card */}
            {withdrawalTotal > 0 && (
              <div className="p-6 bg-indigo-950/20 border border-indigo-500/25 rounded-3xl relative overflow-hidden flex flex-col justify-between h-44 shadow-[0_4px_30px_rgba(99,102,241,0.05)]">
                <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none" />
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">OUTWARD VAULT DISBURSAL</span>
                  <h3 className="text-2xl font-black text-indigo-400 display-font mt-2">
                    Disbursal Cash Total
                  </h3>
                </div>
                <div className="text-3xl font-black text-zinc-100 display-font mt-4">
                  {formatRupee(withdrawalTotal)}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Read-only disbursal counts */}
          <div className="lg:col-span-7">
            <div className="glass-panel p-6 rounded-2xl border border-zinc-900 space-y-6">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Calculated Teller Disbursal Notes</h4>
                <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-zinc-900 text-zinc-500 border border-zinc-800">
                  Read Only
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                      <th className="px-4 py-3">Note Value</th>
                      <th className="px-4 py-3">Disbursal Count</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60 font-semibold">
                    {DENOMINATIONS.map((denom) => {
                      const count = withdrawalCounts[denom] || 0;
                      return (
                        <tr key={denom} className={`transition-colors ${count > 0 ? 'bg-indigo-950/10' : 'hover:bg-zinc-900/20'}`}>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              denom === 5000 
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                : denom === 2000
                                ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                : denom === 500
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}>
                              ₹{denom} {denom === 5000 ? '(Imaginary)' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-zinc-200">
                            {count > 0 ? (
                              <span className="text-indigo-400 font-extrabold text-sm animate-pulse">
                                {count} Notes
                              </span>
                            ) : (
                              <span className="text-zinc-600">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-zinc-300">
                            {formatRupee(denom * count)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Controls */}
              <div className="flex gap-4 pt-4 border-t border-zinc-900 justify-end">
                <button
                  type="button"
                  onClick={handleWithdrawalConfirm}
                  disabled={withdrawalSubmitting || withdrawalTotal <= 0 || !selectedCustomerId}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-600 border border-indigo-500/20 disabled:border-transparent text-white font-extrabold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(99,102,241,0.15)] cursor-pointer"
                >
                  {withdrawalSubmitting ? 'Recording Withdrawal...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
