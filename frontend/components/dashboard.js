"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { Empty, ErrorBox, Icon, initials, labels } from "./ui";
import { clientPath } from "../lib/routes";
import ClientActionSummary from './client-action-summary';

const stages = [
  { id: "setup", title: "Needs setup", icon: "circle", tone: "slate", description: "Your agency adds your active social accounts here." },
  { id: "progress", title: "In progress", icon: "progress", tone: "violet", description: "Your agency sets the weekly targets for your accounts." },
  { id: "ready", title: "Targets set", icon: "check-circle", tone: "teal", description: "Businesses with targets for every active account appear here." },
];
function stageFor(client) {
  if (client.status === "ARCHIVED") return "archived";
  const accounts = client.socialAccounts.filter((account) => account.active);
  if (!accounts.length) return "setup";
  return accounts.every((account) => account.publishingTargets.some((target) => target.targetCount > 0)) ? "ready" : "progress";
}
function BusinessCard({ business, index, compact }) {
  const accounts = business.socialAccounts.filter((account) => account.active);
  const targets = accounts.reduce((sum, account) => sum + account.publishingTargets.reduce((count, target) => count + target.targetCount, 0), 0);
  return (
    <Link href={clientPath(business.id)} className={`board-card ${compact ? "compact" : ""}`}>
      <div className="board-card-heading"><h3>{business.name}</h3><Icon name="chevron-right" size={16} /></div>
      {!compact && <>
        <p className="board-card-timezone"><Icon name="calendar" size={14} />{business.timezone}</p>
        <div className="board-platforms">
          {[...new Set(accounts.map((account) => account.platform))].map((platform) => <span key={platform} className={`channel-badge ${platform.toLowerCase()}`}>{labels[platform]}</span>)}
          {!accounts.length && <span className="channel-badge">No active channels yet</span>}
        </div>
        <div className="board-card-people"><span className={`client-mini-avatar color-${index % 4}`}>{initials(business.name)}</span><span>{business.status === "ARCHIVED" ? "Archived business" : "Your business workspace"}</span></div>
      </>}
      <div className="board-card-footer"><span><Icon name="link" size={15} />{accounts.length} active account{accounts.length === 1 ? "" : "s"}</span><span>{targets} target / week</span></div>
    </Link>
  );
}

