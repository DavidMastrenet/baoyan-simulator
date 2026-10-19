<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { rank } from '../engine/rules';
import LineIcon from './LineIcon.vue';
const store = useGameStore();
</script>
<template>
  <div
    class="status-strip"
    :style="{
      '--energy': store.game.stats.energy + '%',
      '--stress': store.game.stats.stress + '%',
    }"
  >
    <div class="status-item">
      <span class="status-label"><LineIcon name="energy" :size="15" />精力</span
      ><strong :class="{ warning: store.game.stats.energy < 25 }"
        >{{ Math.round(store.game.stats.energy) }}<small>/ 100</small></strong
      ><progress :value="store.game.stats.energy" max="100" aria-label="精力" />
    </div>
    <div class="status-item">
      <span class="status-label"><LineIcon name="stress" :size="15" />压力</span
      ><strong :class="{ warning: store.game.stats.stress > 70 }"
        >{{ Math.round(store.game.stats.stress) }}<small>/ 100</small></strong
      ><progress
        class="stress-progress"
        :value="store.game.stats.stress"
        max="100"
        aria-label="压力"
      />
    </div>
    <div class="status-item">
      <span class="status-label"><LineIcon name="wallet" :size="15" />结余</span
      ><strong><small>¥ </small>{{ Math.round(store.game.stats.money).toLocaleString() }}</strong
      ><span class="status-foot">生活与申请预算</span>
    </div>
    <div class="status-item">
      <span class="status-label"
        ><LineIcon name="target" :size="15" />{{
          store.game.frozenRank ? '公示排位' : '参考排位'
        }}</span
      ><strong
        >{{ store.game.frozenRank ?? rank(store.game)
        }}<small>/ {{ store.game.profile.cohortSize }}</small></strong
      ><span class="status-foot"
        >本届名额 <b>{{ store.game.profile.quota }}</b></span
      >
    </div>
  </div>
</template>
