'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-provider';
import { dashboardPath } from '../lib/routes';
import { Loading } from './ui';

export default function RoleRedirect() {
  const { loading, profile } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(profile ? dashboardPath(profile.role) : '/login');
  }, [loading, profile, router]);
  return <Loading />;
}
