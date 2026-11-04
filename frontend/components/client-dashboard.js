"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-provider";
import { useWorkspace } from "./workspace";
import { useLiveRefresh } from "./live-updates";
import { ErrorBox, Icon, labels } from "./ui";
import PlatformIcon, { platformColors } from "./platform-icon";
import { stageLabels, contentLabel } from "../lib/posts";
import { dashboardWindow, dayHeading, daysAgo, greeting, longDate, plural, postsOnDay, timeIn } from "../lib/dashboard";

const Logo = ({ platform, size = 14 }) => <span className="dash-post-logo" style={{ "--brand": platformColors[platform] || "#6b45b0" }}><PlatformIcon platform={platform} size={size} /></span>;

export default function ClientDashboard() {
  const { profile, api } = useAuth();
  const [data, setData] = useState(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  const win = useMemo(() => dashboardWindow(14), []);
  const { notifyError } = useWorkspace();
  useEffect(() => { if (error) notifyError(error); }, [error, notifyError]);
  useLiveRefresh(() => setRevision(value => value + 1));
  useEffect(() => {
    let active = true; setError("");
    api(`/dashboard/client?${new URLSearchParams(win.query)}`)
      .then(result => { if (active) setData(result.data); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [api, revision, win]);

  const actions = data?.actions, month = data?.month;
  const summary = !data ? "Loading your dashboard..." : actions.total ? `${plural(actions.total, "thing")} waiting for you.` : "You are all caught up.";
  const todo = [
    { key: "scripts", label: "Scripts & content to review", count: actions?.scripts, href: "/posts?stage=CONTENT_REVIEW", icon: "edit" },
    { key: "finals", label: "Final creatives to approve", count: actions?.finals, href: "/posts?stage=FINAL_REVIEW", icon: "check-circle" },
    { key: "footage", label: "Footage to send", count: actions?.footage, href: "/posts?stage=WAITING_FOOTAGE", icon: "calendar" },
  ];
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(`${win.today.slice(0, 7)}-15T12:00:00Z`));
  const planned = month?.planned || 0, pct = value => planned ? Math.min(100, Math.round((value / planned) * 100)) : 0;

  return (
    <div className="dash">
      <header className="dash-hero">
        <div>
          <span className="eyebrow">{longDate().toUpperCase()}</span>
          <h1>{greeting()}, {profile.name.split(" ")[0]}<span className="mint-text">.</span></h1>
          <p>{summary}</p>
        </div>
        <div className="dash-hero-actions">
          <button className="icon-button posts-refresh" onClick={() => setRevision(value => value + 1)} title="Refresh" aria-label="Refresh dashboard"><Icon name="refresh" size={18} /></button>
          <Link className="button primary" href="/posts"><Icon name="list" size={16} />Open posts</Link>
        </div>
      </header>

      <ErrorBox>{error}</ErrorBox>
      {error && <button className="button secondary" onClick={() => setRevision(value => value + 1)}>Try again</button>}

      <section className="card dash-card dash-actions" aria-label="Needs your action" aria-busy={!data}>
        <div className="dash-card-head"><h2>Needs your action</h2>{data && <span className={`badge ${actions.total ? "green" : "neutral"}`}>{actions.total ? actions.total : "All clear"}</span>}</div>
        <div className="dash-todo">
          {todo.map(item => (
            <Link key={item.key} href={item.href} className={`dash-todo-item ${item.count === 0 ? "is-zero" : ""}`}>
              <span className="dash-attn-icon"><Icon name={item.icon} size={19} /></span>
              <strong>{item.count ?? "—"}</strong><span>{item.label}</span>
            </Link>
          ))}
        </div>
        {data && (actions.approvals.length > 0 || actions.footagePosts.length > 0) && (
          <ul className="dash-list">
            {actions.approvals.map(request => (
              <li key={request.id}>
                <Link href={`/posts?postId=${request.contentItem.id}`}>
                  <Logo platform={request.contentItem.socialAccount.platform} />
                  <span className="dash-list-main"><strong>{request.title}</strong><small>{request.kind === "FINAL" ? "Final creative" : contentLabel(request.contentItem.contentType)} v{request.version} &middot; sent {daysAgo(request.createdAt)}</small></span>
                  <span className="dash-list-go">Review <Icon name="arrow" size={14} /></span>
                </Link>
              </li>
            ))}
            {actions.footagePosts.map(post => (
              <li key={post.id}>
                <Link href={`/posts?postId=${post.id}`}>
                  <Logo platform={post.socialAccount.platform} />
                  <span className="dash-list-main"><strong>{post.title}</strong><small>Waiting for your footage</small></span>
                  <span className="dash-list-go">Open <Icon name="arrow" size={14} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data && actions.total === 0 && <p className="muted dash-empty">Nothing needs your approval right now. Your agency will let you know when something is ready.</p>}
        {data && actions.scripts + actions.finals > 1 && <p className="muted small-text">Tip: open the list above and tick several posts to approve them all at once.</p>}
      </section>

      <div className="dash-grid">
        <section className="card dash-card" aria-label="Coming up">
          <div className="dash-card-head"><h2>Coming up</h2><Link className="text-button" href="/posts?view=calendar&period=week">Open calendar {"→"}</Link></div>
          <p className="muted small-text dash-sub">Next 14 days across your accounts.</p>
          {data && (data.upcoming.length ? (
            <ul className="dash-week">
              {win.days.filter(day => postsOnDay(data.upcoming, day).length).map(day => (
                <li key={day} className={day === win.today ? "is-today" : ""}>
                  <span className="dash-day">{dayHeading(day, win.today)}</span>
                  <div>
                    {postsOnDay(data.upcoming, day).map(item => (
                      <Link key={item.id} className="dash-post" href={`/posts?postId=${item.id}`}>
                        <Logo platform={item.socialAccount.platform} size={13} />
                        <span className="dash-post-time">{timeIn(item.publishAt, item.socialAccount.timezone)}</span>
                        <span className="dash-post-title">{item.title}</span>
                        <i className={`stage-dot ${item.sheetStage.toLowerCase()}`} title={stageLabels[item.sheetStage]} />
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="muted dash-empty">Nothing is scheduled in the next 14 days.</p>)}
        </section>

        <div className="dash-stack">
          <section className="card dash-card" aria-label="This month">
            <div className="dash-card-head"><h2>{monthName}</h2><span className="muted small-text">{data ? `${plural(planned, "post")} planned` : ""}</span></div>
            {data && (planned ? (
              <>
                <div className="dash-progress" role="img" aria-label={`${month.published} published, ${month.ready} ready, ${planned} planned`}>
                  <span className="published" style={{ width: `${pct(month.published)}%` }} /><span className="ready" style={{ width: `${pct(month.ready)}%` }} />
                </div>
                <ul className="dash-month">
                  <li><i className="stage-dot published" />Published<b>{month.published}</b></li>
                  <li><i className="stage-dot ready" />Ready to post<b>{month.ready}</b></li>
                  <li><i className="stage-dot" />Planned in total<b>{planned}</b></li>
                </ul>
              </>
            ) : <p className="muted dash-empty">No posts are planned for this month yet.</p>)}
          </section>

          <section className="card dash-card" aria-label="Your accounts">
            <div className="dash-card-head"><h2>Your accounts</h2><Link className="text-button" href="/my-accounts">All {"→"}</Link></div>
            {data && (data.accounts.length ? (
              <ul className="dash-accounts">
                {data.accounts.map(account => (
                  <li key={account.id}>
                    <Link href={`/posts?clientId=${account.clientId}&socialAccountId=${account.id}`} className={account.active ? "" : "is-off"}>
                      <Logo platform={account.platform} size={16} /><span className="dash-list-main"><strong>{account.handle}</strong><small>{labels[account.platform]}{account.active ? "" : " · Inactive"}</small></span><Icon name="arrow" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="muted dash-empty">Your agency will add your social accounts here.</p>)}
          </section>
        </div>
      </div>
    </div>
  );
}
