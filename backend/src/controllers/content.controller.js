import { HttpError } from '../access.js';
import { planningQuery, postsInput, postUpdate, duplicateInput, rescheduleInput } from '../validation/planning.validation.js';
import { contentScope, contentSelect, findContent, activePlanningAccount, validateAssignees, requirePublishDate, checkVersion, contentActivity, withWarnings, contentWarnings } from '../services/planning.service.js';
import { addDays, localDateTime, zonedInstant } from '../../../shared/planning-time.js';
import { productionDefaults, materialProductionChanges, saveRevision } from '../services/production-state.service.js';
import { supersedeRequests } from '../services/approval.service.js';

export function createContentController({ db }) {
  async function listContent(req, res) {
    const query = planningQuery.parse(req.query);
    if (req.user.role !== 'AGENCY' && query.ownerId) throw new HttpError(403, 'Owner filters are available only to the Agency.');
    if (Boolean(query.from) !== Boolean(query.to)) throw new HttpError(400, 'Choose both ends of the calendar range.');
    if (query.from && (new Date(query.to) <= new Date(query.from) || new Date(query.to) - new Date(query.from) > 94 * 86400000)) throw new HttpError(400, 'Choose a calendar range of up to 93 days.');
    const where = { AND: [contentScope(req.user), {
      socialAccount: { ...(query.clientId ? { clientId: query.clientId } : {}), ...(query.platform ? { platform: query.platform } : {}) },
      ...(query.contentType ? { contentType: query.contentType } : {}), ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}), ...(query.search ? { title: { contains: query.search } } : {}),
      ...(query.unscheduled === 'true' ? { publishAt: null } : query.from ? { publishAt: { gte: new Date(query.from), lt: new Date(query.to) } } : query.unscheduled === 'false' ? { publishAt: { not: null } } : {}),
    }] };
    const [items, total] = await Promise.all([
      db.contentItem.findMany({ where, select: contentSelect(req.user.role), orderBy: [{ publishAt: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      db.contentItem.count({ where }),
    ]);
    // A single grouped query detects slot conflicts, including posts outside search/status filters.
    let duplicates = new Set();
    if (req.user.role === 'AGENCY' && items.some((item) => item.publishAt)) {
      const slots = await db.contentItem.groupBy({ by: ['socialAccountId', 'publishAt'], where: {
        socialAccountId: { in: [...new Set(items.map((item) => item.socialAccountId))] },
        publishAt: { in: items.map((item) => item.publishAt).filter(Boolean) }, status: { not: 'CANCELLED' },
      }, _count: { _all: true } });
      duplicates = new Set(slots.filter((slot) => slot._count._all > 1).map((slot) => `${slot.socialAccountId}:${slot.publishAt.toISOString()}`));
    }
    const data = items.map((item) => req.user.role === 'AGENCY' ? { ...item, warnings: contentWarnings(item, item.status !== 'CANCELLED' && duplicates.has(`${item.socialAccountId}:${item.publishAt?.toISOString()}`)) } : item);
    res.json({ data, total, page: query.page, pageSize: query.pageSize });
  }

  async function getContent(req, res) {
    const item = await findContent(db, req.user, req.params.id);
    res.json({ data: await withWarnings(db, item, req.user.role) });
  }

  async function createContent(req, res) {
    const input = postsInput.parse(req.body);
    const items = await db.$transaction(async (tx) => {
      const idea = await tx.contentIdea.findUnique({ where: { id: input.ideaId } });
      if (!idea) throw new HttpError(404, 'Content idea not found.');
      const result = [];
      for (const fields of input.items) {
        if (fields.status === 'APPROVED') throw new HttpError(400, 'New posts start as Draft, Tentative or In progress. Record version-specific approvals in Production details.');
        await activePlanningAccount(tx, fields.socialAccountId, idea.clientId);
        const values = { ...fields, ownerId: fields.ownerId === undefined ? req.user.id : fields.ownerId };
        requirePublishDate(values);
        await validateAssignees(tx, values);
        const item = await tx.contentItem.create({ data: {
          ...values, ...productionDefaults(values.contentType, values.status), ideaId: idea.id, createdById: req.user.id,
          publishAt: values.publishAt ? new Date(values.publishAt) : null, dueAt: values.dueAt ? new Date(values.dueAt) : null,
        }, select: contentSelect('AGENCY') });
        await saveRevision(tx, item, 'SCRIPT', req.user.id);
        await saveRevision(tx, item, 'CREATIVE', req.user.id);
        await contentActivity(tx, req.user, 'CONTENT_ITEM_CREATED', item, { title: item.title, socialAccountId: item.socialAccountId, publishAt: item.publishAt, status: item.status });
        result.push(item);
      }
      return result;
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    res.status(201).json({ data: await Promise.all(items.map((item) => withWarnings(db, item, 'AGENCY'))) });
  }

  async function updateContent(req, res) {
    const { updatedAt, ...input } = postUpdate.parse(req.body);
    const item = await db.$transaction(async (tx) => {
      const before = await findContent(tx, req.user, req.params.id);
      checkVersion(before, updatedAt);
      const merged = { ...before, ...input };
      const production = materialProductionChanges(before, input);
      if (production.materialChanged) await supersedeRequests(tx, before.id, production.scriptChanged ? ['SCRIPT', 'FINAL'] : ['FINAL']);
      await activePlanningAccount(tx, merged.socialAccountId, before.socialAccount.clientId);
      await validateAssignees(tx, merged);
      requirePublishDate(merged);
      const data = { ...input, ...production.data };
      for (const key of ['publishAt', 'dueAt']) if (key in data) data[key] = data[key] ? new Date(data[key]) : null;
      const result = await tx.contentItem.update({ where: { id: before.id }, data, select: contentSelect('AGENCY') });
      if (production.scriptChanged) await saveRevision(tx, result, 'SCRIPT', req.user.id);
      if (production.materialChanged) await saveRevision(tx, result, 'CREATIVE', req.user.id);
      const dateChanged = new Date(before.publishAt || 0).getTime() !== new Date(result.publishAt || 0).getTime();
      await contentActivity(tx, req.user, dateChanged ? 'CONTENT_PUBLISH_DATE_CHANGED' : 'CONTENT_ITEM_UPDATED', result, {
        before: { title: before.title, socialAccountId: before.socialAccountId, contentType: before.contentType, script: before.script, caption: before.caption, publishAt: before.publishAt, dueAt: before.dueAt, status: before.status, priority: before.priority, ownerId: before.ownerId, contributorId: before.contributorId }, after: input,
      });
      return result;
    }, { isolationLevel: 'Serializable' });
    res.json({ data: await withWarnings(db, item, 'AGENCY') });
  }

  async function duplicateContent(req, res) {
    const input = duplicateInput.parse(req.body);
    const item = await db.$transaction(async (tx) => {
      const source = await findContent(tx, req.user, req.params.id);
      await activePlanningAccount(tx, input.socialAccountId, source.socialAccount.clientId);
      const result = await tx.contentItem.create({ data: {
        ideaId: source.ideaId, socialAccountId: input.socialAccountId, title: source.title, contentType: source.contentType,
        ...productionDefaults(source.contentType), script: source.script, caption: source.caption, publishAt: input.publishAt ? new Date(input.publishAt) : null,
        dueAt: null, status: 'DRAFT', priority: source.priority, ownerId: req.user.id, createdById: req.user.id,
      }, select: contentSelect('AGENCY') });
      await saveRevision(tx, result, 'SCRIPT', req.user.id);
      await saveRevision(tx, result, 'CREATIVE', req.user.id);
      await contentActivity(tx, req.user, 'CONTENT_ITEM_REPURPOSED', result, { sourceItemId: source.id, publishAt: result.publishAt, status: 'DRAFT' });
      return result;
    }, { isolationLevel: 'Serializable' });
    res.status(201).json({ data: await withWarnings(db, item, 'AGENCY') });
  }

  async function rescheduleContent(req, res) {
    const input = rescheduleInput.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const items = await tx.contentItem.findMany({ where: { id: { in: input.ids } }, select: contentSelect('AGENCY') });
      if (items.length !== input.ids.length) throw new HttpError(404, 'One or more selected posts no longer exist.');
      const moved = [];
      for (const item of items) {
        if (!item.publishAt || item.status === 'CANCELLED') throw new HttpError(409, 'Select scheduled, non-cancelled posts for bulk rescheduling.');
        await activePlanningAccount(tx, item.socialAccountId, item.socialAccount.clientId);
        const local = localDateTime(item.publishAt, item.socialAccount.timezone);
        let publishAt;
        try {
          const shiftedMinute = zonedInstant(`${addDays(local.slice(0, 10), input.days)}${local.slice(10)}`, item.socialAccount.timezone);
          publishAt = new Date(Date.parse(shiftedMinute) + item.publishAt.getUTCSeconds() * 1000 + item.publishAt.getUTCMilliseconds()).toISOString();
        }
        catch (error) { throw new HttpError(400, error.message); }
        const result = await tx.contentItem.update({ where: { id: item.id }, data: { publishAt: new Date(publishAt) }, select: contentSelect('AGENCY') });
        await contentActivity(tx, req.user, 'CONTENT_PUBLISH_DATE_CHANGED', result, { before: { publishAt: item.publishAt }, after: { publishAt }, source: 'bulk_reschedule', days: input.days, timezone: item.socialAccount.timezone });
        moved.push(result);
      }
      return moved;
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    res.json({ data });
  }

  async function history(req, res) {
    await findContent(db, req.user, req.params.id);
    const { page, pageSize } = planningQuery.parse(req.query);
    const where = { contentItemId: req.params.id };
    const [data, total] = await Promise.all([
      db.activityEvent.findMany({ where, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      db.activityEvent.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }
  return { listContent, getContent, createContent, updateContent, duplicateContent, rescheduleContent, history };
}
