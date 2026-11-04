import { HttpError } from '../access.js';
import { clientDecisionInput, bulkDecisionInput } from '../validation/approval.validation.js';
import { findProduction, productionDetails, requiredText } from '../services/production.service.js';
import { activePlanningAccount, checkVersion, contentActivity } from '../services/planning.service.js';
import { decisionChanges } from '../services/approval.service.js';
import { requireReadyGates } from '../services/production-state.service.js';

export function createApprovalController({ db }) {
  // Records one Client decision on one review request. Shared by the single and the bulk endpoint.
  async function applyDecision(tx, user, request, input) {
    const before = await findProduction(tx, user, request.contentItemId);
    checkVersion(before, input.updatedAt);
    await activePlanningAccount(tx, before.socialAccountId, before.socialAccount.clientId);
    const script = request.kind === 'SCRIPT', version = script ? before.scriptVersion : before.creativeVersion;
    const expectedStage = script ? 'CLIENT_INPUT' : 'CLIENT_FINAL_REVIEW';
    const gate = script ? before.scriptApprovalStatus : before.finalApprovalStatus;
    if (request.status !== 'PENDING' || request.version !== version || input.version !== version || before.productionStage !== expectedStage || gate !== 'PENDING') throw new HttpError(409, 'This review is no longer current. Refresh to see the latest request.');
    const approved = input.decision === 'APPROVED';
    if (!approved) requiredText(input.feedback, 'Explain the changes you need before submitting.');
    if (approved && !script && request.reviewLocation !== 'IN_APP' && !input.acknowledged) throw new HttpError(400, 'Confirm that you reviewed this exact creative version before approving.');
    const acknowledgement = approved && !script ? `I reviewed creative v${version}: ${request.creativeReference || request.title}. Shared ${request.createdAt.toISOString()} via ${request.reviewLocation}.` : '';
    const data = decisionChanges(before, request.kind, approved, input.feedback);
    requireReadyGates({ ...before, ...data }, data.productionStage);
    await tx.productionApproval.create({ data: {
      contentItemId: before.id, requestId: request.id, kind: request.kind, version,
      decision: input.decision, source: 'PORTAL', origin: 'CLIENT_PORTAL', reference: '',
      feedback: input.feedback, acknowledgement, recordedById: user.id,
    } });
    await tx.approvalRequest.update({ where: { id: request.id }, data: { status: input.decision, closedAt: new Date() } });
    await tx.contentItem.update({ where: { id: before.id }, data });
    const item = await findProduction(tx, user, before.id);
    await contentActivity(tx, user, 'CLIENT_APPROVAL_DECISION', item, {
      requestId: request.id, kind: request.kind, version, decision: input.decision, feedback: input.feedback,
      origin: 'CLIENT_PORTAL', publicSummary: `Client ${approved ? 'approved' : 'requested changes to'} ${script ? before.contentType === 'REEL' ? 'script' : 'content' : 'final creative'} v${version}.`,
    });
    return item;
  }
  async function decide(req, res) {
    if (req.user.role !== 'CLIENT') throw new HttpError(403, 'Only a signed-in Client can submit a portal decision.');
    const input = clientDecisionInput.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({ where: { id: req.params.id } });
      if (!request) throw new HttpError(404, 'Review request not found.');
      return applyDecision(tx, req.user, request, input);
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    res.json({ data: await productionDetails(db, req.user, result) });
  }
  // Approves several posts at once. Each post is its own transaction, so one stale or withdrawn request does not
  // block the others. Only approvals can be done in bulk: asking for changes needs feedback written for each post.
  async function decideBulk(req, res) {
    if (req.user.role !== 'CLIENT') throw new HttpError(403, 'Only a signed-in Client can submit a portal decision.');
    const input = bulkDecisionInput.parse(req.body), succeeded = [], failed = [];
    for (const item of input.items) {
      try {
        await db.$transaction(async (tx) => {
          await findProduction(tx, req.user, item.id); // 404 if this post is not one of this Client's
          const request = await tx.approvalRequest.findFirst({ where: { contentItemId: item.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
          if (!request) throw new HttpError(409, 'Nothing is waiting for your approval on this post anymore.');
          return applyDecision(tx, req.user, request, { updatedAt: item.updatedAt, version: item.version, decision: 'APPROVED', feedback: '', acknowledged: input.acknowledged });
        }, { isolationLevel: 'Serializable', timeout: 30000 });
        succeeded.push(item.id);
      } catch (error) {
        if (!(error instanceof HttpError)) console.error('Bulk approval failed', item.id, error);
        failed.push({ id: item.id, error: error instanceof HttpError ? error.message : 'Could not approve this post. Try again.' });
      }
    }
    res.json({ succeeded, failed });
  }
  return { decide, decideBulk };
}
