import { z } from 'zod';
export const clientDecisionInput = z.object({
  updatedAt: z.iso.datetime({ offset: true }), version: z.number().int().min(1),
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
  feedback: z.string().trim().max(5000).default(''),
  acknowledged: z.boolean().default(false),
}).strict();
export const bulkDecisionInput = z.object({
  items: z.array(z.object({ id: z.string().min(1).max(40), version: z.number().int().min(1), updatedAt: z.iso.datetime({ offset: true }) }).strict()).min(1, 'Select at least one post.').max(50, 'Select up to 50 posts at a time.'),
  acknowledged: z.boolean().default(false),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.items.map(item => item.id)).size !== input.items.length) ctx.addIssue({ code: 'custom', message: 'Each post can be selected only once.' });
});
