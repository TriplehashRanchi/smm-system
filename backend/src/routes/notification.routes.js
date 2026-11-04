import { Router } from 'express';
import { createNotificationController } from '../controllers/notification.controller.js';

export function createNotificationRoutes(dependencies) {
  const router = Router(), controller = createNotificationController(dependencies);
  router.get('/', controller.list);
  return router;
}
