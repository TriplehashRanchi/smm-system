import { clientScope, HttpError } from '../access.js';
import { noteInput, noteUpdate, notesQuery } from '../validation/planning.validation.js';
import { activePlanningClient, checkVersion } from '../services/planning.service.js';
import { recordActivity } from '../services/audit.service.js';

export function createCalendarNoteController({ db }) {
  async function listNotes(req, res) {
    const query = notesQuery.parse(req.query);
    const from = new Date(`${query.from}T00:00:00Z`), to = new Date(`${query.to}T00:00:00Z`);
    if (to <= from || to - from > 94 * 86400000) throw new HttpError(400, 'Choose a note range of up to 93 days.');
    const data = await db.calendarNote.findMany({ where: {
      client: clientScope(req.user), ...(query.clientId ? { clientId: query.clientId } : {}),
      date: { gte: from, lt: to }, ...(req.user.role === 'CLIENT' ? { clientVisible: true } : {}),
    }, select: { id: true, clientId: true, title: true, body: true, date: true, kind: true, updatedAt: true,
      client: { select: { name: true, timezone: true } }, ...(req.user.role === 'AGENCY' ? { clientVisible: true } : {}),
    }, orderBy: [{ date: 'asc' }, { id: 'asc' }] });
    res.json({ data });
  }
  async function createNote(req, res) {
    const input = noteInput.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      await activePlanningClient(tx, input.clientId);
      const note = await tx.calendarNote.create({ data: { ...input, date: new Date(`${input.date}T00:00:00Z`), createdById: req.user.id } });
      await recordActivity(tx, req.user, 'CALENDAR_NOTE_CREATED', { noteId: note.id, title: note.title, date: input.date, clientVisible: input.clientVisible }, input.clientId);
      return note;
    });
    res.status(201).json({ data });
  }
  async function updateNote(req, res) {
    const { updatedAt, ...input } = noteUpdate.parse(req.body);
    const data = await db.$transaction(async (tx) => {
      const before = await tx.calendarNote.findUnique({ where: { id: req.params.id } });
      if (!before) throw new HttpError(404, 'Calendar note not found.');
      await activePlanningClient(tx, before.clientId);
      checkVersion(before, updatedAt);
      const note = await tx.calendarNote.update({ where: { id: before.id }, data: { ...input, ...('date' in input ? { date: new Date(`${input.date}T00:00:00Z`) } : {}) } });
      await recordActivity(tx, req.user, 'CALENDAR_NOTE_UPDATED', { noteId: note.id, before, after: input }, note.clientId);
      return note;
    }, { isolationLevel: 'Serializable' });
    res.json({ data });
  }
  async function deleteNote(req, res) {
    await db.$transaction(async (tx) => {
      const before = await tx.calendarNote.findUnique({ where: { id: req.params.id } });
      if (!before) throw new HttpError(404, 'Calendar note not found.');
      await tx.calendarNote.delete({ where: { id: before.id } });
      await recordActivity(tx, req.user, 'CALENDAR_NOTE_REMOVED', { noteId: before.id, before }, before.clientId);
    });
    res.status(204).end();
  }
  return { listNotes, createNote, updateNote, deleteNote };
}
