import Link from 'next/link';
export default function NotFound() {
  return <main className="center-screen"><div className="card"><span className="eyebrow">404</span><h1>That page isn’t here.</h1><p>Return to your workspace to find your clients and accounts.</p><Link className="button primary" href="/">Open workspace</Link></div></main>;
}
