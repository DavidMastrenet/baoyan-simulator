<script setup lang="ts">
import { computed } from 'vue';
import { recommendationRule } from '../engine/balance';
import { useGameStore } from '../stores/game';
import { STAT_LABELS, periodLabel } from '../engine/world';
import { averageScore, composite, extraScore, gpa, rank } from '../engine/rules';
import { schoolRuleText } from '../engine/game';
import type { StatKey, GameState } from '../engine/types';
const store = useGameStore(),
  rule = computed(() => recommendationRule(store.game.profile));
const skills: StatKey[] = [
  'study',
  'research',
  'english',
  'craft',
  'practice',
  'expression',
  'network',
  'materials',
  'backup',
  'integrity',
];
</script>
<template>
  <div class="section-title">
    <div>
      <span class="eyebrow">成长记录</span>
      <h1>成绩与能力</h1>
    </div>
  </div>
  <section class="paper growth-summary">
    <div>
      <span>推荐均分</span
      ><strong>{{
        store.game.semesters.length ? averageScore(store.game).toFixed(2) : '-'
      }}</strong>
    </div>
    <div>
      <span>累计绩点</span
      ><strong
        >{{ store.game.semesters.length ? gpa(store.game).toFixed(2) : '-'
        }}<small>/4</small></strong
      >
    </div>
    <div>
      <span>学业排名</span
      ><strong
        >{{ store.game.semesters.length ? rank(store.game, true) : '-'
        }}<small>/{{ store.game.profile.cohortSize }}</small></strong
      >
    </div>
  </section>
  <section class="paper">
    <div class="panel-heading">
      <h2>能力与状态</h2>
      <span class="muted small">0 - 100</span>
    </div>
    <div class="skill-grid">
      <div v-for="key in skills" :key="key" class="skill-item">
        <div>
          <span>{{ STAT_LABELS[key] }}</span
          ><strong
            >{{ store.game.stats[key].toFixed(0)
            }}<small v-if="store.game.stats[key] !== store.game.originStats[key]"
              >{{ store.game.stats[key] >= store.game.originStats[key] ? '+' : ''
              }}{{ (store.game.stats[key] - store.game.originStats[key]).toFixed(0) }}</small
            ></strong
          >
        </div>
        <el-progress
          :percentage="Math.round(store.game.stats[key])"
          :show-text="false"
          :stroke-width="4"
        />
      </div>
    </div>
  </section>
  <section class="paper">
    <h2>成绩单</h2>
    <p v-if="!store.game.semesters.length" class="empty-text">学期结束后显示成绩。</p>
    <div v-else class="semester-list">
      <div class="semester-row table-head">
        <span>学期</span><span>推荐均分</span><span>绩点</span><span>学业排名</span>
      </div>
      <div v-for="semester in store.game.semesters" :key="semester.term" class="semester-row">
        <span>第 {{ semester.term }} 学期</span
        ><strong>{{ (semester.recommendationScore ?? semester.score).toFixed(1) }}</strong
        ><span>{{ semester.gpa.toFixed(2) }}</span
        ><span>{{ semester.rank }} / {{ store.game.profile.cohortSize }}</span>
      </div>
    </div>
    <div class="language-record">
      <div>
        <span>英语四级</span><strong>{{ store.game.cet4 || '待考' }}</strong>
      </div>
      <div>
        <span>英语六级</span><strong>{{ store.game.cet6 || '待考' }}</strong>
      </div>
      <div>
        <span>待补课程</span><strong>{{ store.game.failures }} 项</strong>
      </div>
    </div>
    <p v-if="store.game.flags['language.alternate']" class="small muted">
      申请材料已记录经项目认可的替代语言成绩。
    </p>
  </section>
  <section v-if="store.game.semesters.some((t) => t.courses?.length)" class="paper">
    <h2>分科成绩</h2>
    <p class="small muted">
      本局采用4.0制，60分为1.0，90分及以上为4.0，中间线性换算，再按学分加权。
    </p>
    <details
      v-for="term in store.game.semesters.filter((t) => t.courses?.length)"
      :key="term.term"
      class="course-detail"
    >
      <summary>
        第 {{ term.term }} 学期 / 成绩单均分 {{ term.score }} / 绩点 {{ term.gpa.toFixed(2) }}
      </summary>
      <div v-for="course in term.courses" :key="course.title" class="course-row">
        <span
          >{{ course.title }}<small v-if="course.recommended === false">不计推荐均分</small></span
        ><span>{{ course.credits }} 学分</span
        ><strong :class="{ warning: course.score < 60 }">{{ course.score }}</strong>
      </div>
    </details>
  </section>
  <section class="paper rule-paper">
    <div class="panel-heading">
      <h2>校内推荐记录</h2>
      <el-tag effect="plain">{{
        store.game.qualification === 'pending'
          ? '等待公示'
          : store.game.qualification === 'no'
            ? '本轮未通过'
            : store.game.qualification === 'service'
              ? '支教专项'
              : '取得资格'
      }}</el-tag>
    </div>
    <p>{{ schoolRuleText(store.game) }}</p>
    <div class="rule-values">
      <span
        >综合表现 <strong>{{ extraScore(store.game) }}</strong></span
      ><span
        >{{ rule.rankBased ? '综合排序参考分' : '推免综合分' }}
        <strong>{{ composite(store.game) }}</strong></span
      >
    </div>
    <p class="small muted">
      本届名额 {{ store.game.profile.quota }} 个。{{
        rule.minAverage ? '推荐均分至少' + rule.minAverage + '分。' : ''
      }}{{ rule.minGpa ? '初考平均绩点至少' + rule.minGpa + '。' : ''
      }}{{
        rule.englishLevel
          ? '英语' + (rule.englishLevel === 6 ? '六' : '四') + '级至少' + rule.englishMin + '分。'
          : '校内推荐不单设英语门槛。'
      }}{{ rule.firstAttempt ? '要求课程初考全部合格。' : '未通过的课程须完成补修。' }}
    </p>
    <p class="qualification-line">{{ store.game.qualificationReason }}</p>
  </section>
  <section class="paper">
    <h2>成果记录</h2>
    <div v-if="!store.game.awards.length" class="empty-text">暂无成果。</div>
    <div v-for="award in [...store.game.awards].reverse()" :key="award.id" class="award-row">
      <span class="award-category">{{ award.kind }}</span>
      <div>
        <h3>
          {{ award.title }}
          <small class="muted">{{ award.recognized === false ? '项目经历' : '已认定成果' }}</small>
        </h3>
        <p>{{ periodLabel(award.turn ?? 0) }}</p>
      </div>
    </div>
  </section>
  <section class="paper">
    <h2>角色特征</h2>
    <div class="trait-row">
      <div v-for="t in store.game.profile.traits" :key="t.id" class="trait">
        <span class="trait-dot" />
        <div>
          <strong>{{ t.name }}</strong>
          <p>{{ t.description }}</p>
        </div>
      </div>
    </div>
  </section>
  <section v-if="store.game.pendingCourses.length" class="paper">
    <h2>待结算课程</h2>
    <p v-for="course in store.game.pendingCourses" :key="course.title" class="small">
      {{ course.title }} / {{ course.score }} 分 / {{ course.credits }} 学分 /
      {{ course.counted ? '计入推荐均分' : '不计入推荐均分' }}
    </p>
  </section>
  <section v-if="store.game.turn >= 24" class="paper">
    <h2>后续准备方向</h2>
    <p class="small muted">决定后续准备和未录取时的计划。已经确认的录取优先记录。</p>
    <el-select
      :model-value="store.game.chosenPath"
      :disabled="store.game.stage === 'ended' || store.busy || !!store.game.interview"
      aria-label="后续准备方向"
      @change="store.setPath($event as GameState['chosenPath'])"
      ><el-option
        v-for="p in [
          { id: 'academic', name: '继续保研申请' },
          { id: 'exam', name: '准备统考' },
          { id: 'work', name: '准备就业' },
          { id: 'teaching', name: '准备教学岗位' },
          { id: 'abroad', name: '准备海外申请' },
          { id: 'gap', name: '暂缓升学' },
          { id: 'startup', name: '尝试产品经营' },
        ]"
        :key="p.id"
        :value="p.id"
        :label="p.name"
    /></el-select>
  </section>
</template>
