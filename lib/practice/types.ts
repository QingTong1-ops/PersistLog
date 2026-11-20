/** Frontend domain models, NOT a claim about the as-yet-unavailable backend DTO. */
export const LANGUAGES = ['Python 3.11', 'Java 17', 'JavaScript', 'TypeScript'] as const;
export type Language = typeof LANGUAGES[number];
export type ReviewStatus = 'pending' | 'reviewing' | 'succeeded' | 'insufficient' | 'failed';
export type HistoryFilter = 'all' | 'pending' | 'succeeded' | 'insufficient' | 'failed';
export interface SubmissionInput {
  title: string; language: Language; difficulty: string; source: string; taskId?: string; originSubmissionId?: string;
  tags: string; fileName: string; code: string; timeComplexity: string; spaceComplexity: string;
  notes: string; testStatus: 'provided' | 'untested'; passed: string; total: string; failedTest: string;
  independent: boolean; consent: boolean;
}
export interface Draft { id: string; version: number; savedAt: string; input: SubmissionInput }
export interface Evidence { id: string; fileName: string; start: number; end: number; snippet: string; explanation: string }
export interface Improvement { id: string; title: string; method: string; verification: string; completed: boolean }
export interface Followup { id: string; question: string; answer: string }
export interface ReviewResult {
  score: number | null; grade: string | null; confidence: number; risk: string;
  dimensions: { label: string; score: number | null; reason: string }[];
  evidence: Evidence[]; improvements: Improvement[]; followups: Followup[];
}
export interface ReviewAttempt {
  id: string; number: number; version: number; status: ReviewStatus;
  createdAt: string; finishedAt: string | null; error: string | null;
  result: ReviewResult | null;
}
export interface Submission { id: string; createdAt: string; input: SubmissionInput; parentId?: string; attempts: ReviewAttempt[] }
export interface ReviewDetail {
  submission: Submission; selected: ReviewAttempt; latest: ReviewAttempt;
  progress: number; stage: string; updatedAt: string;
}
export interface PracticeOverview {
  currentTask: { title: string; source: string; minutes: number };
  history: Submission[]; total: number; page: number; pageSize: number;
  improvements: { submissionId: string; reviewId: string; item: Improvement }[];
}
export interface CodeStatistics {
  days: 7 | 30; submissions: number; scored: number; average: number | null; highest: number | null;
  improved: number; improvements: number;
  points: { date: string; average: number | null; selftest: number | null; count: number }[];
  recent: Submission[];
}
export class PracticeError extends Error {
  constructor(public code: string, message: string, public fields: Record<string, string> = {}) { super(message); }
}
export const EMPTY_INPUT: SubmissionInput = {
  title: '', language: 'Python 3.11', difficulty: '未标记', source: '自由练习', tags: '', fileName: 'solution.py',
  code: '', timeComplexity: '', spaceComplexity: '', notes: '', testStatus: 'provided', passed: '', total: '',
  failedTest: '', independent: false, consent: false,
};
export const STATUS_LABEL: Record<ReviewStatus, string> = { pending: '待评审', reviewing: '评审中', succeeded: '已评审', insufficient: '证据不足', failed: '评审失败' };
