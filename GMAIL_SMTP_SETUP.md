# Setting Up Gmail SMTP with Firebase Functions
## Free Email Sending Solution

### Overview
Gmail SMTP allows you to send emails for **FREE** using Firebase Cloud Functions. This is perfect for low to medium volume email sending.

### Limitations
- **500 emails per day** (15,000/month) limit
- Requires Gmail account setup
- Less reliable than dedicated email services
- May have deliverability issues (spam filters)

### Step 1: Enable Gmail App Password

1. **Enable 2-Factor Authentication** on your Gmail account:
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Firebase Functions" as the name
   - Copy the 16-character password (you'll need this)

### Step 2: Set Up Firebase Functions

1. **Initialize Functions** (if not already done):
   ```bash
   firebase init functions
   ```

2. **Install Nodemailer**:
   ```bash
   cd functions
   npm install nodemailer
   ```

### Step 3: Create Email Function

Create `functions/src/sendInvitationEmail.js`:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// Configure Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com', // Your Gmail address
    pass: 'your-app-password' // The 16-character app password
  }
});

// Cloud Function triggered when invitation is created
exports.sendInvitationEmail = functions.firestore
  .document('personInvitations/{invitationId}')
  .onCreate(async (snap, context) => {
    const invitation = snap.data();
    
    // Only send if status is pending
    if (invitation.status !== 'pending') {
      return null;
    }

    const claimLink = `https://your-domain.web.app/claim/${invitation.token}`;
    
    const mailOptions = {
      from: 'your-email@gmail.com',
      to: invitation.email,
      subject: `Claim Your Family Tree Profile - ${invitation.person_name || 'Family Member'}`,
      html: `
        <h2>You've been invited to claim your family tree profile!</h2>
        <p>Someone has added you to their family tree and invited you to claim your profile.</p>
        <p><strong>Person:</strong> ${invitation.person_name || 'Family Member'}</p>
        <p>Click the link below to claim your profile:</p>
        <p><a href="${claimLink}" style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Claim Profile</a></p>
        <p>Or copy this link: ${claimLink}</p>
        <p>This invitation expires in 7 days.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">If you didn't expect this email, you can safely ignore it.</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully to:', invitation.email);
      return null;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send email');
    }
  });
```

### Step 4: Store Credentials Securely

**Option A: Environment Variables (Recommended)**
```bash
firebase functions:config:set gmail.user="your-email@gmail.com" gmail.pass="your-app-password"
```

Then update the function:
```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().gmail.user,
    pass: functions.config().gmail.pass
  }
});
```

**Option B: Firebase Secret Manager (More Secure)**
```bash
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_PASS
```

### Step 5: Deploy

```bash
firebase deploy --only functions
```

### Step 6: Update Frontend

Update `PersonDetail.js` to remove the manual link sharing and show "Email sent!" instead:

```javascript
// After creating invitation
await addDoc(invitationsRef, {
  // ... invitation data
});

// Show success message
setInviteSuccess(true);
setInviteMessage('Invitation email has been sent!');
```

### Testing

1. Create a test invitation in Firestore
2. Check function logs: `firebase functions:log`
3. Verify email is received

### Troubleshooting

**Email not sending:**
- Check Gmail app password is correct
- Verify 2FA is enabled
- Check function logs for errors
- Ensure email is not in spam folder

**Rate limiting:**
- Gmail limits: 500 emails/day
- If exceeded, wait 24 hours or use a different service

### Security Notes

- ⚠️ Never commit app passwords to git
- ✅ Use environment variables or secret manager
- ✅ Restrict function to authenticated users only
- ✅ Validate email addresses before sending

### Cost

- **Gmail SMTP:** FREE
- **Firebase Functions:** 
  - Free tier: 2M invocations/month
  - After: $0.40 per million
  - **Total: FREE for most use cases**

### When to Upgrade

Upgrade to a paid service if:
- You exceed 500 emails/day
- You need better deliverability
- You need analytics/tracking
- You need higher reliability

Recommended upgrade path:
1. Gmail SMTP (FREE) → 2. Brevo (9K/month free) → 3. Amazon SES ($1/10K)

