-- ====================================================================
-- JRINA BANKING SYSTEM - SUPABASE DATABASE RLS FIX
-- Run this script in your Supabase SQL Editor to resolve RLS 403 errors.
-- ====================================================================

-- OPTION A: DISABLE RLS (Recommended for fast demo setup - 100% error-free)
-- --------------------------------------------------------------------
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspension_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_loans DISABLE ROW LEVEL SECURITY;

-- OPTION B: FULLY OPEN RLS POLICIES (If you prefer to keep RLS active but permissive)
-- --------------------------------------------------------------------
-- Uncomment the block below if you prefer keeping RLS enabled but permissive:

/*
-- 1. Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow select for all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all" ON public.profiles FOR DELETE USING (true);

-- 2. Biometric Credentials
ALTER TABLE public.biometric_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read biometric_credentials" ON public.biometric_credentials;
DROP POLICY IF EXISTS "Allow authenticated users to insert biometric_credentials" ON public.biometric_credentials;
DROP POLICY IF EXISTS "Allow managers to update biometric_credentials" ON public.biometric_credentials;
CREATE POLICY "Allow select for all" ON public.biometric_credentials FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON public.biometric_credentials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all" ON public.biometric_credentials FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all" ON public.biometric_credentials FOR DELETE USING (true);

-- 3. Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow authenticated users to insert audit_logs" ON public.audit_logs;
CREATE POLICY "Allow select for all" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- 4. Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow managers to delete customers" ON public.customers;
CREATE POLICY "Allow select for all" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all" ON public.customers FOR DELETE USING (true);

-- 5. Cash Transactions
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users to read cash_transactions" ON public.cash_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to insert cash_transactions" ON public.cash_transactions;
CREATE POLICY "Allow select for all" ON public.cash_transactions FOR SELECT USING (true);
CREATE POLICY "Allow insert for all" ON public.cash_transactions FOR INSERT WITH CHECK (true);
*/
