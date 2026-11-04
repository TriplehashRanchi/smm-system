"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Empty, ErrorBox, Icon, labels } from './ui';
import { ClientForm, AccountForm } from './client-forms';
import ClientLogin from './client-login';
import DeleteConfirm from './delete-confirm';
import PlatformIcon, { platformColors } from './platform-icon';

export default function ClientDetail({ id, agency, api, notify }) {
  const router = useRouter();
  const [client, setClient] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [dialog, setDialog] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setClient(null);
    api('/clients/' + id).then(result => { if (active) setClient(result.data); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, id, revision]);
  function saved(message) { setDialog(null); setRevision(value => value + 1); notify(message); }
  async function archive() {
    setBusy(true); setError('');
    try { await api('/clients/' + id, { method: 'PATCH', body: { status: client.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' } }); saved(client.status === 'ACTIVE' ? 'Client archived.' : 'Client restored.'); }
    catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <>
    <Link href="/clients" className="text-button back-button">? {agency ? 'Clients' : 'My accounts'}</Link><ErrorBox>{error}</ErrorBox>
    {error && <button className="button secondary" onClick={() => setRevision(value => value + 1)}>Try again</button>}
    {loading ? <div className="empty" role="status">Loading client...</div> : client && <>
      <div className="page-heading"><div><span className="eyebrow">CLIENT ? SOCIAL ACCOUNTS ? POSTS</span><h1>{client.name}<span className="mint-text">.</span></h1><p>Choose a social account to open its planning sheet.</p></div>{agency && <div className="button-row"><button className="button secondary" onClick={() => setDialog({ type: 'edit' })}>Edit client</button>{client.status === 'ACTIVE' && <button className="button primary" onClick={() => setDialog({ type: 'account' })}><Icon name="plus" size={16} />Add social account</button>}<button className="icon-button danger-icon outlined" title="Delete client" aria-label={`Delete client ${client.name}`} onClick={() => setDialog({ type: 'deleteClient' })}><Icon name="trash" size={18} /></button></div>}</div>
      {client.status === 'ARCHIVED' && <p className="alert">This Client is archived. Existing posts are available for reference.</p>}
      <div className="account-grid">{client.socialAccounts.map(account => <article className={`card account-card ${account.active ? '' : 'is-inactive'}`} key={account.id}>
        <div className="account-card-top">
          <span className="account-avatar" style={{ '--brand': platformColors[account.platform] || '#6b45b0' }} aria-hidden="true"><PlatformIcon platform={account.platform} size={24} /></span>
          <div className="account-card-id"><h2>{account.handle}</h2><p>{labels[account.platform]} &middot; {account.timezone}</p></div>
          {agency && <div className="icon-actions"><button className="icon-button" title="Edit account" aria-label={`Edit account ${account.handle}`} onClick={() => setDialog({ type: 'account', account })}><Icon name="edit" size={18} /></button><button className="icon-button danger-icon" title="Delete account" aria-label={`Delete account ${account.handle}`} onClick={() => setDialog({ type: 'deleteAccount', account })}><Icon name="trash" size={18} /></button></div>}
        </div>
        <div className="account-card-meta"><span className={`status-pill ${account.active ? 'on' : 'off'}`}>{account.active ? 'Active' : 'Inactive'}</span></div>
        <Link className="button primary account-open" href={'/posts?clientId=' + client.id + '&socialAccountId=' + account.id}>Open posts sheet <Icon name="arrow" size={16} /></Link>
      </article>)}</div>
      {!client.socialAccounts.length && <div className="card"><Empty icon="link" title="Add the first social account" action={agency && client.status === 'ACTIVE' ? <button className="button primary" onClick={() => setDialog({ type: 'account' })}>Add social account</button> : null}>{agency ? 'Choose a platform and enter its handle. You can plan posts immediately afterward.' : 'Your agency will add your social accounts here.'}</Empty></div>}
      {agency && <details className="card section-card client-settings"><summary>Client login and settings</summary><ClientLogin client={client} api={api} onSaved={saved} />{client.internalNotes && <p className="planning-copy">Internal notes: {client.internalNotes}</p>}{client.status === 'ARCHIVED' && <div className="client-settings-footer"><button className="text-button" disabled={busy} onClick={archive}>Restore client</button></div>}</details>}
      {agency && dialog?.type === 'deleteClient' && <DeleteConfirm kind="client" client={client} api={api} onClose={() => setDialog(null)} onDeleted={result => { setDialog(null); notify(`${result.name} was deleted.`); router.replace('/clients'); }} />}
      {agency && dialog?.type === 'deleteAccount' && <DeleteConfirm kind="account" client={client} account={dialog.account} api={api} onClose={() => setDialog(null)} onDeleted={result => saved(`Social account deleted${result.posts ? ` along with ${result.posts} post${result.posts === 1 ? '' : 's'}` : ''}.`)} />}
      {agency && dialog?.type === 'edit' && <ClientForm client={client} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Client updated.')} />}
      {agency && dialog?.type === 'account' && <AccountForm client={client} account={dialog.account} api={api} onClose={() => setDialog(null)} onSaved={() => saved('Social account saved. Open its posts sheet to start planning.')} />}
    </>}
  </>;
}
