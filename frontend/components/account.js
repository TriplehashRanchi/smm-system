"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { useWorkspace } from "./workspace";
import { ErrorBox, Field, Icon, initials, labels } from "./ui";

export default function Account() {
  const { profile, api, refreshProfile, logout } = useAuth();
  const { notify } = useWorkspace();
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signoutError, setSignoutError] = useState("");
  const agency = profile.role === "AGENCY";
  const changed = name.trim() !== profile.name;
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/me", { method: "PATCH", body: { name: name.trim() } });
      const updated = await refreshProfile();
      if (!updated) return;
      setName(updated.name);
      notify("Your profile has been updated.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (signingOut || busy) return;
    setSigningOut(true);
    setSignoutError("");
    try {
      await logout();
    } catch (error) {
      setSignoutError(error.message || "Unable to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="account-page">
      <div className="page-heading account-page-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h1>
            My account<span className="mint-text">.</span>
          </h1>
          <p>A little about you. Everything you need to manage your account.</p>
        </div>
      </div>
      <section className="card account-profile" aria-labelledby="account-profile-name">
        <div className="account-profile-cover" aria-hidden="true"><span /><span /><span /></div>
        <div className="account-profile-identity">
          <span className="avatar account-profile-avatar" aria-hidden="true">{initials(profile.name)}</span>
          <div className="account-profile-copy">
            <h2 id="account-profile-name">{profile.name}</h2>
            <p>{profile.email}</p>
          </div>
          <span className="account-role"><Icon name="users" size={15} />{labels[profile.role]} account</span>
        </div>
      </section>

      <div className="account-settings-grid">
        <section className="card account-details" aria-labelledby="account-details-title">
          <header className="account-section-heading">
            <span className="account-section-icon"><Icon name="users" size={20} /></span>
            <div><h2 id="account-details-title">Personal details</h2><p>How you appear in your workspace.</p></div>
          </header>
          <form onSubmit={save} aria-busy={busy}>
            <div className="account-form-fields">
              <ErrorBox>{error}</ErrorBox>
              <Field label="Full name" hint="Use the name you'd like your team to see.">
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  disabled={busy || signingOut}
                />
              </Field>
              <Field
                label="Email address"
                hint={agency ? "Your sign-in email is managed by your workspace administrator." : "Contact your agency to change your sign-in email."}
              >
                <input type="email" value={profile.email} readOnly autoComplete="email" />
              </Field>
            </div>
            <footer className="account-form-footer">
              <span>{changed ? "You have unsaved changes." : "Your details are up to date."}</span>
              <div className="button-row">
                {changed && <button type="button" className="button secondary" disabled={busy || signingOut} onClick={() => { setName(profile.name); setError(""); }}>Cancel</button>}
                <button type="submit" className="button primary" disabled={busy || signingOut || !name.trim() || !changed}>
                  {busy ? "Saving..." : "Save changes"}
                </button>
              </div>
            </footer>
          </form>
        </section>

        <aside className="account-access-column" aria-label="Workspace access">
          <section className="card account-access" aria-labelledby="account-access-title">
            <header className="account-section-heading">
              <span className="account-section-icon"><Icon name="grid" size={20} /></span>
              <div><h2 id="account-access-title">Your workspace</h2><p>The right access for your work.</p></div>
            </header>
            <dl className="account-access-facts">
              <div><dt>Account type</dt><dd>{labels[profile.role]}</dd></div>
              <div><dt>Workspace access</dt><dd>{agency ? "Full workspace" : "Shared accounts"}</dd></div>
            </dl>
            <p className="account-access-note">{agency ? "Manage clients, prepare content, and keep publishing moving from one place." : "View your shared posts, review content, and keep your agency updated on footage."}</p>
            <Link className="account-workspace-link" href={agency ? "/clients" : "/my-accounts"}>
              <span>{agency ? "Open clients" : "My social accounts"}</span><Icon name="arrow" size={17} />
            </Link>
          </section>
          <div className="account-help-note"><Icon name="link" size={17} /><p>{agency ? "Need an access change? Contact your workspace administrator." : "Missing a social account? Your agency can update the accounts shared with you."}</p></div>
        </aside>
      </div>

      <section className="card account-session" aria-labelledby="account-session-title">
        <div className="account-session-copy">
          <span className="account-section-icon"><Icon name="logout" size={20} /></span>
          <div><h2 id="account-session-title">Done for now?</h2><p>Sign out of your account on this device.</p></div>
        </div>
        <button type="button" className="button secondary account-signout-button" disabled={signingOut || busy} onClick={signOut}><Icon name="logout" size={16} />{signingOut ? "Signing out..." : "Sign out"}</button>
        {signoutError && <div className="account-session-error"><ErrorBox>{signoutError}</ErrorBox></div>}
      </section>
    </div>
  );
}
