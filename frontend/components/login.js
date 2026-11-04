"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "@firebase/auth";
import { authMessage, getFirebaseAuth } from "../lib/firebase";
import { useAuth } from "./auth-provider";
import { dashboardPath } from "../lib/routes";
import { ErrorBox, Field, Icon, Loading } from "./ui";

export default function Login() {
  const { user, profile, loading, accessError, accessStatus, accessRetryAt, logout, refreshProfile } =
    useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);
  useEffect(() => {
    const update = () => setRetrySeconds(Math.max(0, Math.ceil((accessRetryAt - Date.now()) / 1000)));
    update();
    if (!accessRetryAt || accessRetryAt <= Date.now()) return;
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [accessRetryAt]);
  useEffect(() => {
    if (profile) router.replace(dashboardPath(profile.role));
  }, [profile, router]);

  async function run(kind, action) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(error.code?.startsWith("auth/") ? authMessage(error) : error.message);
    } finally {
      setBusy("");
    }
  }
  if (loading) return <Loading />;

  return (
    <main className="login-layout">
      <section className="login-story">
        <a className="brand" href="/">
          <span className="brand-mark">s.</span>
          <span>
            social<span className="brand-light">os</span>
          </span>
        </a>
        <div className="story-copy">
          <span className="eyebrow light">MADE FOR YOUR AGENCY’S EVERYDAY</span>
          <h1>
            Less chasing.
            <br />
            More creating<span className="lime">.</span>
          </h1>
          <p>
            A shared home for your clients, your team, and the work that brings
            them together.
          </p>
          <div className="story-preview">
            <div className="mini-label">
              <span className="pulse" /> A little more clarity
            </div>
            <div className="preview-row">
              <span className="mini-icon">
                <Icon name="clients" />
              </span>
              <div>
                <strong>Every client, connected</strong>
                <small>Accounts, people, and weekly commitments</small>
              </div>
              <Icon name="check" />
            </div>
            <div className="preview-row">
              <span className="mini-icon">
                <Icon name="users" />
              </span>
              <div>
                <strong>The right people, the right access</strong>
                <small>One workspace for your agency and clients.</small>
              </div>
              <Icon name="check" />
            </div>
          </div>
        </div>
        <footer>Keep the conversation on WhatsApp. Keep the plan here.</footer>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
          <h2>
            {user && accessError
              ? accessStatus === 503 ? "Your workspace is temporarily unavailable." : "Let’s check your access."
              : "Good to have you here."}
          </h2>
          <p className="muted">
            {user && accessError
              ? `Signed in as ${user.email}`
              : "Sign in to bring your next week into focus."}
          </p>
          <ErrorBox>{error || accessError}</ErrorBox>
          {user && accessError ? (
            <div className="stack">
              <button
                className="button primary"
                disabled={Boolean(busy) || retrySeconds > 0}
                onClick={() => run("retry", refreshProfile)}
              >
                {busy === "retry" ? "Checking access..." : retrySeconds > 0 ? `Try again in ${retrySeconds}s` : "Check access again"}
              </button>
              <button className="button secondary" onClick={logout}>
                Sign out
              </button>
            </div>
          ) : (
            <>
              <button
                className="button google"
                disabled={Boolean(busy)}
                onClick={() =>
                  run("google", () =>
                    signInWithPopup(
                      getFirebaseAuth(),
                      new GoogleAuthProvider(),
                    ),
                  )
                }
              >
                <span className="google-g">G</span>
                {busy === "google" ? "Connecting…" : "Continue with Google"}
              </button>
              <div className="divider">
                <span>or use your email</span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  run("email", () =>
                    signInWithEmailAndPassword(
                      getFirebaseAuth(),
                      email.trim(),
                      password,
                    ),
                  );
                }}
              >
                <Field label="Email address">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@youragency.com"
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                  />
                </Field>
                <button
                  className="button primary wide"
                  disabled={Boolean(busy)}
                >
                  {busy === "email" ? "Signing in…" : "Open my workspace"}
                  <Icon name="arrow" size={18} />
                </button>
              </form>
            </>
          )}
          <p className="login-help">
            Access is managed by your agency. Need an account? Ask your agency.
          </p>
        </div>
      </section>
    </main>
  );
}
