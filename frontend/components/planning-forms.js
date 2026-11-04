"use client";
import { useState } from 'react';
import Link from 'next/link';
import { ErrorBox, Field, Modal, labels } from './ui';
import { contentFormats, planningStatuses, planningLabels, localDateTime, zonedInstant } from '../lib/planning';

function FormDialog({ title, subtitle, onClose, busy, error, onSubmit, children, submitLabel = 'Save changes', extra }) {
  return <Modal title={title} subtitle={subtitle} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={onSubmit}><div className="modal-body"><ErrorBox>{error}</ErrorBox>{children}</div>
      <footer className="modal-footer">{extra}<button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button></footer>
    </form>
  </Modal>;
}
function usePlanningSave(onSaved) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = (action) => async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const result = await action(); onSaved(result?.data); } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return { busy, error, submit, setError, setBusy };
}

export function IdeaForm({ idea, clientId: initialClientId, options, api, onClose, onSaved }) {
  const active = options.clients.filter((client) => client.status === 'ACTIVE');
  const [clientId, setClientId] = useState(idea?.clientId || active.find((client) => client.id === initialClientId)?.id || active[0]?.id || '');
  const [title, setTitle] = useState(idea?.title || ''), [brief, setBrief] = useState(idea?.brief || ''), [notes, setNotes] = useState(idea?.notes || '');
  const [bucket, setBucket] = useState(idea?.bucket || ''), [campaign, setCampaign] = useState(idea?.campaign || '');
  const save = usePlanningSave(onSaved);
  return <FormDialog title={idea ? 'Edit content idea' : 'Create content idea'} subtitle="One idea, separate posts for each social account." onClose={onClose} {...save}
    onSubmit={save.submit(() => api(idea ? `/ideas/${idea.id}` : '/ideas', { method: idea ? 'PATCH' : 'POST', body: { ...(idea ? { updatedAt: idea.updatedAt } : { clientId }), title, brief, notes, bucket, campaign } }))} submitLabel={idea ? 'Save idea' : 'Create idea'}>
    <Field label="Client"><select required disabled={Boolean(idea)} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Choose client</option>{(idea ? options.clients : active).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
    {!active.length && !idea && <p className="muted">Create or restore a client under <Link className="text-button" href="/clients">Clients & accounts</Link> first.</p>}
    <Field label="Topic / title"><input autoFocus required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <Field label="Brief"><textarea rows={3} maxLength={10000} value={brief} onChange={(event) => setBrief(event.target.value)} /></Field>
    <div className="planning-form-grid"><Field label="Content bucket (optional)"><input maxLength={120} value={bucket} onChange={(event) => setBucket(event.target.value)} placeholder="Education, product, community..." /></Field><Field label="Campaign (optional)"><input maxLength={120} value={campaign} onChange={(event) => setCampaign(event.target.value)} /></Field></div>
    <Field label="Internal notes" hint="Visible only to the Agency."><textarea rows={3} maxLength={10000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </FormDialog>;
}

export function PostForm({ idea, item, day, options, currentUserId, api, onClose, onSaved }) {
  const clientId = item?.idea.clientId || idea.clientId;
  const client = options.clients.find((client) => client.id === clientId);
  const accounts = client?.socialAccounts.filter((account) => account.active) || [];
  const [accountIds, setAccountIds] = useState(item ? [item.socialAccountId] : accounts[0] ? [accounts[0].id] : []);
  const account = client?.socialAccounts.find((account) => account.id === accountIds[0]);
  const zone = account?.timezone || client?.timezone || 'Asia/Kolkata';
  const [title, setTitle] = useState(item?.title || idea?.title || '');
  const [contentType, setContentType] = useState(item?.contentType || 'REEL');
  const [script, setScript] = useState(item?.script || ''), [caption, setCaption] = useState(item?.caption || '');
  const [publishLocal, setPublishLocal] = useState(item ? localDateTime(item.publishAt, zone) : day ? `${day}T10:00` : '');
  const [dueLocal, setDueLocal] = useState(localDateTime(item?.dueAt, zone));
  const [status, setStatus] = useState(item?.status || (day ? 'TENTATIVE' : 'DRAFT'));
  const [priority, setPriority] = useState(item?.priority || 'NORMAL');
  const [ownerId, setOwnerId] = useState(item ? item.ownerId || '' : currentUserId), [contributorId, setContributorId] = useState(item?.contributorId || '');
  const save = usePlanningSave(onSaved);
  const fields = (target) => ({ socialAccountId: target.id, title, contentType, script, caption, status, priority, ownerId: ownerId || null, contributorId: contributorId || null,
    publishAt: publishLocal ? zonedInstant(publishLocal, target.timezone) : null, dueAt: dueLocal ? zonedInstant(dueLocal, target.timezone) : null });
  const submit = save.submit(() => {
    if (!accountIds.length || accountIds.length > 20) throw new Error('Select between 1 and 20 active social accounts.');
    const selected = accountIds.map((id) => client.socialAccounts.find((account) => account.id === id));
    if (item) return api(`/content/${item.id}`, { method: 'PATCH', body: { ...fields(selected[0]), updatedAt: item.updatedAt } });
    return api('/content', { method: 'POST', body: { ideaId: idea.id, items: selected.map(fields) } });
  });
  return <FormDialog title={item ? 'Edit planned post' : 'Plan platform posts'} subtitle={`${client?.name || ''} · ${item?.idea.title || idea.title}`} onClose={onClose} {...save} onSubmit={submit} submitLabel={item ? 'Save post' : `Create ${accountIds.length || ''} post${accountIds.length === 1 ? '' : 's'}`}>
    {!accounts.length && <p className="alert">Add an active social account to this client before creating posts. <Link href={`/clients/${clientId}`} className="text-button">Open client</Link></p>}
    {item ? <Field label="Social account"><select required value={accountIds[0] || ''} onChange={(event) => setAccountIds([event.target.value])}>{client?.socialAccounts.filter((account) => account.active || account.id === item.socialAccountId).map((account) => <option key={account.id} value={account.id}>{labels[account.platform]} · {account.handle}</option>)}</select></Field> : <fieldset className="planning-account-picker"><legend>Social accounts</legend>{accounts.map((account) => <label className="checkbox-label" key={account.id}><input type="checkbox" checked={accountIds.includes(account.id)} onChange={() => setAccountIds((ids) => ids.includes(account.id) ? ids.filter((id) => id !== account.id) : [...ids, account.id])} /><span>{labels[account.platform]} · {account.handle}<small>{account.timezone}</small></span></label>)}</fieldset>}
    <Field label="Post title"><input autoFocus required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <div className="planning-form-grid"><Field label="Format"><select value={contentType} onChange={(event) => setContentType(event.target.value)}>{contentFormats.map((format) => <option key={format} value={format}>{labels[format]}</option>)}</select></Field><Field label="Planning status"><select value={status} onChange={(event) => setStatus(event.target.value)}>{planningStatuses.filter((value) => !['APPROVED', 'CANCELLED'].includes(value) || item?.status === value).map((status) => <option key={status} value={status}>{planningLabels[status]}</option>)}</select></Field></div>
    <Field label="Proposed publish date & time" hint={accountIds.length > 1 ? 'The entered local time is applied separately in each selected account’s timezone.' : `Account timezone: ${zone}. Repeated daylight-saving times use the earlier occurrence.`}><input type="datetime-local" required={['TENTATIVE', 'IN_PROGRESS', 'APPROVED'].includes(status)} value={publishLocal} onChange={(event) => setPublishLocal(event.target.value)} /></Field>
    <Field label="Production due date & time (optional)" hint={`Uses ${accountIds.length > 1 ? 'each account’s timezone' : zone}.`}><input type="datetime-local" value={dueLocal} onChange={(event) => setDueLocal(event.target.value)} /></Field>
    <div className="planning-form-grid"><Field label="Priority"><select value={priority} onChange={(event) => setPriority(event.target.value)}>{['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((priority) => <option key={priority} value={priority}>{planningLabels[priority]}</option>)}</select></Field><Field label="Agency owner"><select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">Unassigned</option>{options.owners.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field></div>
    <Field label="Agency contributor (optional)"><select value={contributorId} onChange={(event) => setContributorId(event.target.value)}><option value="">None</option>{options.owners.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
    <Field label="Draft script / copy"><textarea rows={4} maxLength={10000} value={script} onChange={(event) => setScript(event.target.value)} /></Field>
    <Field label="Caption"><textarea rows={4} maxLength={10000} value={caption} onChange={(event) => setCaption(event.target.value)} /></Field>
    <p className="muted small-text">Agency drafts are private. Scheduled Tentative, In progress and Approved posts are visible to the client. Record approvals, cancellation and production progress in Production details. Editing script, caption or format resets affected checks.</p>
  </FormDialog>;
}

export function RepurposeForm({ item, options, api, onClose, onSaved }) {
  const accounts = options.clients.find((client) => client.id === item.idea.clientId)?.socialAccounts.filter((account) => account.active) || [];
  const [accountId, setAccountId] = useState(accounts.find((account) => account.id !== item.socialAccountId)?.id || accounts[0]?.id || '');
  const [publishLocal, setPublishLocal] = useState('');
  const zone = accounts.find((account) => account.id === accountId)?.timezone || 'Asia/Kolkata';
  const save = usePlanningSave(onSaved);
  return <FormDialog title="Repurpose this post" subtitle="Create an independent Agency draft under the same idea." onClose={onClose} {...save} onSubmit={save.submit(() => api(`/content/${item.id}/duplicate`, { method: 'POST', body: { socialAccountId: accountId, publishAt: publishLocal ? zonedInstant(publishLocal, zone) : null } }))} submitLabel="Create draft copy">
    <Field label="Destination account"><select required value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{labels[account.platform]} · {account.handle}</option>)}</select></Field>
    <Field label="Proposed date & time (optional)" hint={zone}><input type="datetime-local" value={publishLocal} onChange={(event) => setPublishLocal(event.target.value)} /></Field>
    <p className="muted">The caption and script are copied. Dates, owner and approval state are independent; review the format and copy for the destination platform.</p>
  </FormDialog>;
}

export function CalendarNoteForm({ note, day, clientId: initialClientId, options, api, onClose, onSaved }) {
  const active = options.clients.filter((client) => client.status === 'ACTIVE');
  const [clientId, setClientId] = useState(note?.clientId || active.find((client) => client.id === initialClientId)?.id || active[0]?.id || '');
  const [title, setTitle] = useState(note?.title || ''), [body, setBody] = useState(note?.body || '');
  const [date, setDate] = useState(note?.date.slice(0, 10) || day || ''), [kind, setKind] = useState(note?.kind || 'OTHER');
  const [clientVisible, setClientVisible] = useState(note?.clientVisible || false);
  const save = usePlanningSave(onSaved);
  async function remove() {
    if (!window.confirm('Remove this calendar note?')) return;
    save.setBusy(true); save.setError('');
    try { await api(`/planning/notes/${note.id}`, { method: 'DELETE' }); onSaved(); } catch (error) { save.setError(error.message); } finally { save.setBusy(false); }
  }
  return <FormDialog title={note ? 'Edit calendar note' : 'Add calendar note'} subtitle="Shoots, campaigns, holidays and important dates." onClose={onClose} {...save} onSubmit={save.submit(() => api(note ? `/planning/notes/${note.id}` : '/planning/notes', { method: note ? 'PATCH' : 'POST', body: { ...(note ? { updatedAt: note.updatedAt } : { clientId }), title, body, date, kind, clientVisible } }))} extra={note && <button type="button" className="text-button danger-text" disabled={save.busy} onClick={remove}>Remove note</button>}>
    <Field label="Client"><select required disabled={Boolean(note)} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Choose client</option>{(note ? options.clients : active).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
    <Field label="Title"><input autoFocus required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <div className="planning-form-grid"><Field label="Date" hint="All-day date in the client business’s timezone."><input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field><Field label="Type"><select value={kind} onChange={(event) => setKind(event.target.value)}>{['SHOOT', 'CAMPAIGN', 'HOLIDAY', 'OTHER'].map((kind) => <option key={kind} value={kind}>{planningLabels[kind]}</option>)}</select></Field></div>
    <Field label="Details"><textarea rows={4} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} /></Field>
    <label className="checkbox-label"><input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} />Share with this client</label>
  </FormDialog>;
}
