## Goal

Keep the magic link as the primary sign-in method, and add a 6-digit code field on the same screen as a fallback. Users on machines where they cannot access their email will be able to read the code on their phone and type it in.

## How it will work

Supabase's `signInWithOtp({ email })` already issues **both** a clickable link and a 6-digit OTP code in the same email. We just don't currently surface the code path in the UI. No backend logic, edge functions, or database migrations are needed — only a frontend change plus a small tweak to the magic-link email template.

## Changes

### 1. Sign In screen (`src/pages/Auth.tsx`)

Replace the current post-send confirmation view with a combined screen:

```text
✉️  Sign-in email sent to coach@example.com

  ┌────────────────────────────────────────────┐
  │ 1. Click the link in your email            │
  │                                            │
  │                — or —                      │
  │                                            │
  │ 2. Enter the 6-digit code from the email   │
  │                                            │
  │      [_] [_] [_] [_] [_] [_]               │
  │                                            │
  │           [   Verify Code   ]              │
  └────────────────────────────────────────────┘

  [ ← Back ]                       [ Resend ]
```

- Use the existing `InputOTP` component from `src/components/ui/input-otp.tsx`.
- Auto-submit when 6 digits are entered (with manual button as a fallback).
- On success, navigate to `/` (same destination as the magic-link callback).
- Show inline validation errors ("Invalid or expired code") via toast.
- Keep the existing "Back" and "Resend Link" buttons.

### 2. Pre-send button label (`src/pages/Auth.tsx`)

- Change **"Send Sign In Link"** → **"Send Sign In Link & Code"** so users understand both options will arrive.

### 3. Toast wording (`src/hooks/useAuth.tsx`)

- Update the existing toast inside `signInWithOtp` from:
  - Title: "Link sent" → "Link & code sent"
  - Description: "Check your email for the login link." → "Check your email for the sign-in link or 6-digit code."

### 4. Magic-link email template (`supabase/functions/_shared/email-templates/magic-link.tsx`)

Add the OTP code below the existing button, using the `{{ .Token }}` variable Supabase already provides:

```text
Click the button above to sign in.

— or —

Enter this 6-digit code on the sign-in screen:

      ┌───────────────┐
      │   1 2 3 4 5 6 │
      └───────────────┘

This code expires in 1 hour.
```

- Keep the existing magic-link button as the primary CTA.
- Use plain table-friendly markup (consistent with the existing template) so it renders correctly in Outlook, Gmail and Proton Mail.
- Redeploy the `auth-email-hook` edge function after the change so the new template ships.

## What stays the same

- Magic-link click flow — unchanged.
- Supabase auth provider config — unchanged (6-digit, 1-hour expiry are the defaults already in use).
- Email infrastructure (Resend/Custom SMTP via `notify.sidelineassist.club`) — unchanged.
- Registration, dev-login tab, and password reset flows — unchanged.
- Session lifetime — unchanged (7+ days).

## Out of scope

- No changes to the registration tab.
- No changes to Supabase Auth settings in the dashboard.
- No new database tables, RLS policies, or edge functions.

## Technical notes

- `useAuth.tsx` already exposes `verifyOtp(email, token)` which calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`. The new code-entry UI will call this directly — no new auth helpers needed.
- After successful `verifyOtp`, `onAuthStateChange` will fire and update the session automatically; the screen just needs to `navigate('/')`.
- The `InputOTP` component is already installed and used elsewhere in the project.
- Email template change requires redeploying the `auth-email-hook` function (handled automatically by Lovable on save).

## Files touched

- `src/pages/Auth.tsx` — new combined post-send view with OTP input
- `src/hooks/useAuth.tsx` — toast wording update
- `supabase/functions/_shared/email-templates/magic-link.tsx` — add code block below button
