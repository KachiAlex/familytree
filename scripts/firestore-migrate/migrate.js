import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import pkg from 'pg';
const { Client } = pkg;

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  '/opt/familytree/backend/scripts/firebase-service-account.json';

const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const PLACEHOLDER_PASSWORD_HASH = '$2a$10$rHna5ujAjMo8sx/TUE2GDuEExE4l8CNWN0nPhfDM8Mee0UOpau2xG';

function toTimestamp(obj) {
  if (!obj || typeof obj._seconds !== 'number') return null;
  return new Date(obj._seconds * 1000 + obj._nanoseconds / 1_000_000).toISOString();
}

function toDate(obj) {
  if (!obj || typeof obj._seconds !== 'number') return null;
  return new Date(obj._seconds * 1000 + obj._nanoseconds / 1_000_000).toISOString().split('T')[0];
}

async function fetchCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

async function migrate() {
  try {
    await client.connect();
    await client.query('BEGIN');

    const users = await fetchCollection('users');
    const families = await fetchCollection('families');
    const familyMembers = await fetchCollection('familyMembers');
    const persons = await fetchCollection('persons');
    const relationships = await fetchCollection('relationships');
    const spouseRelationships = await fetchCollection('spouseRelationships');
    const userRelationships = await fetchCollection('userRelationships');
    const personInvitations = await fetchCollection('personInvitations');

    const userMap = new Map();
    for (const u of users) {
      const d = u.data;
      const res = await client.query(
        `INSERT INTO users (email, phone, password_hash, full_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING user_id`,
        [d.email, d.phone || null, PLACEHOLDER_PASSWORD_HASH, d.full_name, d.role || 'member', toTimestamp(d.created_at), toTimestamp(d.updated_at)]
      );
      userMap.set(u.id, res.rows[0].user_id);
    }
    console.log(`Migrated ${users.length} users`);

    const familyMap = new Map();
    for (const f of families) {
      const d = f.data;
      const createdBy = userMap.get(d.created_by_user_id) || null;
      const res = await client.query(
        `INSERT INTO families (family_name, clan_name, village_origin, subscription_tier, subscription_status,
         max_persons, max_documents, max_storage_mb, max_members, created_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING family_id`,
        [d.family_name, d.clan_name || null, d.village_origin || null, d.subscription_tier || 'free', d.subscription_status || 'active',
         d.max_persons || 50, d.max_documents || 100, d.max_storage_mb || 500, d.max_members || 10,
         createdBy, toTimestamp(d.created_at), toTimestamp(d.updated_at)]
      );
      familyMap.set(f.id, res.rows[0].family_id);
    }
    console.log(`Migrated ${families.length} families`);

    for (const m of familyMembers) {
      const d = m.data;
      const familyId = familyMap.get(d.family_id);
      const userId = userMap.get(d.user_id);
      const invitedBy = d.invited_by ? userMap.get(d.invited_by) : null;
      if (!familyId || !userId) continue;
      await client.query(
        `INSERT INTO family_members (family_id, user_id, role, invited_by, joined_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (family_id, user_id) DO NOTHING`,
        [familyId, userId, d.role || 'member', invitedBy, toTimestamp(d.joined_at)]
      );
    }
    console.log(`Migrated ${familyMembers.length} family members`);

    const personMap = new Map();
    const personOwnerMap = new Map();
    for (const ur of userRelationships) {
      const d = ur.data;
      const userId = userMap.get(d.user_id);
      if (!userId) continue;
      if (d.relationship_to_self === 'self') {
        personOwnerMap.set(d.person_id, userId);
      }
    }

    for (const p of persons) {
      const d = p.data;
      const familyId = familyMap.get(d.family_id);
      if (!familyId) continue;
      const ownerId = personOwnerMap.get(p.id) || null;
      const res = await client.query(
        `INSERT INTO persons (family_id, full_name, gender, date_of_birth, place_of_birth,
         occupation, biography, clan_name, village_origin, alive_status, verified_by_elder,
         owner_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING person_id`,
        [familyId, d.full_name, d.gender || null, toDate(d.date_of_birth), d.place_of_birth || null,
         d.occupation || null, d.biography || null, d.clan_name || null, d.village_origin || null,
         d.alive_status !== false, d.verified_by_elder === true, ownerId,
         toTimestamp(d.created_at), toTimestamp(d.created_at)]
      );
      personMap.set(p.id, res.rows[0].person_id);
    }
    console.log(`Migrated ${persons.length} persons`);

    for (const r of relationships) {
      const d = r.data;
      const person1Id = personMap.get(d.parent_id);
      const person2Id = personMap.get(d.child_id);
      const familyId = familyMap.get(d.family_id);
      if (!person1Id || !person2Id || person1Id === person2Id) continue;
      await client.query(
        `INSERT INTO relationships (person1_id, person2_id, relationship_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (person1_id, person2_id, relationship_type) DO NOTHING`,
        [person1Id, person2Id, 'parent', toTimestamp(d.created_at), toTimestamp(d.created_at)]
      );
    }
    console.log(`Migrated ${relationships.length} parent relationships`);

    for (const r of spouseRelationships) {
      const d = r.data;
      const person1Id = personMap.get(d.spouse1_id);
      const person2Id = personMap.get(d.spouse2_id);
      if (!person1Id || !person2Id || person1Id === person2Id) continue;
      await client.query(
        `INSERT INTO relationships (person1_id, person2_id, relationship_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (person1_id, person2_id, relationship_type) DO NOTHING`,
        [person1Id, person2Id, 'spouse', toTimestamp(d.created_at), toTimestamp(d.created_at)]
      );
    }
    console.log(`Migrated ${spouseRelationships.length} spouse relationships`);

    for (const inv of personInvitations) {
      const d = inv.data;
      const familyId = familyMap.get(d.family_id);
      const personId = personMap.get(d.person_id);
      const invitedBy = d.invited_by_user_id ? userMap.get(d.invited_by_user_id) : null;
      if (!familyId || !personId) continue;
      await client.query(
        `INSERT INTO invitations (family_id, person_id, email, invited_by_user_id, token, role, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (token) DO NOTHING`,
        [familyId, personId, d.email, invitedBy, d.token, 'member', d.status || 'pending', toTimestamp(d.expires_at), toTimestamp(d.created_at)]
      );
    }
    console.log(`Migrated ${personInvitations.length} invitations`);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
