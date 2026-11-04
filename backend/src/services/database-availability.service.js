let quotaBlockedUntil = 0;

// Inspect structured causes only. Driver messages can contain private account data.
export function recordDatabaseFailure(error) {
  const pending = [error];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (Number(current.errno ?? current.originalCode) === 1226) {
      quotaBlockedUntil = Date.now() + 60_000;
      break;
    }
    pending.push(current.cause, current.meta?.driverAdapterError);
  }
}

export function databaseUnavailable(error) {
  if (error) recordDatabaseFailure(error);
  if (Date.now() < quotaBlockedUntil) {
    return {
      code: 'DATABASE_QUOTA_EXCEEDED',
      message: 'The workspace database has reached its hosting connection limit. Please try again later.',
      retryAfter: Math.max(1, Math.ceil((quotaBlockedUntil - Date.now()) / 1000)),
    };
  }
  const driverCode = Number(error?.meta?.driverAdapterError?.cause?.originalCode);
  if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037'].includes(error?.code) ||
      [1040, 1203, 45012, 45028].includes(driverCode)) {
    return {
      code: 'DATABASE_UNAVAILABLE',
      message: 'The workspace database is temporarily unavailable. Please try again shortly.',
      retryAfter: 15,
    };
  }
  return null;
}
