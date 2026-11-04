// Helpers for the "Bulk add posts" grid: turning pasted spreadsheet text into rows.
export const maxBulkPosts = 100;
export const bulkLimits = { title: 200, script: 10000, caption: 10000, reference: 5000 };
const formatAliases = {
  REEL: ['reel', 'reels', 'video'], CAROUSEL: ['carousel', 'slides'], STATIC_GRAPHIC: ['single image', 'static', 'static graphic', 'image', 'graphic', 'photo'], STORY: ['story', 'stories'],
};
export function parseFormat(text) {
  const value = String(text || '').trim().toLowerCase();
  return value ? Object.keys(formatAliases).find(key => key.toLowerCase() === value || formatAliases[key].includes(value)) || null : null;
}
const pad = number => String(number).padStart(2, '0');
function realDate(year, month, day, hour, minute) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const monthNumber = name => months[String(name).slice(0, 3).toLowerCase()] || 0;
// Understands, with an optional time (24-hour like 18:30 or 12-hour like 6:30 PM; no time means 10:00):
//   2026-11-04   04/11/2026 (day first)   04-11-26   4 Nov 2026   Nov 4, 2026   and Excel serial numbers like 46330.77
// Returns "YYYY-MM-DDTHH:mm" or null.
export function parseDateTime(text) {
  let value = String(text || '').trim().replace(/\s+/g, ' ');
  if (!value) return null;
  if (/^\d{5}(\.\d+)?$/.test(value)) {
    const serial = Number(value); if (serial < 36526 || serial > 80000) return null; // years 2000 to 2118
    const date = new Date(Math.round((serial - 25569) * 1440) * 60000);
    return realDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
  }
  let hour = 10, minute = 0;
  const time = /(?:^|[ T,]+|(?<=\d)(?=\d{1,2}:))(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?(m)?\.?$/i.exec(value);
  if (time && (!time[3] || time[4])) {
    hour = +time[1]; minute = +time[2];
    if (time[3]) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + (time[3].toLowerCase() === 'p' ? 12 : 0); }
    value = value.slice(0, time.index).replace(/[ T,]+$/, '');
  }
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  if (match) return realDate(+match[1], +match[2], +match[3], hour, minute);
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
  if (match) {
    let day = +match[1], month = +match[2]; const year = match[3].length === 2 ? 2000 + +match[3] : +match[3];
    if (month > 12 && day <= 12) [day, month] = [month, day]; // 11/25/2026 can only be month first
    return realDate(year, month, day, hour, minute);
  }
  match = /^(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3,9})\.?,?[ -](\d{2}|\d{4})$/.exec(value);
  if (match && monthNumber(match[2])) return realDate(match[3].length === 2 ? 2000 + +match[3] : +match[3], monthNumber(match[2]), +match[1], hour, minute);
  match = /^([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{2}|\d{4})$/.exec(value);
  if (match && monthNumber(match[1])) return realDate(match[3].length === 2 ? 2000 + +match[3] : +match[3], monthNumber(match[1]), +match[2], hour, minute);
  return null;
}
// Reads tab-separated text the way Excel / Google Sheets write it: a cell in "quotes" may contain tabs,
// line breaks and doubled quotes (""), which is how multi-line scripts are copied.
export function parseTsv(text) {
  const rows = [], source = String(text || '').replace(/\r\n?/g, '\n'); let row = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) { if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; } else if (char === '"') quoted = false; else cell += char; }
    else if (char === '"' && cell === '') quoted = true;
    else if (char === '\t') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(cells => cells.some(value => value.trim()));
}
function headerField(text) {
  const value = String(text || '').trim().toLowerCase();
  if (['title', 'post', 'post title', 'name'].includes(value)) return 'title';
  if (['format', 'type', 'post type'].includes(value)) return 'format';
  if (value.includes('date') || value.includes('schedule') || value === 'time' || value === 'day') return 'date';
  if (['script', 'content', 'script / content', 'script/content', 'copy', 'slide content'].includes(value)) return 'script';
  if (value.startsWith('caption')) return 'caption';
  if (value.includes('reference') || value.includes('final file') || value === 'link' || value === 'file') return 'reference';
  return null;
}
const clip = (text, field) => String(text || '').trim().slice(0, bulkLimits[field]);
// Each line is one post. If the first line is a header (Title, Format, Date, Script, Caption, Reference) the
// columns can be in any order. Without a header: a cell that is a format name is the format, a cell that is a
// date is the date, and the remaining cells are Title, Script, Caption, Reference in that order.
export function parsePastedPosts(text, defaultFormat = 'REEL') {
  const lines = parseTsv(text); if (!lines.length) return [];
  const header = lines[0].map(headerField), hasHeader = header.some(Boolean) && lines[0].filter(cell => cell.trim()).every(cell => headerField(cell));
  const rows = [];
  for (const cells of hasHeader ? lines.slice(1) : lines) {
    const row = { format: defaultFormat, title: '', script: '', caption: '', reference: '', date: '' };
    if (hasHeader) {
      cells.forEach((cell, index) => {
        const field = header[index]; if (!field || !cell.trim()) return;
        if (field === 'format') row.format = parseFormat(cell) || defaultFormat;
        else if (field === 'date') { row.date = parseDateTime(cell) || ''; if (!row.date) row.dateIssue = cell.trim().slice(0, 40); }
        else row[field] = clip(cell, field);
      });
    } else {
      const rest = []; let formatSeen = false, dateSeen = false;
      for (const cell of cells.map(value => value.trim()).filter(Boolean)) {
        if (!formatSeen && parseFormat(cell)) { row.format = parseFormat(cell); formatSeen = true; }
        else if (!dateSeen && parseDateTime(cell)) { row.date = parseDateTime(cell); dateSeen = true; }
        else rest.push(cell);
      }
      [row.title, row.script, row.caption, row.reference] = [clip(rest[0], 'title'), clip(rest[1], 'script'), clip(rest[2], 'caption'), clip(rest[3], 'reference')];
    }
    rows.push(row);
  }
  return rows;
}
