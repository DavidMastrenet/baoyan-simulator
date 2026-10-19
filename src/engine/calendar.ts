import type { GameState } from './types';
import { PERIODS } from './world';

const MONTH_DAYS = [30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31];
export function periodDays(turn: number): number {
  if (turn < 32) return MONTH_DAYS[turn % 12]!;
  return [15, 16, 15, 15, 10, 10, 11, 10, 10, 11, 10, 10, 1, 1, 1, 1][turn - 32]!;
}
export function absoluteDay(s: GameState): number {
  let days = s.life?.day ?? 0;
  for (let i = 0; i < s.turn; i++) days += periodDays(i);
  return days;
}
export function lastDay(): number {
  return PERIODS.reduce((n, _, i) => n + periodDays(i), 0) - 1;
}
export function dateAt(day: number): string {
  let turn = 0;
  while (turn < 47 && day >= periodDays(turn)) {
    day -= periodDays(turn);
    turn++;
  }
  const p = PERIODS[turn]!,
    year = ['', '一', '二', '三', '四'][p.year];
  const month =
    turn < 32
      ? ['九', '十', '十一', '十二', '一', '二', '三', '四', '五', '六', '七', '八'][turn % 12]
      : turn < 34
        ? '五'
        : turn < 36
          ? '六'
          : turn < 39
            ? '七'
            : turn < 42
              ? '八'
              : '九';
  const start =
    turn < 32 ? 1 : [1, 16, 1, 16, 1, 11, 21, 1, 11, 21, 1, 11, 21, 22, 23, 24][turn - 32]!;
  return `大${year}${month}月${start + Math.min(day, periodDays(turn) - 1)}日`;
}
export function currentDate(s: GameState): string {
  return dateAt(absoluteDay(s));
}
export function periodEndDate(turn: number): string {
  let day = periodDays(turn) - 1;
  for (let i = 0; i < turn; i++) day += periodDays(i);
  return dateAt(day);
}
export function calendarDay(turn: number): number {
  return Math.max(0, periodDays(turn) - Math.max(1, Math.ceil(periodDays(turn) * 0.15)));
}
export function nextMilestone(s: GameState): { label: string; date: string } {
  for (let i = s.turn; i < PERIODS.length; i++) {
    const p = PERIODS[i]!;
    const label =
      i === 42
        ? '校内推荐结果'
        : i === 44
          ? '正式系统开放'
          : p.exam
            ? '学期成绩'
            : p.englishExam
              ? '英语考试'
              : i === 32
                ? '夏令营申请'
                : i === 40
                  ? '预推免申请'
                  : i === 47
                    ? '推免季结束'
                    : '';
    if (label && !(i === s.turn && (s.life?.day ?? 0) >= periodDays(i)))
      return { label, date: periodEndDate(i) };
  }
  return { label: '推免季结束', date: periodEndDate(47) };
}
