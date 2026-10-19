<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { averageScore, gpa } from '../engine/rules';
const store = useGameStore();
const accepted = computed(() => store.game.applications.find((a) => a.status === 'accepted'));
</script>
<template>
  <div class="section-title"><h1>游戏结果</h1></div>
  <section v-if="store.ending" class="paper ending-paper">
    <h2>{{ store.ending.title }}</h2>
    <p>{{ store.ending.subtitle }}</p>
    <div v-if="accepted" class="destination">
      <strong>{{ accepted.program.school }}</strong>
      <p>{{ accepted.program.department }} / {{ accepted.program.degree }}</p>
    </div>
    <div class="story-body">
      <p v-for="(p, i) in store.ending.body" :key="i">{{ p }}</p>
    </div>
    <div class="ending-stats">
      <div>
        <span>累计均分</span><strong>{{ averageScore(store.game).toFixed(2) }}</strong>
      </div>
      <div>
        <span>累计绩点</span><strong>{{ gpa(store.game).toFixed(2) }}</strong>
      </div>
      <div>
        <span>成果数量</span><strong>{{ store.game.awards.length }}</strong>
      </div>
    </div>
    <div class="ending-actions">
      <el-button type="primary" @click="store.shareOpen = true">分享结局</el-button
      ><el-button @click="store.setTab('archive')">查看存档</el-button
      ><el-button @click="store.setTab('history')">查看事件记录</el-button>
    </div>
  </section>
  <div v-else class="paper">
    <el-skeleton :rows="5" /><el-button v-if="store.error" @click="store.hydrate()">重试</el-button>
  </div>
</template>
