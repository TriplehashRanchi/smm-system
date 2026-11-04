"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import { usePlanningOptions } from './planning-options';
import { CalendarNoteForm, PostForm } from './planning-forms';
import PostDetail from './post-detail';
import { ErrorBox, Field, Icon, Modal, labels } from './ui';
import { addDays, calendarRange, localDateTime, weekStart, zonedInstant, allPlanningPages, showDay, planningLabels, planningStatuses, contentFormats } from '../lib/planning';

function ChooseIdea({ clientId, day, options, profile, api, onClose, onSaved }) {
  const [ideas, setIdeas] = useState(null), [error, setError] = useState(''), [id, setId] = useState(''), [chosen, setChosen] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    allPlanningPages(api, '/ideas', clientId ? { clientId } : {}).then((data) => { if (active) { const valid = data.filter((idea) => idea.client.status === 'ACTIVE'); setIdeas(valid); setId(valid[0]?.id || ''); } }).catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, clientId, revision]);
  if (chosen) return <PostForm idea={chosen} day={day} options={options} currentUserId={profile.id} api={api} onClose={onClose} onSaved={onSaved} />;
  return <Modal title="Plan a post" subtitle="Choose the content idea to use." onClose={onClose}><div className="modal-body"><ErrorBox>{error}</ErrorBox>{error && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button>}{!ideas && !error && <p role="status">Loading ideas...</p>}{ideas?.length ? <Field label="Content idea"><select value={id} onChange={(event) => setId(event.target.value)}>{ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.client.name} · {idea.title}</option>)}</select></Field> : ideas && <p>Create a content idea first in the <Link className="text-button" href={`/content${clientId ? `?clientId=${clientId}` : ''}`}>Content library</Link>.</p>}</div><footer className="modal-footer"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={!id || Boolean(error)} onClick={() => setChosen(ideas.find((idea) => idea.id === id))}>Continue</button></footer></Modal>;
}

