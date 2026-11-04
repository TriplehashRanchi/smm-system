import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createContentController } from '../controllers/content.controller.js';
export function createContentRoutes(dependencies) {
  const router = Router(), controller = createContentController(dependencies);
  router.get('/', controller.listContent);
  router.post('/', agencyOnly, controller.createContent);
  router.post('/reschedule', agencyOnly, controller.rescheduleContent);
  router.get('/:id/history', agencyOnly, controller.history);
  router.post('/:id/duplicate', agencyOnly, controller.duplicateContent);
  router.get('/:id', controller.getContent);
  router.patch('/:id', agencyOnly, controller.updateContent);
  return router;
}
