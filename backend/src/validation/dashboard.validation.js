import { z } from 'zod';
const instant = z.iso.datetime({ offset: true });
export const dashboardQuery = z.object({
  clientId: z.string().min(1).max(40).optional(),
  from: instant.optional(), to: instant.optional(),            // the window for "this week" / "coming up"
  monthFrom: instant.optional(), monthTo: instant.optional(),  // the current month, in the viewer's time zone
}).strict().superRefine((q, ctx) => {
  if (Boolean(q.from) !== Boolean(q.to) || q.from && (new Date(q.to) <= new Date(q.from) || new Date(q.to) - new Date(q.from) > 62 * 86400000)) ctx.addIssue({ code: 'custom', message: 'Choose a window of up to 62 days.' });
  if (Boolean(q.monthFrom) !== Boolean(q.monthTo) || q.monthFrom && (new Date(q.monthTo) <= new Date(q.monthFrom) || new Date(q.monthTo) - new Date(q.monthFrom) > 32 * 86400000)) ctx.addIssue({ code: 'custom', message: 'Choose a month.' });
});
