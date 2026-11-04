import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createActivityController } from '../controllers/activity.controller.js';

export function createActivityRoutes(dependencies) {
  const router = Router({ mergeParams: true });
  const controller = createActivityController(dependencies);
  router.get('/', agencyOnly, controller.listActivity);
  return router;
}
