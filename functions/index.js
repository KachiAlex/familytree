const functions = require('firebase-functions');
// Using v1 functions API (1st Gen) - secrets need to be set via functions.config()
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();

// Allow CORS from any origin (you can restrict this later)
app.use(cors({ origin: true }));
app.use(express.json());

// JWT secret (for dev you can override via functions config or env)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-firebase-config';

// Helper: create error response from validation
const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// Auth middleware (JWT)
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Load user from Firestore
    const userSnap = await db.collection('users').doc(decoded.userId).get();
    if (!userSnap.exists) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { user_id: userSnap.id, ...userSnap.data() };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Simple Firestore check
    await db.collection('healthChecks').doc('ping').set(
      { timestamp: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({
      status: 'ok',
      message: 'Firebase Functions API is running',
      environment: process.env.NODE_ENV || 'cloud',
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: 'Failed health check' });
  }
});

// AUTH ROUTES

// Register (family-first registration, using Firestore)
app.post(
  '/api/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('full_name').notEmpty().trim(),
    body('family_name').notEmpty().trim(),
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;

      const { email, password, full_name, phone, family_name, clan_name, village_origin } = req.body;

      // Check if user exists
      const existingUserSnap = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!existingUserSnap.empty) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Check if family name is already taken
      const existingFamilySnap = await db
        .collection('families')
        .where('family_name_lower', '==', family_name.toLowerCase())
        .limit(1)
        .get();

      if (!existingFamilySnap.empty) {
        return res.status(400).json({ error: 'Family name already taken. Please choose a different name.' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const userRef = db.collection('users').doc();
      await userRef.set({
        email,
        phone: phone || null,
        password_hash: passwordHash,
        full_name,
        role: 'member',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      const userId = userRef.id;

      // Free tier limits (simplified)
      const freeTier = {
        max_persons: 50,
        max_documents: 100,
        max_storage_mb: 500,
        max_members: 10,
      };

      // Create family
      const familyRef = db.collection('families').doc();
      await familyRef.set({
        family_name,
        family_name_lower: family_name.toLowerCase(),
        clan_name: clan_name || null,
        village_origin: village_origin || null,
        subscription_tier: 'free',
        subscription_status: 'active',
        subscription_start_date: admin.firestore.FieldValue.serverTimestamp(),
        subscription_end_date: null,
        ...freeTier,
        created_by_user_id: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      const familyId = familyRef.id;

      // Add creator as admin in familyMembers
      const familyMemberRef = db.collection('familyMembers').doc();
      await familyMemberRef.set({
        family_id: familyId,
        user_id: userId,
        role: 'admin',
        invited_by: userId,
        joined_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Generate JWT
      const token = jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      res.status(201).json({
        message: 'Family and account created successfully',
        user: {
          user_id: userId,
          email,
          full_name,
          role: 'member',
          phone: phone || null,
        },
        family: {
          family_id: familyId,
          family_name,
          subscription_tier: 'free',
          subscription_status: 'active',
        },
        token,
      });
    } catch (error) {
      console.error('Registration error (functions):', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },
);

// Login
app.post(
  '/api/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;

      const { email, password } = req.body;

      // Find user by email
      const userSnap = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (userSnap.empty) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const userDoc = userSnap.docs[0];
      const user = userDoc.data();

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: userDoc.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      res.json({
        message: 'Login successful',
        user: {
          user_id: userDoc.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role || 'member',
        },
        token,
      });
    } catch (error) {
      console.error('Login error (functions):', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },
);

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role || 'member',
        phone: user.phone || null,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Families: get families for current user
app.get('/api/families/my-families', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Find family memberships
    const membershipSnap = await db
      .collection('familyMembers')
      .where('user_id', '==', userId)
      .get();

    if (membershipSnap.empty) {
      return res.json({ families: [] });
    }

    const families = [];

    for (const membershipDoc of membershipSnap.docs) {
      const membership = membershipDoc.data();
      const familyRef = db.collection('families').doc(membership.family_id);
      const familySnap = await familyRef.get();
      if (!familySnap.exists) continue;
      const familyData = familySnap.data();
      families.push({
        family_id: familySnap.id,
        family_name: familyData.family_name,
        clan_name: familyData.clan_name || null,
        village_origin: familyData.village_origin || null,
        subscription_tier: familyData.subscription_tier || 'free',
        subscription_status: familyData.subscription_status || 'active',
        user_role: membership.role || 'member',
      });
    }

    res.json({ families });
  } catch (error) {
    console.error('Error fetching families (functions):', error);
    res.status(500).json({ error: 'Failed to fetch families' });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// Email sending function - triggers when a personInvitation is created
const nodemailer = require('nodemailer');

// Configure email transporter (using Gmail SMTP - FREE)
// To use Gmail SMTP, you need to:
// 1. Enable 2-Factor Authentication on your Gmail account
// 2. Generate an App Password: https://myaccount.google.com/apppasswords
// 3. Set environment variables or Firebase Functions secrets:
//    firebase functions:secrets:set GMAIL_USER
//    firebase functions:secrets:set GMAIL_APP_PASSWORD

const createTransporter = () => {
  // For 1st Gen functions, we need to use functions.config() to access secrets
  // Secrets set via firebase functions:config:set are available via functions.config()
  let gmailUser, gmailPassword;
  
  try {
    // Access config safely - may not be available during deployment
    if (typeof functions.config === 'function') {
      const config = functions.config();
      gmailUser = config.gmail?.user || process.env.GMAIL_USER;
      gmailPassword = config.gmail?.password || process.env.GMAIL_APP_PASSWORD;
    } else {
      // Fallback to environment variables if config is not available
      gmailUser = process.env.GMAIL_USER;
      gmailPassword = process.env.GMAIL_APP_PASSWORD;
    }
  } catch (e) {
    // Fallback to environment variables
    gmailUser = process.env.GMAIL_USER;
    gmailPassword = process.env.GMAIL_APP_PASSWORD;
  }

  // Debug logging
  console.log('🔍 Checking Gmail credentials...');
  console.log('GMAIL_USER exists:', !!gmailUser);
  console.log('GMAIL_APP_PASSWORD exists:', !!gmailPassword);

  if (!gmailUser || !gmailPassword) {
    console.error('❌ Gmail credentials not configured. Email sending will fail.');
    console.error('For 1st Gen functions, set up using:');
    console.error('  firebase functions:config:set gmail.user="your-email@gmail.com"');
    console.error('  firebase functions:config:set gmail.password="your-app-password"');
    console.error('  firebase deploy --only functions:sendInvitationEmail');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });
};

// Secrets will be accessed via functions.config() for 1st Gen functions

// Function to send invitation email (1st Gen - uses legacy config)
exports.sendInvitationEmail = functions.firestore.document('personInvitations/{invitationId}').onCreate(async (snap, context) => {
    const invitation = snap.data();
    const invitationId = context.params.invitationId;

    console.log(`📧 Sending invitation email for invitation ${invitationId} to ${invitation.email}`);

    // Skip if email was already sent or invitation is not pending
    if (invitation.email_sent || invitation.status !== 'pending') {
      console.log('⏭️ Skipping email - already sent or not pending');
      return null;
    }

    try {
      const transporter = createTransporter();
      if (!transporter) {
        console.error('❌ Email transporter not configured');
        // Mark as failed but don't throw error
        await snap.ref.update({
          email_sent: false,
          email_error: 'Email service not configured. Please set up Gmail credentials.',
        });
        return null;
      }

      // Get person details
      const personRef = db.collection('persons').doc(invitation.person_id);
      const personSnap = await personRef.get();
      const person = personSnap.exists ? personSnap.data() : null;

      // Get family details
      const familyRef = db.collection('families').doc(invitation.family_id);
      const familySnap = await familyRef.get();
      const family = familySnap.exists ? familySnap.data() : null;

      // Build invitation link
      const frontendUrl = process.env.FRONTEND_URL || 'https://familytree-2025.web.app';
      const invitationLink = `${frontendUrl}/claim/${invitation.token}`;

      // Get sender email (same method as transporter)
      let senderEmail;
      try {
        if (typeof functions.config === 'function') {
          const config = functions.config();
          senderEmail = config.gmail?.user || process.env.GMAIL_USER;
        } else {
          senderEmail = process.env.GMAIL_USER;
        }
      } catch (e) {
        senderEmail = process.env.GMAIL_USER;
      }

      // Email content
      const mailOptions = {
        from: `"African Family Tree" <${senderEmail}>`,
        to: invitation.email,
        subject: `You've been invited to claim your family profile${person ? ` - ${person.full_name || invitation.person_name}` : ''}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🌳 African Family Tree</h1>
                <p>You've been invited to claim your profile!</p>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>You have been invited to claim and manage your family profile on the African Family Tree platform.</p>
                ${person ? `<p><strong>Profile Name:</strong> ${person.full_name || invitation.person_name}</p>` : ''}
                ${family ? `<p><strong>Family:</strong> ${family.family_name}</p>` : ''}
                <p>Click the button below to accept this invitation and claim your profile:</p>
                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Claim My Profile</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #1976d2;">${invitationLink}</p>
                <p><strong>This invitation expires in 7 days.</strong></p>
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} African Family Tree. All rights reserved.</p>
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          You've been invited to claim your family profile on African Family Tree.
          
          ${person ? `Profile Name: ${person.full_name || invitation.person_name}` : ''}
          ${family ? `Family: ${family.family_name}` : ''}
          
          Click this link to claim your profile:
          ${invitationLink}
          
          This invitation expires in 7 days.
          
          If you didn't expect this invitation, you can safely ignore this email.
        `,
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully: ${info.messageId}`);

      // Update invitation document
      await snap.ref.update({
        email_sent: true,
        email_sent_at: admin.firestore.FieldValue.serverTimestamp(),
        email_message_id: info.messageId,
      });

      return null;
    } catch (error) {
      console.error('❌ Error sending invitation email:', error);
      
      // Update invitation with error
      await snap.ref.update({
        email_sent: false,
        email_error: error.message || 'Failed to send email',
        email_error_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Don't throw error - we don't want to retry automatically
      return null;
    }
  });


