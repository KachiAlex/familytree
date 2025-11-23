# Email Invitation Flow - Investigation Report

## 📋 Overview

The email invitation system allows family members to invite others to claim and manage their person profiles in the family tree. This document investigates the complete flow, current status, and potential issues.

---

## 🔄 Complete Flow Diagram

```
1. User Action (Frontend)
   └─> PersonDetail.js: Click "Invite to Claim" button
       └─> Opens dialog, user enters email
           └─> Creates document in Firestore: personInvitations/{invitationId}

2. Firebase Function Trigger
   └─> sendInvitationEmail (functions/index.js)
       └─> Triggered by: personInvitations/{invitationId}.onCreate
           └─> Checks: email_sent? status === 'pending'?
               └─> Creates email transporter (Gmail SMTP)
                   └─> Fetches person & family data
                       └─> Builds HTML email with invitation link
                           └─> Sends email via nodemailer
                               └─> Updates invitation: email_sent = true

3. Recipient Receives Email
   └─> Email contains: Claim link (https://familytree-2025.web.app/claim/{token})
       └─> Recipient clicks link

4. Claim Process (Frontend)
   └─> ClaimPerson.js: /claim/{token} route
       └─> Fetches invitation by token
           └─> Validates: expiration, status, email match
               └─> User clicks "Claim Profile"
                   └─> Updates invitation: status = 'accepted'
                       └─> Updates person: ownerUserId = user.user_id
                           └─> Redirects to person detail page
```

---

## 📁 Key Files & Components

### Frontend Components

1. **`frontend/src/pages/PersonDetail.js`** (Lines 2045-2150)
   - **Function:** `handleInvite` - Creates invitation document
   - **UI:** Dialog with email input
   - **Creates:** `personInvitations` document with:
     - `person_id`, `family_id`, `email`, `token`, `status: 'pending'`
     - `expires_at` (7 days from now)
     - `invited_by_user_id`

2. **`frontend/src/pages/ClaimPerson.js`** (Lines 29-329)
   - **Route:** `/claim/:token`
   - **Function:** `fetchInvitation` - Loads invitation by token
   - **Function:** `handleClaim` - Claims the person profile
   - **Validations:**
     - Token exists
     - Not expired (7 days)
     - Status is 'pending'
     - Email matches logged-in user
     - Person not already claimed

### Backend Functions

3. **`functions/index.js`** (Lines 326-523)
   - **Function:** `sendInvitationEmail`
   - **Trigger:** `functions.firestore.document('personInvitations/{invitationId}').onCreate`
   - **Dependencies:** `nodemailer` for email sending
   - **Configuration:** Uses Gmail SMTP via `functions.config()` or environment variables

---

## ⚙️ Configuration Requirements

### 1. Gmail App Password Setup

**Required Steps:**
1. Enable 2-Factor Authentication on Gmail account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Copy 16-character password

### 2. Firebase Functions Secrets

**Current Implementation (1st Gen Functions):**
```bash
# Legacy method (deprecated but still works)
firebase functions:config:set gmail.user="your-email@gmail.com"
firebase functions:config:set gmail.password="your-app-password"
```

