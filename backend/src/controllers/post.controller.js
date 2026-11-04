import { HttpError } from '../access.js';
import { sheetPostInput, sheetPostUpdate, sheetActionInput, sheetQuery, postMetricsInput, bulkPostInput, bulkPostRow, bulkActionInput } from '../validation/post.validation.js';
import { sheetSelect, sheetRow, stageFilter, focusFilter } from '../services/post.service.js';
import { contentScope, checkVersion, activePlanningAccount, contentActivity } from '../services/planning.service.js';
import { findProduction, productionDetails, requiredText } from '../services/production.service.js';
import { productionDefaults, materialProductionChanges, saveRevision, scriptPassed, footagePassed, requireReadyGates } from '../services/production-state.service.js';
import { supersedeRequests, createApprovalRequest } from '../services/approval.service.js';

export function createPostController({ db }) {
  // The filters shared by the list and the stage counts. The stage itself is applied separately so the
  // counts can show every stage for the same search, account and date range.
  function postFilters(user, q) {
    const filters = [contentScope(user)];
    if (q.clientId) filters.push({ socialAccount: { clientId: q.clientId } });
    if (q.socialAccountId) filters.push({ socialAccountId: q.socialAccountId });
    if (q.contentType) filters.push({ contentType: q.contentType });
    if (q.search) filters.push({ title: { contains: q.search } });
    if (q.focus) filters.push(focusFilter(q.focus));
    if (q.mine === 'true' && user.role === 'CLIENT') filters.push({ socialAccount: { active: true, client: { status: 'ACTIVE' } }, OR: [stageFilter.CONTENT_REVIEW, stageFilter.WAITING_FOOTAGE, stageFilter.FINAL_REVIEW] });
    if (Boolean(q.from) !== Boolean(q.to) || q.from && (new Date(q.to) <= new Date(q.from) || new Date(q.to) - new Date(q.from) > 94 * 86400000)) throw new HttpError(400, 'Choose a date range of up to 93 days.');
    if (q.from) filters.push({ publishAt: { gte: new Date(q.from), lt: new Date(q.to) } });
    return filters;
  }
  async function list(req, res) {
    const q = sheetQuery.parse(req.query), filters = postFilters(req.user, q);
    if (q.stage) filters.push(stageFilter[q.stage]);
    const where = { AND: filters };
    const [data, total] = await Promise.all([db.contentItem.findMany({ where, select: sheetSelect(req.user.role), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.pageSize, skip: (q.page - 1) * q.pageSize }), db.contentItem.count({ where })]);
    res.json({ data: data.map(sheetRow), total, page: q.page, pageSize: q.pageSize });
  }
  // Number of posts in each stage for the current search / account / date range (ignores the stage filter itself).
  async function summary(req, res) {
    const q = sheetQuery.parse(req.query), filters = postFilters(req.user, q), keys = Object.keys(stageFilter);
    const [total, ...counts] = await Promise.all([db.contentItem.count({ where: { AND: filters } }), ...keys.map(key => db.contentItem.count({ where: { AND: [...filters, stageFilter[key]] } }))]);
    res.json({ data: { total, stages: Object.fromEntries(keys.map((key, index) => [key, counts[index]])) } });
  }
  async function createPost(tx, user, fields) {
    const item = await tx.contentItem.create({ data: { ...fields, publishAt: fields.publishAt ? new Date(fields.publishAt) : null, ...productionDefaults(fields.contentType), productionStage: 'DRAFTING', createdById: user.id, ownerId: user.id }, select: sheetSelect('AGENCY') });
    await saveRevision(tx, item, 'SCRIPT', user.id); await saveRevision(tx, item, 'CREATIVE', user.id);
    await contentActivity(tx, user, 'CONTENT_ITEM_CREATED', item, { publicSummary: 'Post added to the planning sheet.' }); return item;
  }
  async function openAccount(tx, socialAccountId) {
    const account = await tx.socialAccount.findUnique({ where: { id: socialAccountId } });
    if (!account) throw new HttpError(404, 'Social account not found.');
    await activePlanningAccount(tx, account.id, account.clientId); return account;
  }
  async function create(req, res) {
    const fields = sheetPostInput.parse(req.body);
    const item = await db.$transaction(async tx => { await openAccount(tx, fields.socialAccountId); return createPost(tx, req.user, fields); });
    res.status(201).json({ data: sheetRow(item) });
  }
  async function createBulk(req, res) {
    const { socialAccountId, posts } = bulkPostInput.parse(req.body), rows = [], problems = [];
    posts.forEach((post, index) => { const parsed = bulkPostRow.safeParse(post); if (parsed.success) rows.push(parsed.data); else problems.push(`Row ${index + 1}: ${parsed.error.issues[0].path[0] ? `${parsed.error.issues[0].path[0]} - ` : ''}${parsed.error.issues[0].message}.`); });
    if (problems.length) throw new HttpError(400, `Nothing was saved. ${problems.slice(0, 5).join(' ')}${problems.length > 5 ? ` (+${problems.length - 5} more)` : ''}`);
    const items = await db.$transaction(async tx => {
      await openAccount(tx, socialAccountId); const created = [];
      for (const row of rows) created.push(await createPost(tx, req.user, { ...row, socialAccountId }));
      return created;
    }, { isolationLevel: 'Serializable', timeout: 60000 });
    res.status(201).json({ data: items.map(sheetRow), created: items.length });
  }
  async function update(req, res) {
    const { updatedAt, creativeReference, internalProductionNotes, ...input } = sheetPostUpdate.parse(req.body);
    const item = await db.$transaction(async tx => {
      const before = await findProduction(tx, req.user, req.params.id); checkVersion(before, updatedAt);
      await activePlanningAccount(tx, before.socialAccountId, before.socialAccount.clientId);
      const changes = materialProductionChanges(before, input), referenceChanged = creativeReference !== undefined && creativeReference !== before.creativeReference;
      const data = { ...input, ...changes.data };
      if ('publishAt' in input) data.publishAt = input.publishAt ? new Date(input.publishAt) : null;
      if (internalProductionNotes !== undefined) data.internalProductionNotes = internalProductionNotes;
      if (creativeReference !== undefined) data.creativeReference = creativeReference;
      if (referenceChanged) {
        Object.assign(data, { creativeVersion: before.creativeVersion + 1, qaStatus: 'NOT_STARTED', qaVersion: null, finalApprovalStatus: 'NOT_REQUESTED', finalApprovedVersion: null });
        if (['CLIENT_FINAL_REVIEW', 'READY', 'INTERNAL_REVIEW'].includes(before.productionStage) && !changes.scriptChanged) data.productionStage = 'PRODUCTION';
        if (before.status === 'APPROVED') data.status = 'IN_PROGRESS';
        if (before.productionStage === 'CLIENT_FINAL_REVIEW') data.clientActionDueAt = null;
      }
      if (changes.materialChanged || referenceChanged) await supersedeRequests(tx, before.id, changes.scriptChanged ? ['SCRIPT', 'FINAL'] : ['FINAL']);
      const updated = await tx.contentItem.update({ where: { id: before.id }, data, select: sheetSelect('AGENCY') });
      if (changes.scriptChanged) await saveRevision(tx, updated, 'SCRIPT', req.user.id);
      if (changes.materialChanged || referenceChanged) await saveRevision(tx, updated, 'CREATIVE', req.user.id);
      await contentActivity(tx, req.user, 'CONTENT_ITEM_UPDATED', updated, { publicSummary: 'Post updated.', fields: Object.keys(input), referenceChanged }); return updated;
    }, { isolationLevel: 'Serializable' });
    res.json({ data: sheetRow(item) });
  }
  async function updateMetrics(req, res) {
    const { updatedAt, ...input } = postMetricsInput.parse(req.body);
    const item = await db.$transaction(async tx => {
      const before = await findProduction(tx, req.user, req.params.id);
      checkVersion(before, updatedAt);
      if (before.productionStage !== 'PUBLISHED') throw new HttpError(409, 'Record publication before entering Likes, Comments or Views.');
      const updated = await tx.contentItem.update({ where: { id: before.id }, data: { ...input, metricsUpdatedAt: new Date() }, select: sheetSelect('AGENCY') });
      await contentActivity(tx, req.user, 'POST_METRICS_UPDATED', updated, { before: { likes: before.likes, comments: before.comments, views: before.views }, after: input, publicSummary: 'Agency updated the manually recorded Likes, Comments and Views.' });
      return updated;
    }, { isolationLevel: 'Serializable' });
    res.json({ data: sheetRow(item) });
  }
  async function performAction(tx, user, id, input) {
    const before = await findProduction(tx, user, id); checkVersion(before, input.updatedAt);
    await activePlanningAccount(tx, before.socialAccountId, before.socialAccount.clientId);
    if (['CANCELLED', 'PUBLISHED', 'ON_HOLD'].includes(before.productionStage)) throw new HttpError(409, 'This post cannot be updated at its current stage.');
    const data = {}, scriptOk = scriptPassed(before); let eventType = 'PRODUCTION_STAGE_CHANGED', summary = '';
    switch(input.action) {
      case 'SEND_CONTENT_REVIEW':
        if (!['PLANNED', 'DRAFTING'].includes(before.productionStage) || !before.script.trim()) throw new HttpError(409, 'Write the script or content before sending it for approval.');
        await createApprovalRequest(tx, before, user, 'SCRIPT', {});
        Object.assign(data, { status: 'IN_PROGRESS', productionStage: 'CLIENT_INPUT', scriptApprovalStatus: 'PENDING', scriptApprovedVersion: null, clientFeedback: '' });
        eventType = 'APPROVAL_REQUESTED'; summary = `Content v${before.scriptVersion} sent to the Client for approval.`; break;
      case 'REPORT_FOOTAGE':
        if (before.productionStage !== 'CLIENT_INPUT' || !scriptOk || !before.requiresFootage) throw new HttpError(409, 'The Client must approve the script before reporting footage.');
        await tx.mediaHandoff.create({ data: { contentItemId: before.id, sequence: before.handoffVersion + 1, channel: 'GROUP', channelName: '', senderName: user.name, description: input.note || 'Footage shared in WhatsApp.', messageReference: '', reportedById: user.id } });
        Object.assign(data, { shootStatus: 'RECORDED', shootCompletedAt: new Date(), footageStatus: 'REPORTED_SENT', handoffVersion: before.handoffVersion + 1, verifiedFootageVersion: null });
        eventType = 'FOOTAGE_REPORTED_SENT'; summary = 'Client footage reported sent in WhatsApp; Agency can check it and start editing.'; break;
      case 'START_WORK': {
        if (before.productionStage !== 'CLIENT_INPUT' || !scriptOk || before.footageStatus !== 'REPORTED_SENT') throw new HttpError(409, 'Wait for the approved script and footage report.');
        const handoff = await tx.mediaHandoff.findUnique({ where: { contentItemId_sequence: { contentItemId: before.id, sequence: before.handoffVersion } } });
        if (!handoff) throw new HttpError(409, 'Footage report not found.');
        await tx.mediaHandoff.update({ where: { id: handoff.id }, data: { verificationStatus: 'VERIFIED_RECEIVED', verificationNote: 'Agency confirmed usable WhatsApp clips by starting editing.', verifiedById: user.id, verifiedAt: new Date() } });
        Object.assign(data, { productionStage: 'PRODUCTION', footageStatus: 'VERIFIED_RECEIVED', verifiedFootageVersion: before.handoffVersion }); eventType = 'FOOTAGE_VERIFIED'; summary = 'Agency confirmed receipt of usable clips and started editing.'; break;
      }
      case 'REQUEST_MORE_FOOTAGE': {
        if (!before.requiresFootage || !scriptOk || !['REPORTED_SENT', 'VERIFIED_RECEIVED'].includes(before.footageStatus)) throw new HttpError(409, 'There is no current footage report to return.');
        const feedback = requiredText(input.note, 'Tell the Client which clips are missing or need another take.');
        await tx.mediaHandoff.update({ where: { contentItemId_sequence: { contentItemId: before.id, sequence: before.handoffVersion } }, data: { verificationStatus: 'NEEDS_MORE', verifiedById: user.id, verifiedAt: new Date(), verificationNote: 'Agency requested missing or replacement clips.' } });
        await supersedeRequests(tx, before.id, ['FINAL']);
        Object.assign(data, { productionStage: 'CLIENT_INPUT', status: 'IN_PROGRESS', footageStatus: 'NEEDS_MORE', verifiedFootageVersion: null, shootStatus: 'NOT_STARTED', clientFeedback: feedback, qaStatus: 'NOT_STARTED', qaVersion: null, finalApprovalStatus: 'NOT_REQUESTED', finalApprovedVersion: null });
        eventType = 'FOOTAGE_MORE_REQUESTED'; summary = 'Agency requested missing or replacement clips.'; break;
      }
      case 'SEND_FINAL_REVIEW': {
        if (before.productionStage !== 'PRODUCTION' || !scriptOk || !footagePassed(before)) throw new HttpError(409, 'Complete content approval and required footage checks first.');
        requiredText(before.creativeReference, 'Add the final file reference or preview link before sending it.');
        let external = false; try { external = ['http:', 'https:'].includes(new URL(before.creativeReference.trim()).protocol); } catch {}
        await createApprovalRequest(tx, before, user, 'FINAL', { reviewSummary: input.note || 'Please review the final creative and caption, then approve or request changes.', reviewLocation: external ? 'EXTERNAL' : 'WHATSAPP', ...(external ? { previewUrl: before.creativeReference.trim() } : {}) });
        Object.assign(data, { productionStage: 'CLIENT_FINAL_REVIEW', finalApprovalStatus: 'PENDING', finalApprovedVersion: null, qaStatus: 'PASSED', qaVersion: before.creativeVersion, clientFeedback: '' });
        eventType = 'APPROVAL_REQUESTED'; summary = `Final creative v${before.creativeVersion} sent to the Client for approval.`; break;
      }
      case 'MARK_PUBLISHED': {
        if (before.productionStage !== 'READY') throw new HttpError(409, 'The Client must approve the current final version before publishing can be recorded.');
        requireReadyGates(before, 'READY'); const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
        if (publishedAt.getTime() > Date.now() + 60000) throw new HttpError(400, 'Actual publication time cannot be in the future.');
        Object.assign(data, { productionStage: 'PUBLISHED', publishedAt, publishedUrl: input.publishedUrl || '', publishedById: user.id }); eventType = 'POST_PUBLISHED'; summary = 'Agency recorded manual publication on the social account.'; break;
      }
      case 'CANCEL': requiredText(input.note, 'Enter a reason for cancelling this post.'); Object.assign(data, { productionStage: 'CANCELLED', status: 'CANCELLED', holdReason: input.note }); await supersedeRequests(tx, before.id); eventType = 'PRODUCTION_CANCELLED'; summary = 'Agency cancelled this post.'; break;
    }
    await tx.contentItem.update({ where: { id: before.id }, data });
    const item = await findProduction(tx, user, before.id);
    await contentActivity(tx, user, eventType, item, { action: input.action, publicSummary: summary, ...(input.action === 'CANCEL' ? { reason: input.note } : {}) }); return item;

  }
  async function act(req, res) {
    const input = sheetActionInput.parse(req.body);
    if (req.user.role !== 'AGENCY' && input.action !== 'REPORT_FOOTAGE') throw new HttpError(403, 'Only the Agency can perform this action.');
    const result = await db.$transaction(tx => performAction(tx, req.user, req.params.id, input), { isolationLevel: 'Serializable', timeout: 30000 });
    res.json({ data: await productionDetails(db, req.user, result) });
  }
  async function reschedulePost(tx, user, id, input) {
    const before = await findProduction(tx, user, id); checkVersion(before, input.updatedAt);
    await activePlanningAccount(tx, before.socialAccountId, before.socialAccount.clientId);
    if (['CANCELLED', 'PUBLISHED', 'ON_HOLD'].includes(before.productionStage)) throw new HttpError(409, 'This post cannot be updated at its current stage.');
    if (input.shiftDays !== undefined && !before.publishAt) throw new HttpError(409, 'This post has no publish date to shift.');
    const next = input.shiftDays !== undefined ? new Date(before.publishAt.getTime() + input.shiftDays * 86400000) : new Date(input.publishAt);
    const updated = await tx.contentItem.update({ where: { id: before.id }, data: { publishAt: next }, select: sheetSelect('AGENCY') });
    await contentActivity(tx, user, 'CONTENT_ITEM_UPDATED', updated, { publicSummary: 'Post updated.', fields: ['publishAt'] }); return updated;
  }
  // Permanently removes a post and the records that belong only to it. The activity log keeps a
  // CONTENT_ITEM_DELETED entry (with the title) because the database detaches, rather than removes, its history.
  async function deletePost(tx, user, id, updatedAt) {
    const item = await findProduction(tx, user, id); checkVersion(item, updatedAt);
    await contentActivity(tx, user, 'CONTENT_ITEM_DELETED', item, { title: item.title, contentType: item.contentType, productionStage: item.productionStage, publishAt: item.publishAt, internal: true });
    await tx.productionApproval.deleteMany({ where: { contentItemId: id } });
    await tx.approvalRequest.deleteMany({ where: { contentItemId: id } });
    await tx.mediaHandoff.deleteMany({ where: { contentItemId: id } });
    await tx.contentRevision.deleteMany({ where: { contentItemId: id } });
    await tx.contentItem.delete({ where: { id } });
    return item;
  }
  async function bulkAct(req, res) {
    const input = bulkActionInput.parse(req.body), succeeded = [], failed = [];
    for (const { id, updatedAt } of input.items) {
      try {
        await db.$transaction(tx => input.action === 'DELETE' ? deletePost(tx, req.user, id, updatedAt) : input.action === 'RESCHEDULE' ? reschedulePost(tx, req.user, id, { updatedAt, shiftDays: input.shiftDays, publishAt: input.publishAt }) : performAction(tx, req.user, id, { action: input.action, updatedAt, note: input.note }), { isolationLevel: 'Serializable', timeout: 30000 });
        succeeded.push(id);
      } catch (error) {
        if (!(error instanceof HttpError)) console.error('Bulk post action failed', id, error);
        failed.push({ id, error: error instanceof HttpError ? error.message : 'Could not update this post. Try again.' });
      }
    }
    res.json({ succeeded, failed });
  }
  return { list, summary, create, createBulk, update, updateMetrics, act, bulkAct };
}
