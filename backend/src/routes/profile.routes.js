import { Router } from 'express';
import { createProfileController } from '../controllers/profile.controller.js';

export function createProfileRoutes(dependencies) {
  const router = Router();
  const controller = createProfileController(dependencies);
  router.get('/', controller.getProfile);
  router.patch('/', controller.updateProfile);
  return router;
}
