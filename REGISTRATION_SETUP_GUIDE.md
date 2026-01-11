# Registration System Setup Guide

Complete guide to deploying the Gold Standard registration system.

---

## 🗄️ Step 1: Run Database Migrations

Execute the migrations in order:

```bash
# From your project root
cd supabase

# Apply migrations to your Supabase project
npx supabase db push
```

**Migrations Applied:**
1. `20260110_registration_system.sql` - Tables, functions, RLS policies
2. `20260110_add_super_admin.sql` - Super admin flag
3. `20260110_set_initial_super_admin.sql` - Sets your account as super admin

**Verify migrations:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pending_registrations', 'club_invitations', 'admin_notifications');

-- Verify you're super admin
SELECT user_id, is_super_admin, account_status 
FROM profiles 
WHERE user_id = 'd0ab792f-2519-45a9-9ee0-74467fd51039';
```

---

## 🔐 Step 2: Configure OAuth Providers

### Google OAuth Setup

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com/
   - Create new project or select existing

2. **Enable Google+ API**
   - APIs & Services → Library
   - Search "Google+ API" → Enable

3. **Create OAuth Credentials**
   - APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Name: "SideLine Coach Assistant"

4. **Configure Authorized Redirect URIs**
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with your Supabase project reference

5. **Get Credentials**
   - Copy Client ID
   - Copy Client Secret

6. **Add to Supabase**
   - Supabase Dashboard → Authentication → Providers
   - Enable Google
   - Paste Client ID and Client Secret
   - Save

### Apple Sign In Setup (Optional - for iOS app)

1. **Apple Developer Account Required**
   - https://developer.apple.com/

2. **Create Services ID**
   - Certificates, Identifiers & Profiles
   - Identifiers → Services IDs → Create new

3. **Configure Sign In with Apple**
   - Enable "Sign In with Apple"
   - Add redirect URI from Supabase

4. **Add to Supabase**
   - Supabase Dashboard → Authentication → Providers
   - Enable Apple
   - Add Services ID and Key

### Facebook OAuth (Optional - declining popularity)

Similar process to Google, using Facebook Developer Console.

---

## ✉️ Step 3: Email Notifications Setup

### Option A: Resend (Recommended - Simple)

1. **Create Resend Account**
   - https://resend.com/signup
   - Free tier: 3,000 emails/month

2. **Get API Key**
   - Dashboard → API Keys → Create

3. **Set Environment Variable**
   ```bash
   # In Supabase Dashboard → Settings → Edge Functions
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ADMIN_EMAIL=your-email@example.com
   APP_URL=https://your-app-url.com
   ```

4. **Create Edge Function**
   ```bash
   npx supabase functions new send-notification-email
   ```

5. **Deploy Edge Function**
   ```bash
   npx supabase functions deploy send-notification-email
   ```

### Option B: SendGrid

Similar to Resend:
1. Create SendGrid account
2. Get API key
3. Set environment variables
4. Deploy Edge Function

### Option C: Custom SMTP

Use any SMTP provider (Gmail, AWS SES, etc.)

**For now, you can skip email setup and manually check the admin dashboard** - emails are enhancement, not critical for testing.

---

## 🎨 Step 4: Update Frontend Environment

### Update `.env.local`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:8080
```

### Regenerate Supabase Types (after migrations)

```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

This will resolve all TypeScript errors related to new tables.

---

## 🧪 Step 5: Test the Registration Flow

### Test 1: New User Registration (Email)

1. **Sign Out** (if logged in)
2. Go to `/auth`
3. Click "Sign Up" tab
4. Fill in details with EMAIL/PASSWORD
5. Submit registration
6. **Expected:** Redirect to `/pending-approval`
7. **In Database:** Check `pending_registrations` table
8. **Admin Dashboard:** Go to `/admin/approvals`
9. **Approve** the registration
10. **User:** Should be able to sign in

### Test 2: OAuth Registration (Google)

1. Click "Continue with Google"
2. Complete Google OAuth
3. **Expected:** Redirect to `/auth/callback` then `/pending-approval`
4. Admin approves via `/admin/approvals`
5. User can access dashboard

### Test 3: Club Invitation (Viewer - Auto Approve)

1. **As Admin:** Go to `/club-management`
2. Open a club
3. Click "Invite Members" tab
4. Enter email, select "Viewer" role
5. Click "Send Invitation"
6. **Expected:** Invitation link generated
7. **As Invitee:** Open invitation link `/invite/{token}`
8. Accept invitation
9. **Expected:** Immediate access (no approval needed)

### Test 4: Club Invitation (Official - Needs Approval)

1. Invite user as "Official"
2. User accepts invitation
3. **Expected:** Redirect to `/pending-approval`
4. **Admin:** See request in `/admin/approvals` → Officials tab
5. Approve official
6. **User:** Can access club

---

## 🚀 Step 6: Deploy to Production

### Deploy Migrations

```bash
# Connect to production
npx supabase link --project-ref your-prod-ref