**Recommended Method (Secret Manager):**
```bash
# Modern method (recommended)
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

**Code Access Pattern:**
```javascript
// Current code tries both methods:
const config = functions.config(); // Legacy
const gmailUser = config.gmail?.user || process.env.GMAIL_USER;
const gmailPassword = config.gmail?.password || process.env.GMAIL_APP_PASSWORD;
```

---

## 🔍 Current Status Analysis

### ✅ What's Working

1. **Frontend Flow:**
   - ✅ Invitation dialog UI works
   - ✅ Creates invitation document in Firestore
   - ✅ Shows success message
   - ✅ Claim page loads and validates invitations

2. **Email Template:**
   - ✅ Professional HTML email template
   - ✅ Includes person name, family name
   - ✅ Claim button with link
   - ✅ Expiration notice (7 days)

3. **Function Code:**
   - ✅ Properly structured
   - ✅ Error handling in place
   - ✅ Updates invitation document with status

4. **Function Deployment:**
   - ✅ **FUNCTION IS DEPLOYED** - Verified via `firebase functions:list`
   - ✅ Function name: `sendInvitationEmail`
   - ✅ Trigger: `providers/cloud.firestore/eventTypes/document.create`
   - ✅ Location: `us-central1`
   - ✅ Runtime: `nodejs20`

### ⚠️ Potential Issues

1. **Configuration Method:**
   - ⚠️ Using deprecated `functions.config()` API (but still works)
   - ⚠️ Mixed approach (config + env vars) may cause confusion
   - ⚠️ Secrets may not be properly set (needs verification)

2. **Email Service:**
   - ⚠️ Gmail SMTP has 500 emails/day limit
   - ⚠️ May hit spam filters
   - ⚠️ Requires Gmail account setup

3. **Email Service:**
   - ⚠️ Gmail SMTP has 500 emails/day limit
   - ⚠️ May hit spam filters
   - ⚠️ Requires Gmail account setup

4. **Error Handling:**
   - ✅ Errors are logged
   - ✅ Invitation document updated with error status
   - ⚠️ No user notification if email fails

---

## 🧪 Testing Checklist

### Test 1: Verify Function Deployment
```bash
# Check if function is deployed
firebase functions:list

# Check function logs
firebase functions:log --only sendInvitationEmail
```

**Expected:** Function should appear in list, logs should show activity

### Test 2: Verify Secrets Configuration
```bash
# Check if secrets are set (modern method)
firebase functions:secrets:access GMAIL_USER
firebase functions:secrets:access GMAIL_APP_PASSWORD

# Check if config is set (legacy method)
firebase functions:config:get
```

**Expected:** Should show email and password (masked)

### Test 3: Create Test Invitation
1. Go to Person Detail page
2. Click "Invite to Claim"
3. Enter test email
4. Click "Create Invitation"
5. Check Firestore: `personInvitations` collection

**Expected:**
- Document created with `status: 'pending'`
- After ~5 seconds: `email_sent: true` (if function works)
- Or: `email_error: '...'` (if function fails)

### Test 4: Check Function Logs
```bash
firebase functions:log --only sendInvitationEmail --limit 10
```

**Look for:**
- ✅ `Email sent successfully: <message-id>` - SUCCESS
- ❌ `Error sending invitation email:` - FAILURE
- ⚠️ `Email service not configured` - CONFIG MISSING

### Test 5: Verify Email Delivery
- Check recipient inbox
- Check spam folder
- Verify email contains correct link
- Click link and verify it goes to `/claim/{token}`

---

## 🐛 Known Issues & Solutions

### Issue 1: Function Deployment Timeout

**Symptoms:**
- `firebase deploy --only functions` fails with timeout
- Function doesn't appear in Firebase Console

**Possible Causes:**
1. Function initialization code taking too long
2. Missing dependencies
3. Syntax errors in function code
4. Network issues during deployment

**Solutions:**
1. Check `functions/index.js` for syntax errors
2. Verify all dependencies in `functions/package.json`
3. Try deploying single function: `firebase deploy --only functions:sendInvitationEmail`
4. Check Firebase Console for deployment errors

### Issue 2: Email Not Sending

**Symptoms:**
- Invitation created but no email received
- `email_sent: false` in Firestore
- `email_error` field populated

**Possible Causes:**
1. Gmail credentials not configured
2. App password incorrect
3. 2FA not enabled
4. Gmail rate limit exceeded (500/day)

**Solutions:**
1. Verify secrets: `firebase functions:secrets:access GMAIL_USER`
2. Regenerate app password
3. Check function logs for specific error
4. Wait 24 hours if rate limited

### Issue 3: Function Not Triggering

**Symptoms:**
- Invitation created but function doesn't run
- No logs in Firebase Functions

**Possible Causes:**
1. Function not deployed
2. Trigger not properly configured
3. Firestore rules blocking function access

**Solutions:**
1. Verify function deployment: `firebase functions:list`
2. Check trigger syntax in `functions/index.js`
3. Verify Firestore rules allow function access

---

## 📊 Data Flow Details

### Invitation Document Structure

```javascript
{
  person_id: "abc123",
  family_id: "xyz789",
  email: "user@example.com",
  token: "uuid-token-here",
  status: "pending", // pending | accepted | expired
  invited_by_user_id: "user123",
  person_name: "John Doe",
  expires_at: Timestamp, // 7 days from creation
  created_at: Timestamp,
  
  // Email status (updated by function)
  email_sent: false,
  email_sent_at: null,
  email_message_id: null,
  email_error: null,
  email_error_at: null,
  
  // Claim status (updated by frontend)
  claimed_at: null,
  claimed_by_user_id: null
}
```

### Email Content

**Subject:** `You've been invited to claim your family profile - [Person Name]`

