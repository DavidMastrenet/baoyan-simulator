import type { Choice, Condition, GameState, Program, Stats } from './types';
import { recommendationRule } from './balance';
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
export const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
export function averageScore(s: GameState): number {
  if (!s.semesters.length) return round(65 + s.stats.study * 0.35);
  const credits = s.semesters.reduce((n, t) => n + (t.recommendationCredits ?? t.credits), 0);
  return round(
    s.semesters.reduce(
      (n, t) => n + (t.recommendationScore ?? t.score) * (t.recommendationCredits ?? t.credits),
      0,
    ) / credits,
    2,
  );
}
export function gpa(s: GameState): number {
  if (!s.semesters.length) return 0;
  return round(
    s.semesters.reduce((n, t) => n + t.gpa * t.credits, 0) /
      s.semesters.reduce((n, t) => n + t.credits, 0),
    2,
  );
}
export function extraScore(s: GameState): number {
  const awards = s.awards.filter((a) => a.recognized !== false);
  const score = (kind: string, unit: number) => {
    const values = awards.filter((a) => a.kind === kind).map((a) => a.level * unit);
    return recommendationRule(s.profile).achievementMode === 'best'
      ? Math.max(0, ...values)
      : values.reduce((a, b) => a + b, 0);
  };
  const r = score('科研', 12),
    c = score('竞赛', 10),
    p = score('项目', 7) + score('实践', 7);
  return round(
    clamp(
      Math.min(35, r) + Math.min(30, c) + Math.min(25, p) + Math.min(10, s.stats.practice * 0.1),
    ),
  );
}
function peerGrade(s: GameState, p: GameState['peers'][number]) {
  return clamp(p.score + p.growth * Math.min(s.semesters.length, 6), 55, 98);
}
function weightedStanding(s: GameState, grade: number, extra: number): number {
  const academic =
    1 + s.peers.filter((p) => peerGrade(s, p) > grade).length + (averageScore(s) > grade ? 1 : 0);
  const activities =
    1 + s.peers.filter((p) => p.extra > extra).length + (extraScore(s) > extra ? 1 : 0);
  return academic * s.profile.gradeWeight + activities * (1 - s.profile.gradeWeight);
}
export function composite(s: GameState): number {
  if (recommendationRule(s.profile).rankBased)
    return round(
      100 -
        ((weightedStanding(s, averageScore(s), extraScore(s)) - 1) /
          Math.max(1, s.profile.cohortSize - 1)) *
          100,
      2,
    );
  return round(
    averageScore(s) * s.profile.gradeWeight + extraScore(s) * (1 - s.profile.gradeWeight),
    2,
  );
}
export function rank(s: GameState, academic = false): number {
  if (!academic && recommendationRule(s.profile).rankBased) {
    const mine = weightedStanding(s, averageScore(s), extraScore(s));
    return 1 + s.peers.filter((p) => weightedStanding(s, peerGrade(s, p), p.extra) < mine).length;
  }
  const score = academic ? averageScore(s) : composite(s);
  return (
    1 +
    s.peers.filter((p) => {
      const grade = clamp(p.score + p.growth * Math.min(s.semesters.length, 6), 55, 98);
      const rival = academic
        ? grade
        : grade * s.profile.gradeWeight + p.extra * (1 - s.profile.gradeWeight);
      return rival > score;
    }).length
  );
}
export function eligible(s: GameState, c?: Condition): boolean {
  if (!c) return true;
  if ((c.from !== undefined && s.turn < c.from) || (c.to !== undefined && s.turn > c.to))
    return false;
  if (c.flags?.some((f) => !s.flags[f]) || c.notFlags?.some((f) => s.flags[f])) return false;
  if (c.anyFlags && !c.anyFlags.some((f) => s.flags[f])) return false;
  if (c.majors && !c.majors.includes(s.profile.major)) return false;
  if (c.failures !== undefined && s.failures > 0 !== c.failures) return false;
  if (c.applicationStatus && !s.applications.some((a) => c.applicationStatus!.includes(a.status)))
    return false;
  if (c.min && Object.entries(c.min).some(([k, v]) => s.stats[k as keyof Stats] < v!)) return false;
  if (c.max && Object.entries(c.max).some(([k, v]) => s.stats[k as keyof Stats] > v!)) return false;
  return true;
}
export function fitScore(s: GameState, p: Program): number {
  const experience = Math.min(
    4,
    s.awards.filter((a) =>
      p.track === 'research'
        ? a.kind === '科研'
        : p.track === 'craft'
          ? a.kind === '项目'
          : a.kind === '实践',
    ).length,
  );
  return clamp(
    (p.major === s.profile.major ? 18 : p.major === '不限' ? 10 : 0) +
      s.stats[p.track] * 0.32 +
      s.stats.research * 0.12 +
      s.stats.expression * 0.16 +
      experience +
      (s.flags['direction.clear'] ? 5 : 0),
  );
}
export function selectionScore(s: GameState, p: Program): number {
  const record = averageScore(s) * 0.42;
  const specialty = s.stats[p.track] * 0.24;
  const language = s.stats.english * 0.1;
  const evidence = extraScore(s) * 0.1;
  return round(
    record + specialty + language + evidence + s.stats.expression * 0.08 + fitScore(s, p) * 0.06,
  );
}
export function substitute(text: string, s: GameState): string {
  const map: Record<string, string> = {
    campus: s.profile.campus,
    major: s.profile.major,
    quota: String(s.profile.quota),
    rank: String(rank(s)),
    grade: averageScore(s).toFixed(1),
    gpa: gpa(s).toFixed(2),
    cet6: String(s.cet6),
    cohort: String(s.profile.cohortSize),
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => map[key] ?? '');
}

export function canChoose(s: GameState, c: Choice): boolean {
  return eligible(s, c.when) && s.stats.money + (c.effects?.money ?? 0) >= 0;
}
