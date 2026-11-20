import type { CodeStatistics, Draft, HistoryFilter, PracticeOverview, ReviewDetail, SubmissionInput } from './types';

/** Stable async page-facing interface; both local preview and future HTTP adapters implement it. */
export interface PracticeRepository {
  overview(filter?: HistoryFilter, page?: number): Promise<PracticeOverview>;
  draft(): Promise<Draft | null>;
  saveDraft(input: SubmissionInput, version: number): Promise<Draft>;
  deleteDraft(version: number): Promise<void>;
  submit(input: SubmissionInput, key: string, version: number, parentId?: string): Promise<string>;
  detail(id: string, reviewId?: string): Promise<ReviewDetail>;
  retry(id: string, key: string): Promise<string>;
  improve(id: string, reviewId: string, itemId: string, completed: boolean, version: number): Promise<void>;
  answer(id: string, reviewId: string, questionId: string, answer: string, version: number): Promise<void>;
  statistics(days: 7 | 30): Promise<CodeStatistics>;
}
