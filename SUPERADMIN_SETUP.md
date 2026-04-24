# Superadmin + Teams Setup Guide

## Overview
Superadmins can:
- Create and manage teams such as Automation, Process, and Instrumentation
- Assign users to one or more teams
- Set each user's role per active team
- Manage team-specific settings and isolated team activity data

## Required Backend Setup

### 1. Run the main schema
Execute [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql) in Supabase SQL Editor.

This script now:
- Uses Supabase Auth for sign-in and password management
- Creates an auth-backed `public.users` profile table
- Adds RLS policies
- Restricts settings updates to admins

### 2. Add the safe teams layer
Execute [MIGRATION_SUPERADMIN_TEAMS_SAFE.sql](./MIGRATION_SUPERADMIN_TEAMS_SAFE.sql) in Supabase SQL Editor.

This migration is additive only:
- It does not alter `public.activities`, `public.users`, or `public.settings`
- It creates `public.app_teams`, `public.team_memberships`, `public.team_activities`, `public.team_settings`, and `public.super_admins`
- Automation is copied into `team_activities` and `team_settings`, then marked as a normal unified team
- Existing users are added to the Automation team through `team_memberships`, with their current roles copied into Automation team roles
- Process and Instrumentation are created as isolated teams that also use `team_activities` and `team_settings`
- Central team/user management is reserved for users listed in `public.super_admins`

### 3. Create or sign in as the admin user
Create the account through the app UI so Supabase Auth creates the user.

### 4. Promote that user to superadmin
Run this SQL after the user exists in `auth.users` and `public.users`.

```sql
INSERT INTO public.super_admins (user_id)
SELECT id
FROM public.users
WHERE email = 'admin@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

## Existing Projects
If your app already uses the old `users(email, password, ...)` table:

1. Run [MIGRATION_AUTH_HARDENING.sql](./MIGRATION_AUTH_HARDENING.sql)
2. Run [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql)
3. Run [MIGRATION_SUPERADMIN_TEAMS_SAFE.sql](./MIGRATION_SUPERADMIN_TEAMS_SAFE.sql)
4. Ask users to create or reset passwords through Supabase Auth

## Notes
- The old Automation tables remain in place for now, but the app reads/writes Automation through the unified team tables after this migration.
- Team activity data is stored in `team_activities` and filtered by `team_id`.
- Settings changes apply to the active team.
- Team admins can manage their team's settings and activities; only superadmins manage all teams and users.
- The app no longer stores passwords in the `users` table.
- Email/password changes are handled by Supabase Auth.
- To enable admin email notifications for new signups, set `VITE_ADMIN_APPROVAL_WEBHOOK_URL` in your frontend environment and point it to an endpoint (Edge Function or webhook) that sends email to admins.
- Run `MIGRATION_USER_APPROVAL_WORKFLOW.sql` so new accounts stay pending until an admin approves them from User Management.
