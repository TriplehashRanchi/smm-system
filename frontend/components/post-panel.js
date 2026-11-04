"use client";
import { useEffect, useState } from 'react';
import { Modal, Field, ErrorBox } from './ui';
import ClientReview from './client-review';
import { useWorkspace } from './workspace';
import { WorkflowStrip } from './workflow-status';
import PostMetrics from './post-metrics';
import { localDateTime, zonedInstant, showDate } from '../lib/planning';
import { postFormats, postActions, contentLabel, stageLabel, stageFor } from '../lib/posts';

const panelMessages = { SEND_CONTENT_REVIEW: 'Sent to the client for approval', REPORT_FOOTAGE: 'Footage marked as sent', START_WORK: 'Clips received, editing started', REQUEST_MORE_FOOTAGE: 'Sent back to the client for more footage', SEND_FINAL_REVIEW: 'Final sent to the client for approval', MARK_PUBLISHED: 'Marked as published', CANCEL: 'Post cancelled' };
function PostPanelContent({ detail, agency, api, updated, onActionError }) {
  const { notify, notifyError } = useWorkspace();
  const { item, state } = detail, zone = item.socialAccount.timezone, stage = stageFor(item, state), readOnly = !agency || ['PUBLISHED', 'CANCELLED'].includes(stage);
  const [title, setTitle] = useState(item.title), [format, setFormat] = useState(item.contentType), [script, setScript] = useState(item.script), [caption, setCaption] = useState(item.caption);
  const [publishLocal, setPublishLocal] = useState(item.publishAt ? localDateTime(item.publishAt, zone) : ''), [reference, setReference] = useState(state.creativeReference || ''), [notes, setNotes] = useState(state.internalProductionNotes || '');
  const [actualLocal, setActualLocal] = useState(localDateTime(new Date(), zone)), [publishedUrl, setPublishedUrl] = useState(''), [cancelReason, setCancelReason] = useState('');
  const [missingClips, setMissingClips] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function saveIfDirty() {
    const input = { title, contentType: format, script, caption, publishAt: publishLocal ? zonedInstant(publishLocal, zone) : null, creativeReference: reference, internalProductionNotes: notes };
    const dirty = Object.entries(input).some(([key, value]) => value !== (key === 'creativeReference' || key === 'internalProductionNotes' ? state[key] || '' : item[key]));
    if (!dirty) return item.updatedAt;
    const result = await api(`/posts/${item.id}`, { method: 'PATCH', body: { ...input, updatedAt: item.updatedAt } }); return result.data.updatedAt;
  }
  async function save(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await saveIfDirty(); updated((await api(`/posts/${item.id}`)).data); notify('Changes saved', 'success', { description: item.title }); } catch (error) { setError(error.message); notifyError(error.message); } finally { setBusy(false); }
  }
  async function act(action) {
    if (busy) return; setBusy(true); setError('');
    let savedAt = item.updatedAt;
    try {
      const updatedAt = agency && !readOnly ? await saveIfDirty() : item.updatedAt;
      savedAt = updatedAt;
      const body = { updatedAt, action, ...(action === 'MARK_PUBLISHED' ? { publishedAt: zonedInstant(actualLocal, zone), publishedUrl } : {}), ...(action === 'CANCEL' ? { note: cancelReason } : {}), ...(action === 'REQUEST_MORE_FOOTAGE' ? { note: missingClips } : {}) };
      const result = await api(`/posts/${item.id}/actions`, { method: 'POST', body }); updated(result.data); notify(panelMessages[action] || 'Post updated', 'success', { description: item.title });
    } catch (error) { notifyError(error.message); if (savedAt !== item.updatedAt) { try { updated((await api(`/posts/${item.id}`)).data); onActionError(error.message); } catch { setError(error.message); } } else setError(error.message); } finally { setBusy(false); }
  }
  const actions = postActions(item, agency, state).filter(action => !['REVIEW', 'METRICS'].includes(action.key));
  return <div className="post-panel-content">
    <p className="post-panel-stage"><strong>{stageLabel(item, state)}</strong><span>{postFormats[item.contentType]} · {zone}</span></p>
    <WorkflowStrip item={item} state={state} agency={agency} />
    <ErrorBox>{error}</ErrorBox>
    <ClientReview key={`review-${item.updatedAt}`} detail={detail} agency={agency} api={api} onSaved={updated} />
    {state.clientFeedback && <div className="alert"><strong>Client feedback</strong><p>{state.clientFeedback}</p></div>}
    {readOnly ? <section className="post-copy"><h3>{contentLabel(item.contentType)}</h3><p className="planning-copy">{item.script || 'Content is being prepared.'}</p><h3>Caption</h3><p className="planning-copy">{item.caption || '—'}</p><h3>Final file / WhatsApp reference</h3><p className="planning-copy">{state.creativeReference || '—'}</p></section> : <form onSubmit={save}>
      <Field label="Post title"><input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></Field>
      <div className="planning-form-grid"><Field label="Format"><select disabled={stage !== 'DRAFT'} value={format} onChange={event => setFormat(event.target.value)}>{Object.entries(postFormats).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Publish date & time (optional)" hint={zone}><input type="datetime-local" value={publishLocal} onChange={event => setPublishLocal(event.target.value)} /></Field></div>
      <Field label={contentLabel(format)} hint={format === 'CAROUSEL' ? 'Write each slide on a new line: Slide 1, Slide 2…' : undefined}><textarea rows={6} maxLength={10000} value={script} onChange={event => setScript(event.target.value)} /></Field>
      <Field label="Caption (optional)"><textarea rows={3} maxLength={10000} value={caption} onChange={event => setCaption(event.target.value)} /></Field>
      <Field label="Final file / WhatsApp reference" hint="Describe the final file shared in WhatsApp, or paste its preview link."><textarea rows={2} maxLength={5000} value={reference} onChange={event => setReference(event.target.value)} /></Field>
      <details className="client-optional-fields"><summary>Internal notes (optional)</summary><Field label="Agency-only notes"><textarea rows={3} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} /></Field></details>
      <button className="button secondary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
    </form>}
    {stage === 'WAITING_FOOTAGE' && <p className="muted">Record the video and send the clips in WhatsApp, then mark footage sent here.</p>}
    {agency && stage === 'FOOTAGE_SENT' && <p className="muted">Check that the WhatsApp clips are received and usable before starting editing.</p>}
    {agency && stage === 'READY' && <section className="post-publication"><h3>Record manual publication</h3><p className="muted">Use this after publishing on the social account.</p><Field label="Actual publication time" hint={zone}><input type="datetime-local" required value={actualLocal} onChange={event => setActualLocal(event.target.value)} /></Field><Field label="Published post link (optional)"><input type="url" maxLength={2000} value={publishedUrl} onChange={event => setPublishedUrl(event.target.value)} /></Field></section>}
    {actions.length > 0 && <div className="post-panel-actions">{actions.map(action => <button className="button primary" key={action.key} disabled={busy} onClick={() => act(action.key)}>{busy ? 'Saving...' : action.label}</button>)}</div>}
    {agency && !readOnly && state.requiresFootage && ['REPORTED_SENT', 'VERIFIED_RECEIVED'].includes(state.footageStatus) && <details className="post-history"><summary>Missing clips or a reshoot?</summary><Field label="Feedback for the Client"><textarea minLength={5} maxLength={5000} rows={3} value={missingClips} onChange={event => setMissingClips(event.target.value)} /></Field><button className="button secondary" disabled={busy || missingClips.trim().length < 5} onClick={() => act('REQUEST_MORE_FOOTAGE')}>Request more clips</button></details>}
    {item.publishedAt && <section className="post-publication"><h3>Published</h3><p>{showDate(item.publishedAt, zone)}</p>{item.publishedUrl && <a className="text-button" target="_blank" rel="noopener noreferrer" href={item.publishedUrl}>Open published post</a>}</section>}
    {stage === 'PUBLISHED' && <PostMetrics key={`metrics-${item.updatedAt}`} item={item} agency={agency} api={api} onSaved={updated} />}
    <details className="post-history"><summary>Feedback and history</summary>{detail.timeline.data.map(event => <article className="production-event" key={event.id}><strong>{event.summary}</strong><small>{event.actor.name} · {showDate(event.createdAt, zone)}</small></article>)}{detail.approvalRequests.filter(request => request.decision).map(request => <article className="approval-record" key={request.id}><strong>{request.kind === 'SCRIPT' ? 'Content' : 'Final'} v{request.version} · {request.decision.decision === 'APPROVED' ? 'Approved' : 'Changes requested'}</strong><small>{request.decision.recordedBy.name} · {showDate(request.decision.createdAt, zone)}</small><p>{request.decision.feedback}</p></article>)}</details>
    {agency && !readOnly && <details className="post-history"><summary>Cancel post</summary><Field label="Reason"><textarea rows={2} minLength={5} maxLength={5000} value={cancelReason} onChange={event => setCancelReason(event.target.value)} /></Field><button className="text-button danger-text" disabled={busy || cancelReason.trim().length < 5} onClick={() => act('CANCEL')}>Cancel this post</button></details>}
  </div>;
}
export default function PostPanel({ id, agency, api, onClose, onChanged }) {
  const [detail, setDetail] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setDetail(null); setError(''); api(`/posts/${id}`).then(result => { if (active) setDetail(result.data); }).catch(error => { if (active) setError(error.message); }); return () => { active = false; }; }, [id, api, retry]);
  function updated(value) { setError(''); setDetail(value); onChanged(); }
  return <Modal title={detail?.item.title || 'Post details'} subtitle={detail ? `${detail.item.socialAccount.client.name} · ${detail.item.socialAccount.handle}` : undefined} onClose={onClose}><div className="modal-body post-panel-body"><ErrorBox>{error}</ErrorBox>{error && <button className="button secondary" onClick={() => setRetry(value => value + 1)}>Try again</button>}{detail ? <PostPanelContent key={detail.item.updatedAt} detail={detail} agency={agency} api={api} updated={updated} onActionError={setError} /> : !error && <p role="status">Loading post...</p>}</div></Modal>;
}
