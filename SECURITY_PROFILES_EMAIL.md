# Security Fix: Remove Email from Profiles Table

## Issue
Lovable identified a security vulnerability where email addresses were stored in plaintext in the `profiles` table, making them potentially accessible if RLS policies were bypassed.

## Solution Implemented (Option 2 - Most Secure)

We removed the `email` column entirely from the `profiles` table. Email addresses are already securely stored in Supabase's `auth.users` table, which has stronger built-in protections.

## Changes Made

### 1. Database Migration (`supabase/migrations/20251115_remove_email_from_profiles.sql`)

✅ **Created secure RPC function** `find_user_by_email()`
- Only callable by club admins
- Uses `auth.users` as the source of truth for emails
- Server-side execution prevents client-side email harvesting

✅ **Updated trigger** `handle_new_user()`
- No longer inserts email into profiles table
- Still creates profile with first_name and last_name

✅ **Removed email column** from `profiles` table
- Eliminates duplicate storage
- Reduces attack surface

✅ **Tightened permissions**
- Revoked broad `ALL` grants from `anon` and `authenticated`
- Granted only specific `SELECT`, `INSERT`, `UPDATE` permissions
- Only `service_role` can `DELETE`

### 2. Code Updates (`src/components/club/UserManagement.tsx`)

✅ **Replaced insecure client-side email query**
```typescript
// ❌ BEFORE (Insecure - client queries profiles for email)
const { data: existingUser } = await supabase
  .from('profiles')
  .select('user_id')
  .eq('email', inviteEmail.trim())
  .single();

// ✅ AFTER (Secure - uses server-side function)
const { data: foundUserId } = await supabase
  .rpc('find_user_by_email', { lookup_email: inviteEmail.trim() });
```

✅ **Removed email from UI**
- Member list no longer displays emails
- Shows user name and partial user ID instead
- Email not needed for member management

## Security Improvements

### Before
- ❌ Email stored in two places (auth.users + profiles)
- ❌ Client code could query profiles.email
- ❌ Overly permissive table grants (`ALL` to `anon` and `authenticated`)
- ❌ Potential for email harvesting if RLS bypassed

### After
- ✅ Email stored only in `auth.users` (secure, managed by Supabase)
- ✅ Email lookups only via secure server-side function
- ✅ Admin-only access to email lookup functionality
- ✅ Minimal table permissions (specific grants only)
- ✅ No client-side access to email data

## Migration Instructions

### Development
```bash
# Apply migration locally
supabase migration up

# Or via Supabase CLI
supabase db push
```

### Production (Lovable/Supabase)
1. Upload migration file to Supabase Dashboard → SQL Editor
2. Run the migration
3. Deploy updated frontend code
4. Verify member invite functionality works

## Testing Checklist

- [ ] New users can sign up (profile created without email column)
- [ ] Club admins can invite users by email (RPC function works)
- [ ] Non-admins cannot call `find_user_by_email` (authorization check works)
- [ ] Member list displays names correctly (no email shown)
- [ ] No errors in console about missing email column

## Rollback Plan

If issues occur, rollback migration:

```sql
-- Re-add email column
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update trigger to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Populate existing profiles
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id;
```

## Future Considerations

- Email is available via `user.email` in frontend auth context when needed
- For admin email displays, create additional secure RPC if required
- Consider audit logging for email lookup function calls
- Monitor RLS policy effectiveness with Supabase logs

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Users Table](https://supabase.com/docs/guides/auth/managing-user-data)
- [Database Functions & Security](https://supabase.com/docs/guides/database/functions)
