# Daily Team Activity Emails

This feature sends each active team a daily email summary of activities added during the Cairo day.

## What Was Added

- `migration/MIGRATION_DAILY_TEAM_ACTIVITY_EMAILS.sql`
- `supabase/functions/daily-team-activity-summary/index.ts`

The Edge Function:

- Reads active teams with daily summaries enabled.
- Sends each team only after its configured Cairo send time.
- Finds activities created during the 24 hours before each team's configured send time.
- Sends the summary to approved users in each team.
- Logs `sent`, `skipped`, and `failed` results in `daily_activity_email_logs`.
- Prevents duplicate sent emails for the same team and date.

## 1. Run The Migration

Run this in Supabase SQL Editor:

```sql
-- migration/MIGRATION_DAILY_TEAM_ACTIVITY_EMAILS.sql
```

This adds:

- `team_settings.daily_activity_email_enabled`
- `team_settings.daily_activity_email_time`
- `daily_activity_email_logs`

By default, `daily_activity_email_enabled` is `true` for every team.
By default, `daily_activity_email_time` is `17:00` Cairo time. For example, if a team sends at `17:00`, the summary includes activities added from `17:00` yesterday through `17:00` today.

Team Admins and Super Admins can change this per team from:

```text
Admin Settings -> Daily Email Summary
```

The UI controls whether the active team is included and what Cairo time it should be sent. The sender and provider are still controlled by the Supabase secrets below.

## 2. Configure Brevo

Create a free Brevo account, open SMTP & API settings, then create an API key.

Brevo's free plan has a daily send limit. Keep total daily recipients across all teams within that limit, or some sends may fail.

Set Supabase Edge Function secrets:

```bash
supabase secrets set BREVO_API_KEY="xkeysib-..."
supabase secrets set DAILY_ACTIVITY_EMAIL_FROM="Daily Activities <your-verified-sender@email.com>"
supabase secrets set DAILY_ACTIVITY_EMAIL_REPLY_TO="admin@yourdomain.com"
supabase secrets set DAILY_ACTIVITY_EMAIL_CRON_SECRET="choose-a-long-random-secret"
```

`DAILY_ACTIVITY_EMAIL_FROM` must be a sender Brevo allows on your account. For a fully free setup, verify a personal sender email in Brevo if you do not own a domain.

Optional:

```bash
supabase secrets set DAILY_ACTIVITY_EMAIL_SEND_EMPTY="true"
```

If `DAILY_ACTIVITY_EMAIL_SEND_EMPTY` is not `true`, teams with no activities are skipped and logged.

## 3. Deploy The Function

```bash
supabase functions deploy daily-team-activity-summary
```

## 4. Schedule The Checker

Because each team can have a different send time, schedule the function to run repeatedly. The function checks each team's saved Cairo time and sends only teams that are due and have not already been sent today.

Recommended cron, every 15 minutes:

```cron
*/15 * * * *
```

If you need more exact timing, run it every 5 minutes:

```cron
*/5 * * * *
```

Configure the scheduled request as `POST` and include this header:

```text
x-cron-secret: choose-a-long-random-secret
```

## 5. Manual Test

Invoke the deployed function with:

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/daily-team-activity-summary" \
  -H "Authorization: Bearer <anon-or-service-role-token>" \
  -H "x-cron-secret: choose-a-long-random-secret"
```

If the selected team time has not arrived yet, the result will show `not_due`. To force a manual test before the selected time:

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/daily-team-activity-summary" \
  -H "Authorization: Bearer <anon-or-service-role-token>" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: choose-a-long-random-secret" \
  -d '{"force":true}'
```

Check `daily_activity_email_logs` after the test.

## Notes

- Recipients are pulled from `team_memberships` joined to approved `users`.
- The email uses BCC so users do not see the whole recipient list.
- The summary is based on `team_activities.created_at`, not the editable activity `date` field.
- Each team's summary window is the 24 hours before that team's selected Cairo send time.
