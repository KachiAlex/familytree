import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import path from 'path';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  'C:\\Users\\opdli\\Downloads\\familytree-2025-firebase-adminsdk-fbsvc-1c84fa9252.json';

const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function listCollections() {
  const collections = await db.listCollections();
  console.log('Collections:');
  for (const col of collections) {
    const snapshot = await col.get();
    console.log(`  ${col.id}: ${snapshot.size} docs`);
  }
}

listCollections().catch(err => {
  console.error(err);
  process.exit(1);
});