export default function ClientDashboard() {
  const { profile, api } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [compact, setCompact] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    let active = true;
    setSummary(null);
    setSummaryError("");
    api("/dashboard")
      .then((result) => { if (active) setSummary(result.data); })
      .catch((error) => { if (active) setSummaryError(error.message); });
    return () => { active = false; };
  }, [api, revision]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setBusinesses([]);
    const timer = setTimeout(() => {
      api(`/clients?${new URLSearchParams({ search, status, page: String(page), pageSize: "24" })}`)
        .then((result) => {
          if (!active) return;
          setBusinesses(result.data);
          setTotal(result.total);
          const lastPage = Math.max(1, Math.ceil(result.total / 24));
          if (page > lastPage) setPage(lastPage);
        })
        .catch((error) => { if (active) { setBusinesses([]); setTotal(0); setError(error.message); } })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [api, page, search, status, revision]);

  const archived = businesses.filter((business) => business.status === "ARCHIVED");
  const column = (stage) => {
    const items = businesses.filter((business) => stageFor(business) === stage.id);
    return <section key={stage.id} className={`board-column ${stage.tone}`} aria-label={stage.title}>
      <div className="board-column-title"><h2><Icon name={stage.icon} size={18} />{stage.title}</h2><span className="column-count">{items.length}</span></div>
      <div className="board-column-body">
        {items.map((business, index) => <BusinessCard key={business.id} business={business} index={index} compact={compact} />)}
        {!items.length && <div className="board-empty"><span><Icon name={stage.icon} size={25} /></span><strong>No businesses in this stage</strong><p>{stage.description}</p></div>}
      </div>
    </section>;
  };

  return <>
    <div className="page-heading board-page-heading">
      <div><span className="eyebrow">YOUR BUSINESS WORKSPACE</span><h1>Hello, {profile.name.split(" ")[0]}<span className="mint-text">.</span></h1><p>Your businesses, social accounts, and weekly publishing targets.</p></div>
      <div className="button-row"><Link className="button primary" href="/calendar">View planned content</Link><button className="button secondary" onClick={refresh} disabled={loading}>Refresh</button></div>
    </div>
    <ErrorBox>{summaryError}</ErrorBox>
    <section className="client-portal-stats" aria-label="Your active workspace totals" aria-busy={!summary && !summaryError}>
      {[
        { label: "Active businesses", value: summary?.clients, icon: "clients" },
        { label: "Active social accounts", value: summary?.accounts, icon: "link" },
        { label: "Weekly posting target", value: summary?.weeklyTarget, icon: "calendar" },
      ].map((item) => <article key={item.label}><span><Icon name={item.icon} size={18} />{item.label}</span><strong>{item.value ?? "\u2014"}</strong></article>)}
    </section>
    <ClientActionSummary api={api} revision={revision} />
    <div className="view-toolbar">
      <div className="view-switch" role="group" aria-label="Business view">
        <button className={view === "list" ? "selected" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}><Icon name="list" size={18} />List</button>
        <button className={view === "board" ? "selected" : ""} aria-pressed={view === "board"} onClick={() => setView("board")}><Icon name="board" size={18} />Board</button>
      </div>
      <div className="board-tools">
        <label className="board-search"><Icon name="search" size={18} /><input aria-label="Search your businesses" placeholder="Search businesses..." maxLength={160} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label className="board-filter"><Icon name="sliders" size={17} /><select aria-label="Filter your businesses by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); if (event.target.value === "ARCHIVED") setArchivedOpen(true); }}><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="ALL">All businesses</option></select></label>
        <button className={`compact-toggle ${compact ? "enabled" : ""}`} aria-pressed={compact} onClick={() => setCompact(!compact)}><Icon name="settings" size={18} /><span>Compact</span></button>
      </div>
    </div>
    <div className="board-summary"><div>Account setup, managed by your agency</div><span>{loading ? "Loading businesses..." : error ? "Unable to load businesses" : total ? `${(page - 1) * 24 + 1}-${Math.min(page * 24, total)} of ${total} businesses` : "No businesses in this view"}</span></div>
    {error ? <div className="card client-retry-panel"><ErrorBox>{error}</ErrorBox><button className="button secondary" onClick={refresh}>Try again</button></div> : loading ? <div className="empty" role="status">Loading your businesses...</div> : !businesses.length ? (
      <div className="card"><Empty title={search ? "No matching businesses" : status === "ARCHIVED" ? "No archived businesses" : "No businesses in this view"} action={<button className="button secondary" onClick={() => { setSearch(""); setStatus("ALL"); setPage(1); refresh(); }}>{search || status !== "ALL" ? "Show all my businesses" : "Refresh access"}</button>}>
        {search ? "Try another business name or clear your filters." : "Your agency manages the businesses shared with your login. If a business is missing, contact your agency."}
      </Empty></div>
    ) : view === "board" ? (
      <div className={`client-board client-portal-board ${status === "ACTIVE" ? "no-archive" : ""} ${status === "ARCHIVED" ? "archive-only" : ""} ${archivedOpen && status === "ALL" ? "archive-expanded" : ""}`} role="region" aria-label="Your business account setup board" tabIndex={0}>
        {status !== "ARCHIVED" && stages.slice(0, 2).map(column)}
        {status !== "ACTIVE" && <section className={`archive-column ${archivedOpen || status === "ARCHIVED" ? "expanded" : ""}`} aria-label="Your archived businesses">
          <button className="archive-toggle" aria-expanded={archivedOpen || status === "ARCHIVED"} disabled={status === "ARCHIVED"} onClick={() => setArchivedOpen(!archivedOpen)}><Icon name={archivedOpen || status === "ARCHIVED" ? "chevron-down" : "chevron-right"} size={18} /><span><Icon name="archive" size={17} />Archived <b>{archived.length}</b></span></button>
          {(archivedOpen || status === "ARCHIVED") && <div className="archive-body">{archived.map((business, index) => <BusinessCard key={business.id} business={business} index={index} compact={compact} />)}{!archived.length && <p>No archived businesses on this page.</p>}</div>}
        </section>}
        {status !== "ARCHIVED" && column(stages[2])}
      </div>
    ) : (
      <div className={`card table-card ${compact ? "compact-table" : ""}`}><div className="table-scroll"><table><thead><tr><th>Business</th><th>Account setup</th><th>Active accounts</th><th>Timezone</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
        {businesses.map((business, index) => <tr key={business.id}><td><Link className="list-client-link" href={clientPath(business.id)}><span className={`client-mini-avatar color-${index % 4}`}>{initials(business.name)}</span><strong>{business.name}</strong></Link></td><td><span className={`stage-label ${stageFor(business)}`}>{stages.find((stage) => stage.id === stageFor(business))?.title || "Archived"}</span></td><td>{business.socialAccounts.filter((account) => account.active).length}</td><td>{business.timezone}</td><td><Link className="text-button" href={clientPath(business.id)}>View business <Icon name="chevron-right" size={14} /></Link></td></tr>)}
      </tbody></table></div></div>
    )}
    {!loading && !error && total > 24 && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 24)}</span><button className="button secondary" disabled={page * 24 >= total} onClick={() => setPage(page + 1)}>Next</button></div>}
    <div className="board-footnote"><Icon name="calendar" size={15} /><span>Weekly targets are planned commitments, set by your agency. Board counts reflect the current page and filters.</span><Link href="/clients">View my businesses <Icon name="arrow" size={14} /></Link></div>
  </>;
}
