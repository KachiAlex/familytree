# Email Invitation Setup Guide

## Problem
Email invitations are not being sent because the email service is not configured.

## Solution
I've implemented the email sending function. You just need to configure Gmail credentials.

## Quick Setup (5 minutes)

### Step 1: Get Gmail App Password

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not already enabled)
3. Go to https://myaccount.google.com/apppasswords
4. Select:
   - **App:** Mail
   - **Device:** Other (Custom name)
   - **Name:** Firebase Functions
5. Click **Generate**
6. **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)

### Step 2: Set Firebase Functions Secrets

Run these commands in your terminal:

```bash
# Set Gmail email address
firebase functions:secrets:set GMAIL_USER

# When prompted, enter your Gmail address (e.g., your-email@gmail.com)

# Set Gmail app password
firebase functions:secrets:set GMAIL_APP_PASSWORD

# When prompted, paste the 16-character app password (no spaces)
```

### Step 3: Deploy Firebase Functions

```bash
cd functions
npm install  # Make sure nodemailer is installed
cd ..
firebase deploy --only functions:sendInvitationEmail
```

### Step 4: Test It!

1. Go to your app
2. Navigate to a person's detail page
3. Click **"Invite to Claim"**
4. Enter an email address
5. Click **"Create Invitation"**
6. Check the recipient's inbox!

## Verify It's Working

Check Firebase Functions logs:

```bash
firebase functions:log --only sendInvitationEmail
```

Look for:
- ✅ `Email sent successfully: <message-id>` - Success!
- ❌ `Error sending invitation email:` - Check credentials

## Troubleshooting

### "Email service not configured"
- Gmail credentials not set
- Run: `firebase functions:secrets:access GMAIL_USER` to verify

### "Invalid login"
- App password is incorrect
- Make sure you're using the app password, not your regular password
- Ensure 2FA is enabled

### Email not received
- Check spam folder
- Verify email address is correct
- Check Firebase Functions logs for errors

## Cost

- **Gmail SMTP:** FREE (500 emails/day limit)
- **Firebase Functions:** FREE (2M invocations/month free tier)

## Alternative: Use a Different Email Service

If you prefer not to use Gmail, you can modify the `createTransporter()` function in `functions/index.js` to use:
- **Brevo** (9,000 emails/month free)
- **Amazon SES** ($0.10 per 1,000 emails)
- **Resend** (3,000 emails/month free)

See `EMAIL_SENDING_OPTIONS.md` for details.

