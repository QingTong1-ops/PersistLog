import { PracticeError } from './types';
/** Deliberately no guessed URLs or fetch calls until the real contract is delivered. */
export function unavailable(): never {
  throw new PracticeError('NOT_CONNECTED', '代码练习接口尚未接入。当前只提供 Mock 效果预览，未发送任何请求。');
}
