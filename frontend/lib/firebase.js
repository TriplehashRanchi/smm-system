import { initializeApp, getApps } from '@firebase/app';
import { getAuth } from '@firebase/auth';

export function getFirebaseAuth() {
  const app = getApps()[0] || initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return getAuth(app);
}

export function authMessage(error, fallback = 'Unable to sign in right now. Please try again.') {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-not-found': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-disabled': 'This account has been disabled. Contact your agency.',
    'auth/user-token-expired': 'Your session has expired. Please sign in again.',
    'auth/invalid-user-token': 'Your session has expired. Please sign in again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/popup-closed-by-user': 'Sign-in was closed. You can try again.',
    'auth/popup-blocked': 'Allow pop-ups for this website to sign in with Google.',
    'auth/operation-not-allowed': 'This sign-in method is not available yet. Contact your agency.',
    'auth/unauthorized-domain': 'Sign-in is not enabled for this website address. Contact your agency.',
    'auth/network-request-failed': 'Could not connect. Check your internet connection.',
    'auth/account-exists-with-different-credential': 'Use your existing sign-in method for this email.',
  };
  return messages[error.code] || fallback;
}
