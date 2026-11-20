import { LANGUAGES, type SubmissionInput } from './types';
export const MAX_CODE_BYTES = 200 * 1024;
export function validateSubmission(input: SubmissionInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim() || input.title.length > 200) errors.title = '请输入 1–200 字的题目名称。';
  if (!LANGUAGES.includes(input.language)) errors.language = '请选择支持的代码语言。';
  if (!input.code.trim()) errors.code = '请粘贴代码或选择文本代码文件。';
  else if (new TextEncoder().encode(input.code).byteLength > MAX_CODE_BYTES) errors.code = '代码不能超过 200 KiB。';
  if (!input.fileName.trim() || input.fileName.length > 120 || !/\.(py|java|js|ts|txt)$/i.test(input.fileName)) errors.fileName = '文件名需为 py/java/js/ts/txt，且不超过 120 字。';
  if (!input.timeComplexity.trim()) errors.timeComplexity = '请填写你判断的时间复杂度。';
  if (!input.spaceComplexity.trim()) errors.spaceComplexity = '请填写你判断的空间复杂度。';
  if (input.testStatus === 'provided') {
    const passed = Number(input.passed), total = Number(input.total);
    if (!input.total.trim() || !Number.isSafeInteger(total) || total < 1) errors.total = '总用例数需为正整数。';
    if (!input.passed.trim() || !Number.isSafeInteger(passed) || passed < 0 || passed > total) errors.passed = '通过数需为非负整数，且不能大于总数。';
  }
  if (input.tags.split(/[,，]/).filter(x => x.trim()).length > 10) errors.tags = '标签最多 10 个。';
  if (!input.independent) errors.independent = '请确认这份代码由你独立完成。';
  if (!input.consent) errors.consent = '请确认本次静态评审用途后再提交。';
  return errors;
}
export function normalizeInput(input: SubmissionInput): SubmissionInput {
  return { ...input, title: input.title.trim(), tags: [...new Set(input.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean))].join(', '),
    ...(input.testStatus === 'untested' ? { passed: '', total: '', failedTest: '' } : {}) };
}