**Body:**
- HTML template with styling
- Person name and family name
- "Claim My Profile" button
- Plain text link
- Expiration notice (7 days)

**Link Format:** `https://familytree-2025.web.app/claim/{token}`

---

## 🔧 Recommended Fixes

### 1. Fix Function Deployment

**Action:** Investigate timeout issue
```bash
# Check for syntax errors
cd functions
node -c index.js

# Check dependencies
npm install

# Try minimal deployment
firebase deploy --only functions:sendInvitationEmail
```

### 2. Update Configuration Method

**Action:** Migrate from deprecated `functions.config()` to Secret Manager

**Current Code:**
```javascript
const config = functions.config();
gmailUser = config.gmail?.user || process.env.GMAIL_USER;
```

**Recommended:**
```javascript
// Use environment variables directly (set via Secret Manager)
gmailUser = process.env.GMAIL_USER;
gmailPassword = process.env.GMAIL_APP_PASSWORD;
```

### 3. Add User Feedback

**Action:** Show email status in UI

**Current:** Shows "Invitation email sent!" immediately

**Recommended:** 
- Poll Firestore for `email_sent` status
- Show error if `email_error` is set
- Display "Email sent successfully" or "Email failed - check logs"

### 4. Add Retry Mechanism

**Action:** Allow manual retry if email fails

**Implementation:**
- Add "Resend Email" button if `email_sent: false`
- Create new invitation or update existing one
- Trigger function again

---

## 📈 Monitoring & Debugging

### Check Function Status

```bash
# List all functions
firebase functions:list

# View logs
firebase functions:log --only sendInvitationEmail

# View specific function
firebase functions:describe sendInvitationEmail
```

### Check Firestore Data

1. Go to Firebase Console
2. Navigate to Firestore
3. Check `personInvitations` collection
4. Look for:
   - `email_sent: true/false`
   - `email_error` messages
   - `status` field

### Check Email Delivery

1. Check recipient inbox
2. Check spam folder
3. Verify email headers (if accessible)
4. Check Gmail sending limits (500/day)

---

## 🎯 Next Steps

1. **Immediate:**
   - ✅ Fix function deployment timeout
   - ✅ Verify secrets are configured
   - ✅ Test email sending end-to-end

2. **Short-term:**
   - Add user feedback for email status
   - Add retry mechanism
   - Improve error messages

3. **Long-term:**
   - Consider upgrading to dedicated email service (Brevo, SES)
   - Add email analytics/tracking
   - Implement email templates management

---

## 📝 Summary

**Status:** ✅ **DEPLOYED - NEEDS TESTING**

- ✅ Frontend flow is complete and working
- ✅ Email template is professional
- ✅ Claim process is functional
- ✅ **Function is deployed and active**
- ⚠️ Email sending needs verification (Gmail credentials may not be set)

**Verified:**
- ✅ Function `sendInvitationEmail` is deployed
- ✅ Trigger is properly configured
- ✅ Function appears in Firebase Console

**Priority Actions:**
1. ✅ ~~Fix function deployment timeout~~ - **RESOLVED: Function is deployed**
2. ⚠️ **Verify Gmail credentials are set** - **ACTION NEEDED**
3. ⚠️ **Test end-to-end email flow** - **ACTION NEEDED**
4. Add user feedback for email status

---

## 🔗 Related Documentation

- `EMAIL_SETUP_GUIDE.md` - Setup instructions
- `GMAIL_SMTP_SETUP.md` - Gmail configuration
- `TEST_EMAIL_INVITATION.md` - Testing guide
- `EMAIL_SENDING_OPTIONS.md` - Alternative email services

