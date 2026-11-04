'use client';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import { Clients } from './clients';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loading } from './ui';

export default function ClientsPage() {
  const { profile, api } = useAuth();
  const { notify } = useWorkspace();
  const router = useRouter(), query = useSearchParams();
  const search = query.get('q') || '';
  useEffect(() => {
    if (profile.role === 'CLIENT') router.replace(`/my-accounts${search ? `?${new URLSearchParams({ q: search })}` : ''}`);
  }, [profile.role, router, search]);
  return profile.role === 'AGENCY' ? <Clients agency api={api} notify={notify} /> : <Loading>Opening your social accounts...</Loading>;
}
