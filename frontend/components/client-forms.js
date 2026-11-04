"use client";
import { useState } from "react";
import { ErrorBox, Field, Modal, labels } from "./ui";

function FormShell({
  title,
  subtitle,
  onClose,
  onSubmit,
  busy,
  error,
  children,
  submitLabel = "Save changes",
}) {
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          <ErrorBox>{error}</ErrorBox>
          {children}
        </div>
        <footer className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function useSave(onSaved) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = (action) => async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      onSaved(result?.data);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}
export function ClientForm({ client, api, onClose, onSaved }) {
  const [name, setName] = useState(client?.name || "");
  const [timezone, setTimezone] = useState(client?.timezone || "Asia/Kolkata");
  const [notes, setNotes] = useState(client?.internalNotes || "");
  const [createLogin, setCreateLogin] = useState(false), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const { busy, error, submit } = useSave(onSaved);
  return (
    <FormShell
      title={client ? "Edit client" : "Add client"}
      subtitle="Add the client, then add their social accounts and start planning posts."
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel={client ? "Save changes" : "Create client"}
      onSubmit={submit(() =>
        api(client ? `/clients/${client.id}` : "/clients", {
          method: client ? "PATCH" : "POST",
          body: { name, timezone, internalNotes: notes, ...(!client && createLogin ? { login: { email: email.trim(), password } } : {}) },
        }),
      )}
    >
      <Field label="Client name">
        <input
          autoFocus
          required
          maxLength={160}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Rahul Sharma"
        />
      </Field>
      {!client && <><label className="checkbox-label"><input type="checkbox" checked={createLogin} onChange={(event) => setCreateLogin(event.target.checked)} />Give this Client a login</label>{createLogin && <><Field label="Client email"><input required type="email" maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Password"><input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field></>}</>}
      <details className="client-optional-fields"><summary>Timezone and notes (optional)</summary>
      <Field
        label="Timezone"
        hint="Use an IANA timezone, such as Asia/Kolkata or Europe/London."
      >
        <input
          required
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
      </Field>
      <Field
        label="Internal notes (optional)"
        hint="Visible to agency staff, never to Client users."
      >
        <textarea
          rows={4}
          maxLength={5000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="A little context for your team…"
        />
      </Field>
      </details>
    </FormShell>
  );
}
export function AccountForm({ client, account, api, onClose, onSaved }) {
  const [platform, setPlatform] = useState(account?.platform || "INSTAGRAM");
  const [handle, setHandle] = useState(account?.handle || "");
  const [timezone, setTimezone] = useState(
    account?.timezone || client.timezone,
  );
  const [active, setActive] = useState(account?.active ?? true);
  const { busy, error, submit } = useSave(onSaved);
  return (
    <FormShell
      title={account ? "Edit social account" : "Add social account"}
      subtitle="Track the account here. Publishing remains manual."
      onClose={onClose}
      busy={busy}
      error={error}
      onSubmit={submit(() =>
        api(
          `/clients/${client.id}/accounts${account ? `/${account.id}` : ""}`,
          {
            method: account ? "PATCH" : "POST",
            body: { platform, handle, timezone, active },
          },
        ),
      )}
    >
      <Field label="Platform">
        <select
          value={platform}
          onChange={(event) => setPlatform(event.target.value)}
        >
          {["INSTAGRAM", "LINKEDIN", "FACEBOOK", "YOUTUBE", "OTHER"].map(
            (item) => (
              <option key={item} value={item}>
                {labels[item]}
              </option>
            ),
          )}
        </select>
      </Field>
      <Field label="Handle or page name">
        <input
          autoFocus
          required
          maxLength={160}
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          placeholder="@brand or Company Page"
        />
      </Field>
      <details className="client-optional-fields"><summary>Timezone and account settings (optional)</summary>
      <Field label="Publishing timezone">
        <input
          required
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
      </Field>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Active account
      </label>
      </details>
    </FormShell>
  );
}
export function TargetForm({ client, account, target, api, onClose, onSaved }) {
  const [contentType, setContentType] = useState(target?.contentType || "ALL");
  const [count, setCount] = useState(target?.targetCount ?? 3);
  const { busy, error, submit } = useSave(onSaved);
  return (
    <FormShell
      title="Set the weekly commitment"
      subtitle={`${labels[account.platform]} · ${account.handle}`}
      onClose={onClose}
      busy={busy}
      error={error}
      onSubmit={submit(() =>
        api(`/clients/${client.id}/accounts/${account.id}/targets`, {
          method: "PUT",
          body: { contentType, targetCount: Number(count) },
        }),
      )}
    >
      <Field
        label="Content format"
        hint="Choose one overall target or separate targets by format. Do not combine both."
      >
        <select
          value={contentType}
          disabled={Boolean(target)}
          onChange={(event) => setContentType(event.target.value)}
        >
          {[
            "ALL",
            "REEL",
            "CAROUSEL",
            "STATIC_GRAPHIC",
            "STORY",
            "LINKEDIN_TEXT",
            "DOCUMENT_POST",
            "OTHER",
          ].map((item) => (
            <option key={item} value={item}>
              {labels[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Posts per week">
        <input
          autoFocus
          required
          type="number"
          min="0"
          max="1000"
          step="1"
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />
      </Field>
    </FormShell>
  );
}
export function RemoveTarget({ client, account, target, api, onClose, onSaved }) {
  const { busy, error, submit } = useSave(onSaved);
  return (
    <FormShell
      title="Remove weekly target?"
      subtitle={account.handle}
      onClose={onClose}
      busy={busy}
      error={error}
      submitLabel="Remove target"
      onSubmit={submit(() =>
        api(
          `/clients/${client.id}/accounts/${account.id}/targets/${target.id}`,
          { method: "DELETE" },
        ),
      )}
    >
      <p>
        This removes the {labels[target.contentType].toLowerCase()} commitment
        of {target.targetCount} posts per week. The change remains in activity
        history.
      </p>
    </FormShell>
  );
}