# Push migrations
npx supabase db push
```

### Configure Production OAuth

Repeat OAuth setup with production URLs:
```
https://<prod-project-ref>.supabase.co/auth/v1/callback
```

### Deploy Frontend

```bash
# Build production
npm run build

# Deploy to your hosting (Netlify, Vercel, etc.)
```

### Test Production Flow

Go through all test scenarios in production environment.

---

## 📊 Step 7: Monitor & Maintain

### Admin Responsibilities

**Daily/Weekly:**
- Check `/admin/approvals` for pending registrations
- Review official requests
- Monitor invitation activity

**Monthly:**
- Review rejected accounts (if any)
- Check email delivery rates
- Monitor user growth

### Database Queries for Monitoring

```sql
-- Pending approvals count
SELECT COUNT(*) FROM pending_registrations WHERE status = 'pending';

-- Recent registrations
SELECT * FROM pending_registrations 
ORDER BY created_at DESC LIMIT 10;

-- Active invitations
SELECT * FROM club_invitations 
WHERE status = 'pending' AND expires_at > NOW();

-- Club membership stats
SELECT 
  clubs.name,
  COUNT(club_members.id) as member_count,
  COUNT(CASE WHEN club_members.role = 'admin' THEN 1 END) as admins,
  COUNT(CASE WHEN club_members.role = 'official' THEN 1 END) as officials,
  COUNT(CASE WHEN club_members.role = 'viewer' THEN 1 END) as viewers
FROM clubs
LEFT JOIN club_members ON clubs.id = club_members.club_id
GROUP BY clubs.id, clubs.name;
```

---

## 🔧 Troubleshooting

### Issue: OAuth redirect fails

**Solution:** Check authorized redirect URIs match exactly:
```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

### Issue: User stuck at pending approval

**Check:**
1. Is profile.account_status = 'approved'?
2. Is there a pending_registrations record?
3. Has admin approved via dashboard?

**Fix:**
```sql
-- Manually approve if needed
UPDATE profiles 
SET account_status = 'approved' 
WHERE user_id = 'user-uuid-here';
```

### Issue: Invitation link shows "Invalid"

**Check:**
1. Is invitation expired? (expires_at < NOW())
2. Is status = 'pending'?
3. Is token correct in URL?

**Fix:**
```sql
-- Extend expiration
UPDATE club_invitations 
SET expires_at = NOW() + INTERVAL '7 days'
WHERE invitation_token = 'token-here';
```

### Issue: TypeScript errors in IDE

**Solution:** Regenerate types after running migrations:
```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Issue: Emails not sending

**Check:**
1. Environment variables set correctly?
2. Edge Function deployed?
3. API key valid?
4. Check Edge Function logs in Supabase Dashboard

---

## 📝 Post-Launch Checklist

- [ ] Migrations applied to production
- [ ] Google OAuth configured
- [ ] Super admin set (UUID: d0ab792f-2519-45a9-9ee0-74467fd51039)
- [ ] Admin email configured
- [ ] Email notifications tested
- [ ] All user flows tested in production
- [ ] Admin can access `/admin/approvals`
- [ ] Club invitations working
- [ ] Documentation shared with team
- [ ] Monitor setup for pending registrations

---

## 🎯 Next Steps (Future Enhancements)

1. **Email Styling** - Add HTML templates with branding
2. **Admin Dashboard Enhancements** - Bulk actions, filters, search
3. **Invitation Analytics** - Track acceptance rates
4. **User Onboarding** - Welcome tour for new users
5. **Notification Badges** - Show pending count in nav
6. **Email Preferences** - Let users control notifications
7. **API Rate Limiting** - Prevent invitation spam
8. **Audit Log** - Track all approval actions

---

## 💡 Tips

- **Test thoroughly before launch** - All user paths, all roles
- **Communicate with users** - Set expectations about approval times
- **Monitor first week closely** - Fix issues quickly
- **Gather feedback** - Improve based on real usage
- **Document edge cases** - Build knowledge base

---

## 📞 Support

**Questions during setup?**
- Check Supabase logs: Dashboard → Logs
- Review migrations: Check for errors
- Test incrementally: One step at a time
- Document issues: For future reference

**System Working?**
- Users can register ✓
- OAuth functional ✓
- Approvals working ✓
- Invitations sending ✓
- Emails delivering ✓

---

Good luck with the launch! 🚀
