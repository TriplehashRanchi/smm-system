"use client";
import { useEffect, useState } from 'react';
import { Modal, ErrorBox } from './ui';

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Permanent delete for a social account or a whole client. The agency must type the name to confirm.
export default function DeleteConfirm({ kind, client, account, api, onClose, onDeleted }) {
  const account_ = kind === 'account', phrase = account_ ? account.handle : client.name;
  const path = account_ ? `/clients/${client.id}/accounts/${account.id}` : `/clients/${client.id}`;
  const [impact, setImpact] = useState(null), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api(`${path}/impact`).then(result => { if (active) setImpact(result.data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, path]);
  const ready = typed.trim() === phrase && impact && !busy;
  async function submit(event) {
    event.preventDefault(); if (!ready) return; setBusy(true); setError('');
    try { const result = await api(path, { method: 'DELETE' }); onDeleted(result.data); }
    catch (error) { setError(error.message); setBusy(false); }
  }
  const lines = !impact ? [] : account_
    ? [plural(impact.posts, 'post') + ' with all their versions, approvals and footage records', ...(impact.targets ? [plural(impact.targets, 'weekly target')] : [])]
    : [plural(impact.accounts, 'social account'), plural(impact.posts, 'post') + ' with all their versions, approvals and footage records', ...(impact.ideas ? [plural(impact.ideas, 'content idea')] : []), ...(impact.suggestions ? [plural(impact.suggestions, 'client suggestion')] : []), ...(impact.notes ? [plural(impact.notes, 'calendar note')] : []), ...(impact.logins ? [plural(impact.logins, 'client login') + ' (they will no longer be able to sign in)'] : []), 'The activity history of this client'];
  return <Modal title={account_ ? 'Delete social account?' : 'Delete client?'} subtitle={account_ ? `${account.handle} · ${client.name}` : client.name} onClose={() => { if (!busy) onClose(); }}>
    <form className="delete-confirm" onSubmit={submit}>
      <p><strong>This cannot be undone.</strong> The following will be permanently deleted:</p>
      {impact ? <ul>{lines.map(line => <li key={line}>{line}</li>)}</ul> : !error && <p className="muted" role="status">Checking what will be deleted...</p>}
      <p className="muted small-text">{account_ ? 'If you only want to stop using this account, mark it inactive in Edit account instead. Its posts are kept.' : 'Everything under this client is removed together.'}</p>
      <label><span>Type <strong>{phrase}</strong> to confirm</span><input autoFocus autoComplete="off" disabled={busy} value={typed} onChange={event => setTyped(event.target.value)} aria-label={`Type ${phrase} to confirm deletion`} /></label>
      <ErrorBox>{error}</ErrorBox>
      <div className="button-row delete-confirm-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button danger" disabled={!ready}>{busy ? 'Deleting...' : account_ ? 'Delete account permanently' : 'Delete client permanently'}</button></div>
    </form>
  </Modal>;
}
