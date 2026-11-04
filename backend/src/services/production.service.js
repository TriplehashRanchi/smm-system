import { HttpError } from '../access.js';
import { contentScope, contentSelect } from './planning.service.js';
import { availableProductionActions, nextProductionAction, scriptPassed, footagePassed, qaPassed, finalPassed } from './production-state.service.js';
import { approvalRequestSelect } from './approval.service.js';

export async function findProduction(db, user, id) {
  const item = await db.contentItem.findFirst({ where: { id, ...contentScope(user) }, select: {
    ...contentSelect('AGENCY'), idea: { select: { id: true, title: true, clientId: true, brief: true } },
  } });
  if (!item) throw new HttpError(404, 'Content item not found.');
  return item;
}
export const publicProductionEvents = [
  'PRODUCTION_STAGE_CHANGED', 'SHOOT_SCHEDULED', 'SHOOT_COMPLETED', 'FOOTAGE_REPORTED_SENT', 'FOOTAGE_VERIFIED', 'FOOTAGE_MORE_REQUESTED',
  'PRODUCTION_EXTERNAL_APPROVAL_RECORDED', 'PRODUCTION_ON_HOLD', 'PRODUCTION_RESUMED', 'PRODUCTION_CANCELLED',
  'CLIENT_APPROVAL_DECISION', 'APPROVAL_REQUESTED',
  'POST_PUBLISHED', 'POST_METRICS_UPDATED',
];
export async function getProductionHistory(db, user, id, page = 1, pageSize = 30) {
  const where = { contentItemId: id, ...(user.role === 'CLIENT' ? { eventType: { in: publicProductionEvents } } : {}) };
  const [rows, total] = await Promise.all([
    db.activityEvent.findMany({ where, include: { actor: { select: { name: true, role: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pageSize, skip: (page - 1) * pageSize }),
    db.activityEvent.count({ where }),
  ]);
  return { data: rows.map((event) => ({ id: event.id, eventType: event.eventType, createdAt: event.createdAt, actor: event.actor,
    summary: event.details?.publicSummary || event.eventType.toLowerCase().replaceAll('_', ' '),
    ...(user.role === 'AGENCY' ? { details: event.details } : {}),
  })), total, page, pageSize };
}
export async function productionDetails(db, user, item) {
  const agency = user.role === 'AGENCY';
  const [handoffs, approvals, revisions, timeline, approvalRequests] = await Promise.all([
    db.mediaHandoff.findMany({ where: { contentItemId: item.id }, orderBy: { sequence: 'desc' }, take: 30, select: {
      id: true, sequence: true, channel: true, channelName: true, senderName: true, description: true, sentAt: true, clipCount: true,
      messageReference: true, createdAt: true, verificationStatus: true, verifiedAt: true,
      reportedBy: { select: { name: true, role: true } },
      ...(agency ? { verificationNote: true, verifiedBy: { select: { name: true } } } : {}),
    } }),
    agency ? db.productionApproval.findMany({ where: { contentItemId: item.id }, include: { recordedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }) : Promise.resolve([]),
    agency ? db.contentRevision.findMany({ where: { contentItemId: item.id }, include: { createdBy: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30 }) : Promise.resolve([]),
    getProductionHistory(db, user, item.id),
    db.approvalRequest.findMany({ where: { contentItemId: item.id }, select: approvalRequestSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30 }),
  ]);
  const visibleItem = agency ? item : Object.fromEntries(['id', 'title', 'contentType', 'script', 'caption', 'publishAt', 'status', 'updatedAt', 'socialAccount', 'productionStage', 'publishedAt', 'publishedUrl', 'likes', 'comments', 'views', 'metricsUpdatedAt'].map((key) => [key, item[key]]));
  const state = Object.fromEntries([
    'productionStage', 'requiresScriptApproval', 'requiresFootage', 'requiresFinalApproval', 'scriptVersion', 'creativeVersion',
    'scriptApprovalStatus', 'scriptApprovedVersion', 'finalApprovalStatus', 'finalApprovedVersion', 'shootStatus', 'shootAt', 'shootCompletedAt',
    'footageStatus', 'handoffVersion', 'verifiedFootageVersion', 'qaStatus', 'creativeReference', 'clientFeedback',
    'clientActionDueAt',
    ...(agency ? ['internalProductionNotes', 'qaNote', 'qaVersion', 'holdReason', 'resumeStage', 'allowExternalFinalApproval'] : []),
  ].map((key) => [key, item[key]]));
  return {
    item: visibleItem, state, nextAction: nextProductionAction(item), actions: availableProductionActions(item, user.role),
    gates: { script: scriptPassed(item), footage: footagePassed(item), qa: qaPassed(item), final: finalPassed(item) },
    handoffs, approvals, revisions, timeline, approvalRequests,
  };
}
export function ensureClientCanAct(item) {
  if (!['TENTATIVE', 'IN_PROGRESS', 'APPROVED'].includes(item.status)) throw new HttpError(409, 'Share this post before requesting client action.');
}
export function requiredText(value, message) {
  if (!value || value.trim().length < 5) throw new HttpError(400, message);
  return value.trim();
}
