import { z } from 'zod';
import { isDateKey } from '../../../shared/planning-time.js';
import { patchSchema } from './patch-schema.js';

const id = z.string().trim().min(1).max(40);
const title = z.string().trim().min(1).max(200);
const instant = z.iso.datetime({ offset: true }).nullable();
export const formats = ['REEL', 'CAROUSEL', 'STATIC_GRAPHIC', 'STORY', 'LINKEDIN_TEXT', 'DOCUMENT_POST', 'OTHER'];
export const statuses = ['DRAFT', 'TENTATIVE', 'IN_PROGRESS', 'APPROVED', 'CANCELLED'];
export const dateKey = z.string().refine(isDateKey, 'Enter a valid date (YYYY-MM-DD).');
export const ideaInput = z.object({
  clientId: id, title, brief: z.string().max(10000).default(''), notes: z.string().max(10000).default(''),
  bucket: z.string().trim().max(120).default(''), campaign: z.string().trim().max(120).default(''),
}).strict();
export const ideaUpdate = patchSchema(ideaInput.omit({ clientId: true })).extend({ updatedAt: z.iso.datetime({ offset: true }).optional() });
const postFields = z.object({
  socialAccountId: id, title, contentType: z.enum(formats), script: z.string().max(10000).default(''), caption: z.string().max(10000).default(''),
  publishAt: instant.default(null), dueAt: instant.default(null), status: z.enum(statuses).default('DRAFT'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'), ownerId: id.nullable().optional(), contributorId: id.nullable().default(null),
}).strict();
export const postsInput = z.object({ ideaId: id, items: z.array(postFields).min(1).max(20) }).strict();
export const postUpdate = patchSchema(postFields).extend({ updatedAt: z.iso.datetime({ offset: true }).optional() });
export const duplicateInput = z.object({ socialAccountId: id, publishAt: instant.default(null) }).strict();
export const rescheduleInput = z.object({
  ids: z.array(id).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, 'Select each post once.'),
  days: z.number().int().min(-365).max(365).refine((days) => days !== 0, 'Choose a non-zero day shift.'),
}).strict();
export const planningQuery = z.object({
  clientId: id.optional(), platform: z.enum(['INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'YOUTUBE', 'OTHER']).optional(),
  contentType: z.enum(formats).optional(), status: z.enum(statuses).optional(), ownerId: id.optional(),
  search: z.string().trim().max(200).default(''), from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional(),
  unscheduled: z.enum(['true', 'false']).optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
}).strict();
export const noteInput = z.object({
  clientId: id, title, body: z.string().max(5000).default(''), date: dateKey,
  kind: z.enum(['SHOOT', 'CAMPAIGN', 'HOLIDAY', 'OTHER']).default('OTHER'), clientVisible: z.boolean().default(false),
}).strict();
export const noteUpdate = patchSchema(noteInput.omit({ clientId: true })).extend({ updatedAt: z.iso.datetime({ offset: true }).optional() });
export const notesQuery = z.object({ clientId: id.optional(), from: dateKey, to: dateKey }).strict();
export const targetsQuery = z.object({ clientId: id.optional(), week: dateKey }).strict();
