import { db } from './database.js';
import { identity } from './firebase.js';
import { settings } from './config.js';
import { createApp } from './app.js';

const app = createApp({ db, identity, verifyToken: (token) => identity.verifyIdToken(token, true), origin: settings.origins, trustProxy: settings.trustProxy });
const server = app.listen(settings.port, settings.host, () => console.log(`API ready on ${settings.host}:${settings.port}`));
async function shutdown() {
  server.close(async () => { await db.$disconnect(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
