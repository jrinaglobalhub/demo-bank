-- Enable the UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Staff Management)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Maps to auth.users.id
    name TEXT NOT NULL,
    email TEXT,
    username TEXT,
    role TEXT NOT NULL DEFAULT 'clerk', -- 'manager', 'clerk', 'teller', etc.
    counter_number TEXT,
    status TEXT DEFAULT 'OFFLINE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow managers to insert profiles" ON public.profiles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "Allow managers to update profiles" ON public.profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "Allow managers to delete profiles" ON public.profiles FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- 2. CUSTOMERS (KYC Registry)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    dob TEXT,
    address TEXT,
    aadhaar_number TEXT UNIQUE,
    pan_number TEXT UNIQUE,
    aadhaar_doc_url TEXT,
    pan_doc_url TEXT,
    profile_photo TEXT,
    status TEXT DEFAULT 'PENDING_APPROVAL', -- 'VERIFIED', 'PENDING_APPROVAL', 'SUSPENDED', 'PENDING_SUSPENSION'
    suspension_reason TEXT,
    suspension_requested_by TEXT,
    balance NUMERIC DEFAULT 10000, -- Default starting ledger
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read customers" ON public.customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert customers" ON public.customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update customers" ON public.customers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow managers to delete customers" ON public.customers FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- 3. GOLD LOANS
CREATE TABLE IF NOT EXISTS public.gold_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id),
    gross_weight NUMERIC NOT NULL,
    waste_weight NUMERIC NOT NULL,
    net_weight NUMERIC NOT NULL,
    purity TEXT NOT NULL,
    loan_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    remaining_balance NUMERIC,
    paid_percentage NUMERIC DEFAULT 0,
    locker_shelf_id TEXT NOT NULL,
    packet_number TEXT NOT NULL,
    maturity_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'ACTIVE',
    interest_rate NUMERIC DEFAULT 12,
    payback_months INTEGER DEFAULT 6,
    total_payback_amount NUMERIC,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time broadcasts for gold_loans
alter publication supabase_realtime add table public.gold_loans;

-- Enable RLS
ALTER TABLE public.gold_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read loans" ON public.gold_loans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert loans" ON public.gold_loans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to update loans" ON public.gold_loans FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow managers to delete loans" ON public.gold_loans FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- 4. SUSPENSION REQUESTS (Inter-staff requests)
CREATE TABLE IF NOT EXISTS public.suspension_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id),
    reason TEXT NOT NULL,
    requested_by UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.suspension_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read suspension_requests" ON public.suspension_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert suspension_requests" ON public.suspension_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow managers to update suspension_requests" ON public.suspension_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- 5. BIOMETRIC CREDENTIALS
CREATE TABLE IF NOT EXISTS public.biometric_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id),
    credential_name TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING_APPROVAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.biometric_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read biometric_credentials" ON public.biometric_credentials FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert biometric_credentials" ON public.biometric_credentials FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow managers to update biometric_credentials" ON public.biometric_credentials FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- 6. CASH TRANSACTIONS (Audit Ledger)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id),
    transaction_type TEXT NOT NULL, -- 'DEPOSIT' or 'WITHDRAWAL'
    amount NUMERIC NOT NULL,
    denomination_matrix JSONB NOT NULL,
    processed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read cash_transactions" ON public.cash_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert cash_transactions" ON public.cash_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 7. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_title TEXT NOT NULL,
    action_details TEXT NOT NULL,
    module TEXT NOT NULL,
    profile_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read audit_logs" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- STORAGE BUCKET setup
insert into storage.buckets (id, name, public) values ('kyc-docs', 'kyc-docs', true) on conflict do nothing;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'kyc-docs' );
create policy "Authenticated uploads" on storage.objects for insert with check ( bucket_id = 'kyc-docs' and auth.role() = 'authenticated' );

-- PROFILE PHOTOS BUCKET
insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', true) on conflict do nothing;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'profile-photos' );
create policy "Authenticated uploads" on storage.objects for insert with check ( bucket_id = 'profile-photos' and auth.role() = 'authenticated' );
