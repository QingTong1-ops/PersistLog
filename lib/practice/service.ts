import { IS_MOCK } from '@/lib/config/data-source';
import { live } from '@/lib/api/live';
import { unavailable } from './live';
import type { PracticeAdapter } from './mock';

/** One data-source boundary; Live intentionally remains unconnected for this delivery. */
export async function withPractice<T>(action: (adapter: PracticeAdapter) => T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!IS_MOCK) return unavailable();
  const user = await live.auth.me();
  const { createMockPractice } = await import('./mock');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const value = action(createMockPractice(window.sessionStorage, user.id + ':' + user.created_at));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return value;
}
