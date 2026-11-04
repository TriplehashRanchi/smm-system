import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createClientController } from '../controllers/client.controller.js';
import { createAccountRoutes } from './account.routes.js';
import { createClientLoginRoutes } from './client-login.routes.js';
import { createActivityRoutes } from './activity.routes.js';

export function createClientRoutes(dependencies) {
  const router = Router();
  const controller = createClientController(dependencies);
  router.get('/', controller.listClients);
  router.post('/', agencyOnly, controller.createClient);
  router.get('/:id', controller.getClient);
  router.patch('/:id', agencyOnly, controller.updateClient);
  router.get('/:id/impact', agencyOnly, controller.clientImpact);
  router.delete('/:id', agencyOnly, controller.deleteClient);
  router.use('/:id/accounts', createAccountRoutes(dependencies));
  router.use('/:id/login', createClientLoginRoutes(dependencies));
  router.use('/:id/activity', createActivityRoutes(dependencies));
  return router;
}
