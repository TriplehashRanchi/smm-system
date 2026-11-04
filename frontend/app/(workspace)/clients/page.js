import ClientsPage from '../../../components/clients-page';
import { Suspense } from 'react';
import { Loading } from '../../../components/ui';

export const metadata = { title: 'Clients & accounts · Social OS' };
export default function Page() { return <Suspense fallback={<Loading />}><ClientsPage /></Suspense>; }
