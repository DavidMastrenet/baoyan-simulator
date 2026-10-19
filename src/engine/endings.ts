import type { GameState } from './types';
import { averageScore, rank } from './rules';
/** Ordered, explicit predicates: one principal ending plus independent epilogue threads. */
export function chooseEnding(s: GameState): string {
  const accepted = s.applications.find((a) => a.status === 'accepted');
  if (accepted) {
    const p = accepted.program;
    if (s.qualification === 'service') return 'service';
    if (p.degree === '直博' && s.stats.research >= 85) return 'doctor-deep';
    if (p.degree === '直博') return 'doctor';
    if (s.flags['report.cleared']) return 'cleared-admit';
    if (s.flags['course.elective-plan']) return 'elective-plan';
    if (
      s.semesters.length >= 2 &&
      s.semesters[0]!.score < 75 &&
      s.semesters[s.semesters.length - 1]!.score >= 85
    )
      return 'course-comeback';
    if (s.originStats.english < 35 && s.cet6 >= 520) return 'english-comeback';
    if (
      Object.keys(s.flags).some((k) => k.startsWith('new.research.') && k.endsWith('.setback')) &&
      s.awards.some((a) => a.id.startsWith('new.research.'))
    )
      return 'research-recovery';
    if (
      (Object.keys(s.flags).some((k) => k.startsWith('new.project.') && k.endsWith('.setback')) &&
        s.awards.some((a) => a.id.startsWith('new.project.'))) ||
      s.life?.commitments.some((c) => c.status === 'completed' && c.setbacks > 0)
    )
      return 'project-recovery';
    if (s.awards.filter((a) => a.kind === '竞赛').length >= 3) return 'competition-success';
    if (s.stats.practice >= 80 && s.stats.research >= 45) return 'practice-admit';
    if (s.originStats.money < 1500 && p.format === '线上' && s.stats.money < 3000)
      return 'budget-online';
    if (s.originStats.money < 1600 && s.flags['scholarship']) return 'scholarship-admit';
    if (s.flags['new.apply.10.done']) return 'direction-adjust';
    if (s.stats.study >= 85 && s.awards.length <= 2) return 'study-focused';
    if (s.stats.english >= 85 && s.cet6 >= 550) return 'language-focused';
    if (s.stats.network >= 80 && s.stats.expression >= 75) return 'teamwork-skilled';
    if (s.stats.money >= 8000 && s.stats.research >= 70) return 'research-funded';
    if (s.stats.craft >= 85 && s.awards.filter((a) => a.kind === '项目').length >= 2)
      return 'long-term-craft';
    if (accepted.fromWaitlist) return 'waitlist';
    if (s.profile.family === '需要精打细算' && s.flags['work.experience']) return 'self-supported';
    if (p.major !== '不限' && p.major !== s.profile.major) return 'cross-discipline';
    if (p.city === '家乡周边') return 'near-home';
    if (p.id === 'home') return 'stay';
    if (p.track === 'practice' && s.profile.major === '师范教育类') return 'education';
    if (p.track === 'craft' && p.degree === '专硕') return 'professional';
    if (p.tier >= 4 && s.stats.research >= 75) return 'research-peak';
    if (s.flags['lab.repaired'] && s.awards.some((a) => a.kind === '科研')) return 'reproducible';
    if (s.flags['team.handoff'] && s.stats.network >= 65) return 'team';
    if (s.stats.energy >= 70 && s.stats.stress <= 35) return 'balanced';
    if (accepted.season === 'late') return 'late-arrival';
    if (p.tier >= 3 && rank(s, true) > s.profile.quota) return 'portfolio';
    if (s.stats.stress >= 78 || s.stats.energy < 25) return 'tired-arrival';
    if (accepted.season === 'summer' && accepted.submitted === 32) return 'early-camp';
    if (accepted.season === 'pre' && accepted.submitted >= 41 && s.stats.materials >= 90)
      return 'pre-batch';
    return 'steady-arrival';
  }
  if (s.flags['discipline.cheating']) return 'discipline';
  if (s.flags['record.verified'] || s.stats.integrity < 60) return 'record';
  if (s.chosenPath === 'work' && s.flags['career.near-home']) return 'home-job';
  if (s.chosenPath === 'work' && s.stats.craft >= 75) return 'project-job';
  if (s.chosenPath === 'work' && s.flags['work.experience'] && s.stats.practice >= 60)
    return 'internship-job';
  if (s.chosenPath === 'teaching' && s.stats.practice >= 75) return 'teaching-deep';
  if (s.chosenPath === 'startup' && s.stats.craft >= 65 && s.stats.network >= 65)
    return 'startup-team';
  if (s.chosenPath === 'startup' && s.stats.craft >= 55 && s.stats.money < 3000)
    return 'startup-small';
  if (
    s.chosenPath === 'exam' &&
    s.stats.backup >= 45 &&
    s.applications.some((a) => a.waitPosition > 0)
  )
    return 'exam-after-waitlist';
  if (s.chosenPath === 'exam' && s.stats.study >= 85 && s.stats.backup >= 45)
    return 'exam-highstudy';
  if (
    s.chosenPath === 'exam' &&
    s.stats.backup >= 45 &&
    s.stats.energy >= 60 &&
    s.stats.stress <= 45
  )
    return 'exam-balanced';
  if (s.chosenPath === 'abroad' && s.stats.english >= 85 && s.stats.backup >= 30)
    return 'overseas-english';
  if (
    s.chosenPath === 'abroad' &&
    s.stats.money >= 10000 &&
    s.stats.english >= 65 &&
    s.stats.backup >= 40
  )
    return 'overseas-budget';
  if (s.chosenPath === 'gap' && s.stats.backup >= 40 && s.stats.money >= 3000) return 'planned-gap';
  if (s.chosenPath === 'academic' && s.stats.research >= 65 && s.stats.backup >= 30)
    return 'help-research';
  if (
    s.qualification === 'yes' &&
    s.applications.filter((a) => a.status === 'rejected').length >= 3
  )
    return 'material-mismatch';
  if (s.applications.filter((a) => a.status === 'expired').length >= 2) return 'repeated-deadline';
  if (s.stats.money < 150 && s.originStats.money < 1500 && s.cet4 >= 425)
    return 'financial-difficulty';
  if (s.chosenPath === 'teaching' && s.stats.practice >= 50) return 'classroom';
  if (s.chosenPath === 'startup' && s.stats.craft >= 55) return 'small-product';
  if (s.chosenPath === 'abroad' && s.stats.english >= 65 && s.stats.backup >= 30) return 'overseas';
  if (s.chosenPath === 'work' && s.stats.craft >= 55) return 'engineer';
  if (s.chosenPath === 'work') return 'first-job';
  if (s.chosenPath === 'gap' || s.stats.energy < 18) return 'pause';
  if (s.chosenPath === 'exam' && s.stats.backup >= 45) return 'exam-ready';
  if (s.cet4 < 425) return 'language';
  if (s.qualification === 'no' && (s.frozenRank ?? rank(s)) === s.profile.quota + 1)
    return 'one-place';
  if (s.qualification === 'no' && averageScore(s) < 80) return 'grades';
  if (s.applications.some((a) => a.status === 'expired') || s.flags['deadline.missed'])
    return 'missed-window';
  if (s.qualification === 'yes' || s.qualification === 'service') return 'qualification-only';
  if (s.stats.backup >= 30) return 'another-route';
  return 'next-page';
}
export const ENDING_IDS = [
  'service',
  'doctor-deep',
  'doctor',
  'waitlist',
  'self-supported',
  'cross-discipline',
  'near-home',
  'education',
  'professional',
  'research-peak',
  'reproducible',
  'team',
  'balanced',
  'stay',
  'late-arrival',
  'portfolio',
  'tired-arrival',
  'steady-arrival',
  'record',
  'classroom',
  'small-product',
  'overseas',
  'engineer',
  'first-job',
  'pause',
  'exam-ready',
  'language',
  'one-place',
  'grades',
  'missed-window',
  'qualification-only',
  'another-route',
  'next-page',
  'course-comeback',
  'english-comeback',
  'research-recovery',
  'project-recovery',
  'competition-success',
  'practice-admit',
  'budget-online',
  'scholarship-admit',
  'direction-adjust',
  'early-camp',
  'pre-batch',
  'study-focused',
  'language-focused',
  'teamwork-skilled',
  'research-funded',
  'long-term-craft',
  'project-job',
  'internship-job',
  'home-job',
  'teaching-deep',
  'startup-team',
  'startup-small',
  'exam-after-waitlist',
  'exam-highstudy',
  'exam-balanced',
  'overseas-english',
  'overseas-budget',
  'planned-gap',
  'help-research',
  'material-mismatch',
  'repeated-deadline',
  'financial-difficulty',
  'discipline',
  'cleared-admit',
  'elective-plan',
] as const;
