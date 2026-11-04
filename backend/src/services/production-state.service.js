import { HttpError } from '../access.js';

export const productionFields = {
  productionStage: true, resumeStage: true, requiresScriptApproval: true, requiresFootage: true, requiresFinalApproval: true,
  scriptVersion: true, creativeVersion: true, scriptApprovalStatus: true, scriptApprovedVersion: true,
  finalApprovalStatus: true, finalApprovedVersion: true, shootStatus: true, shootAt: true, shootCompletedAt: true,
  footageStatus: true, handoffVersion: true, verifiedFootageVersion: true, qaStatus: true, qaVersion: true,
  qaNote: true, creativeReference: true, internalProductionNotes: true, clientFeedback: true, holdReason: true,
  allowExternalFinalApproval: true, clientActionDueAt: true,
};
export function productionDefaults(format, status = 'DRAFT') {
  const reel = format === 'REEL';
  return {
    productionStage: status === 'CANCELLED' ? 'CANCELLED' : 'PLANNED',
    requiresScriptApproval: true, requiresFootage: reel, requiresFinalApproval: true,
    scriptApprovalStatus: 'NOT_REQUESTED', finalApprovalStatus: 'NOT_REQUESTED',
    shootStatus: reel ? 'NOT_STARTED' : 'NOT_REQUIRED', footageStatus: reel ? 'NOT_SENT' : 'NOT_REQUIRED',
  };
}
export const scriptPassed = (item) => !item.requiresScriptApproval || item.scriptApprovalStatus === 'APPROVED' && item.scriptApprovedVersion === item.scriptVersion;
export const footagePassed = (item) => !item.requiresFootage || item.footageStatus === 'VERIFIED_RECEIVED' && item.handoffVersion > 0 && item.verifiedFootageVersion === item.handoffVersion;
export const qaPassed = (item) => item.qaStatus === 'PASSED' && item.qaVersion === item.creativeVersion;
export const finalPassed = (item) => !item.requiresFinalApproval || item.finalApprovalStatus === 'APPROVED' && item.finalApprovedVersion === item.creativeVersion;
export const isTextOnly = (item) => item.contentType === 'LINKEDIN_TEXT';

export function nextProductionAction(item) {
  switch (item.productionStage) {
    case 'PLANNED': return { actor: 'AGENCY', text: item.ownerId ? 'Start drafting the script or copy.' : 'Assign an Agency owner, then start drafting.' };
    case 'DRAFTING': return { actor: 'AGENCY', text: !scriptPassed(item) ? 'Prepare the script and request its approval.' : isTextOnly(item) ? 'Finish the copy and submit it for internal QA.' : 'Prepare the content and start production.' };
    case 'CLIENT_INPUT':
      if (!scriptPassed(item)) return { actor: 'CLIENT', text: 'Review the current script here, then approve it or request changes.' };
      if (item.footageStatus === 'REPORTED_SENT') return { actor: 'AGENCY', text: 'Check the reported WhatsApp clips and verify they are received and usable.' };
      return { actor: 'CLIENT', text: item.shootStatus === 'RECORDED' ? 'Send clips in WhatsApp, then report footage sent here.' : item.shootStatus === 'SCHEDULED' ? 'Complete the scheduled shoot, then mark it recorded.' : 'Schedule and complete the shoot.' };
    case 'PRODUCTION': return { actor: 'AGENCY', text: 'Edit or design the creative, add its reference, then submit for internal QA.' };
    case 'INTERNAL_REVIEW': return { actor: 'AGENCY', text: !qaPassed(item) ? 'Review the current creative and record QA passed or corrections needed.' : item.requiresFinalApproval ? 'Request client final review of this creative version.' : 'All checks passed; mark this item ready.' };
    case 'CLIENT_FINAL_REVIEW': return { actor: 'CLIENT', text: 'Review the final creative version and caption, then approve or request changes here.' };
    case 'READY': return { actor: 'AGENCY', text: 'Ready for manual publishing.' };
    case 'PUBLISHED': return { actor: 'NONE', text: 'Published manually. Publication details are recorded.' };
    case 'ON_HOLD': return { actor: 'NONE', text: 'Paused. The Agency must resume this item before work continues.' };
    default: return { actor: 'NONE', text: 'Cancelled. Its references and history are retained.' };
  }
}

