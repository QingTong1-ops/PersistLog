import { ReviewView } from '@/components/practice/review-view';
export const metadata = { title: '代码评审' };
export default async function ReviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ review?: string }>;
}) {
  const { id } = await params;
  const { review } = await searchParams;
  return <ReviewView key={id + ':' + (review ?? 'latest')} submissionId={id} reviewId={review} />;
}
