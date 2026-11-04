import { clientScope, HttpError } from '../access.js';
import { productionFields } from './production-state.service.js';

export const visiblePlanningStatuses = ['TENTATIVE', 'IN_PROGRESS', 'APPROVED'];
export const personSelect = { id: true, name: true };
export const planningAccountSelect = {
  id: true, clientId: true, platform: true, handle: true, timezone: true, active: true,
  client: { select: { id: true, name: true, timezone: true, status: true } },
};
export function contentScope(user) {
  return {
    socialAccount: { client: clientScope(user) },
    ...(user.role === 'CLIENT' ? { status: { in: visiblePlanningStatuses } } : {}),
  };
}
export function contentSelect(role) {
  return {
    id: true, ideaId: true, socialAccountId: true, title: true, contentType: true,
    script: true, caption: true, publishAt: true, status: true, createdAt: true, updatedAt: true,
    productionStage: true,
    publishedAt: true, publishedUrl: true,
    likes: true, comments: true, views: true, metricsUpdatedAt: true,
    idea: { select: { id: true, title: true, clientId: true } },
    socialAccount: { select: planningAccountSelect },
    ...(role === 'AGENCY' ? {
      ...productionFields,
      dueAt: true, priority: true, ownerId: true, contributorId: true,
      owner: { select: personSelect }, contributor: { select: personSelect },
    } : {}),
  };
}
export async function findContent(db, user, id) {
  const item = await db.contentItem.findFirst({ where: { id, ...contentScope(user) }, select: contentSelect(user.role) });
  if (!item) throw new HttpError(404, 'Content item not found.');
  return item;
}
export async function activePlanningClient(db, clientId) {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) throw new HttpError(404, 'Client not found.');
  if (client.status !== 'ACTIVE') throw new HttpError(409, 'Restore this client before changing its content plans.');
  return client;
}
export async function activePlanningAccount(db, accountId, clientId) {
  const account = await db.socialAccount.findFirst({ where: { id: accountId, clientId }, select: planningAccountSelect });
  if (!account) throw new HttpError(400, 'Choose a social account belonging to this client.');
  if (!account.active || account.client.status !== 'ACTIVE') throw new HttpError(409, 'Choose an active account and client before scheduling content.');
  return account;
}
export async function validateAssignees(db, input) {
  const ids = [...new Set([input.ownerId, input.contributorId].filter(Boolean))];
  if (ids.length && await db.user.count({ where: { id: { in: ids }, role: 'AGENCY', status: 'ACTIVE' } }) !== ids.length) {
    throw new HttpError(400, 'Owners and contributors must be active Agency users.');
  }
}
export function requirePublishDate(input) {
  if (visiblePlanningStatuses.includes(input.status) && !input.publishAt) throw new HttpError(400, 'Set a publish date before sharing this planned post with the client.');
}
export function checkVersion(before, expected) {
  if (expected && new Date(expected).getTime() !== new Date(before.updatedAt).getTime()) throw new HttpError(409, 'This record changed while you were editing. Refresh and try again.');
}
export function contentWarnings(item, duplicate = false) {
  const warnings = [];
  if (!item.ownerId) warnings.push('No Agency owner assigned.');
  if (!item.publishAt) warnings.push('No publish date selected.');
  if (item.publishAt && new Date(item.publishAt) < new Date() && item.status !== 'CANCELLED') warnings.push('The planned publish date is in the past.');
  if (item.dueAt && item.publishAt && new Date(item.dueAt) > new Date(item.publishAt)) warnings.push('The production due date is after the publish date.');
  if (!item.socialAccount.active || item.socialAccount.client.status !== 'ACTIVE') warnings.push('This account or business is inactive.');
  if (duplicate) warnings.push('Another post is planned for this account at the same time.');
  return warnings;
}
export async function withWarnings(db, item, role) {
  if (role !== 'AGENCY') return item;
  const duplicate = item.publishAt && item.status !== 'CANCELLED' && await db.contentItem.count({
    where: { socialAccountId: item.socialAccountId, publishAt: item.publishAt, status: { not: 'CANCELLED' }, id: { not: item.id } },
  }) > 0;
  return { ...item, warnings: contentWarnings(item, duplicate) };
}
export function contentActivity(db, user, eventType, item, details) {
  return db.activityEvent.create({ data: {
    actorId: user.id, clientId: item.socialAccount.clientId, contentItemId: item.id, eventType,
    details: JSON.parse(JSON.stringify(details)),
  } });
}
