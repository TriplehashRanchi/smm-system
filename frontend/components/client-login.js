"use client";

import { useEffect, useState } from "react";
import { ErrorBox, Field, Icon, Modal, initials } from "./ui";

export default function ClientLogin({ client, api, onSaved }) {
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const logins = client.clientAccess.filter(({ user }) => user.role === "CLIENT");

  async function changeStatus(user) {
    if (busyId) return;
    setBusyId(user.id);
    setError("");
    const status = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await api(`/clients/${client.id}/login/${user.id}`, { method: "PATCH", body: { status } });
      onSaved(status === "ACTIVE" ? "Client login enabled." : "Client login disabled.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="card section-card client-login-section">
      <div className="section-title">
        <div><h2>Client login</h2><p className="muted">Manage this Client's sign-in access.</p></div>
        {client.status === "ACTIVE" && (
          <button className="button secondary small" disabled={Boolean(busyId)} onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> Create login
          </button>
        )}
      </div>
      <ErrorBox>{error}</ErrorBox>
      {logins.length ? logins.map(({ user }) => (
        <div className="client-login-row" key={user.id}>
          <div className="person-row">
            <span className="avatar small-avatar">{initials(user.name)}</span>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
          </div>
          <div className="button-row">
            <span className={`badge ${user.status === "ACTIVE" ? "green" : "neutral"}`}>
              {user.status === "ACTIVE" ? "Enabled" : "Disabled"}
            </span>
            <button className={`text-button ${user.status === "ACTIVE" ? "danger-text" : ""}`} disabled={Boolean(busyId)} onClick={() => changeStatus(user)}>
              {busyId === user.id ? "Saving..." : user.status === "ACTIVE" ? "Disable access" : "Enable access"}
            </button>
            <button className="icon-button danger-icon" title="Delete login" aria-label={`Delete login for ${user.name}`} disabled={Boolean(busyId)} onClick={() => { setError(""); setDeleting(user); }}>
              <Icon name="trash" size={17} />
            </button>
          </div>
        </div>
      )) : (
        <p className="muted client-login-empty">
          {client.status === "ACTIVE" ? "No login created yet. You can manage this client without giving them sign-in access." : "Restore this client to create a login."}
        </p>
      )}
      <p className="client-login-hint">Clients see only their own accounts and posts.</p>
      {deleting && (
        <DeleteClientLogin client={client} user={deleting} api={api} onClose={() => setDeleting(null)} onDeleted={() => {
          setDeleting(null);
          onSaved("Client login deleted.");
        }} />
      )}
      {adding && (
        <CreateClientLogin client={client} api={api} onClose={() => setAdding(false)} onSaved={() => {
          setAdding(false);
          onSaved("Client login created. Share the email and password with your client.");
        }} />
      )}
    </section>
  );
}

function DeleteClientLogin({ client, user, api, onClose, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [impact, setImpact] = useState(null);
  const [alsoActivity, setAlsoActivity] = useState(false);
  const path = `/clients/${client.id}/login/${user.id}`;

  useEffect(() => {
    let active = true;
    api(`${path}/impact`).then(result => { if (active) setImpact(result.data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, path]);

  const blockers = impact ? [
    [impact.blockers.approvals, "recorded approval"], [impact.blockers.footageReports, "footage report"], [impact.blockers.suggestions, "suggestion"],
    [impact.blockers.revisions, "saved version"], [impact.blockers.other, "other record"],
  ].filter(([count]) => count > 0).map(([count, word]) => `${count} ${word}${count === 1 ? "" : "s"}`) : [];
  const blocked = Boolean(impact && impact.blocked > 0), needsTick = Boolean(impact && !blocked && !impact.shared && impact.activity > 0);
  const ready = Boolean(impact) && !blocked && (!needsTick || alsoActivity) && !busy;

  async function submit(event) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await api(`${path}${needsTick ? "?removeActivity=1" : ""}`, { method: "DELETE" });
      onDeleted();
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete client login?" subtitle={`${user.name} \u00b7 ${user.email}`} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox>{error}</ErrorBox>
          {!impact && !error && <p className="muted" role="status">Checking what is attached to this login...</p>}
          {blocked && (
            <div className="alert" role="alert">
              <strong>This login cannot be deleted.</strong> It has {blockers.join(", ")} on record, and deleting it would erase that history. Use <strong>Disable access</strong> instead. That blocks the login and keeps everything.
            </div>
          )}
          {impact && !blocked && (
            <>
              <p><strong>This cannot be undone.</strong> {user.name} will no longer be able to sign in. You can create a new login for this client at any time.</p>
              {impact.shared && <p className="muted small-text">This login is shared with another client, so it is only removed from this client. It keeps working for the other one.</p>}
              {needsTick && (
                <label className="checkbox-label delete-login-tick">
                  <input type="checkbox" checked={alsoActivity} onChange={event => setAlsoActivity(event.target.checked)} />
                  <span>Also delete its {impact.activity} activity log entr{impact.activity === 1 ? "y" : "ies"}. These are the lines in the history that say what this login did, such as approving a post.</span>
                </label>
              )}
            </>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>{blocked ? "Close" : "Cancel"}</button>
          {!blocked && <button className="button danger" disabled={!ready}>{busy ? "Deleting..." : "Delete login"}</button>}
        </footer>
      </form>
    </Modal>
  );
}

function CreateClientLogin({ client, api, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/clients/${client.id}/login`, { method: "POST", body: { name, email: email.trim(), password } });
      onSaved();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Create client login" subtitle={client.name} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <ErrorBox>{error}</ErrorBox>
          <Field label="Contact name" hint="Enter the name of the person who will sign in, such as Rahul Sharma.">
            <input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="e.g. Rahul Sharma" />
          </Field>
          <Field label="Login email">
            <input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" placeholder="client@company.com" />
          </Field>
          <Field label="Password" hint="Use at least 6 characters. Share this password directly with your client.">
            <input type="password" required minLength={6} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          </Field>
          <p className="muted small-text">Access to this Client's accounts is assigned automatically.</p>
        </div>
        <footer className="modal-footer">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={busy}>{busy ? "Creating..." : "Create login"}</button>
        </footer>
      </form>
    </Modal>
  );
}
