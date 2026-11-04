import { redirect } from 'next/navigation';
export default async function Page({ searchParams }) { const query = await searchParams; redirect('/posts' + (query.clientId ? '?clientId=' + encodeURIComponent(query.clientId) : '')); }
