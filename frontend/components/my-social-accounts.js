"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Empty, ErrorBox, Icon, labels } from './ui';
import { useAuth } from './auth-provider';
import PlatformIcon, { platformColors } from './platform-icon';

export default function MySocialAccounts() {
  const { api } = useAuth();
  const query = useSearchParams();
  const [accounts, setAccounts] = useState([]), [search, setSearch] = useState(query.get('q') || ''), [status, setStatus] = useState('ALL'), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => { document.title = 'My social accounts · Social OS'; }, []);
  useEffect(() => { setSearch(query.get('q') || ''); setPage(1); }, [query]);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setAccounts([]);
    api('/planning/options').then(result => {
      if (!active) return;
      setAccounts(result.data.clients.flatMap(client => client.socialAccounts).sort((a, b) => a.platform.localeCompare(b.platform) || a.handle.localeCompare(b.handle) || a.id.localeCompare(b.id)));
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, revision]);
  const isActive = account => account.active && account.client.status === 'ACTIVE';
  const needle = search.trim().toLowerCase();
  const searched = accounts.filter(account => !needle || `${account.handle} ${labels[account.platform] || account.platform}`.toLowerCase().includes(needle)), counts = { ALL: searched.length, ACTIVE: searched.filter(isActive).length, INACTIVE: searched.filter(account => !isActive(account)).length };
  const filtered = accounts.filter(account => (!needle || `${account.handle} ${labels[account.platform] || account.platform}`.toLowerCase().includes(needle)) && (status === 'ALL' || (status === 'ACTIVE' ? isActive(account) : !isActive(account))));
  const lastPage = Math.max(1, Math.ceil(filtered.length / 24)), currentPage = Math.min(page, lastPage), visible = filtered.slice((currentPage - 1) * 24, currentPage * 24);
  return <>
    <div className="page-heading"><div><span className="eyebrow">YOUR SOCIAL ACCOUNTS</span><h1>My social accounts<span className="mint-text">.</span></h1><p>Open an account to view its posts and review content.</p></div><button className="icon-button posts-refresh" disabled={loading} onClick={() => setRevision(value => value + 1)} title="Refresh" aria-label="Refresh social accounts"><Icon name="refresh" size={18} /></button></div>
    <div className="my-accounts-bar"><div className="posts-search-box my-search"><Icon name="search" size={16} /><input aria-label="Search social accounts" maxLength={160} placeholder="Search handle or platform..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
      <div className="segmented" role="group" aria-label="Filter social accounts">{[['ALL', 'All'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']].map(([key, label]) => <button key={key} className={status === key ? 'selected' : ''} aria-pressed={status === key} onClick={() => { setStatus(key); setPage(1); }}>{label}<span className="segmented-count">{counts[key]}</span></button>)}</div>
      <span className="result-count">{loading ? 'Loading...' : `${filtered.length} social account${filtered.length === 1 ? '' : 's'}`}</span></div>
    <ErrorBox>{error}</ErrorBox>
    {error ? <button className="button secondary" onClick={() => setRevision(value => value + 1)}>Try again</button> : loading ? <div className="empty" role="status">Loading your social accounts...</div> : visible.length ? <div className="my-account-grid">{visible.map(account => <Link className={`my-account-card ${isActive(account) ? '' : 'is-inactive'}`} key={account.id} href={`/posts?clientId=${encodeURIComponent(account.clientId)}&socialAccountId=${encodeURIComponent(account.id)}`}>
      <div className="my-account-top"><span className="account-avatar" style={{ '--brand': platformColors[account.platform] || '#6b45b0' }} aria-hidden="true"><PlatformIcon platform={account.platform} size={24} /></span><div className="account-card-id"><h2>{account.handle}</h2><p>{labels[account.platform]} &middot; {account.timezone}</p></div><span className={`status-pill ${isActive(account) ? 'on' : 'off'}`}>{account.client.status === 'ARCHIVED' ? 'Archived' : account.active ? 'Active' : 'Inactive'}</span></div>
      {!isActive(account) && <p className="my-account-note">Available to view. Contact your agency to resume work.</p>}
      <div className="my-account-foot"><span>Open posts sheet</span><span className="arrow"><Icon name="arrow" size={16} /></span></div>
    </Link>)}</div> : <div className="card"><Empty icon="link" title={search || status !== 'ALL' ? 'No matching social accounts' : 'Your social accounts will appear here'} action={search || status !== 'ALL' ? <button className="button secondary" onClick={() => { setSearch(''); setStatus('ALL'); setPage(1); }}>Show all my accounts</button> : undefined}>{search || status !== 'ALL' ? 'Try a different handle or platform, or clear the filters.' : 'Your agency will add your Instagram, LinkedIn and other social accounts.'}</Empty></div>}
    {!loading && !error && filtered.length > 24 && <div className="pagination"><button className="button secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {lastPage}</span><button className="button secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
  </>;
}
