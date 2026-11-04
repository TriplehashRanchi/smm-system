// Permanent deletion helpers. The database links are all ON DELETE RESTRICT, so records must be removed
// children-first. Everything here must run inside one transaction so a failure leaves nothing half-deleted.

// Deletes the posts matching `where` together with their versions, approvals, requests and footage records.
export async function deletePostsWhere(tx, where) {
  const ids = (await tx.contentItem.findMany({ where, select: { id: true } })).map(item => item.id);
  if (!ids.length) return 0;
  const owned = { contentItemId: { in: ids } };
  await tx.productionApproval.deleteMany({ where: owned }); // points at approval requests, so it goes first
  await tx.approvalRequest.deleteMany({ where: owned });
  await tx.mediaHandoff.deleteMany({ where: owned });
  await tx.contentRevision.deleteMany({ where: owned });
  await tx.contentItem.deleteMany({ where: { id: { in: ids } } }); // activity-log rows are detached automatically
  return ids.length;
}

export async function deleteAccountData(tx, accountIds) {
  if (!accountIds.length) return { posts: 0, targets: 0 };
  const posts = await deletePostsWhere(tx, { socialAccountId: { in: accountIds } });
  const targets = (await tx.publishingTarget.deleteMany({ where: { socialAccountId: { in: accountIds } } })).count;
  await tx.socialAccount.deleteMany({ where: { id: { in: accountIds } } });
  return { posts, targets };
}

// Client logins that belong only to this client (a login shared with another client is kept and just unlinked).
export async function exclusiveClientUsers(db, clientId) {
  const access = await db.clientUserAccess.findMany({ where: { clientId }, select: { user: { select: { id: true, role: true, firebaseUid: true, clientAccess: { select: { clientId: true } } } } } });
  return access.map(entry => entry.user).filter(user => user.role === 'CLIENT' && user.clientAccess.every(link => link.clientId === clientId));
}
