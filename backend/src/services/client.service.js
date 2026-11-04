import { clientScope, HttpError } from '../access.js';
import { safeClientSelect } from '../utils/selectors.js';

export async function findClient(db, user, id) {
  const record = await db.client.findFirst({
    where: { id, ...clientScope(user) },
    select: safeClientSelect(user.role),
  });
  if (!record) throw new HttpError(404, 'Client not found.');
  return record;
}
