import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createSuggestionController } from '../controllers/suggestion.controller.js';
export function createSuggestionRoutes(dependencies) {
  const router = Router(), controller = createSuggestionController(dependencies);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', agencyOnly, controller.review);
  return router;
}
