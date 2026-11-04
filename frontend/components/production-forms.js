"use client";
import { useState } from 'react';
import { ErrorBox, Field } from './ui';
import { zonedInstant } from '../lib/planning';
import { isApprovalAction, productionLabels } from '../lib/production';

export function ProductionActionForm({ detail, api, onSaved }) {
  const { item, state, actions, handoffs } = detail;
  const zone = item.socialAccount.timezone;
  const [action, setAction] = useState(''), [reason, setReason] = useState(''), [feedback, setFeedback] = useState('');
  const [shootLocal, setShootLocal] = useState(''), [occurredLocal, setOccurredLocal] = useState('');
  const [source, setSource] = useState('WHATSAPP'), [reference, setReference] = useState(''), [verificationNote, setVerificationNote] = useState('');
  const [channel, setChannel] = useState('GROUP'), [channelName, setChannelName] = useState(''), [senderName, setSenderName] = useState('');
  const [description, setDescription] = useState(''), [sentLocal, setSentLocal] = useState(''), [clipCount, setClipCount] = useState(''), [messageReference, setMessageReference] = useState('');
  const [reviewSummary, setReviewSummary] = useState(''), [reviewLocation, setReviewLocation] = useState(item.contentType === 'LINKEDIN_TEXT' ? 'IN_APP' : 'WHATSAPP'), [previewUrl, setPreviewUrl] = useState(''), [actionDue, setActionDue] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const chosen = actions.find((entry) => entry.key === action);
  const latest = handoffs.find((entry) => entry.sequence === state.handoffVersion);
  const needsReason = ['HOLD', 'CANCEL', 'REOPEN_DRAFTING', 'QA_FAIL'].includes(action);
  const needsFeedback = ['REQUEST_MORE_FOOTAGE', 'RECORD_SCRIPT_CHANGES', 'RECORD_FINAL_CHANGES'].includes(action);
  const requestingReview = ['REQUEST_SCRIPT_APPROVAL', 'REQUEST_FINAL_REVIEW'].includes(action);
  const requestingClient = requestingReview || ['REQUEST_CLIENT_FOOTAGE', 'REQUEST_MORE_FOOTAGE'].includes(action);
  async function submit(event) {
    event.preventDefault(); if (busy || !chosen || chosen.blocked) return; setBusy(true); setError('');
    try {
      const body = { action, updatedAt: item.updatedAt };
      if (action === 'SCHEDULE_SHOOT') body.shootAt = zonedInstant(shootLocal, zone);
      if (action === 'COMPLETE_SHOOT' && occurredLocal) body.occurredAt = zonedInstant(occurredLocal, zone);
      if (isApprovalAction(action)) Object.assign(body, { source, reference, version: action.startsWith('RECORD_SCRIPT') ? state.scriptVersion : state.creativeVersion });
      if (action.startsWith('QA_')) body.version = state.creativeVersion;
      if (needsReason || action === 'QA_PASS') body.reason = reason;
      if (needsFeedback) body.feedback = feedback;
      if (requestingClient) body.clientActionDueAt = actionDue ? zonedInstant(actionDue, zone) : null;
      if (requestingReview) { body.reviewSummary = reviewSummary; if (action === 'REQUEST_FINAL_REVIEW') { body.reviewLocation = reviewLocation; if (reviewLocation === 'EXTERNAL') body.previewUrl = previewUrl; } }
      if (['VERIFY_FOOTAGE', 'REQUEST_MORE_FOOTAGE'].includes(action)) Object.assign(body, { handoffId: latest?.id, verificationNote });
      if (action === 'REPORT_FOOTAGE') body.handoff = { channel, channelName, senderName, description, sentAt: sentLocal ? zonedInstant(sentLocal, zone) : null, clipCount: clipCount ? Number(clipCount) : null, messageReference };
      const result = await api(`/production/${item.id}/actions`, { method: 'POST', body });
      onSaved(result.data);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  if (!actions.length) return <p className="muted">There are no actions for your role at this stage. See the next action above.</p>;
  return <form className="production-action-form" onSubmit={submit}>
    <h2>Update workflow</h2><ErrorBox>{error}</ErrorBox>
    <Field label="Action"><select required value={action} onChange={(event) => { setAction(event.target.value); setError(''); }}><option value="">Choose an action</option>{actions.map((entry) => <option key={entry.key} value={entry.key} disabled={Boolean(entry.blocked)}>{entry.label}{entry.blocked ? ' (blocked)' : ''}</option>)}</select></Field>
    {actions.some((entry) => entry.blocked) && <details className="workflow-blocks"><summary>Why some actions are blocked</summary>{actions.filter((entry) => entry.blocked).map((entry) => <p key={entry.key}><strong>{entry.label}:</strong> {entry.blocked}</p>)}</details>}
    {requestingReview && <Field label="Summary for the client" hint="Describe what to review in this version."><textarea required={action === 'REQUEST_FINAL_REVIEW'} minLength={action === 'REQUEST_FINAL_REVIEW' ? 5 : undefined} maxLength={2000} rows={3} value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} /></Field>}
    {action === 'REQUEST_FINAL_REVIEW' && <><Field label="Where can the client review the creative?"><select value={reviewLocation} onChange={(event) => setReviewLocation(event.target.value)}>{item.contentType === 'LINKEDIN_TEXT' ? <option value="IN_APP">Text shown in this app</option> : <><option value="WHATSAPP">Shared in WhatsApp</option><option value="EXTERNAL">External preview link</option></>}</select></Field>{reviewLocation === 'EXTERNAL' && <Field label="Creative preview URL"><input type="url" required maxLength={2000} value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} /></Field>}</>}
    {requestingClient && <Field label="Client action due (optional)" hint={`Shared with the client. Uses ${zone}.`}><input type="datetime-local" value={actionDue} onChange={(event) => setActionDue(event.target.value)} /></Field>}
    {action === 'SCHEDULE_SHOOT' && <Field label="Shoot date & time" hint={zone}><input type="datetime-local" required value={shootLocal} onChange={(event) => setShootLocal(event.target.value)} /></Field>}
    {action === 'COMPLETE_SHOOT' && <Field label="Actual completion time (optional)" hint={`Uses ${zone}. Leave blank to record completion now.`}><input type="datetime-local" value={occurredLocal} onChange={(event) => setOccurredLocal(event.target.value)} /></Field>}
    {isApprovalAction(action) && <>
      <p className="alert">Recording an external client decision for {action.startsWith('RECORD_SCRIPT') ? `script v${state.scriptVersion}` : `creative v${state.creativeVersion}`}. This is recorded by the Agency, not an in-app Client approval.</p>
      {action === 'RECORD_FINAL_APPROVED' && !state.allowExternalFinalApproval && <p className="muted small-text">This records the external confirmation. The Client must still approve here before the item becomes Ready.</p>}
      <Field label="Decision received through"><select value={source} onChange={(event) => setSource(event.target.value)}>{['WHATSAPP', 'EMAIL', 'PHONE', 'OTHER'].map((source) => <option key={source}>{source}</option>)}</select></Field>
      <Field label="Decision reference" hint="Describe the client's confirmation and where to find it. A link is optional."><textarea required minLength={5} maxLength={5000} rows={3} value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
    </>}
    {needsReason || action === 'QA_PASS' ? <Field label={action.startsWith('QA_') ? 'Internal QA note' : 'Reason'} hint="Visible only to the Agency."><textarea required={needsReason} minLength={needsReason ? 5 : undefined} maxLength={5000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : null}
    {needsFeedback && <Field label="Feedback for the client" hint="Visible to this client. State the changes or missing clips clearly."><textarea required minLength={5} maxLength={5000} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></Field>}
    {['VERIFY_FOOTAGE', 'REQUEST_MORE_FOOTAGE'].includes(action) && <>
      <p className="muted small-text">Checking latest footage report #{latest?.sequence || '—'}. Confirm the actual files in WhatsApp before recording the result.</p>
      <Field label="Internal verification note" hint="Agency-only. Describe the clips checked and any quality issues."><textarea required={action === 'VERIFY_FOOTAGE'} minLength={action === 'VERIFY_FOOTAGE' ? 5 : undefined} maxLength={5000} rows={3} value={verificationNote} onChange={(event) => setVerificationNote(event.target.value)} /></Field>
    </>}
    {action === 'REPORT_FOOTAGE' && <>
      <p className="alert">Send the footage in WhatsApp first. This form records reference details; it does not upload files or verify receipt.</p>
      <div className="planning-form-grid"><Field label="Channel"><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="GROUP">WhatsApp group</option><option value="DM">WhatsApp direct message</option></select></Field><Field label="Group / contact name (optional)"><input maxLength={160} value={channelName} onChange={(event) => setChannelName(event.target.value)} /></Field></div>
      <Field label="Reported sender (optional)"><input maxLength={160} value={senderName} onChange={(event) => setSenderName(event.target.value)} /></Field>
      <Field label="File / clip description (optional)"><textarea maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <div className="planning-form-grid"><Field label="Reported send time (optional)" hint={zone}><input type="datetime-local" value={sentLocal} onChange={(event) => setSentLocal(event.target.value)} /></Field><Field label="Number of clips (optional)"><input type="number" min={1} max={1000} value={clipCount} onChange={(event) => setClipCount(event.target.value)} /></Field></div>
      <Field label="Message reference (optional)" hint="A short description, message timestamp or link can help locate it."><textarea maxLength={2000} rows={2} value={messageReference} onChange={(event) => setMessageReference(event.target.value)} /></Field>
    </>}
    <button className="button primary" disabled={busy || !chosen || Boolean(chosen.blocked)}>{busy ? 'Saving...' : chosen?.label || 'Record action'}</button>
  </form>;
}

export function ProductionMetadataForm({ detail, api, onSaved }) {
  const { item, state } = detail;
  const [notes, setNotes] = useState(state.internalProductionNotes || ''), [reference, setReference] = useState(state.creativeReference || '');
  const [script, setScript] = useState(state.requiresScriptApproval), [footage, setFootage] = useState(state.requiresFootage), [final, setFinal] = useState(state.requiresFinalApproval);
  const [externalFinal, setExternalFinal] = useState(state.allowExternalFinalApproval);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const policyEditable = ['PLANNED', 'DRAFTING'].includes(state.productionStage);
  const policyChanged = script !== state.requiresScriptApproval || footage !== state.requiresFootage || final !== state.requiresFinalApproval || externalFinal !== state.allowExternalFinalApproval;
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const body = { updatedAt: item.updatedAt, internalProductionNotes: notes, creativeReference: reference };
      if (policyChanged) Object.assign(body, { requiresScriptApproval: script, requiresFootage: footage, requiresFinalApproval: final, allowExternalFinalApproval: externalFinal, reason });
      const result = await api(`/production/${item.id}`, { method: 'PATCH', body }); onSaved(result.data);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}><h2>Production details</h2><ErrorBox>{error}</ErrorBox>
    <Field label="Final creative reference" hint="Shared with this client. Describe the final file/version or where it was sent; no upload or link is required."><textarea rows={3} maxLength={5000} value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
    <Field label="Internal production notes" hint="Visible only to the Agency."><textarea rows={4} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    <details className="workflow-policy"><summary>Workflow requirements</summary><p className="muted small-text">Change requirements while planned or drafting. Explain every policy change. Carousels, static creatives, documents and text posts skip shooting.</p>
      <label className="checkbox-label"><input type="checkbox" disabled={!policyEditable} checked={script} onChange={(event) => setScript(event.target.checked)} />Require script / copy approval</label>
      <label className="checkbox-label"><input type="checkbox" disabled={!policyEditable || !['REEL', 'STORY', 'OTHER'].includes(item.contentType)} checked={footage} onChange={(event) => setFootage(event.target.checked)} />Require client shooting and footage</label>
      <label className="checkbox-label"><input type="checkbox" disabled={!policyEditable} checked={final} onChange={(event) => setFinal(event.target.checked)} />Require final client approval</label>
      <label className="checkbox-label"><input type="checkbox" disabled={!policyEditable} checked={externalFinal} onChange={(event) => setExternalFinal(event.target.checked)} />Allow a recorded external final approval to release this item</label>
      {policyChanged && <Field label="Reason for changing requirements"><textarea required minLength={5} maxLength={5000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}
    </details>
    <p className="muted small-text">Changing the creative reference creates a new creative version and resets affected QA and approval checks.</p>
    <button className="button primary" disabled={busy}>{busy ? 'Saving...' : 'Save production details'}</button>
  </form>;
}
