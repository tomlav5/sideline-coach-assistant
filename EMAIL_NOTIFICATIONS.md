# Email Notification Structure

This document defines the content structure for all email notifications in the registration system.

## Email Configuration

**Recipient for approval notifications:** Your designated admin email address
**Sender:** noreply@sideline.app (or your configured domain)
**Service:** Resend, SendGrid, or Supabase Edge Functions + any SMTP provider

---

## 1. New Registration Notification (To Admin)

**Trigger:** New user signs up (email or OAuth)
**Recipient:** Super Admin email
**Subject:** `[SideLine] New Registration Approval Required`

**Content:**

```
Hi,

A new user has registered for SideLine and requires your approval:

User Details:
- Name: {first_name} {last_name}
- Email: {email}
- Registration Method: {oauth_provider} (Google, Apple, or Email)
- Registered: {created_at}

Action Required:
Review and approve/reject this registration in your admin dashboard:
{app_url}/admin/approvals

---
This is an automated notification from SideLine Coach Assistant.
```

---

## 2. Registration Approved (To User)

**Trigger:** Admin approves registration
**Recipient:** User's email
**Subject:** `Welcome to SideLine - Account Approved! 🎉`

**Content:**

```
Hi {first_name},

Great news! Your SideLine account has been approved.

You can now sign in and start using all features:
- Create and manage clubs
- Track matches in real-time
- Manage players and teams
- Generate detailed reports

Get Started:
{app_url}/auth

Need Help?
Visit our help center or reply to this email.

---
Welcome to the team!
The SideLine Team
```

---

## 3. Registration Rejected (To User)

**Trigger:** Admin rejects registration
**Recipient:** User's email
**Subject:** `SideLine Registration Update`

**Content:**

```
Hi {first_name},

Thank you for your interest in SideLine.

Unfortunately, we're unable to approve your account registration at this time.

{rejection_reason}

If you believe this is an error or have questions, please contact us at support@sideline.app.

---
The SideLine Team
```

---

## 4. Club Invitation (To Invitee)

**Trigger:** Club admin creates invitation
**Recipient:** Invited user's email
**Subject:** `You've been invited to join {club_name} on SideLine`

**Content:**

```
Hi,

{inviter_name} has invited you to join {club_name} on SideLine as a {role}.

About Your Role:
{role_description}

Accept Invitation:
{app_url}/invite/{invitation_token}

This invitation expires on {expiry_date}.

Not interested? Simply ignore this email.

---
The SideLine Team
```

**Role Descriptions:**
- **Admin:** Full control over club settings, teams, and members
- **Official:** Create and manage teams, track matches, and view reports
- **Viewer:** View match information and team details (read-only access)

---

## 5. Official Access Request (To Club Admin)

**Trigger:** User accepts invitation as official (needs approval)
**Recipient:** Club admin's email
**Subject:** `[SideLine] Official Access Request for {club_name}`

**Content:**

```
Hi {admin_name},

{user_name} has accepted your invitation to join {club_name} as an official and is awaiting your approval.

User Details:
- Name: {user_name}
- Email: {user_email}
- Invited: {invited_date}

Review Request:
{app_url}/admin/approvals

You invited this user, but as an official, they require final approval before gaining access.

---
This is an automated notification from SideLine Coach Assistant.
```

---

## 6. Official Access Approved (To Official)

**Trigger:** Club admin approves official
**Recipient:** Official's email
**Subject:** `Access Granted - {club_name} on SideLine`

**Content:**

```
Hi {first_name},

Your access to {club_name} has been approved!

You can now:
- Create and manage teams
- Track live matches
- Record player data
- View club analytics

Start Managing:
{app_url}/club-management

---
The SideLine Team
```

---

## 7. Official Access Rejected (To Official)

**Trigger:** Club admin rejects official
**Recipient:** Official's email
**Subject:** `Club Access Update - {club_name}`

**Content:**

```
Hi {first_name},

Your request to join {club_name} as an official was not approved by the club administrator.

If you have questions, please contact the club administrator directly.

---
The SideLine Team
```

---

## 8. Welcome Email (After First Login - Optional)

**Trigger:** User's first successful login after approval
**Recipient:** User's email
**Subject:** `Getting Started with SideLine`

**Content:**

```
Hi {first_name},

Welcome to SideLine! Here's how to get started:

1. Create Your First Club
   Go to Club Management and set up your organization.

2. Add Teams
   Create teams and assign players.

3. Schedule Matches
   Set up your fixtures for the season.

4. Track Live Matches
   Use our real-time match tracker during games.

5. Invite Your Team
   Send invitations to coaches, helpers, and parents.

Quick Start Guide:
{app_url}/help/getting-started

Need Help?
Reply to this email or visit our help center.

---
Happy Coaching!
The SideLine Team
```

---

## Implementation Notes

### Email Service Setup (Edge Function)

**File:** `supabase/functions/send-notification-email/index.ts`

**Environment Variables Needed:**
```
ADMIN_EMAIL=your-email@example.com
RESEND_API_KEY=re_xxx (or your email service API key)
APP_URL=https://your-app-url.com
```

**Trigger Mechanism:**
- Use Supabase Database Webhooks or Triggers
- Call Edge Function when records inserted into:
  - `pending_registrations` (Email #1)
  - `admin_notifications` (Emails #5)
  - After approval/rejection functions (Emails #2, #3, #6, #7)
  - After invitation creation (Email #4)

### Email Templates

Store templates in:
- `supabase/functions/email-templates/` (HTML/text files)
- Or use email service's template system (Resend, SendGrid templates)

### Personalization Tokens

Replace these in templates:
- `{first_name}`, `{last_name}`, `{email}`
- `{club_name}`, `{role}`, `{inviter_name}`
- `{invitation_token}`, `{expiry_date}`
- `{app_url}`, `{rejection_reason}`

### Styling (Later Phase)

When ready to add styling:
- Use email-safe HTML/CSS
- Inline styles only
- Responsive design for mobile
- SideLine brand colors
- Test across email clients

### Testing

Test emails with:
- Mailtrap (development)
- Real email (staging)
- Multiple clients (Gmail, Outlook, Apple Mail)

---

## Priority Order for Implementation

1. **Email #1** - New Registration (Critical - you need to know)
2. **Email #2** - Registration Approved (High - user needs access)
3. **Email #4** - Club Invitation (High - core feature)
4. **Email #5** - Official Access Request (Medium)
5. **Email #6** - Official Approved (Medium)
6. **Email #3, #7** - Rejections (Low priority - hopefully rare)
7. **Email #8** - Welcome email (Nice to have)

---

## Email Sending Rate Limits

**Resend Free Tier:** 100 emails/day, 3,000/month
**SendGrid Free Tier:** 100 emails/day

For production, consider paid tier based on user volume.
