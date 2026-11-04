import { listInput } from '../validation.js';
import { findClient } from '../services/client.service.js';

export function createActivityController({ db }) {
  async function listActivity(req, res) {
    await findClient(db, req.user, req.params.id);
    const { page, pageSize } = listInput.parse(req.query);
    const data = await db.activityEvent.findMany({
      where: { clientId: req.params.id },
      select: {
        id: true, eventType: true, details: true, createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
    });
    res.json({ data, page, pageSize });
  }

  return { listActivity };
}
