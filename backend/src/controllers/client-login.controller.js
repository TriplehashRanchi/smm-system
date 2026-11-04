import { HttpError, publicUser } from '../access.js';
import { clientLoginInput, clientLoginUpdate } from '../validation.js';
import { findClient } from '../services/client.service.js';
import { recordActivity } from '../services/audit.service.js';

export function createClientLoginController({ db, identity }) {
  async function createLogin(req, res) {
    const input = clientLoginInput.parse(req.body);
    const client = await findClient(db, req.user, req.params.id);
    if (client.status !== 'ACTIVE') throw new HttpError(409, 'Restore this client before creating a login.');
    if (await db.user.findUnique({ where: { email: input.email } })) {
      throw new HttpError(409, 'This email already has a login. Use a different email address.');
    }

    let firebaseUser;
    try {
      firebaseUser = await identity.createUser({
        email: input.email, displayName: input.name, password: input.password, disabled: false,
      });
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        throw new HttpError(409, 'This email already has a sign-in account. Use a different email address.');
      }
      if (['auth/invalid-password', 'auth/password-does-not-meet-requirements'].includes(error.code)) {
        throw new HttpError(400, 'This password does not meet the sign-in requirements. Choose another password.');
      }
      throw new HttpError(503, 'Unable to create the sign-in account. Please try again shortly.');
    }

    let user;
    try {
      user = await db.$transaction(async (tx) => {
        const current = await tx.client.findUnique({ where: { id: client.id }, select: { status: true } });
        if (current?.status !== 'ACTIVE') throw new HttpError(409, 'This client is no longer active. Refresh and try again.');
        const created = await tx.user.create({
          data: { name: input.name, email: input.email, firebaseUid: firebaseUser.uid, role: 'CLIENT' },
        });
        await tx.clientUserAccess.create({ data: { userId: created.id, clientId: client.id } });
        await recordActivity(tx, req.user, 'CLIENT_LOGIN_CREATED', {
          userId: created.id, name: created.name, email: created.email, role: 'CLIENT',
        }, client.id);
        return created;
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      // Roll back only the identity created by this request; never change an existing account.
      try { await identity.deleteUser(firebaseUser.uid); }
      catch { console.error(JSON.stringify({ errorType: 'ClientLoginCleanupFailed', firebaseUid: firebaseUser.uid })); }
      throw error;
    }
    res.status(201).json({ data: publicUser(user) });
  }

  async function updateLogin(req, res) {
    const input = clientLoginUpdate.parse(req.body);
    const user = await db.$transaction(async (tx) => {
      await findClient(tx, req.user, req.params.id);
      const before = await tx.user.findFirst({
        where: { id: req.params.userId, role: 'CLIENT', clientAccess: { some: { clientId: req.params.id } } },
        include: { clientAccess: { select: { clientId: true } } },
      });
      if (!before) throw new HttpError(404, 'Client login not found.');
      if (before.clientAccess.some((access) => access.clientId !== req.params.id)) {
        throw new HttpError(409, 'This login is shared across clients. Give this client a separate login before changing its status.');
      }
      const updated = await tx.user.update({ where: { id: before.id }, data: { status: input.status } });
      if (before.status !== updated.status) {
        await recordActivity(tx, req.user, updated.status === 'ACTIVE' ? 'CLIENT_LOGIN_ENABLED' : 'CLIENT_LOGIN_DISABLED', {
          userId: updated.id, email: updated.email, before: before.status, after: updated.status,
        }, req.params.id);
      }
      return updated;
    }, { isolationLevel: 'Serializable' });
    res.json({ data: publicUser(user) });
  }

  // Everything in the database that points at this login. The activity log ("what this login did") can be removed with
  // it when the Agency confirms. Anything else (recorded approvals, suggestions, footage reports...) is real history
  // and keeps the login from being deleted: disable access instead.
  async function footprint(tx, userId) {
    const [activity, approvals, footageReports, suggestions, revisions, other] = await Promise.all([
      tx.activityEvent.count({ where: { actorId: userId } }),
      tx.productionApproval.count({ where: { recordedById: userId } }),
      tx.mediaHandoff.count({ where: { OR: [{ reportedById: userId }, { verifiedById: userId }] } }),
      tx.contentSuggestion.count({ where: { OR: [{ createdById: userId }, { reviewedById: userId }] } }),
      tx.contentRevision.count({ where: { createdById: userId } }),
      Promise.all([
        tx.contentIdea.count({ where: { createdById: userId } }), tx.calendarNote.count({ where: { createdById: userId } }), tx.approvalRequest.count({ where: { requestedById: userId } }),
        tx.contentItem.count({ where: { OR: [{ createdById: userId }, { ownerId: userId }, { contributorId: userId }, { publishedById: userId }] } }),
      ]).then(counts => counts.reduce((sum, count) => sum + count, 0)),
    ]);
    const blockers = { approvals, footageReports, suggestions, revisions, other };
    return { activity, blockers, blocked: Object.values(blockers).reduce((sum, count) => sum + count, 0) };
  }
  async function findLogin(tx, req) {
    await findClient(tx, req.user, req.params.id);
    const user = await tx.user.findFirst({
      where: { id: req.params.userId, role: 'CLIENT', clientAccess: { some: { clientId: req.params.id } } },
      include: { clientAccess: { select: { clientId: true } } },
    });
    if (!user) throw new HttpError(404, 'Client login not found.');
    return { user, shared: user.clientAccess.some((access) => access.clientId !== req.params.id) };
  }
  async function loginImpact(req, res) {
    const { user, shared } = await findLogin(db, req);
    res.json({ data: { shared, ...(await footprint(db, user.id)) } });
  }

  // Deletes a Client login. A login shared with another Client is only unlinked from this one. A login with real
  // history cannot be removed. One that only has activity-log entries is removed together with them, but only when
  // the request says so (?removeActivity=1), which the page sends after the Agency ticks the confirmation box.
  async function deleteLogin(req, res) {
    const removeActivity = req.query.removeActivity === '1';
    let removed;
    try {
      removed = await db.$transaction(async (tx) => {
        const { user, shared } = await findLogin(tx, req);
        let removedActivity = 0;
        if (!shared) {
          const found = await footprint(tx, user.id);
          if (found.blocked) throw new HttpError(409, 'This login has approvals, suggestions or footage reports on record, so it cannot be deleted. Disable access instead.');
          if (found.activity && !removeActivity) throw new HttpError(409, `This login has ${found.activity} activity entr${found.activity === 1 ? 'y' : 'ies'} on record. Tick the box to delete them together with the login, or disable access instead.`);
          if (found.activity) removedActivity = (await tx.activityEvent.deleteMany({ where: { actorId: user.id } })).count;
        }
        await tx.clientUserAccess.delete({ where: { userId_clientId: { userId: user.id, clientId: req.params.id } } });
        if (!shared) await tx.user.delete({ where: { id: user.id } });
        await recordActivity(tx, req.user, 'CLIENT_LOGIN_DELETED', { userId: user.id, name: user.name, email: user.email, accountDeleted: !shared, activityEntriesRemoved: removedActivity }, req.params.id);
        return { firebaseUid: shared ? null : user.firebaseUid, accountDeleted: !shared, removedActivity };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2003' || error.cause?.code === 'P2003') throw new HttpError(409, 'This login still has records attached, so it cannot be deleted. Disable access instead.');
      throw error;
    }
    let signInRemoved = false;
    if (removed.firebaseUid) {
      try { await identity.deleteUser(removed.firebaseUid); signInRemoved = true; }
      catch { console.error(JSON.stringify({ errorType: 'ClientLoginCleanupFailed', firebaseUid: removed.firebaseUid })); }
    }
    res.json({ data: { accountDeleted: removed.accountDeleted, signInRemoved, activityEntriesRemoved: removed.removedActivity } });
  }

  return { createLogin, updateLogin, deleteLogin, loginImpact };
}
