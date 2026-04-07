

## Current User Role System

Your app currently has **two layers** of access control:

### Layer 1: Platform-Level (profiles table)
- **`is_super_admin`** — a boolean on the `profiles` table. This is you — full site control, can approve/reject registrations, manage all users.
- **`account_status`** — controls whether a user can access the app at all (`pending` → `approved` → `rejected`).

### Layer 2: Club-Level (club_members table)
The `user_role` enum has three values:
- **`admin`** — club admin: can manage club settings, members, teams, players, fixtures, delete things
- **`official`** — can manage teams, players, fixtures, track matches, but cannot delete or manage members
- **`viewer`** — read-only access to club data

### How This Maps to Your Vision

| Your concept | Current implementation | Notes |
|---|---|---|
| **Site Admin (you)** | `is_super_admin = true` on profiles | Approve registrations, see all admin notifications |
| **Team Admin** | `club_members.role = 'admin'` | Full control within their club(s) |
| **Parent** | `club_members.role = 'viewer'` | Read-only: can see fixtures, match reports, player stats |

### What's Missing for a "Parent" Role

The current `viewer` role already works as a parent-type user, but there's no distinct `parent` label or parent-specific features yet. If you want parents to have a differentiated experience, we could:

1. **Keep it as-is** — parents are just `viewer` members of a club. Simple, already works.
2. **Rename/rebrand** — show "Parent" in the UI instead of "Viewer" for clarity, but keep the same permissions.
3. **Add a dedicated `parent` role** — with tailored features like seeing only their own child's data, receiving match notifications, etc. This would require a new enum value and new RLS policies.

### Recommendation

Option 2 is the quickest win — relabel "Viewer" as "Parent" in the UI while keeping the existing permission model. Option 3 is better long-term if parents should only see their own child's playing time rather than the whole team.

### Technical Details

- The `user_role` enum is defined in Postgres: `admin | official | viewer`
- Adding a new role (e.g. `parent`) requires a migration to alter the enum and update RLS policies
- The `is_super_admin` flag is separate from club roles — you can be a super admin AND a club admin simultaneously
- Invitation system already supports role assignment when inviting members

