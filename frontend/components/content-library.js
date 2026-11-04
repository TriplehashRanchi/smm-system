"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import { usePlanningOptions } from './planning-options';
import { IdeaForm, PostForm } from './planning-forms';
import PostDetail from './post-detail';
import { Empty, ErrorBox, Icon, Modal, labels } from './ui';
import { showDate, planningLabels } from '../lib/planning';

export default function ContentLibrary() {
  const { profile, api } = useAuth(), { notify } = useWorkspace(), query = useSearchParams();
  const [clientId, setClientId] = useState(query.get('clientId') || ''), [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const [ideas, setIdeas] = useState([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [dialog, setDialog] = useState(null), [selected, setSelected] = useState(null), [ideaError, setIdeaError] = useState('');
  const [revision, setRevision] = useState(0);
  const { options, error: optionsError } = usePlanningOptions(api, revision);
  useEffect(() => { setClientId(query.get('clientId') || ''); setPage(1); }, [query]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const params = { search, page: String(page), pageSize: '18', ...(clientId ? { clientId } : {}) };
    const timer = setTimeout(() => api(`/ideas?${new URLSearchParams(params)}`).then((result) => {
      if (!active) return; setIdeas(result.data); setTotal(result.total);
      if (page > Math.max(1, Math.ceil(result.total / 18))) setPage(Math.max(1, Math.ceil(result.total / 18)));
    }).catch((error) => { if (active) { setIdeas([]); setError(error.message); } }).finally(() => { if (active) setLoading(false); }), 180);
    return () => { active = false; clearTimeout(timer); };
  }, [api, clientId, search, page, revision]);
  useEffect(() => {
    if (dialog?.type !== 'detail') return;
    let active = true; setSelected(null); setIdeaError('');
    api(`/ideas/${dialog.id}`).then((result) => { if (active) setSelected(result.data); }).catch((error) => { if (active) setIdeaError(error.message); });
    return () => { active = false; };
  }, [api, dialog, revision]);
  function saved(message) { setDialog(null); setRevision((value) => value + 1); notify(message); }
  return <>
    <div className="page-heading"><div><span className="eyebrow">IDEAS INTO A CLEAR PLAN</span><h1>Content library<span className="mint-text">.</span></h1><p>Capture an idea once. Plan independent posts for every social account.</p></div><div className="button-row"><Link href={`/calendar${clientId ? `?clientId=${clientId}` : ''}`} className="button secondary"><Icon name="calendar" size={17} />Calendar</Link><button className="button primary" disabled={!options} onClick={() => setDialog({ type: 'idea' })}><Icon name="plus" size={17} />New idea</button></div></div>
    <ErrorBox>{optionsError}</ErrorBox>
    <div className="filter-bar"><label className="search-input"><Icon name="search" size={17} /><input maxLength={200} aria-label="Search content ideas" value={search} placeholder="Search ideas..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><select aria-label="Filter ideas by client" value={clientId} onChange={(event) => { setClientId(event.target.value); setPage(1); }}><option value="">All clients</option>{options?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.status === 'ARCHIVED' ? ' (archived)' : ''}</option>)}</select><span className="result-count">{loading ? 'Loading...' : `${total} ideas`}</span></div>
    <ErrorBox>{error}</ErrorBox>
    {(error || optionsError) && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button>}
    {loading ? <div className="empty" role="status">Loading content ideas...</div> : !error && !ideas.length ? <div className="card"><Empty icon="calendar" title="Start with a content idea">Choose a client and add the topic, brief, campaign and internal notes. Then create posts for their social accounts.</Empty></div> : <div className="idea-grid">{ideas.map((idea) => <article className="card idea-card" key={idea.id}>
      <span className="eyebrow">{idea.client.name}</span><h2>{idea.title}</h2><p className="idea-preview">{idea.brief || 'Add a short brief to guide the platform posts.'}</p><div className="platform-chips">{idea.bucket && <span className="platform-chip">{idea.bucket}</span>}{idea.campaign && <span className="platform-chip">{idea.campaign}</span>}</div><div className="idea-card-bottom"><span>{idea._count.items} platform posts</span><button className="text-button" onClick={() => setDialog({ type: 'detail', id: idea.id })}>Open idea <Icon name="arrow" size={14} /></button></div><div className="button-row"><button className="button secondary small" disabled={!options || idea.client.status !== 'ACTIVE'} onClick={() => setDialog({ type: 'posts', idea })}>Plan posts</button><button className="text-button" disabled={!options || idea.client.status !== 'ACTIVE'} onClick={() => setDialog({ type: 'idea', idea })}>Edit idea</button></div>
    </article>)}</div>}
    {total > 18 && !loading && !error && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 18)}</span><button className="button secondary" disabled={page * 18 >= total} onClick={() => setPage(page + 1)}>Next</button></div>}
    {dialog?.type === 'idea' && options && <IdeaForm idea={dialog.idea} clientId={clientId} options={options} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Content idea saved.')} />}
    {dialog?.type === 'posts' && options && <PostForm idea={dialog.idea} options={options} currentUserId={profile.id} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Platform posts created.')} />}
    {dialog?.type === 'post' && options && <PostDetail id={dialog.id} agency options={options} currentUserId={profile.id} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Post saved.')} />}
    {dialog?.type === 'detail' && <Modal title={selected?.title || 'Content idea'} subtitle={selected?.client.name} onClose={() => setDialog(null)}><div className="modal-body planning-detail"><ErrorBox>{ideaError}</ErrorBox>{!selected && !ideaError && <p role="status">Loading idea...</p>}{ideaError && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button>}{selected && <>
      <h3>Brief</h3><p className="planning-copy">{selected.brief || 'No brief yet.'}</p><h3>Internal notes</h3><p className="planning-copy">{selected.notes || 'No internal notes.'}</p><h3>Platform posts</h3>{selected.items.length ? selected.items.map((item) => <button className="idea-post-link" key={item.id} onClick={() => setDialog({ type: 'post', id: item.id })}><strong>{item.title}</strong><small>{labels[item.socialAccount.platform]} · {item.socialAccount.handle} · {planningLabels[item.status]}</small><small>{showDate(item.publishAt, item.socialAccount.timezone)}</small></button>) : <p className="muted">No platform posts yet.</p>}
    </>}</div><footer className="modal-footer"><button className="button secondary" onClick={() => setDialog(null)}>Close</button>{selected?.client.status === 'ACTIVE' && options && <button className="button primary" onClick={() => setDialog({ type: 'posts', idea: selected })}>Plan posts</button>}</footer></Modal>}
  </>;
}
