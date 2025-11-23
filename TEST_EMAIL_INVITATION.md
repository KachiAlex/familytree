# Test Email Invitation - Quick Guide

## ✅ Function Deployed Successfully!

The `sendInvitationEmail` function is now live. Follow these steps to test it:

## Step 1: Verify Gmail Credentials Are Set

Run these commands to verify your secrets are configured:

```bash
firebase functions:secrets:access GMAIL_USER
firebase functions:secrets:access GMAIL_APP_PASSWORD
```

If you see your email address and app password, you're good to go! ✅

If you see an error, set them up:
```bash
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

## Step 2: Test Email Sending

### Option A: Test from Person Detail Page (Recommended)

1. **Go to your app:** https://familytree-2025.web.app
2. **Navigate to any person's detail page**
3. **Click "Invite to Claim" button**
4. **Enter a test email address** (use your own email to test)
5. **Click "Create Invitation"**
6. **Check your inbox!** (and spam folder)

### Option B: Test from Family Settings

1. **Go to Family Settings** (gear icon in family tree page)
2. **Scroll to "Invite Family Members" section**
3. **Enter an email address**
4. **Click "Invite"**
5. **Check the recipient's inbox!**

## Step 3: Verify Email Was Sent

### Check Firebase Functions Logs

```bash
firebase functions:log --only sendInvitationEmail
```

Look for:
- ✅ `Email sent successfully: <message-id>` - **SUCCESS!**
- ❌ `Error sending invitation email:` - Check credentials
- ⚠️ `Email service not configured` - Secrets not set

### Check Firestore

1. Go to Firebase Console: https://console.firebase.google.com/project/familytree-2025/firestore
2. Navigate to `personInvitations` collection
3. Find the invitation you just created
4. Check these fields:
   - `email_sent`: Should be `true` if successful
   - `email_sent_at`: Timestamp when email was sent
   - `email_error`: Will show error message if failed

## Step 4: What the Email Looks Like

The recipient will receive a professional HTML email with:
- **Subject:** "You've been invited to claim your family profile - [Person Name]"
- **Content:**
  - Welcome message
  - Person's name and family name
  - Big "Claim My Profile" button
  - Invitation link (valid for 7 days)
  - Expiration notice

## Troubleshooting

### Email Not Received?

1. **Check spam folder** - Gmail sometimes filters automated emails
2. **Check Firebase Functions logs** for errors
3. **Verify email address** is correct
4. **Check Gmail sending limits** - 500 emails/day max

### "Email service not configured" Error

- Secrets not set: Run `firebase functions:secrets:set GMAIL_USER` and `GMAIL_APP_PASSWORD`
- Wrong credentials: Verify app password is correct (16 characters, no spaces)

### "Invalid login" Error

- App password is incorrect
- 2FA not enabled on Gmail account
- Using regular password instead of app password

### Email Sent But Not Received

- Check spam/junk folder
- Verify recipient email is correct
- Gmail may have rate-limited (500/day limit)
- Wait a few minutes and check again

## Success Indicators

✅ **Function deployed successfully** (you saw this!)
✅ **Secrets configured** (verify with `firebase functions:secrets:access`)
✅ **Email sent successfully** (check logs)
✅ **Email received** (check inbox)

## Next Steps After Testing

Once you confirm emails are working:

1. **Invite real family members** using the "Invite to Claim" feature
2. **Monitor usage** - Gmail allows 500 emails/day (free)
3. **Consider upgrading** if you exceed limits:
   - Brevo: 9,000 emails/month free
   - Amazon SES: $0.10 per 1,000 emails

## Need Help?

- Check logs: `firebase functions:log --only sendInvitationEmail`
- View function in console: https://console.firebase.google.com/project/familytree-2025/functions
- See full setup guide: `EMAIL_SETUP_GUIDE.md`

