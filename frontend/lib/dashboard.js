import { localDateTime, zonedInstant, addDays, calendarRange } from './planning';

// Dashboards use the agency's working time zone, like the Posts page does when no single account is chosen.
export const dashboardZone = 'Asia/Kolkata';

// The "next N days" window and the current month, as the instants the server expects.
export function dashboardWindow(days) {
  const today = localDateTime(new Date(), dashboardZone).slice(0, 10), month = calendarRange(today, 'month-only');
  const at = day => zonedInstant(`${day}T00:00`, dashboardZone);
  return { today, days: Array.from({ length: days }, (_, index) => addDays(today, index)), query: { from: at(today), to: at(addDays(today, days)), monthFrom: at(month.from), monthTo: at(month.to) } };
}

export function dayHeading(day, today) {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
}
export const longDate = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: dashboardZone }).format(new Date());
export const timeIn = (value, zone) => new Intl.DateTimeFormat('en-IN', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
export function daysAgo(value) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
}
export function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: dashboardZone }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
// "3 posts", "1 post"
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
// Posts of one local day, in time order
export function postsOnDay(items, day) {
  return items.filter(item => item.publishAt && localDateTime(item.publishAt, item.socialAccount.timezone).slice(0, 10) === day);
}
