const { pool } = require('../db/connection');
const { sendMail } = require('./mailer');

/**
 * Notify the owner of a claimed profile that someone proposed a change.
 * Looks up the owning account's email; silently skips if none or mail
 * is unconfigured. Never throws — notification failures must not block
 * the change submission itself.
 */
const notifyProfileOwnerOfPendingChange = async ({ ownerUserId, personId, personName, changerName, summary }) => {
  try {
    const ownerResult = await pool.query(
      'SELECT email, full_name FROM users WHERE user_id = $1',
      [ownerUserId]
    );
    const owner = ownerResult.rows[0];
    if (!owner || !owner.email) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/person/${personId}`;
    const who = changerName || 'A family member';

    await sendMail({
      to: owner.email,
      subject: `A change to your family profile needs your confirmation`,
      text: `Hi ${owner.full_name || 'there'},\n\n${who} proposed a change to the profile of ${personName} on African Family Tree.\n\n${summary ? `Change: ${summary}\n\n` : ''}Nothing is published until you confirm it. Review and approve or reject the change here:\n${link}\n\n(Once logged in, open the profile and click "Pending".)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1565c0; color: #fff; padding: 24px; text-align: center;">
            <h1 style="margin: 0;">African Family Tree</h1>
            <p style="margin: 8px 0 0;">Profile change awaiting your confirmation</p>
          </div>
          <div style="background: #f9f9f9; padding: 24px;">
            <p>Hi ${owner.full_name || 'there'},</p>
            <p><strong>${who}</strong> proposed a change to the profile of <strong>${personName}</strong>.</p>
            ${summary ? `<p><strong>Change:</strong> ${summary}</p>` : ''}
            <p>Nothing is published until you confirm it. Review the change below.</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="background: #1565c0; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">Review Pending Change</a>
            </p>
            <p style="font-size: 12px; color: #666;">Open the profile and click "Pending" to approve or reject.</p>
          </div>
        </div>`,
    });
  } catch (error) {
    console.error('Failed to send pending-change notification:', error.message);
  }
};

module.exports = { notifyProfileOwnerOfPendingChange };
