export interface Profile {
  id: string;
  name: string;
  email?: string;
  role: 'manager' | 'clerk' | 'teller' | 'loan_officer' | 'auditor';
  created_at: string;
  username?: string;
  counter_number?: string;
  status?: 'ONLINE' | 'OFFLINE';
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  aadhaar_number: string;
  pan_number: string;
  aadhaar_doc_url?: string;
  pan_doc_url?: string;
  status: 'PENDING_APPROVAL' | 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_SUSPENSION';
  created_by: string;
  created_at: string;
  balance?: number;          // Ledger balance
  profile_photo?: string;    // base64 photo capture
  suspension_reason?: string;
  suspension_requested_by?: string;
}

export interface GoldLoan {
  id: string;
  customer_id: string;
  customer_name?: string; // hydrated
  gross_weight: number;
  waste_weight: number;
  net_weight: number;
  purity: '18k' | '22k' | '24k';
  gold_rate_per_gram: number;
  max_eligible_amount: number;
  loan_amount: number;
  paid_amount?: number;      // Settled amount
  remaining_balance?: number; // Outstanding liability
  paid_percentage?: number;   // Visual settle progress percentage
  locker_shelf_id: string;
  packet_number: string;
  created_by: string;
  created_at: string;
  maturity_date?: string;     // NPA/Maturity/Closing Date
  interest_rate?: number;
  payback_months?: number;
  total_payback_amount?: number;
  status?: string;
  interest_method?: 'flat' | 'reducing';
}

export interface BiometricCredential {
  id: string;
  profile_id: string;
  employee_name?: string; // hydrated
  employee_role?: string; // hydrated
  credential_name: string;
  credential_id: string;
  public_key: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  performed_by: string;
  performed_by_name: string;
  log_type: 'GOLD_LOAN' | 'KYC' | 'AUTH' | 'BIOMETRIC' | 'STAFF';
  created_at: string;
}

export const MOCK_PROFILES: Profile[] = [
  {
    id: 'e1111111-1111-1111-1111-111111111111',
    name: 'Sarah Jenkins',
    role: 'manager',
    created_at: '2026-01-10T09:00:00Z',
    username: 'sarah.jenkins@jrina.com',
    counter_number: 'HQ-OFFICE-01',
    status: 'ONLINE',
  },
  {
    id: 'e2222222-2222-2222-2222-222222222222',
    name: 'David Kojo',
    role: 'clerk',
    created_at: '2026-02-15T10:30:00Z',
    username: 'david.kojo@jrina.com',
    counter_number: 'COUNTER-02',
    status: 'ONLINE',
  },
  {
    id: 'e3333333-3333-3333-3333-333333333333',
    name: 'Amina Al-Mansoor',
    role: 'teller',
    created_at: '2026-03-01T08:00:00Z',
    username: 'amina.almansoor@jrina.com',
    counter_number: 'COUNTER-03',
    status: 'OFFLINE',
  },
  {
    id: 'e4444444-4444-4444-4444-444444444444',
    name: 'Liam Chen',
    role: 'loan_officer',
    created_at: '2026-03-20T09:15:00Z',
    username: 'liam.chen@jrina.com',
    counter_number: 'DESK-04',
    status: 'ONLINE',
  },
  {
    id: 'e5555555-5555-5555-5555-555555555555',
    name: 'Sofia Rodriguez',
    role: 'auditor',
    created_at: '2026-04-05T11:00:00Z',
    username: 'sofia.rodriguez@jrina.com',
    counter_number: 'OFFICE-05',
    status: 'OFFLINE',
  },
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@gmail.com',
    phone: '+91 98765 43210',
    dob: '1988-05-14',
    address: 'Flat 402, Shanti Vihar, Andheri West, Mumbai, MH, 400053',
    aadhaar_number: '5421 9876 0124',
    pan_number: 'ABCPS1234F',
    status: 'VERIFIED',
    created_by: 'e2222222-2222-2222-2222-222222222222',
    created_at: '2026-05-18T11:20:00Z',
    balance: 41780,
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    name: 'Priya Patel',
    email: 'priya.patel@yahoo.com',
    phone: '+91 98123 45678',
    dob: '1995-11-22',
    address: 'House No 12, Sector 15-A, Chandigarh, PB, 160015',
    aadhaar_number: '8792 0123 4567',
    pan_number: 'XYZPD9876G',
    status: 'VERIFIED',
    created_by: 'e2222222-2222-2222-2222-222222222222',
    created_at: '2026-05-19T09:15:00Z',
    balance: 48560,
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    name: 'Rajesh Nair',
    email: 'rajesh.nair@outlook.com',
    phone: '+91 99456 78901',
    dob: '1976-03-08',
    address: 'Nandanam, Near Temple Gate, Peringammala, Trivandrum, KL, 695563',
    aadhaar_number: '3102 4891 7562',
    pan_number: 'LMNOP5678E',
    status: 'PENDING_APPROVAL',
    created_by: 'e2222222-2222-2222-2222-222222222222',
    created_at: '2026-05-20T10:00:00Z',
    balance: 49464,
  },
];

