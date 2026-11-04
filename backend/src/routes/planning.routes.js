import { Router } from 'express';
import { agencyOnly } from '../access.js';
import { createPlanningController } from '../controllers/planning.controller.js';
import { createCalendarNoteController } from '../controllers/calendar-note.controller.js';
export function createPlanningRoutes(dependencies) {
  const router = Router(), planning = createPlanningController(dependencies), notes = createCalendarNoteController(dependencies);
  router.get('/options', planning.options);
  router.get('/targets', planning.targets);
  router.get('/notes', notes.listNotes);
  router.post('/notes', agencyOnly, notes.createNote);
  router.patch('/notes/:id', agencyOnly, notes.updateNote);
  router.delete('/notes/:id', agencyOnly, notes.deleteNote);
  return router;
}
