export { addDays, calendarRange, localDateTime, weekStart, zonedInstant } from '../../shared/planning-time.js';
export const contentFormats = ['REEL', 'CAROUSEL', 'STATIC_GRAPHIC', 'STORY', 'LINKEDIN_TEXT', 'DOCUMENT_POST', 'OTHER'];
export const planningStatuses = ['DRAFT', 'TENTATIVE', 'IN_PROGRESS', 'APPROVED', 'CANCELLED'];
export const planningLabels = { DRAFT: 'Agency draft', TENTATIVE: 'Tentative', IN_PROGRESS: 'In progress', APPROVED: 'Approved', CANCELLED: 'Cancelled', LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent', SHOOT: 'Shoot', CAMPAIGN: 'Campaign', HOLIDAY: 'Holiday', OTHER: 'Other' };
export async function allPlanningPages(api, path, params = {}) {
  const data = [];
  let page = 1, total = 0;
  do {
    const result = await api(`${path}?${new URLSearchParams({ ...params, page: String(page++), pageSize: '100' })}`);
    if (!result.data.length && data.length < result.total) throw new Error('The plan changed while loading. Refresh to get the latest posts.');
    data.push(...result.data); total = result.total;
  } while (data.length < total);
  return data;
}
export function showDate(value, timeZone = 'UTC') {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-IN', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
export function showDay(day) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${day}T12:00:00Z`));
}
