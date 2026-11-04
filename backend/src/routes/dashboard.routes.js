import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';

export function createDashboardRoutes(dependencies) {
  const router = Router();
  const controller = createDashboardController(dependencies);
  router.get('/', controller.getDashboard);
  router.get('/agency', agencyOnly, controller.agency);
  router.get('/client', controller.client);
  return router;
}
