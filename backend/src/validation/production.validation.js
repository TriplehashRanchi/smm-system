import { z } from 'zod';
import { productionActionKeys } from '../services/production-state.service.js';
const instant = z.iso.datetime({ offset: true });
export const handoffInput = z.object({
  channel: z.enum(['GROUP', 'DM']).default('GROUP'), channelName: z.string().trim().max(160).default(''),
  senderName: z.string().trim().max(160).default(''), description: z.string().max(5000).default(''),
  sentAt: instant.nullable().default(null), clipCount: z.number().int().min(1).max(1000).nullable().default(null), messageReference: z.string().max(2000).default(''),
}).strict();
export const productionActionInput = z.object({
  action: z.enum(productionActionKeys), updatedAt: instant,
  version: z.number().int().min(1).optional(), handoffId: z.string().max(40).optional(),
  shootAt: instant.optional(), occurredAt: instant.optional(), handoff: handoffInput.optional(),
  reason: z.string().trim().max(5000).optional(), feedback: z.string().trim().max(5000).optional(),
  verificationNote: z.string().trim().max(5000).optional(), source: z.enum(['WHATSAPP', 'EMAIL', 'PHONE', 'OTHER']).optional(), reference: z.string().trim().max(5000).optional(),
  reviewSummary: z.string().trim().max(2000).optional(), reviewLocation: z.enum(['IN_APP', 'WHATSAPP', 'EXTERNAL']).optional(),
  previewUrl: z.url().max(2000).refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS preview link.').optional(),
  clientActionDueAt: instant.nullable().optional(),
}).strict();
export const productionMetaInput = z.object({
  updatedAt: instant, internalProductionNotes: z.string().max(10000).optional(), creativeReference: z.string().max(5000).optional(),
  requiresScriptApproval: z.boolean().optional(), requiresFootage: z.boolean().optional(), requiresFinalApproval: z.boolean().optional(),
  reason: z.string().trim().max(5000).optional(),
  allowExternalFinalApproval: z.boolean().optional(),
}).strict();
export const productionQuery = z.object({
  clientId: z.string().max(40).optional(), productionStage: z.enum(['PLANNED', 'DRAFTING', 'CLIENT_INPUT', 'PRODUCTION', 'INTERNAL_REVIEW', 'CLIENT_FINAL_REVIEW', 'READY', 'ON_HOLD', 'CANCELLED']).optional(),
  nextActor: z.enum(['AGENCY', 'CLIENT', 'NONE']).optional(), mine: z.enum(['true', 'false']).optional(), search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30),
}).strict();
