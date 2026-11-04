export const productionStages = ['PLANNED', 'DRAFTING', 'CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY', 'ON_HOLD', 'CANCELLED'];
export const productionLabels = {
  SUPERSEDED: 'Replaced by a newer review',
  PLANNED: 'Planned', DRAFTING: 'Drafting', CLIENT_INPUT: 'Waiting for client', PRODUCTION: 'Production', INTERNAL_REVIEW: 'Internal QA', CLIENT_FINAL_REVIEW: 'Client final review', READY: 'Ready', ON_HOLD: 'On hold', CANCELLED: 'Cancelled',
  NOT_REQUIRED: 'Not required', NOT_REQUESTED: 'Not requested', PENDING: 'Pending', APPROVED: 'Approved', CHANGES_REQUESTED: 'Changes requested', NOT_STARTED: 'Not started',
  SCHEDULED: 'Scheduled', RECORDED: 'Recorded', NOT_SENT: 'Not sent', REPORTED_SENT: 'Reported sent — unverified', VERIFIED_RECEIVED: 'Verified received & usable', NEEDS_MORE: 'Missing clips / reshoot needed', PASSED: 'Passed', FAILED: 'Corrections needed',
  AGENCY: 'Agency', CLIENT: 'Client', NONE: 'No action while paused / cancelled', GROUP: 'WhatsApp group', DM: 'WhatsApp direct message',
};
export const isApprovalAction = (action) => action?.startsWith('RECORD_SCRIPT_') || action?.startsWith('RECORD_FINAL_');
