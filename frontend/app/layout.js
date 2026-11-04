import './globals.css';
import { AuthProvider } from '../components/auth-provider';

export const metadata = {
  title: 'Social OS · Agency operations',
  description: 'One place for your clients, social accounts, and publishing commitments.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
