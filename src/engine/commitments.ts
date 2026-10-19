import type { Award, Category, Condition, GameState, PlanKey, StatKey } from './types';
import { eligible } from './rules';
import { hashSeed } from './random';
import { absoluteDay, lastDay } from './calendar';

export interface ProjectStep {
  title: string;
  days: number;
  difficulty: number;
  success: string;
  failure: string;
}
export interface ProjectDefinition {
  id: string;
  title: string;
  description: string;
  category: Category;
  focus: PlanKey;
  stat: StatKey;
  deadline: number;
  fee: number;
  when?: Condition;
  award: Omit<Award, 'id' | 'level'>;
  steps: ProjectStep[];
}
const step = (
  title: string,
  days: number,
  difficulty: number,
  success: string,
  failure: string,
): ProjectStep => ({ title, days, difficulty, success, failure });
export const PROJECTS: ProjectDefinition[] = [
  {
    id: 'course-group',
    title: '组建课程学习小组',
    description: '和两位同学整理难题，每周一起讲解。最后要交一份能用的错题说明。',
    category: '学业',
    focus: 'study',
    stat: 'study',
    deadline: 50,
    fee: 0,
    when: { to: 30 },
    award: { title: '课程学习小组持续记录', kind: '生活' },
    steps: [
      step(
        '整理各自卡住的题',
        7,
        35,
        '大家的问题集中在两种解题方法，你把讨论范围缩小了。',
        '同学交来的题太散，第一次讨论花在了重新分类上。',
      ),
      step(
        '轮流讲解与检查',
        9,
        45,
        '同学指出你的一处推导错误。改正后，这部分内容终于讲通了。',
        '你能做出题，却讲不清中间的步骤。小组决定把速度放慢。',
      ),
      step(
        '完成错题说明',
        7,
        48,
        '说明经过相互试做，几道常错题有了完整的解释。',
        '赶出的说明仍有漏步。你保留了未解决的问题，没把它当完整讲义。',
      ),
    ],
  },
  {
    id: 'lab-reproduction',
    title: '跟进一项实验复现',
    description: '老师给了一个规模较小的复现任务。需要交代设置，保留失败记录，最后在组会上汇报。',
    category: '科研',
    focus: 'research',
    stat: 'research',
    deadline: 65,
    fee: 120,
    when: { from: 4, to: 37 },
    award: { title: '小型实验复现报告', kind: '科研' },
    steps: [
      step(
        '确定设置并跑通流程',
        9,
        28,
        '简化设置后，流程可以重复运行，结果也保存了下来。',
        '环境版本与说明有差异。你花了一段时间才定位到问题。',
      ),
      step(
        '做对照并解释差异',
        12,
        45,
        '差异来自一个被忽略的前处理步骤，你补做了对照。',
        '结果仍然波动，暂时无法判断差异来自设置还是样本。',
      ),
      step(
        '向组里汇报',
        7,
        53,
        '你说明了复现范围和未解决的问题，老师同意继续跟进。',
        '追问暴露出一处未经检查的假设。报告保留了结果，但需要继续补充。',
      ),
    ],
  },
  {
    id: 'campus-tool',
    title: '做一个校园小工具',
    description: '同学想要一个值班安排工具。先做最常用的功能，再根据实际使用修改。',
    category: '项目',
    focus: 'craft',
    stat: 'craft',
    deadline: 60,
    fee: 60,
    when: { from: 1, to: 37 },
    award: { title: '校园排班工具实际使用记录', kind: '项目' },
    steps: [
      step(
        '确认需求并做出原型',
        8,
        30,
        '使用者确认了最需要的两个功能，原型能完成基本排班。',
        '你理解的流程与实际值班有出入，原型需要调整。',
      ),
      step(
        '试用并处理问题',
        10,
        45,
        '几位同学连续用了几天，你修好了重复排班的问题。',
        '不同手机上的显示不一致，试用期间收到不少问题。',
      ),
      step(
        '交付维护说明',
        7,
        52,
        '负责人能自己修改名单，工具开始被稳定使用。',
        '基本功能可以用，但维护仍依赖你，交接还不完整。',
      ),
    ],
  },
  {
    id: 'literature',
    title: '组织一次文献讨论',
    description: '选同一问题的几篇文章，比较方法，再向同学介绍。文章多不等于讨论有内容。',
    category: '科研',
    focus: 'research',
    stat: 'research',
    deadline: 45,
    fee: 0,
    when: { from: 3, to: 38 },
    award: { title: '专题文献讨论报告', kind: '科研' },
    steps: [
      step(
        '确定问题与阅读范围',
        6,
        28,
        '几篇文章的研究对象接近，适合放在一起比较。',
        '选题范围过大，你删去了与当前问题关系较小的文章。',
      ),
      step(
        '比较方法和结果',
        9,
        43,
        '你找出了方法差异，也区分了作者结论与自己的判断。',
        '几篇文章使用的评价方法不同，原先的直接比较站不住。',
      ),
      step(
        '讲解并回答问题',
        5,
        50,
        '讨论集中在几个具体问题上，老师给了后续阅读建议。',
        '一位同学的问题让你发现自己对一项方法理解不完整。',
      ),
    ],
  },
  {
    id: 'fieldwork',
    title: '参加一次小型实地调查',
    description: '围绕校园周边的一项服务做访谈。要取得受访者同意，并把记录整理清楚。',
    category: '实践',
    focus: 'practice',
    stat: 'practice',
    deadline: 55,
    fee: 80,
    when: { from: 2, to: 38 },
    award: { title: '社区服务调查报告', kind: '实践' },
    steps: [
      step(
        '确定问题与联系对象',
        7,
        28,
        '几位受访者愿意交流，你把问题压缩到了能问清的范围。',
        '约访时间难以协调，只能缩小调查范围。',
      ),
      step(
        '完成访谈与记录',
        10,
        42,
        '不同人的回答有分歧，你把共同问题和个体情况分开记录。',
        '访谈中出现了引导性问题，部分回答无法直接使用。',
      ),
      step(
        '整理发现并回访',
        7,
        50,
        '受访者确认了记录中的关键内容，报告提出了具体改进建议。',
        '记录不足以支持原来的判断，你删除了几项过大的结论。',
      ),
    ],
  },
  {
    id: 'teaching',
    title: '参与课后辅导',
    description: '每周到社区辅导一次。准备内容和学生的实际基础可能有差距。',
    category: '实践',
    focus: 'practice',
    stat: 'expression',
    deadline: 60,
    fee: 60,
    when: { to: 37 },
    award: { title: '社区课后辅导服务记录', kind: '实践' },
    steps: [
      step(
        '了解学生情况并备课',
        7,
        30,
        '你把内容拆成了几道小题，基本适合这批学生。',
        '原先的内容偏难，需要重新安排讲解顺序。',
      ),
      step(
        '连续开展辅导',
        12,
        43,
        '你根据上次的作业调整讲解，几位学生开始主动提问。',
        '学生的基础差异很大，一套安排难以照顾所有人。',
      ),
      step(
        '总结并完成交接',
        6,
        50,
        '后续志愿者收到了备课记录和学生进度，交接较顺利。',
        '记录偏重讲了什么，没有写清学生还不会什么。',
      ),
    ],
  },
  {
    id: 'competition',
    title: '组队准备校级竞赛',
    description: '队伍已有一个题目，还缺一个愿意持续做事的人。先说清分工，再决定是否参加。',
    category: '竞赛',
    focus: 'craft',
    stat: 'craft',
    deadline: 48,
    fee: 100,
    when: { from: 5, to: 32 },
    award: { title: '校级竞赛完整参赛记录', kind: '竞赛' },
    steps: [
      step(
        '确认分工与方案',
        6,
        35,
        '每个人负责的部分写清楚了，方案范围也缩小了。',
        '有队员答应得很快，却没有空完成原定工作。',
      ),
      step(
        '完成并联调',
        12,
        50,
        '各部分接了起来，你们留出了检查时间。',
        '接口理解不一致，合并时发现了较多问题。',
      ),
      step(
        '答辩与提交',
        5,
        58,
        '演示基本稳定，答辩也能说明各自的工作。',
        '现场遇到一个未覆盖的情况，展示效果受到了影响。',
      ),
    ],
  },
  {
    id: 'translation',
    title: '协作整理英文资料',
    description: '老师需要一份专题资料说明。先读懂内容，再统一术语和引用。',
    category: '学业',
    focus: 'english',
    stat: 'english',
    deadline: 42,
    fee: 0,
    when: { to: 35 },
    award: { title: '英文专题资料整理记录', kind: '生活' },
    steps: [
      step(
        '通读资料并标出疑问',
        6,
        30,
        '你分清了背景介绍与主要结论，疑问也有了范围。',
        '几处长句理解有偏差，需要结合上下文重新检查。',
      ),
      step(
        '整理术语与摘要',
        8,
        45,
        '摘要能准确说明文章做了什么，术语也基本统一。',
        '同一个术语被译成了不同表达，摘要里还有含混之处。',
      ),
      step(
        '完成对照检查',
        5,
        52,
        '老师只改了少量表述，这份说明可以交给后续同学使用。',
        '检查中发现遗漏了一项条件，说明需要补充后再使用。',
      ),
    ],
  },
  {
    id: 'campus-job',
    title: '接下图书馆助理工作',
    description: '工作有固定时间，需要登记和交接。收入有限，但比临时找兼职稳定。',
    category: '生活',
    focus: 'work',
    stat: 'practice',
    deadline: 46,
    fee: 0,
    when: { to: 36 },
    award: { title: '图书馆助理履职记录', kind: '生活' },
    steps: [
      step(
        '熟悉登记与值班安排',
        5,
        25,
        '你核对了课表，固定了不会冲突的值班时段。',
        '一次课程调动与值班撞期，临时换班费了些时间。',
      ),
      step(
        '完成连续值班',
        12,
        38,
        '登记基本准确，几次临时问题也按要求处理了。',
        '有一份登记漏项，负责人提醒你补上交接记录。',
      ),
      step(
        '完成盘点与交接',
        5,
        42,
        '盘点与登记能对上，负责人愿意继续安排你值班。',
        '盘点差异花了较长时间才查清，之后需要更仔细。',
      ),
    ],
  },
  {
    id: 'portfolio',
    title: '整理一份能讲清的作品集',
    description: '选一项自己做过的工作，补上过程与结果。面试时需要回答具体细节。',
    category: '申请',
    focus: 'prepare',
    stat: 'expression',
    deadline: 40,
    fee: 0,
    when: { from: 24, to: 41 },
    award: { title: '完整项目介绍与演示', kind: '项目' },
    steps: [
      step(
        '确定材料与实际贡献',
        5,
        35,
        '你选了一项能解释清楚的工作，删去了自己没有参与的部分。',
        '之前的分工记得不够清楚，需要联系队友确认。',
      ),
      step(
        '准备演示与介绍',
        7,
        48,
        '介绍能在规定时间内讲完，也留下了讨论关键问题的时间。',
        '内容太多，试讲时超时，重点仍不够明确。',
      ),
      step(
        '请同学追问与修改',
        5,
        55,
        '追问帮助你补齐了两处解释，材料与演示能够相互对应。',
        '一处结果无法解释清楚，你把它从主要成果中移除了。',
      ),
    ],
  },
  {
    id: 'internship',
    title: '争取一段短期实习',
    description: '岗位任务比较具体，需要和课程协调。先做小任务，再考虑是否继续。',
    category: '实践',
    focus: 'craft',
    stat: 'craft',
    deadline: 70,
    fee: 180,
    when: { from: 17, to: 37 },
    award: { title: '短期实习交付记录', kind: '实践' },
    steps: [
      step(
        '交流任务并协调时间',
        6,
        40,
        '负责人接受了你的时间安排，先交给你一个独立的小任务。',
        '岗位要求与最初介绍有出入，你重新确认了工作范围。',
      ),
      step(
        '完成试做任务',
        14,
        53,
        '交付通过了基本检查，负责人给了具体修改建议。',
        '实际数据与示例差别较大，任务比预期更费时间。',
      ),
      step(
        '修改并完成交接',
        8,
        58,
        '后续同事能接着使用你的工作，负责人给了较具体的评价。',
        '工作能交付，但还有几处需要同事继续处理。',
      ),
    ],
  },
  {
    id: 'presentation',
    title: '参加一次公开汇报',
    description: '学院征集学生介绍自己的学习或项目经历。内容需要经得起现场追问。',
    category: '关系',
    focus: 'social',
    stat: 'expression',
    deadline: 35,
    fee: 0,
    when: { from: 8, to: 40 },
    award: { title: '学院交流汇报记录', kind: '生活' },
    steps: [
      step(
        '确定主题与讲解顺序',
        5,
        30,
        '你把主题缩小到了亲自做过的一件事。',
        '材料有些空泛，需要补上具体过程。',
      ),
      step(
        '试讲并修改',
        7,
        43,
        '同学能听懂主要问题，你根据反馈删掉了几段无关内容。',
        '试讲中几次卡住，原先的讲解顺序需要调整。',
      ),
      step(
        '现场汇报与交流',
        3,
        53,
        '你回答了与自己工作有关的问题，也认识了做相近事情的同学。',
        '紧张影响了部分表达，但你记下了现场没有回答完整的问题。',
      ),
    ],
  },
];
export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);
export function projectOffers(s: GameState): ProjectDefinition[] {
  return PROJECTS.filter(
    (p) =>
      eligible(s, p.when) &&
      !s.life?.commitments.some((c) => c.id === p.id) &&
      absoluteDay(s) + p.steps.reduce((n, step) => n + step.days, 0) <= lastDay(),
  )
    .sort(
      (a, b) =>
        hashSeed(s.seed + Math.floor(s.turn / 2) + a.id) -
        hashSeed(s.seed + Math.floor(s.turn / 2) + b.id),
    )
    .slice(0, 3);
}
