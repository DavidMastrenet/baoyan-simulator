import type {
  ChapterIndex,
  Consequence,
  Effects,
  EventMeta,
  GameEvent,
  GameState,
  Plan,
  Stats,
} from './types';
import {
  BACKGROUNDS,
  BLANK_PLAN,
  DEFAULT_PLAN,
  MAJORS,
  PERIODS,
  ROUND_INCIDENTS,
  STAT_LABELS,
  TOTAL_TURNS,
  TRAITS,
} from './world';
import { hashSeed, integer, pick, random, weighted } from './random';
import {
  averageScore,
  canChoose,
  clamp,
  eligible,
  extraScore,
  rank,
  round,
  substitute,
} from './rules';
import { expireApplications, progressApplications } from './admissions';
import { chooseEnding } from './endings';
import { gradePoint, recommendationRule, RULES, termSubjects } from './balance';
import { absoluteDay, dateAt, periodDays } from './calendar';
import { changeStats } from './stats';
import { retainResult } from './results';
export { changeStats } from './stats';

export function createGame(seed: string): GameState {
  const rng = { rng: hashSeed(seed) };
  const campus = pick(rng, [
    { campus: '澄湖大学', kind: '综合大学', gradeWeight: 0.85, quota: 0.16 },
    { campus: '青原理工大学', kind: '理工大学', gradeWeight: 0.9, quota: 0.13 },
    { campus: '南栖师范大学', kind: '师范大学', gradeWeight: 0.8, quota: 0.15 },
    { campus: '白榆大学', kind: '地方综合大学', gradeWeight: 0.95, quota: 0.09 },
    { campus: '东川大学', kind: '综合大学', gradeWeight: 0.88, quota: 0.18 },
    { campus: '海州理工大学', kind: '理工大学', gradeWeight: 0.86, quota: 0.14 },
    { campus: '江安师范大学', kind: '师范大学', gradeWeight: 0.84, quota: 0.12 },
    { campus: '西岭大学', kind: '综合大学', gradeWeight: 0.92, quota: 0.1 },
    { campus: '北原工业大学', kind: '理工大学', gradeWeight: 0.9, quota: 0.2 },
    { campus: '安河财经大学', kind: '财经大学', gradeWeight: 0.87, quota: 0.13 },
    { campus: '临港大学', kind: '综合大学', gradeWeight: 0.83, quota: 0.15 },
    { campus: '平川大学', kind: '地方综合大学', gradeWeight: 0.94, quota: 0.08 },
  ]);
  const cohortSize = pick(rng, [48, 64, 80, 96, 112, 128, 144, 160]);
  const family = pick(rng, [
    { name: '需要精打细算', allowance: 900, money: 1000 },
    { name: '收支较为平稳', allowance: 1550, money: 2200 },
    { name: '预算较充足', allowance: 2150, money: 3600 },
    { name: '需要兼职补贴支出', allowance: 750, money: 1200 },
    { name: '家庭能够承担基本费用', allowance: 1250, money: 1800 },
    { name: '有一笔入学储蓄', allowance: 1400, money: 4200 },
    { name: '每月预算较宽裕', allowance: 2600, money: 3200 },
    { name: '后续费用需要提前规划', allowance: 1800, money: 900 },
  ]);
  const traitPool = [...TRAITS],
    traits = [];
  for (let i = 0; i < 3; i++)
    traits.push(traitPool.splice(integer(rng, 0, traitPool.length - 1), 1)[0]!);
  const stats: Stats = {
    study: integer(rng, 34, 52),
    research: integer(rng, 8, 20),
    english: integer(rng, 28, 52),
    craft: integer(rng, 12, 30),
    practice: integer(rng, 8, 24),
    expression: integer(rng, 22, 42),
    network: integer(rng, 15, 30),
    energy: integer(rng, 78, 95),
    stress: integer(rng, 12, 25),
    money: family.money,
    integrity: 100,
    materials: 0,
    backup: 0,
  };
  const background = pick(rng, BACKGROUNDS);
  for (const [key, value] of Object.entries(background.effects)) {
    const k = key as keyof Stats;
    stats[k] = clamp(stats[k] + value, 0, k === 'money' ? 999999 : 100);
  }
  const major = pick(rng, MAJORS),
    ruleId = Object.keys(RULES)[hashSeed(campus.campus + major) % Object.keys(RULES).length]!,
    rule = RULES[ruleId]!;
  const departments = [
    '计算机与信息学院',
    '基础科学学院',
    '经济管理学院',
    '人文社会科学学院',
    '教育学院',
    '交叉研究学院',
  ];
  const profile = {
    ...campus,
    cohortSize,
    quota: Math.max(4, Math.round(cohortSize * campus.quota)),
    major,
    ruleId,
    department: departments[MAJORS.indexOf(major)]!,
    gradeWeight: rule.weight!,
    location: pick(rng, ['省会城区', '沿海城市', '内陆城市', '大学城', '近郊校区', '地级市城区']),
    family: family.name,
    allowance: family.allowance,
    livingCost: integer(rng, 850, 1400),
    traits,
    aptitude: integer(rng, 0, 8),
    researchStyle: pick(rng, ['偏好实验分析', '偏好理论推导', '偏好项目开发', '偏好实践调查']),
    homeDistance: pick(rng, ['同城', '高铁两小时', '高铁五小时', '长途交通一天']),
    background: background.name,
    backgroundDescription: background.description,
    electivesCount: rule.courseScope !== 'core',
  };
  const peers = Array.from({ length: cohortSize - 1 }, () => ({
    score: round(68 + random(rng) * 12 + random(rng) * 12),
    growth: round(-0.2 + random(rng) * 0.65, 2),
    extra: round(5 + Math.pow(random(rng), 3) * 65),
  }));
  const now = new Date().toISOString();
  return {
    version: 1,
    seed,
    rng: rng.rng,
    createdAt: now,
    updatedAt: now,
    seconds: 0,
    turn: 0,
    stage: 'plan',
    slot: 0,
    eventId: null,
    profile,
    stats,
    originStats: { ...stats },
    peers,
    plan: { ...BLANK_PLAN },
    lastPlan: { ...DEFAULT_PLAN },
    termStudy: 0,
    termRounds: 0,
    semesters: [],
    failures: 0,
    cet4: 0,
    cet6: 0,
    flags: { ['background.' + background.id]: true },
    visited: {},
    scheduled: [{ id: 'new.background.' + background.id, due: 0 }],
    awards: [],
    log: [],
    feedback: null,
    review: [],
    qualification: 'pending',
    qualificationReason: '大四上学期公布校内推荐结果。',
    frozenRank: null,
    applications: [],
    interview: null,
    submissionsThisTurn: 0,
    interviewsThisTurn: 0,
    preparedThisTurn: false,
    chosenPath: 'academic',
    endingId: null,
    pendingCourses: [],
  };
}
export function hasTrait(s: GameState, id: string): boolean {
  return s.profile.traits.some((t) => t.id === id);
}
export function startPlan(s: GameState, plan: Plan): void {
  if (s.interview) throw new Error('先完成当前考核。');
  if (s.stage !== 'plan') throw new Error('当前安排已经确定。');
  if (
    Object.keys(plan).length !== 9 ||
    Object.entries(plan).some(
      ([k, n]) => !(k in BLANK_PLAN) || !Number.isInteger(n) || n < 0 || n > 6,
    ) ||
    Object.values(plan).reduce((a, b) => a + b, 0) !== 6
  )
    throw new Error('时间安排需要重新调整。');
  if (s.turn < 24 && plan.prepare > 0) throw new Error('申请准备在大三开放。');
  s.plan = { ...plan };
  s.lastPlan = { ...plan };
  trainPlan(s, plan, 1);
  s.stage = 'event';
  s.slot = 0;
  s.eventId = null;
  s.feedback = null;
  s.review = [];
}
export function trainPlan(s: GameState, plan: Plan, fraction: number): void {
  s.termStudy += plan.study * fraction;
  s.termRounds += fraction;
  const pace = s.turn < 32 ? 1 : 0.65;
  const fatigue = clamp((40 - s.stats.energy) / 80, 0, 0.45);
  const effective =
    (clamp(1 - (s.stats.stress > 65 ? (s.stats.stress - 65) * 0.007 : 0) - fatigue, 0.4, 1) *
      integer(s, 85, 115)) /
    100;
  const late = hasTrait(s, 'latebloomer') && s.turn >= 12 ? 0.3 : 0;
  const gains: Effects = {
    study: plan.study * (1.3 + (hasTrait(s, 'steady') ? 0.35 : 0) + late) * pace * effective,
    research: plan.research * (1.9 + (hasTrait(s, 'curious') ? 0.5 : 0) + late) * pace * effective,
    english: plan.english * (2 + (hasTrait(s, 'linguist') ? 0.55 : 0)) * pace * effective,
    craft: plan.craft * (2.2 + (hasTrait(s, 'maker') ? 0.5 : 0)) * pace * effective,
    practice:
      (plan.practice * (2.2 + (hasTrait(s, 'listener') ? 0.4 : 0)) + plan.work * 0.6) * pace,
    expression:
      (plan.social * 1.8 + plan.practice * 0.8 + (hasTrait(s, 'speaker') ? plan.social * 0.5 : 0)) *
      pace,
    network:
      (plan.social * 2.4 +
        plan.research * 0.45 +
        (hasTrait(s, 'connector') ? plan.social * 0.6 : 0) +
        (hasTrait(s, 'listener') ? plan.practice * 0.4 : 0)) *
      pace,
    energy: plan.rest * (14 + (hasTrait(s, 'outdoors') ? 3 : 0)) - (6 - plan.rest) * 5 - 4,
    stress:
      (6 - plan.rest) * 2 -
      plan.rest * (5 + (hasTrait(s, 'resilient') ? 2 : 0)) +
      2 +
      (hasTrait(s, 'perfectionist') && plan.rest === 0 ? 3 : 0),
    money: plan.work * 280 * pace,
    materials: plan.prepare * (6 + (hasTrait(s, 'perfectionist') ? 2 : 0)),
    backup: plan.prepare * 2.8,
  };
  if (hasTrait(s, 'quicklearner')) gains.study! += plan.study * 0.4;
  if (hasTrait(s, 'methodical')) gains.research! += plan.research * 0.4;
  if (hasTrait(s, 'improviser')) gains.craft! += plan.craft * 0.6;
  if (hasTrait(s, 'generous')) {
    gains.network! += plan.social * 0.8;
    gains.money! -= plan.social * 35;
  }
  if (hasTrait(s, 'anxious')) {
    gains.study! += plan.study * 0.3;
    gains.stress! += 2;
  }
  if (hasTrait(s, 'ambitious')) {
    gains.research! += plan.research * 0.5;
    gains.energy! -= 2;
  }
  if (hasTrait(s, 'independent')) {
    gains.craft! += plan.craft * 0.4;
    gains.network! -= plan.social * 0.3;
  }
  if (hasTrait(s, 'light-sleeper')) {
    gains.energy! -= 3;
    gains.english! += plan.english * 0.4;
  }
  if (hasTrait(s, 'organized')) gains.materials! += plan.prepare * 1.5;
  if (hasTrait(s, 'practical')) gains.backup! += plan.work * 0.8 + plan.prepare * 0.5;
  if (hasTrait(s, 'patient')) gains.stress! -= 1;
  if (hasTrait(s, 'competitive')) {
    gains.study! += plan.study * 0.25;
    gains.stress! += plan.research * 0.6;
  }
  for (const key of Object.keys(gains) as (keyof Stats)[]) gains[key] = gains[key]! * fraction;
  changeStats(s, gains);
  if (plan.study >= 3) s.flags['habit.study'] = true;
  if (plan.research >= 2) s.flags['habit.research'] = true;
  if (plan.practice >= 2) s.flags['habit.practice'] = true;
  if (plan.rest >= 3) s.flags['habit.rest'] = true;
  if (plan.work > 0) s.flags['work.experience'] = true;
}
export function selectEvent(s: GameState, index: ChapterIndex): EventMeta {
  const available = index.events.filter(
    (e) => eligible(s, e.when) && (!e.once || !s.visited[e.id]),
  );
  if (s.slot === 0) {
    const calendar = available.filter((e) => e.calendar === s.turn);
    if (calendar.length) return weighted(s, calendar, (e) => e.weight);
  }
  const due = s.scheduled.filter((q) => q.due <= s.turn).sort((a, b) => a.due - b.due);
  for (const q of due) {
    const event = available.find((e) => e.id === q.id);
    if (event) return event;
  }
  const regular = available.filter(
    (e) => e.calendar === undefined && !e.chain && !e.egg && !e.rare,
  );
  const rare = available.filter((e) => e.rare);
  if (rare.length && random(s) < 0.035) return weighted(s, rare, (e) => e.weight);
  const eggs = available.filter((e) => e.egg);
  if (eggs.length && random(s) < 0.11) return pick(s, eggs);
  const reactive = regular.filter(
    (e) =>
      e.when?.max?.energy !== undefined || e.when?.min?.stress !== undefined || e.when?.failures,
  );
  if (reactive.length && random(s) < 0.65) return weighted(s, reactive, (e) => e.weight);
  if (!regular.length) throw new Error('本阶段的事件索引需要重新读取。');
  return weighted(s, regular, (e) => e.weight / (1 + (s.visited[e.id] ?? 0) * 8));
}
export function checkChance(s: GameState, stat: keyof Stats, difficulty: number): number {
  const resource = stat === 'money' ? Math.min(100, s.stats.money / 50) : s.stats[stat];
  const trait =
    (stat === 'research' && hasTrait(s, 'curious')) ||
    (stat === 'craft' && hasTrait(s, 'maker')) ||
    (stat === 'expression' && hasTrait(s, 'speaker'));
  return round(
    clamp(
      0.5 +
        (resource - difficulty) * 0.009 +
        (s.stats.energy - 65) * 0.0015 -
        s.stats.stress * 0.001 +
        (trait ? 0.04 : 0),
      0.08,
      0.93,
    ),
    2,
  );
}
export function applyConsequence(s: GameState, c: Consequence): void {
  changeStats(s, c.effects);
  c.flags?.forEach((f) => (s.flags[f] = true));
  c.clearFlags?.forEach((f) => delete s.flags[f]);
  for (const next of c.schedule ?? []) {
    if (!s.scheduled.some((q) => q.id === next.id) && !s.visited[next.id])
      s.scheduled.push({ id: next.id, due: Math.min(TOTAL_TURNS - 1, s.turn + next.after) });
  }
  if (c.award && !s.awards.some((a) => a.id === c.award!.id))
    s.awards.push({ ...c.award, turn: s.turn });
  if (c.clearFailure) s.failures = Math.max(0, s.failures - 1);
  if (c.path) s.chosenPath = c.path;
  if (c.course)
    s.pendingCourses.push({
      ...c.course,
      counted:
        c.course.counted === 'all' || (c.course.counted === 'policy' && s.profile.electivesCount),
      replace: !!c.course.replace,
      turn: s.turn,
    });
  if (c.semesterCorrection && s.semesters.length) {
    const term = s.semesters[s.semesters.length - 1]!;
    if (term.courses?.length) {
      for (const course of term.courses)
        course.score = round(clamp(course.score + c.semesterCorrection));
      term.score = round(term.courses.reduce((n, c) => n + c.score * c.credits, 0) / term.credits);
      term.gpa = round(
        term.courses.reduce((n, c) => n + gradePoint(c.score) * c.credits, 0) / term.credits,
        2,
      );
      const recommended = term.courses.filter((c) => c.recommended !== false);
      term.recommendationCredits = recommended.reduce((n, c) => n + c.credits, 0);
      term.recommendationScore = round(
        recommended.reduce((n, c) => n + c.score * c.credits, 0) /
          Math.max(1, term.recommendationCredits),
      );
    } else {
      term.score = round(clamp(term.score + c.semesterCorrection), 1);
      term.gpa = gradePoint(term.score);
    }
    term.note = '课程成绩更正后重新计算';
  }
  if (c.waitlistShift)
    for (const a of s.applications.filter((a) => a.status === 'waitlist')) {
      a.waitPosition = Math.max(0, a.waitPosition - c.waitlistShift);
      a.notice = `候补次序更新，前方还有${a.waitPosition}人。`;
    }
}
export function resolveChoice(s: GameState, event: GameEvent, choiceIndex: number): void {
  if (s.interview) throw new Error('先完成当前考核。');
  if (s.stage !== 'event' || s.eventId !== event.id) throw new Error('这一页已经翻过。');
  const choice = event.choices[choiceIndex];
  if (!choice || !canChoose(s, choice)) throw new Error('当前条件还不适合这项安排。');
  const before = { ...s.stats };
  const chance = choice.check ? checkChance(s, choice.check.stat, choice.check.difficulty) : 0;
  const success = choice.check ? random(s) < chance : false;
  applyConsequence(s, choice);
  let text = substitute(choice.text, s);
  let award = choice.award;
  if (choice.check) {
    const outcome = success ? choice.check.success : choice.check.failure;
    applyConsequence(s, outcome);
    text += '\n\n' + substitute(outcome.text, s);
    award = outcome.award ?? award;
  }
  const outcomes = choice.outcomes?.filter((o) => eligible(s, o.when));
  if (outcomes?.length) {
    const outcome = weighted(s, outcomes, (o) => o.weight);
    applyConsequence(s, outcome);
    text += '\n\n' + substitute(outcome.text, s);
    award = outcome.award ?? award;
  }
  s.visited[event.id] = (s.visited[event.id] ?? 0) + 1;
  s.scheduled = s.scheduled.filter((q) => q.id !== event.id);
  const changes: Effects = {};
  for (const key of Object.keys(s.stats) as (keyof Stats)[])
    if (s.stats[key] !== before[key]) changes[key] = round(s.stats[key] - before[key]);
  s.feedback = {
    title: event.title,
    text,
    changes,
    ...(award ? { award } : {}),
    ...(choice.check ? { check: { label: STAT_LABELS[choice.check.stat], success, chance } } : {}),
  };
  s.log.push({
    id: `${s.turn}-${s.slot}-${event.id}`,
    turn: s.turn,
    title: event.title,
    choice: choice.label,
    text,
    changes,
    category: event.category,
  });
  if (s.life) {
    const days = Math.min(choice.days ?? 1, periodDays(s.turn) - s.life.day);
    s.life.day += days;
    if (event.id === 'life.low-energy') s.life.lastRecoveryDay = absoluteDay(s);
    s.termRounds += days / 30;
    s.termStudy += (s.life.routine.study * 0.4 * days) / 30;
    s.submissionsThisTurn = 0;
    s.interviewsThisTurn = 0;
    progressApplications(s);
    retainResult(s, s.feedback);
  }
  s.stage = 'feedback';
}
export function acknowledge(s: GameState): void {
  if (s.stage !== 'feedback') return;
  s.feedback = null;
  s.eventId = null;
  if (s.slot === 0) {
    s.slot = 1;
    s.stage = 'event';
  } else finishTurn(s);
}
export function assessQualification(s: GameState): void {
  const standing = rank(s);
  s.frozenRank = standing;
  const rule = recommendationRule(s.profile);
  if (s.flags['discipline.cheating']) {
    s.qualification = 'no';
    s.qualificationReason = '存在考试作弊处分记录，未通过推荐资格审核。';
    return;
  }
  if (s.stats.integrity < 60 || s.flags['record.verified']) {
    s.qualification = 'no';
    s.qualificationReason = '成果检查发现材料与实际贡献不一致，校内推荐未通过。';
    return;
  }
  if (s.failures > 0) {
    s.qualification = 'no';
    s.qualificationReason = `仍有${s.failures}项必修课程待完成，未进入推荐名单。`;
    return;
  }
  if (
    rule.firstAttempt &&
    (s.flags['course.first-fail'] || s.semesters.some((t) => t.score < 60))
  ) {
    s.qualification = 'no';
    s.qualificationReason = '本校要求课程初考全部合格，已有初考未通过记录。';
    return;
  }
  if (rule.englishLevel && (rule.englishLevel === 6 ? s.cet6 : s.cet4) < rule.englishMin) {
    s.qualification = 'no';
    s.qualificationReason = `外语成绩未达到本校英语${rule.englishLevel === 6 ? '六' : '四'}级${rule.englishMin}分的推荐要求。`;
    return;
  }
  if (
    rule.minGpa &&
    s.semesters.reduce((n, t) => n + t.gpa * t.credits, 0) /
      Math.max(
        1,
        s.semesters.reduce((n, t) => n + t.credits, 0),
      ) <
      rule.minGpa
  ) {
    s.qualification = 'no';
    s.qualificationReason = `初考平均绩点未达到本院${rule.minGpa.toFixed(1)}的推荐条件。`;
    return;
  }
  if (averageScore(s) < rule.minAverage) {
    s.qualification = 'no';
    s.qualificationReason = `前三年学业均分未达到本校${rule.minAverage}分的推荐条件。`;
    return;
  }
  if (s.flags['service.committed'] && s.stats.practice >= 60 && standing <= s.profile.quota + 4) {
    s.qualification = 'service';
    s.qualificationReason = '通过研究生支教团专项遴选，将先完成一年的支教服务。';
    return;
  }
  if (standing <= s.profile.quota) {
    s.qualification = 'yes';
    s.qualificationReason = `校内推免排位第${standing}，进入${s.profile.quota}个推荐名额。`;
    return;
  }
  s.qualification = 'no';
  s.qualificationReason = `校内推免排位第${standing}，本届推荐名额为${s.profile.quota}。`;
}
export function finishTurn(s: GameState): void {
  const p = PERIODS[s.turn]!;
  s.review = [];
  const living = Math.round(s.profile.livingCost * p.finance * (hasTrait(s, 'frugal') ? 0.88 : 1));
  const income = Math.round(s.profile.allowance * p.finance);
  changeStats(s, { money: income - living });
  if (p.finance > 0) s.review.push(`本期生活收支：家庭支持 ${income} 元，日常开支 ${living} 元。`);
  if (random(s) < 0.36) {
    const incidents = ROUND_INCIDENTS.filter((i) => eligible(s, i.when));
    if (incidents.length) {
      const incident = pick(s, incidents);
      applyConsequence(s, incident);
      s.review.push(incident.text);
    }
  }
  if (s.stats.money < 150) {
    changeStats(s, { stress: 4 });
    s.review.push('结余较少，可以安排勤工助学补贴支出。');
  }
  if (p.englishExam) {
    const level = s.cet4 >= 425 ? 6 : 4;
    const score = Math.round(
      clamp(
        (level === 4 ? 240 : 215) +
          s.stats.english * (level === 4 ? 4.1 : 4.6) +
          integer(s, -30, 30),
        0,
        710,
      ),
    );
    if (s.life) {
      s.life.languagePending ??= [];
      const releaseDay = absoluteDay(s) + 50;
      s.life.languagePending.push({ level, score, releaseDay });
      s.review.push(
        `英语${level === 4 ? '四' : '六'}级考试已完成，预计${dateAt(releaseDay)}公布成绩。`,
      );
    } else {
      if (level === 4) s.cet4 = Math.max(s.cet4, score);
      else s.cet6 = Math.max(s.cet6, score);
      s.review.push(
        `本次英语${level === 4 ? '四' : '六'}级成绩：${score} 分。${score >= 425 ? '成绩已记录进申请材料。' : '需要继续训练。'}`,
      );
    }
  }
  if (p.exam) {
    for (const peer of s.peers) {
      peer.score = round(clamp(peer.score + integer(s, -6, 6) / 10, 55, 97));
      peer.extra = round(clamp(peer.extra + integer(s, -2, 3)));
    }
    const baseScore = round(
      clamp(
        56 +
          s.stats.study * 0.24 +
          (s.termStudy / Math.max(1, s.termRounds)) * 4.4 +
          s.stats.energy * 0.045 -
          s.stats.stress * 0.035 +
          integer(s, -35, 35) / 10 +
          s.profile.aptitude * 0.18,
        48,
        98,
      ),
      1,
    );
    const baseCredits = p.exam % 2 ? 24 : 22;
    const counted = s.pendingCourses.filter((c) => c.counted);
    const coreCredits = Math.max(
      8,
      baseCredits - counted.filter((c) => c.replace).reduce((n, c) => n + c.credits, 0),
    );
    const credits = coreCredits + counted.reduce((n, c) => n + c.credits, 0);
    let score = round(
        (baseScore * coreCredits + counted.reduce((n, c) => n + c.score * c.credits, 0)) / credits,
        1,
      ),
      termGpa = gradePoint(score);
    let courses: NonNullable<GameState['semesters'][number]['courses']> | undefined;
    if (s.life) {
      const averageStudy = s.termStudy / Math.max(0.1, s.termRounds),
        subjects = termSubjects(s, p.exam),
        courseCredits = p.exam % 2 ? [5, 5, 4, 4, 3, 3] : [5, 4, 4, 3, 3, 3];
      const scope = recommendationRule(s.profile).courseScope;
      courses = [...subjects, '大学英语', '专业实践', '公共基础课程'].map((title, i) => {
        const skill =
          i === 3
            ? s.stats.english
            : i === 4
              ? s.stats.study * 0.6 + Math.max(s.stats.craft, s.stats.practice) * 0.4
              : s.stats.study;
        const mark =
          58 +
          skill * (i === 3 ? 0.33 : 0.25) +
          averageStudy * (i === 3 ? 1 : 3.9) +
          s.stats.energy * 0.035 -
          s.stats.stress * 0.035 +
          s.profile.aptitude * 0.2 +
          integer(s, -65, 65) / 10;
        return {
          title,
          score: round(clamp(mark, 45, 98)),
          credits: courseCredits[i]!,
          recommended: scope !== 'core' || i < 3 || i === 4,
        };
      });
      for (const course of s.pendingCourses) {
        if (course.replace) {
          let remaining = course.credits;
          for (let i = courses.length - 1; i >= 0 && remaining > 0; i--) {
            const deduct = Math.min(courses[i]!.credits, remaining);
            courses[i]!.credits -= deduct;
            remaining -= deduct;
          }
        }
        courses.push({
          title: course.title,
          score: course.score,
          credits: course.credits,
          recommended: course.counted,
        });
      }
      courses = courses.filter((c) => c.credits > 0);
      const total = courses.reduce((n, c) => n + c.credits, 0);
      score = round(courses.reduce((n, c) => n + c.score * c.credits, 0) / total);
      termGpa = round(courses.reduce((n, c) => n + gradePoint(c.score) * c.credits, 0) / total, 2);
    }
    const actualCredits = courses?.reduce((n, c) => n + c.credits, 0) ?? credits;
    s.semesters.push({
      term: p.exam,
      score,
      gpa: termGpa,
      credits: actualCredits,
      rank: 0,
      note: score >= 90 ? '基础逐渐扎实' : score >= 80 ? '节奏总体稳定' : '下学期还有补强空间',
      ...(courses ? { courses } : {}),
    });
    if (courses) {
      const recommended = courses.filter((c) => c.recommended !== false),
        term = s.semesters[s.semesters.length - 1]!;
      term.recommendationCredits = recommended.reduce((n, c) => n + c.credits, 0);
      term.recommendationScore = round(
        recommended.reduce((n, c) => n + c.score * c.credits, 0) /
          Math.max(1, term.recommendationCredits),
      );
    }
    s.semesters[s.semesters.length - 1]!.rank = rank(s, true);
    const failed = courses
      ? courses.filter((c) => c.score < 60 && !s.pendingCourses.some((p) => p.title === c.title))
          .length
      : score < 60
        ? 1
        : 0;
    if (failed) {
      s.failures += failed;
      s.flags['course.first-fail'] = true;
      s.review.push(`${failed}门课程需要补修，后续会出现补修安排。`);
    }
    for (const course of s.pendingCourses) {
      s.review.push(
        `${course.title}：${course.score}分，${course.credits}学分，${course.counted ? '计入本期均分' : '不计入推荐均分'}。`,
      );
      if (course.score < 60) {
        s.failures++;
        s.flags['course.first-fail'] = true;
      }
    }
    s.pendingCourses = [];
    if (score >= 90) {
      changeStats(s, { stress: -3 });
      s.flags['grade.strong'] = true;
    }
    s.review.push(
      `第${p.exam}学期均分 ${score.toFixed(1)}，学期绩点 ${termGpa.toFixed(2)}。累计学业排名 ${rank(s, true)}/${s.profile.cohortSize}。`,
    );
    if (rank(s, true) <= Math.ceil(s.profile.cohortSize * 0.1) && s.stats.integrity >= 80) {
      changeStats(s, { money: 1500 });
      s.review.push('这一学期的奖学金到账：1500 元。');
      s.flags['scholarship'] = true;
    }
    s.termStudy = 0;
    s.termRounds = 0;
  }
  if (s.turn === 42) {
    assessQualification(s);
    s.review.push(s.qualificationReason);
  }
  if (
    s.turn >= 43 &&
    s.qualification !== 'no' &&
    (s.stats.integrity < 60 || s.flags['record.verified'] || s.flags['discipline.cheating'])
  ) {
    s.qualification = 'no';
    s.qualificationReason = '后续材料或纪律条件未通过，推荐资格更新。';
    s.review.push(s.qualificationReason);
  }
  progressApplications(s);
  if (s.stats.energy < 25) s.review.push('这段时间精力偏低，接下来的训练与考核表现会受影响。');
  if (s.stats.stress >= 75) s.review.push('任务挤在了一起，休息和交接开始变得重要。');
  s.log.push({
    id: `review-${s.turn}`,
    turn: s.turn,
    title: s.life ? '近期情况' : '本期情况',
    text: s.review.join('\n'),
    category: '结算',
  });
  s.stage = 'review';
}
export function nextTurn(s: GameState): void {
  if (s.interview) throw new Error('先完成当前考核。');
  if (s.stage !== 'review') return;
  if (s.turn === TOTAL_TURNS - 1) {
    s.endingId = chooseEnding(s);
    s.stage = 'ended';
    return;
  }
  s.turn++;
  if (s.life) s.life.day = 0;
  expireApplications(s);
  s.stage = 'plan';
  s.slot = 0;
  s.eventId = null;
  s.plan = { ...BLANK_PLAN };
  s.review = [];
  s.preparedThisTurn = false;
  s.submissionsThisTurn = 0;
  s.interviewsThisTurn = 0;
}
export function schoolRuleText(s: GameState): string {
  const r = recommendationRule(s.profile),
    weight = Math.round(s.profile.gradeWeight * 100);
  return (
    (r.rankBased
      ? `学业名次与综合表现名次分别占${weight}%和${100 - weight}%，按加权名次排序。`
      : `推荐均分占${weight}%，综合表现占${100 - weight}%。`) +
    (r.courseScope === 'core'
      ? '推荐均分只计算专业课程和专业实践。'
      : '推荐均分按计入范围内的课程学分加权。') +
    (r.achievementMode === 'best' ? '同类成果只计最高一项。' : '各类成果累计到本类上限。') +
    `通过学院认定的成果参与计分，普通项目经历用于能力和申请介绍。当前综合表现${extraScore(s)}分。`
  );
}
