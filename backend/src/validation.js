import { z } from 'zod';
import { patchSchema } from './validation/patch-schema.js';
const text = (max) => z.string().trim().min(1).max(max);
export const timezone = text(80).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Enter a valid timezone, such as Asia/Kolkata.');
const clientProfileInput = z.object({
  name: text(160), timezone: timezone.default('Asia/Kolkata'),
  internalNotes: z.string().trim().max(5000).default(''),
}).strict();
export const clientInput = clientProfileInput.extend({ login: z.object({ email: z.email().max(254).transform(value => value.toLowerCase()), password: z.string().min(6).max(128) }).strict().optional() });
export const clientUpdate = patchSchema(clientProfileInput).extend({ status: z.enum(['ACTIVE', 'ARCHIVED']).optional() });
export const accountInput = z.object({
  platform: z.enum(['INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'YOUTUBE', 'OTHER']),
  handle: text(160), timezone: timezone.default('Asia/Kolkata'), active: z.boolean().default(true),
}).strict();
export const accountUpdate = patchSchema(accountInput);
export const targetInput = z.object({
  contentType: z.enum(['ALL', 'REEL', 'CAROUSEL', 'STATIC_GRAPHIC', 'STORY', 'LINKEDIN_TEXT', 'DOCUMENT_POST', 'OTHER']).default('ALL'),
  targetCount: z.number().int().min(0).max(1000),
}).strict();
export const clientLoginInput = z.object({
  name: text(120), email: z.email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(6, 'Use at least 6 characters.').max(128),
}).strict();
export const clientLoginUpdate = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) }).strict();
export const userInput = z.object({
  name: text(120), email: z.email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(['AGENCY', 'CLIENT']),
}).strict();
export const profileInput = z.object({ name: text(120) }).strict();
export const listInput = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(160).default(''),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
});