export const MOCK_GOLD_LOANS: GoldLoan[] = [
  {
    id: 'l1111111-1111-1111-1111-111111111111',
    customer_id: 'c1111111-1111-1111-1111-111111111111',
    gross_weight: 45.5,
    waste_weight: 1.5,
    net_weight: 44.0,
    purity: '22k',
    gold_rate_per_gram: 6600,
    max_eligible_amount: 217800, // 44g * 6600 * 75% LTV
    loan_amount: 200000,
    locker_shelf_id: 'Locker B - Shelf 3',
    packet_number: 'PKT-2026-0043',
    created_by: 'e2222222-2222-2222-2222-222222222222',
    created_at: '2026-05-18T12:00:00Z',
    maturity_date: '2026-11-18T12:00:00Z',
    interest_rate: 12,
    payback_months: 6,
    total_payback_amount: 212000,
  },
  {
    id: 'l2222222-2222-2222-2222-222222222222',
    customer_id: 'c2222222-2222-2222-2222-222222222222',
    gross_weight: 120.0,
    waste_weight: 4.0,
    net_weight: 116.0,
    purity: '24k',
    gold_rate_per_gram: 7200,
    max_eligible_amount: 626400, // 116g * 7200 * 75% LTV
    loan_amount: 600000,
    locker_shelf_id: 'Locker A - Shelf 1',
    packet_number: 'PKT-2026-0044',
    created_by: 'e1111111-1111-1111-1111-111111111111',
    created_at: '2026-05-19T10:30:00Z',
    maturity_date: '2026-11-19T10:30:00Z',
    interest_rate: 12,
    payback_months: 6,
    total_payback_amount: 636000,
  },
  {
    id: 'l3333333-3333-3333-3333-333333333333',
    customer_id: 'c2222222-2222-2222-2222-222222222222', // Priya Patel
    gross_weight: 32.0,
    waste_weight: 1.0,
    net_weight: 31.0,
    purity: '22k',
    gold_rate_per_gram: 6600,
    max_eligible_amount: 153450,
    loan_amount: 100000,
    locker_shelf_id: 'Locker C - Shelf 2',
    packet_number: 'PKT-2026-0091',
    created_by: 'e2222222-2222-2222-2222-222222222222',
    created_at: '2026-02-10T12:00:00Z',
    maturity_date: '2026-05-10T12:00:00Z', // Mature passed by 12 days relative to simulated date May 22, 2026
    interest_rate: 12,
    payback_months: 3,
    total_payback_amount: 103000,
  },
  {
    id: 'l4444444-4444-4444-4444-444444444444',
    customer_id: 'c1111111-1111-1111-1111-111111111111', // Aarav Sharma
    gross_weight: 85.0,
    waste_weight: 3.0,
    net_weight: 82.0,
    purity: '24k',
    gold_rate_per_gram: 7200,
    max_eligible_amount: 442800,
    loan_amount: 300000,
    locker_shelf_id: 'Locker D - Shelf 4',
    packet_number: 'PKT-2026-0008',
    created_by: 'e2222222-2222-2222-2222-222222222222',
    created_at: '2025-10-15T12:00:00Z',
    maturity_date: '2026-01-15T12:00:00Z', // Mature passed by 127 days (>90 days), LISTED FOR AUCTION!
    interest_rate: 12,
    payback_months: 3,
    total_payback_amount: 309000,
  },
];

export const MOCK_BIOMETRIC_CREDENTIALS: BiometricCredential[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    profile_id: 'e2222222-2222-2222-2222-222222222222',
    credential_name: "Teller's Workstation iPad",
    credential_id: 'cred_david_workstation_ipad_2026',
    public_key: 'mock_pk_david_ipad_sha256',
    status: 'APPROVED',
    created_at: '2026-05-16T14:20:00Z',
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    profile_id: 'e2222222-2222-2222-2222-222222222222',
    credential_name: 'David Home ChromeBook',
    credential_id: 'cred_david_home_chromebook_2026',
    public_key: 'mock_pk_david_chromebook_sha256',
    status: 'PENDING_APPROVAL',
    created_at: '2026-05-22T08:30:00Z', // Today
  },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    action: 'Standard login',
    details: 'Teller David Kojo signed into the workspace.',
    performed_by: 'e2222222-2222-2222-2222-222222222222',
    performed_by_name: 'David Kojo',
    log_type: 'AUTH',
    created_at: '2026-05-18T10:00:00Z',
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    action: 'Customer KYC Registered',
    details: 'Aarav Sharma registered (Aadhaar: 5421 **** ****, PAN: ABCP****F). Status: VERIFIED',
    performed_by: 'e2222222-2222-2222-2222-222222222222',
    performed_by_name: 'David Kojo',
    log_type: 'KYC',
    created_at: '2026-05-18T11:20:00Z',
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    action: 'Gold Loan Disbursed',
    details: 'Issued Gold Loan of ₹2,00,000 to Aarav Sharma. 44.0g Net Weight at 22K.',
    performed_by: 'e2222222-2222-2222-2222-222222222222',
    performed_by_name: 'David Kojo',
    log_type: 'GOLD_LOAN',
    created_at: '2026-05-18T12:00:00Z',
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    action: 'Biometric Approved',
    details: "Manager Sarah approved biometric credential 'Teller's Workstation iPad' for David Kojo.",
    performed_by: 'e1111111-1111-1111-1111-111111111111',
    performed_by_name: 'Sarah Jenkins',
    log_type: 'BIOMETRIC',
    created_at: '2026-05-18T14:30:00Z',
  },
];
