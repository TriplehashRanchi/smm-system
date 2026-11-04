"use client";
import { useState } from 'react';
import { ErrorBox, Field, labels } from './ui';
import { showDate } from '../lib/planning';
import { useWorkspace } from './workspace';

export default function ClientReview({ detail, agency, api, onSaved }) {
  const { item, state } = detail, zone = item.socialAccount.timezone;
  const { notify, notifyError } = useWorkspace();
  const request = detail.approvalRequests.find((entry) => entry.status === 'PENDING');
  const [feedback, setFeedback] = useState(''), [acknowledged, setAcknowledged] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!request) return null;
  const script = request.kind === 'SCRIPT', needsAcknowledgement = !script && request.reviewLocation !== 'IN_APP';
  const contentName = item.contentType === 'REEL' ? 'Script' : item.contentType === 'CAROUSEL' ? 'Slide content' : item.contentType === 'STORY' ? 'Story content' : 'Content';
  const current = item.socialAccount.active && item.socialAccount.client.status === 'ACTIVE' && request.version === (script ? state.scriptVersion : state.creativeVersion) && state.productionStage === (script ? 'CLIENT_INPUT' : 'CLIENT_FINAL_REVIEW');
  async function submit(event) {
    event.preventDefault(); const decision = event.nativeEvent.submitter?.value;
    if (busy || !current || !['APPROVED', 'CHANGES_REQUESTED'].includes(decision)) return;
    if (decision === 'CHANGES_REQUESTED' && feedback.trim().length < 5) { setError('Please describe the changes you need (at least 5 characters).'); return; }
    setBusy(true); setError('');
    try { const result = await api(`/approvals/${request.id}/decision`, { method: 'POST', body: { updatedAt: item.updatedAt, version: request.version, decision, feedback, acknowledged } }); onSaved(result.data); notify(decision === 'APPROVED' ? (script ? 'Approved. Your agency has been notified' : 'Final approved. Your agency will publish it') : 'Your feedback was sent to the agency', 'success', { description: item.title }); }
    catch (error) { setError(error.message); notifyError(error.message); } finally { setBusy(false); }
  }
  return <section className="card section-card client-review-card">
    <span className="eyebrow">{agency ? 'SENT TO CLIENT' : 'YOUR REVIEW'}</span><h2>{script ? contentName : 'Final creative'} approval · v{request.version}</h2>
    <p><strong>{request.title}</strong><br />{item.socialAccount.client.name} · {labels[item.socialAccount.platform]} · {item.socialAccount.handle}</p>
    <p className="muted small-text">Sent {showDate(request.createdAt, zone)} · Reply by: {request.dueAt ? showDate(request.dueAt, zone) : 'No deadline set'}</p>
    <p className="planning-copy">{request.summary}</p>
    {(script || request.reviewLocation === 'IN_APP') && <><h3>{script ? contentName : 'Final text'}</h3><p className="planning-copy">{request.script || 'No separate copy.'}</p></>}
    {!script && <><h3>Caption / copy</h3><p className="planning-copy">{request.caption || 'No separate caption.'}</p><h3>Creative reference</h3><p className="planning-copy">{request.creativeReference || 'Review the final text above.'}</p>
      {request.reviewLocation === 'WHATSAPP' && <p className="muted">Open the version shared in WhatsApp using this reference, then return here to decide.</p>}
      {request.reviewLocation === 'EXTERNAL' && <a className="button secondary" href={request.previewUrl} target="_blank" rel="noopener noreferrer">Open creative preview</a>}
    </>}
    {!agency && current ? <form onSubmit={submit}>
      <ErrorBox>{error}</ErrorBox><Field label="Your feedback" hint="Required when requesting changes. Visible to your agency."><textarea maxLength={5000} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></Field>
      {needsAcknowledgement && <label className="checkbox-label review-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I reviewed creative v{request.version}, shared {showDate(request.createdAt, zone)} {request.reviewLocation === 'WHATSAPP' ? 'in WhatsApp' : 'through the preview link'}: {request.creativeReference}</span></label>}
      <p className="muted small-text">{script ? state.requiresFootage ? 'After approval, you can record your video and report footage sent.' : 'After approval, your agency can prepare the content.' : 'Approval makes this version ready once all required checks have passed.'}</p>
      <div className="button-row"><button className="button primary" type="submit" value="APPROVED" disabled={busy || needsAcknowledgement && !acknowledged}>{busy ? 'Saving...' : `Approve ${script ? item.contentType === 'REEL' ? 'script' : 'content' : 'creative'} v${request.version}`}</button><button className="button secondary" type="submit" value="CHANGES_REQUESTED" disabled={busy}>Request changes</button></div>
    </form> : <p className="muted">{current ? 'Waiting for a Client to approve or request changes.' : 'Review is paused. Your agency will let you know when it can continue.'}</p>}
  </section>;
}
