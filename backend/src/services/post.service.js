import { contentSelect } from './planning.service.js';
export const sheetStateFields = {
  requiresFootage: true, scriptApprovalStatus: true, scriptVersion: true, scriptApprovedVersion: true,
  finalApprovalStatus: true, creativeVersion: true, finalApprovedVersion: true,
  footageStatus: true, creativeReference: true, clientFeedback: true,
};
export function sheetSelect(role) { return { ...contentSelect(role), ...sheetStateFields }; }
export function sheetStage(item) {
  switch(item.productionStage) {
    case 'CLIENT_INPUT': return item.scriptApprovalStatus === 'PENDING' ? 'CONTENT_REVIEW' : item.footageStatus === 'REPORTED_SENT' ? 'FOOTAGE_SENT' : 'WAITING_FOOTAGE';
    case 'PRODUCTION': case 'INTERNAL_REVIEW': return 'PRODUCTION';
    case 'CLIENT_FINAL_REVIEW': return 'FINAL_REVIEW';
    case 'READY': case 'PUBLISHED': case 'CANCELLED': return item.productionStage;
    default: return 'DRAFT';
  }
}
export function sheetRow(item) { return { ...item, sheetStage: sheetStage(item) }; }
export const stageFilter = {
  DRAFT: { productionStage: { in: ['PLANNED', 'DRAFTING'] } },
  CONTENT_REVIEW: { productionStage: 'CLIENT_INPUT', scriptApprovalStatus: 'PENDING' },
  WAITING_FOOTAGE: { productionStage: 'CLIENT_INPUT', scriptApprovalStatus: { not: 'PENDING' }, footageStatus: { not: 'REPORTED_SENT' } },
  FOOTAGE_SENT: { productionStage: 'CLIENT_INPUT', footageStatus: 'REPORTED_SENT' },
  PRODUCTION: { productionStage: { in: ['PRODUCTION', 'INTERNAL_REVIEW'] } },
  FINAL_REVIEW: { productionStage: 'CLIENT_FINAL_REVIEW' }, READY: { productionStage: 'READY' },
  PUBLISHED: { productionStage: 'PUBLISHED' }, CANCELLED: { productionStage: 'CANCELLED' },
};

// Named groups the dashboards link to. One definition, so a dashboard number always matches the list behind it.
const closed = ['PUBLISHED', 'CANCELLED', 'ON_HOLD'];
export const focusNames = ['overdue', 'changes', 'waiting', 'incomplete'];
export function focusFilter(name, now = new Date()) {
  switch (name) {
    case 'overdue': return { publishAt: { lt: now }, productionStage: { notIn: closed } };
    case 'changes': return { productionStage: { notIn: closed }, OR: [{ scriptApprovalStatus: 'CHANGES_REQUESTED' }, { finalApprovalStatus: 'CHANGES_REQUESTED' }] };
    case 'waiting': return { OR: [stageFilter.CONTENT_REVIEW, stageFilter.WAITING_FOOTAGE, stageFilter.FINAL_REVIEW] };
    case 'incomplete': return { AND: [stageFilter.DRAFT, { OR: [{ script: '' }, { publishAt: null }] }] };
    default: return {};
  }
}
