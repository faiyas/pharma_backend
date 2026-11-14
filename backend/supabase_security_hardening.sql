-- ========================================================================
-- Supabase Security Hardening & Advisor Remediation
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jhwzdsgqstlowvuxpzyf/sql/new
-- ========================================================================

-- 1. Enable Row Level Security (RLS) on all recently added public tables
-- Note: Django connects as 'postgres' which has BYPASSRLS, so Django is unaffected.
ALTER TABLE IF EXISTS public.shops_employeehistory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops_employeetransfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_correction ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_adjustment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaves_leavepolicy ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaves_leaverequest ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leaves_leavebalance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_monthly_export_log ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS across all remaining Django tables for complete security
ALTER TABLE IF EXISTS public.accounts_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_photo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auditlog_auditlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops_shop ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops_employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops_shopmanager ENABLE ROW LEVEL SECURITY;

-- 3. Revoke public API access (PostgREST / GraphQL) from Supabase web roles.
-- Since the system uses Django REST Framework, the database should not be accessible directly via Supabase client keys.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

