<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import { createShare } from '../services/share';
const store = useGameStore(),
  busy = ref(false),
  error = ref(''),
  url = ref(''),
  expires = ref(0),
  copied = ref(false);
const ending = computed(() => store.game.stage === 'ended');
watch(
  () => store.shareOpen,
  (open) => {
    if (open) {
      error.value = '';
      url.value = '';
      copied.value = false;
    }
  },
);
async function generate() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const result = await createShare(store.game, ending.value ? 'ending' : 'progress');
    url.value = result.url;
    expires.value = result.expiresAt;
  } catch (e) {
    error.value = e instanceof Error ? e.message : '链接创建失败，请重试。';
  } finally {
    busy.value = false;
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(url.value);
    copied.value = true;
  } catch {
    copied.value = false;
    error.value = '请选中下方链接并复制。';
  }
}
</script>
<template>
  <el-dialog
    v-model="store.shareOpen"
    :title="ending ? '分享结局' : '分享当前进度'"
    width="min(500px, calc(100vw - 24px))"
  >
    <p class="small muted">{{ ending ? '有效期30天' : '有效期30分钟' }}</p>
    <template v-if="url"
      ><el-input
        :model-value="url"
        readonly
        aria-label="分享链接"
        @focus="($event.target as HTMLInputElement).select()"
      />
      <p class="small muted">有效至 {{ new Date(expires).toLocaleString('zh-CN') }}</p>
      <el-button type="primary" @click="copy">{{
        copied ? '已复制' : '复制链接'
      }}</el-button></template
    >
    <p v-if="error" role="alert" class="reason-text">{{ error }}</p>
    <template #footer
      ><el-button @click="store.shareOpen = false">关闭</el-button
      ><el-button v-if="!url" type="primary" :loading="busy" @click="generate"
        >生成链接</el-button
      ></template
    >
  </el-dialog>
</template>
