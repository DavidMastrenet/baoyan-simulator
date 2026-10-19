import type { GameState, Profile } from './types';
export interface RecommendationRule {
  minAverage: number;
  minGpa?: number;
  englishLevel: 0 | 4 | 6;
  englishMin: number;
  firstAttempt: boolean;
  achievementMode: 'best' | 'capped';
  courseScope?: 'all' | 'core';
  rankBased?: boolean;
  weight?: number;
}
export const RULES: Record<string, RecommendationRule> = {
  'grade-first': {
    minAverage: 75,
    englishLevel: 4,
    englishMin: 425,
    firstAttempt: false,
    achievementMode: 'best',
    courseScope: 'all',
    weight: 0.95,
  },
  'strict-gpa': {
    minAverage: 0,
    minGpa: 2.5,
    englishLevel: 4,
    englishMin: 425,
    firstAttempt: true,
    achievementMode: 'best',
    courseScope: 'all',
    weight: 0.8,
  },
  'strict-gpa-high': {
    minAverage: 0,
    minGpa: 3,
    englishLevel: 4,
    englishMin: 425,
    firstAttempt: true,
    achievementMode: 'best',
    courseScope: 'all',
    weight: 0.85,
  },
  'core-courses': {
    minAverage: 80,
    minGpa: 2.6,
    englishLevel: 4,
    englishMin: 425,
    firstAttempt: true,
    achievementMode: 'best',
    courseScope: 'core',
    weight: 0.85,
  },
  'language-six': {
    minAverage: 75,
    englishLevel: 6,
    englishMin: 425,
    firstAttempt: false,
    achievementMode: 'best',
    courseScope: 'all',
    weight: 0.9,
  },
  'rank-composite': {
    minAverage: 0,
    englishLevel: 0,
    englishMin: 0,
    firstAttempt: false,
    achievementMode: 'best',
    courseScope: 'core',
    rankBased: true,
    weight: 0.85,
  },
  'achievement-cap': {
    minAverage: 78,
    englishLevel: 4,
    englishMin: 425,
    firstAttempt: false,
    achievementMode: 'capped',
    courseScope: 'all',
    weight: 0.8,
  },
};
export function recommendationRule(p: Profile): RecommendationRule {
  if (p.ruleId && RULES[p.ruleId]) return RULES[p.ruleId]!;
  if (p.kind === '师范大学')
    return {
      minAverage: 80,
      englishLevel: 6,
      englishMin: 425,
      firstAttempt: true,
      achievementMode: 'best',
    };
  if (p.gradeWeight >= 0.9)
    return {
      minAverage: 75,
      englishLevel: 4,
      englishMin: 425,
      firstAttempt: false,
      achievementMode: 'capped',
    };
  return {
    minAverage: 78,
    englishLevel: 4,
    englishMin: 425,
    firstAttempt: p.gradeWeight < 0.85,
    achievementMode: 'best',
  };
}
export function gradePoint(score: number): number {
  return score < 60 ? 0 : Math.round(Math.max(0, Math.min(4, (score - 50) / 10)) * 100) / 100;
}
const SUBJECTS: Record<string, string[]> = {
  计算机类: [
    '高等数学',
    '程序设计',
    '离散数学',
    '数据结构',
    '计算机组成',
    '操作系统',
    '数据库原理',
    '计算机网络',
    '软件工程',
    '算法设计',
    '编译原理',
    '计算机系统',
  ],
  理工实验类: [
    '高等数学',
    '普通物理',
    '无机化学',
    '线性代数',
    '电路基础',
    '工程力学',
    '物理化学',
    '分析方法',
    '材料基础',
    '仪器分析',
    '专业实验',
    '数值分析',
  ],
  经管类: [
    '高等数学',
    '微观经济学',
    '管理学',
    '宏观经济学',
    '会计学',
    '统计学',
    '计量经济学',
    '财务管理',
    '运筹学',
    '经济分析',
    '市场研究',
    '管理信息系统',
  ],
  人文社科类: [
    '专业导论',
    '学术写作',
    '社会学概论',
    '中国近现代史',
    '逻辑学',
    '研究方法',
    '理论专题',
    '社会调查',
    '文献阅读',
    '学术史',
    '比较研究',
    '专题研讨',
  ],
  师范教育类: [
    '教育学原理',
    '专业基础',
    '普通心理学',
    '课程与教学论',
    '发展心理学',
    '学科课程研究',
    '教育研究方法',
    '教学设计',
    '教育统计',
    '学科教学论',
    '学习评价',
    '教育实习',
  ],
  交叉学科: [
    '高等数学',
    '程序设计',
    '学科导论',
    '线性代数',
    '统计学',
    '系统分析',
    '研究方法',
    '数据分析',
    '模型设计',
    '专题研究',
    '应用方法',
    '综合项目',
  ],
};
export function termSubjects(s: GameState, term: number): string[] {
  const list = SUBJECTS[s.profile.major]!;
  return [0, 1, 2].map((n) => list[((term - 1) * 2 + n) % list.length]!);
}
