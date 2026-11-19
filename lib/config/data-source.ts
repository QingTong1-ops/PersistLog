/** A build-time choice. Never read a URL, cookie or storage value to choose a source. */
const configured = process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'live';
if (configured !== 'live' && configured !== 'mock') {
  throw new Error('NEXT_PUBLIC_DATA_SOURCE must be mock or live');
}
export const DATA_SOURCE: 'mock' | 'live' = configured;
export const IS_MOCK = DATA_SOURCE === 'mock';
