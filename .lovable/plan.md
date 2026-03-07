

# Implementation Plan: Fix Build Errors + Add OTP Authentication

## Part 1: Fix Build Errors (3 files)

### 1. `src/pages/AcceptInvitation.tsx` (lines 106-111)
Cast RPC `data` to `any` for property access:
- `data.success` → `(data as any).success`
- `data.error` → `(data as any).error`
- `data.needs_approval` → `(data as any).needs_approval`

### 2. `src/pages/AdminApprovals.tsx` (lines 113-114, 147-148)
Same `as any` cast for both `approve_user_registration` and `reject_user_registration` RPC results.

### 3. `src/pages/MatchDataEditor.tsx` (line 65)
Change `period_type: string` to `period_type: 'period' | 'penalties'`.

---

## Part 2: OTP Authentication

### A. `src/hooks/useAuth.tsx`
Add two new methods to the auth context:
- `signInWithOtp(email)` — calls `supabase.auth.signInWithOtp({ email })`
- `verifyOtp(email, token)` — calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`

### B. `src/lib/validation.ts`
Add `otpEmailSchema` — email-only validation schema reusing existing email rules.

### C. `src/pages/Auth.tsx`
- Change tab grid from 2 to 3 columns: "Sign In" | "Sign Up" | "Email Code"
- Add `Mail` icon import from lucide-react
- Import `InputOTP`, `InputOTPGroup`, `InputOTPSlot` from existing UI components
- New "Email Code" tab with two-step flow:
  - **Step 1**: Email input + "Send Code" button → calls `signInWithOtp`
  - **Step 2**: 6-digit `InputOTP` component + "Verify & Sign In" button → calls `verifyOtp`
  - "Resend Code" and "Back" options
  - On success, navigate to `/`
- New state: `otpStep` ('email' | 'code'), `otpEmail` string, `otpCode` string

### No database changes needed
Supabase OTP is a built-in auth feature. Session duration is configured in the Supabase dashboard (Authentication → Settings → JWT expiry).

