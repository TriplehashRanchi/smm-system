import { HttpError } from '../access.js';
import { productionActionInput, productionMetaInput, productionQuery, handoffInput } from '../validation/production.validation.js';
import { planningQuery } from '../validation/planning.validation.js';
import { contentScope, planningAccountSelect, checkVersion, activePlanningAccount, contentActivity } from '../services/planning.service.js';
import { actionDefinition, actionProblem, nextProductionAction, isTextOnly, saveRevision, requireReadyGates, footagePassed } from '../services/production-state.service.js';
import { findProduction, productionDetails, getProductionHistory, ensureClientCanAct, requiredText } from '../services/production.service.js';
import { createApprovalRequest, decisionChanges, supersedeRequests } from '../services/approval.service.js';

export function createProductionController({ db }) {
  async function details(req, res) {
    const item = await findProduction(db, req.user, req.params.id);
    res.json({ data: await productionDetails(db, req.user, item) });
  }
  async function history(req, res) {
    await findProduction(db, req.user, req.params.id);
    const { page, pageSize } = planningQuery.parse(req.query);
    res.json(await getProductionHistory(db, req.user, req.params.id, page, pageSize));
  }
  async function revisions(req, res) {
    await findProduction(db, req.user, req.params.id);
    const { page, pageSize } = planningQuery.parse(req.query), where = { contentItemId: req.params.id };
    const [data, total] = await Promise.all([
      db.contentRevision.findMany({ where, include: { createdBy: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pageSize, skip: (page - 1) * pageSize }),
      db.contentRevision.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }
  async function queue(req, res) {
    const q = productionQuery.parse(req.query), filters = [contentScope(req.user)];
    if (q.clientId) filters.push({ socialAccount: { clientId: q.clientId } });
    if (q.productionStage) filters.push({ productionStage: q.productionStage });
    if (q.search) filters.push({ title: { contains: q.search } });
    if (q.mine === 'true' && req.user.role === 'AGENCY') filters.push({ OR: [{ ownerId: req.user.id }, { contributorId: req.user.id }] });
    const actor = req.user.role === 'CLIENT' && q.mine === 'true' ? 'CLIENT' : q.nextActor;
    if (req.user.role === 'CLIENT' && q.mine === 'true') filters.push({ socialAccount: { active: true, client: { status: 'ACTIVE' } } });
    if (actor === 'CLIENT') filters.push({ OR: [{ productionStage: 'CLIENT_FINAL_REVIEW' }, { productionStage: 'CLIENT_INPUT', footageStatus: { not: 'REPORTED_SENT' } }] });
    if (actor === 'AGENCY') filters.push({ OR: [{ productionStage: { in: ['PLANNED', 'DRAFTING', 'PRODUCTION', 'INTERNAL_REVIEW', 'READY'] } }, { productionStage: 'CLIENT_INPUT', footageStatus: 'REPORTED_SENT' }] });
    if (actor === 'NONE') filters.push({ productionStage: { in: ['ON_HOLD', 'CANCELLED'] } });
    const where = { AND: filters };
    const [rows, total] = await Promise.all([
      db.contentItem.findMany({ where, select: {
        id: true, title: true, contentType: true, status: true, publishAt: true, dueAt: true, clientActionDueAt: true, productionStage: true,
        ownerId: true, owner: { select: { name: true } }, shootStatus: true, footageStatus: true,
        requiresScriptApproval: true, scriptApprovalStatus: true, scriptVersion: true, scriptApprovedVersion: true,
        requiresFinalApproval: true, qaStatus: true, qaVersion: true, creativeVersion: true, socialAccount: { select: planningAccountSelect },
      }, orderBy: [{ dueAt: 'asc' }, { publishAt: 'asc' }, { id: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      db.contentItem.count({ where }),
    ]);
    const data = rows.map((item) => ({ id: item.id, title: item.title, contentType: item.contentType, publishAt: item.publishAt,
      productionStage: item.productionStage, nextAction: nextProductionAction(item), socialAccount: item.socialAccount,
      clientActionDueAt: item.clientActionDueAt,
      ...(req.user.role === 'AGENCY' ? { owner: item.owner, dueAt: item.dueAt } : {}),
    }));
    res.json({ data, total, page: q.page, pageSize: q.pageSize });
  }

  async function updateMetadata(req, res) {
    const { updatedAt, reason, ...input } = productionMetaInput.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      const before = await findProduction(tx, req.user, req.params.id);
      checkVersion(before, updatedAt);
      if (['CANCELLED', 'PUBLISHED'].includes(before.productionStage)) throw new HttpError(409, 'Cancelled and published posts are read-only.');
      await activePlanningAccount(tx, before.socialAccountId, before.socialAccount.clientId);
      const policyChanged = ['requiresScriptApproval', 'requiresFootage', 'requiresFinalApproval', 'allowExternalFinalApproval'].some((key) => key in input && input[key] !== before[key]);
      if (policyChanged && !['PLANNED', 'DRAFTING'].includes(before.productionStage)) throw new HttpError(409, 'Return to drafting before changing workflow requirements.');
      if (policyChanged) requiredText(reason, 'Explain why the workflow requirements are changing.');
      if (input.requiresFootage && !['REEL', 'STORY', 'OTHER'].includes(before.contentType)) throw new HttpError(400, 'This format skips shooting and raw-footage stages.');
      const data = { ...input };
      if ('requiresScriptApproval' in input && input.requiresScriptApproval !== before.requiresScriptApproval) Object.assign(data, { scriptApprovalStatus: input.requiresScriptApproval ? 'NOT_REQUESTED' : 'NOT_REQUIRED', scriptApprovedVersion: null });
      if ('requiresFootage' in input && input.requiresFootage !== before.requiresFootage) Object.assign(data, {
        shootStatus: input.requiresFootage ? 'NOT_STARTED' : 'NOT_REQUIRED', footageStatus: input.requiresFootage ? 'NOT_SENT' : 'NOT_REQUIRED', verifiedFootageVersion: null, shootAt: null, shootCompletedAt: null,
      });
      const referenceChanged = 'creativeReference' in input && input.creativeReference !== before.creativeReference;
      if (policyChanged || referenceChanged) Object.assign(data, {
        qaStatus: 'NOT_STARTED', qaVersion: null, finalApprovalStatus: (input.requiresFinalApproval ?? before.requiresFinalApproval) ? 'NOT_REQUESTED' : 'NOT_REQUIRED', finalApprovedVersion: null,
      });
      if (policyChanged || referenceChanged) await supersedeRequests(tx, before.id, policyChanged ? ['SCRIPT', 'FINAL'] : ['FINAL']);
      if (referenceChanged) {
        if (before.productionStage === 'CLIENT_FINAL_REVIEW' || before.resumeStage === 'CLIENT_FINAL_REVIEW') data.clientActionDueAt = null;
        if (before.status === 'APPROVED') data.status = 'IN_PROGRESS';
        data.creativeVersion = before.creativeVersion + 1;
        if (['INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY'].includes(before.productionStage)) data.productionStage = isTextOnly(before) ? 'DRAFTING' : 'PRODUCTION';
        if (before.productionStage === 'ON_HOLD' && ['INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY'].includes(before.resumeStage)) data.resumeStage = isTextOnly(before) ? 'DRAFTING' : 'PRODUCTION';
      }
      await tx.contentItem.update({ where: { id: before.id }, data });
      const item = await findProduction(tx, req.user, before.id);
      if (referenceChanged) await saveRevision(tx, item, 'CREATIVE', req.user.id);
      await contentActivity(tx, req.user, 'PRODUCTION_DETAILS_UPDATED', item, { before: { creativeReference: before.creativeReference, internalProductionNotes: before.internalProductionNotes, requiresFootage: before.requiresFootage, requiresScriptApproval: before.requiresScriptApproval, requiresFinalApproval: before.requiresFinalApproval }, after: input, reason: reason || '' });
      return item;
    }, { isolationLevel: 'Serializable' });
    res.json({ data: await productionDetails(db, req.user, result) });
  }

  async function act(req, res) {
    const input = productionActionInput.parse(req.body), definition = actionDefinition(input.action);
    if (req.user.role !== 'AGENCY' && !definition?.[3]) throw new HttpError(403, 'Only the Agency can perform this production action.');
    const result = await db.$transaction(async (tx) => {
      const before = await findProduction(tx, req.user, req.params.id);
      checkVersion(before, input.updatedAt);
      await activePlanningAccount(tx, before.socialAccountId, before.socialAccount.clientId);
      const problem = actionProblem(before, input.action, req.user.role);
      if (problem) throw new HttpError(409, problem);
      const data = {}, extra = { action: input.action, actorRole: req.user.role }, now = new Date();
      let eventType = 'PRODUCTION_STAGE_CHANGED', summary = definition[1], creativeRevision = false;
      const version = (expected) => { if (input.version !== expected) throw new HttpError(409, 'This action refers to an old or missing version. Refresh the production details.'); };
      const resetFinal = () => Object.assign(data, { qaStatus: 'NOT_STARTED', qaVersion: null, finalApprovalStatus: before.requiresFinalApproval ? 'NOT_REQUESTED' : 'NOT_REQUIRED', finalApprovedVersion: null, ...(before.status === 'APPROVED' ? { status: 'IN_PROGRESS' } : {}) });
      const latestHandoff = async () => {
        const handoff = await tx.mediaHandoff.findFirst({ where: { id: input.handoffId || '', contentItemId: before.id, sequence: before.handoffVersion } });
        if (!handoff) throw new HttpError(409, 'Select the latest footage report. Older reports cannot unlock production.');
        return handoff;
      };
      switch (input.action) {
        case 'START_DRAFTING': data.productionStage = 'DRAFTING'; if (before.status === 'TENTATIVE') data.status = 'IN_PROGRESS'; break;
        case 'REQUEST_SCRIPT_APPROVAL':
          ensureClientCanAct(before);
          await createApprovalRequest(tx, before, req.user, 'SCRIPT', input);
          Object.assign(data, { productionStage: 'CLIENT_INPUT', scriptApprovalStatus: 'PENDING', scriptApprovedVersion: null, clientFeedback: '', clientActionDueAt: input.clientActionDueAt ? new Date(input.clientActionDueAt) : null });
          eventType = 'APPROVAL_REQUESTED'; summary = `Script v${before.scriptVersion} sent to the Client for approval.`; break;
        case 'REQUEST_CLIENT_FOOTAGE': ensureClientCanAct(before); Object.assign(data, { productionStage: 'CLIENT_INPUT', clientActionDueAt: input.clientActionDueAt ? new Date(input.clientActionDueAt) : null }); break;
        case 'RECORD_SCRIPT_APPROVED':
        case 'RECORD_SCRIPT_CHANGES':
        case 'RECORD_FINAL_APPROVED':
        case 'RECORD_FINAL_CHANGES': {
          const script = input.action.startsWith('RECORD_SCRIPT'), approved = input.action.endsWith('_APPROVED');
          const currentVersion = script ? before.scriptVersion : before.creativeVersion; version(currentVersion);
          const reference = requiredText(input.reference, 'Record where and how the client communicated this decision.');
          if (!approved) requiredText(input.feedback, 'Explain the changes requested by the client.');
          const kind = script ? 'SCRIPT' : 'FINAL';
          const canRelease = script || !approved || before.allowExternalFinalApproval;
          const pending = canRelease ? await tx.approvalRequest.findFirst({ where: { contentItemId: before.id, kind, version: currentVersion, status: 'PENDING' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }) : null;
          await tx.productionApproval.create({ data: { contentItemId: before.id, kind, version: currentVersion, decision: approved ? 'APPROVED' : 'CHANGES_REQUESTED', source: input.source || 'WHATSAPP', reference, feedback: input.feedback || '', origin: 'RECORDED_BY_AGENCY', requestId: pending?.id || null, recordedById: req.user.id } });
          Object.assign(extra, { kind: script ? 'SCRIPT' : 'FINAL', version: currentVersion, reference, source: input.source || 'WHATSAPP', manuallyRecordedByAgency: true });
          if (canRelease) Object.assign(data, decisionChanges(before, kind, approved, input.feedback));
          if (pending) await tx.approvalRequest.update({ where: { id: pending.id }, data: { status: approved ? 'APPROVED' : 'CHANGES_REQUESTED', closedAt: now } });
          eventType = 'PRODUCTION_EXTERNAL_APPROVAL_RECORDED'; summary = `Agency recorded ${script ? 'script' : 'final'} ${approved ? 'approval' : 'changes requested'} for version ${currentVersion}.`;
          if (!canRelease) summary += ' Client portal approval is still required.';
          break;
        }
        case 'RESET_SHOOT': Object.assign(data, { shootStatus: 'NOT_STARTED', shootAt: null, shootCompletedAt: null }); eventType = 'SHOOT_SCHEDULED'; summary = 'Client shoot marked not started.'; break;
        case 'SCHEDULE_SHOOT':
          if (!input.shootAt) throw new HttpError(400, 'Choose the shoot date and time.');
          Object.assign(data, { shootStatus: 'SCHEDULED', shootAt: new Date(input.shootAt), shootCompletedAt: null }); eventType = 'SHOOT_SCHEDULED'; break;
        case 'COMPLETE_SHOOT':
          if (input.occurredAt && new Date(input.occurredAt).getTime() > Date.now() + 60000) throw new HttpError(400, 'A completed shoot cannot be in the future.');
          Object.assign(data, { shootStatus: 'RECORDED', shootCompletedAt: input.occurredAt ? new Date(input.occurredAt) : now }); eventType = 'SHOOT_COMPLETED'; break;
        case 'REPORT_FOOTAGE': {
          const fields = handoffInput.parse(input.handoff || {});
          if (fields.sentAt && new Date(fields.sentAt).getTime() > Date.now() + 60000) throw new HttpError(400, 'A reported send time cannot be in the future.');
          const handoff = await tx.mediaHandoff.create({ data: { ...fields, sentAt: fields.sentAt ? new Date(fields.sentAt) : null, contentItemId: before.id, sequence: before.handoffVersion + 1, reportedById: req.user.id } });
          Object.assign(data, { footageStatus: 'REPORTED_SENT', handoffVersion: handoff.sequence, verifiedFootageVersion: null, clientActionDueAt: null }); Object.assign(extra, { handoffId: handoff.id, sequence: handoff.sequence });
          eventType = 'FOOTAGE_REPORTED_SENT'; summary = 'Footage reported sent in WhatsApp; awaiting Agency verification.'; break;
        }
        case 'VERIFY_FOOTAGE': {
          const handoff = await latestHandoff();
          if (handoff.verificationStatus !== 'REPORTED_SENT') throw new HttpError(409, 'This footage report is no longer pending verification.');
          const verificationNote = requiredText(input.verificationNote, 'Describe the footage checked and why it is usable.');
          await tx.mediaHandoff.update({ where: { id: handoff.id }, data: { verificationStatus: 'VERIFIED_RECEIVED', verificationNote, verifiedById: req.user.id, verifiedAt: now } });
          Object.assign(data, { footageStatus: 'VERIFIED_RECEIVED', verifiedFootageVersion: before.handoffVersion, productionStage: 'PRODUCTION', clientFeedback: '' }); resetFinal();
          Object.assign(extra, { handoffId: handoff.id, sequence: handoff.sequence, verificationNote }); eventType = 'FOOTAGE_VERIFIED'; summary = 'Agency checked the latest footage and confirmed it is received and usable.'; break;
        }
        case 'REQUEST_MORE_FOOTAGE': {
          const handoff = await latestHandoff(), feedback = requiredText(input.feedback, 'Tell the client which clips are missing or need to be recorded again.');
          await tx.mediaHandoff.update({ where: { id: handoff.id }, data: { verificationStatus: 'NEEDS_MORE', verificationNote: input.verificationNote || '', verifiedById: req.user.id, verifiedAt: now } });
          Object.assign(data, { productionStage: 'CLIENT_INPUT', footageStatus: 'NEEDS_MORE', verifiedFootageVersion: null, shootStatus: 'NOT_STARTED', shootAt: null, shootCompletedAt: null, clientFeedback: feedback, clientActionDueAt: input.clientActionDueAt ? new Date(input.clientActionDueAt) : null }); resetFinal();
          await supersedeRequests(tx, before.id, ['FINAL']);
          Object.assign(extra, { handoffId: handoff.id, feedback, verificationNote: input.verificationNote || '' }); eventType = 'FOOTAGE_MORE_REQUESTED'; summary = 'Agency requested missing clips or a reshoot.'; break;
        }
        case 'START_PRODUCTION':
          if (!before.script.trim() && !before.caption.trim() && !(before.idea?.brief || '').trim()) throw new HttpError(409, 'Add a script, copy or brief before starting production.');
          data.productionStage = 'PRODUCTION'; break;
        case 'SUBMIT_INTERNAL_REVIEW': Object.assign(data, { productionStage: 'INTERNAL_REVIEW', qaStatus: 'NOT_STARTED', qaVersion: null }); break;
        case 'QA_PASS': version(before.creativeVersion); Object.assign(data, { qaStatus: 'PASSED', qaVersion: before.creativeVersion, qaNote: input.reason || '' }); break;
        case 'QA_FAIL': version(before.creativeVersion); resetFinal(); Object.assign(data, { qaStatus: 'FAILED', qaNote: requiredText(input.reason, 'Record the corrections needed before QA can pass.'), productionStage: isTextOnly(before) ? 'DRAFTING' : 'PRODUCTION' }); break;
        case 'REQUEST_FINAL_REVIEW':
          ensureClientCanAct(before);
          await createApprovalRequest(tx, before, req.user, 'FINAL', input);
          Object.assign(data, { productionStage: 'CLIENT_FINAL_REVIEW', finalApprovalStatus: 'PENDING', finalApprovedVersion: null, clientFeedback: '', clientActionDueAt: input.clientActionDueAt ? new Date(input.clientActionDueAt) : null });
          eventType = 'APPROVAL_REQUESTED'; summary = `Final creative v${before.creativeVersion} sent to the Client for approval.`; break;
        case 'MARK_READY': data.productionStage = 'READY'; break;
        case 'HOLD': Object.assign(data, { productionStage: 'ON_HOLD', resumeStage: before.productionStage, holdReason: requiredText(input.reason, 'Explain why this item is being paused.') }); eventType = 'PRODUCTION_ON_HOLD'; break;
        case 'RESUME': data.productionStage = before.resumeStage || 'DRAFTING'; data.resumeStage = null; data.holdReason = ''; eventType = 'PRODUCTION_RESUMED'; break;
        case 'REOPEN_DRAFTING': requiredText(input.reason, 'Explain why this item is returning to drafting.'); resetFinal(); Object.assign(data, { productionStage: 'DRAFTING', creativeVersion: before.creativeVersion + 1, clientActionDueAt: null }); await supersedeRequests(tx, before.id); creativeRevision = true; break;
        case 'CANCEL': Object.assign(data, { productionStage: 'CANCELLED', status: 'CANCELLED', resumeStage: null, clientActionDueAt: null, holdReason: requiredText(input.reason, 'Explain why this content item is being cancelled.') }); await supersedeRequests(tx, before.id); eventType = 'PRODUCTION_CANCELLED'; break;
        default: throw new HttpError(400, 'Unknown production action.');
      }
      requireReadyGates({ ...before, ...data }, data.productionStage || before.productionStage);
      await tx.contentItem.update({ where: { id: before.id }, data });
      const item = await findProduction(tx, req.user, before.id);
      if (creativeRevision) await saveRevision(tx, item, 'CREATIVE', req.user.id);
      await contentActivity(tx, req.user, eventType, item, { ...extra, before: { stage: before.productionStage, shootStatus: before.shootStatus, footageStatus: before.footageStatus, scriptVersion: before.scriptVersion, creativeVersion: before.creativeVersion }, after: { stage: item.productionStage, shootStatus: item.shootStatus, footageStatus: item.footageStatus }, reason: input.reason || '', publicSummary: summary });
      return item;
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    // Cancellation makes a shared plan private; Agency can still inspect it.
    res.json({ data: await productionDetails(db, req.user, result) });
  }
  return { details, history, revisions, queue, updateMetadata, act };
}
