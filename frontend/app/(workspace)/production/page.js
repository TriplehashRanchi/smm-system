import { redirect } from 'next/navigation';
export default async function Page({ searchParams }) { const query = await searchParams; const params = new URLSearchParams(); if (query.clientId) params.set('clientId', query.clientId); if (query.mine) params.set('mine', query.mine); redirect('/posts?' + params); }
