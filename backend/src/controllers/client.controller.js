import { clientScope, HttpError } from '../access.js';
import { clientInput, clientUpdate, listInput } from '../validation.js';
import { findClient } from '../services/client.service.js';
import { recordActivity } from '../services/audit.service.js';
import { safeClientSelect } from '../utils/selectors.js';
import { deleteAccountData, exclusiveClientUsers } from '../services/delete.service.js';

export function createClientController({ db, identity }) {
  async function listClients(req, res) {
    const { page, pageSize, search, status } = listInput.parse(req.query);
    const where = {
      ...clientScope(req.user),
      ...(status !== 'ALL' ? { status } : {}),
      ...(search ? { name: { contains: search } } : {}),
    };
    const [data, total] = await Promise.all([
      db.client.findMany({
        where, select: safeClientSelect(req.user.role), orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      db.client.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }

  async function createClient(req, res) {
    const { login, ...input } = clientInput.parse(req.body);
    let firebaseUser;
    if (login) {
      if (await db.user.findUnique({ where: { email: login.email } })) throw new HttpError(409, 'This email already has a login.');
      try { firebaseUser = await identity.createUser({ email: login.email, password: login.password, displayName: input.name.slice(0, 120) }); }
      catch (error) {
        if (error.code === 'auth/email-already-exists') throw new HttpError(409, 'This email already has a sign-in account.');
        if (['auth/invalid-password', 'auth/password-does-not-meet-requirements'].includes(error.code)) throw new HttpError(400, 'Choose a password that meets the sign-in requirements.');
        throw new HttpError(503, 'Unable to create the Client login. Try again shortly.');
      }
    }
    let data;
    try { data = await db.$transaction(async (tx) => {
      const client = await tx.client.create({ data: input });
      if (firebaseUser) {
        const user = await tx.user.create({ data: { firebaseUid: firebaseUser.uid, email: login.email, name: input.name.slice(0, 120), role: 'CLIENT' } });
        await tx.clientUserAccess.create({ data: { userId: user.id, clientId: client.id } });
        await recordActivity(tx, req.user, 'CLIENT_LOGIN_CREATED', { userId: user.id, email: user.email }, client.id);
      }
      await recordActivity(tx, req.user, 'CLIENT_CREATED', {
        name: client.name, timezone: client.timezone,
      }, client.id);
      return tx.client.findUnique({ where: { id: client.id }, select: safeClientSelect(req.user.role) });
    }); } catch (error) {
      if (firebaseUser) { try { await identity.deleteUser(firebaseUser.uid); } catch { console.error(JSON.stringify({ errorType: 'ClientLoginCleanupFailed', firebaseUid: firebaseUser.uid })); } }
      throw error;
    }
    res.status(201).json({ data });
  }

  async function getClient(req, res) {
    res.json({ data: await findClient(db, req.user, req.params.id) });
  }

  async function updateClient(req, res) {
    const input = clientUpdate.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const before = await findClient(tx, req.user, req.params.id);
      const client = await tx.client.update({
        where: { id: before.id }, data: input, select: safeClientSelect(req.user.role),
      });
      await recordActivity(tx, req.user, 'CLIENT_UPDATED', {
        before: {
          name: before.name, timezone: before.timezone,
          status: before.status, internalNotes: before.internalNotes,
        },
        after: input,
      }, client.id);
      return client;
    });
    res.json({ data });
  }

  async function clientImpact(req, res) {
    const client = await findClient(db, req.user, req.params.id), clientId = client.id;
    const [accounts, posts, ideas, suggestions, notes, logins] = await Promise.all([
      db.socialAccount.count({ where: { clientId } }), db.contentItem.count({ where: { socialAccount: { clientId } } }), db.contentIdea.count({ where: { clientId } }),
      db.contentSuggestion.count({ where: { clientId } }), db.calendarNote.count({ where: { clientId } }), exclusiveClientUsers(db, clientId).then(users => users.length),
    ]);
    res.json({ data: { accounts, posts, ideas, suggestions, notes, logins } });
  }

  // Permanently removes a client and everything under it, in one transaction. Its activity history goes with it;
  // one CLIENT_DELETED entry (with the name and counts) is kept so the agency still has a record.
  async function deleteClient(req, res) {
    const result = await db.$transaction(async (tx) => {
      const client = await findClient(tx, req.user, req.params.id), clientId = client.id;
      const accountIds = (await tx.socialAccount.findMany({ where: { clientId }, select: { id: true } })).map(account => account.id);
      const removed = await deleteAccountData(tx, accountIds);
      const ideas = (await tx.contentIdea.deleteMany({ where: { clientId } })).count;
      const suggestions = (await tx.contentSuggestion.deleteMany({ where: { clientId } })).count;
      const notes = (await tx.calendarNote.deleteMany({ where: { clientId } })).count;
      const logins = await exclusiveClientUsers(tx, clientId), loginIds = logins.map(user => user.id);
      await tx.clientUserAccess.deleteMany({ where: { clientId } });
      await tx.activityEvent.deleteMany({ where: { OR: [{ clientId }, ...(loginIds.length ? [{ actorId: { in: loginIds } }] : [])] } });
      if (loginIds.length) await tx.user.deleteMany({ where: { id: { in: loginIds } } });
      await tx.client.delete({ where: { id: clientId } });
      const summary = { name: client.name, accounts: accountIds.length, posts: removed.posts, ideas, suggestions, notes, logins: loginIds.length };
      await recordActivity(tx, req.user, 'CLIENT_DELETED', summary, null);
      return { summary, firebaseUids: logins.map(user => user.firebaseUid) };
    }, { isolationLevel: 'Serializable', timeout: 120000 });
    // The database is already clean. Remove the sign-in accounts too; if that fails they are harmless (no access) but are logged.
    let signInsRemoved = 0;
    for (const uid of result.firebaseUids) {
      try { await identity.deleteUser(uid); signInsRemoved++; } catch { console.error(JSON.stringify({ errorType: 'ClientLoginCleanupFailed', firebaseUid: uid })); }
    }
    res.json({ data: { ...result.summary, signInsRemoved } });
  }

  return { listClients, createClient, getClient, updateClient, clientImpact, deleteClient };
}
