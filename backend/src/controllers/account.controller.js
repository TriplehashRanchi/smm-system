import { HttpError } from '../access.js';
import { accountInput, accountUpdate } from '../validation.js';
import { findClient } from '../services/client.service.js';
import { recordActivity } from '../services/audit.service.js';
import { accountInclude } from '../utils/selectors.js';
import { deleteAccountData } from '../services/delete.service.js';

export function createAccountController({ db }) {
  async function createAccount(req, res) {
    const input = accountInput.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const client = await findClient(tx, req.user, req.params.id);
      if (client.status === 'ARCHIVED') throw new HttpError(409, 'Restore this client before adding accounts.');
      const account = await tx.socialAccount.create({
        data: { ...input, clientId: client.id }, include: accountInclude,
      });
      await recordActivity(tx, req.user, 'SOCIAL_ACCOUNT_CREATED', {
        accountId: account.id, ...input,
      }, client.id);
      return account;
    });
    res.status(201).json({ data });
  }

  async function updateAccount(req, res) {
    const input = accountUpdate.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      await findClient(tx, req.user, req.params.id);
      const before = await tx.socialAccount.findFirst({
        where: { id: req.params.accountId, clientId: req.params.id },
      });
      if (!before) throw new HttpError(404, 'Social account not found.');
      const account = await tx.socialAccount.update({
        where: { id: before.id }, data: input, include: accountInclude,
      });
      await recordActivity(tx, req.user, 'SOCIAL_ACCOUNT_UPDATED', {
        accountId: account.id, before, after: input,
      }, req.params.id);
      return account;
    });
    res.json({ data });
  }

  async function accountImpact(req, res) {
    await findClient(db, req.user, req.params.id);
    const account = await db.socialAccount.findFirst({ where: { id: req.params.accountId, clientId: req.params.id }, select: { id: true } });
    if (!account) throw new HttpError(404, 'Social account not found.');
    const [posts, targets] = await Promise.all([db.contentItem.count({ where: { socialAccountId: account.id } }), db.publishingTarget.count({ where: { socialAccountId: account.id } })]);
    res.json({ data: { posts, targets } });
  }

  async function deleteAccount(req, res) {
    const data = await db.$transaction(async (tx) => {
      await findClient(tx, req.user, req.params.id);
      const account = await tx.socialAccount.findFirst({ where: { id: req.params.accountId, clientId: req.params.id } });
      if (!account) throw new HttpError(404, 'Social account not found.');
      const removed = await deleteAccountData(tx, [account.id]);
      await recordActivity(tx, req.user, 'SOCIAL_ACCOUNT_DELETED', { accountId: account.id, platform: account.platform, handle: account.handle, ...removed }, req.params.id);
      return removed;
    }, { isolationLevel: 'Serializable', timeout: 60000 });
    res.json({ data });
  }

  return { createAccount, updateAccount, accountImpact, deleteAccount };
}
