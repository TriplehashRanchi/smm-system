import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createProductionController } from '../controllers/production.controller.js';
export function createProductionRoutes(dependencies) {
  const router = Router(), controller = createProductionController(dependencies);
  router.get('/', controller.queue);
  router.get('/:id/history', controller.history);
  router.get('/:id/revisions', agencyOnly, controller.revisions);
  router.get('/:id', controller.details);
  router.patch('/:id', agencyOnly, controller.updateMetadata);
  router.post('/:id/actions', controller.act);
  return router;
}
