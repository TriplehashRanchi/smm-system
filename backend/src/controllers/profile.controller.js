import { publicUser } from '../access.js';
import { profileInput } from '../validation.js';
import { recordActivity } from '../services/audit.service.js';

export function createProfileController({ db }) {
  function getProfile(req, res) {
    res.json({ data: publicUser(req.user) });
  }

  async function updateProfile(req, res) {
    const input = profileInput.parse(req.body);
    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: req.user.id }, data: input });
      await recordActivity(tx, req.user, 'PROFILE_UPDATED', {
        before: { name: req.user.name }, after: input,
      });
      return updated;
    });
    res.json({ data: publicUser(user) });
  }

  return { getProfile, updateProfile };
}
