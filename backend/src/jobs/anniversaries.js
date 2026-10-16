const { pool } = require('../db/connection');
const { sendMail, isMailConfigured } = require('../utils/mailer');

// Daily remembrance emails: birthdays (living + "would have been") and
// death anniversaries, sent to every member of the family. The
// anniversary_log table dedupes per person/member/day, so the check can
// run hourly — restarts and multi-send are safe.
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const anniversaryCopy = (person, kind) => {
  const today = new Date();
  const name = person.full_name;
  const family = person.family_name ? `the ${person.family_name} family` : 'your family';
  if (kind === 'birthday') {
    const age = today.getFullYear() - new Date(person.date_of_birth).getFullYear();
    return {
      subject: `Today is ${name}'s ${ordinal(age)} birthday`,
      heading: 'Birthday today',
      body: `Today is <strong>${name}</strong>'s ${ordinal(age)} birthday — a good day to reach out and celebrate with ${family}.`,
    };
  }
  if (kind === 'birthday_memorial') {
    const age = today.getFullYear() - new Date(person.date_of_birth).getFullYear();
    return {
      subject: `Today would have been ${name}'s ${ordinal(age)} birthday`,
      heading: 'In remembrance',
      body: `Today would have been <strong>${name}</strong>'s ${ordinal(age)} birthday. A moment to remember and share their story with ${family}.`,
    };
  }
  const years = today.getFullYear() - new Date(person.date_of_death).getFullYear();
  return {
    subject: `${years} ${years === 1 ? 'year' : 'years'} since ${name} passed away`,
    heading: 'In loving memory',
    body: `It has been ${years} ${years === 1 ? 'year' : 'years'} since <strong>${name}</strong> passed away. May their memory continue to be a blessing to ${family}.`,
  };
};

const runAnniversaryCheck = async () => {
  if (!isMailConfigured()) return;

  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { rows: persons } = await pool.query(
    `SELECT p.person_id, p.full_name, p.family_id, p.gender, p.owner_user_id,
            p.date_of_birth, p.date_of_death, p.alive_status, f.family_name
     FROM persons p
     JOIN families f ON f.family_id = p.family_id
     WHERE (EXTRACT(MONTH FROM p.date_of_birth) = $1 AND EXTRACT(DAY FROM p.date_of_birth) = $2)
        OR (EXTRACT(MONTH FROM p.date_of_death) = $1 AND EXTRACT(DAY FROM p.date_of_death) = $2)`,
    [month, day]
  );

  if (persons.length === 0) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  for (const person of persons) {
    try {
      const kinds = [];
      if (person.date_of_birth) {
        kinds.push(person.alive_status === false ? 'birthday_memorial' : 'birthday');
      }
      // Skip memorials on the day of death itself — that's not an anniversary yet
      if (person.date_of_death &&
          today.getFullYear() - new Date(person.date_of_death).getFullYear() >= 1) {
        kinds.push('memorial');
      }
      if (kinds.length === 0) continue;

      const { rows: members } = await pool.query(
        `SELECT u.user_id, u.email, u.full_name
         FROM family_members fm
         JOIN users u ON u.user_id = fm.user_id
         WHERE fm.family_id = $1 AND u.email IS NOT NULL`,
        [person.family_id]
      );

      for (const kind of kinds) {
        const copy = anniversaryCopy(person, kind);
        const link = `${frontendUrl}/person/${person.person_id}`;

        for (const member of members) {
          try {
            // Dedupe: only the first inserter for (person, member, kind, day) sends
            const logged = await pool.query(
              `INSERT INTO anniversary_log (person_id, user_id, kind, sent_on)
               VALUES ($1, $2, $3, CURRENT_DATE)
               ON CONFLICT DO NOTHING RETURNING person_id`,
              [person.person_id, member.user_id, kind]
            );
            if (logged.rows.length === 0) continue;

            await sendMail({
              to: member.email,
              subject: copy.subject,
              text: `${copy.body.replace(/<\/?strong>/g, '')}\n\nView their profile: ${link}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #22345E; color: #fff; padding: 24px; text-align: center;">
                    <h1 style="margin: 0;">African Family Tree</h1>
                    <p style="margin: 8px 0 0;">${copy.heading}</p>
                  </div>
                  <div style="background: #f9f9f9; padding: 24px;">
                    <p>Hi ${member.full_name || 'there'},</p>
                    <p>${copy.body}</p>
                    <p style="text-align: center; margin: 24px 0;">
                      <a href="${link}" style="background: #22345E; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 4px;">View ${person.full_name}</a>
                    </p>
                  </div>
                </div>`,
            });
          } catch (err) {
            console.error(`Anniversary send failed (person ${person.person_id}, kind ${kind}):`, err.message);
          }
        }
      }
    } catch (err) {
      console.error(`Anniversary check failed for person ${person.person_id}:`, err.message);
    }
  }
};

const startAnniversaryJob = () => {
  // First run shortly after boot, then hourly — the log dedupes by date.
  setTimeout(() => runAnniversaryCheck().catch((e) => console.error('Anniversary job error:', e.message)), 60 * 1000);
  setInterval(() => runAnniversaryCheck().catch((e) => console.error('Anniversary job error:', e.message)), CHECK_INTERVAL_MS);
  console.log('Anniversary remembrance job scheduled');
};

module.exports = { startAnniversaryJob, runAnniversaryCheck };
