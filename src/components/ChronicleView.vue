<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { periodLabel, STAT_LABELS } from '../engine/world';
import type { StatKey } from '../engine/types';
const store = useGameStore(),
  query = ref(''),
  filter = ref('全部');
const label = (key: string) => STAT_LABELS[key as StatKey];
const rows = computed(() =>
  [...store.game.log]
    .reverse()
    .filter(
      (row) =>
        (filter.value === '全部' || row.category === filter.value) &&
        (!query.value || `${row.title} ${row.text} ${row.choice ?? ''}`.includes(query.value)),
    ),
);
const page = ref(1),
  visible = computed(() => rows.value.slice(0, page.value * 24));
</script>
<template>
  <div class="section-title">
    <div>
      <span class="eyebrow">事件记录</span>
      <h1>事件记录</h1>
    </div>
    <span class="muted small">{{ store.game.log.length }} 条记录</span>
  </div>
  <div class="chronicle-filter">
    <el-input
      v-model="query"
      clearable
      placeholder="搜索事件"
      aria-label="搜索已经发生的经历"
      @input="page = 1"
    /><el-select v-model="filter" aria-label="经历类别" @change="page = 1"
      ><el-option
        v-for="t in [
          '全部',
          '学业',
          '科研',
          '项目',
          '竞赛',
          '实践',
          '生活',
          '关系',
          '申请',
          '偶遇',
          '结算',
        ]"
        :key="t"
        :label="t"
        :value="t"
    /></el-select>
  </div>
  <div v-if="!rows.length" class="paper empty-panel">
    <p>{{ store.game.log.length ? '没有找到这段经历。' : '暂无记录，开始游戏后查看。' }}</p>
  </div>
  <div class="chronicle-list">
    <article v-for="row in visible" :key="row.id" class="chronicle-entry">
      <div class="chronicle-stamp">
        <span>{{ periodLabel(row.turn) }}</span
        ><span>{{ row.category }}</span>
      </div>
      <div class="paper">
        <h2>{{ row.title }}</h2>
        <p v-if="row.choice" class="past-choice">你的选择：{{ row.choice }}</p>
        <p class="chronicle-body">{{ row.text }}</p>
        <div v-if="row.changes" class="small past-deltas">
          <span v-for="(value, key) in row.changes" :key="key"
            >{{ label(key) }} {{ (value ?? 0) > 0 ? '+' : '' }}{{ value }}</span
          >
        </div>
      </div>
    </article>
  </div>
  <div v-if="visible.length < rows.length" class="load-more">
    <el-button @click="page++">加载更多</el-button>
  </div>
</template>
