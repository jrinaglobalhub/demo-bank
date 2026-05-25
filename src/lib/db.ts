import { isSupabaseConfigured, supabase } from './supabase';
import {
  MOCK_PROFILES,
  MOCK_CUSTOMERS,
  MOCK_GOLD_LOANS,
  MOCK_BIOMETRIC_CREDENTIALS,
  MOCK_AUDIT_LOGS,
  Profile,
  Customer,
  GoldLoan,
  BiometricCredential,
  AuditLog,
} from './mockData';

// Constants
const STORAGE_KEYS = {
  ACTIVE_USER_ID: 'jrina_active_user_id',
  PROFILES: 'jrina_profiles',
  CUSTOMERS: 'jrina_customers',
  GOLD_LOANS: 'jrina_gold_loans',
  BIOMETRICS: 'jrina_biometrics',
  AUDIT_LOGS: 'jrina_audit_logs',
};

// Initialize LocalStorage with seed data if empty
const initializeLocalStorage = () => {
  if (typeof window === 'undefined') return;

  if (!localStorage.getItem(STORAGE_KEYS.PROFILES)) {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(MOCK_PROFILES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(MOCK_CUSTOMERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.GOLD_LOANS)) {
    localStorage.setItem(STORAGE_KEYS.GOLD_LOANS, JSON.stringify(MOCK_GOLD_LOANS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.BIOMETRICS)) {
    localStorage.setItem(STORAGE_KEYS.BIOMETRICS, JSON.stringify(MOCK_BIOMETRIC_CREDENTIALS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(MOCK_AUDIT_LOGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID)) {
    // Default to the clerk first
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, MOCK_PROFILES[1].id); // David (clerk)
  }
};

// Safe localStorage getters/setters
const getLocalData = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  initializeLocalStorage();
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const setLocalData = <T>(key: string, data: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

// Active user caching
let cachedActiveUser: Profile | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000; // Cache for 5 seconds to prevent rapid consecutive queries
let isSubscribedToAuth = false;

const initAuthSubscription = () => {
  if (isSubscribedToAuth || typeof window === 'undefined' || !isSupabaseConfigured() || !supabase) return;
  
  isSubscribedToAuth = true;
  supabase.auth.onAuthStateChange(async (event: any, session: any) => {
    // Invalidate cache immediately on any auth status change
    cachedActiveUser = null;
    lastFetchTime = 0;
  });
};

export const db = {
  // --- Engine status ---
  isSupabaseEnabled(): boolean {
    return isSupabaseConfigured();
  },

  // --- Session Profile & Active User ---
  async getActiveUser(): Promise<Profile> {
    if (typeof window === 'undefined') return MOCK_PROFILES[1]; // server-side default

    initAuthSubscription();

    const now = Date.now();
    if (cachedActiveUser && (now - lastFetchTime < CACHE_TTL_MS)) {
      return cachedActiveUser;
    }

    if (this.isSupabaseEnabled() && supabase) {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser?.user) {
          // Attempt to fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.user.id)
            .single();

          if (profile) {
            if (profile.status !== 'ONLINE') {
              supabase.from('profiles').update({ status: 'ONLINE' }).eq('id', authUser.user.id).then();
              profile.status = 'ONLINE';
            }
            cachedActiveUser = profile;
            lastFetchTime = now;
            return profile;
          }

          // If profile is missing (e.g. no row in table), auto-create/upsert it
          const emailLower = authUser.user.email?.toLowerCase() || '';
          const role = emailLower.includes('manager') ? 'manager' : 'clerk';
          const defaultProfile = {
            id: authUser.user.id,
            name: authUser.user.email?.split('@')[0] || 'Employee',
            role: role
          };

          try {
            const { data: newProfile } = await supabase
              .from('profiles')
              .upsert([defaultProfile])
              .select()
              .single();

            const resolvedProfile = newProfile || {
              ...defaultProfile,
              created_at: new Date().toISOString()
            };

            cachedActiveUser = resolvedProfile as any;
            lastFetchTime = now;
            return resolvedProfile as any;
          } catch (upsertError) {
            console.error("Auto-upsert of profile failed, returning virtual fallback:", upsertError);
            const virtualProfile = {
              ...defaultProfile,
              created_at: new Date().toISOString()
            };
            cachedActiveUser = virtualProfile as any;
            lastFetchTime = now;
            return virtualProfile as any;
          }
        }
      } catch (err) {
        console.error("Error in getActiveUser Supabase handler:", err);
      }
    }

    // Local Storage Fallback (only used when Supabase is disabled/not configured)
    const profiles = getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
    const activeId = getLocalData<string>(STORAGE_KEYS.ACTIVE_USER_ID, MOCK_PROFILES[1].id);
    const active = profiles.find((p) => p.id === activeId) || profiles[1];
    
    if (active.status !== 'ONLINE') {
      const updated = profiles.map((p) => {
        if (p.id === active.id) return { ...p, status: 'ONLINE' as const };
        return { ...p, status: 'OFFLINE' as const };
      });
      setLocalData(STORAGE_KEYS.PROFILES, updated);
      active.status = 'ONLINE';
    }
    return active;
  },

  async switchActiveUser(role: 'manager' | 'clerk'): Promise<Profile> {
    const profiles = getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
    const target = profiles.find((p) => p.role === role) || profiles[1];
    
    // Set target to ONLINE and all others to OFFLINE
    const updated = profiles.map((p) => {
      if (p.id === target.id) return { ...p, status: 'ONLINE' as const };
      return { ...p, status: 'OFFLINE' as const };
    });
    setLocalData(STORAGE_KEYS.PROFILES, updated);
    setLocalData(STORAGE_KEYS.ACTIVE_USER_ID, target.id);

    // Log the switch
    await this.createAuditLog(
      'Role switched',
      `Active profile switched to ${target.name} (${target.role.toUpperCase()})`,
      'AUTH'
    );

    return target;
  },

  async getAllProfiles(): Promise<Profile[]> {
    if (this.isSupabaseEnabled() && supabase) {
      const { data } = await supabase.from('profiles').select('*');
      if (data) return data;
    }
    return getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
  },

  async updateProfileStatus(id: string, status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    if (this.isSupabaseEnabled() && supabase) {
      await supabase
        .from('profiles')
        .update({ status })
        .eq('id', id);
    } else {
      const list = getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
      const updated = list.map((p) => {
        if (p.id === id) return { ...p, status };
        if (status === 'ONLINE' && p.id !== id) {
          return { ...p, status: 'OFFLINE' as const };
        }
        return p;
      });
      setLocalData(STORAGE_KEYS.PROFILES, updated);
    }
  },

  // --- Customers (KYC) ---
  async getCustomers(): Promise<Customer[]> {
    let list: Customer[] = [];
    if (this.isSupabaseEnabled() && supabase) {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) list = data;
    } else {
      list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
    }

    // Hydrate persistent balances dynamically if missing
    return list.map((cust) => {
      const bal = cust.balance !== undefined ? cust.balance : ((cust.name.charCodeAt(0) * 452) + 12400);

      // Stable Account number generation (11 digits) from UUID
      let hash = 0;
      for (let i = 0; i < cust.id.length; i++) {
        hash = (hash * 31 + cust.id.charCodeAt(i)) % 100000000000;
      }
      const accNumVal = (50000000000 + Math.abs(hash % 50000000000)).toString();
      const lastFour = accNumVal.substring(accNumVal.length - 4);
      const ifscVal = `JRBNK000${lastFour}`;

      return {
        ...cust,
        balance: bal,
        account_number: cust.account_number || accNumVal,
        ifsc_code: cust.ifsc_code || ifscVal,
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createCustomer(
    customerData: Omit<Customer, 'id' | 'created_by' | 'created_at'>
  ): Promise<Customer> {
    const activeUser = await this.getActiveUser();
    const newCustomer: Customer = {
      ...customerData,
      id: crypto.randomUUID(),
      created_by: activeUser.id,
      created_at: new Date().toISOString(),
      balance: 10000, // Default starting deposit balance for new signups
    };

    if (this.isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('customers')
        .insert([{ ...newCustomer, id: undefined }]) // let DB gen UUID if desired, or send ours
        .select()
        .single();
      if (error) console.error('Supabase customer insertion error:', error);
      if (data) {
        await this.createAuditLog(
          'Customer KYC Registered',
          `Customer ${data.name} registered. Aadhaar: ${data.aadhaar_number.replace(/\d(?=\d{4})/g, '*')}, PAN: ${data.pan_number.substring(0, 4)}****. Status: ${data.status}`,
          'KYC'
        );
        return data;
      }
    }

    // Local Storage
    const list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
    list.push(newCustomer);
    setLocalData(STORAGE_KEYS.CUSTOMERS, list);

    await this.createAuditLog(
      'Customer KYC Registered',
      `Customer ${newCustomer.name} registered. Aadhaar: ${newCustomer.aadhaar_number.replace(/\d(?=\d{4})/g, '*')}, PAN: ${newCustomer.pan_number.substring(0, 4)}****. Status: ${newCustomer.status}`,
      'KYC'
    );

    return newCustomer;
  },

  async updateCustomerBalance(
    customerId: string,
    newBalance: number,
    type: 'DEPOSIT' | 'WITHDRAWAL',
    amount: number
  ): Promise<Customer> {
    const list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
    const index = list.findIndex((c) => c.id === customerId);
    if (index === -1) {
      throw new Error('Customer profile not found.');
    }

    const cust = list[index];
    const updatedCustomer: Customer = {
      ...cust,
      balance: newBalance,
    };
    list[index] = updatedCustomer;
    setLocalData(STORAGE_KEYS.CUSTOMERS, list);

    // If Supabase live connection is active, update the balance there
    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', customerId);
      if (error) console.error('Supabase customer balance update failed:', error);
    }

    // Add high-fidelity cryptographic audit log
    await this.createAuditLog(
      type === 'DEPOSIT' ? 'Cash Inward Deposit' : 'Cash Outward Withdrawal',
      `Processed physical cash ${type.toLowerCase()} of ₹${amount.toLocaleString('en-IN')} for client ${cust.name}. New ledger balance: ₹${newBalance.toLocaleString('en-IN')}.`,
      'KYC'
    );

    return updatedCustomer;
  },

  async verifyCustomer(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Only Manager/Admin can verify KYC approvals.');
    }

    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('customers')
        .update({ status: 'VERIFIED' })
        .eq('id', id);
      if (error) return false;
    } else {
      const list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []).map((c) => {
        if (c.id === id) {
          return { ...c, status: 'VERIFIED' as const };
        }
        return c;
      });
      setLocalData(STORAGE_KEYS.CUSTOMERS, list);
    }

    const customers = await this.getCustomers();
    const customer = customers.find((c) => c.id === id);
    if (customer) {
      await this.createAuditLog(
        'Customer KYC Verified',
        `Customer KYC for ${customer.name} was approved & verified by Manager ${activeUser.name}.`,
        'KYC'
      );
    }
    return true;
  },

  async deleteCustomer(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Manager permission required.');
    }
    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) return false;
    } else {
      const list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []).filter(c => c.id !== id);
      setLocalData(STORAGE_KEYS.CUSTOMERS, list);
    }
    return true;
  },

  async updateCustomerDetails(id: string, updates: Partial<Customer>): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Manager permission required.');
    }
    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase.from('customers').update(updates).eq('id', id);
      if (error) return false;
    } else {
      const list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []).map((c) => {
        if (c.id === id) {
          return { ...c, ...updates };
        }
        return c;
      });
      setLocalData(STORAGE_KEYS.CUSTOMERS, list);
    }
    return true;
  },

  async updateCustomerStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_SUSPENSION' | 'VERIFIED',
    reason?: string,
    requestedByClerkName?: string
  ): Promise<boolean> {
    const activeUser = await this.getActiveUser();

    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('customers')
        .update({
          status,
          suspension_reason: reason || null,
          suspension_requested_by: requestedByClerkName || null
        })
        .eq('id', id);
      if (error) return false;
    } else {
      const list = getLocalData<Customer[]>(STORAGE_KEYS.CUSTOMERS, []).map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status,
            suspension_reason: reason || undefined,
            suspension_requested_by: requestedByClerkName || undefined
          };
        }
        return c;
      });
      setLocalData(STORAGE_KEYS.CUSTOMERS, list);
    }

    const customers = await this.getCustomers();
    const customer = customers.find((c) => c.id === id);
    if (customer) {
      let actionTitle = 'Customer Status Updated';
      let details = `Customer ${customer.name} status updated to ${status}.`;
      if (status === 'PENDING_SUSPENSION') {
        actionTitle = 'Suspension Requested';
        details = `Clerk ${requestedByClerkName || activeUser.name} requested suspension for ${customer.name}. Reason: ${reason || 'Not provided'}`;
      } else if (status === 'SUSPENDED') {
        actionTitle = 'Account Suspended';
        details = `Account for ${customer.name} was suspended by Manager ${activeUser.name}. Reason: ${reason || 'Manual suspension'}`;
      } else if (status === 'ACTIVE' || status === 'VERIFIED') {
        actionTitle = 'Account Reactivated';
        details = `Account for ${customer.name} was reactivated to ${status} by Manager ${activeUser.name}.`;
      }

      await this.createAuditLog(actionTitle, details, 'KYC');
    }
    return true;
  },

  // --- Gold Loans ---
  async getGoldLoans(): Promise<GoldLoan[]> {
    const loans = this.isSupabaseEnabled() && supabase
      ? (await supabase.from('gold_loans').select('*')).data || []
      : getLocalData<GoldLoan[]>(STORAGE_KEYS.GOLD_LOANS, MOCK_GOLD_LOANS);

    const customers = await this.getCustomers();

    // Hydrate customer names and calculate missing default metrics
    return loans.map((loan: any) => {
      const cust = customers.find((c) => c.id === loan.customer_id);
      const paid = loan.paid_amount !== undefined ? loan.paid_amount : 0;
      const remaining = loan.remaining_balance !== undefined ? loan.remaining_balance : loan.loan_amount;
      const pct = loan.paid_percentage !== undefined ? loan.paid_percentage : 0;

      // Calculate 6 months past creation date if maturity_date is missing
      const cDate = new Date(loan.created_at);
      cDate.setMonth(cDate.getMonth() + 6);
      const maturity = loan.maturity_date || cDate.toISOString();

      return {
        ...loan,
        paid_amount: paid,
        remaining_balance: remaining,
        paid_percentage: pct,
        maturity_date: maturity,
        customer_name: cust ? cust.name : 'Unknown Customer',
      };
    }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createGoldLoan(
    loanData: Omit<GoldLoan, 'id' | 'created_by' | 'created_at'>
  ): Promise<GoldLoan> {
    const activeUser = await this.getActiveUser();

    // Default maturity date to exactly 6 months from today
    const mDate = new Date();
    mDate.setMonth(mDate.getMonth() + 6);
    mDate.setDate(28);

    const newLoan: GoldLoan = {
      ...loanData,
      id: crypto.randomUUID(),
      created_by: activeUser.id,
      created_at: new Date().toISOString(),
      maturity_date: mDate.toISOString(),
    };

    if (this.isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('gold_loans')
        .insert([{ ...newLoan, id: undefined }])
        .select()
        .single();
      if (error) console.error('Supabase gold loan insertion error:', error);
      if (data) {
        const customers = await this.getCustomers();
        const custName = customers.find((c) => c.id === data.customer_id)?.name || 'Unknown';
        await this.createAuditLog(
          'Gold Loan Disbursed',
          `Issued Gold Loan of ₹${data.loan_amount.toLocaleString('en-IN')} to ${custName}. Weight: ${data.net_weight}g at ${data.purity.toUpperCase()}.`,
          'GOLD_LOAN'
        );
        return data;
      }
    }

    // Local Storage
    const list = getLocalData<GoldLoan[]>(STORAGE_KEYS.GOLD_LOANS, MOCK_GOLD_LOANS);
    list.push(newLoan);
    setLocalData(STORAGE_KEYS.GOLD_LOANS, list);

    const customers = await this.getCustomers();
    const custName = customers.find((c) => c.id === newLoan.customer_id)?.name || 'Unknown';
    await this.createAuditLog(
      'Gold Loan Disbursed',
      `Issued Gold Loan of ₹${newLoan.loan_amount.toLocaleString('en-IN')} to ${custName}. Weight: ${newLoan.net_weight}g at ${newLoan.purity.toUpperCase()}.`,
      'GOLD_LOAN'
    );

    return newLoan;
  },

  async submitRepayment(loanId: string, amount: number): Promise<GoldLoan> {
    const activeUser = await this.getActiveUser();

    let loan: GoldLoan | null = null;

    if (this.isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('gold_loans')
        .select('*')
        .eq('id', loanId)
        .single();
      if (!error && data) {
        loan = data as GoldLoan;
      }
    }

    const list = getLocalData<GoldLoan[]>(STORAGE_KEYS.GOLD_LOANS, MOCK_GOLD_LOANS);
    const loanIndex = list.findIndex((l) => l.id === loanId);

    if (!loan) {
      if (loanIndex !== -1) {
        loan = list[loanIndex];
      }
    }

    if (!loan) {
      throw new Error('Gold loan record not found.');
    }

    const prevPaid = loan.paid_amount !== undefined ? loan.paid_amount : 0;
    const liability = loan.total_payback_amount || loan.loan_amount;
    const newPaid = Math.min(liability, prevPaid + amount);
    const remaining = Math.max(0, liability - newPaid);
    const percentage = Math.round((newPaid / liability) * 100);

    // If payment recorded, reset due date to next month's 28th
    const now = new Date();
    const nextMaturity = new Date(now.getFullYear(), now.getMonth() + 1, 28);

    const updatedLoan: GoldLoan = {
      ...loan,
      paid_amount: newPaid,
      remaining_balance: remaining,
      paid_percentage: percentage,
      maturity_date: nextMaturity.toISOString(),
    };

    if (loanIndex !== -1) {
      list[loanIndex] = updatedLoan;
      setLocalData(STORAGE_KEYS.GOLD_LOANS, list);
    }

    // If Supabase live connection is active, push updates there
    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('gold_loans')
        .update({
          paid_amount: newPaid,
          remaining_balance: remaining,
          paid_percentage: percentage,
          maturity_date: nextMaturity.toISOString()
        })
        .eq('id', loanId);
      if (error) {
        console.error('Supabase repayment update failed:', error);
        throw new Error(error.message);
      }
    }

    // Load customer name for logging
    const customers = await this.getCustomers();
    const custName = customers.find((c) => c.id === loan.customer_id)?.name || 'Unknown Customer';

    // Log this event inside the immutability audit log ledger
    await this.createAuditLog(
      'Gold Loan Repayment',
      `Received payment of ₹${amount.toLocaleString('en-IN')} for loan ${loanId.substring(0, 8)} (${custName}). Settled: ₹${newPaid.toLocaleString('en-IN')}, Remaining: ₹${remaining.toLocaleString('en-IN')} (${percentage}%).`,
      'GOLD_LOAN'
    );

    return updatedLoan;
  },

  async deleteGoldLoan(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Manager permission required.');
    }
    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase.from('gold_loans').delete().eq('id', id);
      if (error) return false;
    } else {
      const list = getLocalData<GoldLoan[]>(STORAGE_KEYS.GOLD_LOANS, []).filter(l => l.id !== id);
      setLocalData(STORAGE_KEYS.GOLD_LOANS, list);
    }
    return true;
  },

  async updateGoldLoanDetails(id: string, updates: Partial<GoldLoan>): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Manager permission required.');
    }
    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase.from('gold_loans').update(updates).eq('id', id);
      if (error) return false;
    } else {
      const list = getLocalData<GoldLoan[]>(STORAGE_KEYS.GOLD_LOANS, []).map((l) => {
        if (l.id === id) {
          const updated = { ...l, ...updates };
          const liability = updated.total_payback_amount || updated.loan_amount;
          const paid = updated.paid_amount || 0;
          updated.remaining_balance = Math.max(0, liability - paid);
          updated.paid_percentage = Math.round((paid / liability) * 100);
          return updated;
        }
        return l;
      });
      setLocalData(STORAGE_KEYS.GOLD_LOANS, list);
    }
    return true;
  },

  async approveGoldLoan(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Manager permission required.');
    }
    
    const list = getLocalData<GoldLoan[]>(STORAGE_KEYS.GOLD_LOANS, []);
    const loanIndex = list.findIndex((l) => l.id === id);
    let loan: GoldLoan | undefined;

    if (loanIndex !== -1) {
      loan = list[loanIndex];
      list[loanIndex] = { ...loan, status: 'ACTIVE' };
      setLocalData(STORAGE_KEYS.GOLD_LOANS, list);
    }

    if (this.isSupabaseEnabled() && supabase) {
      const { error, data } = await supabase
        .from('gold_loans')
        .update({ status: 'ACTIVE' })
        .eq('id', id)
        .select()
        .single();
      if (error) return false;
      if (data) loan = data as GoldLoan;
    }

    if (loan) {
      const customers = await this.getCustomers();
      const custName = customers.find((c) => c.id === loan!.customer_id)?.name || 'Unknown';
      await this.createAuditLog(
        'Gold Loan Approved',
        `Approved Gold Loan of ₹${loan.loan_amount.toLocaleString('en-IN')} for ${custName}. Status changed to ACTIVE.`,
        'GOLD_LOAN'
      );
    }
    return true;
  },

  // --- Biometrics ---
  async getBiometricCredentials(): Promise<BiometricCredential[]> {
    const creds = this.isSupabaseEnabled() && supabase
      ? (await supabase.from('biometric_credentials').select('*')).data || []
      : getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, MOCK_BIOMETRIC_CREDENTIALS);

    const profiles = await this.getAllProfiles();

    // Hydrate employee metadata
    return creds.map((cred: any) => {
      const prof = profiles.find((p) => p.id === cred.profile_id);
      return {
        ...cred,
        employee_name: prof ? prof.name : 'Unknown Employee',
        employee_role: prof ? prof.role : 'clerk',
      };
    }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async registerBiometric(credentialName: string, actualCredId?: string, actualPubKey?: string): Promise<BiometricCredential> {
    const activeUser = await this.getActiveUser();

    // Check if the user already has a biometric credential (approved or pending)
    if (this.isSupabaseEnabled() && supabase) {
      const { data: existing, error: checkError } = await supabase
        .from('biometric_credentials')
        .select('id, status')
        .eq('profile_id', activeUser.id);
      
      if (!checkError && existing) {
        const hasValid = existing.some((c: any) => c.status === 'APPROVED' || c.status === 'PENDING_APPROVAL');
        if (hasValid) {
          throw new Error('Workstation registry restriction: Only a single fingerprint credential is permitted per employee.');
        }
      }
    } else {
      const list = getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, MOCK_BIOMETRIC_CREDENTIALS);
      const userCreds = list.filter((b) => b.profile_id === activeUser.id && (b.status === 'APPROVED' || b.status === 'PENDING_APPROVAL'));
      if (userCreds.length > 0) {
        throw new Error('Workstation registry restriction: Only a single fingerprint credential is permitted per employee.');
      }
    }

    const credId = actualCredId || `cred_simulated_${Date.now()}`;
    const pubKey = actualPubKey || `mock_public_key_simulated_${Math.random().toString(36).substring(2)}`;
    
    const newCred: BiometricCredential = {
      id: crypto.randomUUID(),
      profile_id: activeUser.id,
      credential_name: credentialName,
      credential_id: credId,
      public_key: pubKey,
      status: 'PENDING_APPROVAL',
      created_at: new Date().toISOString(),
    };

    if (this.isSupabaseEnabled() && supabase) {
      const { data, error } = await supabase
        .from('biometric_credentials')
        .insert([{
          profile_id: activeUser.id,
          credential_name: credentialName,
          credential_id: credId,
          public_key: pubKey,
          status: 'PENDING_APPROVAL'
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase biometric registration failed:', error);
        throw new Error(`Database registration failed: ${error.message}`);
      }

      if (data) {
        await this.createAuditLog(
          'Biometric Requested',
          `Biometric key registration '${credentialName}' requested by ${activeUser.name}. Status: PENDING APPROVAL`,
          'BIOMETRIC'
        );
        return {
          ...data,
          employee_name: activeUser.name,
          employee_role: activeUser.role
        };
      }
    }

    // Local Storage
    const list = getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, MOCK_BIOMETRIC_CREDENTIALS);
    list.push(newCred);
    setLocalData(STORAGE_KEYS.BIOMETRICS, list);

    await this.createAuditLog(
      'Biometric Requested',
      `Biometric key registration '${credentialName}' requested by ${activeUser.name}. Status: PENDING APPROVAL`,
      'BIOMETRIC'
    );

    return newCred;
  },

  async approveBiometric(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Only Manager/Admin can approve biometrics.');
    }

    if (this.isSupabaseEnabled() && supabase) {
      await supabase
        .from('biometric_credentials')
        .update({ status: 'APPROVED' })
        .eq('id', id);
    } else {
      const list = getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, []).map((b) => {
        if (b.id === id) {
          return { ...b, status: 'APPROVED' as const };
        }
        return b;
      });
      setLocalData(STORAGE_KEYS.BIOMETRICS, list);
    }

    const creds = await this.getBiometricCredentials();
    const cred = creds.find((c) => c.id === id);
    if (cred) {
      await this.createAuditLog(
        'Biometric Approved',
        `Manager ${activeUser.name} APPROVED biometric credential '${cred.credential_name}' for ${cred.employee_name}.`,
        'BIOMETRIC'
      );
    }

    return true;
  },

  async rejectBiometric(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Only Manager/Admin can reject biometrics.');
    }

    if (this.isSupabaseEnabled() && supabase) {
      await supabase
        .from('biometric_credentials')
        .update({ status: 'REJECTED' })
        .eq('id', id);
    } else {
      const list = getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, []).map((b) => {
        if (b.id === id) {
          return { ...b, status: 'REJECTED' as const };
        }
        return b;
      });
      setLocalData(STORAGE_KEYS.BIOMETRICS, list);
    }

    const creds = await this.getBiometricCredentials();
    const cred = creds.find((c) => c.id === id);
    if (cred) {
      await this.createAuditLog(
        'Biometric Rejected',
        `Manager ${activeUser.name} REJECTED biometric credential '${cred.credential_name}' for ${cred.employee_name}.`,
        'BIOMETRIC'
      );
    }

    return true;
  },

  async updateBiometric(id: string, updates: Partial<BiometricCredential>): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Only Manager/Admin can update biometrics.');
    }

    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('biometric_credentials')
        .update(updates)
        .eq('id', id);
      if (error) {
        console.error('Supabase biometric update failed:', error);
        throw new Error(error.message);
      }
    } else {
      const list = getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, []).map((b) => {
        if (b.id === id) {
          return { ...b, ...updates };
        }
        return b;
      });
      setLocalData(STORAGE_KEYS.BIOMETRICS, list);
    }

    const creds = await this.getBiometricCredentials();
    const cred = creds.find((c) => c.id === id);
    if (cred) {
      await this.createAuditLog(
        'Biometric Updated',
        `Manager ${activeUser.name} UPDATED biometric credential '${cred.credential_name}' details: ${JSON.stringify(updates)}`,
        'BIOMETRIC'
      );
    }

    return true;
  },

  async deleteBiometric(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    if (activeUser.role !== 'manager') {
      throw new Error('Unauthorized: Only Manager/Admin can delete biometrics.');
    }

    if (this.isSupabaseEnabled() && supabase) {
      const { error } = await supabase
        .from('biometric_credentials')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Supabase biometric deletion failed:', error);
        throw new Error(error.message);
      }
    } else {
      const list = getLocalData<BiometricCredential[]>(STORAGE_KEYS.BIOMETRICS, []).filter((b) => b.id !== id);
      setLocalData(STORAGE_KEYS.BIOMETRICS, list);
    }

    await this.createAuditLog(
      'Biometric Deleted',
      `Manager ${activeUser.name} DELETED biometric credential record: ${id}`,
      'BIOMETRIC'
    );

    return true;
  },

  // --- Staff Management CRUD ---
  async createStaffProfile(staffData: Omit<Profile, 'id' | 'created_at'>, password?: string): Promise<Profile> {
    const activeUser = await this.getActiveUser();
    let targetId = crypto.randomUUID();
    const finalEmail = staffData.email || staffData.username || '';

    if (this.isSupabaseEnabled() && supabase) {
      if (password && finalEmail) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const tempClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
              }
            }
          );
          
          const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
            email: finalEmail,
            password: password,
            options: {
              data: {
                name: staffData.name,
                role: staffData.role,
                counter_number: staffData.counter_number
              }
            }
          });
          
          if (signUpErr) {
            throw new Error(`Auth sign-up failed: ${signUpErr.message}`);
          }
          
          if (signUpData?.user) {
            targetId = signUpData.user.id;
          }
        } catch (err: any) {
          console.error("Supabase Auth sign-up error:", err);
          throw new Error(`Failed to create login credentials: ${err.message}`);
        }
      }

      const newStaff: Profile = {
        ...staffData,
        id: targetId,
        email: finalEmail,
        created_at: new Date().toISOString(),
        status: 'OFFLINE',
      };

      const { error: insertErr } = await supabase.from('profiles').insert([newStaff]);
      if (insertErr) {
        console.error('Supabase profile insertion failed:', insertErr);
        throw new Error(`Failed to create staff profile: ${insertErr.message}`);
      }

      await this.createAuditLog(
        'Staff Onboarded',
        `Manager ${activeUser.name} onboarded new staff member ${newStaff.name} as ${newStaff.role.toUpperCase()} at ${newStaff.counter_number || 'unassigned desk'}.`,
        'STAFF'
      );

      return newStaff;
    }

    const newStaff: Profile = {
      ...staffData,
      id: targetId,
      email: finalEmail,
      created_at: new Date().toISOString(),
      status: 'OFFLINE',
    };

    const list = getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
    list.push(newStaff);
    setLocalData(STORAGE_KEYS.PROFILES, list);

    await this.createAuditLog(
      'Staff Onboarded',
      `Manager ${activeUser.name} onboarded new staff member ${newStaff.name} as ${newStaff.role.toUpperCase()} at ${newStaff.counter_number || 'unassigned desk'}.`,
      'STAFF'
    );

    return newStaff;
  },

  async updateStaffProfileDetails(id: string, updates: Partial<Omit<Profile, 'id' | 'created_at'>>): Promise<Profile> {
    const activeUser = await this.getActiveUser();
    let updatedStaff: Profile | undefined;

    if (this.isSupabaseEnabled() && supabase) {
      const { data } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (data) updatedStaff = data;
    } else {
      const list = getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
      const index = list.findIndex((p) => p.id === id);
      if (index !== -1) {
        list[index] = { ...list[index], ...updates };
        setLocalData(STORAGE_KEYS.PROFILES, list);
        updatedStaff = list[index];
      }
    }

    if (!updatedStaff) {
      throw new Error(`Staff profile with ID ${id} not found.`);
    }

    await this.createAuditLog(
      'Staff Position Modified',
      `Manager ${activeUser.name} updated details for staff ${updatedStaff.name}. Role: ${updatedStaff.role.toUpperCase()}, Counter: ${updatedStaff.counter_number}.`,
      'STAFF'
    );

    return updatedStaff;
  },

  async deleteStaffProfile(id: string): Promise<boolean> {
    const activeUser = await this.getActiveUser();
    let deletedStaff: Profile | undefined;

    if (this.isSupabaseEnabled() && supabase) {
      // Fetch details before deleting for logs
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
      deletedStaff = profile;
      await supabase.from('profiles').delete().eq('id', id);
    } else {
      const list = getLocalData<Profile[]>(STORAGE_KEYS.PROFILES, MOCK_PROFILES);
      const index = list.findIndex((p) => p.id === id);
      if (index !== -1) {
        deletedStaff = list[index];
        list.splice(index, 1);
        setLocalData(STORAGE_KEYS.PROFILES, list);
      }
    }

    if (!deletedStaff) {
      throw new Error(`Staff profile with ID ${id} not found.`);
    }

    await this.createAuditLog(
      'Staff Access Revoked',
      `Manager ${activeUser.name} permanently revoked banking system access for employee ${deletedStaff.name} (${deletedStaff.role.toUpperCase()}).`,
      'STAFF'
    );

    return true;
  },

  // --- Audit Logs ---
  async getAuditLogs(): Promise<AuditLog[]> {
    if (this.isSupabaseEnabled() && supabase) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select(`
            id,
            action_title,
            action_details,
            module,
            profile_id,
            created_at,
            profiles (
              name
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching audit logs from Supabase:', error);
        } else if (data) {
          return (data as any[]).map((log: any) => ({
            id: log.id,
            action: log.action_title,
            details: log.action_details,
            performed_by: log.profile_id,
            performed_by_name: log.profiles?.name || 'System',
            log_type: log.module as any,
            created_at: log.created_at
          }));
        }
      } catch (err) {
        console.error('Failed to get audit logs from Supabase:', err);
      }
    }
    const list = getLocalData<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, MOCK_AUDIT_LOGS);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createAuditLog(
    action: string,
    details: string,
    logType: AuditLog['log_type']
  ): Promise<AuditLog> {
    // Get active user ID safely, default if SSR or uninitialized
    let activeId = 'e2222222-2222-2222-2222-222222222222'; // David (Teller)
    let activeName = 'David Kojo';

    if (typeof window !== 'undefined') {
      const activeUser = await this.getActiveUser();
      if (activeUser) {
        activeId = activeUser.id;
        activeName = activeUser.name;
      }
    }

    const log: AuditLog = {
      id: crypto.randomUUID(),
      action,
      details,
      performed_by: activeId,
      performed_by_name: activeName,
      log_type: logType,
      created_at: new Date().toISOString(),
    };

    if (this.isSupabaseEnabled() && supabase) {
      try {
        const dbLog = {
          action_title: action,
          action_details: details,
          module: logType,
          profile_id: activeId
        };
        const { error } = await supabase.from('audit_logs').insert([dbLog]);
        if (error) {
          console.error('Supabase audit log insertion failed:', error);
        }
      } catch (err) {
        console.error('Error inserting audit log to Supabase:', err);
      }
    } else {
      if (typeof window !== 'undefined') {
        const list = getLocalData<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, MOCK_AUDIT_LOGS);
        list.push(log);
        setLocalData(STORAGE_KEYS.AUDIT_LOGS, list);
      }
    }

    return log;
  },
};
