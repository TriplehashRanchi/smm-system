'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { dashboardPath } from '../lib/routes';
import { Loading } from './ui';

export default function RoleGuard({ role, children }) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && profile && profile.role !== role) {
      router.replace(dashboardPath(profile.role));
    }
  }, [loading, profile, role, router]);
  if (!profile || profile.role !== role) return <Loading>Opening your dashboard…</Loading>;
  return children;
}
