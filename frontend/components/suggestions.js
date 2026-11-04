"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import { usePlanningOptions } from './planning-options';
import { ErrorBox, Field } from './ui';
import { showDate } from '../lib/planning';

function SuggestionReply({ item, api, saved }) {
  const [response, setResponse] = useState(item.response), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await api(`/suggestions/${item.id}`, { method: 'PATCH', body: { updatedAt: item.updatedAt, status: 'REVIEWED', response } }); saved('Reply shared with the Client.'); } catch (error) { setError(error.message); } finally { setBusy(false); } }
  return <form onSubmit={submit}><ErrorBox>{error}</ErrorBox><Field label="Agency reply" hint="Shared with the Client who submitted this suggestion."><textarea required minLength={5} maxLength={5000} rows={3} value={response} onChange={(event) => setResponse(event.target.value)} /></Field><div className="button-row"><button className="button primary" disabled={busy}>{busy ? 'Saving...' : 'Send reply / mark reviewed'}</button><Link className="button secondary" href={`/content?clientId=${item.client.id}`}>Open content library</Link></div></form>;
}
export default function Suggestions() {
  const { api, profile } = useAuth(), agency = profile.role === 'AGENCY', { notify } = useWorkspace();
  const [clientId, setClientId] = useState(''), [title, setTitle] = useState(''), [body, setBody] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [items, setItems] = useState([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState(''), [formError, setFormError] = useState(''), [busy, setBusy] = useState(false);
  const { options, error: optionsError } = usePlanningOptions(api, revision);
  useEffect(() => {
    let active = true; setLoading(true); setItems([]); setError('');
    api(`/suggestions?${new URLSearchParams({ page: String(page), pageSize: '20' })}`).then((result) => { if (active) { setItems(result.data); setTotal(result.total); if (page > Math.max(1, Math.ceil(result.total / 20))) setPage(Math.max(1, Math.ceil(result.total / 20))); } }).catch((error) => { if (active) { setError(error.message); setTotal(0); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, page, revision]);
  function saved(message) { notify(message); setRevision((value) => value + 1); }
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setFormError('');
    try { await api('/suggestions', { method: 'POST', body: { clientId, title, body } }); setTitle(''); setBody(''); setPage(1); saved('Suggestion sent to your agency.'); } catch (error) { setFormError(error.message); } finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">IDEAS TO DISCUSS</span><h1>{agency ? 'Client suggestions' : 'My suggestions'}<span className="mint-text">.</span></h1><p>{agency ? 'Read Client ideas and share a reply before adding them to your content plan.' : 'Share a new idea or a content request with your agency.'}</p></div><button className="button secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
    <ErrorBox>{optionsError}</ErrorBox>
    {!agency && <form className="card section-card" onSubmit={submit}><h2>Send a suggestion</h2><ErrorBox>{formError}</ErrorBox><Field label="Business"><select required value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Choose your business</option>{options?.clients.filter((client) => client.status === 'ACTIVE').map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field><Field label="Idea title"><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="What would you like to create or change?"><textarea required minLength={5} maxLength={5000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} /></Field><button className="button primary" disabled={busy || !options}>{busy ? 'Sending...' : 'Send to agency'}</button></form>}
    <ErrorBox>{error}</ErrorBox>{(error || optionsError) && <button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button>}
    {loading ? <div className="empty" role="status">Loading suggestions...</div> : !error && !items.length ? <div className="card section-card"><p className="muted">No suggestions have been submitted yet.</p></div> : items.map((item) => <article key={item.id} className="card section-card"><div className="section-title"><h2>{item.title}</h2><span className="badge neutral">{item.status === 'REVIEWED' ? 'Reviewed' : 'Sent to agency'}</span></div><p className="muted small-text">{item.client.name} · {item.createdBy.name} · {showDate(item.createdAt, item.client.timezone)}</p><p className="planning-copy">{item.body}</p>{agency ? <SuggestionReply key={item.updatedAt} item={item} api={api} saved={saved} /> : item.response && <div className="production-feedback"><strong>Agency reply</strong><p className="planning-copy">{item.response}</p></div>}</article>)}
    {!loading && !error && total > 20 && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 20)}</span><button className="button secondary" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</button></div>}
  </>;
}
