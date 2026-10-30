import { Suspense } from 'react';
import Storefront from '@/components/storefront';

export default function Home({ searchParams }: PageProps<'/'>) {
  return (
    <Suspense fallback={<Storefront />}>
      <HomeWithCheckout searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeWithCheckout({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { checkout, login, view } = await searchParams;
  const initialView = checkout === '1' ? 'checkout' : view === 'orders' ? 'orders' : 'menu';
  return <Storefront key={initialView} initialView={initialView} openLoginOnLoad={login === '1'} />;
}
