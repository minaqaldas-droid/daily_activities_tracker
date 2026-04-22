# Superadmin Feature Setup Guide

## Overview
Superadmins can:
- Change the webapp name
- Set or remove a logo
- Change the primary color
- Switch performer handling between manual entry and auto-assignment

## Required Backend Setup

### 1. Run the main schema
Execute [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql) in Supabase SQL Editor.

This script now:
- Uses Supabase Auth for sign-in and password management
- Creates an auth-backed `public.users` profile table
- Adds RLS policies
- Restricts settings updates to superadmins

### 2. Create or sign in as the admin user
Create the account through the app UI so Supabase Auth creates the user.

### 3. Promote that user to superadmin
Run this SQL after the user exists in `auth.users` and `public.users`:

```sql
UPDATE public.users
SET role = 'superadmin'
WHERE email = 'admin@example.com';
```

## Existing Projects
If your app already uses the old `users(email, password, ...)` table:

1. Run [MIGRATION_AUTH_HARDENING.sql](./MIGRATION_AUTH_HARDENING.sql)
2. Run [SUPABASE_SETUP.sql](./SUPABASE_SETUP.sql)
3. Ask users to create or reset passwords through Supabase Auth

## Notes
- Settings changes apply to all authenticated users.
- The app no longer stores passwords in the `users` table.
- Email/password changes are handled by Supabase Auth.
- To enable admin email notifications for new signups, set `VITE_ADMIN_APPROVAL_WEBHOOK_URL` in your frontend environment and point it to an endpoint (Edge Function or webhook) that sends email to admins.
- Run `MIGRATION_USER_APPROVAL_WORKFLOW.sql` so new accounts stay pending until an admin approves them from User Management.
