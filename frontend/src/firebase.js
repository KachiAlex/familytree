import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// IMPORTANT: Fill these from your Firebase console or via .env variables.
// You can either:
//  1) Put the values directly here, OR
//  2) Create a .env file with REACT_APP_FIREBASE_* variables and reference process.env.*

const firebaseConfig = {
  apiKey: "AIzaSyDiz2DwXU-RIpDefHgbDsom3yBT33iOCp0",
  authDomain: "familytree-2025.firebaseapp.com",
  projectId: "familytree-2025",
  storageBucket: "familytree-2025.firebasestorage.app",
  messagingSenderId: "1046310783270",
  appId: "1:1046310783270:web:96c545eb9ca8d373ca99e7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;


