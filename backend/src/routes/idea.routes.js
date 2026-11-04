import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createIdeaController } from '../controllers/idea.controller.js';
export function createIdeaRoutes(dependencies) {
  const router = Router(), controller = createIdeaController(dependencies);
  router.use(agencyOnly);
  router.get('/', controller.listIdeas);
  router.post('/', controller.createIdea);
  router.get('/:id', controller.getIdea);
  router.patch('/:id', controller.updateIdea);
  return router;
}
