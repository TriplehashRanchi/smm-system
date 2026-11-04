"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorBox, labels } from './ui';
import { showDate } from '../lib/planning';

export default function ClientActionSummary({ api, revision }) {
  const [actions, setActions] = useState(null), [upcoming, setUpcoming] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setActions(null); setUpcoming(null); setError('');
    const from = new Date(), to = new Date(from.getTime() + 30 * 86400000);
    Promise.all([api('/production?mine=true&pageSize=6'), api(`/content?${new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), pageSize: '6' })}`)])
      .then(([actions, upcoming]) => { if (active) { setActions(actions); setUpcoming(upcoming); } }).catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, revision, retry]);
  return <section className="client-collaboration" aria-label="Your content and actions">
    {error ? <div className="card section-card"><ErrorBox>{error}</ErrorBox><button className="button secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div> : <>
      <article className="card section-card"><div className="section-title"><h2>Needs your action</h2><span className="badge neutral">{actions?.total ?? '...'}</span></div>
        {!actions ? <p role="status">Loading your actions...</p> : !actions.data.length ? <p className="muted">You are up to date. Your agency will send reviews and shoot requests here.</p> : actions.data.map((item) => <Link key={item.id} className="client-action-row" href={`/production/${item.id}`}><strong>{item.title}</strong><span>{item.socialAccount.client.name} · {labels[item.socialAccount.platform]}</span><p>{item.nextAction.text}</p><small>Due: {item.clientActionDueAt ? showDate(item.clientActionDueAt, item.socialAccount.timezone) : 'No deadline set'}</small></Link>)}
        <Link className="text-button" href="/production">View all my actions →</Link>
      </article>
      <article className="card section-card"><div className="section-title"><h2>Upcoming content</h2><Link className="text-button" href="/calendar">Open calendar</Link></div><p className="muted small-text">Planned for the next 30 days across your shared accounts.</p>
        {!upcoming ? <p role="status">Loading planned content...</p> : !upcoming.data.length ? <p className="muted">No shared content is scheduled in this period.</p> : upcoming.data.map((item) => <Link key={item.id} className="client-action-row" href={`/production/${item.id}`}><strong>{item.title}</strong><span>{item.socialAccount.client.name} · {labels[item.socialAccount.platform]}</span><small>{showDate(item.publishAt, item.socialAccount.timezone)} · {item.socialAccount.timezone}</small></Link>)}
        <Link className="text-button" href="/suggestions">Have a content idea? Send a suggestion →</Link>
      </article>
    </>}
  </section>;
}
