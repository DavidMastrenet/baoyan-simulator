<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { readShare, type SharedGame } from '../services/share';
import { loadEnding } from '../services/content';
import { averageScore, gpa } from '../engine/rules';
import { periodLabel } from '../engine/world';
import type { Ending } from '../engine/types';
import { cleanNickname } from '../services/nickname';
import NicknameDialog from './NicknameDialog.vue';
const props = defineProps<{ token: string }>(),
  emit = defineEmits<{ close: [] }>(),
  store = useGameStore();
const shared = ref<SharedGame | null>(null),
  ending = ref<Ending | null>(null),
  error = ref(''),
  busy = ref(false);
const nicknameOpen = ref(false);
async function load() {
  busy.value = true;
  error.value = '';
  try {
    shared.value = await readShare(props.token);
    if (shared.value.kind === 'ending' && shared.value.state.endingId)
      ending.value = await loadEnding(shared.value.state.endingId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败，请重试。';
  } finally {
    busy.value = false;
  }
}
function close() {
  const url = new URL(location.href);
  url.searchParams.delete('share');
  history.replaceState(null, '', url.pathname + url.search);
  emit('close');
}
async function continueGame(nickname: string) {
  if (!shared.value || shared.value.kind !== 'progress' || busy.value) return;
  const name = cleanNickname(nickname);
  if (!name) return;
  if (Date.now() >= shared.value.expiresAt) {
    error.value = '链接已过期，请重新获取。';
    return;
  }
  busy.value = true;
  try {
    const state = JSON.parse(JSON.stringify(shared.value.state));
    state.profile.nickname = name;
    await store.restore(state);
    close();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取失败，请重试。';
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <main class="enrollment shared-view" :aria-busy="busy">
    <h1>{{ shared?.kind === 'ending' ? '分享的结局' : '分享的游戏进度' }}</h1>
    <section class="paper" v-if="shared && !error">
      <h2>{{ shared.state.profile.campus }}</h2>
      <p>{{ shared.state.profile.major }} / {{ periodLabel(shared.state.turn) }}</p>
      <p>{{ shared.state.profile.background }}</p>
      <dl class="profile-grid">
        <div>
          <dt>累计均分</dt>
          <dd>{{ averageScore(shared.state).toFixed(2) }}</dd>
        </div>
        <div>
          <dt>绩点</dt>
          <dd>{{ gpa(shared.state).toFixed(2) }}</dd>
        </div>
        <div>
          <dt>精力</dt>
          <dd>{{ Math.round(shared.state.stats.energy) }}</dd>
        </div>
        <div>
          <dt>余额</dt>
          <dd>{{ Math.round(shared.state.stats.money) }} 元</dd>
        </div>
      </dl>
      <template v-if="ending"
        ><h2>{{ ending.title }}</h2>
        <p>{{ ending.subtitle }}</p>
        <p v-for="line in ending.body" :key="line">{{ line }}</p>
        <p v-if="shared.state.applications.find((a) => a.status === 'accepted')">
          录取项目：{{
            shared.state.applications.find((a) => a.status === 'accepted')?.program.school
          }}
          / {{ shared.state.applications.find((a) => a.status === 'accepted')?.program.degree }}
        </p></template
      >
      <p v-if="shared.kind === 'progress'" class="small muted">继续将替换本机当前进度。</p>
      <div class="entry-actions">
        <el-button
          v-if="shared.kind === 'progress'"
          type="primary"
          :loading="busy || store.busy"
          @click="nicknameOpen = true"
          >从这里继续</el-button
        ><el-button @click="close">返回游戏</el-button>
      </div>
    </section>
    <section class="paper" v-else-if="error">
      <p role="alert">{{ error }}</p>
      <div class="entry-actions">
        <el-button @click="load" :loading="busy">重试</el-button
        ><el-button @click="close">返回游戏</el-button>
      </div>
    </section>
    <section class="paper" v-else><el-skeleton :rows="4" /></section>
  </main>
  <NicknameDialog
    v-model="nicknameOpen"
    :busy="busy || store.busy"
    :error="error"
    confirm-label="继续游戏"
    @confirm="continueGame"
  />
</template>
