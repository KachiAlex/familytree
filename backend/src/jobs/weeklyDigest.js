const { pool } = require('../db/connection');
const { sendMail, isMailConfigured } = require('../utils/mailer');

// Weekly family digest: every Sunday, each family member gets an email
// summarizing the last 7 days of contributions — people added, stories,
// documents, edits — grouped per contributor. The digest_log table dedupes
// per recipient/family/ISO week so hourly checks are safe.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DIGEST_DAY = 0; // Sunday

const isoWeek = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const runDigestCheck = async () => {
  if (!isMailConfigured()) return;
  if (new Date().getDay() !== DIGEST_DAY) return;

  const week = isoWeek(new Date());
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Families with any activity in the last 7 days
  const { rows: families } = await pool.query(
    `SELECT DISTINCT family_id FROM edit_history WHERE created_at > NOW() - INTERVAL '7 days'
     UNION
     SELECT DISTINCT family_id FROM persons WHERE created_at > NOW() - INTERVAL '7 days'
     UNION
     SELECT DISTINCT family_id FROM stories WHERE created_at > NOW() - INTERVAL '7 days'
     UNION
     SELECT DISTINCT family_id FROM documents WHERE created_at > NOW() - INTERVAL '7 days'`
  );

  for (const { family_id } of families) {
    try {
      const { rows: [fam] } = await pool.query('SELECT family_name FROM families WHERE family_id = $1', [family_id]);

      const { rows: contributions } = await pool.query(
        `SELECT u.full_name AS contributor,
                COUNT(*) FILTER (WHERE src = 'person') AS persons_added,
                COUNT(*) FILTER (WHERE src = 'story') AS stories_added,
                COUNT(*) FILTER (WHERE src = 'document') AS documents_added,
                COUNT(*) FILTER (WHERE src = 'edit') AS edits_made
         FROM (
           SELECT created_by_user_id AS uid, 'person' AS src FROM persons WHERE family_id = $1 AND created_at > NOW() - INTERVAL '7 days'
           UNION ALL SELECT created_by_user_id, 'story' FROM stories WHERE family_id = $1 AND created_at > NOW() - INTERVAL '7 days'
           UNION ALL SELECT uploaded_by_user_id, 'document' FROM documents WHERE family_id = $1 AND created_at > NOW() - INTERVAL '7 days'
           UNION ALL SELECT changed_by_user_id, 'edit' FROM edit_history WHERE family_id = $1 AND created_at > NOW() - INTERVAL '7 days'
         ) a
         JOIN users u ON u.user_id = a.uid
         GROUP BY u.full_name
         ORDER BY (COUNT(*)) DESC`,
        [family_id]
      );
      if (contributions.length === 0) continue;

      const { rows: members } = await pool.query(
        `SELECT u.user_id, u.email, u.full_name
         FROM family_members fm JOIN users u ON u.user_id = fm.user_id
         WHERE fm.family_id = $1 AND u.email IS NOT NULL`,
        [family_id]
      );

      const totals = contributions.reduce((acc, c) => ({
        persons: acc.persons + c.persons_added,
        stories: acc.stories + c.stories_added,
        documents: acc.documents + c.documents_added,
        edits: acc.edits + c.edits_made,
      }), { persons: 0, stories: 0, documents: 0, edits: 0 });

      const rowsHtml = contributions.map((c) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${c.contributor}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${c.persons_added}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${c.stories_added}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${c.documents_added}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${c.edits_made}</td>
        </tr>`).join('');

      for (const member of members) {
        try {
          const logged = await pool.query(
            `INSERT INTO digest_log (user_id, family_id, iso_week) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING RETURNING user_id`,
            [member.user_id, family_id, week]
          );
          if (logged.rows.length === 0) continue;

          const link = `${frontendUrl}/family/${family_id}/tree`;
          await sendMail({
            to: member.email,
            subject: `This week in ${fam.family_name}: ${totals.persons + totals.stories + totals.documents} new additions`,
            text: `Weekly digest for ${fam.family_name}: ${totals.persons} people, ${totals.stories} stories, ${totals.documents} documents, ${totals.edits} edits. View the tree: ${link}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #22345E; color: #fff; padding: 24px; text-align: center;">
                  <h1 style="margin: 0;">African Family Tree</h1>
                  <p style="margin: 8px 0 0;">Weekly digest — ${fam.family_name}</p>
                </div>
                <div style="background: #f9f9f9; padding: 24px;">
                  <p>Hi ${member.full_name || 'there'},</p>
                  <p>Here's what the family added this week:</p>
                  <table style="width:100%;border-collapse:collapse;background:#fff;">
                    <tr style="background:#22345E;color:#fff;">
                      <th style="padding:8px 12px;text-align:left;">Contributor</th>
                      <th style="padding:8px 12px;">People</th>
                      <th style="padding:8px 12px;">Stories</th>
                      <th style="padding:8px 12px;">Docs</th>
                      <th style="padding:8px 12px;">Edits</th>
                    </tr>
                    ${rowsHtml}
                  </table>
                  <p style="text-align: center; margin: 24px 0;">
                    <a href="${link}" style="background: #22345E; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">View the family tree</a>
                  </p>
                </div>
              </div>`,
          });
        } catch (err) {
          console.error(`Digest send failed (family ${family_id}, user ${member.user_id}):`, err.message);
        }
      }
    } catch (err) {
      console.error(`Digest failed for family ${family_id}:`, err.message);
    }
  }
};

const startDigestJob = () => {
  setTimeout(() => runDigestCheck().catch((e) => console.error('Digest job error:', e.message)), 90 * 1000);
  setInterval(() => runDigestCheck().catch((e) => console.error('Digest job error:', e.message)), CHECK_INTERVAL_MS);
  console.log('Weekly digest job scheduled');
};

module.exports = { startDigestJob, runDigestCheck };
