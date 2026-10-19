<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch, ref } from 'vue';
import { gsap } from 'gsap';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { useGameStore } from './stores/game';
import { PERIODS } from './engine/world';
import { currentDate } from './engine/calendar';
import { motion, sound, playClick } from './composables/presentation';
import { isAutoStorageKey } from './services/vault';
import CampusBackdrop from './components/CampusBackdrop.vue';
import LineIcon from './components/LineIcon.vue';
import EnrollmentView from './components/EnrollmentView.vue';
import StatusStrip from './components/StatusStrip.vue';
import DayView from './components/DayView.vue';
import GrowthView from './components/GrowthView.vue';
import ApplicationsView from './components/ApplicationsView.vue';
import ChronicleView from './components/ChronicleView.vue';
import ArchiveView from './components/ArchiveView.vue';
import InterviewDialog from './components/InterviewDialog.vue';
import ShareDialog from './components/ShareDialog.vue';
import SharedGameView from './components/SharedGameView.vue';
const store = useGameStore(),
  main = ref<HTMLElement | null>(null),
  otherTab = ref(false),
  settingsOpen = ref(false),
  screenMessage = ref('');
const sharedToken = ref(new URLSearchParams(location.search).get('share') ?? '');
const nav = [
  { id: 'day', name: '校园生活', short: '校园', icon: 'campus' },
  { id: 'growth', name: '成绩能力', short: '成绩', icon: 'growth' },
  { id: 'applications', name: '升学申请', short: '申请', icon: 'applications' },
  { id: 'history', name: '生涯记录', short: '记录', icon: 'history' },
  { id: 'archive', name: '存档管理', short: '存档', icon: 'archive' },
];
const pending = computed(
  () =>
    store.game.applications.filter((a) =>
      ['interview', 'formalInterview', 'offer'].includes(a.status),
    ).length,
);
const year = computed(() => PERIODS[store.game.turn]!.year);
let clock: ReturnType<typeof setInterval>,
  saveClock: ReturnType<typeof setInterval>,
  animation: gsap.core.Tween | undefined;
