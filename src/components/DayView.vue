<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import { PERIODS, PLAN_ITEMS, STAT_LABELS } from '../engine/world';
import { canChoose, eligible, rank, substitute, averageScore, gpa } from '../engine/rules';
import { checkChance } from '../engine/game';
import { absoluteDay, dateAt, nextMilestone, periodDays } from '../engine/calendar';
import { LIFE_ACTIVITIES, routineLabel, resourceOffers } from '../engine/life';
import { projectById, projectOffers } from '../engine/commitments';
import { replyDate, replyDueNow } from '../engine/admissions';
import { recommendationRule } from '../engine/balance';
import type { Feedback, PlanKey, StatKey, WorkMethod } from '../engine/types';
import EndingView from './EndingView.vue';
import LineIcon from './LineIcon.vue';
import CampusMap from './CampusMap.vue';
const store = useGameStore();
const routineOpen = ref(false),
  primary = ref<PlanKey>('study'),
  secondary = ref<PlanKey>('english'),
  pace = ref<'light' | 'normal' | 'intense'>('normal'),
  confirmDeadline = ref(false),
  dropId = ref('');
const choiceToConfirm = ref<number | null>(null);
const pendingMove = ref<{ id: string; method: WorkMethod } | null>(null);
const allActions = ref(false);
const methods = reactive<Record<string, WorkMethod>>({});
const life = computed(() => store.game.life!);
const open = computed(() => ['plan', 'feedback'].includes(store.game.stage));
const items = computed(() =>
  PLAN_ITEMS.filter((p) => p.key !== 'rest' && (p.key !== 'prepare' || store.game.turn >= 24)),
);
const secondaryItems = computed(() =>
  PLAN_ITEMS.filter(
    (p) => p.key !== primary.value && (p.key !== 'prepare' || store.game.turn >= 24),
  ),
);
watch(primary, () => {
  if (primary.value === secondary.value) secondary.value = 'rest';
});
function editRoutine() {
  const p = life.value.routine,
    entries = Object.entries(p)
      .filter(([k]) => k !== 'rest')
      .sort((a, b) => b[1] - a[1]);
  primary.value = (entries[0]?.[0] ?? 'study') as PlanKey;
  secondary.value = (entries[1]?.[1] ? entries[1][0] : 'rest') as PlanKey;
  pace.value = p.rest >= 3 ? 'light' : p.rest <= 1 ? 'intense' : 'normal';
  routineOpen.value = true;
}
async function saveRoutine() {
  await store.routine(primary.value, secondary.value, pace.value);
  if (!store.error) routineOpen.value = false;
}
const body = computed(() => {
  const e = store.event;
  if (!e) return [];
  return [
    ...e.body,
    ...(e.variants ?? []).filter((v) => eligible(store.game, v.when)).map((v) => v.text),
  ].map((t) => substitute(t, store.game));
});
const readyApps = computed(() =>
  store.game.applications.filter((a) =>
    ['interview', 'formalInterview', 'offer'].includes(a.status),
  ),
);
const deadlineBlocked = computed(
  () =>
    life.value.deadlinePaused &&
    readyApps.value.some((a) => replyDueNow(store.game, a) || store.game.turn === 47),
);
function choose(index: number) {
  const days = Math.min(
    store.event?.choices[index]?.days ?? 1,
    periodDays(store.game.turn) - life.value.day,
  );
  if (
    readyApps.value.some(
      (a) => a.deadlineDay !== undefined && a.deadlineDay < absoluteDay(store.game) + days,
    )
  )
    choiceToConfirm.value = index;
  else void store.choose(index);
}
function confirmChoice() {
  if (choiceToConfirm.value !== null) {
    const index = choiceToConfirm.value;
    choiceToConfirm.value = null;
    void store.choose(index);
  }
}
const projects = computed(() =>
  life.value.commitments
    .filter((c) => c.status === 'active')
    .map((c) => ({
      state: c,
      definition: projectById(c.id)!,
      step: projectById(c.id)!.steps[c.step]!,
    })),
);
const offers = computed(() => projectOffers(store.game));
const resources = computed(() => resourceOffers(store.game));
const activities = computed(() => {
  const list = LIFE_ACTIVITIES.filter((a) => a.id !== 'prepare' || store.game.turn >= 24);
  const priority = (id: string) =>
    id === 'rest' && store.game.stats.energy < 40
      ? 0
      : id === 'work' && store.game.stats.money < 600
        ? 1
        : id === 'english' &&
            rule.value.englishLevel &&
            (rule.value.englishLevel === 6 ? store.game.cet6 : store.game.cet4) <
              rule.value.englishMin
          ? 2
          : id === 'prepare' && store.game.turn >= 24 && store.game.stats.materials < 60
            ? 2
            : id === 'study'
              ? 3
              : life.value.routine[id as PlanKey] > 1
                ? 4
                : id === 'rest'
                  ? 5
                  : 6;
  return list
    .sort((a, b) => priority(a.id) - priority(b.id))
    .slice(0, allActions.value ? list.length : 4);
});
const results = computed(
  () => life.value.recentResults ?? (store.game.feedback ? [store.game.feedback] : []),
);
const deltas = (result: Feedback) =>
  Object.entries(result.changes).map(([key, n]) => ({
    key,
    label: STAT_LABELS[key as StatKey],
    value: n as number,
  }));
