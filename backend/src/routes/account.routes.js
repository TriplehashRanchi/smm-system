import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createAccountController } from '../controllers/account.controller.js';
import { createTargetRoutes } from './target.routes.js';

export function createAccountRoutes(dependencies) {
  const router = Router({ mergeParams: true });
  const controller = createAccountController(dependencies);
  router.post('/', agencyOnly, controller.createAccount);
  router.patch('/:accountId', agencyOnly, controller.updateAccount);
  router.get('/:accountId/impact', agencyOnly, controller.accountImpact);
  router.delete('/:accountId', agencyOnly, controller.deleteAccount);
  router.use('/:accountId/targets', createTargetRoutes(dependencies));
  return router;
}
