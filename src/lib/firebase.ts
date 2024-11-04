import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyB5VLN7KUd3CpJsc2ubKikvRJkd_hat4u8",
  authDomain: "warehouseapp-b85de.firebaseapp.com",
  projectId: "warehouseapp-b85de",
  storageBucket: "warehouseapp-b85de.firebasestorage.app",
  messagingSenderId: "535089462672",
  appId: "1:535089462672:web:edb68bd9ee8609a51dc715",
  measurementId: "G-315TGMCNN3"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings optimized for offline support
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  experimentalForceLongPolling: true, // Better compatibility across different browsers
});

// Enable offline persistence with enhanced error handling
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db, {
    synchronizeTabs: true // Enable multi-tab support
  }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firebase persistence not supported in this browser');
    }
  });
}

// Initialize Analytics only in browser environment
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { db, analytics };
export default app;