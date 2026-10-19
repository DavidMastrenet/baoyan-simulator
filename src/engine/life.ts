import type {
  Category,
  ChapterIndex,
  Effects,
  EventMeta,
  GameState,
  LifeAction,
  Plan,
  PlanKey,
  WorkMethod,
} from './types';
import { DEFAULT_PLAN, PLAN_ITEMS, STAT_LABELS, TRAITS } from './world';
import { changeStats, checkChance, finishTurn, nextTurn, trainPlan } from './game';
import { clamp, eligible, round } from './rules';
import { integer, pick, random, weighted } from './random';
import { absoluteDay, calendarDay, currentDate, lastDay, periodDays } from './calendar';
import { projectById, projectOffers } from './commitments';
import { progressApplications, replyDueNow } from './admissions';
import { retainResult } from './results';

export const LIFE_ACTIVITIES: {
  id: PlanKey;
  title: string;
  days: number;
  description: string;
  cost?: number;
}[] = [
  { id: 'study', title: '集中补上课程', days: 8, description: '腾出时间处理薄弱内容' },
  { id: 'english', title: '集中准备英语', days: 7, description: '练阅读与听力，整理错题' },
  { id: 'research', title: '去实验室跟进问题', days: 9, description: '读资料，检查方法和结果' },
  { id: 'craft', title: '集中做一个功能', days: 8, description: '完成开发并找人试用' },
  {
    id: 'practice',
    title: '参加现场实践',
    days: 6,
    description: '到校外参与实际工作，预留往返交通费用',
    cost: 60,
  },
  { id: 'social', title: '找同学交流近况', days: 3, description: '讨论困难，了解合作安排' },
  { id: 'work', title: '安排几次勤工', days: 6, description: '增加结余，课程仍需兼顾' },
  {
    id: 'rest',
    title: '休息调整几天',
    days: 3,
    description: '保留必要课程，减少额外工作，三天约恢复24–30点精力',
  },
  { id: 'prepare', title: '集中整理申请材料', days: 5, description: '补齐内容，准备后续申请' },
];
export const STUDY_RESOURCES = [
  {
    id: 'books',
    title: '购买专业参考书',
    description: '围绕一门薄弱课程阅读和做题',
    focus: 'study' as PlanKey,
    cost: 120,
    days: 3,
    gain: 2,
  },
  {
    id: 'english',
    title: '完成一套英语模拟练习',
    description: '购买练习与批改服务，再集中订正',
    focus: 'english' as PlanKey,
    cost: 90,
    days: 3,
    gain: 2,
  },
  {
    id: 'components',
    title: '购买配件完成小规模试做',
    description: '检验一个具体功能，保留实验记录',
    focus: 'craft' as PlanKey,
    cost: 180,
    days: 4,
    gain: 3,
  },
];
function resourceFlag(s: GameState, id: string) {
  return `resource.${id}.term${Math.min(5, Math.floor(s.turn / 6))}`;
}
export function resourceOffers(s: GameState) {
  return STUDY_RESOURCES.filter((r) => !s.flags[resourceFlag(s, r.id)]);
}
const actionCategories: Partial<Record<PlanKey, Category[]>> = {
  study: ['学业'],
  english: ['学业'],
  research: ['科研'],
  craft: ['项目', '竞赛'],
  practice: ['实践'],
  social: ['关系'],
  work: ['生活'],
  rest: ['生活', '偶遇'],
  prepare: ['申请'],
};
function nextAmbient(s: GameState): number {
  const span = periodDays(s.turn);
  return span <= 1
    ? span + 1
    : (s.life?.day ?? 0) + integer(s, span > 20 ? 8 : 4, span > 20 ? 18 : 8);
}
function notice(s: GameState, text: string) {
  s.life!.notices.push({ date: currentDate(s), text });
  s.life!.notices = s.life!.notices.slice(-14);
}
function updateApplications(s: GameState): boolean {
  const previous = new Map(s.applications.map((a) => [a.id, a.status + '|' + a.notice]));
  progressApplications(s);
  let interrupt = false;
  for (const a of s.applications)
    if (previous.get(a.id) !== a.status + '|' + a.notice) {
      notice(s, a.program.school + '：' + a.notice);
      if (['interview', 'formalInterview', 'offer'].includes(a.status)) interrupt = true;
    }
  return interrupt;
}
function releaseLanguage(s: GameState): boolean {
  const pending = s.life!.languagePending ?? [],
    ready = pending.filter((p) => p.releaseDay <= absoluteDay(s));
  for (const result of ready) {
    if (result.level === 4) s.cet4 = Math.max(s.cet4, result.score);
    else s.cet6 = Math.max(s.cet6, result.score);
    const text = `英语${result.level === 4 ? '四' : '六'}级成绩公布：${result.score}分。`;
    notice(s, text);
    s.log.push({
      id: 'language-' + result.releaseDay,
      turn: s.turn,
      title: '外语成绩更新',
      text,
      category: '学业',
    });
  }
  s.life!.languagePending = pending.filter((p) => p.releaseDay > absoluteDay(s));
  return ready.length > 0;
}
export function ensureLife(s: GameState): void {
  s.profile.traits = s.profile.traits.map((t) => ({
    ...t,
    description: TRAITS.find((current) => current.id === t.id)?.description ?? t.description,
  }));
  if (s.life) return;
  const routine =
    Object.values(s.lastPlan).reduce((a, b) => a + b, 0) === 6
      ? { ...s.lastPlan }
      : { ...DEFAULT_PLAN };
  s.life = {
    version: 1,
    day: 0,
    ambientAt: 0,
    routine,
    commitments: [],
    action: null,
    notices: [],
    actions: 0,
    deadlinePaused: false,
    legacyTrained: s.stage !== 'plan',
  };
  if (s.stage === 'review') {
    for (const line of s.review) notice(s, line);
    nextTurn(s);
    s.life.legacyTrained = false;
  }
  s.life.ambientAt = nextAmbient(s);
}
export function setRoutine(
  s: GameState,
  primary: PlanKey,
  secondary: PlanKey,
  pace: 'light' | 'normal' | 'intense',
): void {
  ensureLife(s);
  if (s.interview || s.stage === 'ended') throw new Error('当前无法调整日常安排。');
  if (
    primary === 'rest' ||
    primary === secondary ||
    !PLAN_ITEMS.some((p) => p.key === primary) ||
    !PLAN_ITEMS.some((p) => p.key === secondary) ||
    (s.turn < 24 && (primary === 'prepare' || secondary === 'prepare'))
  )
    throw new Error('请重新选择安排。');
  const p: Plan = {
    ...DEFAULT_PLAN,
    study: 0,
    research: 0,
    english: 0,
    craft: 0,
    practice: 0,
    social: 0,
    work: 0,
    prepare: 0,
    rest: pace === 'light' ? 3 : pace === 'intense' ? 1 : 2,
  };
  p[primary] += 5 - p.rest;
  p[secondary] += 1;
  s.life!.routine = p;
  s.lastPlan = { ...p };
}
export function routineLabel(s: GameState): string {
  const p = s.life?.routine ?? s.lastPlan;
  const tasks = PLAN_ITEMS.filter((i) => i.key !== 'rest' && p[i.key] > 0).sort(
    (a, b) => p[b.key] - p[a.key],
  );
  return (
    tasks
      .slice(0, 2)
      .map((i) => i.label)
      .join(' / ') + (p.rest >= 3 ? ' / 多休息' : p.rest <= 1 ? ' / 冲刺' : '')
  );
}
function focusPlan(s: GameState, focus: PlanKey | null): Plan {
  const p = { ...s.life!.routine };
  if (!focus) return p;
  if (focus === 'rest') {
    const primary = PLAN_ITEMS.filter((i) => i.key !== 'rest').sort(
      (a, b) => p[b.key] - p[a.key],
    )[0]!.key;
    for (const key of Object.keys(p) as PlanKey[]) p[key] = 0;
    p.rest = 5;
    p[primary] = 1;
    return p;
  }
  const rest = Math.max(2, p.rest);
  const secondary = PLAN_ITEMS.filter((i) => i.key !== 'rest' && i.key !== focus).sort(
    (a, b) => p[b.key] - p[a.key],
  )[0]!.key;
  for (const key of Object.keys(p) as PlanKey[]) p[key] = 0;
  p.rest = rest;
  p[focus] = 5 - rest;
  p[secondary] = 1;
  return p;
}
function eventPool(s: GameState, index: ChapterIndex): EventMeta[] {
  return index.events.filter(
    (e) =>
      eligible(s, e.when) &&
      (!e.once || !s.visited[e.id]) &&
      (e.id !== 'life.low-energy' ||
        (s.life?.action?.focus !== 'rest' &&
          (s.life?.lastRecoveryDay === undefined ||
            absoluteDay(s) - s.life.lastRecoveryDay >= 14))),
  );
}
function interrupt(s: GameState, event: EventMeta) {
  s.stage = 'event';
  s.eventId = event.id;
  s.slot = 0;
  s.feedback = null;
}
export function openPendingEvent(s: GameState, index: ChapterIndex): boolean {
  ensureLife(s);
  if (s.stage === 'ended' || s.interview) return false;
  const pool = eventPool(s, index),
    life = s.life!;
  const scheduled = s.scheduled.filter((q) => q.due <= s.turn).sort((a, b) => a.due - b.due);
  for (const item of scheduled) {
    const e = pool.find((e) => e.id === item.id);
    if (e) {
      interrupt(s, e);
      return true;
    }
  }
  const calendar = pool.find((e) => e.calendar === s.turn && !s.visited[e.id]);
  if (calendar && life.day >= calendarDay(s.turn)) {
    interrupt(s, calendar);
    life.ambientAt = Math.max(life.ambientAt, life.day + 2);
    return true;
  }
  return false;
}
function openAmbient(s: GameState, index: ChapterIndex): boolean {
  const life = s.life!;
  if (life.day < life.ambientAt || periodDays(s.turn) <= 1) return false;
  const pool = eventPool(s, index).filter((e) => e.calendar === undefined && !e.chain);
  const rare = pool.filter((e) => e.rare),
    eggs = pool.filter((e) => e.egg);
  let selected: EventMeta | undefined;
  if (rare.length && random(s) < 0.035) selected = weighted(s, rare, (e) => e.weight);
  else if (eggs.length && random(s) < 0.1) selected = pick(s, eggs);
  else {
    const regular = pool.filter((e) => !e.rare && !e.egg),
      focus = life.action?.focus;
    const categories = focus ? actionCategories[focus] : undefined;
    const urgent = regular.filter(
      (e) =>
        e.when?.max?.energy !== undefined || e.when?.min?.stress !== undefined || e.when?.failures,
    );
    const candidates = urgent.length && random(s) < 0.4 ? urgent : regular;
    if (candidates.length)
      selected = weighted(
        s,
        candidates,
        (e) =>
          (e.weight * (categories?.includes(e.category!) ? 3 : 1)) /
          (1 + (s.visited[e.id] ?? 0) * 10),
      );
  }
  life.ambientAt = nextAmbient(s);
  if (selected) {
    interrupt(s, selected);
    return true;
  }
  return false;
}
export function joinProject(s: GameState, id: string): void {
  ensureLife(s);
  if (s.interview || !['plan', 'feedback'].includes(s.stage)) throw new Error('先处理当前事情。');
  const p = projectOffers(s).find((p) => p.id === id);
  if (!p) throw new Error('这项安排已不在当前招募范围。');
  if (s.life!.commitments.filter((c) => c.status === 'active').length >= 2)
    throw new Error('先完成或退出一项正在做的事。');
  if (s.stats.money < p.fee) throw new Error('当前余额不足以承担这项安排。');
  changeStats(s, { money: -p.fee });
  s.life!.commitments.push({
    id,
    step: 0,
    work: 0,
    target: 0,
    method: 'steady',
    quality: 0,
    setbacks: 0,
    deadline: Math.min(lastDay(), absoluteDay(s) + p.deadline),
    status: 'active',
    note: '已确认任务，等待开始。',
  });
  s.log.push({
    id: `join-${id}`,
    turn: s.turn,
    title: `接下任务 / ${p.title}`,
    text: p.description,
    category: p.category,
  });
  s.feedback = {
    title: `接下任务 / ${p.title}`,
    text: p.fee ? `已预留必要费用${p.fee}元。` : '已加入正在做的事。',
    changes: p.fee ? { money: -p.fee } : {},
  };
  retainResult(s, s.feedback);
  s.stage = 'feedback';
  s.eventId = null;
}
export function dropProject(s: GameState, id: string): void {
  if (s.interview || s.stage === 'event') throw new Error('先处理当前事情。');
  const c = s.life?.commitments.find((c) => c.id === id && c.status === 'active'),
    p = projectById(id);
  if (!c || !p) throw new Error('这项任务已结束。');
  c.status = 'dropped';
  c.note = '已说明情况并退出，已有工作保留在记录中。';
  if (s.life!.action?.projectId === id) s.life!.action = null;
  changeStats(s, { stress: -2, network: c.work || c.step ? -1 : 0 });
  s.log.push({
    id: `drop-${id}`,
    turn: s.turn,
    title: `退出任务 / ${p.title}`,
    text: c.note,
    category: p.category,
  });
  notice(s, p.title + '：' + c.note);
}
function expireProjects(s: GameState): void {
  for (const c of s.life!.commitments.filter(
    (c) => c.status === 'active' && absoluteDay(s) > c.deadline,
  )) {
    const p = projectById(c.id)!;
    c.status = 'missed';
    c.note = '截止前未完成交付，已向合作方说明情况。';
    if (s.life!.action?.projectId === c.id) s.life!.action = null;
    changeStats(s, { stress: 3, network: -2 });
    notice(s, p.title + '：' + c.note);
    s.log.push({
      id: `missed-${c.id}`,
      turn: s.turn,
      title: `任务到期 / ${p.title}`,
      text: c.note,
      category: p.category,
    });
  }
}
function finishProjectStep(s: GameState, id: string, workChanges: Effects = {}): void {
  const c = s.life!.commitments.find((c) => c.id === id && c.status === 'active'),
    p = projectById(id);
  if (!c || !p) return;
  const step = p.steps[c.step]!,
    before = { ...s.stats };
  const support =
    c.method === 'careful'
      ? 0.12
      : c.method === 'team'
        ? clamp((s.stats.network - 15) / 250, 0.02, 0.18)
        : 0;
  const success = random(s) < clamp(checkChance(s, p.stat, step.difficulty) + support, 0.12, 0.95);
  c.quality += success ? 1 : 0;
  c.setbacks += success ? 0 : 1;
  c.note = success ? step.success : step.failure;
  changeStats(s, success ? { [p.stat]: 1.5, stress: -1 } : { [p.stat]: 0.5, stress: 2 });
  if (c.method === 'team') changeStats(s, { network: 1, expression: 0.5 });
  const title = p.title + ' / ' + step.title;
  c.step++;
  c.work = 0;
  c.target = 0;
  let award;
  if (c.step === p.steps.length) {
    c.status = c.quality >= 2 ? 'completed' : 'partial';
    c.note +=
      c.status === 'completed'
        ? ' 工作已完成并记录。'
        : ' 已交付当前能完成的部分，尚不足以记为完整成果。';
    if (c.status === 'completed') {
      award = { ...p.award, id: 'life.' + p.id, level: 1, turn: s.turn, recognized: false };
      s.awards.push(award);
      s.flags['life.' + p.id + '.completed'] = true;
    }
    if (p.id === 'campus-job') changeStats(s, { money: c.quality >= 2 ? 360 : 180 });
    if (p.id === 'portfolio') changeStats(s, { materials: c.quality >= 2 ? 10 : 4 });
  }
  const changes: Effects = { ...workChanges };
  for (const key of Object.keys(s.stats) as StatKey[])
    if (s.stats[key] !== before[key])
      changes[key] = round((changes[key] ?? 0) + s.stats[key] - before[key]);
  s.feedback = { title, text: c.note, changes, ...(award ? { award } : {}) };
  s.stage = 'feedback';
  s.log.push({
    id: `project-${id}-${c.step}`,
    turn: s.turn,
    title,
    text: c.note,
    changes,
    category: p.category,
  });
}
type StatKey = keyof GameState['stats'];
function crossPeriod(s: GameState, allowDeadline: boolean): void {
  const life = s.life!;
  const expiring = s.applications.some(
    (a) =>
      replyDueNow(s, a) ||
      (s.turn === 47 && ['interview', 'formalInterview', 'offer'].includes(a.status)),
  );
  if (expiring && !allowDeadline) {
    life.deadlinePaused = true;
    return;
  }
  life.deadlinePaused = false;
  const previousStats = { ...s.stats },
    title = `${currentDate(s)}前的收支与进展`;
  finishTurn(s);
  const report = s.review.join('\n\n'),
    changes: Effects = {};
  for (const key of Object.keys(s.stats) as StatKey[])
    if (s.stats[key] !== previousStats[key])
      changes[key] = round(s.stats[key] - previousStats[key]);
  if (report) retainResult(s, { title, text: report, changes });
  for (const line of s.review) notice(s, line);
  nextTurn(s);
  life.day = 0;
  life.legacyTrained = false;
  life.ambientAt = nextAmbient(s);
  if (life.action?.id === 'routine') life.action = null;
  if (s.stage === 'ended') life.action = null;
}
function stepInLife(
  s: GameState,
  index: ChapterIndex,
  id: string,
  method: WorkMethod = 'steady',
  allowDeadline = false,
): void {
  ensureLife(s);
  if (s.stage === 'ended' || s.stage === 'event' || s.interview)
    throw new Error('先处理当前事情。');
  const life = s.life!;
  s.feedback = null;
  s.eventId = null;
  s.stage = 'plan';
  expireProjects(s);
  if (releaseLanguage(s)) return;
  if (updateApplications(s)) return;
  if (!allowDeadline && s.applications.some((a) => replyDueNow(s, a))) {
    life.deadlinePaused = true;
    return;
  }
  life.deadlinePaused = false;
  if (id === life.action?.id) id = 'continue';
  if (id !== 'continue') {
    if (id.startsWith('resource:')) {
      const r = resourceOffers(s).find((r) => r.id === id.slice(9));
      if (!r || s.stats.money < r.cost) throw new Error('这项投入目前无法安排。');
      changeStats(s, { money: -r.cost });
      s.flags[resourceFlag(s, r.id)] = true;
      life.action = {
        id,
        title: r.title,
        focus: r.focus,
        remaining: r.days,
        changes: { money: -r.cost },
        startedDay: absoluteDay(s),
      };
    } else if (id.startsWith('project:')) {
      const projectId = id.slice(8),
        c = life.commitments.find((c) => c.id === projectId && c.status === 'active'),
        p = projectById(projectId);
      if (!c || !p) throw new Error('这项任务已结束。');
      const step = p.steps[c.step]!;
      if (!c.target) {
        c.method = method;
        c.target =
          step.days + (method === 'careful' ? 3 : method === 'team' ? 2 : 0) + (c.setbacks ? 2 : 0);
      }
      life.action = {
        id,
        title: p.title + ' / ' + step.title,
        focus: p.focus,
        remaining: Math.max(1, c.target - c.work),
        projectId,
        changes: {},
        startedDay: absoluteDay(s),
      };
    } else {
      const activity = LIFE_ACTIVITIES.find((a) => a.id === id);
      if (!activity || (id === 'prepare' && s.turn < 24)) throw new Error('当前无法安排这项行动。');
      if (activity.cost) {
        if (s.stats.money < activity.cost) throw new Error('余额不足以支付这项行动的交通费用。');
        changeStats(s, { money: -activity.cost });
      }
      life.action = {
        id,
        title: activity.title,
        focus: activity.id,
        remaining: activity.days,
        changes: activity.cost ? { money: -activity.cost } : {},
        startedDay: absoluteDay(s),
      };
    }
  }
  if (!life.action)
    life.action = {
      id: 'routine',
      title: '按日常安排继续',
      focus: null,
      remaining: periodDays(s.turn) - life.day,
    };
  if (life.day >= periodDays(s.turn)) {
    if (openPendingEvent(s, index)) return;
    crossPeriod(s, allowDeadline);
    return;
  }
  if (openPendingEvent(s, index)) return;
  if (life.action.focus !== 'rest' && openAmbient(s, index)) return;
  const action = life.action as LifeAction,
    pool = eventPool(s, index);
  const untilCalendar = pool.some((e) => e.calendar === s.turn && !s.visited[e.id])
    ? Math.max(0, calendarDay(s.turn) - life.day)
    : Infinity;
  const projectDeadline = Math.min(
    Infinity,
    ...life.commitments
      .filter((c) => c.status === 'active')
      .map((c) => Math.max(1, c.deadline + 1 - absoluteDay(s))),
  );
  const applicationDates = s.applications
    .flatMap((a) =>
      ['review', 'formalReview', 'waitlist'].includes(a.status) && a.updateDay !== undefined
        ? [a.updateDay]
        : ['interview', 'formalInterview', 'offer'].includes(a.status) &&
            a.deadlineDay !== undefined
          ? [a.deadlineDay]
          : [],
    )
    .filter((day) => day > absoluteDay(s));
  const applicationStop = Math.min(
    Infinity,
    ...applicationDates.map((day) => day - absoluteDay(s)),
  );
  const languageStop = Math.min(
    Infinity,
    ...(life.languagePending ?? [])
      .map((p) => p.releaseDay - absoluteDay(s))
      .filter((days) => days > 0),
  );
  const days = Math.min(
    action.remaining,
    periodDays(s.turn) - life.day,
    untilCalendar,
    action.focus === 'rest' ? Infinity : Math.max(1, life.ambientAt - life.day),
    projectDeadline,
    applicationStop,
    languageStop,
  );
  if (days <= 0) throw new Error('日期状态需要重新读取。');
  const before = { ...s.stats },
    plan = focusPlan(s, action.focus);
  if (!life.legacyTrained) trainPlan(s, plan, days / 30);
  if (action.focus === 'rest') {
    const sleep = s.profile.traits.some((t) => t.id === 'light-sleeper') ? -0.6 : 0,
      outdoors = s.profile.traits.some((t) => t.id === 'outdoors') ? 0.5 : 0;
    changeStats(s, { energy: days * (7 + sleep + outdoors), stress: -days * 2.5 });
    life.lastRecoveryDay = absoluteDay(s) + days;
  }
  if (life.commitments.filter((c) => c.status === 'active').length > 1 && action.focus !== 'rest')
    changeStats(s, { energy: -days * 0.12, stress: days * 0.1 });
  action.changes ??= {};
  for (const key of Object.keys(s.stats) as StatKey[])
    if (s.stats[key] !== before[key])
      action.changes[key] = round((action.changes[key] ?? 0) + s.stats[key] - before[key]);
  s.plan = plan;
  life.day += days;
  action.remaining -= days;
  s.submissionsThisTurn = 0;
  s.interviewsThisTurn = 0;
  s.preparedThisTurn = false;
  if (action.projectId) {
    const c = life.commitments.find((c) => c.id === action.projectId && c.status === 'active');
    if (c) c.work += days;
  }
  expireProjects(s);
  const applicationMessage = updateApplications(s);
  const languageMessage = releaseLanguage(s);
  if (life.action && action.remaining <= 0) {
    life.action = null;
    if (action.projectId) {
      finishProjectStep(s, action.projectId, action.changes);
      return;
    }
    if (action.id !== 'routine') {
      const bonusBefore = { ...s.stats };
      if (action.id === 'prepare') changeStats(s, { materials: 10, backup: 2 });
      const resource = action.id.startsWith('resource:')
        ? STUDY_RESOURCES.find((r) => r.id === action.id.slice(9))
        : undefined;
      if (resource) changeStats(s, { [resource.focus]: resource.gain });
      const changes: Effects = { ...action.changes };
      for (const key of Object.keys(s.stats) as StatKey[])
        if (s.stats[key] !== bonusBefore[key])
          changes[key] = round((changes[key] ?? 0) + s.stats[key] - bonusBefore[key]);
      const text = Object.entries(changes)
        .filter(([, v]) => Math.abs(v!) >= 0.1)
        .map(([key, v]) => `${STAT_LABELS[key as StatKey]} ${v! > 0 ? '+' : ''}${v}`)
        .join('，');
      s.feedback = {
        title: action.title,
        text:
          action.focus === 'rest'
            ? '休息安排已完成，之后恢复日常安排。'
            : text || '这项安排已完成。',
        changes,
      };
      s.log.push({
        id: `action-${life.actions}`,
        turn: s.turn,
        title: action.title,
        text,
        changes,
        category: '日常',
      });
      s.stage = 'feedback';
      return;
    }
  }
  if (applicationMessage || languageMessage) return;
  if (!allowDeadline && s.applications.some((a) => replyDueNow(s, a))) {
    life.deadlinePaused = true;
    return;
  }
  if (openPendingEvent(s, index) || (action.focus !== 'rest' && openAmbient(s, index))) return;
  if (life.day >= periodDays(s.turn)) crossPeriod(s, allowDeadline);
}

