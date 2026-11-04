"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { usePlanningOptions } from './planning-options';
import { Empty, ErrorBox, labels } from './ui';
import { showDate } from '../lib/planning';
import { productionStages, productionLabels } from '../lib/production';

export default function ProductionQueue() {
  const { profile, api } = useAuth(), agency = profile.role === 'AGENCY';
  const [clientId, setClientId] = useState(''), [stage, setStage] = useState(''), [actor, setActor] = useState(''), [mine, setMine] = useState(!agency), [search, setSearch] = useState('');
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const { options, error: optionsError } = usePlanningOptions(api, revision);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setItems([]);
    const params = { page: String(page), pageSize: '30', mine: String(mine), search, ...(clientId ? { clientId } : {}), ...(stage ? { productionStage: stage } : {}), ...(agency && actor ? { nextActor: actor } : {}) };
    const timer = setTimeout(() => api(`/production?${new URLSearchParams(params)}`).then((result) => {
      if (!active) return; setItems(result.data); setTotal(result.total);
      const last = Math.max(1, Math.ceil(result.total / 30)); if (page > last) setPage(last);
    }).catch((error) => { if (active) { setItems([]); setTotal(0); setError(error.message); } }).finally(() => { if (active) setLoading(false); }), 180);
    return () => { active = false; clearTimeout(timer); };
  }, [api, agency, page, mine, search, clientId, stage, actor, revision]);
  return <>
    <div className="page-heading"><div><span className="eyebrow">FROM A PLAN TO FINISHED WORK</span><h1>{agency ? 'Production' : 'My production actions'}<span className="mint-text">.</span></h1><p>{agency ? 'See the next action, responsible party and current gate for each content item.' : 'Track your own content, shooting and footage handoffs. Files stay in WhatsApp.'}</p></div><button className="button secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
    <div className="planning-filters"><label><span>Search content</span><input value={search} maxLength={200} placeholder="Find a content item..." onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><label><span>{agency ? 'Client' : 'Business'}</span><select value={clientId} onChange={(event) => { setClientId(event.target.value); setPage(1); }}><option value="">{agency ? 'All clients' : 'All my businesses'}</option>{options?.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label><span>Production stage</span><select value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}><option value="">All visible stages</option>{productionStages.filter((stage) => agency || stage !== 'CANCELLED').map((stage) => <option key={stage} value={stage}>{productionLabels[stage]}</option>)}</select></label>{agency && <label><span>Next responsible party</span><select value={actor} onChange={(event) => { setActor(event.target.value); setPage(1); }}><option value="">All parties</option>{['AGENCY', 'CLIENT', 'NONE'].map((actor) => <option key={actor} value={actor}>{productionLabels[actor]}</option>)}</select></label>}</div>
    <div className="production-queue-summary"><label className="checkbox-label"><input type="checkbox" checked={mine} onChange={(event) => { setMine(event.target.checked); setPage(1); }} />{agency ? 'Only work I own or contribute to' : 'Only items needing my action'}</label><span>{loading ? 'Loading...' : `${total} items`}</span></div>
    <ErrorBox>{error || optionsError}</ErrorBox>{(error || optionsError) && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button>}
    {loading ? <div className="empty" role="status">Loading production work...</div> : !error && !items.length ? <div className="card"><Empty icon="progress" title="No matching production work" action={<button className="button secondary" onClick={() => { setMine(false); setSearch(''); setStage(''); setActor(''); setClientId(''); setPage(1); }}>Show all my accessible content</button>}>{agency ? 'Create platform posts in the Content library, or adjust these filters.' : 'Your agency may be working on the next step. Turn off the action filter to view all content shared with you.'}</Empty></div> : <div className="production-queue-grid">{items.map((item) => <Link className="card production-queue-card" key={item.id} href={`/production/${item.id}`}><div className="section-title"><span className="eyebrow">{item.socialAccount.client.name}</span><span className="badge neutral">{productionLabels[item.productionStage]}</span></div><h2>{item.title}</h2><p className="muted">{labels[item.contentType]} · {labels[item.socialAccount.platform]} · {item.socialAccount.handle}</p><div className="production-card-next"><strong>{productionLabels[item.nextAction.actor]}</strong><p>{item.nextAction.text}</p></div>{agency && <small>Owner: {item.owner?.name || 'Unassigned'} · Due: {showDate(item.dueAt, item.socialAccount.timezone)}</small>}<small>Proposed publish: {showDate(item.publishAt, item.socialAccount.timezone)}</small></Link>)}</div>}
    {!loading && !error && total > 30 && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 30)}</span><button className="button secondary" disabled={page * 30 >= total} onClick={() => setPage(page + 1)}>Next</button></div>}
  </>;
}
