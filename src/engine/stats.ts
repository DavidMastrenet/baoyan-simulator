import type { Effects, GameState, Stats } from './types';
import { clamp, round } from './rules';
export function changeStats(s: GameState, effects: Effects = {}): void {
  for (const [key, value] of Object.entries(effects)) {
    const k = key as keyof Stats,
      learning = [
        'study',
        'research',
        'english',
        'craft',
        'practice',
        'expression',
        'network',
      ].includes(k);
    const gain =
      s.life && learning && value! > 0 ? value! * Math.max(0.02, (100 - s.stats[k]) / 100) : value!;
    const exact = clamp(
      s.stats[k] + gain + (s.life?.carry?.[k] ?? 0),
      0,
      k === 'money' ? 999999 : 100,
    );
    s.stats[k] = round(exact, k === 'money' ? 0 : 1);
    if (s.life) {
      s.life.carry ??= {};
      s.life.carry[k] = exact - s.stats[k];
    }
  }
}
