const dashboards = {
  AGENCY: '/agency/dashboard',
  CLIENT: '/client/dashboard',
};

export function dashboardPath(role) {
  return dashboards[role] || '/login';
}

export function clientPath(id) {
  return `/clients/${encodeURIComponent(id)}`;
}
