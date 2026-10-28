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
  const { checkout } = await searchParams;
  return <Storefront initialView={checkout === '1' ? 'checkout' : 'menu'} />;
}
