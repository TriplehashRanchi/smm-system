"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ErrorBox, Modal, labels } from './ui';
import { showDate, planningLabels } from '../lib/planning';
import { PostForm, RepurposeForm } from './planning-forms';

export default function PostDetail({ id, agency, options, currentUserId, api, onClose, onSaved }) {
  const [item, setItem] = useState(null), [error, setError] = useState(''), [mode, setMode] = useState('view');
  const [history, setHistory] = useState(null), [historyError, setHistoryError] = useState(''), [historyLoading, setHistoryLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setItem(null); setError('');
    api(`/content/${id}`).then((result) => { if (active) setItem(result.data); }).catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id, api, revision]);
  async function loadHistory() {
    setHistoryLoading(true); setHistoryError('');
    try { const result = await api(`/content/${id}/history?pageSize=100`); setHistory(result); } catch (error) { setHistoryError(error.message); } finally { setHistoryLoading(false); }
  }
  if (mode === 'edit' && item) return <PostForm item={item} options={options} currentUserId={currentUserId} api={api} onClose={() => setMode('view')} onSaved={onSaved} />;
  if (mode === 'duplicate' && item) return <RepurposeForm item={item} options={options} api={api} onClose={() => setMode('view')} onSaved={onSaved} />;
  const zone = item?.socialAccount.timezone || 'UTC';
  return <Modal title={item?.title || 'Planned post'} subtitle={item ? `${item.socialAccount.client.name} · ${labels[item.socialAccount.platform]} · ${item.socialAccount.handle}` : undefined} onClose={onClose}>
    <div className="modal-body planning-detail">
      <ErrorBox>{error}</ErrorBox>{error && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button>}
      {!item && !error && <p role="status">Loading post...</p>}
      {item && <>
        <div className="button-row"><span className={`planning-status ${item.status.toLowerCase()}`}>{planningLabels[item.status]}</span><span className="badge neutral">{labels[item.contentType]}</span></div>
        <dl><dt>Proposed publish date</dt><dd>{showDate(item.publishAt, zone)}<small>{zone}</small></dd>
          {agency && <><dt>Production due</dt><dd>{showDate(item.dueAt, zone)}</dd><dt>Priority</dt><dd>{planningLabels[item.priority]}</dd><dt>Owner / contributor</dt><dd>{item.owner?.name || 'Unassigned'} / {item.contributor?.name || 'None'}</dd></>}
          <dt>Content idea</dt><dd>{item.idea.title}</dd>
        </dl>
        {item.warnings?.length > 0 && <div className="alert"><strong>Planning checks</strong><ul>{item.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
        <h3>Script / copy</h3><p className="planning-copy">{item.script || 'No script added yet.'}</p>
        <h3>Caption</h3><p className="planning-copy">{item.caption || 'No caption added yet.'}</p>
        <p className="muted small-text">Publishing is manual. Open Production details to track scripts, footage, internal review and approval records.</p>
        {agency && <section className="planning-history"><button className="text-button" disabled={historyLoading} onClick={loadHistory}>{historyLoading ? 'Loading history...' : history ? 'Refresh change history' : 'View change history'}</button><ErrorBox>{historyError}</ErrorBox>
          {history?.data.map((event) => <div className="planning-history-row" key={event.id}><strong>{event.eventType.toLowerCase().replaceAll('_', ' ')}</strong><small>{event.actor.name} · {showDate(event.createdAt, zone)}</small>{event.eventType === 'CONTENT_PUBLISH_DATE_CHANGED' && <p>{showDate(event.details.before?.publishAt, zone)} → {showDate(event.details.after?.publishAt, zone)}</p>}</div>)}
          {history && history.total > history.data.length && <p className="muted small-text">Showing the latest {history.data.length} of {history.total} changes.</p>}
        </section>}
      </>}
    </div>
    <footer className="modal-footer"><button className="button secondary" onClick={onClose}>Close</button>{item && <Link className="button secondary" href={`/production/${item.id}`}>Production details</Link>}{agency && item && <><button className="button secondary" onClick={() => setMode('duplicate')}>Repurpose</button>{item.productionStage !== 'CANCELLED' && <button className="button primary" onClick={() => setMode('edit')}>Edit post</button>}</>}</footer>
  </Modal>;
}
