"use client";

import React, { useState, useEffect } from 'react';
import { Coins, Calculator, CheckCircle2, ShieldAlert, Sparkles, FolderLock, X, Lock, Pencil, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { formatRupee } from '@/lib/utils';
import { Customer, GoldLoan, Profile } from '@/lib/mockData';

const GOLD_RATES = {
  '24k': 7200,
  '22k': 6600,
  '18k': 5400,
};

const LTV_RATIO = 0.75; // 75% Loan-To-Value

export default function GoldLoanModule() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<GoldLoan[]>([]);

  // Repayment Module States
  const [selectedRepayLoan, setSelectedRepayLoan] = useState<GoldLoan | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState<string>('');
  const [repaySubmitting, setRepaySubmitting] = useState(false);
  const [repayFeedback, setRepayFeedback] = useState('');

  // Manager-Only NPA and Notice States
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [noticeToast, setNoticeToast] = useState<string>('');

  // Manager CRUD overrides
  const [deleteTargetLoan, setDeleteTargetLoan] = useState<GoldLoan | null>(null);
  const [showDeleteLoanModal, setShowDeleteLoanModal] = useState(false);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);

  const [selectedEditLoan, setSelectedEditLoan] = useState<GoldLoan | null>(null);
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [isSubmittingLoanEdit, setIsSubmittingLoanEdit] = useState(false);
  const [overridePrincipal, setOverridePrincipal] = useState('');
  const [overridePaid, setOverridePaid] = useState('');
  const [overrideLocker, setOverrideLocker] = useState('');

  const handleDeleteLoan = async () => {
    if (!deleteTargetLoan) return;
    setIsDeletingLoan(true);
    try {
      await db.deleteGoldLoan(deleteTargetLoan.id);
      setLoans(prev => prev.filter(l => l.id !== deleteTargetLoan.id));
      setShowDeleteLoanModal(false);
      setDeleteTargetLoan(null);
      await db.createAuditLog(
        'Gold Loan Purged',
        `Permanently destructed ledger gold loan record: ${deleteTargetLoan.id} (Packet: ${deleteTargetLoan.packet_number})`,
        'GOLD_LOAN'
      );
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeletingLoan(false);
    }
  };

  const handleEditLoanOverride = async () => {
    if (!selectedEditLoan) return;
    setIsSubmittingLoanEdit(true);
    try {
      const principal = parseFloat(overridePrincipal) || 0;
      const paid = parseFloat(overridePaid) || 0;
      await db.updateGoldLoanDetails(selectedEditLoan.id, {
        loan_amount: principal,
        paid_amount: paid,
        locker_shelf_id: overrideLocker
      });
      const lList = await db.getGoldLoans();
      setLoans(lList);
      setShowEditLoanModal(false);
      setSelectedEditLoan(null);
      await db.createAuditLog(
        'Gold Loan Overridden',
        `Manager updated gold loan parameters for ${selectedEditLoan.customer_name}. Principal: ₹${principal}, Paid: ₹${paid}, Locker: ${overrideLocker}`,
        'GOLD_LOAN'
      );
    } catch (err) {
      console.error('Edit override failed:', err);
    } finally {
      setIsSubmittingLoanEdit(false);
    }
  };

  // Input states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [grossWeight, setGrossWeight] = useState<string>('');
  const [wasteWeight, setWasteWeight] = useState<string>('');
  const [purity, setPurity] = useState<'18k' | '22k' | '24k'>('22k');
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [lockerId, setLockerId] = useState('');
  const [packetNumber, setPacketNumber] = useState('');
  const [interestRate, setInterestRate] = useState('12');
  const [paybackMonths, setPaybackMonths] = useState('6');

  // Live calculation results
  const [netWeight, setNetWeight] = useState(0);
  const [maxLoanAmount, setMaxLoanAmount] = useState(0);
  const [totalPaybackAmount, setTotalPaybackAmount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const loadData = async () => {
    try {
      const cList = await db.getCustomers();
      // Only show verified customers for gold loan disbursements! Excellent business logic!
      setCustomers(cList.filter(c => c.status === 'VERIFIED'));
      
      const lList = await db.getGoldLoans();
      setLoans(lList);

      const user = await db.getActiveUser();
      setActiveProfile(user);
    } catch (err) {
      console.error('Error loading calculator data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling as a fallback

    const supabase = createBrowserSupabaseClient();
    if (!supabase) return () => clearInterval(interval);

    const channel = supabase
      .channel('realtime_gold_ledger')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gold_loans' },
        (payload: any) => {
          console.log('Real-time Gold Loan Change received!', payload);
          // Auto-fetch fresh data whenever any mutation occurs in the table
          loadData();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  // Overdue calculations helpers anchored to simulated today: May 22, 2026
  const SIMULATED_TODAY = new Date('2026-05-22T22:04:35+05:30');

  const getOverdueDays = (maturityDateStr?: string): number => {
    if (!maturityDateStr) return 0;
    const maturity = new Date(maturityDateStr);
    if (maturity >= SIMULATED_TODAY) return 0;
    const diffTime = Math.abs(SIMULATED_TODAY.getTime() - maturity.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getRiskStatus = (overdueDays: number): 'ACTIVE' | 'OVERDUE' | 'AUCTION_WARNING' => {
    if (overdueDays > 90) return 'AUCTION_WARNING';
    if (overdueDays > 0) return 'OVERDUE';
    return 'ACTIVE';
  };

  // Run live calculations on input changes
  useEffect(() => {
    const gross = parseFloat(grossWeight) || 0;
    const waste = parseFloat(wasteWeight) || 0;
    const calculatedNet = Math.max(0, gross - waste);
    setNetWeight(calculatedNet);

    const rate = GOLD_RATES[purity];
    const calculatedMaxLoan = Math.round(calculatedNet * rate * LTV_RATIO);
    setMaxLoanAmount(calculatedMaxLoan);

    // Pre-fill loan request amount if empty
    if (!requestedAmount || parseFloat(requestedAmount) > calculatedMaxLoan) {
      setRequestedAmount(calculatedMaxLoan.toString());
    }
  }, [grossWeight, wasteWeight, purity]);

  // Live calculation of interest and total payback amount
  useEffect(() => {
    const principal = parseFloat(requestedAmount) || 0;
    const ratePct = parseFloat(interestRate) || 0;
    const months = parseFloat(paybackMonths) || 0;
    
    // Simple Interest / EMI calculations
    const interest = principal * (ratePct / 100) * (months / 12);
    setTotalPaybackAmount(Math.round(principal + interest));
  }, [requestedAmount, interestRate, paybackMonths]);

  // Form Submit Handler
  const handleIssueLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg('');

    try {
      if (!selectedCustomerId) {
        throw new Error('Please select a verified customer.');
      }
      if (netWeight <= 0) {
        throw new Error('Net weight must be greater than 0g.');
      }
      const loanAmount = parseFloat(requestedAmount) || 0;
      if (loanAmount <= 0) {
        throw new Error('Please enter a valid loan request amount.');
      }
      if (loanAmount > maxLoanAmount) {
        throw new Error(`Requested amount exceeds maximum eligible LTV cap of ${formatRupee(maxLoanAmount)}.`);
      }
      if (!lockerId || !packetNumber) {
        throw new Error('Logistical shelf index and security packet numbers are mandatory.');
      }

      const supabase = createBrowserSupabaseClient();
      
      const mDate = new Date();
      mDate.setMonth(mDate.getMonth() + (parseInt(paybackMonths) || 6));

      if (supabase) {
        const { error } = await supabase.from('gold_loans').insert([{
          customer_id: selectedCustomerId,
          gross_weight: parseFloat(grossWeight),
          waste_weight: parseFloat(wasteWeight),
          net_weight: netWeight,
          purity,
          loan_amount: loanAmount,
          locker_shelf_id: lockerId,
          packet_number: packetNumber,
          status: 'ACTIVE',
          maturity_date: mDate.toISOString(),
          interest_rate: parseFloat(interestRate) || 12,
          payback_months: parseInt(paybackMonths) || 6,
          total_payback_amount: totalPaybackAmount
        }]);

        if (error) throw new Error(error.message);
      } else {
        // Fallback for demo mock mode
        await db.createGoldLoan({
          customer_id: selectedCustomerId,
          gross_weight: parseFloat(grossWeight),
          waste_weight: parseFloat(wasteWeight),
          net_weight: netWeight,
          purity,
          gold_rate_per_gram: GOLD_RATES[purity],
          max_eligible_amount: maxLoanAmount,
          loan_amount: loanAmount,
          locker_shelf_id: lockerId,
          packet_number: packetNumber,
          interest_rate: parseFloat(interestRate) || 12,
          payback_months: parseInt(paybackMonths) || 6,
          total_payback_amount: totalPaybackAmount
        });
      }

      setFeedbackMsg(`Success! Gold Loan of ${formatRupee(loanAmount)} disbursed successfully.`);
      
      // Reset inputs
      setSelectedCustomerId('');
      setGrossWeight('');
      setWasteWeight('');
      setRequestedAmount('');
      setLockerId('');
      setPacketNumber('');
      setInterestRate('12');
      setPaybackMonths('6');

      loadData();
      
      setTimeout(() => {
        setFeedbackMsg('');
      }, 3000);

    } catch (err: any) {
      setFeedbackMsg(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepayLoan) return;

    setRepaySubmitting(true);
    setRepayFeedback('');

    try {
      const amount = parseFloat(repaymentAmount) || 0;
      if (amount <= 0) {
        throw new Error('Please enter a valid repayment amount greater than 0.');
      }
      
      const prevPaid = selectedRepayLoan.paid_amount || 0;
      const remainingLimit = selectedRepayLoan.loan_amount - prevPaid;
      if (amount > remainingLimit) {
        throw new Error(`Repayment exceeds the remaining balance of ${formatRupee(remainingLimit)}.`);
      }

      await db.submitRepayment(selectedRepayLoan.id, amount);
      
      setRepayFeedback(`Repayment of ${formatRupee(amount)} recorded successfully!`);
      setRepaymentAmount('');
      
      // Auto-fetch and instantly refresh state
      await loadData();

      setTimeout(() => {
        setRepayFeedback('');
        setSelectedRepayLoan(null);
      }, 1500);

    } catch (err: any) {
      setRepayFeedback(`Error: ${err.message}`);
    } finally {
      setRepaySubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-100 display-font">Gold Loan Appraisal Desk</h2>
        <p className="text-sm text-zinc-400 mt-0.5">Foolproof LTV weight calculation, collateral evaluations, and locker assignment.</p>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl border text-sm font-semibold ${
          feedbackMsg.startsWith('Error') 
            ? 'bg-red-950/20 border-red-900/50 text-red-300' 
            : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
        }`}>
          {feedbackMsg}
        </div>
      )}

      {/* SPLIT SCREEN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT SIDE: INPUT APPRAISAL FORM */}
        <div className="lg:col-span-7 glass-panel p-6 md:p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-6">
            <Calculator className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-zinc-100 display-font">Collateral Intake Parameters</h3>
          </div>

          <form onSubmit={handleIssueLoan} className="space-y-6">
            {/* Customer Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Select Verified Customer
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
              >
                <option value="">-- Choose verified customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone} | PAN: {c.pan_number})
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="text-[10px] text-amber-400 font-medium mt-1">
                  ⚠️ Note: No verified customers found. Complete KYC first and approve customer status.
                </p>
              )}
            </div>

            {/* WEIGHT INPUTS (MASSIVE NUMBERS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Gross Weight (Grams)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xl font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-100 placeholder-zinc-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Stone / Waste Weight (Grams)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={wasteWeight}
                  onChange={(e) => setWasteWeight(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xl font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-100 placeholder-zinc-700"
                />
              </div>
            </div>

            {/* PURITY & LOAN DISBURSEMENT INPUT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Gold Purity Standard
                </label>
                <select
                  value={purity}
                  onChange={(e: any) => setPurity(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
                >
                  <option value="24k">24 Karat (Rate: ₹7,200/g)</option>
                  <option value="22k">22 Karat (Rate: ₹6,600/g)</option>
                  <option value="18k">18 Karat (Rate: ₹5,400/g)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Requested Disbursement Amount (₹)
                </label>
                <input
                  type="number"
                  placeholder="Enter disbursement"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  max={maxLoanAmount}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-emerald-400 placeholder-zinc-700"
                />
              </div>
            </div>

            {/* INTEREST RATE & PAYBACK MONTHS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Interest Rate (% Per Annum)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    placeholder="12.0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-10 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-400 placeholder-zinc-700"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Payback Period (Months)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="6"
                    value={paybackMonths}
                    onChange={(e) => setPaybackMonths(e.target.value)}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-16 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-400 placeholder-zinc-700"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500 uppercase">Months</span>
                </div>
              </div>
            </div>

            {/* LIVE AUTO-CALCULATED PAYBACK DETAILS */}
            <div className="p-4 bg-indigo-950/10 border border-indigo-500/20 rounded-2xl space-y-2.5">
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                <Calculator className="h-3.5 w-3.5" />
                Live Payback Projection (Auto Calculated)
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[9px] font-bold text-zinc-500 uppercase">Monthly EMI Amount</span>
                  <span className="text-sm font-black text-indigo-400 font-mono">
                    {paybackMonths && parseFloat(paybackMonths) > 0
                      ? formatRupee(Math.round(totalPaybackAmount / parseFloat(paybackMonths)))
                      : formatRupee(0)}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-zinc-500 uppercase">Total Payback (Principal + Interest)</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">
                    {formatRupee(totalPaybackAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* LOGISTICAL CONTROLS */}
            <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-2xl">
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mb-3">
                <FolderLock className="h-3.5 w-3.5" />
                Physical Vault Logistics
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Locker Shelf Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Locker B - Shelf 3"
                    value={lockerId}
                    onChange={(e) => setLockerId(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Collateral Packet Tag ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PKT-2026-0043"
                    value={packetNumber}
                    onChange={(e) => setPacketNumber(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-200"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            {activeProfile?.role === 'manager' ? (
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 px-6 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-emerald-500/35 cursor-pointer active:scale-95 flex items-center justify-center gap-2 select-none"
              >
                <Coins className="h-5 w-5" />
                <span>Authorize & Issue New Gold Loan</span>
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full bg-zinc-850 border border-zinc-800 text-zinc-500 font-extrabold py-4 px-6 rounded-2xl text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed select-none"
                >
                  <Lock className="h-4 w-4 text-zinc-500" />
                  <span>Authorize & Issue New Gold Loan</span>
                </button>
                <p className="text-[11px] text-zinc-500 text-center font-semibold flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3" /> Privileged action. Access restricted to Manager role.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* RIGHT SIDE: LIVE CALCULATION VALUATION CARD */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-panel glass-panel-glow-emerald p-6 md:p-8 rounded-3xl text-zinc-100 flex-1 flex flex-col justify-between relative overflow-hidden">
            {/* Glowing background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%) pointer-events-none" />

            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-6">
                <Sparkles className="h-4 w-4" />
                Live Valuation Engine
              </div>

              {/* Formula calculations */}
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Net Weight Yield</p>
                  <h4 className="text-3xl font-extrabold text-zinc-100 display-font mt-1">
                    {netWeight.toFixed(2)} <span className="text-zinc-500 text-lg">grams</span>
                  </h4>
                  <p className="text-[10px] text-zinc-600 font-medium mt-0.5">Calculated as (Gross Weight - Waste Weight)</p>
                </div>

                <div className="border-t border-zinc-900 pt-4">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Today's Gold Rate ({purity.toUpperCase()})</p>
                  <h4 className="text-2xl font-extrabold text-zinc-200 display-font mt-1">
                    {formatRupee(GOLD_RATES[purity])} <span className="text-zinc-500 text-sm">/ gram</span>
                  </h4>
                </div>

                <div className="border-t border-zinc-900 pt-4">
                  <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Standard RBI Loan-To-Value (LTV)</p>
                  <h4 className="text-lg font-bold text-zinc-300 display-font mt-1">
                    {(LTV_RATIO * 100).toFixed(0)}% <span className="text-zinc-500 text-xs">of market valuation</span>
                  </h4>
                </div>
              </div>
            </div>

            {/* MAX ELIGIBLE LOAN AMOUNT */}
            <div className="border-t border-zinc-900 pt-6 mt-8">
              <p className="text-xs text-emerald-400/80 font-bold uppercase tracking-wider">Maximum Eligible Loan Disbursal</p>
              <h1 className="text-4xl md:text-5xl font-black text-emerald-400 display-font tracking-tight mt-1 drop-shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                {formatRupee(maxLoanAmount)}
              </h1>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-2">
                JRINA Cryptographically Authorized Cap
              </p>
            </div>
          </div>

          {/* QUICK REFERENCE SUMMARY INFO */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-900">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Valuation Reference Parameters</h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li className="flex justify-between">
                <span>Gold valuation base rate (24K)</span>
                <span className="font-mono text-zinc-300">₹7,200/g</span>
              </li>
              <li className="flex justify-between">
                <span>Gold valuation base rate (22K)</span>
                <span className="font-mono text-zinc-300">₹6,600/g</span>
              </li>
              <li className="flex justify-between">
                <span>Gold valuation base rate (18K)</span>
                <span className="font-mono text-zinc-300">₹5,400/g</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* LOAN REGISTER LEDGER (Chronological overview) */}
      <div className="glass-panel p-6 rounded-2xl border border-zinc-900 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="text-lg font-bold text-zinc-100 display-font">Active Disbursed Loans</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Click on any active gold loan row to submit repayments instantly.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900/60 border-b border-zinc-900 text-zinc-500 font-bold text-xs uppercase tracking-wider">
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Collateral Metrics</th>
                <th className="px-4 py-3">Locker Shelf & Packet</th>
                <th className="px-4 py-3">Total Loan</th>
                <th className="px-4 py-3">Paid Amount</th>
                <th className="px-4 py-3">Remaining Balance</th>
                <th className="px-4 py-3">Paid Progress (%)</th>
                <th className="px-4 py-3 text-right">Issuance Date</th>
                {activeProfile?.role === 'manager' && (
                  <th className="px-4 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {loans.map((loan) => {
                const paid = loan.paid_amount || 0;
                const remaining = loan.remaining_balance !== undefined ? loan.remaining_balance : loan.loan_amount;
                const pct = loan.paid_percentage || 0;

                return (
                  <tr 
                    key={loan.id} 
                    onClick={() => setSelectedRepayLoan(loan)}
                    className="hover:bg-zinc-900/40 transition-colors cursor-pointer active:scale-[0.99]"
                  >
                    <td className="px-4 py-4 font-bold text-zinc-200">
                      <div className="flex flex-col">
                        <span>{loan.customer_name}</span>
                        {loan.interest_rate !== undefined && (
                          <span className="text-[9px] text-indigo-400 font-extrabold tracking-wide mt-0.5">
                            % Rate: {loan.interest_rate}% | Term: {loan.payback_months} Months
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500 font-normal mt-0.5">Click to record payment</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-zinc-300">{loan.net_weight}g</span>
                      <span className="text-zinc-500 font-semibold text-xs ml-1 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                        {loan.purity.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs">
                        <p className="font-bold text-zinc-300">{loan.locker_shelf_id}</p>
                        <p className="text-zinc-500 font-mono mt-0.5">{loan.packet_number}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-extrabold text-zinc-200">
                      {formatRupee(loan.loan_amount)}
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-400">
                      {formatRupee(paid)}
                    </td>
                    <td className="px-4 py-4 font-bold text-amber-400">
                      {formatRupee(remaining)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="w-24 sm:w-32 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-zinc-400">
                          <span>{pct}%</span>
                          <span>Paid</span>
                        </div>
                        <div className="w-full bg-zinc-900 border border-zinc-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-xs text-zinc-500 font-medium select-none">
                      {new Date(loan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    {activeProfile?.role === 'manager' && (
                      <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedEditLoan(loan);
                              setOverridePrincipal(loan.loan_amount.toString());
                              setOverridePaid(loan.paid_amount?.toString() || '0');
                              setOverrideLocker(loan.locker_shelf_id);
                              setShowEditLoanModal(true);
                            }}
                            className="p-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Edit Loan Record"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTargetLoan(loan);
                              setShowDeleteLoanModal(true);
                            }}
                            className="p-1.5 bg-red-950/20 hover:bg-red-900/20 border border-red-500/30 hover:border-red-500/50 text-red-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Delete Loan Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {loans.length === 0 && (
                <tr>
                  <td colSpan={activeProfile?.role === 'manager' ? 9 : 8} className="text-center py-6 text-zinc-500">No active loans issued.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REPAYMENT OVERLAY DIALOG MODAL */}
      {selectedRepayLoan && (() => {
        const paid = selectedRepayLoan.paid_amount || 0;
        const remaining = selectedRepayLoan.remaining_balance !== undefined ? selectedRepayLoan.remaining_balance : selectedRepayLoan.loan_amount;
        const pct = selectedRepayLoan.paid_percentage || 0;

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
              
              {/* Close [X] */}
              <button
                onClick={() => {
                  setSelectedRepayLoan(null);
                  setRepayFeedback('');
                  setRepaymentAmount('');
                }}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-4">
                <Coins className="h-5 w-5 text-emerald-400" />
                <h3 className="text-xl font-bold text-zinc-100 display-font">Submit Loan Repayment</h3>
              </div>

              {/* Dynamic Feedback Msg */}
              {repayFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${
                  repayFeedback.startsWith('Error')
                    ? 'bg-red-950/20 border-red-900/50 text-red-300'
                    : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                }`}>
                  {repayFeedback}
                </div>
              )}

              {/* Loan Details Card */}
              <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-2xl space-y-3.5">
                <div>
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">Customer Profile</span>
                  <h4 className="text-base font-bold text-zinc-200">{selectedRepayLoan.customer_name}</h4>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-900/60 pt-3">
                  <div>
                    <span className="block text-[9px] font-extrabold uppercase tracking-widest text-zinc-500">Disbursed Principal</span>
                    <p className="font-extrabold text-zinc-300">{formatRupee(selectedRepayLoan.loan_amount)}</p>
                  </div>
                  <div>
                    <span className="block text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">Total Settled</span>
                    <p className="font-extrabold text-emerald-400">{formatRupee(paid)} ({pct}%)</p>
                  </div>
                </div>

                <div className="border-t border-zinc-900/60 pt-3">
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-amber-400">Outstanding Liability Balance</span>
                  <p className="text-xl font-black text-amber-400 mt-0.5">{formatRupee(remaining)}</p>
                </div>
              </div>

              {/* Repayment Form */}
              <form onSubmit={handleRepaySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Enter Repayment Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={remaining}
                    placeholder="Enter amount to pay..."
                    value={repaymentAmount}
                    onChange={(e) => setRepaymentAmount(e.target.value)}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-400 placeholder-zinc-700"
                  />
                </div>

                {/* Controls */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={repaySubmitting || remaining <= 0}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] active:scale-95 cursor-pointer"
                  >
                    {repaySubmitting ? 'Recording Repayment...' : '[ Submit Payment ]'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRepayLoan(null);
                      setRepayFeedback('');
                      setRepaymentAmount('');
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-semibold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>

            </div>
          </div>
        );
      })()}

      {/* MANAGER ONLY: NPA & AUCTION RISK MANAGEMENT DESK */}
      {activeProfile?.role === 'manager' && (
        <div className="glass-panel p-6 rounded-2xl border border-red-950/20 bg-zinc-950/30 space-y-6 relative overflow-hidden mt-8">
          {/* Subtle glow warning decoration */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-500">EXECUTIVE MANAGER CONSOLE</span>
              <h3 className="text-xl font-extrabold text-zinc-100 display-font mt-0.5">NPA & Auction Risk Management Desk</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Real-time credit risk parameters, maturity checks, and default listing assets.</p>
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 text-[10px] font-extrabold text-red-400 rounded-full w-fit">
              <ShieldAlert className="h-3.5 w-3.5 animate-pulse" />
              RISK MONITOR ACTIVE
            </div>
          </div>

          {/* NPA & MATURITY LOGIC TABLE */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Branch Credit Portfolio Risk Status</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-900/40 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="px-4 py-2.5">Customer / Packet</th>
                    <th className="px-4 py-2.5">Maturity Date</th>
                    <th className="px-4 py-2.5">Overdue Days</th>
                    <th className="px-4 py-2.5">Outstanding Balance</th>
                    <th className="px-4 py-2.5 text-right">Risk Status Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {loans.map((loan) => {
                    const overdue = getOverdueDays(loan.maturity_date);
                    const status = getRiskStatus(overdue);
                    const remaining = loan.remaining_balance !== undefined ? loan.remaining_balance : loan.loan_amount;

                    return (
                      <tr 
                        key={loan.id}
                        className={`transition-colors ${
                          status === 'AUCTION_WARNING' 
                            ? 'bg-red-950/20 hover:bg-red-950/30' 
                            : status === 'OVERDUE' 
                            ? 'bg-amber-950/20 hover:bg-amber-950/30' 
                            : 'hover:bg-zinc-900/20'
                        }`}
                      >
                        <td className="px-4 py-3 font-bold text-zinc-300">
                          <div>
                            <p>{loan.customer_name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{loan.packet_number}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 font-medium">
                          {loan.maturity_date 
                            ? new Date(loan.maturity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-bold">
                          {overdue > 0 ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              status === 'AUCTION_WARNING'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/20 animate-pulse'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            }`}>
                              {overdue} Days Overdue
                            </span>
                          ) : (
                            <span className="text-zinc-500 font-normal">0 Days (Current)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-zinc-300">
                          {formatRupee(remaining)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-widest uppercase border ${
                            status === 'AUCTION_WARNING'
                              ? 'bg-red-950 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                              : status === 'OVERDUE'
                              ? 'bg-amber-950 text-amber-400 border-amber-500/30'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          }`}>
                            {status === 'AUCTION_WARNING' ? 'Auction Warning' : status === 'OVERDUE' ? 'Overdue' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* UPCOMING AUCTIONS SUB-TABLE */}
          <div className="border-t border-zinc-900 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Upcoming Gold Collateral Auctions (Overdue &gt; 90 Days)
              </h4>
              <span className="text-[10px] text-zinc-500 font-mono">
                Rule: Overdue Days &gt; 90
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-red-950/10 border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="px-4 py-2.5">Packet Tag</th>
                    <th className="px-4 py-2.5">Locker ID</th>
                    <th className="px-4 py-2.5">Collateral Weights</th>
                    <th className="px-4 py-2.5">Principal Amount Due</th>
                    <th className="px-4 py-2.5">Auction Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {loans.filter(l => getOverdueDays(l.maturity_date) > 90).map((loan) => {
                    const remaining = loan.remaining_balance !== undefined ? loan.remaining_balance : loan.loan_amount;
                    return (
                      <tr key={loan.id} className="hover:bg-red-950/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-red-400">{loan.packet_number}</td>
                        <td className="px-4 py-3 text-zinc-300 font-medium">{loan.locker_shelf_id}</td>
                        <td className="px-4 py-3 text-zinc-400">
                          {loan.gross_weight}g Gross / <span className="text-zinc-200 font-bold">{loan.net_weight}g Net</span>
                        </td>
                        <td className="px-4 py-3 font-extrabold text-red-300">{formatRupee(remaining)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold bg-red-950 text-red-500 border border-red-500/20">
                            LISTED FOR AUCTION
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setNoticeToast(`Success! Legal repayment warning notice has been cryptographically dispatched for packet ${loan.packet_number} and routed to customer.`);
                              setTimeout(() => setNoticeToast(''), 4000);
                            }}
                            className="bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-500/20 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Issue Legal Notice
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {loans.filter(l => getOverdueDays(l.maturity_date) > 90).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-zinc-500 font-normal">
                        No active loans listed for liquidation. Excellent risk health status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Notice dispatch floating Card */}
          {noticeToast && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-300 shadow-[0_4px_20px_rgba(16,185,129,0.15)] animate-bounce w-full">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{noticeToast}</span>
              </div>
              <button 
                onClick={() => setNoticeToast('')}
                className="text-emerald-400 hover:text-emerald-300 font-bold p-1 rounded-full hover:bg-emerald-900/20"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* MANAGER DELETE LOAN CONFIRMATION DIALOG */}
      {showDeleteLoanModal && deleteTargetLoan && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
            <button
              onClick={() => {
                setShowDeleteLoanModal(false);
                setDeleteTargetLoan(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
              <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-100 display-font uppercase tracking-wider">
                Destruct Ledger Record?
              </h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-950/10 border border-red-500/25 rounded-2xl space-y-2">
                <span className="block text-[9px] uppercase tracking-widest text-red-400 font-extrabold">Warning: Critical Administrative Action</span>
                <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                  Confirm permanent destruction of gold loan record for <span className="text-white font-extrabold">{deleteTargetLoan.customer_name}</span>?
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-normal">
                  Permanent destruction of ledger parameters cannot be undone. This operation will globally purge all client profile associations from the workspace core database.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteLoanModal(false);
                  setDeleteTargetLoan(null);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLoan}
                disabled={isDeletingLoan}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(239,68,68,0.2)] cursor-pointer active:scale-95 disabled:opacity-40 select-none"
              >
                {isDeletingLoan ? 'Purging...' : 'Destroy Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER GOLD LOAN EDIT OVERRIDE DIALOG */}
      {showEditLoanModal && selectedEditLoan && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
            <button
              onClick={() => {
                setShowEditLoanModal(false);
                setSelectedEditLoan(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
              <Pencil className="h-5 w-5 text-indigo-400 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-100 display-font uppercase tracking-wider">
                Override Loan Parameters
              </h3>
            </div>

            <div className="space-y-4">
              {/* Total Loan Amount */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Total Principal Loan Amount (₹)</label>
                <input
                  type="number"
                  value={overridePrincipal}
                  onChange={(e) => setOverridePrincipal(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              {/* Paid Amount */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Paid / Settled Amount (₹)</label>
                <input
                  type="number"
                  value={overridePaid}
                  onChange={(e) => setOverridePaid(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              {/* Locker shelf id */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Locker Cabinet Location (Shelf ID)</label>
                <input
                  type="text"
                  value={overrideLocker}
                  onChange={(e) => setOverrideLocker(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditLoanModal(false);
                  setSelectedEditLoan(null);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditLoanOverride}
                disabled={isSubmittingLoanEdit || !overridePrincipal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] cursor-pointer active:scale-95 disabled:opacity-40 select-none"
              >
                {isSubmittingLoanEdit ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
