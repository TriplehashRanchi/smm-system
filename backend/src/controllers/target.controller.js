import { HttpError } from '../access.js';
import { targetInput } from '../validation.js';
import { findClient } from '../services/client.service.js';
import { recordActivity } from '../services/audit.service.js';
import { accountInclude } from '../utils/selectors.js';

export function createTargetController({ db }) {
  async function upsertTarget(req, res) {
    const input = targetInput.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      await findClient(tx, req.user, req.params.id);
      const account = await tx.socialAccount.findFirst({
        where: { id: req.params.accountId, clientId: req.params.id }, include: accountInclude,
      });
      if (!account) throw new HttpError(404, 'Social account not found.');
      const conflicts = account.publishingTargets.some((target) =>
        target.contentType !== input.contentType &&
        (target.contentType === 'ALL' || input.contentType === 'ALL'));
      if (conflicts) throw new HttpError(409, 'Use either one overall weekly target or separate format targets for this account.');
      const target = await tx.publishingTarget.upsert({
        where: { socialAccountId_contentType: { socialAccountId: account.id, contentType: input.contentType } },
        create: { socialAccountId: account.id, ...input },
        update: { targetCount: input.targetCount },
      });
      await recordActivity(tx, req.user, 'PUBLISHING_TARGET_UPDATED', {
        accountId: account.id, before: account.publishingTargets, after: input,
      }, req.params.id);
      return target;
    });
    res.json({ data });
  }

  async function deleteTarget(req, res) {
    await db.$transaction(async (tx) => {
      await findClient(tx, req.user, req.params.id);
      const target = await tx.publishingTarget.findFirst({
        where: {
          id: req.params.targetId, socialAccountId: req.params.accountId,
          socialAccount: { clientId: req.params.id },
        },
      });
      if (!target) throw new HttpError(404, 'Publishing target not found.');
      await tx.publishingTarget.delete({ where: { id: target.id } });
      await recordActivity(tx, req.user, 'PUBLISHING_TARGET_REMOVED', { before: target }, req.params.id);
    });
    res.status(204).end();
  }

  return { upsertTarget, deleteTarget };
}
