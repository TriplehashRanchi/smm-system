"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import { usePlanningOptions } from './planning-options';
import { Empty, ErrorBox, Icon, Modal, labels } from './ui';
import PostPanel from './post-panel';
import BulkAddPosts from './bulk-add-posts';
import StatusCell from './workflow-status';
import { useLiveRefresh } from './live-updates';
import { metricFields, parseMetric } from './post-metrics';
import { localDateTime, zonedInstant, showDate, showDay, calendarRange, addDays, allPlanningPages } from '../lib/planning';
import { postFormats, stageLabels, stageLabel, postActions, approvalLabel, contentLabel } from '../lib/posts';

function SheetCell({ value, version, type = 'text', label, disabled, commit, min, max, step }) {
  const [draft, setDraft] = useState(value), [editing, setEditing] = useState(false), baseline = useRef(version);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  function save(event) { setEditing(false); if (event.currentTarget.validity.badInput) { setDraft(value); return; } if (draft !== value) commit(draft, baseline.current); }
  return <input className="sheet-cell-input" title={type === 'text' ? value : undefined} type={type} min={min} max={max} step={step} maxLength={type === 'text' ? 200 : undefined} value={draft} aria-label={label} disabled={disabled} onFocus={() => { baseline.current = version; setEditing(true); }} onChange={event => setDraft(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value); setEditing(false); } }} />;
}
function ApprovalBadge({ status }) { return <span className={`sheet-approval ${(status || '').toLowerCase()}`}>{approvalLabel(status)}</span>; }

