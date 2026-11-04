'use client';
import { useParams } from 'next/navigation';
import { useAuth } from './auth-provider';
import { useWorkspace } from './workspace';
import ClientDetail from './client-detail';
import RoleGuard from './role-guard';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { profile, api } = useAuth();
  const { notify } = useWorkspace();
  return <RoleGuard role="AGENCY"><ClientDetail key={id} id={id} agency api={api} notify={notify} /></RoleGuard>;
}
