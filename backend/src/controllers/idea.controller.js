import { HttpError } from '../access.js';
import { ideaInput, ideaUpdate, planningQuery } from '../validation/planning.validation.js';
import { activePlanningClient, checkVersion, contentSelect } from '../services/planning.service.js';
import { recordActivity } from '../services/audit.service.js';

export function createIdeaController({ db }) {
  async function listIdeas(req, res) {
    const { clientId, search, page, pageSize } = planningQuery.parse(req.query);
    const where = { ...(clientId ? { clientId } : {}), ...(search ? { title: { contains: search } } : {}) };
    const [data, total] = await Promise.all([
      db.contentIdea.findMany({ where, include: { client: { select: { id: true, name: true, status: true } }, _count: { select: { items: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      db.contentIdea.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  }
  async function getIdea(req, res) {
    const data = await db.contentIdea.findUnique({ where: { id: req.params.id }, include: { client: { select: { id: true, name: true, status: true } }, items: { select: contentSelect('AGENCY'), orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } });
    if (!data) throw new HttpError(404, 'Content idea not found.');
    res.json({ data });
  }
  async function createIdea(req, res) {
    const input = ideaInput.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      await activePlanningClient(tx, input.clientId);
      const idea = await tx.contentIdea.create({ data: { ...input, createdById: req.user.id } });
      await recordActivity(tx, req.user, 'CONTENT_IDEA_CREATED', { ideaId: idea.id, title: idea.title }, idea.clientId);
      return idea;
    });
    res.status(201).json({ data });
  }
  async function updateIdea(req, res) {
    const { updatedAt, ...input } = ideaUpdate.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const before = await tx.contentIdea.findUnique({ where: { id: req.params.id } });
      if (!before) throw new HttpError(404, 'Content idea not found.');
      await activePlanningClient(tx, before.clientId);
      checkVersion(before, updatedAt);
      const idea = await tx.contentIdea.update({ where: { id: before.id }, data: input });
      await recordActivity(tx, req.user, 'CONTENT_IDEA_UPDATED', { ideaId: idea.id, before: { title: before.title, brief: before.brief, notes: before.notes, bucket: before.bucket, campaign: before.campaign }, after: input }, idea.clientId);
      return idea;
    }, { isolationLevel: 'Serializable' });
    res.json({ data });
  }
  return { listIdeas, getIdea, createIdea, updateIdea };
}
