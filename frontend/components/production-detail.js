"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import { usePlanningOptions } from './planning-options';
import { ProductionActionForm, ProductionMetadataForm } from './production-forms';
import { PostForm } from './planning-forms';
import { ErrorBox, Icon, labels } from './ui';
import { allPlanningPages, planningLabels, showDate } from '../lib/planning';
import { productionLabels } from '../lib/production';
import ClientReview from './client-review';

export default function ProductionDetail() {
  const { id } = useParams(), { profile, api } = useAuth(), { notify } = useWorkspace();
  const agency = profile.role === 'AGENCY';
  const [detail, setDetail] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0), [editing, setEditing] = useState(false);
  const [history, setHistory] = useState([]), [historyTotal, setHistoryTotal] = useState(0), [historyPage, setHistoryPage] = useState(1), [historyBusy, setHistoryBusy] = useState(false);
  const [snapshots, setSnapshots] = useState([]), [snapshotsError, setSnapshotsError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const { options, error: optionsError } = usePlanningOptions(api);
  useEffect(() => {
    let active = true; setDetail(null); setError(''); setHistory([]); setHistoryTotal(0); setHistoryPage(1); setSnapshots([]); setHistoryError(''); setSnapshotsError('');
    api(`/production/${id}`).then((result) => { if (active) { setDetail(result.data); setHistory(result.data.timeline.data); setHistoryTotal(result.data.timeline.total); setSnapshots(result.data.revisions); } }).catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, id, revision]);
  function updated(value) { setDetail(value); setHistory(value.timeline.data); setHistoryTotal(value.timeline.total); setHistoryPage(1); setSnapshots(value.revisions); notify('Production updated.'); }
  async function moreHistory() {
    if (historyBusy) return; setHistoryBusy(true); setHistoryError('');
    try { const result = await api(`/production/${id}/history?page=${historyPage + 1}&pageSize=30`); setHistory((events) => [...events, ...result.data]); setHistoryPage(historyPage + 1); setHistoryTotal(result.total); } catch (error) { setHistoryError(error.message); } finally { setHistoryBusy(false); }
  }
  async function allRevisions() {
    setSnapshotsError('');
    try { setSnapshots(await allPlanningPages(api, `/production/${id}/revisions`)); } catch (error) { setSnapshotsError(error.message); }
  }
  if (!detail) return <><Link className="text-button back-button" href="/production">← Production</Link><ErrorBox>{error}</ErrorBox>{error ? <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button> : <div className="empty" role="status">Loading production details...</div>}</>;
  const { item, state, gates, nextAction } = detail, zone = item.socialAccount.timezone;
  const pipeline = ['PLANNED', 'DRAFTING', ...(state.requiresFootage || state.requiresScriptApproval ? ['CLIENT_INPUT'] : []), ...(item.contentType !== 'LINKEDIN_TEXT' ? ['PRODUCTION'] : []), 'INTERNAL_REVIEW', ...(state.requiresFinalApproval ? ['CLIENT_FINAL_REVIEW'] : []), 'READY'];
  return <>
    <Link className="text-button back-button" href="/production">← Production work queue</Link>
    <div className="page-heading"><div><span className="eyebrow">{item.socialAccount.client.name} · {labels[item.socialAccount.platform]} · {item.socialAccount.handle}</span><h1>{item.title}</h1><p>{labels[item.contentType]} · Proposed publish: {showDate(item.publishAt, zone)} · {zone}</p></div><div className="button-row"><Link className="button secondary" href={`/calendar?clientId=${item.socialAccount.client.id}`}>Calendar</Link>{agency && state.productionStage !== 'CANCELLED' && <button className="button primary" disabled={!options} onClick={() => setEditing(true)}>Edit post / owner</button>}</div></div>
    <ErrorBox>{optionsError}</ErrorBox><ErrorBox>{error}</ErrorBox>
    <section className={`production-next ${nextAction.actor.toLowerCase()}`}><Icon name="progress" size={24} /><div><span className="eyebrow">NEXT ACTION · {productionLabels[nextAction.actor]}</span><h2>{nextAction.text}</h2>{agency && <p>Owner: {item.owner?.name || 'Unassigned'} · Contributor: {item.contributor?.name || 'None'} · Due: {showDate(item.dueAt, zone)}</p>}{state.clientFeedback && <p className="production-feedback">Feedback: {state.clientFeedback}</p>}{agency && state.holdReason && <p className="muted">Internal reason: {state.holdReason}</p>}</div></section>
    <div className="production-pipeline" role="list" aria-label="Format-specific production stages">{pipeline.map((stage) => <span role="listitem" key={stage} className={state.productionStage === stage ? 'current' : ''}>{productionLabels[stage]}</span>)}{['ON_HOLD', 'CANCELLED'].includes(state.productionStage) && <span className="current">{productionLabels[state.productionStage]}</span>}</div>
    <div className="production-layout"><div>
      <ClientReview key={`review-${item.updatedAt}`} detail={detail} agency={agency} api={api} onSaved={updated} />
      <section className="card section-card"><div className="section-title"><h2>Required checks</h2><span className="badge neutral">{productionLabels[state.productionStage]}</span></div><div className="production-gates">{[
        { label: `Script / copy v${state.scriptVersion}`, required: state.requiresScriptApproval, status: state.scriptApprovalStatus, passed: gates.script },
        { label: 'Latest footage', required: state.requiresFootage, status: state.footageStatus, passed: gates.footage },
        { label: `Internal QA · creative v${state.creativeVersion}`, required: true, status: state.qaStatus, passed: gates.qa },
        { label: `Final approval · creative v${state.creativeVersion}`, required: state.requiresFinalApproval, status: state.finalApprovalStatus, passed: gates.final },
      ].map((gate) => <div key={gate.label}><span>{gate.label}</span><strong className={gate.passed ? 'passed' : 'pending'}>{!gate.required ? 'Not required' : productionLabels[gate.status]}</strong></div>)}</div><p className="muted small-text">Client decisions apply to the exact version requested. Editing content resets the affected checks.</p>{state.clientActionDueAt && <p className="muted small-text">Client action due: {showDate(state.clientActionDueAt, zone)}</p>}</section>
      {(agency || detail.actions.some((action) => !action.blocked)) && <section className="card section-card"><ProductionActionForm key={item.updatedAt} detail={detail} api={api} onSaved={updated} /></section>}
      {state.requiresFootage && <section className="card section-card"><h2>Shooting & WhatsApp handoffs</h2><p className="muted small-text">Files stay in WhatsApp. These are reference details and human verification records.</p><dl className="production-dates"><dt>Shoot status</dt><dd>{productionLabels[state.shootStatus]}</dd><dt>Scheduled shoot</dt><dd>{showDate(state.shootAt, zone)}</dd><dt>Completed</dt><dd>{state.shootCompletedAt ? showDate(state.shootCompletedAt, zone) : 'Not recorded'}</dd></dl>
        {!detail.handoffs.length && <p className="muted">No footage report yet.</p>}{detail.handoffs.map((handoff) => <article className="handoff-card" key={handoff.id}><div className="section-title"><strong>Report #{handoff.sequence}{handoff.sequence === state.handoffVersion ? ' · Latest' : ' · Previous'}</strong><span className="badge neutral">{productionLabels[handoff.verificationStatus]}</span></div><p>{productionLabels[handoff.channel]}{handoff.channelName ? ` · ${handoff.channelName}` : ''}</p><p className="planning-copy">{handoff.description || 'No file description provided.'}</p><small>Reported by {handoff.reportedBy.name} ({handoff.reportedBy.role === 'AGENCY' ? 'Agency record' : 'Client'}) · {showDate(handoff.createdAt, zone)}</small><small>Reported sender: {handoff.senderName || 'Not specified'} · Clips: {handoff.clipCount ?? 'Not specified'}</small><small>Reported send time: {handoff.sentAt ? showDate(handoff.sentAt, zone) : 'Not specified'}</small>{handoff.messageReference && <p className="planning-copy">Reference: {handoff.messageReference}</p>}{agency && handoff.verificationNote && <p className="planning-copy">Internal verification: {handoff.verificationNote}</p>}{agency && handoff.verifiedBy && <small>Checked by {handoff.verifiedBy.name} · {showDate(handoff.verifiedAt, zone)}</small>}</article>)}
      </section>}
      <section className="card section-card planning-detail"><h2>Current content</h2><span className={`planning-status ${item.status.toLowerCase()}`}>{planningLabels[item.status]}</span><h3>Script / copy · v{state.scriptVersion}</h3><p className="planning-copy">{item.script || 'No script / copy yet.'}</p><h3>Caption</h3><p className="planning-copy">{item.caption || 'No caption yet.'}</p><h3>Final creative reference · v{state.creativeVersion}</h3><p className="planning-copy">{state.creativeReference || 'No final creative reference yet.'}</p></section>
    </div><div>
      <section className="card section-card"><h2>Review history</h2>{!detail.approvalRequests.some((request) => request.status !== 'PENDING') && <p className="muted">Previous reviews will appear here.</p>}{detail.approvalRequests.filter((request) => request.status !== 'PENDING').map((request) => <article className="approval-record" key={request.id}><strong>{request.kind === 'SCRIPT' ? 'Script' : 'Creative'} v{request.version} · {productionLabels[request.status] || request.status}</strong>{request.decision && <><small>{request.decision.origin === 'CLIENT_PORTAL' ? 'Client decision' : 'Recorded by Agency'} · {request.decision.recordedBy.name} · {showDate(request.decision.createdAt, zone)}</small>{request.decision.feedback && <p className="planning-copy">{request.decision.feedback}</p>}</>}</article>)}</section>
      {agency && state.productionStage !== 'CANCELLED' && <section className="card section-card"><ProductionMetadataForm key={item.updatedAt} detail={detail} api={api} onSaved={updated} /></section>}
      {agency && <section className="card section-card"><h2>Approval records</h2><p className="muted small-text">Client portal decisions and external confirmations retain their actual author and version.</p>{!detail.approvals.length && <p className="muted">No decisions recorded yet.</p>}{detail.approvals.map((approval) => <article className="approval-record" key={approval.id}><strong>{approval.kind === 'SCRIPT' ? 'Script' : 'Final creative'} v{approval.version} · {productionLabels[approval.decision]}</strong><small>{approval.source} · {approval.origin === 'CLIENT_PORTAL' ? 'Client decision by' : 'Recorded by Agency:'} {approval.recordedBy.name} · {showDate(approval.createdAt, zone)}</small>{approval.reference && <p className="planning-copy">{approval.reference}</p>}{approval.feedback && <p className="planning-copy">Feedback: {approval.feedback}</p>}{approval.acknowledgement && <p className="planning-copy">{approval.acknowledgement}</p>}</article>)}</section>}
      <section className="card section-card"><h2>Activity timeline</h2><ErrorBox>{historyError}</ErrorBox>{history.map((event) => <article className="production-event" key={event.id}><strong>{event.summary}</strong><small>{event.actor.name} · {showDate(event.createdAt, zone)}</small></article>)}{!history.length && <p className="muted">No workflow updates yet.</p>}{history.length < historyTotal && <button className="text-button" disabled={historyBusy} onClick={moreHistory}>{historyBusy ? 'Loading...' : 'Load earlier updates'}</button>}</section>
      {agency && <section className="card section-card"><h2>Version history</h2><ErrorBox>{snapshotsError}</ErrorBox>{snapshots.map((snapshot) => <details className="revision-record" key={snapshot.id}><summary>{snapshot.kind === 'SCRIPT' ? 'Script' : 'Creative'} v{snapshot.version} · {showDate(snapshot.createdAt, zone)}</summary><small>Recorded by {snapshot.createdBy.name}</small><h3>Script</h3><p className="planning-copy">{snapshot.script || '—'}</p><h3>Caption</h3><p className="planning-copy">{snapshot.caption || '—'}</p><h3>Creative reference</h3><p className="planning-copy">{snapshot.creativeReference || '—'}</p></details>)}<button className="text-button" onClick={allRevisions}>Load complete version history</button></section>}
    </div></div>
    {editing && agency && options && <PostForm item={item} options={options} currentUserId={profile.id} api={api} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setRevision((value) => value + 1); notify('Post saved; affected production checks were refreshed.'); }} />}
  </>;
}
