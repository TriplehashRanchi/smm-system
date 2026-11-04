"use client";
import { useWorkspace } from './workspace';
import { useState } from 'react';
import { ErrorBox, Field } from './ui';
import { showDate } from '../lib/planning';

export const metricFields = { likes: 'Likes', comments: 'Comments', views: 'Views' };
export function parseMetric(value) {
  if (value === '') return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0 || count > 4294967295) throw new Error('Enter a whole number from 0 to 4,294,967,295, or leave it blank.');
  return count;
}
export default function PostMetrics({ item, agency, api, onSaved }) {
  const { notify, notifyError } = useWorkspace();
  const [values, setValues] = useState(Object.fromEntries(Object.keys(metricFields).map(field => [field, item[field] == null ? '' : String(item[field])])));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const fields = Object.fromEntries(Object.entries(values).map(([field, value]) => [field, parseMetric(value)]));
      await api(`/posts/${item.id}/metrics`, { method: 'PATCH', body: { updatedAt: item.updatedAt, ...fields } });
      onSaved((await api(`/posts/${item.id}`)).data); notify('Results saved', 'success', { description: item.title });
    } catch (error) { setError(error.message); notifyError(error.message); } finally { setBusy(false); }
  }
  return <section className="post-engagement"><h3>Post performance</h3>{agency ? <form onSubmit={save}><p className="muted small-text">Enter the current counts from the social account. Leave a value blank until it has been recorded.</p><ErrorBox>{error}</ErrorBox><div className="post-metric-grid">{Object.entries(metricFields).map(([field, label]) => <Field key={field} label={label}><input type="number" min={0} max={4294967295} step={1} value={values[field]} onChange={event => setValues(current => ({ ...current, [field]: event.target.value }))} /></Field>)}</div><button className="button secondary" disabled={busy}>{busy ? 'Saving...' : 'Save performance'}</button></form> : <dl className="post-metric-grid">{Object.entries(metricFields).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{item[field] == null ? '—' : item[field].toLocaleString()}</dd></div>)}</dl>}{item.metricsUpdatedAt && <p className="muted small-text">Manually updated: {showDate(item.metricsUpdatedAt, item.socialAccount.timezone)}</p>}</section>;
}
