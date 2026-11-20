import { IS_MOCK } from '@/lib/config/data-source';
import { live } from '@/lib/api/live';
import { getLivePractice } from './live';
import type { PracticeRepository } from './repository';

/** One data-source boundary; Live intentionally remains unconnected for this delivery. */
export async function withPractice<T>(action: (adapter: PracticeRepository) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!IS_MOCK) return action(getLivePractice());
  const user = await live.auth.me();
  const { createMockPractice } = await import('./mock');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const mock = createMockPractice(window.sessionStorage, user.id + ':' + user.created_at);
  const repository: PracticeRepository = {
    overview: async (...args) => mock.overview(...args), draft: async () => mock.draft(),
    saveDraft: async (...args) => mock.saveDraft(...args), deleteDraft: async (...args) => mock.deleteDraft(...args),
    submit: async (...args) => mock.submit(...args), detail: async (...args) => mock.detail(...args),
    retry: async (...args) => mock.retry(...args), improve: async (...args) => mock.improve(...args),
    answer: async (...args) => mock.answer(...args), statistics: async (...args) => mock.statistics(...args),
  };
  const value = await action(repository);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return value;
}
