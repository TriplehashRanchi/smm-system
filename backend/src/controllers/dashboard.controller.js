import { clientScope, HttpError } from '../access.js';
import { contentScope } from '../services/planning.service.js';
import { sheetSelect, sheetRow, stageFilter, focusFilter } from '../services/post.service.js';
import { dashboardQuery } from '../validation/dashboard.validation.js';

const finished = { productionStage: { notIn: ['PUBLISHED', 'CANCELLED'] } };
// Posts on active accounts of active clients only; optionally one client.
const scopeFor = (user, clientId) => [contentScope(user), { socialAccount: { active: true, client: { status: 'ACTIVE' } } }, ...(clientId ? [{ socialAccount: { clientId } }] : [])];

export function createDashboardController({ db }) {
  async function getDashboard(req, res) {
    const scoped = { ...clientScope(req.user), status: 'ACTIVE' };
    const [clients, accounts, targets, users] = await Promise.all([
      db.client.count({ where: scoped }),
      db.socialAccount.count({ where: { active: true, client: scoped } }),
      db.publishingTarget.aggregate({
        where: { socialAccount: { active: true, client: scoped } },
        _sum: { targetCount: true },
      }),
      req.user.role === 'AGENCY'
        ? db.user.count({ where: { status: 'ACTIVE' } })
        : Promise.resolve(null),
    ]);
    res.json({ data: { clients, accounts, weeklyTarget: targets._sum.targetCount || 0, users } });
  }

  // Agency: what needs attention, where every post is in the pipeline, what goes out soon, and how each client is doing.
  async function agency(req, res) {
    const q = dashboardQuery.parse(req.query), now = new Date(), base = scopeFor(req.user, q.clientId);
    const count = (...extra) => db.contentItem.count({ where: { AND: [...base, ...extra] } });
    const monthFrom = q.monthFrom ? new Date(q.monthFrom) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const stageKeys = Object.keys(stageFilter);
    const byAccount = (...extra) => db.contentItem.groupBy({ by: ['socialAccountId'], where: { AND: [...base, ...extra] }, _count: { _all: true } });
    const [clientRows, overdue, changes, waiting, ready, incomplete, stageCounts, week, openBy, waitingBy, overdueBy, publishedBy, accountRows] = await Promise.all([
      db.client.findMany({ where: { ...clientScope(req.user), status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      count(focusFilter('overdue', now)), count(focusFilter('changes')), count(focusFilter('waiting')), count(stageFilter.READY), count(focusFilter('incomplete')),
      Promise.all(stageKeys.map(key => count(stageFilter[key]))),
      q.from ? db.contentItem.findMany({ where: { AND: [...base, { publishAt: { gte: new Date(q.from), lt: new Date(q.to) } }, { productionStage: { not: 'CANCELLED' } }] }, select: sheetSelect('AGENCY'), orderBy: [{ publishAt: 'asc' }, { id: 'asc' }], take: 80 }) : Promise.resolve([]),
      byAccount(finished), byAccount(focusFilter('waiting')), byAccount(focusFilter('overdue', now)), byAccount({ productionStage: 'PUBLISHED', publishedAt: { gte: monthFrom } }),
      db.socialAccount.findMany({ where: { active: true, client: { ...clientScope(req.user), status: 'ACTIVE', ...(q.clientId ? { id: q.clientId } : {}) } }, select: { id: true, clientId: true } }),
    ]);
    const owner = new Map(accountRows.map(account => [account.id, account.clientId])), perClient = new Map();
    const row = id => { if (!perClient.has(id)) perClient.set(id, { accounts: 0, inProgress: 0, waiting: 0, overdue: 0, published: 0 }); return perClient.get(id); };
    accountRows.forEach(account => { row(account.clientId).accounts += 1; });
    for (const [list, key] of [[openBy, 'inProgress'], [waitingBy, 'waiting'], [overdueBy, 'overdue'], [publishedBy, 'published']]) for (const entry of list) { const clientId = owner.get(entry.socialAccountId); if (clientId) row(clientId)[key] += entry._count._all; }
    const clients = clientRows.filter(client => !q.clientId || client.id === q.clientId).map(client => ({ ...client, ...row(client.id) }))
      .sort((a, b) => (b.overdue * 3 + b.waiting) - (a.overdue * 3 + a.waiting) || a.name.localeCompare(b.name)).slice(0, 100);
    res.json({ data: {
      clientOptions: clientRows, attention: { overdue, changes, waiting, ready, incomplete },
      stages: Object.fromEntries(stageKeys.map((key, index) => [key, stageCounts[index]])), week: week.map(sheetRow), clients,
    } });
  }

  // Client: what is waiting for them, what is coming up, how the month is going, and their accounts.
  async function client(req, res) {
    if (req.user.role !== 'CLIENT') throw new HttpError(403, 'This dashboard is for Client users.');
    const q = dashboardQuery.parse(req.query), now = new Date(), base = scopeFor(req.user), inside = { contentItem: { AND: base } };
    const count = (...extra) => db.contentItem.count({ where: { AND: [...base, ...extra] } });
    const monthFrom = q.monthFrom ? new Date(q.monthFrom) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), monthTo = q.monthTo ? new Date(q.monthTo) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const inMonth = { publishAt: { gte: monthFrom, lt: monthTo } };
    const [scripts, finals, footage, pending, footagePosts, upcoming, planned, readyMonth, publishedMonth, accounts] = await Promise.all([
      db.approvalRequest.count({ where: { status: 'PENDING', kind: 'SCRIPT', ...inside } }), db.approvalRequest.count({ where: { status: 'PENDING', kind: 'FINAL', ...inside } }), count(stageFilter.WAITING_FOOTAGE),
      db.approvalRequest.findMany({ where: { status: 'PENDING', ...inside }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 8, select: { id: true, kind: true, version: true, title: true, createdAt: true, dueAt: true, contentItem: { select: { id: true, contentType: true, socialAccount: { select: { id: true, platform: true, handle: true, timezone: true } } } } } }),
      db.contentItem.findMany({ where: { AND: [...base, stageFilter.WAITING_FOOTAGE] }, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 5, select: { id: true, title: true, contentType: true, publishAt: true, socialAccount: { select: { id: true, platform: true, handle: true, timezone: true } } } }),
      q.from ? db.contentItem.findMany({ where: { AND: [...base, { publishAt: { gte: new Date(q.from), lt: new Date(q.to) } }, { productionStage: { not: 'CANCELLED' } }] }, select: sheetSelect('CLIENT'), orderBy: [{ publishAt: 'asc' }, { id: 'asc' }], take: 60 }) : Promise.resolve([]),
      count(inMonth, { productionStage: { not: 'CANCELLED' } }), count(inMonth, stageFilter.READY), count({ productionStage: 'PUBLISHED', publishedAt: { gte: monthFrom, lt: monthTo } }),
      db.socialAccount.findMany({ where: { client: { ...clientScope(req.user), status: 'ACTIVE' } }, orderBy: [{ platform: 'asc' }, { handle: 'asc' }], select: { id: true, clientId: true, platform: true, handle: true, active: true, timezone: true } }),
    ]);
    res.json({ data: {
      actions: { scripts, finals, footage, total: scripts + finals + footage, approvals: pending, footagePosts },
      upcoming: upcoming.map(sheetRow), month: { planned, ready: readyMonth, published: publishedMonth }, accounts,
    } });
  }

  return { getDashboard, agency, client };
}
