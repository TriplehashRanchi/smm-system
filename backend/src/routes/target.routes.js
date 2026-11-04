import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createTargetController } from '../controllers/target.controller.js';

export function createTargetRoutes(dependencies) {
  const router = Router({ mergeParams: true });
  const controller = createTargetController(dependencies);
  router.put('/', agencyOnly, controller.upsertTarget);
  router.delete('/:targetId', agencyOnly, controller.deleteTarget);
  return router;
}
