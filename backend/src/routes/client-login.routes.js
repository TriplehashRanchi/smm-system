import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createClientLoginController } from '../controllers/client-login.controller.js';

export function createClientLoginRoutes(dependencies) {
  const router = Router({ mergeParams: true });
  const controller = createClientLoginController(dependencies);
  router.use(agencyOnly);
  router.post('/', controller.createLogin);
  router.patch('/:userId', controller.updateLogin);
  router.get('/:userId/impact', controller.loginImpact);
  router.delete('/:userId', controller.deleteLogin);
  return router;
}
