<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useGameStore } from '../stores/game';
import { memories, readSlot, saveSlot } from '../services/storage';
import { periodLabel } from '../engine/world';
import type { GameState } from '../engine/types';
import type { Memory } from '../services/storage';
const store = useGameStore(),
  notice = ref(''),
  newRun = ref(false),
  overwrite = ref(0),
  loadingSlot = ref<GameState | null>(null);
async function getSlots() {
  return Promise.all(
    [1, 2, 3].map(async (index) => {
      try {
        return { index, state: await readSlot(index), damaged: false };
      } catch {
        return { index, state: null, damaged: true };
      }
    }),
  );
}
const slots = ref<{ index: number; state: GameState | null; damaged: boolean }[]>([]),
  collection = ref<Memory[]>([]),
  writing = ref(0),
  saving = ref(false);
onMounted(async () => {
  slots.value = await getSlots();
  try {
    collection.value = await memories();
  } catch {
    notice.value = '结局记录内容异常，无法读取。';
  }
});
const elapsed = computed(
  () => `${Math.floor(store.game.seconds / 60)} 分 ${store.game.seconds % 60} 秒`,
);
async function writeSlot(index: number) {
  if (writing.value) return;
  writing.value = index;
  try {
    await saveSlot(index, store.game);
    slots.value = await getSlots();
    notice.value = `存档 ${index} 已保存。`;
    overwrite.value = 0;
  } catch {
    notice.value = '保存失败，请检查浏览器的存储空间和站点权限后重试。';
  } finally {
    writing.value = 0;
  }
}
async function saveCurrent() {
  if (saving.value) return;
  saving.value = true;
  await store.persist();
  notice.value = store.saveMessage || '当前进度已保存。';
  saving.value = false;
}
async function restoreSlot() {
  if (loadingSlot.value) {
    const s = loadingSlot.value;
    loadingSlot.value = null;
    try {
      await store.restore(s);
    } catch (e) {
      notice.value = e instanceof Error ? e.message : '读取失败，请重试。';
    }
  }
}
function resetGame() {
  newRun.value = false;
  void store.reroll();
}
</script>
<template>
  <div class="section-title">
    <div>
      <span class="eyebrow">存档</span>
      <h1>存档管理</h1>
    </div>
  </div>
  <section class="paper">
    <div class="panel-heading">
      <h2>当前进度</h2>
      <span class="file-number">{{ store.game.seed }}</span>
    </div>
    <p class="archive-profile">{{ store.game.profile.campus }} / {{ store.game.profile.major }}</p>
    <div class="archive-meta">
      <span>{{ periodLabel(store.game.turn) }}</span
      ><span>累计游戏时间 {{ elapsed }}</span>
    </div>
    <p class="small muted">{{ store.saveMessage || '已自动保存。' }}</p>
    <div class="archive-buttons">
      <el-button :loading="saving" @click="saveCurrent">立即保存</el-button>
    </div>
    <p v-if="notice" class="notice-line" aria-live="polite">{{ notice }}</p>
  </section>
  <section class="paper">
    <h2>手动存档</h2>
    <div v-for="slot in slots" :key="slot.index" class="save-slot">
      <span class="slot-index">0{{ slot.index }}</span>
      <div class="slot-copy">
        <strong>{{
          slot.state ? slot.state.profile.campus : slot.damaged ? '存档无法读取' : '空白档案'
        }}</strong
        ><span>{{
          slot.state
            ? periodLabel(slot.state.turn) + ' / ' + slot.state.profile.major
            : slot.damaged
              ? '内容已损坏或被改动'
              : '保存当前游戏进度'
        }}</span>
      </div>
      <div class="slot-actions">
        <el-button
          size="small"
          :loading="writing === slot.index"
          :disabled="store.busy || (writing !== 0 && writing !== slot.index)"
          @click="slot.state || slot.damaged ? (overwrite = slot.index) : writeSlot(slot.index)"
          >保存</el-button
        ><el-button
          v-if="slot.state"
          size="small"
          :disabled="store.busy || writing !== 0"
          @click="loadingSlot = slot.state"
          >读取</el-button
        >
      </div>
    </div>
  </section>
  <section class="paper">
    <div class="panel-heading">
      <h2>已达成结局</h2>
      <span class="muted small">{{ collection.length }} 份</span>
    </div>
    <p v-if="!collection.length" class="empty-text">完成游戏后，这里会显示已达成的结局。</p>
    <div v-for="m in collection" :key="m.id" class="memory-row">
      <span>{{ m.number }}</span>
      <div>
        <strong>{{ m.title }}</strong>
        <p>{{ m.seed }}</p>
      </div>
    </div>
  </section>
  <section class="paper">
    <h2>时间与规则</h2>
    <div class="rules-prose">
      <p>
        从大一九月到大四推免季。日常安排持续生效，主动任务按投入天数推进。消息到来时停下处理，尚未完成的工作保留进度。
      </p>
      <p>
        学期成绩按课程和学分计算。能力越高，继续训练的增长越慢。任务最多同时接两项，延期或退出会留下记录。
      </p>
      <p>
        夏令营与预推免结果会留在申请列表。正式系统开放后，需要主动填报志愿、确认复试，再确认一份待录取。学校推荐资格与接收项目考核分别处理。
      </p>
      <p>游戏会自动保存到当前浏览器。事件记录中可以查看已发生的事件。</p>
    </div>
  </section>
  <div class="restart-section">
    <el-button size="large" :disabled="store.busy || writing !== 0" @click="newRun = true"
      >重新开始</el-button
    >
  </div>
  <el-dialog v-model="newRun" title="重新开始" width="min(460px, calc(100vw - 32px))"
    ><p class="dialog-prose">清除当前自动存档，重新生成角色。手动存档保留。</p>
    <template #footer
      ><el-button @click="newRun = false">取消</el-button
      ><el-button type="primary" @click="resetGame">重新开始</el-button></template
    ></el-dialog
  >
  <el-dialog
    :model-value="overwrite > 0"
    title="更新手动档案"
    width="min(460px, calc(100vw - 32px))"
    :close-on-click-modal="writing === 0"
    :show-close="writing === 0"
    @close="overwrite = 0"
    ><p class="dialog-prose">将当前位置 {{ overwrite }} 更新为现在的进度。</p>
    <template #footer
      ><el-button :disabled="writing !== 0" @click="overwrite = 0">保留原档案</el-button
      ><el-button type="primary" :loading="writing !== 0" @click="writeSlot(overwrite)"
        >更新</el-button
      ></template
    ></el-dialog
  >
  <el-dialog
    :model-value="!!loadingSlot"
    title="读取这一份档案"
    width="min(460px, calc(100vw - 32px))"
    @close="loadingSlot = null"
    ><p class="dialog-prose">
      {{ loadingSlot?.profile.campus }}，{{
        loadingSlot ? periodLabel(loadingSlot.turn) : ''
      }}。当前自动进度将更新为这份档案。
    </p>
    <template #footer
      ><el-button @click="loadingSlot = null">留在当前页</el-button
      ><el-button type="primary" @click="restoreSlot">读取</el-button></template
    ></el-dialog
  >
</template>
