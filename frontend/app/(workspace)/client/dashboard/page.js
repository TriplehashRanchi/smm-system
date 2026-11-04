import RoleGuard from '../../../../components/role-guard';
import ClientDashboard from '../../../../components/client-dashboard';

export const metadata = { title: 'Dashboard · Social OS' };
export default function ClientDashboardPage() {
  return <RoleGuard role="CLIENT"><ClientDashboard /></RoleGuard>;
}
