import { randomUUID } from 'node:crypto';

export function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.set('X-Request-Id', req.requestId);
  res.set('Cache-Control', 'no-store');
  next();
}
