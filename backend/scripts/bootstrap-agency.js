import { db } from '../src/database.js';
import { identity } from '../src/firebase.js';
import { userInput } from '../src/validation.js';

try {
  const input = userInput.parse({
    name: process.env.BOOTSTRAP_AGENCY_NAME,
    email: process.env.BOOTSTRAP_AGENCY_EMAIL,
    role: 'AGENCY',
  });
  let firebaseUser;
  try { firebaseUser = await identity.getUserByEmail(input.email); }
  catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    firebaseUser = await identity.createUser({ email: input.email, displayName: input.name });
  }
  if (firebaseUser.disabled) throw new Error('The configured Firebase account is disabled.');
  const existing = await db.user.findFirst({
    where: { OR: [{ email: input.email }, { firebaseUid: firebaseUser.uid }] },
  });
  if (existing && (existing.firebaseUid !== firebaseUser.uid || existing.role !== 'AGENCY' || existing.status !== 'ACTIVE')) {
    throw new Error('Existing application account conflicts with bootstrap configuration.');
  }
  if (!existing) {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...input, firebaseUid: firebaseUser.uid } });
      await tx.activityEvent.create({
        data: { actorId: user.id, eventType: 'AGENCY_BOOTSTRAPPED', details: { email: user.email, source: 'local_setup' } },
      });
    });
  }
  console.log(`Agency account ready: ${input.name} (${input.email}).`);
  console.log('Sign in with your configured email/password or Google account.');
} catch (error) {
  console.error(`Agency provisioning failed (${error.code || error.name}). No credentials were printed.`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
