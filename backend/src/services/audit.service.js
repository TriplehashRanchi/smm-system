export function recordActivity(tx, user, eventType, details, clientId = null) {
  return tx.activityEvent.create({
    data: {
      actorId: user.id,
      clientId,
      eventType,
      details: JSON.parse(JSON.stringify(details)),
    },
  });
}
