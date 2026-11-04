import Link from "next/link";

// The socialos logo: a gradient tile with the "s" mark and a two-tone wordmark.
export default function Brand({ href = "/" }) {
  return (
    <Link href={href} className="app-brand" aria-label="socialos home">
      <span className="app-brand-logo" aria-hidden="true">s</span>
      <span className="app-brand-name">social<span>os</span></span>
    </Link>
  );
}
