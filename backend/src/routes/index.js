import { Router } from 'express';
import { authentication } from '../access.js';
import { createHealthRoutes } from './health.routes.js';
import { createProfileRoutes } from './profile.routes.js';
import { createDashboardRoutes } from './dashboard.routes.js';
import { createClientRoutes } from './client.routes.js';
import { createIdeaRoutes } from './idea.routes.js';
import { createContentRoutes } from './content.routes.js';
import { createPlanningRoutes } from './planning.routes.js';
import { createProductionRoutes } from './production.routes.js';
import { createApprovalRoutes } from './approval.routes.js';
import { createSuggestionRoutes } from './suggestion.routes.js';
import { createPostRoutes } from './post.routes.js';
import { createNotificationRoutes } from './notification.routes.js';

export function createApiRoutes(dependencies) {
  const router = Router();
  router.use('/health', createHealthRoutes());
  router.use(authentication(dependencies));
  router.use('/me', createProfileRoutes(dependencies));
  router.use('/dashboard', createDashboardRoutes(dependencies));
  router.use('/clients', createClientRoutes(dependencies));
  router.use('/ideas', createIdeaRoutes(dependencies));
  router.use('/content', createContentRoutes(dependencies));
  router.use('/planning', createPlanningRoutes(dependencies));
  router.use('/production', createProductionRoutes(dependencies));
  router.use('/approvals', createApprovalRoutes(dependencies));
  router.use('/suggestions', createSuggestionRoutes(dependencies));
  router.use('/posts', createPostRoutes(dependencies));
  router.use('/notifications', createNotificationRoutes(dependencies));
  return router;
}
