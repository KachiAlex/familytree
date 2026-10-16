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

const lookupUser = async (userId) => {
  const r = await pool.query('SELECT email, full_name FROM users WHERE user_id = $1', [userId]);
  return r.rows[0];
};

/**
 * Notify the submitter of a pending change that it was approved or rejected.
 * Fire-and-forget — never throws.
 */
const notifySubmitterOfResolution = async ({ submitterUserId, personId, personName, outcome, resolverName, summary, note }) => {
  try {
    const submitter = await lookupUser(submitterUserId);
    if (!submitter || !submitter.email) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/person/${personId}`;
    const approved = outcome === 'approved';
    const who = resolverName || 'The profile owner';

    await sendMail({
      to: submitter.email,
      subject: `Your proposed change to ${personName} was ${approved ? 'approved' : 'rejected'}`,
      text: `Hi ${submitter.full_name || 'there'},\n\n${who} ${approved ? 'approved' : 'rejected'} your proposed change to ${personName} on African Family Tree.\n\n${summary ? `Change: ${summary}\n` : ''}${note ? `Note: ${note}\n` : ''}\nView the profile: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${approved ? '#2e7d32' : '#c62828'}; color: #fff; padding: 24px; text-align: center;">
            <h1 style="margin: 0;">African Family Tree</h1>
            <p style="margin: 8px 0 0;">Proposed change ${approved ? 'approved' : 'rejected'}</p>
          </div>
          <div style="background: #f9f9f9; padding: 24px;">
            <p>Hi ${submitter.full_name || 'there'},</p>
            <p><strong>${who}</strong> ${approved ? 'approved' : 'rejected'} your proposed change to <strong>${personName}</strong>.</p>
            ${summary ? `<p><strong>Change:</strong> ${summary}</p>` : ''}
            ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
            <p style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="background: #1565c0; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">View Profile</a>
            </p>
          </div>
        </div>`,
    });
  } catch (error) {
    console.error('Failed to send resolution notification:', error.message);
  }
};

/**
 * Notify a claimed-profile owner that the family admin confirmed a change
 * that had been pending past the escalation window. Fire-and-forget.
 */
const notifyOwnerOfAdminOverride = async ({ ownerUserId, personId, personName, adminName, summary }) => {
  try {
    const owner = await lookupUser(ownerUserId);
    if (!owner || !owner.email) return;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/person/${personId}`;
    const who = adminName || 'The family admin';

    await sendMail({
      to: owner.email,
      subject: `A pending change to your profile was confirmed by the family admin`,
      text: `Hi ${owner.full_name || 'there'},\n\nA change proposed for ${personName} had been awaiting your confirmation for over 14 days, so ${who} confirmed it on your behalf.\n\n${summary ? `Change: ${summary}\n\n` : ''}Review it here: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #C25E10; color: #fff; padding: 24px; text-align: center;">
            <h1 style="margin: 0;">African Family Tree</h1>
            <p style="margin: 8px 0 0;">Change confirmed by family admin</p>
          </div>
          <div style="background: #f9f9f9; padding: 24px;">
            <p>Hi ${owner.full_name || 'there'},</p>
            <p>A change proposed for <strong>${personName}</strong> had been awaiting your confirmation for over 14 days, so <strong>${who}</strong> confirmed it on your behalf.</p>
            ${summary ? `<p><strong>Change:</strong> ${summary}</p>` : ''}
            <p style="text-align: center; margin: 24px 0;">
              <a href="${link}" style="background: #1565c0; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">View Profile</a>
            </p>
          </div>
        </div>`,
    });
  } catch (error) {
    console.error('Failed to send admin-override notification:', error.message);
  }
};

module.exports = { notifyProfileOwnerOfPendingChange, notifySubmitterOfResolution, notifyOwnerOfAdminOverride };
