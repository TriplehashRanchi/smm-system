"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-provider";
import { useWorkspace } from "./workspace";
import { useLiveRefresh } from "./live-updates";
import { ErrorBox, Icon, labels } from "./ui";
import PlatformIcon, { platformColors } from "./platform-icon";
import { stageLabels } from "../lib/posts";
import { dashboardWindow, dayHeading, greeting, longDate, plural, postsOnDay, timeIn } from "../lib/dashboard";

const attentionCards = [
  { key: "overdue", label: "Overdue", hint: "Past the planned date and not published", tone: "red", icon: "calendar", params: { focus: "overdue" } },
  { key: "changes", label: "Changes requested", hint: "The client asked for edits", tone: "amber", icon: "edit", params: { focus: "changes" } },
  { key: "ready", label: "Ready to publish", hint: "Approved. Post it and record it", tone: "green", icon: "check-circle", params: { stage: "READY" } },
  { key: "waiting", label: "Waiting on clients", hint: "Reviews or footage still pending", tone: "purple", icon: "users", params: { focus: "waiting" } },
  { key: "incomplete", label: "Drafts to finish", hint: "Missing a script or a publish date", tone: "grey", icon: "list", params: { focus: "incomplete" } },
];

export default function AgencyDashboard() {
  const { profile, api } = useAuth();
  const [clientId, setClientId] = useState(""), [data, setData] = useState(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  const win = useMemo(() => dashboardWindow(7), []);
  const { notifyError } = useWorkspace();
  useEffect(() => { if (error) notifyError(error); }, [error, notifyError]);
  useLiveRefresh(() => setRevision(value => value + 1));
  useEffect(() => {
    let active = true; setError("");
    api(`/dashboard/agency?${new URLSearchParams({ ...win.query, ...(clientId ? { clientId } : {}) })}`)
      .then(result => { if (active) setData(result.data); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, clientId, revision, win]);

  const postsHref = (params = {}) => `/posts?${new URLSearchParams({ ...(clientId ? { clientId } : {}), ...params })}`;
  const attention = data?.attention, needs = attention ? attention.overdue + attention.changes + attention.ready : 0;
  const stages = data?.stages || {}, open = Object.entries(stages).filter(([key]) => !["PUBLISHED", "CANCELLED"].includes(key)).reduce((sum, [, count]) => sum + count, 0);
  const isNew = data && !data.clientOptions.length;
  const summary = !data ? "Loading your workspace..." : isNew ? "Welcome. Add your first client to get started." : needs ? `${plural(needs, "post")} need${needs === 1 ? "s" : ""} your attention.` : "You are all caught up.";

  return (
    <div className="dash">
      <header className="dash-hero">
        <div>
          <span className="eyebrow">{longDate().toUpperCase()}</span>
          <h1>{greeting()}, {profile.name.split(" ")[0]}<span className="mint-text">.</span></h1>
          <p>{summary}</p>
        </div>
        <div className="dash-hero-actions">
          {data && data.clientOptions.length > 1 && (
            <label className="dash-filter"><span className="sr-only">Client</span>
              <select value={clientId} onChange={event => setClientId(event.target.value)} aria-label="Show one client or all">
                <option value="">All clients</option>
                {data.clientOptions.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
          )}
          <button className="icon-button posts-refresh" onClick={() => setRevision(value => value + 1)} title="Refresh" aria-label="Refresh dashboard"><Icon name="refresh" size={18} /></button>
          <Link className="button primary" href={postsHref()}><Icon name="list" size={16} />Open posts</Link>
        </div>
      </header>

      <ErrorBox>{error}</ErrorBox>
      {error && <button className="button secondary" onClick={() => setRevision(value => value + 1)}>Try again</button>}

      {isNew ? (
        <section className="card dash-card dash-welcome">
          <h2>Set up your workspace</h2>
          <p className="muted">Your dashboard fills in as soon as you add clients and plan posts.</p>
          <ol>
            <li><Link href="/clients?new=1"><strong>Add a client</strong><small>One profile for each client organization.</small></Link></li>
            <li><Link href="/clients"><strong>Connect their social accounts</strong><small>Instagram, LinkedIn, Facebook and YouTube.</small></Link></li>
            <li><Link href="/posts"><strong>Plan your first posts</strong><small>Add one, or paste a whole month from a spreadsheet.</small></Link></li>
          </ol>
        </section>
      ) : (
        <>
          <section className="dash-attention" aria-label="Needs attention" aria-busy={!data}>
            {attentionCards.map(card => {
              const count = attention?.[card.key];
              return (
                <Link key={card.key} className={`dash-attn ${card.tone} ${count === 0 ? "is-zero" : ""}`} href={postsHref(card.params)}>
                  <span className="dash-attn-icon"><Icon name={card.icon} size={19} /></span>
                  <strong>{count ?? "—"}</strong>
                  <span className="dash-attn-label">{card.label}</span>
                  <small>{card.hint}</small>
                </Link>
              );
            })}
          </section>

          <div className="dash-grid">
            <section className="card dash-card" aria-label="Pipeline">
              <div className="dash-card-head"><h2>Pipeline</h2><span className="muted small-text">{data ? `${plural(open, "post")} in progress · ${stages.PUBLISHED || 0} published` : ""}</span></div>
              {data && (open + (stages.PUBLISHED || 0) > 0 ? (
                <>
                  <div className="dash-bar" role="img" aria-label="Posts by stage">
                    {Object.entries(stages).filter(([key, count]) => count > 0 && key !== "CANCELLED").map(([key, count]) => (
                      <Link key={key} href={postsHref({ stage: key })} className={`dash-seg ${key.toLowerCase()}`} style={{ flexGrow: count }} title={`${stageLabels[key]}: ${count}`} />
                    ))}
                  </div>
                  <ul className="dash-legend">
                    {Object.entries(stages).filter(([key, count]) => key !== "CANCELLED" || count > 0).map(([key, count]) => (
                      <li key={key}><Link href={postsHref({ stage: key })} className={count ? "" : "is-zero"}><i className={`stage-dot ${key.toLowerCase()}`} />{stageLabels[key]}<b>{count}</b></Link></li>
                    ))}
                  </ul>
                </>
              ) : <p className="muted dash-empty">No posts yet. <Link className="text-button" href="/posts">Plan your first post {"→"}</Link></p>)}
            </section>

            <section className="card dash-card" aria-label="This week">
              <div className="dash-card-head"><h2>Next 7 days</h2><Link className="text-button" href={postsHref({ view: "calendar", period: "week" })}>Open calendar {"→"}</Link></div>
              {data && (
                <ul className="dash-week">
                  {win.days.filter(day => day === win.today || postsOnDay(data.week, day).length).map(day => {
                    const items = postsOnDay(data.week, day);
                    return (
                      <li key={day} className={day === win.today ? "is-today" : ""}>
                        <span className="dash-day">{dayHeading(day, win.today)}</span>
                        <div>
                          {items.length ? items.slice(0, 4).map(item => (
                            <Link key={item.id} className="dash-post" href={postsHref({ postId: item.id })}>
                              <span className="dash-post-logo" style={{ "--brand": platformColors[item.socialAccount.platform] || "#6b45b0" }}><PlatformIcon platform={item.socialAccount.platform} size={13} /></span>
                              <span className="dash-post-time">{timeIn(item.publishAt, item.socialAccount.timezone)}</span>
                              <span className="dash-post-title">{item.title}</span>
                              <i className={`stage-dot ${item.sheetStage.toLowerCase()}`} title={stageLabels[item.sheetStage]} />
                            </Link>
                          )) : <span className="dash-none">{day === win.today ? "Nothing scheduled today" : "Nothing scheduled"}</span>}
                          {items.length > 4 && <Link className="dash-more" href={postsHref({ view: "calendar", period: "week" })}>+{items.length - 4} more</Link>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {data && !data.week.length && <p className="muted small-text dash-empty">Nothing is scheduled in the next 7 days. <Link className="text-button" href={postsHref()}>Plan a post {"\u2192"}</Link></p>}
            </section>
          </div>

          <section className="card dash-card" aria-label="Clients at a glance">
            <div className="dash-card-head"><h2>Clients at a glance</h2><Link className="text-button" href="/clients">All clients {"→"}</Link></div>
            {data && (data.clients.length ? (
              <div className="table-scroll">
                <table className="dash-table">
                  <thead><tr><th>Client</th><th>Accounts</th><th>In progress</th><th>Waiting on client</th><th>Overdue</th><th>Published this month</th><th><span className="sr-only">Open</span></th></tr></thead>
                  <tbody>
                    {data.clients.map(client => (
                      <tr key={client.id}>
                        <td><Link className="dash-client" href={`/clients/${client.id}`}>{client.name}</Link></td>
                        <td>{client.accounts}</td>
                        <td>{client.inProgress}</td>
                        <td>{client.waiting ? <span className="dash-pill purple">{client.waiting}</span> : <span className="muted">0</span>}</td>
                        <td>{client.overdue ? <span className="dash-pill red">{client.overdue}</span> : <span className="muted">0</span>}</td>
                        <td>{client.published}</td>
                        <td className="dash-row-link"><Link className="text-button" href={`/posts?clientId=${client.id}`}>Posts {"→"}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted dash-empty">No active clients to show.</p>)}
          </section>
        </>
      )}
    </div>
  );
}
