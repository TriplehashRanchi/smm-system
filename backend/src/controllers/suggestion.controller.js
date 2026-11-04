import { clientScope, HttpError } from '../access.js';
import { suggestionInput, suggestionReview, suggestionQuery } from '../validation/suggestion.validation.js';
import { findClient } from '../services/client.service.js';
import { recordActivity } from '../services/audit.service.js';
import { checkVersion } from '../services/planning.service.js';
const selection = { id: true, title: true, body: true, status: true, response: true, createdAt: true, updatedAt: true, client: { select: { id: true, name: true, timezone: true } }, createdBy: { select: { name: true } }, reviewedBy: { select: { name: true } } };
export function createSuggestionController({ db }) {
  async function list(req, res) {
    const q = suggestionQuery.parse(req.query), where = { client: clientScope(req.user), ...(q.clientId ? { clientId: q.clientId } : {}), ...(req.user.role === 'CLIENT' ? { createdById: req.user.id } : {}) };
    const [data, total] = await Promise.all([db.contentSuggestion.findMany({ where, select: selection, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }), db.contentSuggestion.count({ where })]);
    res.json({ data, total, page: q.page, pageSize: q.pageSize });
  }
  async function create(req, res) {
    if (req.user.role !== 'CLIENT') throw new HttpError(403, 'Client suggestions must be submitted from a Client login.');
    const input = suggestionInput.parse(req.body);
    const data = await db.$transaction(async tx => {
      const client = await findClient(tx, req.user, input.clientId);
      if (client.status !== 'ACTIVE') throw new HttpError(409, 'Contact your agency before submitting suggestions for an archived business.');
      const suggestion = await tx.contentSuggestion.create({ data: { ...input, createdById: req.user.id }, select: selection });
      await recordActivity(tx, req.user, 'CLIENT_SUGGESTION_SUBMITTED', { suggestionId: suggestion.id, title: suggestion.title }, input.clientId);
      return suggestion;
    });
    res.status(201).json({ data });
  }
  async function review(req, res) {
    const { updatedAt, ...input } = suggestionReview.parse(req.body);
    const data = await db.$transaction(async tx => {
      const before = await tx.contentSuggestion.findUnique({ where: { id: req.params.id } });
      if (!before) throw new HttpError(404, 'Suggestion not found.');
      checkVersion(before, updatedAt);
      const updated = await tx.contentSuggestion.update({ where: { id: before.id }, data: { ...input, reviewedById: req.user.id }, select: selection });
      await recordActivity(tx, req.user, 'CLIENT_SUGGESTION_REVIEWED', { suggestionId: before.id, status: input.status, response: input.response }, before.clientId);
      return updated;
    }, { isolationLevel: 'Serializable' });
    res.json({ data });
  }
  return { list, create, review };
}
