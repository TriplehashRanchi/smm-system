import { Suspense } from 'react';
import PostsSheet from '../../../components/posts-sheet';
import { Loading } from '../../../components/ui';
export const metadata = { title: 'Posts · Social OS' };
export default function PostsPage() { return <Suspense fallback={<Loading />}><PostsSheet /></Suspense>; }