const favorable = (key: string, n: number) => (key === 'stress' ? n < 0 : n > 0);
const milestone = computed(() => nextMilestone(store.game)),
  rule = computed(() => recommendationRule(store.game.profile));
const languageScore = computed(() =>
  rule.value.englishLevel === 6 ? store.game.cet6 : store.game.cet4,
);
const priorityGoal = computed(() => {
  if (store.game.stats.energy < 35)
    return {
      title: `精力 ${Math.round(store.game.stats.energy)}，先恢复再安排任务`,
      text: '精力越低，训练收益越低。主动休息三天约恢复24–30点。',
      action: '安排休息',
      id: 'rest',
    };
  if (rule.value.englishLevel && languageScore.value < rule.value.englishMin)
    return {
      title: `英语${rule.value.englishLevel === 6 ? '六' : '四'}级：${languageScore.value || '尚无成绩'} / ${rule.value.englishMin}`,
      text: languageScore.value
        ? `距离本院门槛还差${rule.value.englishMin - languageScore.value}分，后续仍有考试机会。`
        : '日常英语训练和集中练习都会影响后续考试成绩。',
      action: '练习英语',
      id: 'english',
    };
  const standing = store.game.frozenRank ?? rank(store.game);
  if (standing > store.game.profile.quota)
    return {
      title: `推荐排位 ${standing}，本届 ${store.game.profile.quota} 个名额`,
      text: '课程和本院认可的成果共同影响推荐排位。',
      action: '补强课程',
      id: 'study',
    };
  return {
    title: '保留稳定的课程、项目和休息安排',
    text: '已经满足的条件仍需维持到资格公布。',
    action: '调整安排',
    id: 'routine',
  };
});
function followGoal() {
  if (priorityGoal.value.id === 'routine') editRoutine();
  else move(priorityGoal.value.id);
}
const goals = computed(() =>
  store.game.turn >= 43
    ? [
        {
          label: '校内推荐资格',
          value: ['yes', 'service'].includes(store.game.qualification) ? '已取得' : '未取得',
          done: ['yes', 'service'].includes(store.game.qualification),
        },
        {
          label: '确认录取去向',
          value: store.game.applications.some((a) => a.status === 'accepted') ? '已确认' : '待完成',
          done: store.game.applications.some((a) => a.status === 'accepted'),
        },
      ]
    : [
        {
          label: rule.value.minGpa ? '平均绩点' : '推荐均分',
          value: store.game.semesters.length
            ? rule.value.minGpa
              ? `${gpa(store.game).toFixed(2)} / ${rule.value.minGpa}`
              : `${averageScore(store.game).toFixed(1)} / ${rule.value.minAverage || '按排名'}`
            : '等待学期成绩',
          done:
            !!store.game.semesters.length &&
            (rule.value.minGpa
              ? gpa(store.game) >= rule.value.minGpa
              : averageScore(store.game) >= rule.value.minAverage),
        },
        {
          label: rule.value.englishLevel
            ? `英语${rule.value.englishLevel === 6 ? '六' : '四'}级`
            : '校内外语条件',
          value: !rule.value.englishLevel
            ? '不单设分数门槛'
            : `${rule.value.englishLevel === 6 ? store.game.cet6 : store.game.cet4} / ${rule.value.englishMin}`,
          done:
            !rule.value.englishLevel ||
            (rule.value.englishLevel === 6 ? store.game.cet6 : store.game.cet4) >=
              rule.value.englishMin,
        },
        {
          label: '进入推荐名额',
          value: `${store.game.frozenRank ?? rank(store.game)} / ${store.game.profile.quota}`,
          done: rank(store.game) <= store.game.profile.quota,
        },
      ],
);
function move(id = 'continue', method: WorkMethod = 'steady') {
  if (deadlineBlocked.value) {
    confirmDeadline.value = true;
    return;
  }
  const current = life.value.action;
  if (id !== 'continue' && current && current.id !== 'routine' && current.id !== id) {
    pendingMove.value = { id, method };
    return;
  }
  void store.move(id, method);
}
function replaceAction() {
  const next = pendingMove.value;
  pendingMove.value = null;
  if (next) void store.move(next.id, next.method);
}
function workDays(c: (typeof projects.value)[number]) {
  return c.state.target
    ? c.state.target - c.state.work
    : c.step.days +
        ((methods[c.state.id] ?? 'steady') === 'careful'
          ? 3
          : methods[c.state.id] === 'team'
            ? 2
            : 0) +
        (c.state.setbacks ? 2 : 0);
}
async function drop() {
  if (dropId.value) {
    await store.drop(dropId.value);
    dropId.value = '';
  }
}
</script>
<template>
  <EndingView v-if="store.game.stage === 'ended'" />
  <div v-else class="game-layout">
    <div class="play-area">
      <section class="campus-stage">
        <div class="stage-topline">
          <span
            ><LineIcon name="location" :size="15" />{{
              store.game.stage === 'event' ? store.event?.scene : store.game.profile.campus
            }}</span
          >
        </div>
        <div class="stage-caption">
          <h1>{{ store.game.stage === 'event' ? store.event?.title : '接下来做什么' }}</h1>
          <p v-if="store.game.stage !== 'event' && life.action">
            正在进行：{{ life.action.title }}
          </p>
        </div>
      </section>
      <section class="paper priority-goal">
        <div>
          <strong>{{ priorityGoal.title }}</strong>
          <p>{{ priorityGoal.text }}</p>
        </div>
        <div class="priority-actions">
          <el-button
            v-if="open"
            :disabled="store.busy || !!store.game.interview"
            @click="followGoal"
            >{{ priorityGoal.action }}</el-button
          ><button
            class="text-button"
            :disabled="store.busy || !!store.game.interview"
            @click="editRoutine"
          >
            调整日常</button
          ><button class="text-button" @click="store.setTab('growth')">成绩与条件</button>
        </div>
      </section>
      <details
        v-for="(result, i) in results"
        :key="result.title + '-' + i"
        class="paper feedback-paper game-result recent-result"
        :open="i === 0"
      >
        <summary>
          <strong>{{ result.title }}</strong
          ><span>处理结果</span>
        </summary>
        <div class="story-body">
          <p v-for="(text, n) in result.text.split('\n\n')" :key="n">{{ text }}</p>
        </div>
        <div v-if="deltas(result).length" class="delta-row">
          <span
            v-for="d in deltas(result)"
            :key="d.key"
            :class="favorable(d.key, d.value) ? 'positive' : 'negative'"
            >{{ d.label }} {{ d.value > 0 ? '+' : '' }}{{ d.value }}</span
          >
        </div>
        <p v-if="result.award" class="record-added">已记录：{{ result.award.title }}</p>
      </details>
      <section v-if="readyApps.length" class="game-alert">
        <div>
          <strong>{{ readyApps.length }} 条申请消息待回复</strong>
          <p>{{ readyApps[0]?.program.school }} / 截止 {{ replyDate(readyApps[0]!) }}</p>
        </div>
        <el-button type="primary" @click="store.setTab('applications')">处理消息</el-button>
      </section>
      <section
        v-if="store.game.stage === 'event' && store.event"
        :key="store.event.id"
        class="paper story-paper game-scene"
      >
        <div class="story-body">
          <p v-for="(paragraph, i) in body" :key="i">{{ paragraph }}</p>
        </div>
        <div class="choices">
          <button
            v-for="(choice, i) in store.event.choices"
            :key="i"
            class="choice"
            :disabled="store.busy || !canChoose(store.game, choice) || !!store.game.interview"
            @click="choose(i)"
          >
            <span class="choice-index">{{ String.fromCharCode(65 + i) }}</span
            ><span class="choice-copy"
              ><strong>{{ choice.label }}</strong
              ><span>{{ choice.hint }}</span
              ><small>{{ choice.days ? '占用 ' + choice.days + ' 天' : '当天处理' }}</small
              ><small v-if="choice.check"
                >{{ STAT_LABELS[choice.check.stat] }} / 参考把握
                {{
                  Math.round(
                    checkChance(store.game, choice.check.stat, choice.check.difficulty) * 100,
                  )
                }}%</small
              ><small v-if="!canChoose(store.game, choice)">{{
                store.game.stats.money + (choice.effects?.money ?? 0) < 0
                  ? '余额不足'
                  : '需要相关经历或能力'
              }}</small></span
            ><span class="choice-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </section>
      <template v-else-if="open">
        <section class="paper action-hub">
          <div v-if="life.action" class="ongoing-action">
            <strong>{{ life.action.title }}</strong
            ><span>剩余 {{ life.action.remaining }} 天</span>
          </div>
          <div v-if="deadlineBlocked" class="deadline-note">
            <strong>有即将截止的申请通知</strong>
            <p>处理后再继续；继续推进会错过尚未回复的通知。</p>
            <div class="application-actions">
              <el-button type="primary" @click="store.setTab('applications')">处理通知</el-button
              ><button class="text-button" @click="confirmDeadline = true">仍然继续</button>
            </div>
          </div>
          <el-button
            v-else
            class="continue-action"
            type="primary"
            size="large"
            :loading="store.busy"
            :disabled="!!store.game.interview"
            @click="move()"
            ><span>{{
              life.action && life.action.id !== 'routine'
                ? '完成已安排的工作'
                : '按日常安排推进到下条消息'
            }}</span
            ><LineIcon name="arrow" :size="20"
          /></el-button>
          <p class="small muted action-stop-note">遇到事件、任务结果或申请通知时自动停下。</p>
          <CampusMap
            :activities="activities"
            :budget="store.game.stats.money"
            :disabled="store.busy || !!store.game.interview || !!deadlineBlocked"
            @choose="move"
          />
          <button class="text-button more-actions" @click="allActions = !allActions">
            {{ allActions ? '收起其他行动' : '查看其他行动' }}
          </button>
        </section>
        <section v-if="projects.length" class="paper commitment-panel">
          <div class="panel-heading">
            <h2>正在做的事</h2>
            <span class="muted small">{{ projects.length }} / 2</span>
          </div>
          <article v-for="p in projects" :key="p.state.id" class="commitment">
            <div class="project-title">
              <h3>{{ p.definition.title }}</h3>
              <button class="text-button" :disabled="store.busy" @click="dropId = p.state.id">
                退出
              </button>
            </div>
            <p
              class="project-deadline"
              :class="{ warning: p.state.deadline - absoluteDay(store.game) < 12 }"
            >
              {{ dateAt(p.state.deadline) }}截止 / 还剩
              {{ Math.max(0, p.state.deadline - absoluteDay(store.game)) }} 天
            </p>
            <div class="project-stages">
              <span
                v-for="(step, i) in p.definition.steps"
                :key="step.title"
                :class="{ complete: i < p.state.step, current: i === p.state.step }"
                ><small>{{ i < p.state.step ? '✓' : i + 1 }}</small
                >{{ step.title }}</span
              >
            </div>
            <p v-if="p.state.step || p.state.work" class="small muted">{{ p.state.note }}</p>
            <div class="project-work">
              <el-select
                v-if="!p.state.target"
                :model-value="methods[p.state.id] ?? 'steady'"
                aria-label="任务做法"
                @update:model-value="methods[p.state.id] = $event as WorkMethod"
                ><el-option label="按计划推进" value="steady" /><el-option
                  label="多留时间检查"
                  value="careful" /><el-option label="找同学讨论" value="team" /></el-select
              ><span v-else class="small muted"
                >已投入 {{ p.state.work }} / {{ p.state.target }} 天</span
              ><el-button
                type="primary"
                :loading="store.busy"
                :disabled="!!store.game.interview || deadlineBlocked"
                @click="move('project:' + p.state.id, methods[p.state.id] ?? 'steady')"
                >推进这一步 / {{ workDays(p) }} 天</el-button
              >
            </div>
          </article>
        </section>
        <details class="paper resource-panel">
          <summary>可选学习投入 <span>按学期购买</span></summary>
          <p class="small muted">图书馆和日常训练仍可免费使用。</p>
          <article v-for="r in resources" :key="r.id" class="resource-offer">
            <div>
              <strong>{{ r.title }}</strong>
              <p>{{ r.description }}</p>
              <span>{{ r.cost }} 元 / {{ r.days }} 天</span>
            </div>
            <el-button
              :disabled="store.busy || store.game.stats.money < r.cost || !!store.game.interview"
              @click="move('resource:' + r.id)"
              >{{ store.game.stats.money < r.cost ? '余额不足' : '安排' }}</el-button
            >
          </article>
          <p v-if="!resources.length" class="small muted">本学期已安排这些投入。</p>
        </details>
        <details class="paper project-recruitment" :open="projects.length === 0">
          <summary>
            可以参与的事情 <span>{{ offers.length }} 项</span>
          </summary>
          <article v-for="p in offers" :key="p.id" class="project-offer">
            <h3>{{ p.title }}</h3>
            <p>{{ p.description }}</p>
            <div>
              <span class="small muted"
                >{{ p.deadline }} 天内完成{{ p.fee ? ' / 必要费用 ' + p.fee + ' 元' : '' }}</span
              ><el-button
                size="small"
                :disabled="
                  projects.length >= 2 || store.game.stats.money < p.fee || !!store.game.interview
                "
                :loading="store.busy"
                @click="store.join(p.id)"
                >{{
                  projects.length >= 2
                    ? '已有两项任务'
                    : store.game.stats.money < p.fee
                      ? '余额不足'
                      : '接下任务'
                }}</el-button
              >
            </div>
          </article>
          <p v-if="!offers.length" class="small muted">暂时没有新的招募。</p>
        </details>
      </template>
      <section v-else class="paper loading-paper">
        <el-skeleton :rows="5" /><el-button v-if="store.error" @click="store.hydrate()"
          >重试</el-button
        >
      </section>
      <details v-if="life.notices.length" class="paper recent-updates" open>
        <summary>近期消息</summary>
        <p v-for="(n, i) in life.notices.slice(-5).reverse()" :key="i">
          <time>{{ n.date }}</time
          >{{ n.text }}
        </p>
      </details>
    </div>
    <aside class="game-sidebar">
      <section class="paper student-card">
        <div class="student-identity">
          <span class="student-emblem"><LineIcon name="crest" :size="29" /></span>
          <div>
            <h2>{{ store.game.profile.campus }}</h2>
            <p>{{ store.game.profile.department }}</p>
          </div>
        </div>
        <div class="student-major">
          <span>{{ store.game.profile.major }}</span
          ><strong>{{
            ['', '大一', '大二', '大三', '大四'][PERIODS[store.game.turn]!.year]
          }}</strong>
        </div>
        <div class="student-traits">
          <span
            v-for="trait in store.game.profile.traits"
            :key="trait.id"
            :title="trait.description"
            >{{ trait.name }}</span
          >
        </div>
      </section>
      <section class="paper objective-panel">
        <h2>{{ store.game.turn >= 43 ? '确定接下来的去向' : '争取校内推荐资格' }}</h2>
        <div v-for="goal in goals" :key="goal.label" class="objective" :class="{ done: goal.done }">
          <span>{{ goal.done ? '✓' : '○' }} {{ goal.label }}</span
          ><strong>{{ goal.value }}</strong>
        </div>
        <p class="small muted">{{ milestone.label }} / {{ milestone.date }}</p>
        <button class="text-button" @click="store.setTab('growth')">查看成绩与校内规则</button>
      </section>
      <section class="paper routine-panel">
        <div class="panel-heading">
          <h2>日常安排</h2>
          <button
            class="text-button"
            :disabled="store.busy || !!store.game.interview"
            @click="editRoutine"
          >
            调整
          </button>
        </div>
        <p>{{ routineLabel(store.game) }}</p>
        <p v-if="store.game.stats.energy < 35" class="warning small">
          精力不足，近期安排会更吃力。
        </p>
        <p v-else-if="store.game.stats.stress > 70" class="warning small">
          压力较高，可以减少任务或多休息。
        </p>
        <div class="routine-bars">
          <div v-for="item in PLAN_ITEMS.filter((i) => life.routine[i.key] > 0)" :key="item.key">
            <span>{{ item.label }}</span
            ><progress :value="life.routine[item.key]" max="6" :aria-label="item.label" />
          </div>
        </div>
      </section>
      <section
        v-if="life.commitments.some((c) => c.status !== 'active')"
        class="paper completed-tasks"
      >
        <h2>已结束的任务</h2>
        <p
          v-for="c in life.commitments
            .filter((c) => c.status !== 'active')
            .slice(-4)
            .reverse()"
          :key="c.id"
        >
          <strong>{{ projectById(c.id)?.title }}</strong
          ><span>{{
            c.status === 'completed'
              ? '已完成'
              : c.status === 'partial'
                ? '部分完成'
                : c.status === 'missed'
                  ? '未按时完成'
                  : '已退出'
          }}</span>
        </p>
      </section>
    </aside>
  </div>
  <el-dialog v-model="routineOpen" title="调整日常安排" width="min(540px, calc(100vw - 24px))"
    ><div class="focus-grid">
      <button
        v-for="item in items"
        :key="item.key"
        :class="{ selected: primary === item.key }"
        @click="primary = item.key"
      >
        <strong>{{ item.label }}</strong
        ><span>{{ item.description }}</span>
      </button>
    </div>
    <div class="planning-fields">
      <label
        ><span>同时兼顾</span
        ><el-select v-model="secondary" aria-label="同时兼顾"
          ><el-option
            v-for="item in secondaryItems"
            :key="item.key"
            :label="item.label"
            :value="item.key" /></el-select></label
      ><label
        ><span>投入程度</span
        ><el-select v-model="pace" aria-label="投入程度"
          ><el-option label="轻松，多休息" value="light" /><el-option
            label="正常"
            value="normal" /><el-option label="冲刺，少休息" value="intense" /></el-select
      ></label>
    </div>
    <template #footer
      ><el-button @click="routineOpen = false">取消</el-button
      ><el-button type="primary" :loading="store.busy" @click="saveRoutine"
        >保存安排</el-button
      ></template
    ></el-dialog
  >
  <el-dialog
    :model-value="choiceToConfirm !== null"
    title="这项选择需要时间"
    width="min(440px, calc(100vw - 24px))"
    @close="choiceToConfirm = null"
    ><p>这段时间内有申请通知截止，继续处理会错过回复期限。</p>
    <template #footer
      ><el-button
        @click="
          choiceToConfirm = null;
          store.setTab('applications');
        "
        >先回复通知</el-button
      ><el-button type="primary" @click="confirmChoice">继续这项选择</el-button></template
    ></el-dialog
  >
  <el-dialog v-model="confirmDeadline" title="继续推进日期" width="min(440px, calc(100vw - 24px))"
    ><p>尚未回复的通知将过期。</p>
    <template #footer
      ><el-button
        @click="
          confirmDeadline = false;
          store.setTab('applications');
        "
        >先处理通知</el-button
      ><el-button
        type="primary"
        @click="
          confirmDeadline = false;
          store.move('continue', 'steady', true);
        "
        >继续推进</el-button
      ></template
    ></el-dialog
  >
  <el-dialog
    :model-value="!!dropId"
    title="退出这项任务"
    width="min(440px, calc(100vw - 24px))"
    @close="dropId = ''"
    ><p>退出后保留已有记录，必要费用不退还。</p>
    <template #footer
      ><el-button @click="dropId = ''">继续做</el-button
      ><el-button type="primary" :loading="store.busy" @click="drop">确认退出</el-button></template
    ></el-dialog
  >
  <el-dialog
    :model-value="!!pendingMove"
    title="调整当前行动"
    width="min(440px, calc(100vw - 24px))"
    @close="pendingMove = null"
    ><p>
      {{ life.action?.title }}还剩 {{ life.action?.remaining }} 天。{{
        life.action?.projectId
          ? '项目已完成的工作会保留，之后可以继续。'
          : '改做其他行动会放弃剩余安排，已支付费用不退还。'
      }}
    </p>
    <template #footer
      ><el-button @click="pendingMove = null">保留原安排</el-button
      ><el-button type="primary" @click="replaceAction">改做这项行动</el-button></template
    ></el-dialog
  >
</template>
