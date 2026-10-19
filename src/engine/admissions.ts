import type { Application, GameState, InterviewQuestion, Program } from './types';
import { clamp, fitScore, gpa, selectionScore } from './rules';
import { integer, random } from './random';
import { absoluteDay, dateAt, periodEndDate } from './calendar';
import { changeStats } from './stats';

export function replyExpired(s: GameState, a: Application): boolean {
  return a.deadlineDay !== undefined ? absoluteDay(s) > a.deadlineDay : s.turn > a.due;
}
export function replyDate(a: Application): string {
  return a.deadlineDay !== undefined ? dateAt(a.deadlineDay) : periodEndDate(Math.min(47, a.due));
}
export function replyDueNow(s: GameState, a: Application): boolean {
  return (
    ['interview', 'formalInterview', 'offer'].includes(a.status) &&
    (a.deadlineDay !== undefined
      ? absoluteDay(s) >= a.deadlineDay
      : a.due <= s.turn || s.turn === 47)
  );
}
function setDeadline(s: GameState, a: Application, days: number) {
  a.due = Math.min(47, s.turn + 2);
  if (s.life) a.deadlineDay = absoluteDay(s) + days;
}

export function seasonAt(turn: number): 'summer' | 'pre' | 'late' | null {
  return turn < 32 ? null : turn <= 38 ? 'summer' : turn <= 43 ? 'pre' : 'late';
}
export function activeSlots(s: GameState): Application[] {
  return s.applications.filter(
    (a) =>
      a.formal &&
      ['formalReview', 'formalInterview', 'offer', 'waitlist', 'accepted'].includes(a.status),
  );
}
export function formalReady(s: GameState): boolean {
  return s.qualification === 'yes' || s.qualification === 'service';
}
export function applyReason(s: GameState, p: Program): string {
  const season = seasonAt(s.turn);
  if (s.stage === 'ended') return '本份档案已收尾';
  if (!season) return '大三五月开放申请';
  if (s.turn >= 47) return '本轮投递已结束';
  if (s.interview) return '先完成正在进行的考核';
  if (s.applications.some((a) => a.status === 'accepted')) return '已确认一个录取去向';
  if (s.submissionsThisTurn >= 2) return '今天已投递两份材料，先处理其他安排';
  if (s.applications.some((a) => a.program.id === p.id && a.season === season))
    return '本批次已投递';
  if (!p.available.includes(season)) return '本批次尚未开放';
  if (season === 'late' && !formalReady(s)) return '校内推荐结果未进入可填报名单';
  if (
    season === 'late' &&
    s.applications.some(
      (a) =>
        a.program.id === p.id &&
        a.formal &&
        !['rejected', 'declined', 'expired'].includes(a.status),
    )
  )
    return '同一项目已有系统志愿';
  if (season === 'late' && activeSlots(s).length >= 3) return '三个平行志愿均在处理中';
  if (s.stats.materials < 50) return '申请材料需整理至50';
  if (s.stats.money < p.fee) return `本次需要 ${p.fee} 元交通与材料预算`;
  return '';
}
export function prepareMaterials(s: GameState): void {
  if (s.turn < 24 || s.preparedThisTurn || s.stage === 'ended' || s.interview)
    throw new Error('当前无法整理申请材料。');
  const before = s.stats.materials,
    energy = s.stats.energy;
  s.stats.materials = clamp(s.stats.materials + 18);
  s.stats.energy = clamp(s.stats.energy - 6);
  s.stats.backup = clamp(s.stats.backup + 2);
  s.preparedThisTurn = true;
  s.log.push({
    id: `materials-${s.turn}`,
    turn: s.turn,
    title: '更新申请材料',
    text: '你核对了成绩证明、语言成绩、个人陈述和成果记录，把需要推荐人确认的部分单独发了过去。',
    changes: { materials: s.stats.materials - before, energy: s.stats.energy - energy },
    category: '申请',
  });
}
export function submitApplication(s: GameState, p: Program): void {
  const reason = applyReason(s, p);
  if (reason) throw new Error(reason);
  const season = seasonAt(s.turn)!;
  changeStats(s, { money: -p.fee, energy: -4 });
  s.submissionsThisTurn++;
  const a: Application = {
    id: `${p.id}-${season}`,
    program: { ...p },
    season,
    status: season === 'late' ? 'formalReview' : 'review',
    submitted: s.turn,
    due: s.turn + 1,
    score: 0,
    waitPosition: 0,
    lockedUntil: season === 'late' ? s.turn + 2 : 0,
    notice: `材料已经提交，预计${periodEndDate(Math.min(47, s.turn + 1))}前更新。`,
    interviewed: false,
    formal: season === 'late',
    fromWaitlist: false,
  };
  if (s.life) {
    a.updateDay = absoluteDay(s) + (season === 'summer' ? 7 : season === 'pre' ? 4 : 1);
    a.notice = `材料已提交，预计${dateAt(a.updateDay)}更新。`;
    if (season === 'late') a.lockDay = absoluteDay(s) + 2;
  }
  s.applications.push(a);
  s.log.push({
    id: `apply-${a.id}`,
    turn: s.turn,
    title: `投递 / ${p.school}`,
    text: `${p.department} / ${p.degree}。材料进入审核，已预留${p.fee}元。`,
    category: '申请',
  });
}
export function toFormalReason(s: GameState, a: Application): string {
  if (s.turn < 44) return '系统志愿在大四九月下旬开放';
  if (s.turn >= 47) return '本轮填报已结束';
  if (!formalReady(s)) return '校内推荐结果未进入可填报名单';
  if (a.formal) return '已转入系统';
  if (
    s.applications.some(
      (x) =>
        x.id !== a.id &&
        x.program.id === a.program.id &&
        x.formal &&
        !['rejected', 'declined', 'expired'].includes(x.status),
    )
  )
    return '同一项目已有系统志愿';
  if (!['camp', 'preoffer', 'waitlist'].includes(a.status)) return '等待前一阶段考核结果';
  if (activeSlots(s).length >= 3) return '三个平行志愿均在处理中';
  if (s.applications.some((x) => x.status === 'accepted')) return '已确认录取去向';
  return '';
}
export function enterFormal(s: GameState, id: string): void {
  const a = s.applications.find((a) => a.id === id);
  if (!a) throw new Error('申请记录不存在。');
  const reason = toFormalReason(s, a);
  if (reason) throw new Error(reason);
  a.previousStatus = a.status;
  a.formal = true;
  a.status = 'formalReview';
  a.lockedUntil = s.turn + 2;
  a.due = s.turn + 1;
  if (s.life) {
    a.updateDay = absoluteDay(s) + 1;
    a.lockDay = absoluteDay(s) + 2;
    delete a.deadlineDay;
  }
  a.notice = '已填入平行志愿；下一个系统日查看复试回执。';
}
export function languageSatisfied(s: GameState, p: Program): boolean {
  return s.cet6 >= p.englishMin || !!s.flags['language.alternate'];
}
export function screenPass(s: GameState, p: Program): boolean {
  if (gpa(s) < p.gpaMin || !languageSatisfied(s, p) || s.stats.integrity < 60) return false;
  if (p.degree === '直博' && s.stats.research < 45) return false;
  const score = selectionScore(s, p) + integer(s, -4, 4);
  return score >= 42 + p.tier * 4.2;
}
export function expireApplications(s: GameState): void {
  for (const a of s.applications) {
    if (['interview', 'formalInterview', 'offer'].includes(a.status) && replyExpired(s, a)) {
      a.status = 'expired';
      a.notice = '这一轮的确认时间已过，名额继续向后流转。';
      s.flags['deadline.missed'] = true;
    }
  }
}
export function progressApplications(s: GameState): void {
  for (const a of s.applications) {
    if (a.status === 'accepted' && s.qualification === 'no') {
      a.status = 'rejected';
      a.notice = '推荐资格已取消，这条录取失效。';
      delete s.flags['admission.accepted'];
      continue;
    }
    if (
      a.formal &&
      !formalReady(s) &&
      !['accepted', 'declined', 'rejected', 'expired'].includes(a.status)
    ) {
      a.status = 'rejected';
      a.notice = '校内资格核验未通过，本条系统申请结束。';
      continue;
    }
    if (
      ['review', 'formalReview'].includes(a.status) &&
      (a.updateDay !== undefined ? a.updateDay <= absoluteDay(s) : a.due <= s.turn)
    ) {
      const preselected = a.formal && a.interviewed;
      if (preselected || screenPass(s, a.program)) {
        if (a.season === 'summer' && a.program.campMode === 'exchange' && !a.formal) {
          a.status = 'exchange';
          a.notice = '获得交流活动资格。本活动介绍研究方向，后续预推免需要重新报名和考核。';
          continue;
        }
        a.status = a.formal ? 'formalInterview' : 'interview';
        setDeadline(s, a, a.formal ? 1 : 3);
        delete a.updateDay;
        a.notice = preselected
          ? '请确认系统复试回执，前期考核成绩随材料检查。'
          : `进入${a.program.format}考核，请在${replyDate(a)}前完成。`;
      } else {
        a.status = 'rejected';
        a.lockedUntil = s.turn;
        a.notice =
          gpa(s) < a.program.gpaMin
            ? '学业材料未达到本项目初筛条件。'
            : !languageSatisfied(s, a.program)
              ? '语言成绩未达到本项目初筛条件。'
              : '本批次材料评审未进入考核名单。';
      }
    }
    if (['interview', 'formalInterview', 'offer'].includes(a.status) && replyExpired(s, a)) {
      a.status = 'expired';
      a.notice = '这一轮的确认时间已过，名额继续向后流转。';
      s.flags['deadline.missed'] = true;
    }
    if (
      a.status === 'waitlist' &&
      (a.updateDay !== undefined ? a.updateDay <= absoluteDay(s) : a.due <= s.turn)
    ) {
      if (random(s) < 0.35) {
        a.waitPosition = Math.max(0, a.waitPosition - integer(s, 1, 2));
        a.notice = `候补次序更新：前方还有${a.waitPosition}人。`;
      }
      a.due = s.turn + 1;
      if (s.life) a.updateDay = absoluteDay(s) + (a.formal ? 1 : 3);
      if (a.waitPosition === 0) {
        a.status = a.formal ? 'offer' : a.season === 'summer' ? 'camp' : 'preoffer';
        a.fromWaitlist = true;
        setDeadline(s, a, a.formal ? 1 : 3);
        delete a.updateDay;
        a.notice = a.formal
          ? '递补待录取通知已到，请在期限内确认。'
          : '候补转为本批次通过，后续还需完成正式系统流程。';
        s.flags['waitlist.return'] = true;
      }
    }
  }
}
export function confirmFormalInterview(s: GameState, id: string): void {
  const a = s.applications.find((a) => a.id === id);
  if (
    !a ||
    a.status !== 'formalInterview' ||
    !a.interviewed ||
    replyExpired(s, a) ||
    !formalReady(s)
  )
    throw new Error('当前没有可确认的复试回执。');
  if (a.previousStatus === 'waitlist') {
    a.status = 'waitlist';
    a.due = s.turn + 1;
    if (s.life) a.updateDay = absoluteDay(s) + 1;
    delete a.deadlineDay;
    a.notice = '系统复试已确认，按前期候补顺序继续递补。';
  } else {
    a.status = 'offer';
    setDeadline(s, a, 1);
    a.notice = '材料核验与前期考核已完成，收到待录取通知。';
  }
}
const majorCodes: Record<string, string> = {
  计算机类: 'cs',
  理工实验类: 'lab',
  经管类: 'biz',
  人文社科类: 'human',
  师范教育类: 'edu',
  交叉学科: 'cross',
};
export function interviewReason(s: GameState, a: Application): string {
  if (!['interview', 'formalInterview'].includes(a.status) || a.interviewed) return '等待考核通知';
  if (replyExpired(s, a)) return '考核确认期已结束';
  if (s.interview) return '已有一场考核正在进行';
  if (s.interviewsThisTurn >= 2) return '今天已参加两场考核，先休息再继续';
  if (s.stats.energy < 8) return '精力不足，先休息调整';
  return '';
}
export function beginInterview(s: GameState, id: string): void {
  const a = s.applications.find((a) => a.id === id);
  if (!a) throw new Error('申请记录不存在。');
  const reason = interviewReason(s, a);
  if (reason) throw new Error(reason);
  const field = a.program.major === '不限' ? s.profile.major : a.program.major;
  s.interview = {
    applicationId: id,
    questionIds: [
      `q.${majorCodes[field]}.${integer(s, 0, 11)}`,
      `q.english.${integer(s, 0, 13)}`,
      `q.method.${integer(s, 0, 19)}`,
    ],
    at: 0,
    score: 0,
    answers: [],
  };
  changeStats(s, { energy: -(a.program.format === '线下' ? 10 : 6) });
  s.interviewsThisTurn++;
}
export function answerInterview(s: GameState, q: InterviewQuestion, index: number): void {
  const session = s.interview;
  if (!session || session.questionIds[session.at] !== q.id || session.feedback)
    throw new Error('这一问已经回答。');
  const answer = q.options[index];
  if (!answer) throw new Error('请选择一个回答。');
  session.score += answer.score;
  session.answers.push(index);
  session.feedback = answer.response;
}
export function continueInterview(s: GameState): void {
  const session = s.interview;
  if (!session?.feedback) return;
  if (session.at < 2) {
    session.at++;
    delete session.feedback;
    return;
  }
  const a = s.applications.find((a) => a.id === session.applicationId)!;
  a.interviewed = true;
  const fatigue = (100 - s.stats.energy) * 0.045 + s.stats.stress * 0.045;
  const personality = s.profile.traits.some((t) => t.id === 'speaker') ? 2 : 0;
  a.score = Math.round(
    selectionScore(s, a.program) + session.score * 1.5 + integer(s, -5, 5) - fatigue + personality,
  );
  const cutoff = 53 + a.program.tier * 6 + (a.program.degree === '直博' ? 3 : 0);
  const delta = a.score - cutoff;
  if (delta >= 0) {
    a.status = a.formal ? 'offer' : a.season === 'summer' ? 'camp' : 'preoffer';
    a.notice = a.formal
      ? '考核通过，待录取通知已发送。'
      : '本批次考核通过；正式录取还需校内资格与系统确认。';
    setDeadline(s, a, a.formal ? 1 : 3);
  } else if (delta >= -9) {
    a.status = 'waitlist';
    a.waitPosition = Math.max(1, Math.ceil(-delta / 2));
    a.due = s.turn + 1;
    delete a.deadlineDay;
    if (s.life) a.updateDay = absoluteDay(s) + (a.formal ? 1 : 3);
    a.notice = `进入候补，前方约有${a.waitPosition}人。`;
  } else {
    a.status = 'rejected';
    a.notice = '这一场考核未通过。你把被追问的地方记了下来。';
  }
  changeStats(s, { expression: 2, stress: delta >= 0 ? -5 : 4 });
  if (a.program.major !== '不限' && a.program.major !== s.profile.major)
    s.flags['cross.applied'] = true;
  s.log.push({
    id: `interview-${a.id}`,
    turn: s.turn,
    title: `考核 / ${a.program.school}`,
    text: `三轮问答结束，综合考核记录${a.score}。${a.notice}`,
    category: '申请',
  });
  s.interview = null;
}
export function acceptOffer(s: GameState, id: string): void {
  const a = s.applications.find((a) => a.id === id);
  if (!a || a.status !== 'offer' || replyExpired(s, a) || !formalReady(s))
    throw new Error('当前没有可确认的待录取通知。');
  if (s.applications.some((x) => x.status === 'accepted')) throw new Error('已确认一个录取去向。');
  a.status = 'accepted';
  a.notice = '已确认待录取。录取状态已更新。';
  s.flags['admission.accepted'] = true;
  for (const other of s.applications)
    if (other.id !== id && !['rejected', 'expired', 'declined'].includes(other.status)) {
      other.status = 'declined';
      other.notice = '你已确认另一去向，向这里完成了回复。';
    }
  s.log.push({
    id: `accepted-${a.id}`,
    turn: s.turn,
    title: '确认待录取',
    text: `${a.program.school} / ${a.program.department} / ${a.program.degree}。你也给其他联系过的老师发了回复。`,
    category: '申请',
  });
}
export function withdraw(s: GameState, id: string): void {
  const a = s.applications.find((a) => a.id === id);
  if (!a || ['accepted', 'expired', 'declined', 'rejected'].includes(a.status))
    throw new Error('这条申请已经收尾。');
  if (
    a.formal &&
    (a.lockDay !== undefined ? absoluteDay(s) < a.lockDay : s.turn < a.lockedUntil) &&
    a.status !== 'offer'
  )
    throw new Error('该志愿将在48小时处理窗口后开放调整。');
  a.status = 'declined';
  a.notice = '你已完成退出回复，把位置留给下一位同学。';
}
export const STATUS_LABELS: Record<Application['status'], string> = {
  review: '材料审核',
  interview: '待考核',
  rejected: '本轮未入围',
  camp: '优秀营员',
  exchange: '交流营资格',
  preoffer: '预推免通过',
  waitlist: '候补中',
  formalReview: '系统审核',
  formalInterview: '待复试确认',
  offer: '待录取',
  accepted: '已确认',
  declined: '已回复退出',
  expired: '已错过期限',
};
export function fitLabel(s: GameState, p: Program): string {
  const fit = fitScore(s, p);
  return fit >= 52 ? '经历衔接顺畅' : fit >= 36 ? '有可展开的经历' : '需要解释方向转换';
}
