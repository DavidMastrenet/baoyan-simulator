import { STAT_KEYS, type GameState } from './types';
import { MAJORS, TOTAL_TURNS } from './world';
import { periodDays } from './calendar';
import { projectById } from './commitments';
import { RULES } from './balance';
const rec = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, min: number, max: number) =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const text = (x: unknown, max = 20000) => typeof x === 'string' && x.length <= max;
const list = (x: unknown, max: number, validate: (v: unknown) => boolean) =>
  Array.isArray(x) && x.length <= max && x.every(validate);
const safeKey = (s: string) =>
  /^[a-zA-Z0-9.-]{1,120}$/.test(s) && !['constructor', 'prototype', '__proto__'].includes(s);
function stats(x: unknown) {
  return rec(x) && STAT_KEYS.every((k) => num(x[k], 0, k === 'money' ? 999999 : 100));
}
function plan(x: unknown) {
  return (
    rec(x) &&
    [
      'study',
      'research',
      'english',
      'craft',
      'practice',
      'social',
      'work',
      'rest',
      'prepare',
    ].every((k) => num(x[k], 0, 6) && Number.isInteger(x[k]))
  );
}
function program(x: unknown) {
  return (
    rec(x) &&
    text(x.id, 120) &&
    safeKey(String(x.id)) &&
    text(x.school, 100) &&
    text(x.department, 100) &&
    text(x.field, 150) &&
    [...MAJORS, '不限'].includes(x.major as never) &&
    ['学硕', '专硕', '直博'].includes(String(x.degree)) &&
    num(x.tier, 1, 4) &&
    ['research', 'craft', 'practice'].includes(String(x.track)) &&
    text(x.city, 100) &&
    text(x.style, 200) &&
    text(x.description, 2000) &&
    num(x.englishMin, 0, 710) &&
    num(x.gpaMin, 0, 4) &&
    num(x.fee, 0, 100000) &&
    num(x.tuition, 0, 1000000) &&
    num(x.stipend, 0, 1000000) &&
    ['线上', '线下'].includes(String(x.format)) &&
    list(x.available, 3, (y) => ['summer', 'pre', 'late'].includes(String(y)))
  );
}
/** Validate persisted state before any game method or Vue template reads it. */
export function validateState(x: unknown): x is GameState {
  if (
    !rec(x) ||
    x.version !== 1 ||
    !text(x.seed, 120) ||
    !num(x.rng, 0, 4294967295) ||
    !Number.isInteger(x.rng) ||
    !num(x.turn, 0, TOTAL_TURNS - 1) ||
    !Number.isInteger(x.turn)
  )
    return false;
  if (
    !['plan', 'event', 'feedback', 'review', 'ended'].includes(String(x.stage)) ||
    !num(x.slot, 0, 1) ||
    !Number.isInteger(x.slot) ||
    !(x.eventId === null || (text(x.eventId, 120) && safeKey(String(x.eventId))))
  )
    return false;
  if (
    !text(x.createdAt, 40) ||
    !text(x.updatedAt, 40) ||
    !num(x.seconds, 0, 100000000) ||
    !stats(x.stats) ||
    !stats(x.originStats) ||
    !plan(x.plan) ||
    !plan(x.lastPlan)
  )
    return false;
  const p = x.profile;
  if (
    rec(p) &&
    p.nickname !== undefined &&
    (!text(p.nickname, 40) || !/[\p{L}\p{N}]/u.test(String(p.nickname)))
  )
    return false;
  if (
    !rec(p) ||
    !MAJORS.includes(p.major as never) ||
    !text(p.campus, 100) ||
    !text(p.kind, 100) ||
    !text(p.location, 100) ||
    !text(p.family, 100) ||
    !text(p.background, 200) ||
    !text(p.backgroundDescription, 400) ||
    !text(p.researchStyle, 200) ||
    !text(p.homeDistance, 100) ||
    !num(p.cohortSize, 2, 500) ||
    !Number.isInteger(p.cohortSize) ||
    !num(p.quota, 1, Number(p.cohortSize)) ||
    !num(p.gradeWeight, 0.5, 1) ||
    !num(p.aptitude, 0, 10) ||
    !num(p.allowance, 0, 100000) ||
    !num(p.livingCost, 0, 100000) ||
    !list(
      p.traits,
      5,
      (t) => rec(t) && text(t.id, 40) && text(t.name, 100) && text(t.description, 200),
    )
  )
    return false;
  if (
    !list(
      x.peers,
      500,
      (p) => rec(p) && num(p.score, 0, 100) && num(p.growth, -10, 10) && num(p.extra, 0, 100),
    ) ||
    (x.peers as unknown[]).length !== Number(p.cohortSize) - 1
  )
    return false;
  if (
    typeof p.electivesCount !== 'boolean' ||
    !list(
      x.pendingCourses,
      40,
      (c) =>
        rec(c) &&
        text(c.title, 300) &&
        num(c.score, 0, 100) &&
        num(c.credits, 0, 6) &&
        typeof c.counted === 'boolean' &&
        typeof c.replace === 'boolean' &&
        num(c.turn, 0, 47),
    )
  )
    return false;
  if (
    (p.ruleId !== undefined && (typeof p.ruleId !== 'string' || !RULES[p.ruleId])) ||
    (p.department !== undefined && !text(p.department, 100))
  )
    return false;
  if (
    !num(x.termStudy, 0, 300) ||
    !num(x.termRounds, 0, 48) ||
    !num(x.failures, 0, 60) ||
    !num(x.cet4, 0, 710) ||
    !num(x.cet6, 0, 710)
  )
    return false;
  if (
    !list(
      x.semesters,
      6,
      (t) =>
        rec(t) &&
        num(t.term, 1, 6) &&
        num(t.score, 0, 100) &&
        num(t.gpa, 0, 4) &&
        num(t.credits, 1, 100) &&
        num(t.rank, 1, 500) &&
        text(t.note, 200) &&
        (t.courses === undefined ||
          list(
            t.courses,
            30,
            (c) => rec(c) && text(c.title, 300) && num(c.score, 0, 100) && num(c.credits, 0.1, 6),
          )),
    )
  )
    return false;
  if (
    (x.semesters as Record<string, unknown>[]).some(
      (t) =>
        (t.recommendationScore !== undefined && !num(t.recommendationScore, 0, 100)) ||
        (t.recommendationCredits !== undefined && !num(t.recommendationCredits, 1, 100)),
    )
  )
    return false;
  if (
    !rec(x.flags) ||
    Object.keys(x.flags).length > 600 ||
    !Object.entries(x.flags).every(([k, v]) => safeKey(k) && typeof v === 'boolean')
  )
    return false;
  if (
    !rec(x.visited) ||
    Object.keys(x.visited).length > 600 ||
    !Object.entries(x.visited).every(([k, v]) => safeKey(k) && num(v, 0, 100))
  )
    return false;
  if (!list(x.scheduled, 300, (q) => rec(q) && safeKey(String(q.id)) && num(q.due, 0, 47)))
    return false;
  if (
    !list(
      x.awards,
      300,
      (a) =>
        rec(a) &&
        text(a.id, 120) &&
        text(a.title, 300) &&
        ['科研', '竞赛', '实践', '项目', '生活'].includes(String(a.kind)) &&
        num(a.level, 1, 3) &&
        num(a.turn, 0, 47),
    )
  )
    return false;
  if (
    !list(
      x.log,
      2000,
      (l) =>
        rec(l) &&
        text(l.id, 150) &&
        num(l.turn, 0, 47) &&
        text(l.title, 300) &&
        text(l.text) &&
        text(l.category, 30) &&
        (l.choice === undefined || text(l.choice, 500)),
    )
  )
    return false;
  if (
    !list(x.review, 50, (l) => text(l, 3000)) ||
    !['pending', 'yes', 'no', 'service'].includes(String(x.qualification)) ||
    !text(x.qualificationReason, 2000) ||
    !(x.frozenRank === null || num(x.frozenRank, 1, 500))
  )
    return false;
  if (
    !list(
      x.applications,
      150,
      (a) =>
        rec(a) &&
        safeKey(String(a.id)) &&
        program(a.program) &&
        ['summer', 'pre', 'late'].includes(String(a.season)) &&
        [
          'review',
          'interview',
          'rejected',
          'camp',
          'exchange',
          'preoffer',
          'waitlist',
          'formalReview',
          'formalInterview',
          'offer',
          'accepted',
          'declined',
          'expired',
        ].includes(String(a.status)) &&
        num(a.submitted, 0, 47) &&
        num(a.due, 0, 60) &&
        num(a.score, 0, 200) &&
        num(a.waitPosition, 0, 100) &&
        num(a.lockedUntil, 0, 60) &&
        text(a.notice, 3000) &&
        ['interviewed', 'formal', 'fromWaitlist'].every((k) => typeof a[k] === 'boolean'),
    )
  )
    return false;
  const applications = x.applications as Record<string, unknown>[];
  if (
    applications.some((a) =>
      ['deadlineDay', 'updateDay', 'lockDay'].some(
        (k) => a[k] !== undefined && (!num(a[k], 0, 2000) || !Number.isInteger(a[k])),
      ),
    )
  )
    return false;
  if (
    applications.filter((a) => a.status === 'accepted').length > 1 ||
    new Set(applications.map((a) => a.id)).size !== applications.length
  )
    return false;
  if (
    !num(x.submissionsThisTurn, 0, 2) ||
    !num(x.interviewsThisTurn, 0, 2) ||
    typeof x.preparedThisTurn !== 'boolean' ||
    !['academic', 'exam', 'work', 'teaching', 'abroad', 'gap', 'startup'].includes(
      String(x.chosenPath),
    )
  )
    return false;
  if (!(x.endingId === null || (text(x.endingId, 120) && safeKey(String(x.endingId)))))
    return false;
  if (x.stage === 'ended' && !x.endingId) return false;
  if (x.feedback !== null) {
    const f = x.feedback;
    if (
      !rec(f) ||
      !text(f.title, 300) ||
      !text(f.text) ||
      !rec(f.changes) ||
      !Object.entries(f.changes).every(
        ([k, v]) => STAT_KEYS.includes(k as never) && num(v, -999999, 999999),
      )
    )
      return false;
    if (
      f.check !== undefined &&
      (!rec(f.check) ||
        !text(f.check.label, 100) ||
        typeof f.check.success !== 'boolean' ||
        !num(f.check.chance, 0, 1))
    )
      return false;
  }
  if (x.stage === 'feedback' && x.feedback === null) return false;
  if (x.interview !== null) {
    const i = x.interview;
    if (
      !rec(i) ||
      !applications.some((a) => a.id === i.applicationId) ||
      !num(i.at, 0, 2) ||
      !Number.isInteger(i.at) ||
      !list(
        i.questionIds,
        3,
        (q) =>
          typeof q === 'string' &&
          /^q\.(cs|lab|biz|human|edu|cross|english|method)\.\d{1,2}$/.test(q),
      ) ||
      (i.questionIds as unknown[]).length !== 3 ||
      !num(i.score, 0, 12) ||
      !list(i.answers, 3, (a) => num(a, 0, 2) && Number.isInteger(a)) ||
      (i.feedback !== undefined && !text(i.feedback, 3000))
    )
      return false;
  }
  if (x.life !== undefined) {
    const l = x.life;
    if (
      !rec(l) ||
      l.version !== 1 ||
      !num(l.day, 0, periodDays(Number(x.turn))) ||
      !Number.isInteger(l.day) ||
      !num(l.ambientAt, 0, 80) ||
      !plan(l.routine) ||
      Object.values(l.routine as Record<string, number>).reduce((a, b) => a + b, 0) !== 6 ||
      !num(l.actions, 0, 5000) ||
      typeof l.deadlinePaused !== 'boolean' ||
      typeof l.legacyTrained !== 'boolean'
    )
      return false;
    if (!list(l.notices, 14, (n) => rec(n) && text(n.date, 100) && text(n.text, 3000)))
      return false;
    if (
      l.carry !== undefined &&
      (!rec(l.carry) ||
        !Object.entries(l.carry).every(([k, v]) => STAT_KEYS.includes(k as never) && num(v, -1, 1)))
    )
      return false;
    if (
      l.languagePending !== undefined &&
      !list(
        l.languagePending,
        4,
        (p) =>
          rec(p) &&
          [4, 6].includes(Number(p.level)) &&
          num(p.score, 0, 710) &&
          num(p.releaseDay, 0, 2000),
      )
    )
      return false;
    if (l.lastRecoveryDay !== undefined && !num(l.lastRecoveryDay, 0, 2000)) return false;
    if (
      l.recentResults !== undefined &&
      !list(
        l.recentResults,
        2,
        (f) =>
          rec(f) &&
          text(f.title, 300) &&
          text(f.text) &&
          rec(f.changes) &&
          Object.entries(f.changes).every(
            ([k, v]) => STAT_KEYS.includes(k as never) && num(v, -999999, 999999),
          ),
      )
    )
      return false;
    if (
      !list(
        l.commitments,
        20,
        (c) =>
          rec(c) &&
          typeof c.id === 'string' &&
          !!projectById(c.id) &&
          num(c.step, 0, 3) &&
          Number.isInteger(c.step) &&
          num(c.work, 0, 40) &&
          num(c.target, 0, 40) &&
          ['steady', 'careful', 'team'].includes(String(c.method)) &&
          num(c.quality, 0, 3) &&
          num(c.setbacks, 0, 3) &&
          num(c.deadline, 0, 2000) &&
          ['active', 'completed', 'partial', 'missed', 'dropped'].includes(String(c.status)) &&
          text(c.note, 3000),
      )
    )
      return false;
    const commitments = l.commitments as Record<string, unknown>[];
    if (
      new Set(commitments.map((c) => c.id)).size !== commitments.length ||
      commitments.filter((c) => c.status === 'active').length > 2 ||
      commitments.some((c) => c.status === 'active' && Number(c.step) >= 3)
    )
      return false;
    if (l.action !== null) {
      const a = l.action;
      if (
        !rec(a) ||
        !text(a.id, 120) ||
        !text(a.title, 300) ||
        !(
          a.focus === null ||
          [
            'study',
            'research',
            'english',
            'craft',
            'practice',
            'social',
            'work',
            'rest',
            'prepare',
          ].includes(String(a.focus))
        ) ||
        !num(a.remaining, 1, 40) ||
        !Number.isInteger(a.remaining) ||
        (a.projectId !== undefined &&
          !commitments.some((c) => c.id === a.projectId && c.status === 'active')) ||
        (a.originStats !== undefined && !stats(a.originStats)) ||
        (a.startedDay !== undefined && !num(a.startedDay, 0, 2000))
      )
        return false;
    }
  }
  return true;
}
