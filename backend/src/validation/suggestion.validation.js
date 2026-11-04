import { z } from 'zod';
export const suggestionInput = z.object({ clientId: z.string().min(1).max(40), title: z.string().trim().min(1).max(200), body: z.string().trim().min(5).max(5000) }).strict();
export const suggestionReview = z.object({ updatedAt: z.iso.datetime({ offset: true }), status: z.enum(['SUBMITTED', 'REVIEWED']), response: z.string().trim().min(5).max(5000) }).strict();
export const suggestionQuery = z.object({ clientId: z.string().max(40).optional(), page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict();
