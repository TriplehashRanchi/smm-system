import { clientScope, HttpError } from '../access.js';
import { planningAccountSelect, personSelect, visiblePlanningStatuses } from '../services/planning.service.js';
import { targetsQuery } from '../validation/planning.validation.js';
import { addDays, weekStart, zonedInstant } from '../../../shared/planning-time.js';

export function createPlanningController({ db }) {
  async function options(req, res) {
    const [clients, owners] = await Promise.all([
      db.client.findMany({ where: clientScope(req.user), select: { id: true, name: true, timezone: true, status: true, socialAccounts: { select: planningAccountSelect, orderBy: { handle: 'asc' } } }, orderBy: { name: 'asc' } }),
      req.user.role === 'AGENCY' ? db.user.findMany({ where: { role: 'AGENCY', status: 'ACTIVE' }, select: personSelect, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    ]);
    res.json({ data: { clients, owners } });
  }
  async function targets(req, res) {
    const query = targetsQuery.parse(req.query);
    const start = weekStart(query.week);
    const accounts = await db.socialAccount.findMany({ where: {
      active: true, client: { ...clientScope(req.user), status: 'ACTIVE', ...(query.clientId ? { id: query.clientId } : {}) },
    }, select: { ...planningAccountSelect, publishingTargets: true }, orderBy: [{ clientId: 'asc' }, { handle: 'asc' }] });
    if (!accounts.length) return res.json({ data: [], week: start });
    const ranges = new Map(accounts.map((account) => [account.id, {
      from: new Date(zonedInstant(`${start}T00:00`, account.timezone)), to: new Date(zonedInstant(`${addDays(start, 7)}T00:00`, account.timezone)),
    }]));
    const from = new Date(Math.min(...[...ranges.values()].map((range) => range.from.getTime())));
    const to = new Date(Math.max(...[...ranges.values()].map((range) => range.to.getTime())));
    const posts = await db.contentItem.findMany({ where: {
      socialAccountId: { in: accounts.map((account) => account.id) }, publishAt: { gte: from, lt: to },
      status: req.user.role === 'AGENCY' ? { not: 'CANCELLED' } : { in: visiblePlanningStatuses },
    }, select: { socialAccountId: true, contentType: true, publishAt: true } });
    const data = accounts.map((account) => {
      const range = ranges.get(account.id);
      const own = posts.filter((post) => post.socialAccountId === account.id && post.publishAt >= range.from && post.publishAt < range.to);
      return { ...account, weekStart: start, weekEnd: addDays(start, 7), planned: own.length,
        commitments: account.publishingTargets.map((target) => ({ contentType: target.contentType, target: target.targetCount, planned: target.contentType === 'ALL' ? own.length : own.filter((post) => post.contentType === target.contentType).length })),
      };
    });
    res.json({ data, week: start });
  }
  return { options, targets };
}
