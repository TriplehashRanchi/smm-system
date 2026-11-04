export function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function addDays(day, count) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function localDateTime(value, timeZone) {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function zonedInstant(value, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '') || !isDateKey(value.slice(0, 10))) throw new Error('Enter a valid local date and time.');
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) throw new Error('Enter a valid local date and time.');
  let instant = wall;
  for (let attempt = 0; attempt < 6; attempt++) {
    const shown = localDateTime(instant, timeZone);
    const difference = wall - Date.parse(`${shown}:00Z`);
    if (!difference) {
      // When clocks repeat an hour, consistently use the earliest occurrence.
      for (const minutes of [120, 90, 60, 30]) {
        const earlier = instant - minutes * 60_000;
        if (localDateTime(earlier, timeZone) === value) return new Date(earlier).toISOString();
      }
      return new Date(instant).toISOString();
    }
    instant += difference;
  }
  throw new Error('This local time does not exist because the timezone clocks change. Choose another time.');
}

export function weekStart(day) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

export function calendarRange(day, view) {
  if (view === 'week') { const from = weekStart(day); return { from, to: addDays(from, 7) }; }
  const first = `${day.slice(0, 7)}-01`;
  if (view === 'month') { const from = weekStart(first); return { from, to: addDays(from, 42) }; }
  const next = new Date(`${first}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from: first, to: next.toISOString().slice(0, 10) };
}
