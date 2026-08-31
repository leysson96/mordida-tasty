import { TrackingClient } from '../../../components/tracking-client';

export default async function TrackingPage({
  params,
  searchParams
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  return <TrackingClient orderNumber={orderNumber} trackingToken={t} />;
}
