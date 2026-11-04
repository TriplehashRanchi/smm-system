import { Suspense } from 'react';
import MySocialAccounts from '../../../components/my-social-accounts';
import RoleGuard from '../../../components/role-guard';
import { Loading } from '../../../components/ui';

export const metadata = { title: 'My social accounts · Social OS' };
export default function MyAccountsPage() {
  return <RoleGuard role="CLIENT"><Suspense fallback={<Loading />}><MySocialAccounts /></Suspense></RoleGuard>;
}
