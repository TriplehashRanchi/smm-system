import RoleGuard from '../../../../components/role-guard';
import AgencyDashboard from '../../../../components/agency-dashboard';

export const metadata = { title: 'Agency dashboard · Social OS' };
export default function AgencyDashboardPage() {
  return <RoleGuard role="AGENCY"><AgencyDashboard /></RoleGuard>;
}
