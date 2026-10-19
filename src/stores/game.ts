import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  Ending,
  GameEvent,
  GameState,
  InterviewQuestion,
  Plan,
  PlanKey,
  Program,
  WorkMethod,
} from '../engine/types';
import {
  acknowledge,
  createGame,
  nextTurn,
  resolveChoice,
  selectEvent,
  startPlan,
} from '../engine/game';
import {
  acceptOffer,
  answerInterview,
  beginInterview,
  confirmFormalInterview,
  continueInterview,
  enterFormal,
  prepareMaterials,
  submitApplication,
  withdraw,
} from '../engine/admissions';
import { newSeed } from '../engine/random';
import { PERIODS } from '../engine/world';
import {
  loadChapter,
  loadEnding,
  loadEvent,
  loadPrograms,
  loadQuestion,
} from '../services/content';
import { clearAuto, readAuto, remember, saveAuto } from '../services/storage';
import { prepareVault } from '../services/vault';
import {
  actInLife,
  dropProject,
  ensureLife,
  joinProject,
  setRoutine,
  resumeArrangedWork,
} from '../engine/life';
import { cleanNickname } from '../services/nickname';
export const useGameStore = defineStore('game', () => {
  const game = ref<GameState>(createGame(newSeed())),
    started = ref(false);
  const event = ref<GameEvent | null>(null),
    question = ref<InterviewQuestion | null>(null),
    ending = ref<Ending | null>(null),
    programs = ref<Program[]>([]);
  const syncPaused = ref(false);
  const shareOpen = ref(false);
  const busy = ref(false),
    error = ref(''),
    saveMessage = ref(''),
    savedAt = ref('');
  const loadingAuto = ref(false);
  const tab = ref('day'),
    period = computed(() => PERIODS[game.value.turn]!);
  let revision = 0,
    storageEpoch = 0,
    saveRevision = 0;
  const clone = (): GameState => JSON.parse(JSON.stringify(game.value)) as GameState;
  async function persist() {
    if (!started.value) return;
    if (syncPaused.value) {
      saveMessage.value = '另一页已有更新。选择读取更新或保留本页后继续存档。';
      return;
    }
    const epoch = storageEpoch,
      write = ++saveRevision;
    game.value.updatedAt = new Date().toISOString();
    const snapshot = clone();
    try {
      await saveAuto(snapshot, () => !syncPaused.value && storageEpoch === epoch && started.value);
      if (epoch === storageEpoch && write === saveRevision && !syncPaused.value) {
        savedAt.value = snapshot.updatedAt;
        saveMessage.value = '';
      }
    } catch {
      if (epoch === storageEpoch && write === saveRevision)
        saveMessage.value = '自动保存失败，请检查浏览器的存储空间和站点权限后重试。';
    }
  }
  async function transaction(action: (s: GameState) => void) {
    const next = clone();
    action(next);
    game.value = next;
    await persist();
  }
  function report(e: unknown) {
    error.value = e instanceof Error ? e.message : '这一页尚未读完，请重试。';
  }
  async function hydrate() {
    const ticket = ++revision;
    busy.value = true;
    error.value = '';
    if (event.value?.id !== game.value.eventId) event.value = null;
    const qid = game.value.interview?.questionIds[game.value.interview.at];
    if (question.value?.id !== qid) question.value = null;
    try {
      let currentEvent: GameEvent | null = null,
        currentQuestion: InterviewQuestion | null = null,
        currentEnding: Ending | null = null;
      if (game.value.stage === 'event') {
        if (game.value.eventId) currentEvent = await loadEvent(game.value.eventId);
        else {
          const index = await loadChapter(period.value.chapter);
          if (ticket !== revision) return;
          const next = clone(),
            meta = selectEvent(next, index);
          const loaded = await loadEvent(meta.id);
          if (ticket !== revision) return;
          next.eventId = meta.id;
          game.value = next;
          await persist();
          currentEvent = loaded;
        }
      }
      if (ticket !== revision) return;
      if (game.value.interview)
        currentQuestion = await loadQuestion(
          game.value.interview.questionIds[game.value.interview.at]!,
        );
      if (ticket !== revision) return;
      if (game.value.stage === 'ended' && game.value.endingId) {
        currentEnding = await loadEnding(game.value.endingId);
        if (ticket !== revision) return;
        try {
          await remember({
            id: currentEnding.id,
            number: currentEnding.number,
            title: currentEnding.title,
            seed: game.value.seed,
            date: new Date().toISOString(),
          });
        } catch {
          saveMessage.value = '游戏已结束，结果保存失败，请重试。';
        }
      }
      if (ticket !== revision) return;
      event.value = currentEvent;
      question.value = currentQuestion;
      ending.value = currentEnding;
    } catch (e) {
      if (ticket === revision) report(e);
    } finally {
      if (ticket === revision) busy.value = false;
    }
  }
  async function resumeWork(afterChoice = false) {
    for (let step = 0; step < 8; step++) {
      const state = game.value,
        pending =
          state.stage === 'plan' &&
          state.life?.action &&
          state.life.action.id !== 'routine' &&
          !state.life.deadlinePaused &&
          !state.applications.some((a) =>
            ['interview', 'formalInterview', 'offer'].includes(a.status),
          );
      if (!(afterChoice && step === 0 && state.stage === 'feedback') && !pending) return;
      const index = await loadChapter(period.value.chapter),
        previousTurn = state.turn;
      await transaction((s) => {
        if (s.stage === 'feedback') resumeArrangedWork(s, index);
        else actInLife(s, index, 'continue');
      });
      if (game.value.turn === previousTurn) return;
    }
  }
  async function act(action: (s: GameState) => void, follow = false) {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      await transaction(action);
      if (follow) await resumeWork(true);
      await hydrate();
    } catch (e) {
      report(e);
    } finally {
      busy.value = false;
    }
  }
  async function reroll(seed?: string) {
    if (busy.value || loadingAuto.value) return;
    busy.value = true;
    storageEpoch++;
    try {
      await clearAuto();
    } catch {
      error.value = '无法重新开始，请检查浏览器的存储权限。';
      busy.value = false;
      return;
    }
    syncPaused.value = false;
    revision++;
    game.value = createGame(seed?.trim() || newSeed());
    started.value = false;
    event.value = null;
    question.value = null;
    ending.value = null;
    programs.value = [];
    busy.value = false;
    error.value = '';
    saveMessage.value = '';
    savedAt.value = '';
    tab.value = 'day';
  }
  async function enroll(name: string) {
    if (busy.value || loadingAuto.value) return;
    const nickname = cleanNickname(name);
    if (!nickname) {
      error.value = '昵称需要 2 至 20 个中英文字、数字或常用分隔符。';
      return;
    }
    busy.value = true;
    try {
      await prepareVault();
      ensureLife(game.value);
      game.value.profile.nickname = nickname;
      started.value = true;
      await persist();
    } catch (e) {
      report(e);
      return;
    } finally {
      busy.value = false;
    }
    await move('continue');
  }
  async function restore(state: GameState) {
    busy.value = true;
    try {
      await prepareVault();
      storageEpoch++;
      syncPaused.value = false;
      revision++;
      game.value = JSON.parse(JSON.stringify(state)) as GameState;
      ensureLife(game.value);
      started.value = true;
      event.value = null;
      question.value = null;
      ending.value = null;
      programs.value = [];
      tab.value = 'day';
      await persist();
      await hydrate();
    } finally {
      busy.value = false;
    }
  }
  async function continueAuto() {
    if (loadingAuto.value) return;
    loadingAuto.value = true;
    try {
      const result = await readAuto();
      if (result.state) {
        await restore(result.state);
        if (result.recovered) saveMessage.value = '存档内容异常，已读取上一份完整进度。';
      }
    } catch (e) {
      report(e);
    } finally {
      loadingAuto.value = false;
    }
  }
  async function showPrograms() {
    if (game.value.turn < 32) return;
    try {
      const data = await loadPrograms();
      programs.value = data.map((p) =>
        p.id === 'home'
          ? {
              ...p,
              school: game.value.profile.campus,
              department: `${game.value.profile.major}培养组`,
              major: game.value.profile.major,
            }
          : p,
      );
    } catch (e) {
      report(e);
    }
  }
  async function setTab(value: string) {
    tab.value = value;
    if (value === 'applications') await showPrograms();
  }
  async function move(id: string, method: WorkMethod = 'steady', allowDeadline = false) {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    const ticket = revision;
    let moved = false;
    try {
      const index = await loadChapter(period.value.chapter);
      if (ticket !== revision) return;
      await transaction((s) => actInLife(s, index, id, method, allowDeadline));
      await resumeWork();
      moved = true;
    } catch (e) {
      if (ticket === revision) report(e);
    } finally {
      if (ticket === revision) busy.value = false;
    }
    if (moved) await hydrate();
  }
  const join = (id: string) => act((s) => joinProject(s, id));
  const drop = (id: string) => act((s) => dropProject(s, id));
  const routine = (primary: PlanKey, secondary: PlanKey, pace: 'light' | 'normal' | 'intense') =>
    act((s) => setRoutine(s, primary, secondary, pace));
  const start = (plan: Plan) => act((s) => startPlan(s, plan));
  const choose = (index: number) => {
    const current = event.value;
    if (current) return act((s) => resolveChoice(s, current, index), true);
  };
  const advance = () =>
    act((s) => {
      if (s.stage === 'feedback') acknowledge(s);
      else if (s.stage === 'review') nextTurn(s);
    });
  const prepare = () => (game.value.life ? move('prepare') : act(prepareMaterials));
  const apply = (p: Program) => act((s) => submitApplication(s, p));
  const formal = (id: string) => act((s) => enterFormal(s, id));
  const confirmRetest = (id: string) => act((s) => confirmFormalInterview(s, id));
  const interview = (id: string) => act((s) => beginInterview(s, id));
  const answer = (index: number) => {
    const q = question.value;
    if (q) return act((s) => answerInterview(s, q, index));
  };
  const nextQuestion = () => act(continueInterview);
  const accept = (id: string) => act((s) => acceptOffer(s, id));
  const decline = (id: string) => act((s) => withdraw(s, id));
  function tick(seconds: number) {
    if (started.value && !document.hidden && game.value.stage !== 'ended') {
      game.value.seconds += seconds;
    }
  }
  const setPath = (path: GameState['chosenPath']) =>
    act((s) => {
      s.chosenPath = path;
      s.log.push({
        id: 'path-' + s.turn + '-' + s.log.length,
        turn: s.turn,
        title: '调整后续方向',
        text: '调整了后续准备计划。',
        category: '申请',
      });
    });
  return {
    game,
    started,
    event,
    question,
    ending,
    programs,
    syncPaused,
    shareOpen,
    busy,
    loadingAuto,
    error,
    saveMessage,
    savedAt,
    tab,
    period,
    persist,
    reroll,
    enroll,
    restore,
    continueAuto,
    showPrograms,
    setTab,
    hydrate,
    move,
    join,
    drop,
    routine,
    start,
    choose,
    advance,
    prepare,
    apply,
    formal,
    confirmRetest,
    interview,
    answer,
    nextQuestion,
    accept,
    decline,
    tick,
    setPath,
  };
});
