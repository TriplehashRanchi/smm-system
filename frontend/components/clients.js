"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Empty, ErrorBox, Icon, initials, labels } from "./ui";
import { ClientForm } from "./client-forms";
import { clientPath } from "../lib/routes";

export function Clients({ agency, api, notify }) {
  const router = useRouter();
  const query = useSearchParams();
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => { document.title = `${agency ? "Clients & accounts" : "My accounts"} \u00b7 Social OS`; }, [agency]);
  useEffect(() => {
    setSearch(query.get("q") || "");
    setPage(1);
    if (agency && query.get("new") === "1") {
      setDialog("client");
      const remaining = new URLSearchParams(query.toString());
      remaining.delete("new");
      router.replace(`/clients${remaining.size ? `?${remaining}` : ""}`, { scroll: false });
    }
  }, [agency, query, router]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setClients([]);
    const timer = setTimeout(
      () =>
        api(
          `/clients?${new URLSearchParams({ search, status, page: String(page), pageSize: "24" })}`,
        )
          .then((result) => {
            if (active) {
              setClients(result.data);
              setTotal(result.total);
              const lastPage = Math.max(1, Math.ceil(result.total / 24));
              if (page > lastPage) setPage(lastPage);
            }
          })
          .catch((error) => {
            if (active) { setClients([]); setTotal(0); setError(error.message); }
          })
          .finally(() => {
            if (active) setLoading(false);
          }),
      180,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, search, status, page, revision]);
  const changed = (message) => {
    setRevision((value) => value + 1);
    notify(message);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{agency ? "BUILT AROUND YOUR CLIENTS" : "BUSINESSES SHARED WITH YOU"}</span>
          <h1>
            {agency ? "Clients & accounts" : "My accounts"}<span className="mint-text">.</span>
          </h1>
          <p>
            {agency
              ? "Create a Client, add social accounts and start planning posts."
              : "View your accounts, social accounts, and weekly posting targets."}
          </p>
        </div>
        {agency && (
          <button
            className="button primary"
            onClick={() => setDialog("client")}
          >
            <Icon name="plus" size={18} />
            Add client
          </button>
        )}
        {!agency && <button className="button secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>}
      </div>
      <div className="filter-bar">
        <label className="search-input">
          <Icon name="search" size={18} />
          <input
            aria-label={agency ? "Search clients" : "Search your accounts"}
            placeholder={agency ? "Find a client..." : "Find your client..."}
            maxLength={160}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label={agency ? "Filter client status" : "Filter business status"}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="ACTIVE">{agency ? "Active clients" : "Active clients"}</option>
          <option value="ARCHIVED">{agency ? "Archived clients" : "Archived clients"}</option>
          <option value="ALL">{agency ? "All clients" : "All my clients"}</option>
        </select>
        <span className="result-count">
          {loading ? "Loading..." : `${total} ${agency ? total === 1 ? "client" : "clients" : total === 1 ? "business" : "clients"}`}
        </span>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {error ? <div className="card client-retry-panel"><button className="button secondary" onClick={() => setRevision((value) => value + 1)}>Try again</button></div> : loading ? (
        <div className="empty" role="status">
          {agency ? "Loading your clients..." : "Loading your accounts..."}
        </div>
      ) : clients.length ? (
        <div className="client-grid">
          {clients.map((client, index) => (
            <Link
              key={client.id}
              className="client-card"
              href={clientPath(client.id)}
            >
              <div className="client-card-top">
                <span className={`client-avatar color-${index % 4}`}>
                  {initials(client.name)}
                </span>
                <span
                  className={`badge ${client.status === "ACTIVE" ? "green" : "neutral"}`}
                >
                  {client.status === "ACTIVE" ? "Active" : "Archived"}
                </span>
              </div>
              <h2>{client.name}</h2>
              <p className="muted">{client.timezone}</p>
              <div className="platform-chips">
                {[
                  ...new Set(
                    client.socialAccounts.filter((account) => agency || account.active).map((account) => account.platform),
                  ),
                ].map((platform) => (
                  <span key={platform} className="platform-chip">
                    {labels[platform]}
                  </span>
                ))}
                {!client.socialAccounts.some((account) => agency || account.active) && (
                  <span className="muted">{agency ? "No social accounts yet" : "No active social accounts yet"}</span>
                )}
              </div>
              <div className="client-card-footer">
                <span>
                  <strong>
                    {
                      client.socialAccounts.filter((account) => account.active)
                        .length
                    }
                  </strong>{" "}
                  active accounts
                </span>
                <Icon name="arrow" size={19} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty
            title={
              search
                ? agency ? "No matching clients" : "No matching clients"
                : status === "ARCHIVED"
                  ? agency ? "No archived clients" : "No archived clients"
                  : agency ? "Your next client starts here" : "No clients in this view"
            }
            action={
              agency && !search && status === "ACTIVE" ? (
                <button
                  className="button primary"
                  onClick={() => setDialog("client")}
                >
                  <Icon name="plus" size={18} />
                  Add your first client
                </button>
              ) : !agency && (status !== "ALL" || search) ? <button className="button secondary" onClick={() => { setSearch(""); setStatus("ALL"); setPage(1); }}>Show all my clients</button> : null
            }
          >
            {search
              ? "Try another name or adjust the status filter."
              : agency
                ? "Create a client profile, then add their social accounts and weekly commitments."
                : "Your agency manages the clients shared with your login. Contact your agency if a business is missing."}
          </Empty>
        </div>
      )}
      {!loading && !error && total > 24 && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil(total / 24)}
          </span>
          <button
            className="button secondary"
            disabled={page * 24 >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
      {agency && dialog && (
        <ClientForm
          api={api}
          onClose={() => setDialog(null)}
          onSaved={(client) => {
            setDialog(null);
            changed("Client created. Add their social accounts next.");
            router.push(clientPath(client.id));
          }}
        />
      )}
    </>
  );
}

