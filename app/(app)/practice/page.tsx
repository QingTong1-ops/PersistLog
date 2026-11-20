import { PracticeView } from '@/components/practice/practice-view';
import type { HistoryFilter } from '@/lib/practice/types';
export const metadata = { title: '代码练习' };
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const query = await searchParams;
  const filter = (['all', 'pending', 'succeeded', 'insufficient', 'failed'].includes(query.status ?? '') ? query.status : 'all') as HistoryFilter;
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  return <PracticeView filter={filter} page={page} />;
}
