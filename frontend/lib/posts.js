export const postFormats = { REEL: 'Reel', CAROUSEL: 'Carousel', STATIC_GRAPHIC: 'Single image', STORY: 'Story' };
export const stageLabels = { DRAFT: 'Draft', CONTENT_REVIEW: 'Content review', WAITING_FOOTAGE: 'Waiting for footage', FOOTAGE_SENT: 'Footage sent', PRODUCTION: 'Production', FINAL_REVIEW: 'Final review', READY: 'Ready to post', PUBLISHED: 'Published', CANCELLED: 'Cancelled' };
export function stageFor(item, state = item) {
  if (item.sheetStage) return item.sheetStage;
  switch (state.productionStage) {
    case 'CLIENT_INPUT': return state.scriptApprovalStatus === 'PENDING' ? 'CONTENT_REVIEW' : state.footageStatus === 'REPORTED_SENT' ? 'FOOTAGE_SENT' : 'WAITING_FOOTAGE';
    case 'PRODUCTION': case 'INTERNAL_REVIEW': return 'PRODUCTION';
    case 'CLIENT_FINAL_REVIEW': return 'FINAL_REVIEW';
    case 'READY': case 'PUBLISHED': case 'CANCELLED': return state.productionStage;
    default: return 'DRAFT';
  }
}
export function stageLabel(item, state = item) {
  const stage = stageFor(item, state);
  if (stage === 'PRODUCTION') return item.contentType === 'REEL' ? 'Editing' : 'Designing';
  if (stage === 'CONTENT_REVIEW' && item.contentType === 'REEL') return 'Script review';
  return stageLabels[stage];
}
export function contentLabel(type) { return type === 'REEL' ? 'Script' : type === 'CAROUSEL' ? 'Slide content' : type === 'STORY' ? 'Story content' : 'Copy and design instructions'; }
export function postActions(item, agency, state = item) {
  if (!item.socialAccount.active || item.socialAccount.client.status !== 'ACTIVE') return [];
  switch (stageFor(item, state)) {
    case 'DRAFT': return agency ? [{ key: 'SEND_CONTENT_REVIEW', label: item.contentType === 'REEL' ? 'Send script for approval' : 'Send content for approval' }] : [];
    case 'CONTENT_REVIEW': return agency ? [] : [{ key: 'REVIEW', label: item.contentType === 'REEL' ? 'Review script' : 'Review content' }];
    case 'WAITING_FOOTAGE': return [{ key: 'REPORT_FOOTAGE', label: 'Mark footage sent' }];
    case 'FOOTAGE_SENT': return agency ? [{ key: 'START_WORK', label: 'Receive clips & start editing' }] : [];
    case 'PRODUCTION': return agency ? [{ key: 'SEND_FINAL_REVIEW', label: 'Send final for approval' }] : [];
    case 'FINAL_REVIEW': return agency ? [] : [{ key: 'REVIEW', label: 'Review final' }];
    case 'READY': return agency ? [{ key: 'MARK_PUBLISHED', label: 'Mark published' }] : [];
    case 'PUBLISHED': return agency ? [{ key: 'METRICS', label: ['likes', 'comments', 'views'].some(field => item[field] != null) ? 'Update performance' : 'Add performance' }] : [];
    default: return [];
  }
}
export const approvalLabel = status => ({ NOT_REQUIRED: '—', NOT_REQUESTED: 'Not sent', PENDING: 'Pending', APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested' }[status] || 'Not sent');

// ---- Simple workflow view -----------------------------------------------------------------------------------
// The rules are unchanged. This only describes where a post is in plain words: which of five steps it is on,
// whose turn it is, and what happens next. Used by the Posts sheet and by the post panel.
export const workflowSteps = ['Draft', 'Client review', 'Production', 'Final approval', 'Published'];
// [steps completed, step in progress (-1 = none)]
const workflowPosition = { DRAFT: [0, 0], CONTENT_REVIEW: [1, 1], WAITING_FOOTAGE: [2, 2], FOOTAGE_SENT: [2, 2], PRODUCTION: [2, 2], FINAL_REVIEW: [3, 3], READY: [4, 4], PUBLISHED: [5, -1], CANCELLED: [0, -1] };
export function workflowInfo(item, agency, state = item) {
  const stage = stageFor(item, state), [done, active] = workflowPosition[stage] || [0, -1];
  const reel = item.contentType === 'REEL', content = reel ? 'script' : 'content', making = reel ? 'Editing' : 'Designing';
  const scriptChanges = state.scriptApprovalStatus === 'CHANGES_REQUESTED', finalChanges = state.finalApprovalStatus === 'CHANGES_REQUESTED';
  const pick = (forAgency, forClient) => agency ? forAgency : forClient;
  let label, turn = 'none', warn = false, hint;
  switch (stage) {
    case 'DRAFT':
      turn = 'agency'; warn = scriptChanges;
      label = scriptChanges ? 'Changes requested' : 'Draft';
      hint = scriptChanges ? `The client asked for changes to the ${content}. Edit it, then send it for approval again.` : `Write the ${content}, then send it to the client for approval.`; break;
    case 'CONTENT_REVIEW':
      turn = 'client'; label = pick(`Client is reviewing the ${content}`, `Approve the ${content}`);
      hint = pick(`The client is reviewing the ${content}. You can continue once they approve it.`, `Please read the ${content}, then approve it or ask for changes.`); break;
    case 'WAITING_FOOTAGE':
      turn = 'client'; label = pick('Waiting for client footage', 'Send your footage');
      hint = pick('The client needs to record the video and send the clips.', 'Record your video and send the clips on WhatsApp, then click Mark footage sent.'); break;
    case 'FOOTAGE_SENT':
      turn = 'agency'; label = pick('Check the footage', 'Footage sent');
      hint = pick('Check the clips. Start editing, or ask for more footage.', 'Thanks. Your agency is checking the clips.'); break;
    case 'PRODUCTION':
      turn = 'agency'; warn = finalChanges; label = finalChanges ? pick('Final needs changes', 'Agency is making changes') : pick(making, 'Agency is working on it');
      hint = pick(finalChanges ? 'The client asked for changes to the final. Update the file, then send it for approval again.' : 'Make the final post, add the file link, then send it for approval.', 'Your agency is working on it. You will be asked to approve the final version.'); break;
    case 'FINAL_REVIEW':
      turn = 'client'; label = pick('Client is reviewing the final', 'Approve the final');
      hint = pick('The client is reviewing the final version.', 'Please review the final post, then approve it or ask for changes.'); break;
    case 'READY':
      turn = 'agency'; label = 'Ready to post';
      hint = pick('Approved. Post it on the platform, then click Mark published.', 'Approved. Your agency will publish it.'); break;
    case 'PUBLISHED': label = 'Published'; hint = 'This post has been published.'; break;
    case 'CANCELLED': label = 'Cancelled'; hint = 'This post was cancelled.'; break;
    default: label = stageLabel(item, state); hint = '';
  }
  // version numbers only matter once there is more than one
  const later = ['PRODUCTION', 'FINAL_REVIEW', 'READY', 'PUBLISHED'].includes(stage);
  const version = later ? state.creativeVersion : state.scriptVersion;
  const versionNote = version > 1 ? (later ? 'Creative' : reel ? 'Script' : 'Content') + ' v' + version : '';
  return { stage, done, active, label, turn, warn, hint, versionNote, cancelled: stage === 'CANCELLED' };
}
// "Your turn" / "Waiting on client", from the point of view of whoever is looking
export function turnChip(info, agency) {
  if (info.turn === 'none') return null;
  const mine = agency ? 'agency' : 'client';
  return info.turn === mine ? { text: 'Your turn', mine: true } : { text: 'Waiting on ' + (agency ? 'client' : 'agency'), mine: false };
}
