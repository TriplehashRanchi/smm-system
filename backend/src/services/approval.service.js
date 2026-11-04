import { HttpError } from '../access.js';
import { footagePassed, isTextOnly } from './production-state.service.js';

export function supersedeRequests(db, id, kinds = ['SCRIPT', 'FINAL']) {
  return db.approvalRequest.updateMany({ where: { contentItemId: id, kind: { in: kinds }, status: 'PENDING' }, data: { status: 'SUPERSEDED', closedAt: new Date() } });
}
export async function createApprovalRequest(db, item, actor, kind, input) {
  const text = isTextOnly(item), script = kind === 'SCRIPT';
  const location = script || text ? 'IN_APP' : input.reviewLocation || 'WHATSAPP';
  if (!script && !text && location === 'IN_APP') throw new HttpError(400, 'Visual creatives require a WhatsApp reference or external preview.');
  if (location === 'EXTERNAL' && !input.previewUrl) throw new HttpError(400, 'Add the external preview URL.');
  if (!script && !text && !item.creativeReference.trim()) throw new HttpError(409, 'Add the final creative reference before requesting review.');
  if (!script && (!input.reviewSummary || input.reviewSummary.trim().length < 5)) throw new HttpError(400, 'Add a short summary of this final version for the client.');
  await supersedeRequests(db, item.id, [kind]);
  return db.approvalRequest.create({ data: {
    contentItemId: item.id, kind, version: script ? item.scriptVersion : item.creativeVersion,
    title: item.title, script: item.script, caption: item.caption, creativeReference: script ? '' : item.creativeReference,
    summary: input.reviewSummary || `Please review the ${item.contentType === 'REEL' ? 'script' : 'content'} and approve it or explain the changes needed.`,
    reviewLocation: location, previewUrl: location === 'EXTERNAL' ? input.previewUrl : '',
    dueAt: input.clientActionDueAt ? new Date(input.clientActionDueAt) : null, requestedById: actor.id,
  } });
}
export function decisionChanges(item, kind, approved, feedback) {
  const script = kind === 'SCRIPT', current = script ? item.scriptVersion : item.creativeVersion;
  const data = { clientFeedback: approved ? '' : feedback, clientActionDueAt: null };
  Object.assign(data, script
    ? { scriptApprovalStatus: approved ? 'APPROVED' : 'CHANGES_REQUESTED', scriptApprovedVersion: approved ? current : null }
    : { finalApprovalStatus: approved ? 'APPROVED' : 'CHANGES_REQUESTED', finalApprovedVersion: approved ? current : null });
  data.productionStage = script
    ? approved ? item.requiresFootage && !footagePassed(item) ? 'CLIENT_INPUT' : isTextOnly(item) ? 'DRAFTING' : 'PRODUCTION' : 'DRAFTING'
    : approved ? 'READY' : isTextOnly(item) ? 'DRAFTING' : 'PRODUCTION';
  if (!script && approved) data.status = 'APPROVED';
  if (!approved) Object.assign(data, { qaStatus: 'NOT_STARTED', qaVersion: null, finalApprovalStatus: script ? item.requiresFinalApproval ? 'NOT_REQUESTED' : 'NOT_REQUIRED' : 'CHANGES_REQUESTED', finalApprovedVersion: null, ...(item.status === 'APPROVED' ? { status: 'IN_PROGRESS' } : {}) });
  return data;
}
export const approvalRequestSelect = {
  id: true, kind: true, version: true, status: true, title: true, script: true, caption: true,
  creativeReference: true, summary: true, reviewLocation: true, previewUrl: true, dueAt: true, createdAt: true, closedAt: true,
  decision: { select: { id: true, version: true, decision: true, origin: true, feedback: true, acknowledgement: true, createdAt: true, recordedBy: { select: { name: true, role: true } } } },
};
