"use client";
import { useEffect, useRef, useId } from "react";

const paths = {
  home: "M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  board: "M3 4h18v16H3z M9 4v16 M15 4v16",
  list: "M9 5h12 M9 12h12 M9 19h12 M3 5h1 M3 12h1 M3 19h1",
  circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  progress: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l4-3",
  "check-circle": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M8 12l3 3 5-6",
  "plus-circle": "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 8v8 M8 12h8",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-right": "M9 6l6 6-6 6",
  sliders: "M4 6h3 M11 6h9 M4 12h9 M17 12h3 M4 18h3 M11 18h9 M7 3v6 M13 9v6 M7 15v6",
  spark: "M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3",
  archive: "M3 3h18v5H3z M5 8v13h14V8 M10 12h4",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  clients:
    "M4 21V5a2 2 0 0 1 2-2h9v18 M15 9h3a2 2 0 0 1 2 2v10 M2 21h20 M8 7h3 M8 11h3 M8 15h3 M8 19h3",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  plus: "M12 5v14 M5 12h14",
  search: "M21 21l-5-5 M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13",
  check: "M5 12l4 4L19 6",
  close: "M6 6l12 12 M6 18L18 6",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  logout: "M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4 M14 8l5 4-5 4 M9 12h10",
  link: "M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7",
  user: "M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  panel: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M15 5v14",
  alert: "M12 3l9.5 17h-19z M12 10v4.5 M12 17.5h.01",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v5 M12 8h.01",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z M13.5 6.5l4 4",
};
export function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
export const labels = {
  AGENCY: "Agency",
  CLIENT: "Client",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  OTHER: "Other",
  ALL: "All formats",
  REEL: "Reels",
  CAROUSEL: "Carousels",
  STATIC_GRAPHIC: "Static graphics",
  STORY: "Stories",
  LINKEDIN_TEXT: "LinkedIn text",
  DOCUMENT_POST: "Document posts",
};
export function initials(name = "") {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorBox({ children }) {
  return children ? (
    <div role="alert" className="alert error">
      {children}
    </div>
  ) : null;
}
export function Empty({ icon = "clients", title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({ children = "Opening your workspace…" }) {
  return (
    <div className="center-screen" role="status">
      <div className="loading-dot" />
      <p>{children}</p>
    </div>
  );
}
export function Modal({ title, subtitle, children, onClose }) {
  const ref = useRef(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={subtitle ? descriptionId : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <header className="modal-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p id={descriptionId}>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
