import type { ChapterIndex, Ending, GameEvent, InterviewQuestion, Program } from '../engine/types';
import { resourceName } from '../engine/resource';
const base = `${import.meta.env.BASE_URL}story/v2/`;
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_CACHE = 10;
/** At most one event/question body is requested by each game transition. No bulk prefetch. */
async function resource<T>(path: string, valid: (x: unknown) => boolean): Promise<T> {
  if (cache.has(path)) {
    const result = cache.get(path);
    cache.delete(path);
    cache.set(path, result);
    return result as T;
  }
  if (inflight.has(path)) return inflight.get(path) as Promise<T>;
  const task = (async () => {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(base + path, {
        signal: controller.signal,
        cache: 'no-cache',
        credentials: 'same-origin',
      });
      if (!response.ok)
        throw new Error(`内容读取未完成（${response.status}）。点击重试继续这一页。`);
      const result: unknown = await response.json();
      if (!valid(result)) throw new Error('这一页的内容格式需要更新。点击重试重新读取。');
      cache.set(path, result);
      while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value!);
      return result as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new Error('这一页尚未读完。重试会保留当前进度。');
      if (error instanceof TypeError) throw new Error('连接暂时中断。恢复连接后可从当前一页继续。');
      throw error;
    } finally {
      clearTimeout(timer);
      inflight.delete(path);
    }
  })();
  inflight.set(path, task);
  return task;
}
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
export const loadChapter = (chapter: number) =>
  resource<ChapterIndex>(
    `chapters/${chapter}.json`,
    (x) =>
      record(x) &&
      x.version === 1 &&
      x.chapter === chapter &&
      Array.isArray(x.events) &&
      x.events.every(
        (e) =>
          record(e) &&
          typeof e.id === 'string' &&
          typeof e.file === 'string' &&
          !('body' in e) &&
          !('choices' in e),
      ),
  );
export const loadEvent = (id: string) =>
  resource<GameEvent>(
    `events/${resourceName('events', id)}`,
    (x) =>
      record(x) &&
      x.id === id &&
      typeof x.title === 'string' &&
      Array.isArray(x.body) &&
      Array.isArray(x.choices) &&
      x.choices.length >= 2,
  );
export const loadQuestion = (id: string) =>
  resource<InterviewQuestion>(
    `questions/${resourceName('questions', id)}`,
    (x) => record(x) && x.id === id && Array.isArray(x.options) && x.options.length === 3,
  );
export const loadEnding = (id: string) =>
  resource<Ending>(
    `endings/${resourceName('endings', id)}`,
    (x) => record(x) && x.id === id && Array.isArray(x.body),
  );
export const loadPrograms = () =>
  resource<Program[]>(
    'programs.json',
    (x) =>
      Array.isArray(x) &&
      x.length > 0 &&
      x.every(
        (p) =>
          record(p) &&
          typeof p.id === 'string' &&
          typeof p.school === 'string' &&
          Array.isArray(p.available),
      ),
  );
export function clearContentCache() {
  cache.clear();
}
