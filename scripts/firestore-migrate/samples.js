import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  'C:\\Users\\opdli\\Downloads\\familytree-2025-firebase-adminsdk-fbsvc-1c84fa9252.json';

const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const collections = [
  'users',
  'families',
  'familyMembers',
  'persons',
  'relationships',
  'spouseRelationships',
  'userRelationships',
  'personInvitations'
];

async function showSamples() {
  for (const col of collections) {
    const snap = await db.collection(col).limit(2).get();
    console.log(`\n=== ${col} ===`);
    for (const doc of snap.docs) {
      console.log(`doc: ${doc.id}`);
      console.log(JSON.stringify(doc.data(), null, 2));
    }
  }
}

showSamples().catch(err => {
  console.error(err);
  process.exit(1);
});
