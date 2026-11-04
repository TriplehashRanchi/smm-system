import { databaseUnavailable } from './services/database-availability.service.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const publicUser = (user) => ({
  id: user.id, name: user.name, email: user.email, role: user.role, status: user.status,
});

export function clientScope(user) {
  if (user.role === 'AGENCY') return {};
  if (user.role === 'CLIENT') return { clientAccess: { some: { userId: user.id } } };
  throw new HttpError(403, 'Your account does not have access.');
}

export function authentication({ db, verifyToken }) {
  return async (req, res, next) => {
    try {
      const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
      if (!match) throw new HttpError(401, 'Please sign in to continue.');
      let token;
      try { token = await verifyToken(match[1]); }
      catch (error) {
        if (error.code?.startsWith('auth/') && !['auth/internal-error', 'auth/insufficient-permission'].includes(error.code)) {
          throw new HttpError(401, 'Your session has expired. Please sign in again.');
        }
        throw new HttpError(503, 'Sign-in verification is temporarily unavailable.');
      }
      const unavailable = databaseUnavailable();
      if (unavailable) return res.status(503).set('Retry-After', String(unavailable.retryAfter)).json({
        error: unavailable.message, code: unavailable.code, retryAfter: unavailable.retryAfter,
      });
      const user = await db.user.findUnique({ where: { firebaseUid: token.uid } });
      if (!user || user.status !== 'ACTIVE' || !['AGENCY', 'CLIENT'].includes(user.role)) {
        return res.status(403).json({
          error: 'Your account has not been granted access. Contact your agency.',
          code: 'ACCOUNT_ACCESS_DENIED',
        });
      }
      req.user = user;
      next();
    } catch (error) { next(error); }
  };
}

export function agencyOnly(req, res, next) {
  if (req.user.role !== 'AGENCY') return next(new HttpError(403, 'Only Agency users can make this change.'));
  next();
}

