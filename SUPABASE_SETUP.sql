-- ============================================
-- SUPABASE SQL SETUP SCRIPT
-- Daily Activities Tracker Database Schema
-- ============================================

-- 1. Add system and editedBy columns to existing activities table (if not exists)
-- Note: These columns may already exist if you've run this script before
-- Uncomment lines below if needed for fresh setup:
-- ALTER TABLE activities ADD COLUMN IF NOT EXISTS system TEXT NOT NULL DEFAULT '';
-- ALTER TABLE activities ADD COLUMN IF NOT EXISTS editedBy TEXT;

-- 2. Create users table for authentication (if not exists)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add role column to existing users table (if not exists)
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 3. Create settings table for webapp configuration
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webapp_name TEXT DEFAULT 'Daily Activities Tracker',
  logo_url TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#667eea',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_activities_performer ON activities(performer);
CREATE INDEX IF NOT EXISTS idx_activities_instrument ON activities(instrument);
CREATE INDEX IF NOT EXISTS idx_activities_system ON activities(system);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);

-- ============================================
-- OPTIONAL: Enable Row Level Security (RLS)
-- ============================================
-- Uncomment these if you want to enable RLS (recommended for production)

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFY TABLE STRUCTURES (Run these separately to check)
-- ============================================
-- SELECT * FROM information_schema.columns WHERE table_name = 'activities';
-- SELECT * FROM information_schema.columns WHERE table_name = 'users';