const actionMessages = { SEND_CONTENT_REVIEW: 'Sent to the client for approval', REPORT_FOOTAGE: 'Footage marked as sent', START_WORK: 'Clips received, editing started', SEND_FINAL_REVIEW: 'Final sent to the client for approval' };
const bulkVerbs = { send: 'sent for approval', reschedule: 'rescheduled', delete: 'deleted', approve: 'approved' };
const focusLabels = { overdue: 'Overdue', changes: 'Changes requested', waiting: 'Waiting on client', incomplete: 'Drafts to finish' };
const stageKeys = Object.keys(stageLabels);
export default function PostsSheet() {
  const { profile, api } = useAuth(), agency = profile.role === 'AGENCY', { notify, notifyError } = useWorkspace(), query = useSearchParams(), router = useRouter();
  const [clientId, setClientId] = useState(query.get('clientId') || ''), [accountId, setAccountId] = useState(query.get('socialAccountId') || ''), [view, setView] = useState(query.get('view') === 'calendar' ? 'calendar' : 'sheet');
  const [selected, setSelected] = useState(query.get('postId')), [search, setSearch] = useState(''), [format, setFormat] = useState(''), [stage, setStage] = useState(stageKeys.includes(query.get('stage')) ? query.get('stage') : ''), [focus, setFocus] = useState(focusLabels[query.get('focus')] ? query.get('focus') : '');
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [adding, setAdding] = useState(false), [newTitle, setNewTitle] = useState(''), [newFormat, setNewFormat] = useState('REEL'), [newDate, setNewDate] = useState(''), [saving, setSaving] = useState(''), [saveMessage, setSaveMessage] = useState(''), savingRef = useRef(false), silentRefresh = useRef(false);
  const [anchor, setAnchor] = useState(() => localDateTime(new Date(), 'Asia/Kolkata').slice(0, 10));
  const [operationError, setOperationError] = useState('');
  const [counts, setCounts] = useState(null);
  const [period, setPeriod] = useState(['week', 'month'].includes(query.get('period')) ? query.get('period') : '');
  const [bulkAdd, setBulkAdd] = useState(false), [checked, setChecked] = useState(() => new Set()), [bulkMode, setBulkMode] = useState(null), [bulkType, setBulkType] = useState('shift'), [bulkDays, setBulkDays] = useState('7'), [bulkDate, setBulkDate] = useState(''), [bulkResult, setBulkResult] = useState(null), [bulkConfirm, setBulkConfirm] = useState(false);
  const { options, error: optionsError } = usePlanningOptions(api, revision);
  const clients = options?.clients || [], accounts = clients.filter(client => !clientId || client.id === clientId).flatMap(client => client.socialAccounts);
  const account = accounts.find(account => account.id === accountId) || (clientId && accounts.length === 1 ? accounts[0] : null), effectiveAccountId = account?.id || '', zone = account?.timezone || clients.find(client => client.id === clientId)?.timezone || 'Asia/Kolkata';
  const canAdd = agency && account?.active && account.client.status === 'ACTIVE', unit = period || 'month', range = calendarRange(anchor, unit), dateRange = view === 'calendar' || period === 'week' ? range : period === 'month' ? calendarRange(anchor, 'month-only') : null;
  useEffect(() => { setClientId(query.get('clientId') || ''); setAccountId(query.get('socialAccountId') || ''); setView(query.get('view') === 'calendar' ? 'calendar' : 'sheet'); setSelected(query.get('postId')); setPeriod(['week', 'month'].includes(query.get('period')) ? query.get('period') : ''); setFocus(focusLabels[query.get('focus')] ? query.get('focus') : ''); if (stageKeys.includes(query.get('stage'))) setStage(query.get('stage')); setPage(1); setAdding(false); }, [query]);
  useEffect(() => {
    const quiet = silentRefresh.current; silentRefresh.current = false; let active = true; if (!quiet) { setLoading(true); if (view !== 'calendar') setItems([]); } setError('');
    const filters = { ...(clientId ? { clientId } : {}), ...(effectiveAccountId ? { socialAccountId: effectiveAccountId } : {}), ...(format ? { contentType: format } : {}), ...(stage ? { stage } : {}), ...(focus ? { focus } : {}), search,
      ...(dateRange ? { from: zonedInstant(`${dateRange.from}T00:00`, zone), to: zonedInstant(`${dateRange.to}T00:00`, zone) } : {}) };
    const timer = setTimeout(async () => {
      try {
        const result = view === 'calendar' ? { data: await allPlanningPages(api, '/posts', filters) } : await api(`/posts?${new URLSearchParams({ ...filters, page: String(page), pageSize: '50' })}`);
        if (active) { setItems(result.data); const present = new Set(result.data.map(row => row.id)); setChecked(previous => previous.size ? new Set([...previous].filter(id => present.has(id))) : previous); setTotal(result.total ?? result.data.length); if (view === 'sheet' && page > Math.max(1, Math.ceil(result.total / 50))) setPage(Math.max(1, Math.ceil(result.total / 50))); }
      } catch (error) { if (active) { setItems([]); setTotal(0); setError(error.message); } } finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [api, clientId, effectiveAccountId, format, stage, focus, search, page, view, dateRange?.from, dateRange?.to, zone, revision]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const filters = { ...(clientId ? { clientId } : {}), ...(effectiveAccountId ? { socialAccountId: effectiveAccountId } : {}), ...(format ? { contentType: format } : {}), ...(focus ? { focus } : {}), search,
          ...(dateRange ? { from: zonedInstant(`${dateRange.from}T00:00`, zone), to: zonedInstant(`${dateRange.to}T00:00`, zone) } : {}) };
        const result = await api(`/posts/summary?${new URLSearchParams(filters)}`);
        if (active) setCounts(result.data);
      } catch { if (active) setCounts(null); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [api, clientId, effectiveAccountId, format, focus, search, dateRange?.from, dateRange?.to, zone, revision]);
  function navigate(next = {}) {
    const params = { ...(clientId ? { clientId } : {}), ...(effectiveAccountId ? { socialAccountId: effectiveAccountId } : {}), ...(view === 'calendar' ? { view } : {}), ...(period ? { period } : {}), ...(focus ? { focus } : {}), ...next };
    router.replace(`/posts?${new URLSearchParams(Object.entries(params).filter(([, value]) => value))}`);
  }
  function changed() { setRevision(value => value + 1); }
  // the other side changed something: reload the list quietly, without blanking the table
  useLiveRefresh(() => { silentRefresh.current = true; setRevision(value => value + 1); });
  // every error also appears as a toast, top right
  useEffect(() => { if (operationError) notifyError(operationError); }, [operationError, notifyError]);
  useEffect(() => { if (error) notifyError(error); }, [error, notifyError]);
  useEffect(() => { if (optionsError) notifyError(optionsError); }, [optionsError, notifyError]);
  function closePanel() { setSelected(null); if (query.has('postId')) navigate({ postId: '' }); }
  async function updateCell(item, fields, version, metrics = false) {
    if (savingRef.current) return; savingRef.current = true; setSaving(item.id); setOperationError(''); setSaveMessage('Saving...');
    try { const result = await api(`/posts/${item.id}${metrics ? '/metrics' : ''}`, { method: 'PATCH', body: { ...fields, updatedAt: version } }); setItems(items => items.map(row => row.id === item.id ? result.data : row)); setSaveMessage('Saved'); }
    catch (error) { setOperationError(error.message); setSaveMessage('Not saved'); changed(); } finally { savingRef.current = false; setSaving(''); }
  }
  async function add(event) {
    event.preventDefault(); if (!canAdd || savingRef.current) return; savingRef.current = true; setSaving('new'); setOperationError('');
    try { const result = await api('/posts', { method: 'POST', body: { socialAccountId: effectiveAccountId, title: newTitle, contentType: newFormat, publishAt: newDate ? zonedInstant(newDate, zone) : null } }); setNewTitle(''); setNewDate(''); setAdding(false); setPage(1); changed(); setSelected(result.data.id); notify('Post added. Write the content and send it for approval.'); }
    catch (error) { setOperationError(error.message); } finally { savingRef.current = false; setSaving(''); }
  }
  async function run(item, action) {
    if (['REVIEW', 'MARK_PUBLISHED', 'METRICS'].includes(action) || action === 'SEND_CONTENT_REVIEW' && !item.script.trim() || action === 'SEND_FINAL_REVIEW' && !item.creativeReference.trim()) { setSelected(item.id); return; }
    if (savingRef.current) return; savingRef.current = true; setSaving(item.id); setOperationError('');
    try { await api(`/posts/${item.id}/actions`, { method: 'POST', body: { action, updatedAt: item.updatedAt } }); changed(); notify(actionMessages[action] || 'Post updated', 'success', { description: item.title }); }
    catch (error) { setOperationError(error.message); changed(); } finally { savingRef.current = false; setSaving(''); }
  }
  const approvalKind = item => item.sheetStage === 'CONTENT_REVIEW' ? 'script' : item.sheetStage === 'FINAL_REVIEW' ? 'final' : null;
  const canApprove = item => !agency && approvalKind(item) !== null && item.socialAccount.active && item.socialAccount.client.status === 'ACTIVE';
  const selectable = agency ? items : items.filter(canApprove), showChecks = agency || selectable.length > 0, allChecked = selectable.length > 0 && selectable.every(item => checked.has(item.id));
  function toggleChecked(id) { setChecked(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function openBulk(mode) { setBulkMode(mode); setBulkResult(null); setOperationError(''); setBulkConfirm(false); }
  function showBulkResult(result, verb) {
    const titles = new Map(items.map(item => [item.id, item.title]));
    setBulkResult({ verb, ok: result.succeeded.length, failed: result.failed.map(row => ({ id: row.id, title: titles.get(row.id) || 'Post', error: row.error })) });
    setChecked(new Set(result.failed.map(row => row.id))); setBulkMode(null); setBulkConfirm(false); changed();
    const done = result.succeeded.length, skipped = result.failed.length, what = bulkVerbs[bulkMode] || verb, posts = count => `${count} post${count === 1 ? '' : 's'}`;
    if (done && !skipped) notify(`${posts(done)} ${what}`);
    else if (done) notify(`${posts(done)} ${what}, ${skipped} skipped`, 'warning', { description: 'See the details above the table.' });
    else if (skipped) notifyError(`Nothing was ${what}`, { description: `${posts(skipped)} skipped. See the details above the table.` });
  }
  async function approveSelected() {
    const rows = items.filter(item => checked.has(item.id) && canApprove(item)), finals = rows.filter(item => approvalKind(item) === 'final').length;
    if (savingRef.current || !rows.length) return;
    if (finals && !bulkConfirm) { setOperationError('Tick the box to confirm you reviewed these exact versions.'); return; }
    savingRef.current = true; setSaving('bulk'); setOperationError('');
    try {
      const result = await api('/approvals/bulk-decision', { method: 'POST', body: { acknowledged: bulkConfirm, items: rows.map(item => ({ id: item.id, version: approvalKind(item) === 'final' ? item.creativeVersion : item.scriptVersion, updatedAt: item.updatedAt })) } });
      showBulkResult(result, 'approved');
    } catch (error) { setOperationError(error.message); } finally { savingRef.current = false; setSaving(''); }
  }
  async function runBulk() {
    if (bulkMode === 'approve') { await approveSelected(); return; }
    if (savingRef.current || !checked.size) return;
    const body = { items: items.filter(item => checked.has(item.id)).map(item => ({ id: item.id, updatedAt: item.updatedAt })) };
    if (bulkMode === 'delete') { if (!bulkConfirm) { setOperationError('Tick the box to confirm you want to delete these posts.'); return; } body.action = 'DELETE'; }
    else if (bulkMode === 'send') body.action = 'SEND_CONTENT_REVIEW';
    else {
      body.action = 'RESCHEDULE';
      if (bulkType === 'shift') { const days = Number(bulkDays); if (!Number.isInteger(days) || days === 0 || Math.abs(days) > 366) { setOperationError('Enter a whole number of days, such as 7 or -2.'); return; } body.shiftDays = days; }
      else { if (!bulkDate) { setOperationError('Choose the new date and time.'); return; } try { body.publishAt = zonedInstant(bulkDate, zone); } catch (error) { setOperationError(error.message); return; } }
    }
    savingRef.current = true; setSaving('bulk'); setOperationError('');
    try {
      const result = await api('/posts/bulk-actions', { method: 'POST', body });
      showBulkResult(result, bulkMode === 'delete' ? 'deleted' : 'updated');
    } catch (error) { setOperationError(error.message); } finally { savingRef.current = false; setSaving(''); }
  }
  const showMetrics = items.some(item => item.sheetStage === 'PUBLISHED');
  const bulkLabels = { send: 'Send for approval', reschedule: 'Reschedule', delete: 'Delete permanently', approve: 'Approve' }, selectedRows = items.filter(item => checked.has(item.id)), publishedSelected = selectedRows.filter(item => item.sheetStage === 'PUBLISHED').length, finalSelected = selectedRows.filter(item => approvalKind(item) === 'final').length, reviewedSelected = selectedRows.filter(item => item.scriptApprovalStatus === 'APPROVED' || item.finalApprovalStatus === 'APPROVED').length;
  const addForm = canAdd ? <form className="sheet-add-row" onSubmit={add}><select aria-label="New post format" value={newFormat} onChange={event => setNewFormat(event.target.value)}>{Object.entries(postFormats).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><input aria-label="New post title" autoFocus required maxLength={200} placeholder="Post title..." value={newTitle} onChange={event => setNewTitle(event.target.value)} /><input aria-label="New post date (optional)" type="datetime-local" value={newDate} onChange={event => setNewDate(event.target.value)} /><button className="button primary" disabled={Boolean(saving)}>{saving === 'new' ? 'Adding...' : 'Add row'}</button></form> : null;
  const todayKey = localDateTime(new Date(), zone).slice(0, 10), activePeriod = period || (view === 'calendar' ? 'month' : '');
  const periodLabel = unit === 'week' ? `${showDay(range.from)} \u2013 ${showDay(addDays(range.to, -1))}` : new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`));
  function shiftPeriod(direction) {
    if (unit === 'week') setAnchor(addDays(anchor, direction * 7));
    else { const date = new Date(`${anchor.slice(0, 7)}-15T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setAnchor(date.toISOString().slice(0, 10)); }
    setPage(1);
  }
  function choosePeriod(value) { setPage(1); navigate({ period: value }); }
  function openAddOn(day) { setNewDate(`${day}T10:00`); setNewTitle(''); setOperationError(''); setAdding(true); }
  const days = []; for (let day = range.from; day < range.to; day = addDays(day, 1)) days.push(day);
  return <>
    <header className="posts-hero">
      <div className="posts-hero-text"><span className="eyebrow">{account ? `${account.client.name} → ${labels[account.platform]} → ${account.handle}` : 'CLIENT → SOCIAL ACCOUNT → POSTS'}</span><h1>Posts<span className="mint-text">.</span></h1><p>Plan, review and publish all your content from one place.</p></div>
      <div className="posts-hero-actions">
        <button className="icon-button posts-refresh" disabled={loading} onClick={changed} title="Refresh" aria-label="Refresh posts"><Icon name="refresh" size={18} /></button>
        {agency && <button className="button secondary" disabled={!canAdd || Boolean(saving)} title={!canAdd ? 'Choose an active social account first.' : undefined} onClick={() => setBulkAdd(true)}><Icon name="list" size={16} />Add many</button>}
        {agency && <button className="button primary" disabled={!canAdd || Boolean(saving)} title={!canAdd ? 'Choose an active social account first.' : undefined} onClick={() => setAdding(value => !value)}><Icon name="plus" size={16} />Add post</button>}
      </div>
    </header>
    <section className="posts-controls card" aria-label="Filters">
      <div className="posts-filter-grid">
        <label className="posts-field"><span>Client</span><select value={clientId} onChange={event => navigate({ clientId: event.target.value, socialAccountId: '' })}><option value="">{agency ? 'All clients' : 'My clients'}</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}{client.status === 'ARCHIVED' ? ' (archived)' : ''}</option>)}</select></label>
        <label className="posts-field"><span>Social account</span><select value={effectiveAccountId} onChange={event => navigate({ socialAccountId: event.target.value })}><option value="">All accounts</option>{accounts.map(account => <option key={account.id} value={account.id}>{!clientId ? `${account.client.name} · ` : ''}{labels[account.platform]} · {account.handle}{!account.active ? ' (inactive)' : ''}</option>)}</select></label>
        <label className="posts-field posts-search"><span>Search</span><div className="posts-search-box"><Icon name="search" size={16} /><input aria-label="Search posts" placeholder="Search by post title..." maxLength={200} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div></label>
        <label className="posts-field"><span>Format</span><select aria-label="Filter format" value={format} onChange={event => { setFormat(event.target.value); setPage(1); }}><option value="">All formats</option>{Object.entries(postFormats).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      </div>
      {!canAdd && agency && <Link className="text-button posts-hint" href={clientId ? `/clients/${clientId}` : '/clients'}>{clients.length ? 'Choose an account or add one →' : 'Create your first Client →'}</Link>}
      <div className="posts-controls-foot">
        <div className="segmented" role="group" aria-label="View"><button className={view === 'sheet' ? 'selected' : ''} aria-pressed={view === 'sheet'} onClick={() => navigate({ view: '' })}><Icon name="list" size={15} />Sheet</button><button className={view === 'calendar' ? 'selected' : ''} aria-pressed={view === 'calendar'} onClick={() => navigate({ view: 'calendar' })}><Icon name="calendar" size={15} />Calendar</button></div>
        <div className="segmented" role="group" aria-label="Date range">{view === 'sheet' && <button className={!activePeriod ? 'selected' : ''} aria-pressed={!activePeriod} onClick={() => choosePeriod('')}>All dates</button>}<button className={activePeriod === 'week' ? 'selected' : ''} aria-pressed={activePeriod === 'week'} onClick={() => choosePeriod('week')}>Weekly</button><button className={activePeriod === 'month' ? 'selected' : ''} aria-pressed={activePeriod === 'month'} onClick={() => choosePeriod('month')}>Monthly</button></div>
        {activePeriod && <div className="period-nav"><button className="button secondary small" aria-label={`Previous ${unit}`} onClick={() => shiftPeriod(-1)}>&lsaquo;</button><strong className="period-label" aria-live="polite">{periodLabel}</strong><button className="button secondary small" aria-label={`Next ${unit}`} onClick={() => shiftPeriod(1)}>&rsaquo;</button><button className="button secondary small" onClick={() => { setAnchor(todayKey); setPage(1); }}>Today</button>{unit === 'week' ? <label><span className="sr-only">Jump to the week of</span><input type="date" value={anchor} onChange={event => { if (event.target.value) { setAnchor(event.target.value); setPage(1); } }} /></label> : <label><span className="sr-only">Calendar month</span><input type="month" value={anchor.slice(0, 7)} onChange={event => { if (event.target.value) { setAnchor(`${event.target.value}-15`); setPage(1); } }} /></label>}</div>}
        
        {focus && <span className="focus-chip">{focusLabels[focus]}<button aria-label={`Clear the ${focusLabels[focus]} filter`} onClick={() => navigate({ focus: '' })}>&times;</button></span>}{view === 'sheet' && period && <span className="muted small-text">Posts without a publish date are hidden while a {period} is selected.</span>}
        <label className="posts-stage-select"><span>Stage</span><select aria-label="Filter by stage" value={stage} onChange={event => { setStage(event.target.value); setPage(1); }}><option value="">All posts{counts ? ` (${counts.total})` : ''}</option>{Object.entries(stageLabels).filter(([key]) => agency || !['DRAFT', 'CANCELLED'].includes(key)).map(([key, value]) => <option key={key} value={key}>{value}{counts ? ` (${counts.stages[key]})` : ''}</option>)}</select></label>
      </div>
    </section>
    {adding && canAdd && (view === 'calendar' ? <Modal title="Add post" subtitle={account ? `${account.client.name} \u00b7 ${account.handle}` : ''} onClose={() => { if (!saving) setAdding(false); }}><div className="modal-body">{addForm}<ErrorBox>{operationError}</ErrorBox></div></Modal> : addForm)}
    {view === 'sheet' && checked.size > 0 && <div className="bulk-bar" role="region" aria-label="Actions for selected posts"><div className="bulk-bar-row"><strong>{checked.size} selected</strong>{!agency && <button className="button primary small" disabled={Boolean(saving)} onClick={() => openBulk('approve')}>Approve selected</button>}{agency && <><button className="button secondary small" disabled={Boolean(saving)} onClick={() => openBulk('send')}>Send for approval</button><button className="button secondary small" disabled={Boolean(saving)} onClick={() => openBulk('reschedule')}>Reschedule</button><button className="button secondary small danger-text" disabled={Boolean(saving)} onClick={() => openBulk('delete')}>Delete</button></>}<button className="text-button" disabled={Boolean(saving)} onClick={() => { setChecked(new Set()); setBulkMode(null); }}>Clear selection</button></div>
      {bulkMode && <div className="bulk-bar-form">
        {bulkMode === 'approve' && <div className="bulk-approve"><p><strong>Approve {checked.size} post{checked.size === 1 ? '' : 's'}?</strong> Open any post below to read it before you approve. Need a change? Leave that post unticked and use Request changes on it.</p>
          <ul className="bulk-approve-list">{selectedRows.map(item => { const final = approvalKind(item) === 'final'; return <li key={item.id}><details><summary><b>{item.title}</b><span>{final ? 'Final creative' : contentLabel(item.contentType)} v{final ? item.creativeVersion : item.scriptVersion}</span></summary><div className="bulk-approve-copy">{final ? <><h4>Final creative</h4><p>{/^https?:\/\//i.test(item.creativeReference) ? <a href={item.creativeReference} target="_blank" rel="noopener noreferrer">{item.creativeReference}</a> : item.creativeReference || 'Review the final text below.'}</p>{item.script && <><h4>Text</h4><p>{item.script}</p></>}<h4>Caption</h4><p>{item.caption || 'No caption.'}</p></> : <><h4>{contentLabel(item.contentType)}</h4><p>{item.script || 'No content yet.'}</p></>}</div></details></li>; })}</ul>
          {finalSelected > 0 && <label className="checkbox-label bulk-approve-ack"><input type="checkbox" checked={bulkConfirm} onChange={event => setBulkConfirm(event.target.checked)} />I have reviewed the exact version of {finalSelected === 1 ? 'the final creative' : `each of the ${finalSelected} final creatives`} listed above.</label>}</div>}
        {bulkMode === 'send' && <p>Send the script or content of {checked.size} selected post{checked.size === 1 ? '' : 's'} to the Client for approval. Posts that are not drafts, or have no content yet, will be skipped.</p>}
        {bulkMode === 'delete' && <div className="bulk-delete-warning"><p><strong>Permanently delete {checked.size} post{checked.size === 1 ? '' : 's'}?</strong> Their content, versions, approvals and footage records are removed and cannot be recovered.</p>{(publishedSelected > 0 || reviewedSelected > 0) && <p className="bulk-delete-extra">{publishedSelected > 0 ? `${publishedSelected} selected post${publishedSelected === 1 ? ' is' : 's are'} already published. ` : ''}{reviewedSelected > 0 ? `${reviewedSelected} ${reviewedSelected === 1 ? 'has' : 'have'} a Client approval on record.` : ''}</p>}<label className="checkbox-label"><input type="checkbox" checked={bulkConfirm} onChange={event => setBulkConfirm(event.target.checked)} />Yes, delete {checked.size === 1 ? 'this post' : `these ${checked.size} posts`} permanently</label></div>}
        {bulkMode === 'reschedule' && <div className="bulk-resched"><label className="checkbox-label"><input type="radio" name="bulk-type" checked={bulkType === 'shift'} onChange={() => setBulkType('shift')} />Move by days</label>{bulkType === 'shift' && <label><span className="sr-only">Days to move</span><input type="number" step={1} min={-366} max={366} value={bulkDays} onChange={event => setBulkDays(event.target.value)} /></label>}{bulkType === 'shift' && <small className="muted">Use a negative number to move earlier. Posts without a date are skipped.</small>}
          <label className="checkbox-label"><input type="radio" name="bulk-type" disabled={!account} checked={bulkType === 'set'} onChange={() => setBulkType('set')} />Set one date &amp; time{!account ? ' (choose a social account first)' : ` (${zone})`}</label>{bulkType === 'set' && <label><span className="sr-only">New date and time</span><input type="datetime-local" value={bulkDate} onChange={event => setBulkDate(event.target.value)} /></label>}</div>}
        <div className="button-row"><button className={`button ${bulkMode === 'delete' ? 'danger' : 'primary'}`} disabled={Boolean(saving) || (bulkMode === 'approve' && finalSelected > 0 && !bulkConfirm)} onClick={runBulk}>{saving === 'bulk' ? 'Working...' : bulkMode === 'approve' ? `Approve ${checked.size} post${checked.size === 1 ? '' : 's'}` : `Confirm: ${bulkLabels[bulkMode]}`}</button><button className="button secondary" disabled={Boolean(saving)} onClick={() => setBulkMode(null)}>Back</button></div></div>}</div>}
    {bulkResult && <div className="bulk-result" role="status"><div><strong>{bulkResult.ok} post{bulkResult.ok === 1 ? '' : 's'} {bulkResult.verb || 'updated'}{bulkResult.failed.length ? `, ${bulkResult.failed.length} skipped` : ''}.</strong>{bulkResult.failed.length > 0 && <ul>{bulkResult.failed.map(row => <li key={row.id}><b>{row.title}</b> — {row.error}</li>)}</ul>}</div><button className="text-button" onClick={() => setBulkResult(null)}>Dismiss</button></div>}
    <ErrorBox>{operationError || error || optionsError}</ErrorBox>{(operationError || error || optionsError) && <button className="button secondary" onClick={() => { setOperationError(''); changed(); }}>Try again</button>}
    <div className="sheet-count"><span>{loading ? 'Loading posts...' : `${total} post${total === 1 ? '' : 's'}`}{account ? ` · ${zone}` : ''}</span><span role="status" className={`save-status ${saveMessage === 'Not saved' ? 'bad' : ''}`}>{saveMessage}</span></div>
    {loading && view === 'sheet' ? <div className="empty" role="status">Loading your planning sheet...</div> : !error && view === 'sheet' && <div className="posts-sheet-scroll" role="region" aria-label="Post planning spreadsheet" tabIndex={0}><table className={`posts-sheet ${agency ? 'has-delete-col' : ''}`}><thead><tr>{showChecks && <th className="sheet-check-cell"><input type="checkbox" aria-label="Select all posts on this page" disabled={!selectable.length || Boolean(saving)} checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(selectable.map(item => item.id)))} /></th>}<th>Format</th><th>Post</th><th>Publish date</th><th>Status</th>{showMetrics && Object.values(metricFields).map(label => <th key={label}>{label}</th>)}<th className="sheet-actions-head">Next step</th>{agency && <th className="sheet-delete-head"><span className="sr-only">Delete</span></th>}</tr></thead><tbody>{items.map(item => { const editable = agency && !['PUBLISHED', 'CANCELLED'].includes(item.sheetStage) && item.socialAccount.active && item.socialAccount.client.status === 'ACTIVE', actions = postActions(item, agency); return <tr key={item.id} className={checked.has(item.id) ? 'is-checked' : ''}>
      {showChecks && <td className="sheet-check-cell">{(agency || canApprove(item)) && <input type="checkbox" aria-label={agency ? `Select ${item.title}` : `Select ${item.title} to approve`} disabled={Boolean(saving)} checked={checked.has(item.id)} onChange={() => toggleChecked(item.id)} />}</td>}
      <td className="sheet-format-cell">{editable && item.sheetStage === 'DRAFT' ? <select className="sheet-format" aria-label={`Format for ${item.title}`} disabled={Boolean(saving)} value={item.contentType} onChange={event => updateCell(item, { contentType: event.target.value }, item.updatedAt)}>{Object.entries(postFormats).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select> : <span className="format-chip">{postFormats[item.contentType]}</span>}</td>
      <td className="sheet-post-title"><div className="sheet-title-row">{editable ? <SheetCell value={item.title} version={item.updatedAt} label={`Title: ${item.title}`} disabled={Boolean(saving)} commit={(title, version) => updateCell(item, { title }, version)} /> : <button className="sheet-title-link" onClick={() => setSelected(item.id)}>{item.title}</button>}<button className="icon-button sheet-open-btn" title="Open details" aria-label={`Open details for ${item.title}`} onClick={() => setSelected(item.id)}><Icon name="panel" size={17} /></button></div>{!account && <small className="sheet-account-line">{item.socialAccount.client.name} &middot; {item.socialAccount.handle}</small>}{item.clientFeedback && <p className="sheet-feedback">{item.clientFeedback}</p>}</td>
      <td className="sheet-date-cell">{editable ? <SheetCell type="datetime-local" value={item.publishAt ? localDateTime(item.publishAt, item.socialAccount.timezone) : ''} version={item.updatedAt} label={`Publish date: ${item.title}`} disabled={Boolean(saving)} commit={(value, version) => { try { updateCell(item, { publishAt: value ? zonedInstant(value, item.socialAccount.timezone) : null }, version); } catch (error) { setError(error.message); } }} /> : <span className="sheet-date-text">{item.publishAt ? showDate(item.publishAt, item.socialAccount.timezone) : <span className="muted">Not scheduled</span>}</span>}</td>
      <td className="wf-td"><StatusCell item={item} agency={agency} /></td>
      {showMetrics && Object.entries(metricFields).map(([field, label]) => <td className="sheet-metric-cell" key={field}>{item.sheetStage === 'PUBLISHED' ? agency ? <SheetCell type="number" min={0} max={4294967295} step={1} value={item[field] == null ? '' : String(item[field])} version={item.updatedAt} label={label + ': ' + item.title} disabled={Boolean(saving)} commit={(value, version) => { try { updateCell(item, { [field]: parseMetric(value) }, version, true); } catch (error) { setOperationError(error.message); } }} /> : item[field] == null ? '—' : item[field].toLocaleString() : <span className="muted">&mdash;</span>}</td>)}
      <td className="sheet-next-action"><div className="sheet-actions">{actions.length ? actions.map(action => <button key={action.key} className="sheet-action-btn" disabled={Boolean(saving)} onClick={() => run(item, action.key)}>{saving === item.id ? 'Saving...' : action.label}</button>) : <span className="sheet-waiting">{['CONTENT_REVIEW', 'FINAL_REVIEW', 'WAITING_FOOTAGE'].includes(item.sheetStage) ? 'Waiting for Client' : item.sheetStage === 'FOOTAGE_SENT' ? 'Agency is checking clips' : stageLabel(item)}</span>}</div></td>{agency && <td className="sheet-delete-cell"> <button className="icon-button sheet-row-delete" disabled={Boolean(saving)} title="Delete post" aria-label={`Delete ${item.title}`} onClick={() => { setChecked(new Set([item.id])); openBulk('delete'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="trash" size={16} /></button></td>}
    </tr>; })}</tbody></table>{!items.length && <Empty icon="list" title="No posts in this view" action={canAdd ? <button className="button primary" onClick={() => setAdding(true)}>Add your first post</button> : null}>{agency ? 'Choose a social account and add a row, or adjust the filters.' : 'Your agency will share content here for you to review.'}</Empty>}</div>}
    {!error && view === 'calendar' && <section className={`sheet-calendar ${unit} ${loading ? 'is-loading' : ''}`} aria-busy={loading}><p className="muted small-text">{zone} &middot; Undated drafts remain in the Sheet view.{loading ? ' Updating...' : ''}</p><div className="sheet-calendar-scroll"><div className="sheet-calendar-grid">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <strong className="sheet-calendar-weekday" key={day}>{day}</strong>)}{days.map((day, index) => { const dayItems = items.filter(item => item.publishAt && localDateTime(item.publishAt, zone).slice(0, 10) === day).sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt)), dayNumber = Number(day.slice(-2)); return <div className={`sheet-calendar-day ${unit === 'month' && day.slice(0, 7) !== anchor.slice(0, 7) ? 'outside' : ''} ${day === todayKey ? 'today' : ''}`} key={day} aria-label={showDay(day)}><span className="sheet-calendar-date"><b>{unit === 'week' ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`)) + ' ' : ''}{dayNumber}{dayNumber === 1 || index === 0 ? ' ' + new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`)) : ''}</b>{canAdd && <button className="icon-button sheet-calendar-add" title="Add post on this day" aria-label={`Add post on ${showDay(day)}`} onClick={() => openAddOn(day)}><Icon name="plus" size={14} /></button>}</span>{dayItems.map(item => <button className={`sheet-calendar-post stage-${item.sheetStage.toLowerCase()}`} key={item.id} onClick={() => setSelected(item.id)}><strong>{new Intl.DateTimeFormat('en-IN', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(item.publishAt))} &middot; {item.title}</strong><small>{postFormats[item.contentType]} &middot; {stageLabel(item)}</small></button>)}</div>; })}</div></div>{!loading && !items.length && <p className="muted small-text sheet-calendar-empty">No posts are scheduled in this {unit}.</p>}</section>}
    {!loading && !error && view === 'sheet' && total > 50 && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 50)}</span><button className="button secondary" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</button></div>}
    {bulkAdd && canAdd && <BulkAddPosts api={api} account={account} zone={zone} onClose={() => setBulkAdd(false)} onDone={(count, withContent) => { setBulkAdd(false); setPage(1); changed(); notify(`${count} post${count === 1 ? '' : 's'} added. ${withContent === count ? 'Tick them and use "Send for approval".' : 'Add the missing scripts, then tick them and use "Send for approval".'}`); }} />}
    {selected && <PostPanel id={selected} agency={agency} api={api} onClose={closePanel} onChanged={changed} />}
  </>;
}
