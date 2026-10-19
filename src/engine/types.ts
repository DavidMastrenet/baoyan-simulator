export const STAT_KEYS = [
  'study',
  'research',
  'english',
  'craft',
  'practice',
  'expression',
  'network',
  'energy',
  'stress',
  'money',
  'integrity',
  'materials',
  'backup',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;
export type Effects = Partial<Stats>;
export type Major = '计算机类' | '理工实验类' | '经管类' | '人文社科类' | '师范教育类' | '交叉学科';
export type Category =
  '学业' | '科研' | '项目' | '竞赛' | '生活' | '关系' | '实践' | '申请' | '偶遇';
export type PlanKey =
  'study' | 'research' | 'english' | 'craft' | 'practice' | 'social' | 'work' | 'rest' | 'prepare';
export type Plan = Record<PlanKey, number>;
export interface Trait {
  id: string;
  name: string;
  description: string;
}
export interface Profile {
  nickname?: string;
  campus: string;
  kind: string;
  location: string;
  major: Major;
  cohortSize: number;
  quota: number;
  gradeWeight: number;
  family: string;
  allowance: number;
  livingCost: number;
  traits: Trait[];
  aptitude: number;
  researchStyle: string;
  homeDistance: string;
  background: string;
  backgroundDescription: string;
  electivesCount: boolean;
  ruleId?: string;
  department?: string;
}
export interface Semester {
  term: number;
  score: number;
  gpa: number;
  credits: number;
  rank: number;
  note: string;
  recommendationScore?: number;
  recommendationCredits?: number;
  courses?: { title: string; score: number; credits: number; recommended?: boolean }[];
}
export interface Peer {
  score: number;
  growth: number;
  extra: number;
}
export interface Condition {
  from?: number;
  to?: number;
  flags?: string[];
  notFlags?: string[];
  anyFlags?: string[];
  min?: Partial<Stats>;
  max?: Partial<Stats>;
  majors?: Major[];
  failures?: boolean;
  applicationStatus?: AppStatus[];
}
export interface Award {
  id: string;
  title: string;
  kind: '科研' | '竞赛' | '实践' | '项目' | '生活';
  level: number;
  turn?: number;
  recognized?: boolean;
}
export interface Consequence {
  text: string;
  effects?: Effects;
  flags?: string[];
  clearFlags?: string[];
  schedule?: { id: string; after: number }[];
  award?: Award;
  clearFailure?: boolean;
  path?: 'academic' | 'exam' | 'work' | 'teaching' | 'abroad' | 'gap' | 'startup';
  course?: {
    title: string;
    score: number;
    credits: number;
    counted: 'all' | 'policy' | 'none';
    replace?: boolean;
  };
  semesterCorrection?: number;
  waitlistShift?: number;
}
export interface Check {
  stat: StatKey;
  difficulty: number;
  success: Consequence;
  failure: Consequence;
}
export interface Choice extends Consequence {
  label: string;
  hint: string;
  when?: Condition;
  check?: Check;
  days?: number;
  outcomes?: (Consequence & { weight: number; when?: Condition })[];
}
export interface GameEvent {
  id: string;
  title: string;
  category: Category;
  scene: string;
  body: string[];
  choices: Choice[];
  when?: Condition;
  weight?: number;
  calendar?: number;
  egg?: boolean;
  rare?: boolean;
  chain?: boolean;
  once?: boolean;
  variants?: { when: Condition; text: string }[];
}
export interface EventMeta {
  id: string;
  file: string;
  category?: Category;
  when?: Condition;
  weight: number;
  calendar?: number;
  egg?: boolean;
  rare?: boolean;
  chain?: boolean;
  once?: boolean;
}
export interface ChapterIndex {
  version: 1;
  chapter: number;
  events: EventMeta[];
}
export interface Scheduled {
  id: string;
  due: number;
}
export interface LogEntry {
  id: string;
  turn: number;
  title: string;
  choice?: string;
  text: string;
  changes?: Effects;
  category: string;
}
export interface Feedback {
  title: string;
  text: string;
  changes: Effects;
  check?: { label: string; success: boolean; chance: number };
  award?: Award;
}
export interface Program {
  id: string;
  school: string;
  department: string;
  field: string;
  major: Major | '不限';
  degree: '学硕' | '专硕' | '直博';
  tier: number;
  track: 'research' | 'craft' | 'practice';
  city: string;
  style: string;
  description: string;
  englishMin: number;
  gpaMin: number;
  fee: number;
  tuition: number;
  stipend: number;
  format: '线上' | '线下';
  fit: number;
  available: ('summer' | 'pre' | 'late')[];
  campMode?: 'exchange' | 'selection';
}
export type AppStatus =
  | 'review'
  | 'interview'
  | 'rejected'
  | 'camp'
  | 'exchange'
  | 'preoffer'
  | 'waitlist'
  | 'formalReview'
  | 'formalInterview'
  | 'offer'
  | 'accepted'
  | 'declined'
  | 'expired';
export interface Application {
  id: string;
  program: Program;
  season: 'summer' | 'pre' | 'late';
  status: AppStatus;
  submitted: number;
  due: number;
  score: number;
  waitPosition: number;
  lockedUntil: number;
  notice: string;
  interviewed: boolean;
  formal: boolean;
  fromWaitlist: boolean;
  previousStatus?: AppStatus;
  deadlineDay?: number;
  updateDay?: number;
  lockDay?: number;
}
export interface InterviewQuestion {
  id: string;
  kind: '专业' | '英语' | '研究' | '匹配';
  title: string;
  text: string;
  options: { text: string; score: number; response: string }[];
}
export interface InterviewSession {
  applicationId: string;
  questionIds: string[];
  at: number;
  score: number;
  answers: number[];
  feedback?: string;
}
export type WorkMethod = 'steady' | 'careful' | 'team';
export interface Commitment {
  id: string;
  step: number;
  work: number;
  target: number;
  method: WorkMethod;
  quality: number;
  setbacks: number;
  deadline: number;
  status: 'active' | 'completed' | 'partial' | 'missed' | 'dropped';
  note: string;
}
export interface LifeAction {
  id: string;
  title: string;
  focus: PlanKey | null;
  remaining: number;
  projectId?: string;
  changes?: Effects;
  startedDay?: number;
}
export interface CampusLife {
  version: 1;
  day: number;
  ambientAt: number;
  routine: Plan;
  commitments: Commitment[];
  action: LifeAction | null;
  notices: { date: string; text: string }[];
  actions: number;
  deadlinePaused: boolean;
  legacyTrained: boolean;
  carry?: Effects;
  languagePending?: { level: 4 | 6; score: number; releaseDay: number }[];
  recentResults?: Feedback[];
  lastRecoveryDay?: number;
}
export interface GameState {
  version: 1;
  seed: string;
  rng: number;
  createdAt: string;
  updatedAt: string;
  seconds: number;
  turn: number;
  stage: 'plan' | 'event' | 'feedback' | 'review' | 'ended';
  slot: number;
  eventId: string | null;
  profile: Profile;
  stats: Stats;
  peers: Peer[];
  plan: Plan;
  lastPlan: Plan;
  termStudy: number;
  termRounds: number;
  semesters: Semester[];
  failures: number;
  cet4: number;
  cet6: number;
  flags: Record<string, boolean>;
  visited: Record<string, number>;
  scheduled: Scheduled[];
  awards: Award[];
  log: LogEntry[];
  feedback: Feedback | null;
  review: string[];
  qualification: 'pending' | 'yes' | 'no' | 'service';
  qualificationReason: string;
  frozenRank: number | null;
  applications: Application[];
  interview: InterviewSession | null;
  submissionsThisTurn: number;
  interviewsThisTurn: number;
  preparedThisTurn: boolean;
  chosenPath: 'academic' | 'exam' | 'work' | 'teaching' | 'abroad' | 'gap' | 'startup';
  endingId: string | null;
  originStats: Stats;
  pendingCourses: {
    title: string;
    score: number;
    credits: number;
    counted: boolean;
    replace: boolean;
    turn: number;
  }[];
  life?: CampusLife;
}
export interface Period {
  year: number;
  label: string;
  chapter: number;
  theme: string;
  finance: number;
  exam?: number;
  englishExam?: boolean;
}
export interface Ending {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  body: string[];
  tone: 'academic' | 'different' | 'life';
}
