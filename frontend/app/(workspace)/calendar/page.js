import { redirect } from 'next/navigation';
export default async function Page({ searchParams }) { const query = await searchParams; const params = new URLSearchParams({view:'calendar'}); if (query.clientId) params.set('clientId', query.clientId); redirect('/posts?' + params); }
