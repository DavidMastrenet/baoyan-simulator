<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { STAT_LABELS } from '../engine/world';
import { schoolRuleText } from '../engine/game';
import { recommendationRule } from '../engine/balance';
import { computed, ref } from 'vue';
import type { StatKey } from '../engine/types';
import LineIcon from './LineIcon.vue';
import NicknameDialog from './NicknameDialog.vue';
const store = useGameStore();
const rule = computed(() => recommendationRule(store.game.profile));
const skills: StatKey[] = ['study', 'english', 'research', 'craft'];
const nicknameOpen = ref(false);
function openNickname() {
  if (store.busy) return;
  store.error = '';
  nicknameOpen.value = true;
}
</script>
<template>
  <main class="enrollment">
    <section class="entry-intro">
      <div class="entry-landscape" aria-hidden="true">
        <span class="entry-campus-mark"><LineIcon name="campus" :size="40" /></span>
      </div>
      <div class="entry-intro-copy">
        <h1>保研<span>模拟器</span></h1>
        <p>从入学到推免录取，安排课程、科研和生活。</p>
      </div>
    </section>
    <section class="character-panel">
      <div class="character-heading">
        <h2>入学信息</h2>
        <button class="reroll-button" :disabled="store.busy" @click="store.reroll()">
          <LineIcon name="refresh" :size="15" />重新随机
        </button>
      </div>
      <section class="admission-paper">
        <div class="school-identity">
          <span class="school-emblem"><LineIcon name="campus" :size="26" /></span>
          <div>
            <h2>{{ store.game.profile.campus }}</h2>
            <p>{{ store.game.profile.department }} / {{ store.game.profile.major }}</p>
            <span>{{ store.game.profile.location }}</span>
          </div>
        </div>
        <dl class="profile-grid">
          <div>
            <dt>同届人数</dt>
            <dd>{{ store.game.profile.cohortSize }} 人</dd>
          </div>
          <div>
            <dt>推荐名额</dt>
            <dd>{{ store.game.profile.quota }} 人</dd>
          </div>
          <div>
            <dt>每月生活费</dt>
            <dd>{{ store.game.profile.allowance }} 元</dd>
          </div>
          <div>
            <dt>每月基本支出</dt>
            <dd>{{ store.game.profile.livingCost }} 元</dd>
          </div>
        </dl>
        <details class="entry-rules">
          <summary>本院推荐规则</summary>
          <p class="small">{{ schoolRuleText(store.game) }}</p>
          <p class="small">
            {{ rule.minAverage ? '推荐均分至少' + rule.minAverage + '分。' : ''
            }}{{ rule.minGpa ? '初考平均绩点至少' + rule.minGpa + '。' : ''
            }}{{
              rule.englishLevel
                ? '英语' +
                  (rule.englishLevel === 6 ? '六' : '四') +
                  '级至少' +
                  rule.englishMin +
                  '分。'
                : '校内推荐不单设英语分数门槛。'
            }}{{ rule.firstAttempt ? '要求课程初考全部合格。' : '未通过的课程须完成补修。' }}
          </p>
        </details>
        <div class="initial-skills">
          <div v-for="key in skills" :key="key">
            <span>{{ STAT_LABELS[key] }}</span
            ><strong>{{ store.game.stats[key] }}</strong>
          </div>
        </div>
        <div class="background-story">
          <h3>{{ store.game.profile.background }}</h3>
          <p class="muted">{{ store.game.profile.backgroundDescription }}</p>
        </div>
        <div class="trait-row">
          <div v-for="trait in store.game.profile.traits" :key="trait.id" class="trait">
            <strong>{{ trait.name }}</strong>
            <p>{{ trait.description }}</p>
          </div>
        </div>
        <div class="entry-balance">
          <span><LineIcon name="wallet" :size="16" />初始余额</span
          ><strong>¥ {{ store.game.stats.money.toLocaleString() }}</strong>
        </div>
        <p class="family-note">{{ store.game.profile.family }}</p>
      </section>
      <div class="entry-actions">
        <el-button type="primary" size="large" :loading="store.busy" @click="openNickname"
          ><span>开始大学生活</span><LineIcon name="arrow" :size="20"
        /></el-button>
      </div>
    </section>
  </main>
  <NicknameDialog
    v-model="nicknameOpen"
    :busy="store.busy"
    :error="store.error"
    @confirm="store.enroll"
  />
</template>
