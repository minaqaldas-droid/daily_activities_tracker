# Daily Activities Tracker

A React + TypeScript activity tracker backed by Supabase. The app supports authenticated activity logging, dashboard analytics, search, Excel import/export, and superadmin-managed branding/settings.

## Stack
- React 18
- TypeScript
- Vite
- Supabase Auth + Postgres
- `xlsx` for Excel import/export

## What Changed
This version now:
- Uses Supabase Auth instead of storing passwords in `public.users`
- Keeps a profile table for names and roles
- Applies Row Level Security policies in Supabase
- Fixes search handling for all filters
- Splits Excel import/export into lazy-loaded chunks
- Imports Excel rows in batches with row-level fallback

## Local Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Set up Supabase
Run [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql) in the Supabase SQL Editor.

If you are upgrading an older installation that used the legacy `users(email, password, ...)` table:

1. Run [MIGRATION_AUTH_HARDENING.sql](./migration/MIGRATION_AUTH_HARDENING.sql)
2. Run [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql)
3. Have users create or reset their passwords through Supabase Auth

### 4. Run the app
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

## Superadmin + Teams Setup
After the main schema is installed, run the additive team migration:

```sql
-- Run migration/MIGRATION_SUPERADMIN_TEAMS_SAFE.sql in Supabase SQL Editor.
```

This keeps the old Automation tables in place, copies Automation activities/settings/users roles into the unified team model, and makes Automation, Process, and Instrumentation all run through team-scoped tables with RLS.

More detail: [SUPERADMIN_SETUP.md](./SUPERADMIN_SETUP.md)

## Main App Flow
- `src/App.tsx` coordinates the shell, views, and flash messages
- `src/hooks/useAuth.ts` restores and tracks Supabase sessions
- `src/hooks/useSettings.ts` loads global app settings
- `src/hooks/useActivities.ts` owns CRUD/search activity state
- `src/supabaseClient.ts` wraps Supabase queries and auth actions

## Excel Features
- Import is lazy-loaded and batches inserts for better performance
- Export is lazy-loaded so `xlsx` does not inflate the main bundle
- The production build now splits `xlsx` into its own chunk

## Notes
- Old Automation data remains in the legacy tables for now, but the app uses the unified team tables after migration.
- Team activity data is isolated by `team_id`.
- Settings updates apply to the active team.
- The app still expects the `activities`, `users`, and `settings` tables described in the SQL files.
