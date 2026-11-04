import { contentScope } from '../services/planning.service.js';

// What each side wants to hear about when the OTHER side changes a post. Your own actions are never echoed back.
const interesting = {
  AGENCY: ['CLIENT_APPROVAL_DECISION', 'FOOTAGE_REPORTED_SENT'],
  CLIENT: ['APPROVAL_REQUESTED', 'FOOTAGE_VERIFIED', 'FOOTAGE_MORE_REQUESTED', 'POST_PUBLISHED', 'PRODUCTION_CANCELLED'],
};

export function createNotificationController({ db }) {
  // GET /notifications           -> { data: [], cursor }   (first call: just learn the server time, so nothing old is replayed)
  // GET /notifications?since=iso -> events after that moment, oldest first, and the cursor to use next time
  async function list(req, res) {
    if (!req.query.since) return res.json({ data: [], cursor: new Date().toISOString() });
    const asked = new Date(String(req.query.since));
    const since = Number.isNaN(asked.getTime()) ? new Date() : new Date(Math.max(asked.getTime(), Date.now() - 24 * 3600 * 1000));
    const events = await db.activityEvent.findMany({
      where: { createdAt: { gt: since }, actorId: { not: req.user.id }, contentItemId: { not: null }, eventType: { in: interesting[req.user.role] || [] }, contentItem: contentScope(req.user) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 20,
      select: { id: true, eventType: true, details: true, createdAt: true, actor: { select: { name: true } }, contentItem: { select: { id: true, title: true } } },
    });
    const data = events.filter(event => event.contentItem).map(event => ({
      id: event.id, eventType: event.eventType, createdAt: event.createdAt, actor: event.actor.name, postId: event.contentItem.id, title: event.contentItem.title,
      message: event.details?.publicSummary || 'Status updated.',
      tone: event.details?.decision === 'CHANGES_REQUESTED' || event.eventType === 'FOOTAGE_MORE_REQUESTED' || event.eventType === 'PRODUCTION_CANCELLED' ? 'warning' : event.details?.decision === 'APPROVED' || event.eventType === 'POST_PUBLISHED' ? 'success' : 'info',
    }));
    res.json({ data, cursor: events.length ? events.at(-1).createdAt.toISOString() : since.toISOString() });
  }
  return { list };
}