const definitions = [
  ['START_DRAFTING', 'Start drafting', ['PLANNED']],
  ['REQUEST_SCRIPT_APPROVAL', 'Send script for client approval', ['DRAFTING']],
  ['REQUEST_CLIENT_FOOTAGE', 'Ask client to shoot / send footage', ['DRAFTING']],
  ['RECORD_SCRIPT_APPROVED', 'Record external script approval', ['CLIENT_INPUT']],
  ['RECORD_SCRIPT_CHANGES', 'Record requested script changes', ['CLIENT_INPUT']],
  ['SCHEDULE_SHOOT', 'Schedule shoot', ['CLIENT_INPUT'], true],
  ['RESET_SHOOT', 'Mark shoot not started', ['CLIENT_INPUT'], true],
  ['COMPLETE_SHOOT', 'Mark shoot completed', ['CLIENT_INPUT'], true],
  ['REPORT_FOOTAGE', 'Report footage sent in WhatsApp', ['CLIENT_INPUT'], true],
  ['VERIFY_FOOTAGE', 'Verify received and usable', ['CLIENT_INPUT']],
  ['REQUEST_MORE_FOOTAGE', 'Request missing clips / reshoot', ['CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY']],
  ['START_PRODUCTION', 'Start production', ['DRAFTING']],
  ['SUBMIT_INTERNAL_REVIEW', 'Submit for internal QA', ['DRAFTING', 'PRODUCTION']],
  ['QA_PASS', 'Mark internal QA passed', ['INTERNAL_REVIEW']],
  ['QA_FAIL', 'Return for corrections', ['INTERNAL_REVIEW']],
  ['REQUEST_FINAL_REVIEW', 'Send final version for client approval', ['INTERNAL_REVIEW']],
  ['RECORD_FINAL_APPROVED', 'Record external final approval', ['CLIENT_FINAL_REVIEW']],
  ['RECORD_FINAL_CHANGES', 'Record requested final changes', ['CLIENT_FINAL_REVIEW']],
  ['MARK_READY', 'Mark ready', ['INTERNAL_REVIEW']],
  ['HOLD', 'Put on hold', ['PLANNED', 'DRAFTING', 'CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY']],
  ['RESUME', 'Resume work', ['ON_HOLD']],
  ['REOPEN_DRAFTING', 'Return to drafting', ['PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY']],
  ['CANCEL', 'Cancel production', ['PLANNED', 'DRAFTING', 'CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY', 'ON_HOLD']],
];
export const productionActionKeys = definitions.map(([key]) => key);
export function actionDefinition(key) { return definitions.find(([action]) => action === key); }
export function actionProblem(item, action, role) {
  const definition = actionDefinition(action);
  if (!definition || role !== 'AGENCY' && !definition[3]) return 'This action is available only to Agency users.';
  if (!definition[2].includes(item.productionStage)) return 'This action is not available at the current production stage.';
  if (['CANCEL', 'HOLD', 'REOPEN_DRAFTING'].includes(action)) return null;
  if (action === 'RESUME') return null;
  if (['START_DRAFTING', 'START_PRODUCTION', 'SUBMIT_INTERNAL_REVIEW'].includes(action) && !item.ownerId) return 'Assign an Agency owner in the post settings first.';
  if (action === 'REQUEST_SCRIPT_APPROVAL') {
    if (!item.requiresScriptApproval) return 'A separate script approval is not required for this workflow.';
    if (!item.script.trim()) return 'Add the script before requesting review.';
  }
  if (action === 'REQUEST_CLIENT_FOOTAGE' && (!item.requiresFootage || !scriptPassed(item) || footagePassed(item))) return 'Client footage is either not required, already verified, or waiting for current-script approval.';
  if (['RECORD_SCRIPT_APPROVED', 'RECORD_SCRIPT_CHANGES'].includes(action) && (!item.requiresScriptApproval || item.scriptApprovalStatus !== 'PENDING')) return 'Request review of the current script first.';
  if (['SCHEDULE_SHOOT', 'RESET_SHOOT', 'COMPLETE_SHOOT', 'REPORT_FOOTAGE', 'VERIFY_FOOTAGE', 'REQUEST_MORE_FOOTAGE'].includes(action)) {
    if (!item.requiresFootage) return 'This content format does not require client footage.';
    if (!scriptPassed(item)) return 'The current script must be approved before shooting or footage handoff.';
    if (['SCHEDULE_SHOOT', 'RESET_SHOOT', 'COMPLETE_SHOOT'].includes(action) && item.footageStatus === 'REPORTED_SENT') return 'Wait for the Agency to verify the current footage report.';
    if (action === 'COMPLETE_SHOOT' && item.shootStatus === 'RECORDED') return 'This shoot is already marked completed.';
    if (action === 'REPORT_FOOTAGE' && item.shootStatus !== 'RECORDED') return 'Mark the shoot completed before reporting footage sent.';
    if (action === 'VERIFY_FOOTAGE' && item.footageStatus !== 'REPORTED_SENT') return 'A current footage report is required before verification.';
    if (action === 'REQUEST_MORE_FOOTAGE' && !['REPORTED_SENT', 'VERIFIED_RECEIVED'].includes(item.footageStatus)) return 'There is no reported footage to verify or return.';
  }
  if (['START_PRODUCTION', 'SUBMIT_INTERNAL_REVIEW', 'QA_PASS', 'REQUEST_FINAL_REVIEW', 'RECORD_FINAL_APPROVED', 'MARK_READY'].includes(action)) {
    if (!scriptPassed(item)) return 'Approval of the current script is required.';
    if (!footagePassed(item)) return 'The Agency must verify the latest footage as received and usable first.';
  }
  if (action === 'START_PRODUCTION' && isTextOnly(item)) return 'Text-only content goes directly from drafting to internal QA.';
  if (action === 'SUBMIT_INTERNAL_REVIEW') {
    if (!isTextOnly(item) && item.productionStage !== 'PRODUCTION') return 'Visual content must complete its production stage first.';
    if (isTextOnly(item) ? !item.script.trim() && !item.caption.trim() : !item.creativeReference.trim()) return isTextOnly(item) ? 'Add the final text before internal QA.' : 'Add a reference describing the final creative before internal QA.';
  }
  if (['REQUEST_FINAL_REVIEW', 'RECORD_FINAL_APPROVED', 'MARK_READY'].includes(action) && !qaPassed(item)) return 'Internal QA must pass for the current creative version.';
  if (action === 'REQUEST_FINAL_REVIEW' && !item.requiresFinalApproval) return 'This workflow does not require final client review. Mark ready after QA.';
  if (['RECORD_FINAL_APPROVED', 'RECORD_FINAL_CHANGES'].includes(action) && (!item.requiresFinalApproval || item.finalApprovalStatus !== 'PENDING')) return 'Request review of the current final version first.';
  if (action === 'MARK_READY' && !finalPassed(item)) return 'The Client must approve the current final version first.';
  return null;
}
export function availableProductionActions(item, role) {
  return definitions.filter(([, , stages, client]) => stages.includes(item.productionStage) && (role === 'AGENCY' || client)).map(([key, label]) => ({ key, label, blocked: actionProblem(item, key, role) }));
}
export function requireReadyGates(item, stage) {
  if (['PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY'].includes(stage) && (!scriptPassed(item) || !footagePassed(item))) throw new HttpError(409, 'Required script or footage checks are incomplete. Return to drafting or client input.');
  if (['CLIENT_FINAL_REVIEW', 'READY'].includes(stage) && !qaPassed(item)) throw new HttpError(409, 'Current-version internal QA is incomplete.');
  if (stage === 'READY' && !finalPassed(item)) throw new HttpError(409, 'Current-version final approval is incomplete.');
}

