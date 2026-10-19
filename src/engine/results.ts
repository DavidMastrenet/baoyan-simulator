import type { Feedback, GameState } from './types';

export function retainResult(s: GameState, feedback: Feedback): void {
  if (!s.life) return;
  s.life.recentResults = [
    JSON.parse(JSON.stringify(feedback)) as Feedback,
    ...(s.life.recentResults ?? []),
  ].slice(0, 2);
}
