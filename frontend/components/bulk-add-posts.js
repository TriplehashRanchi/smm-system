"use client";
import { useState } from 'react';
import { Modal, ErrorBox, Icon } from './ui';
import { postFormats, contentLabel } from '../lib/posts';
import { zonedInstant } from '../lib/planning';
import { maxBulkPosts, bulkLimits, parsePastedPosts } from '../lib/bulk-posts';

let rowKey = 0;
const blankRow = (format = 'REEL') => ({ key: ++rowKey, format, title: '', date: '', script: '', caption: '', reference: '' });
const isEmpty = row => !row.title.trim() && !row.date && !row.script.trim() && !row.caption.trim() && !row.reference.trim();

export default function BulkAddPosts({ api, account, zone, onClose, onDone }) {
  const [rows, setRows] = useState(() => [blankRow(), blankRow(), blankRow()]), [pasteText, setPasteText] = useState(''), [tried, setTried] = useState(false), [error, setError] = useState(''), [note, setNote] = useState(''), [saving, setSaving] = useState(false);
  const filled = rows.filter(row => !isEmpty(row)), missingTitle = new Set(filled.filter(row => !row.title.trim()).map(row => row.key));
  function change(key, fields) { setRows(rows => rows.map(row => row.key === key ? { ...row, ...fields } : row)); }
  function addRow() { if (rows.length >= maxBulkPosts) { setError(`You can add up to ${maxBulkPosts} posts at a time.`); return; } setRows(rows => [...rows, blankRow(rows.at(-1)?.format)]); }
  function removeRow(key) { setRows(rows => rows.length > 1 ? rows.filter(row => row.key !== key) : [blankRow()]); }
  function addParsed(text) {
    const parsed = parsePastedPosts(text, rows.at(-1)?.format || 'REEL');
    if (!parsed.length) { setNote(''); setError('Nothing to add. Copy rows from your spreadsheet, one post per line.'); return false; }
    const kept = rows.filter(row => !isEmpty(row)), accepted = parsed.slice(0, Math.max(0, maxBulkPosts - kept.length)), unreadable = accepted.filter(row => row.dateIssue), badDates = unreadable.length;
    setRows([...kept, ...accepted.map(({ dateIssue, ...row }) => ({ key: ++rowKey, ...row }))]); setError('');
    setNote(`${accepted.length} row${accepted.length === 1 ? '' : 's'} added${accepted.length < parsed.length ? `. ${parsed.length - accepted.length} skipped because the limit is ${maxBulkPosts} posts` : ''}${badDates ? `. ${badDates} date${badDates === 1 ? ' was' : 's were'} not understood and left empty (for example "${unreadable[0].dateIssue}"). Set ${badDates === 1 ? 'it' : 'them'} in the date column` : ''}. Check them below.`); return true;
  }
  async function save(event) {
    event.preventDefault(); if (saving) return; setTried(true); setNote('');
    if (!filled.length) { setError('Add at least one post title.'); return; }
    if (missingTitle.size) { setError(`${missingTitle.size} row${missingTitle.size === 1 ? ' needs' : 's need'} a title. Fill them in or remove them.`); return; }
    setSaving(true); setError('');
    try {
      const posts = filled.map(row => ({ title: row.title.trim(), contentType: row.format, publishAt: row.date ? zonedInstant(row.date, zone) : null, script: row.script, caption: row.caption, creativeReference: row.reference.trim() }));
      const result = await api('/posts/bulk', { method: 'POST', body: { socialAccountId: account.id, posts } });
      onDone(result.created ?? posts.length, posts.filter(post => post.script.trim()).length);
    } catch (error) { setError(error.message); setSaving(false); }
  }
  return <Modal title="Add many posts" subtitle={`${account.client.name} · ${account.handle}. Times are in ${zone}.`} onClose={() => { if (!saving) onClose(); }}>
    <form className="bulk-add" onSubmit={save}>
      <details className="bulk-paste"><summary>Paste from Excel or Google Sheets</summary>
        <p className="muted small-text">Copy rows from your sheet. Put a header row first (<strong>Title, Format, Date, Script, Caption, Reference</strong>) and the columns can be in any order. Without a header the order is Title, Script, Caption, Reference, and any cell that is a date or a format (Reel, Carousel, Single image, Story) is picked up automatically. Dates like 2026-11-04, 04/11/2026 (day first), 4 Nov 2026, Nov 4, 2026 or Excel date numbers work, with an optional time such as 18:30 or 6:30 PM (default 10:00). Scripts with several lines are fine.</p>
        <textarea aria-label="Pasted rows" rows={4} placeholder={'Title\tFormat\tDate\tScript\tCaption\nMonday motivation\tReel\t04/11/2026\tHook... body... call to action\tStart the week strong'} value={pasteText} onChange={event => setPasteText(event.target.value)} />
        <button type="button" className="button secondary small" disabled={!pasteText.trim()} onClick={() => { if (addParsed(pasteText)) setPasteText(''); }}>Add pasted rows</button>
      </details>
      <div className="bulk-grid-scroll"><table className="bulk-grid"><thead><tr><th>#</th><th>Format</th><th>Post title</th><th>Publish date &amp; time</th><th>Script / content</th><th>Caption (optional)</th><th>Final file / WhatsApp reference</th><th><span className="sr-only">Remove</span></th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.key} className={tried && missingTitle.has(row.key) ? 'invalid' : ''}>
        <td>{index + 1}</td>
        <td><select aria-label={`Format for row ${index + 1}`} disabled={saving} value={row.format} onChange={event => change(row.key, { format: event.target.value })}>{Object.entries(postFormats).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></td>
        <td><input aria-label={`Title for row ${index + 1}`} aria-invalid={tried && missingTitle.has(row.key)} maxLength={bulkLimits.title} placeholder="Post title..." disabled={saving} value={row.title} onChange={event => change(row.key, { title: event.target.value })} onPaste={event => { const text = event.clipboardData.getData('text'); if (/[\t\n]/.test(text.trim())) { event.preventDefault(); addParsed(text); } }} /></td>
        <td><input type="datetime-local" aria-label={`Publish date for row ${index + 1}`} disabled={saving} value={row.date} onChange={event => change(row.key, { date: event.target.value })} /></td>
        <td><textarea rows={2} aria-label={`${contentLabel(row.format)} for row ${index + 1}`} maxLength={bulkLimits.script} placeholder={contentLabel(row.format)} disabled={saving} value={row.script} onChange={event => change(row.key, { script: event.target.value })} /></td>
        <td><textarea rows={2} aria-label={`Caption for row ${index + 1}`} maxLength={bulkLimits.caption} placeholder="Caption" disabled={saving} value={row.caption} onChange={event => change(row.key, { caption: event.target.value })} /></td>
        <td><textarea rows={2} aria-label={`Final file or WhatsApp reference for row ${index + 1}`} maxLength={bulkLimits.reference} placeholder="Link or note, can be added later" disabled={saving} value={row.reference} onChange={event => change(row.key, { reference: event.target.value })} /></td>
        <td><button type="button" className="text-button" aria-label={`Remove row ${index + 1}`} disabled={saving} onClick={() => removeRow(row.key)}>Remove</button></td>
      </tr>)}</tbody></table></div>
      <div className="bulk-footer"><button type="button" className="button secondary small" disabled={saving || rows.length >= maxBulkPosts} onClick={addRow}><Icon name="plus" size={14} />Add row</button><span className="muted small-text">{filled.length} of {maxBulkPosts} posts ready. All posts are saved together or not at all.</span></div>
      {note && <p className="bulk-note" role="status">{note}</p>}
      <ErrorBox>{error}</ErrorBox>
      <div className="button-row bulk-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !filled.length}>{saving ? 'Saving...' : `Add ${filled.length} post${filled.length === 1 ? '' : 's'}`}</button></div>
    </form>
  </Modal>;
}
