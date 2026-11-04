import { z } from 'zod';
import { patchSchema } from './patch-schema.js';
const instant = z.iso.datetime({ offset: true });
const preview = z.url().max(2000).refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS link.');
export const postFormats = ['REEL', 'CAROUSEL', 'STATIC_GRAPHIC', 'STORY'];
export const sheetPostInput = z.object({
  socialAccountId: z.string().min(1).max(40), title: z.string().trim().min(1).max(200), contentType: z.enum(postFormats).default('REEL'),
  script: z.string().max(10000).default(''), caption: z.string().max(10000).default(''), publishAt: instant.nullable().default(null),
}).strict();
export const sheetPostUpdate = patchSchema(sheetPostInput.omit({ socialAccountId: true })).extend({
  updatedAt: instant, creativeReference: z.string().max(5000).optional(), internalProductionNotes: z.string().max(10000).optional(),
}).strict();
const engagementCount = z.number().int().min(0).max(4294967295).nullable();
export const postMetricsInput = z.object({
  updatedAt: instant, likes: engagementCount.optional(), comments: engagementCount.optional(), views: engagementCount.optional(),
}).strict().refine(input => ['likes', 'comments', 'views'].some(field => Object.hasOwn(input, field)), 'Enter at least one engagement value.');
export const sheetActionInput = z.object({
  updatedAt: instant, action: z.enum(['SEND_CONTENT_REVIEW', 'REPORT_FOOTAGE', 'START_WORK', 'REQUEST_MORE_FOOTAGE', 'SEND_FINAL_REVIEW', 'MARK_PUBLISHED', 'CANCEL']),
  note: z.string().trim().max(5000).optional(), publishedAt: instant.optional(), publishedUrl: z.union([preview, z.literal('')]).optional(),
}).strict();
export const sheetQuery = z.object({
  clientId: z.string().min(1).max(40).optional(), socialAccountId: z.string().min(1).max(40).optional(),
  contentType: z.enum(postFormats).optional(), search: z.string().trim().max(200).default(''),
  stage: z.enum(['DRAFT', 'CONTENT_REVIEW', 'WAITING_FOOTAGE', 'FOOTAGE_SENT', 'PRODUCTION', 'FINAL_REVIEW', 'READY', 'PUBLISHED', 'CANCELLED']).optional(),
  mine: z.enum(['true', 'false']).optional(), focus: z.enum(['overdue', 'changes', 'waiting', 'incomplete']).optional(), from: instant.optional(), to: instant.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
export const bulkPostRow = sheetPostInput.omit({ socialAccountId: true }).extend({ creativeReference: z.string().max(5000).default('') });
export const bulkPostInput = z.object({ socialAccountId: z.string().min(1).max(40), posts: z.array(z.unknown()).min(1, 'Add at least one post.').max(100, 'Add up to 100 posts at a time.') }).strict();
export const bulkActionInput = z.object({
  action: z.enum(['SEND_CONTENT_REVIEW', 'CANCEL', 'RESCHEDULE', 'DELETE']),
  items: z.array(z.object({ id: z.string().min(1).max(40), updatedAt: instant }).strict()).min(1, 'Select at least one post.').max(50, 'Select up to 50 posts at a time.'),
  note: z.string().trim().max(5000).optional(), shiftDays: z.number().int().min(-366).max(366).optional(), publishAt: instant.optional(),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.items.map(item => item.id)).size !== input.items.length) ctx.addIssue({ code: 'custom', message: 'Each post can be selected only once.' });
  if (input.action === 'CANCEL' && !input.note) ctx.addIssue({ code: 'custom', message: 'Enter a reason for cancelling these posts.' });
  if (input.action === 'RESCHEDULE' && (input.shiftDays === undefined) === (input.publishAt === undefined)) ctx.addIssue({ code: 'custom', message: 'Choose either a number of days to shift or one new date.' });
  if (input.action === 'RESCHEDULE' && input.shiftDays === 0) ctx.addIssue({ code: 'custom', message: 'Shift by at least one day.' });
});