export function materialProductionChanges(before, input) {
  if (before.productionStage === 'PUBLISHED') throw new HttpError(409, 'Published posts are read-only. Create a new post for new content.');
  if (before.productionStage === 'CANCELLED') throw new HttpError(409, 'Cancelled content is read-only. Repurpose it into a fresh draft instead.');
  if (input.status === 'CANCELLED') throw new HttpError(409, 'Cancel from Production details so a reason is recorded.');
  const formatChanged = 'contentType' in input && input.contentType !== before.contentType;
  if (formatChanged && !['PLANNED', 'DRAFTING'].includes(before.productionStage)) throw new HttpError(409, 'Return this item to drafting before changing its format.');
  const scriptChanged = ['script', 'contentType', 'socialAccountId'].some((key) => key in input && input[key] !== before[key]);
  const materialChanged = scriptChanged || ['caption', 'title'].some((key) => key in input && input[key] !== before[key]);
  const data = {};
  if (formatChanged) Object.assign(data, productionDefaults(input.contentType, input.status || before.status), { productionStage: before.productionStage });
  if (materialChanged) {
    Object.assign(data, { creativeVersion: before.creativeVersion + 1, qaStatus: 'NOT_STARTED', qaVersion: null, finalApprovalStatus: (data.requiresFinalApproval ?? before.requiresFinalApproval) ? 'NOT_REQUESTED' : 'NOT_REQUIRED', finalApprovedVersion: null });
    if (['PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY'].includes(before.productionStage)) data.productionStage = scriptChanged || isTextOnly({ ...before, ...input }) ? 'DRAFTING' : 'PRODUCTION';
    if (before.productionStage === 'ON_HOLD') data.resumeStage = 'DRAFTING';
    if (before.status === 'APPROVED') data.status = input.status === 'DRAFT' ? 'DRAFT' : 'IN_PROGRESS';
  }
  if (scriptChanged) {
    Object.assign(data, { scriptVersion: before.scriptVersion + 1, scriptApprovalStatus: (data.requiresScriptApproval ?? before.requiresScriptApproval) ? 'NOT_REQUESTED' : 'NOT_REQUIRED', scriptApprovedVersion: null });
    if (before.requiresFootage || data.requiresFootage) Object.assign(data, { verifiedFootageVersion: null, shootAt: null, shootCompletedAt: null, shootStatus: (data.requiresFootage ?? before.requiresFootage) ? 'NOT_STARTED' : 'NOT_REQUIRED', footageStatus: (data.requiresFootage ?? before.requiresFootage) ? 'NOT_SENT' : 'NOT_REQUIRED' });
    if (before.productionStage === 'CLIENT_INPUT') data.productionStage = 'DRAFTING';
  }
  const merged = { ...before, ...input, ...data };
  if (materialChanged && (scriptChanged || before.productionStage === 'CLIENT_FINAL_REVIEW' || before.resumeStage === 'CLIENT_FINAL_REVIEW')) data.clientActionDueAt = null;
  if (input.status === 'APPROVED' && before.productionStage !== 'READY') throw new HttpError(409, 'Record the current final approval in Production details before marking the plan approved.');
  if (merged.status === 'DRAFT' && ['CLIENT_INPUT', 'CLIENT_FINAL_REVIEW'].includes(merged.productionStage)) throw new HttpError(409, 'Return to drafting before hiding a post awaiting client action.');
  if (!merged.ownerId && !['PLANNED', 'DRAFTING', 'ON_HOLD'].includes(merged.productionStage)) throw new HttpError(409, 'An Agency owner is required for work in production.');
  return { data, scriptChanged, materialChanged };
}
export async function saveRevision(db, item, kind, actorId) {
  return db.contentRevision.create({ data: { contentItemId: item.id, kind, version: kind === 'SCRIPT' ? item.scriptVersion : item.creativeVersion, script: item.script, caption: item.caption, creativeReference: item.creativeReference || '', createdById: actorId } });
}
