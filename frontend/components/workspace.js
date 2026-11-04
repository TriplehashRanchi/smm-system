"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { dashboardPath } from "../lib/routes";
import { Icon, Loading, initials, labels } from "./ui";
import Brand from "./brand";

const WorkspaceContext = createContext(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace pages require the shared workspace layout.");
  return context;
}
export default function Workspace({ children }) {
  const { profile, api, loading, accessError, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [toasts, setToasts] = useState([]);
  const toastCount = useRef(0);
  const apiRef = useRef(api);
  apiRef.current = api;
  const cursorRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Toasts: a message (what happened), an optional description (which post), an optional link. Types: success, error, warning, info.
  // The timer pauses while the pointer is over a toast.
  const timers = useRef(new Map());
  const dismiss = useCallback((id) => { clearTimeout(timers.current.get(id)?.timer); timers.current.delete(id); setToasts((list) => list.filter((toast) => toast.id !== id)); }, []);
  const arm = useCallback((id, ms) => { clearTimeout(timers.current.get(id)?.timer); timers.current.set(id, { timer: setTimeout(() => dismiss(id), ms), ms, startedAt: Date.now() }); }, [dismiss]);
  const pause = useCallback((id) => { const entry = timers.current.get(id); if (!entry) return; clearTimeout(entry.timer); entry.ms = Math.max(1500, entry.ms - (Date.now() - entry.startedAt)); }, []);
  const resume = useCallback((id) => { const entry = timers.current.get(id); if (entry) arm(id, entry.ms); }, [arm]);
  const push = useCallback((message, type = "success", extra = {}) => {
    if (!message) return;
    const id = ++toastCount.current, duration = type === "error" ? 9000 : type === "warning" ? 8000 : 5500;
    setToasts((list) => list.some((toast) => toast.message === message && toast.type === type && toast.description === extra.description) ? list : [...list.slice(-3), { id, message, type, duration, ...extra }]);
    arm(id, duration);
  }, [arm]);
  const notify = useCallback((message, type = "success", extra) => push(message, type, extra), [push]);
  const notifyError = useCallback((message, extra) => push(message, "error", extra), [push]);
  const notifyInfo = useCallback((message, extra) => push(message, "info", extra), [push]);
  useEffect(() => {
    if (!loading && (!profile || accessError)) router.replace("/login");
  }, [loading, profile, accessError, router]);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // Every 30 seconds (while this tab is visible) ask whether the other side changed anything, and say so.
  useEffect(() => {
    if (!profile) return;
    let active = true, running = false;
    async function poll() {
      if (!active || running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const result = await apiRef.current(`/notifications${cursorRef.current ? `?since=${encodeURIComponent(cursorRef.current)}` : ""}`);
        if (!active) return;
        const first = cursorRef.current === null;
        cursorRef.current = result.cursor;
        if (first || !result.data.length) return;
        result.data.slice(0, 3).forEach((update) => push(update.message, update.tone, { description: update.title, href: `/posts?postId=${update.postId}` }));
        if (result.data.length > 3) push(`${result.data.length - 3} more update${result.data.length - 3 === 1 ? "" : "s"}`, "info", { description: "on your posts", href: "/posts" });
        window.dispatchEvent(new CustomEvent("workspace-updates", { detail: result.data }));
      } catch { /* a missed check is fine; the next one will catch up */ } finally { running = false; }
    }
    poll();
    const timer = setInterval(poll, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [profile?.id, push]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  if (loading || !profile || accessError) return <Loading />;
  const agency = profile.role === "AGENCY";
  const home = dashboardPath(profile.role);
  const spaces = [
    { href: agency ? "/agency/dashboard" : "/client/dashboard", label: "Dashboard", icon: "home" },
    { href: agency ? "/clients" : "/my-accounts", label: agency ? "Clients" : "My social accounts", icon: agency ? "clients" : "link" },
    { href: "/posts", label: "Posts", icon: "list" },
  ];
  const active = (href) => pathname === href || (["/clients", "/production"].includes(href) && pathname.startsWith(`${href}/`));
  return <WorkspaceContext.Provider value={{ notify, notifyError, notifyInfo }}>
    <div className="workspace">
      <header className="global-bar">
        <div className="global-brand">
          <button className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="workspace-sidebar" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
          <Brand href={home} />
        </div>
      </header>
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside id="workspace-sidebar" className={`sidebar ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="Main navigation">
          {spaces.map((item) => <Link key={item.href} href={item.href} className={`nav-item ${active(item.href) ? "active" : ""}`} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-user">
          <Link href="/account" className={`sidebar-user-link ${pathname === "/account" ? "active" : ""}`} aria-current={pathname === "/account" ? "page" : undefined} title="My account"><span className="avatar">{initials(profile.name)}</span><div><strong>{profile.name}</strong><small>{labels[profile.role]} account</small></div></Link>
          <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={logout}><Icon name="logout" size={18} /></button>
        </div>
      </aside>
      <div className="workspace-main">
        <main className="main-content">
          {children}
        </main>
      </div>
      <div className="toast-stack" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type}`} role={toast.type === "error" ? "alert" : "status"} onMouseEnter={() => pause(toast.id)} onMouseLeave={() => resume(toast.id)}>
            <Icon className="toast-icon" name={{ success: "check-circle", error: "alert", warning: "alert", info: "info" }[toast.type] || "info"} size={19} />
            <div className="toast-text"><strong>{toast.message}</strong>{toast.description && <span>{toast.description}</span>}</div>
            {toast.href && <Link className="toast-action" href={toast.href} onClick={() => dismiss(toast.id)}>{toast.label || "View"}</Link>}
            <button className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><Icon name="close" size={13} /></button>
            <span className="toast-timer" style={{ animationDuration: `${toast.duration}ms` }} />
          </div>
        ))}
      </div>
    </div>
  </WorkspaceContext.Provider>;
}
