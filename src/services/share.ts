import type { GameState } from '../engine/types';
import { validateState } from '../engine/validation';
import { DATA_EPOCH } from './protocol';
export type ShareKind = 'progress' | 'ending';
export interface SharedGame {
  kind: ShareKind;
  state: GameState;
  expiresAt: number;
}
const api = import.meta.env.BASE_URL + 'api/';
async function responseData(response: Response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('分享服务暂时不可用，请稍后重试。');
  }
  if (!response.ok)
    throw new Error(typeof data.error === 'string' ? data.error : '分享请求失败，请重试。');
  return data;
}
export async function createShare(
  state: GameState,
  kind: ShareKind,
): Promise<{ url: string; expiresAt: number }> {
  const snapshot = JSON.parse(JSON.stringify(state)) as GameState;
  delete snapshot.profile.nickname;
  const response = await fetch(api + 'share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epoch: DATA_EPOCH, kind, state: snapshot }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await responseData(response);
  if (!/^[A-Za-z0-9_-]{24}$/.test(data.token) || !Number.isFinite(data.expiresAt))
    throw new Error('分享结果读取失败，请重试。');
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  url.searchParams.set('share', data.token);
  return { url: url.href, expiresAt: data.expiresAt };
}
export async function readShare(token: string): Promise<SharedGame> {
  if (!/^[A-Za-z0-9_-]{24}$/.test(token)) throw new Error('分享链接格式不正确。');
  const response = await fetch(api + 'share/' + token, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const data = await responseData(response);
  if (
    !['progress', 'ending'].includes(data.kind) ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= Date.now() ||
    !validateState(data.state)
  )
    throw new Error('这份分享已失效，请让分享者重新生成。');
  if ((data.kind === 'ending') !== (data.state.stage === 'ended'))
    throw new Error('这份分享内容不完整。');
  return data as SharedGame;
}
