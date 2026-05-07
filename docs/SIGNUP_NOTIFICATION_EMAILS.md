# New User Signup Emails

This feature sends Super Admins an email whenever a new user signs up in the app.

## What Was Added

- `supabase/functions/new-user-signup-notification/index.ts`
- The existing app signup flow now calls this Edge Function automatically.

The Edge Function:

- Receives the signed-up user's ID, name, and email from the app.
- Looks up the saved user row for role, approval status, and signup time.
- Finds Super Admins from `super_admins`.
- Sends the email to approved Super Admin users through Brevo.

## Required Secrets

This function reuses the existing Brevo setup:

```bash
npx supabase secrets set BREVO_API_KEY="xkeysib-..."
npx supabase secrets set DAILY_ACTIVITY_EMAIL_FROM="Daily Activities Tracker <your-verified-sender@email.com>"
```

Optional custom sender/reply-to for signup notifications:

```bash
npx supabase secrets set SIGNUP_NOTIFICATION_EMAIL_FROM="Daily Activities Tracker <your-verified-sender@email.com>"
npx supabase secrets set SIGNUP_NOTIFICATION_EMAIL_REPLY_TO="your-email@example.com"
```

If the optional signup-specific secrets are not set, the function uses the daily activity email sender/reply-to.

## Deploy

```bash
npx supabase functions deploy new-user-signup-notification
```

After deployment, create a test account from the app signup page. Super Admins should receive an email with:

- Name
- Email
- User ID
- Role
- Approval status
- Signup time in Cairo
