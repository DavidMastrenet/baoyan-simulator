<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useGameStore } from '../stores/game';
import {
  activeSlots,
  applyReason,
  fitLabel,
  interviewReason,
  seasonAt,
  STATUS_LABELS,
  replyDate,
  replyExpired,
  toFormalReason,
} from '../engine/admissions';
import { gpa } from '../engine/rules';
import { absoluteDay, dateAt } from '../engine/calendar';
import { periodLabel } from '../engine/world';
import type { Application, Program } from '../engine/types';
const store = useGameStore(),
  mode = ref('records'),
  filter = ref('全部'),
  sort = ref('匹配度'),
  confirm = ref<Application | null>(null),
  exit = ref<Application | null>(null),
  info = ref<Program | null>(null);
const season = computed(() => seasonAt(store.game.turn));
const batch = computed(() =>
  season.value === 'summer'
    ? '夏令营'
    : season.value === 'pre'
      ? '预推免'
      : season.value === 'late'
        ? '正式系统'
        : '材料准备',
);
const catalogs = computed(() =>
  store.programs
    .filter(
      (p) =>
        (filter.value === '全部' || filter.value === p.degree) &&
        (season.value ? p.available.includes(season.value) : true),
    )
    .sort((a, b) =>
      sort.value === '预算'
        ? a.fee - b.fee
        : sort.value === '学业门槛'
          ? a.gpaMin - b.gpaMin
          : Number(b.major === store.game.profile.major) -
              Number(a.major === store.game.profile.major) || a.tier - b.tier,
    ),
);
const records = computed(() =>
  [...store.game.applications].sort((a, b) => {
    const priority = (a: Application) =>
      a.status === 'offer'
        ? 0
        : ['formalInterview', 'interview'].includes(a.status)
          ? 1
          : a.status === 'accepted'
            ? 2
            : 3;
    return priority(a) - priority(b) || b.submitted - a.submitted;
  }),
);
const notify = computed(
  () =>
    records.value.filter((a) => ['offer', 'interview', 'formalInterview'].includes(a.status))
      .length,
);
function due(a: Application) {
  return ['offer', 'interview', 'formalInterview'].includes(a.status)
    ? `回复期限：${replyDate(a)}`
    : a.status === 'waitlist'
      ? `候补前方 ${a.waitPosition} 人`
      : a.status === 'review' || a.status === 'formalReview'
        ? `预计更新：${a.updateDay !== undefined ? dateAt(a.updateDay) : periodLabel(a.due)}`
        : '';
}
function mayWithdraw(a: Application) {
  return (
    !['accepted', 'rejected', 'expired', 'declined'].includes(a.status) &&
    (!a.formal ||
      (a.lockDay !== undefined
        ? absoluteDay(store.game) >= a.lockDay
        : store.game.turn >= a.lockedUntil) ||
      a.status === 'offer')
  );
}
async function acceptConfirmed() {
  const a = confirm.value;
  if (a) {
    confirm.value = null;
    await store.accept(a.id);
  }
}
async function declineConfirmed() {
  const a = exit.value;
  if (a) {
    exit.value = null;
    await store.decline(a.id);
  }
}
onMounted(() => store.showPrograms());
</script>
<template>
  <div class="section-title">
    <div>
      <span class="eyebrow">{{ batch }}</span>
      <h1>申请列表</h1>
    </div>
    <span v-if="notify" class="notification-count">{{ notify }} 条待处理</span>
  </div>
  <section class="paper material-paper">
    <div class="panel-heading">
      <h2>材料完整度</h2>
      <strong
        >{{ store.game.stats.materials.toFixed(0) }}<span class="muted small"> /100</span></strong
      >
    </div>
    <el-progress
      :percentage="Math.round(store.game.stats.materials)"
      :show-text="false"
      :stroke-width="5"
    />
    <p class="small muted">成绩证明、语言成绩、个人陈述、推荐意见与成果记录。</p>
    <div class="material-action">
      <span class="small">{{
        store.game.turn < 24 ? '大三开始整理正式申请材料。' : '集中整理需要5天。'
      }}</span
      ><el-button
        :disabled="
          store.game.turn < 24 ||
          store.game.stage === 'ended' ||
          store.game.stage === 'event' ||
          !!store.game.interview
        "
        :loading="store.busy"
        @click="
          store.prepare();
          store.setTab('day');
        "
        >整理材料</el-button
      >
    </div>
  </section>
  <section v-if="store.game.turn < 32" class="paper quiet-paper">
    <span class="eyebrow">大三五月开放投递</span>
    <h2>申请尚未开放</h2>
    <p>大三五月开始申请。现在可以提高成绩和能力，大三起可以整理材料。</p>
    <div class="milestone-inline">
      <span>大三五月<small>夏令营</small></span
      ><span>大三八月<small>预推免</small></span
      ><span>大四九月<small>资格与正式填报</small></span>
    </div>
  </section>
  <template v-else>
    <section v-if="season === 'late'" class="paper formal-summary">
      <div class="panel-heading">
        <h2>三个平行志愿</h2>
        <span>{{ activeSlots(store.game).length }} / 3 使用中</span>
      </div>
      <div class="slots">
        <span v-for="i in 3" :key="i" :class="{ filled: activeSlots(store.game)[i - 1] }">{{
          activeSlots(store.game)[i - 1]?.program.school ?? '空位'
        }}</span>
      </div>
      <p class="small muted">
        {{ store.game.qualificationReason }}填报后两个系统日为48小时处理窗口；复试与待录取分别确认。
      </p>
    </section>
    <div class="view-switch">
      <button :class="{ active: mode === 'records' }" @click="mode = 'records'">
        我的申请 <span>{{ records.length }}</span></button
      ><button :class="{ active: mode === 'catalog' }" @click="mode = 'catalog'">
        本批次项目 <span>{{ catalogs.length }}</span>
      </button>
    </div>
    <template v-if="mode === 'records'">
      <section v-if="!records.length" class="paper empty-panel">
        <h2>尚未提交申请</h2>
        <p>材料完整度达到50后，可以选择本批次项目。同一天最多投递两份材料、参加两场考核。</p>
        <el-button @click="mode = 'catalog'">查看项目</el-button>
      </section>
      <article
        v-for="a in records"
        :key="a.id"
        class="paper application-card"
        :class="{ 'accepted-card': a.status === 'accepted' }"
      >
        <div class="program-top">
          <span
            >{{ a.season === 'summer' ? '夏令营' : a.season === 'pre' ? '预推免' : '系统填报'
            }}{{ a.formal && a.season !== 'late' ? ' / 已转入系统' : '' }}</span
          ><el-tag
            :type="
              a.status === 'accepted' || a.status === 'offer'
                ? 'success'
                : a.status === 'expired' || a.status === 'rejected'
                  ? 'info'
                  : 'primary'
            "
            effect="plain"
            >{{ STATUS_LABELS[a.status] }}</el-tag
          >
        </div>
        <h2>{{ a.program.school }}</h2>
        <p class="program-department">{{ a.program.department }} / {{ a.program.degree }}</p>
        <p class="application-notice">{{ a.notice }}</p>
        <div v-if="due(a)" class="due-line">{{ due(a) }}</div>
        <div
          v-if="
            a.formal &&
            (a.lockDay !== undefined
              ? absoluteDay(store.game) < a.lockDay
              : store.game.turn < a.lockedUntil) &&
            !['accepted', 'rejected', 'declined', 'offer', 'expired'].includes(a.status)
          "
          class="small muted lock-note"
        >
          志愿调整：{{
            a.lockDay !== undefined ? dateAt(a.lockDay) : periodLabel(a.lockedUntil)
          }}起开放
        </div>
        <div class="application-actions">
          <el-button
            v-if="a.status === 'offer'"
            type="primary"
            :disabled="replyExpired(store.game, a) || store.game.stage === 'ended'"
            @click="confirm = a"
            >确认待录取</el-button
          >
          <el-button
            v-else-if="a.status === 'formalInterview' && a.interviewed"
            type="primary"
            :disabled="replyExpired(store.game, a) || store.game.stage === 'ended'"
            :loading="store.busy"
            @click="store.confirmRetest(a.id)"
            >确认复试回执</el-button
          >
          <el-button
            v-else-if="['interview', 'formalInterview'].includes(a.status)"
            type="primary"
            :disabled="!!interviewReason(store.game, a) || store.game.stage === 'ended'"
            :title="interviewReason(store.game, a)"
            :loading="store.busy"
            @click="store.interview(a.id)"
            >参加考核</el-button
          >
          <el-button
            v-if="
              ['camp', 'preoffer', 'waitlist'].includes(a.status) && !a.formal && season === 'late'
            "
            type="primary"
            :disabled="!!toFormalReason(store.game, a) || store.game.stage === 'ended'"
            :title="toFormalReason(store.game, a)"
            :loading="store.busy"
            @click="store.formal(a.id)"
            >填入系统志愿</el-button
          >
          <el-button v-if="mayWithdraw(a) && store.game.stage !== 'ended'" @click="exit = a"
            >回复退出</el-button
          ><button class="text-button" @click="info = a.program">项目详情</button>
        </div>
        <p
          v-if="
            ['camp', 'preoffer', 'waitlist'].includes(a.status) &&
            !a.formal &&
            season === 'late' &&
            toFormalReason(store.game, a)
          "
          class="small muted"
        >
          {{ toFormalReason(store.game, a) }}
        </p>
        <p
          v-if="
            ['interview', 'formalInterview'].includes(a.status) &&
            !a.interviewed &&
            interviewReason(store.game, a)
          "
          class="small muted"
        >
          {{ interviewReason(store.game, a) }}
        </p>
      </article>
    </template>
    <template v-else>
      <div class="catalog-filters">
        <el-select v-model="filter" aria-label="学位类型"
          ><el-option
            v-for="t in ['全部', '学硕', '专硕', '直博']"
            :key="t"
            :label="t === '全部' ? '全部学位' : t"
            :value="t" /></el-select
        ><el-select v-model="sort" aria-label="项目排序"
          ><el-option
            v-for="t in ['匹配度', '预算', '学业门槛']"
            :key="t"
            :label="'按' + t"
            :value="t"
        /></el-select>
      </div>
      <p class="small muted catalog-note">
        今天已投递 {{ store.game.submissionsThisTurn }} / 2 / 你的累计绩点
        {{ gpa(store.game).toFixed(2) }} / 六级 {{ store.game.cet6 || '待考' }}
      </p>
      <article v-for="p in catalogs" :key="p.id" class="paper program-card">
        <div class="program-top">
          <span>{{ p.city }} / {{ p.format }}</span
          ><span class="degree-label">{{ p.degree }}</span>
        </div>
        <h2>{{ p.school }}</h2>
        <p class="program-department">{{ p.department }}</p>
        <p class="program-description">{{ p.description }}</p>
        <div class="program-tags">
          <span>{{ p.field }}</span
          ><span>{{ fitLabel(store.game, p) }}</span>
        </div>
        <dl class="program-facts">
          <div>
            <dt>绩点起点</dt>
            <dd>{{ p.gpaMin.toFixed(1) }}</dd>
          </div>
          <div>
            <dt>六级起点</dt>
            <dd>{{ p.englishMin || '综合评价' }}</dd>
          </div>
          <div>
            <dt>本次预算</dt>
            <dd>¥{{ p.fee }}</dd>
          </div>
        </dl>
        <div class="program-submit">
          <button class="text-button" @click="info = p">培养与费用</button
          ><el-button
            type="primary"
            :disabled="!!applyReason(store.game, p)"
            :loading="store.busy"
            @click="store.apply(p)"
            >提交材料</el-button
          >
        </div>
        <p v-if="applyReason(store.game, p)" class="reason-text">
          {{ applyReason(store.game, p) }}
        </p>
      </article>
      <div v-if="!catalogs.length" class="paper empty-panel">
        <p>当前筛选下暂无开放项目。</p>
        <el-button @click="store.showPrograms()">重新查看</el-button>
      </div>
    </template>
  </template>
  <el-dialog
    :model-value="!!confirm"
    title="确认录取"
    width="min(460px, calc(100vw - 32px))"
    @close="confirm = null"
    ><template v-if="confirm"
      ><h3>{{ confirm.program.school }} / {{ confirm.program.degree }}</h3>
      <p class="dialog-prose">确认后接受该项目的录取，其余申请自动结束。</p></template
    ><template #footer
      ><el-button @click="confirm = null">再想一想</el-button
      ><el-button type="primary" @click="acceptConfirmed">确认待录取</el-button></template
    ></el-dialog
  >
  <el-dialog
    :model-value="!!exit"
    title="回复退出"
    width="min(460px, calc(100vw - 32px))"
    @close="exit = null"
    ><p class="dialog-prose">
      向{{ exit?.program.school }}说明你已决定退出这一轮申请，结束这条申请记录。
    </p>
    <template #footer
      ><el-button @click="exit = null">保留申请</el-button
      ><el-button type="primary" @click="declineConfirmed">发送退出回复</el-button></template
    ></el-dialog
  >
  <el-dialog
    :model-value="!!info"
    title="项目记录"
    width="min(520px, calc(100vw - 32px))"
    @close="info = null"
    ><template v-if="info"
      ><h2>{{ info.school }}</h2>
      <p>{{ info.department }} / {{ info.degree }}</p>
      <p class="dialog-prose">{{ info.description }}</p>
      <dl class="detail-facts">
        <div>
          <dt>研究方向</dt>
          <dd>{{ info.field }}</dd>
        </div>
        <div>
          <dt>培养日常</dt>
          <dd>{{ info.style }}</dd>
        </div>
        <div>
          <dt>年度学费</dt>
          <dd>¥{{ info.tuition.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>年度基础奖助</dt>
          <dd>¥{{ info.stipend.toLocaleString() }}</dd>
        </div>
        <div>
          <dt>本次材料与交通预算</dt>
          <dd>¥{{ info.fee }}</dd>
        </div>
      </dl>
      <p class="small muted">
        材料初筛同时查看学业、语言、研究或实践经历。六级起点可由申请材料中经认可的替代语言成绩满足；直博还会考察长期研究准备。
      </p></template
    ></el-dialog
  >
</template>
