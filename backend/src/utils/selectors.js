export const userSelect = {
  id: true, name: true, email: true, role: true, status: true, createdAt: true,
};

export const accountInclude = {
  publishingTargets: { orderBy: { contentType: 'asc' } },
};

export const safeClientSelect = (role) => ({
  id: true, name: true, timezone: true, status: true, createdAt: true, updatedAt: true,
  ...(role === 'AGENCY' ? { internalNotes: true } : {}),
  socialAccounts: { orderBy: { createdAt: 'asc' }, include: accountInclude },
  ...(role === 'AGENCY' ? {
    clientAccess: { include: { user: { select: userSelect } } },
  } : {}),
});
