import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { settings } from './config.js';

// The key can be supplied as a variable (FIREBASE_SERVICE_ACCOUNT_BASE64 is the safest on a host; FIREBASE_SERVICE_ACCOUNT_JSON also works)
// or, locally, as the file named by GOOGLE_APPLICATION_CREDENTIALS (default backend/firebase-admin.json).
function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) return JSON.parse(inline.replace(/^\uFEFF/, ''));
  const credentialPath = resolve(fileURLToPath(new URL('../', import.meta.url)), process.env.GOOGLE_APPLICATION_CREDENTIALS || 'firebase-admin.json');
  return JSON.parse(readFileSync(credentialPath, 'utf8').replace(/^\uFEFF/, ''));
}
const serviceAccount = loadServiceAccount();
if (serviceAccount.project_id !== settings.projectId) throw new Error('Firebase project does not match backend configuration.');
const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: settings.projectId });
export const identity = getAuth(app);
