# Admin Accounts Guide

## Overview

This is a **multi-tenant application** - there is **no global admin account**. Instead, each family has its own admin.

## How Admin Accounts Work

### Family Admin (Per-Family)

**Who becomes admin?**
- The person who **registers a new family** automatically becomes that family's **admin**
- When you register at http://localhost:3000/register, you create:
  1. Your user account
  2. A new family
  3. You are automatically set as the **admin** of that family

**Admin Permissions:**
- ✅ Invite family members
- ✅ Manage family settings
- ✅ Add/edit/delete persons in the family tree
- ✅ Upload documents
- ✅ Manage family subscription (when payment is implemented)

**Admin Role:**
- Stored in `family_members` table with `role = 'admin'`
- Each family can have multiple admins (if you invite someone as admin)

### User Roles

**In the `users` table:**
- Default role: `'member'`
- This is a global user role (not family-specific)
- Currently not heavily used, but available for future features

## Creating Your First Admin Account

### Step 1: Register a Family

1. Go to http://localhost:3000/register
2. Fill in:
   - **Your Account Info:**
     - Full Name
     - Email
     - Password
   - **Family Info:**
     - Family Name (required, must be unique)
     - Clan Name (optional)
     - Village Origin (optional)
3. Click "Register"

### Step 2: You're Now Admin!

After registration:
- ✅ You're logged in automatically
- ✅ You're the admin of your family
- ✅ You can invite other family members
- ✅ You have full control of your family tree

## Database Admin (PostgreSQL)

**PostgreSQL Admin Account:**
- **Username:** `postgres` (default)
- **Password:** The password you set during PostgreSQL installation
- **Your current password:** `Dabonega$reus2660` (from your .env file)

**To access PostgreSQL:**
```powershell
psql -U postgres
# Or with your specific database
psql -U postgres -d familytree
```

## Application Admin vs Database Admin

| Type | Purpose | Credentials |
|------|---------|-------------|
| **Family Admin** | Manage a specific family tree | Created during registration |
| **PostgreSQL Admin** | Database administration | `postgres` user + your password |

## Inviting Additional Admins

As a family admin, you can invite other users and assign them admin role:

```javascript
// Via API
POST /api/families/:familyId/invite
{
  "email": "newadmin@example.com",
  "role": "admin"  // or "member"
}
```

## Checking Your Admin Status

**In the application:**
- Go to Family Settings
- You'll see your role displayed
- Admins can see "Invite Family Members" section

**In the database:**
```sql
-- Check your admin status for a family
SELECT fm.role, f.family_name, u.email
FROM family_members fm
JOIN families f ON fm.family_id = f.family_id
JOIN users u ON fm.user_id = u.user_id
WHERE u.email = 'your-email@example.com';
```

## Summary

- **No global application admin** - each family manages itself
- **First person to register a family = Family Admin**
- **PostgreSQL admin = `postgres` user** (for database management)
- **You become admin automatically** when you register your family

---

**To get started, just register at http://localhost:3000/register and you'll be the admin of your family!**

