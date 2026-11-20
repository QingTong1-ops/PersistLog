import { SubmissionForm } from '@/components/practice/submission-form';
export const metadata = { title: '提交代码' };
export default async function NewSubmissionPage({ searchParams }: { searchParams: Promise<{ copy?: string; task?: string; route?: string; preset?: string }> }) {
  const query = await searchParams;
  return <SubmissionForm copyId={query.copy} taskId={query.task} routeId={query.route} preset={query.preset === 'lru'} />;
}