/** Advance the arranged work until something needs attention, not one invisible chunk. */
export function actInLife(
  s: GameState,
  index: ChapterIndex,
  id: string,
  method: WorkMethod = 'steady',
  allowDeadline = false,
): void {
  ensureLife(s);
  s.life!.actions++;
  const turn = s.turn;
  for (let steps = 0; steps < 64; steps++) {
    const day = absoluteDay(s),
      notices = JSON.stringify(s.life!.notices),
      logs = s.log.length;
    stepInLife(s, index, steps === 0 ? id : 'continue', method, allowDeadline);
    if (s.feedback) retainResult(s, s.feedback);
    if (
      s.stage === 'event' ||
      s.stage === 'feedback' ||
      s.stage === 'ended' ||
      s.life!.deadlinePaused ||
      s.turn !== turn
    )
      return;
    if (
      s.log.length !== logs ||
      JSON.stringify(s.life!.notices) !== notices ||
      absoluteDay(s) === day
    )
      return;
  }
}

export function resumeArrangedWork(s: GameState, index: ChapterIndex): void {
  if (!s.life || s.stage !== 'feedback' || s.interview) return;
  s.feedback = null;
  s.eventId = null;
  s.stage = 'plan';
  if (s.applications.some((a) => ['interview', 'formalInterview', 'offer'].includes(a.status)))
    return;
  if (s.life.action) actInLife(s, index, 'continue');
  else openPendingEvent(s, index);
}
