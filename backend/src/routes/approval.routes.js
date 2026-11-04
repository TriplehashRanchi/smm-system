import { Router } from 'express';
import { createApprovalController } from '../controllers/approval.controller.js';
export function createApprovalRoutes(dependencies) {
  const router = Router(), controller = createApprovalController(dependencies);
  router.post('/bulk-decision', controller.decideBulk);
  router.post('/:id/decision', controller.decide);
  return router;
}
