const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      { source: '/admin/dashboard', destination: '/agency/dashboard', permanent: false },
      { source: '/team/dashboard', destination: '/agency/dashboard', permanent: false },
      { source: '/users', destination: '/clients', permanent: false },
    ];
  },
};
export default nextConfig;
