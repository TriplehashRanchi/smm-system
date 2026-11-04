import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export const settings = {
  port: Number(process.env.PORT || 4000),
  // Hosted platforms must reach the server from outside, so production listens on every interface.
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  // One or more website addresses allowed to call the API, separated by commas.
  origins: (process.env.FRONTEND_ORIGIN || 'http://localhost:3000').split(',').map((value) => value.trim().replace(/\/+$/, '')).filter(Boolean),
  // How many proxies sit in front of the server (Railway, Render and similar: 1).
  trustProxy: Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : 0)),
  projectId: process.env.FIREBASE_PROJECT_ID,
};