function onHide() {
  if (store.started) void store.persist();
}
function changed(e: StorageEvent) {
  if (isAutoStorageKey(e.key) && store.started) {
    otherTab.value = true;
    store.syncPaused = true;
  }
}
function closeShared() {
  sharedToken.value = '';
  if (!store.started) void store.continueAuto();
}
function click(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button,summary')) playClick();
}
function keyboard(e: KeyboardEvent) {
  if (
    !store.started ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey ||
    e.repeat ||
    document.querySelector('.el-overlay:not([style*="display: none"])') ||
    (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"],.el-select')
  )
    return;
  const i = Number(e.key) - 1;
  if (i >= 0 && i < nav.length) {
    e.preventDefault();
    void store.setTab(nav[i]!.id);
  }
}
async function fullscreen() {
  screenMessage.value = '';
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else screenMessage.value = '当前浏览器不支持全屏。';
  } catch {
    screenMessage.value = '当前浏览器未开启全屏。';
  }
}
if (!sharedToken.value) void store.continueAuto();
onMounted(() => {
  clock = setInterval(() => store.tick(1), 1000);
  saveClock = setInterval(() => {
    if (store.started && !document.hidden) store.persist();
  }, 15000);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('storage', changed);
  window.addEventListener('keydown', keyboard);
  document.addEventListener('click', click);
});
onUnmounted(() => {
  clearInterval(clock);
  clearInterval(saveClock);
  animation?.kill();
  window.removeEventListener('pagehide', onHide);
  window.removeEventListener('storage', changed);
  window.removeEventListener('keydown', keyboard);
  document.removeEventListener('click', click);
});
watch(
  () => [store.tab, store.game.stage, store.game.eventId, store.started],
  async () => {
    if (animation) {
      const previous = animation.targets();
      animation.kill();
      gsap.set(previous, { clearProps: 'transform,opacity' });
    }
    await nextTick();
    window.scrollTo({ top: 0, behavior: 'instant' });
    main.value?.focus({ preventScroll: true });
    if (motion.value && main.value) {
      animation = gsap.fromTo(
        Array.from(main.value.querySelectorAll('.campus-stage,.paper,.game-alert')).slice(0, 12),
        { opacity: 0.4, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.38,
          stagger: 0.025,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      );
    }
  },
);
</script>
<template>
  <el-config-provider :locale="zhCn">
    <CampusBackdrop />
    <div class="game-shell" :class="{ 'in-session': store.started && !sharedToken }">
      <header class="site-header">
        <div class="header-inner">
          <div class="game-brand">
            <span class="brand-crest"><LineIcon name="crest" :size="24" /></span
            ><strong>保研模拟器</strong>
          </div>
          <div v-if="store.started" class="header-profile">
            <span class="profile-indicator" /><strong>{{ store.game.profile.campus }}</strong
            ><span>{{ store.game.profile.major }}</span>
          </div>
          <div class="header-actions">
            <button
              v-if="store.started && !sharedToken"
              class="utility-button share-control"
              :disabled="store.busy"
              @click="store.shareOpen = true"
            >
              <LineIcon name="share" :size="16" /><span>分享进度</span></button
            ><button
              class="utility-button icon-button"
              title="游戏设置"
              aria-label="游戏设置"
              @click="settingsOpen = true"
            >
              <LineIcon name="settings" :size="19" />
            </button>
          </div>
        </div>
      </header>
      <div v-if="store.error && !store.game.interview" class="global-message" role="alert">
        <span>{{ store.error }}</span
        ><el-button
          size="small"
          :loading="store.busy || store.loadingAuto"
          @click="store.started ? store.hydrate() : store.continueAuto()"
          >重试</el-button
        ><button class="text-button" @click="store.error = ''">关闭</button>
      </div>
      <div v-if="store.saveMessage" class="global-message" role="status">
        {{ store.saveMessage }}<el-button size="small" @click="store.persist()">重试保存</el-button>
      </div>
      <div v-if="otherTab" class="global-message" role="status">
        <span>其他页面保存了新进度。</span
        ><el-button
          size="small"
          @click="
            otherTab = false;
            store.continueAuto();
          "
          >读取新进度</el-button
        ><button
          class="text-button"
          @click="
            otherTab = false;
            store.syncPaused = false;
            store.persist();
          "
        >
          保存当前进度
        </button>
      </div>
      <SharedGameView v-if="sharedToken" :token="sharedToken" @close="closeShared" />
      <main v-else-if="store.loadingAuto" class="enrollment shared-view">
        <section class="paper" aria-busy="true">
          <p role="status">正在读取存档</p>
          <el-skeleton :rows="4" />
        </section>
      </main>
      <EnrollmentView v-else-if="!store.started" />
      <div v-else class="workspace">
        <nav class="main-nav" aria-label="主要页面">
          <button
            v-for="item in nav"
            :key="item.id"
            :class="{ active: store.tab === item.id }"
            :aria-current="store.tab === item.id ? 'page' : undefined"
            @click="store.setTab(item.id)"
          >
            <span class="nav-symbol"
              ><LineIcon :name="item.icon" :size="23" /><b
                v-if="item.id === 'applications' && pending"
                >{{ pending }}</b
              ></span
            ><span class="nav-name">{{ item.name }}</span
            ><span class="nav-short">{{ item.short }}</span>
          </button>
        </nav>
        <div class="game-calendar">
          <div>
            <strong>{{ currentDate(store.game) }}</strong
            ><span class="calendar-theme">{{ store.period.theme }}</span>
          </div>
          <div class="year-track" aria-label="大学学年">
            <span
              v-for="(label, i) in ['大一', '大二', '大三', '大四']"
              :key="label"
              :class="{ past: year > i + 1, current: year === i + 1 }"
              ><i />{{ label }}</span
            >
          </div>
        </div>
        <main ref="main" class="main-column" tabindex="-1">
          <StatusStrip /><DayView v-if="store.tab === 'day'" /><GrowthView
            v-else-if="store.tab === 'growth'"
          /><ApplicationsView v-else-if="store.tab === 'applications'" /><ChronicleView
            v-else-if="store.tab === 'history'"
          /><ArchiveView v-else />
        </main>
      </div>
    </div>
    <InterviewDialog /><ShareDialog />
    <el-dialog v-model="settingsOpen" title="游戏设置" width="min(480px, calc(100vw - 24px))">
      <div class="setting-row">
        <div><strong>场景与动效</strong><span>动态校园背景和面板切换</span></div>
        <el-switch v-model="motion" aria-label="场景与动效" />
      </div>
      <div class="setting-row">
        <div><strong>操作音效</strong><span>点击和确认时播放短音</span></div>
        <el-switch v-model="sound" aria-label="操作音效" />
      </div>
      <div class="setting-row">
        <div><strong>全屏游戏</strong><span>显示更多游戏内容</span></div>
        <el-button @click="fullscreen">切换全屏</el-button>
      </div>
      <p v-if="screenMessage" role="status" class="small muted">{{ screenMessage }}</p>
      <div class="keyboard-guide">
        <span>键盘快捷键</span>
        <p><kbd>1</kbd> 至 <kbd>5</kbd> 切换左侧页面</p>
      </div>
    </el-dialog>
    <footer class="site-footer">Copyright 2026 YuX@SHNU</footer>
  </el-config-provider>
</template>
