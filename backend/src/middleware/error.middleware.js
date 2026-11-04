import { ZodError } from 'zod';
import { HttpError } from '../access.js';
import { databaseUnavailable } from '../services/database-availability.service.js';

export function notFound(req, res) {
  res.status(404).json({ error: 'Page not found.' });
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) return res.status(400).json({
    error: error.issues.map((issue) => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join('; '),
  });
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The submitted information is too large.' });
  if (error.code === 'P2002') return res.status(409).json({ error: 'A record with these details already exists.' });
  if (error.code === 'P2025') return res.status(404).json({ error: 'Record not found.' });
  if (error.code === 'P2034') return res.status(409).json({ error: 'Another person updated this record. Refresh and try again.' });
  const unavailable = databaseUnavailable(error);
  if (unavailable) return res.status(503).set('Retry-After', String(unavailable.retryAfter)).json({
    error: unavailable.message, code: unavailable.code, retryAfter: unavailable.retryAfter,
    requestId: req.requestId,
  });
  // Never log request bodies, authorization headers, credential files or driver messages.
  console.error(JSON.stringify({ requestId: req.requestId, errorType: error.name || 'Error' }));
  res.status(500).json({ error: 'Something went wrong. Please try again.', requestId: req.requestId });
}
