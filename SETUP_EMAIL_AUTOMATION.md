# Setup Automated Email Sending
## Gmail SMTP Configuration for Invitation Emails

### Overview
The invitation system now automatically sends emails when someone clicks "Invite to Claim". This guide will help you set up Gmail SMTP to enable automated email sending.

### Step 1: Enable Gmail App Password

1. **Enable 2-Factor Authentication** on your Gmail account:
   - Go to https://myaccount.google.com/security
   - Click "2-Step Verification"
   - Follow the prompts to enable it

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Select "Other (Custom name)" as the device
   - Enter "Firebase Functions" as the name
   - Click "Generate"
   - **Copy the 16-character password** (you'll need this in Step 2)

### Step 2: Configure Firebase Functions

You have two options to set Gmail credentials:

#### Option A: Firebase Functions Config (Recommended for Production)

```bash
firebase functions:config:set gmail.user="your-email@gmail.com"
firebase functions:config:set gmail.pass="your-16-char-app-password"
firebase functions:config:set app.url="https://familytree-2025.web.app"
```

#### Option B: Environment Variables (For Local Testing)

Create a `.env` file in the `functions` directory:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-16-char-app-password
APP_URL=https://familytree-2025.web.app
```

**Note:** For local testing with Firebase Emulators, you'll need to load these from `.env` file.

### Step 3: Deploy Firebase Functions

```bash
cd functions
npm install  # Make sure nodemailer is installed
cd ..
firebase deploy --only functions
```

### Step 4: Test the Email Sending

1. Go to your app
2. Navigate to a person's detail page
3. Click "Invite to Claim"
4. Enter an email address
5. Click "Create Invitation"
6. Check the recipient's inbox (and spam folder)

### Step 5: Verify Email Was Sent

Check Firebase Functions logs:

```bash
firebase functions:log
```

Look for:
- `Email sent successfully: <message-id>` - Success!
- `Error sending invitation email:` - Check credentials

### Troubleshooting

#### Email Not Sending

1. **Check Gmail credentials:**
   - Verify app password is correct (16 characters, no spaces)
   - Ensure 2FA is enabled
   - Make sure you're using the app password, not your regular password

2. **Check Firebase Functions logs:**
   ```bash
   firebase functions:log --only sendInvitationEmail
   ```

3. **Verify invitation was created:**
   - Check Firestore `personInvitations` collection
   - Look for `email_sent` field (should be `true` if sent)
   - Check `email_error` field for error messages

#### Common Errors

**"Email service not configured"**
- Gmail credentials not set in Firebase Functions config
- Run: `firebase functions:config:get` to verify

**"Invalid login"**
- App password is incorrect
- 2FA not enabled
- Using regular password instead of app password

**"Rate limit exceeded"**
- Gmail limit: 500 emails/day
- Wait 24 hours or upgrade to a paid email service

### Email Limits

- **Gmail Free:** 500 emails/day (15,000/month)
- If you exceed this, consider upgrading to:
  - Brevo (9,000/month free)
  - Amazon SES ($0.10 per 1,000 emails)

### Security Notes

- ⚠️ **Never commit app passwords to git**
- ✅ App passwords are stored securely in Firebase Functions config
- ✅ Only accessible by Firebase Functions
- ✅ Not exposed to client-side code

### Cost

- **Gmail SMTP:** FREE
- **Firebase Functions:** 
  - Free tier: 2M invocations/month
  - After: $0.40 per million
  - **Total: FREE for most use cases**

### Next Steps

Once configured, the email sending is fully automated:
1. User clicks "Invite to Claim"
2. Enters email address
3. System creates invitation in Firestore
4. Firebase Function automatically triggers
5. Email is sent to recipient
6. Recipient clicks link to claim profile

No manual steps required! 🎉