export default function ContentCalendar() {
  const { profile, api } = useAuth(), { notify } = useWorkspace(), query = useSearchParams();
  const agency = profile.role === 'AGENCY';
  const [view, setView] = useState('month'), [clientId, setClientId] = useState(query.get('clientId') || '');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata'), [anchor, setAnchor] = useState(() => localDateTime(new Date(), 'Asia/Kolkata').slice(0, 10));
  const [platform, setPlatform] = useState(''), [format, setFormat] = useState(''), [status, setStatus] = useState(''), [ownerId, setOwnerId] = useState(''), [search, setSearch] = useState('');
  const [posts, setPosts] = useState([]), [notes, setNotes] = useState([]), [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [auxError, setAuxError] = useState('');
  const [actionError, setActionError] = useState(''), [targetsFailed, setTargetsFailed] = useState(false);
  const [dialog, setDialog] = useState(null), [selected, setSelected] = useState([]), [shift, setShift] = useState(7), [moving, setMoving] = useState(false), [listPage, setListPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const { options, error: optionsError } = usePlanningOptions(api, revision);
  const selectedZone = options?.clients.find((client) => client.id === clientId)?.timezone;
  useEffect(() => { setClientId(query.get('clientId') || ''); }, [query]);
  useEffect(() => { if (selectedZone) setTimeZone(selectedZone); }, [clientId, selectedZone]);
  const range = calendarRange(anchor, view), week = weekStart(anchor);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setAuxError(''); setActionError(''); setTargetsFailed(false); setPosts([]); setNotes([]); setTargets([]); setSelected([]); setListPage(1);
    const timer = setTimeout(async () => {
      try {
        const filters = { from: zonedInstant(`${range.from}T00:00`, timeZone), to: zonedInstant(`${range.to}T00:00`, timeZone),
          ...(clientId ? { clientId } : {}), ...(platform ? { platform } : {}), ...(format ? { contentType: format } : {}), ...(status ? { status } : {}), ...(agency && ownerId ? { ownerId } : {}), ...(search ? { search } : {}) };
        const results = await Promise.allSettled([
          allPlanningPages(api, '/content', filters),
          api(`/planning/notes?${new URLSearchParams({ from: range.from, to: range.to, ...(clientId ? { clientId } : {}) })}`),
          api(`/planning/targets?${new URLSearchParams({ week, ...(clientId ? { clientId } : {}) })}`),
        ]);
        if (!active) return;
        if (results[0].status === 'fulfilled') setPosts(results[0].value); else setError(results[0].reason.message);
        const errors = [];
        if (results[1].status === 'fulfilled') setNotes(results[1].value.data); else errors.push(`Calendar notes: ${results[1].reason.message}`);
        if (results[2].status === 'fulfilled') setTargets(results[2].value.data); else { setTargetsFailed(true); errors.push(`Weekly targets: ${results[2].reason.message}`); }
        setAuxError(errors.join(' '));
      } catch (error) { if (active) setError(error.message); }
      finally { if (active) setLoading(false); }
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [api, range.from, range.to, timeZone, clientId, platform, format, status, ownerId, search, week, agency, revision]);

  function saved(message = 'Content plan saved.') { setDialog(null); setRevision((value) => value + 1); notify(message); }
  function navigate(direction) {
    if (view === 'week') return setAnchor(addDays(anchor, direction * 7));
    const date = new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setAnchor(date.toISOString().slice(0, 10));
  }
  async function reschedule() {
    if (moving) return; setMoving(true); setActionError('');
    try { await api('/content/reschedule', { method: 'POST', body: { ids: selected, days: Number(shift) } }); setSelected([]); setRevision((value) => value + 1); notify('Selected posts rescheduled. Local publish times were preserved.'); }
    catch (error) { setActionError(error.message); } finally { setMoving(false); }
  }
  const canSelect = (item) => agency && item.publishAt && item.status !== 'CANCELLED';
  const checkbox = (item) => canSelect(item) ? <input type="checkbox" aria-label={`Select ${item.title} for rescheduling`} checked={selected.includes(item.id)} disabled={moving || (!selected.includes(item.id) && selected.length >= 100)} onChange={() => setSelected((ids) => ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id])} /> : null;
  const time = (value) => new Intl.DateTimeFormat('en-IN', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => addDays(range.from, index));
  const zones = [...new Set(['Asia/Kolkata', 'UTC', ...(options?.clients.flatMap((client) => [client.timezone, ...client.socialAccounts.map((account) => account.timezone)]) || []), timeZone])];
  const visibleTargets = targets.filter((account) => !platform || account.platform === platform);

  return <>
    <div className="page-heading"><div><span className="eyebrow">A CLEAR PLAN FOR EVERY CHANNEL</span><h1>Content calendar<span className="mint-text">.</span></h1><p>{agency ? 'Plan platform posts, dates and weekly commitments.' : 'Your planned content, shared by your agency. Dates and content are managed by the Agency.'}</p></div><div className="button-row"><button className="button secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>{agency && <><Link className="button secondary" href={`/content${clientId ? `?clientId=${clientId}` : ''}`}>Content library</Link><button className="button primary" disabled={!options} onClick={() => setDialog({ type: 'new', day: anchor })}><Icon name="plus" size={16} />Plan post</button></>}</div></div>
    <ErrorBox>{optionsError}</ErrorBox>
    <div className="calendar-controls"><div className="button-row"><button className="icon-button" aria-label="Previous period" onClick={() => navigate(-1)}><Icon name="chevron-right" style={{ transform: 'rotate(180deg)' }} /></button><strong>{view === 'week' ? `${showDay(range.from)} – ${showDay(addDays(range.to, -1))}` : new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${anchor}T12:00:00Z`))}</strong><button className="icon-button" aria-label="Next period" onClick={() => navigate(1)}><Icon name="chevron-right" /></button><button className="button secondary small" onClick={() => setAnchor(localDateTime(new Date(), timeZone).slice(0, 10))}>Today</button></div>
      <div className="calendar-view-buttons" role="group" aria-label="Calendar view">{['month', 'week', 'list'].map((mode) => <button key={mode} className={view === mode ? 'selected' : ''} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
    </div>
    <div className="planning-filters">
      <label><span>{agency ? 'Client' : 'Business'}</span><select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">{agency ? 'All clients' : 'All my businesses'}</option>{options?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.status === 'ARCHIVED' ? ' (archived)' : ''}</option>)}</select></label>
      <label><span>Platform</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="">All platforms</option>{['INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'YOUTUBE', 'OTHER'].map((platform) => <option key={platform} value={platform}>{labels[platform]}</option>)}</select></label>
      <label><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="">All formats</option>{contentFormats.map((format) => <option key={format} value={format}>{labels[format]}</option>)}</select></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All visible statuses</option>{planningStatuses.filter((status) => agency || ['TENTATIVE', 'IN_PROGRESS', 'APPROVED'].includes(status)).map((status) => <option key={status} value={status}>{planningLabels[status]}</option>)}</select></label>
      {agency && <label><span>Owner</span><select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">All Agency owners</option>{options?.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label>}
      <label><span>Display timezone</span><select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></label>
      <label><span>Search posts</span><input value={search} maxLength={200} placeholder="Find a post..." onChange={(event) => setSearch(event.target.value)} /></label>
    </div>
    <div className="calendar-context"><span>{loading ? 'Loading plan...' : `${posts.length} posts in this period`} · Times displayed in {timeZone}. All-day notes use the business’s local date.</span>{agency && <button className="text-button" disabled={!options} onClick={() => setDialog({ type: 'note', day: anchor })}>+ Calendar note</button>}</div>
    {agency && selected.length > 0 && <div className="bulk-plan-bar"><strong>{selected.length} selected</strong><label>Shift by <input type="number" min={-365} max={365} value={shift} onChange={(event) => setShift(event.target.value)} aria-label="Days to shift selected posts" /> days</label><button className="button primary small" disabled={moving || !Number.isInteger(Number(shift)) || Number(shift) === 0 || Math.abs(Number(shift)) > 365} onClick={reschedule}>{moving ? 'Moving...' : 'Reschedule'}</button><button className="text-button" onClick={() => setSelected([])}>Clear selection</button><small>Preserves each account’s local clock time. Due dates stay as entered.</small></div>}
    <ErrorBox>{[error, auxError, actionError].filter(Boolean).join(' ')}</ErrorBox>{(error || auxError || optionsError) && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Retry loading</button>}
    {loading ? <div className="empty" role="status">Loading content calendar...</div> : error ? null : view === 'list' ? <div className="card table-card"><div className="table-scroll"><table><thead><tr>{agency && <th>Select</th>}<th>Proposed date</th><th>Post</th><th>Account</th><th>Status</th></tr></thead><tbody>{posts.slice((listPage - 1) * 50, listPage * 50).map((item) => <tr key={item.id}>{agency && <td>{checkbox(item)}</td>}<td>{showDay(localDateTime(item.publishAt, timeZone).slice(0, 10))}<small className="table-secondary">{time(item.publishAt)}</small></td><td><button className="text-button" onClick={() => setDialog({ type: 'post', id: item.id })}>{item.title}</button><small className="table-secondary">{labels[item.contentType]}{item.warnings?.length ? ` · ${item.warnings.length} planning checks` : ''}</small></td><td>{item.socialAccount.client.name}<small className="table-secondary">{labels[item.socialAccount.platform]} · {item.socialAccount.handle}</small></td><td><span className={`planning-status ${item.status.toLowerCase()}`}>{planningLabels[item.status]}</span></td></tr>)}</tbody></table></div>{!posts.length && <div className="empty">No posts match this period and these filters.</div>}{posts.length > 50 && <div className="pagination"><button className="button secondary" disabled={listPage === 1} onClick={() => setListPage(listPage - 1)}>Previous</button><span>Page {listPage} of {Math.ceil(posts.length / 50)}</span><button className="button secondary" disabled={listPage * 50 >= posts.length} onClick={() => setListPage(listPage + 1)}>Next</button></div>}</div> : <div className={`calendar-scroll ${view}`} role="region" aria-label={`${view} content calendar`} tabIndex={0}><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => {
      const entries = posts.filter((item) => localDateTime(item.publishAt, timeZone).slice(0, 10) === day);
      const dayNotes = notes.filter((note) => note.date.slice(0, 10) === day);
      return <section key={day} className={`calendar-day ${day.slice(0, 7) !== anchor.slice(0, 7) ? 'outside' : ''} ${day === localDateTime(new Date(), timeZone).slice(0, 10) ? 'today' : ''}`} aria-label={showDay(day)}><div className="calendar-day-heading"><span>{Number(day.slice(-2))}</span>{agency && <button className="icon-button" aria-label={`Plan post on ${showDay(day)}`} disabled={!options} onClick={() => setDialog({ type: 'new', day })}><Icon name="plus" size={14} /></button>}</div>{dayNotes.map((note) => <button className="calendar-note" key={note.id} onClick={() => setDialog({ type: 'note', note })}><Icon name="calendar" size={12} /><span>{note.title}{agency && !note.clientVisible ? " (Internal)" : ""}</span></button>)}{entries.map((item) => <article key={item.id} className={`calendar-entry ${item.status.toLowerCase()}`}>{checkbox(item)}<button onClick={() => setDialog({ type: 'post', id: item.id })}><small>{time(item.publishAt)} · {labels[item.socialAccount.platform]}</small><strong>{item.title}</strong><small>{item.socialAccount.handle} · {planningLabels[item.status]}</small>{item.warnings?.length > 0 && <span className="planning-warning" title={item.warnings.join(' ')}>{item.warnings.length} planning checks</span>}</button></article>)}</section>;
    })}</div></div>}
    {!loading && !error && !posts.length && <p className="calendar-empty-hint">{agency ? 'No posts here yet. Create an idea in the Content library, then plan its platform posts.' : 'No shared posts in this period. Your agency will add planned content here.'}</p>}
    {view === 'list' && notes.length > 0 && <section className="card section-card"><h2>Calendar notes</h2><div className="calendar-note-list">{notes.map((note) => <button key={note.id} onClick={() => setDialog({ type: 'note', note })}><strong>{note.title}</strong><small>{showDay(note.date.slice(0, 10))} · {note.client.name}</small></button>)}</div></section>}
    <section className="card section-card weekly-plan"><div className="section-title"><div><h2>Weekly planned vs target</h2><p className="muted">Week of {showDay(week)}. Full-week totals use each account’s timezone and are independent of calendar search/status filters.{!agency && ' Counts include only posts shared with you.'}</p></div><label className="weekly-date-picker">Choose week<input type="date" value={anchor} onChange={(event) => { if (event.target.value) setAnchor(event.target.value); }} /></label></div>{loading ? <p className="muted" role="status">Loading weekly targets...</p> : targetsFailed ? <p className="muted">Weekly counts are unavailable. Use Retry loading above.</p> : !visibleTargets.length ? <p className="muted">No active social accounts in this selection.</p> : <div className="weekly-target-grid">{visibleTargets.map((account) => <article key={account.id}><strong>{account.client.name}</strong><small>{labels[account.platform]} · {account.handle} · {account.timezone}</small>{account.commitments.length ? account.commitments.map((target) => <div key={target.contentType} className="target-comparison"><span>{labels[target.contentType]}</span><b>{target.planned} / {target.target} planned</b></div>) : <p>{account.planned} planned · No weekly target set</p>}{agency && <Link className="text-button" href={`/clients/${account.clientId}`}>Manage weekly targets</Link>}</article>)}</div>}</section>
    {dialog?.type === 'new' && agency && options && <ChooseIdea clientId={clientId} day={dialog.day} options={options} profile={profile} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Platform posts created.')} />}
    {dialog?.type === 'post' && options && <PostDetail id={dialog.id} agency={agency} options={options} currentUserId={profile.id} api={api} onClose={() => setDialog(null)} onSaved={() => saved()} />}
    {dialog?.type === 'note' && agency && options && <CalendarNoteForm note={dialog.note} day={dialog.day} clientId={clientId} options={options} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Calendar note saved.')} />}
    {dialog?.type === 'note' && !agency && dialog.note && <Modal title={dialog.note.title} subtitle={`${dialog.note.client.name} · ${showDay(dialog.note.date.slice(0, 10))}`} onClose={() => setDialog(null)}><div className="modal-body planning-detail"><span className="badge neutral">{planningLabels[dialog.note.kind]}</span><p className="planning-copy">{dialog.note.body || 'No additional details.'}</p><small className="muted">All-day date in {dialog.note.client.timezone}.</small></div><footer className="modal-footer"><button className="button secondary" onClick={() => setDialog(null)}>Close</button></footer></Modal>}
  </>;
}
