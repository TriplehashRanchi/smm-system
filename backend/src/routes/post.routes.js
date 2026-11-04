import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createPostController } from '../controllers/post.controller.js';
import { createProductionController } from '../controllers/production.controller.js';
export function createPostRoutes(dependencies) {
  const router = Router(), controller = createPostController(dependencies), details = createProductionController(dependencies);
  router.get('/', controller.list); router.get('/summary', controller.summary); router.post('/', agencyOnly, controller.create);
  router.post('/bulk', agencyOnly, controller.createBulk); router.post('/bulk-actions', agencyOnly, controller.bulkAct);
  router.get('/:id', details.details); router.get('/:id/history', details.history);
  router.patch('/:id', agencyOnly, controller.update); router.post('/:id/actions', controller.act);
  router.patch('/:id/metrics', agencyOnly, controller.updateMetrics);
  return router;
}
