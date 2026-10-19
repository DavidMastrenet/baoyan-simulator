<script setup lang="ts">
import { useGameStore } from '../stores/game';
const store = useGameStore();
</script>
<template>
  <el-dialog
    :model-value="!!store.game.interview"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    width="min(660px, calc(100vw - 24px))"
    class="interview-dialog"
    title="面试现场"
  >
    <template v-if="store.game.interview"
      ><div class="interview-progress">
        <span>第 {{ store.game.interview.at + 1 }} 问 / 共 3 问</span
        ><span>{{ store.question?.kind }}</span>
      </div>
      <template v-if="store.question"
        ><h2>{{ store.question.title }}</h2>
        <p class="interview-prompt" :lang="store.question.kind === '英语' ? 'en' : 'zh-CN'">
          {{ store.question.text }}
        </p>
        <template v-if="!store.game.interview.feedback"
          ><div class="choices interview-choices">
            <button
              v-for="(answer, i) in store.question.options"
              :key="i"
              class="choice"
              :disabled="store.busy"
              @click="store.answer(i)"
            >
              <span class="choice-index">{{ String.fromCharCode(65 + i) }}</span
              ><span class="choice-copy"
                ><strong>{{ answer.text }}</strong></span
              >
            </button>
          </div></template
        >
        <div v-else class="interview-feedback" aria-live="polite">
          <span class="eyebrow">回答结果</span>
          <p>{{ store.game.interview.feedback }}</p>
          <el-button
            type="primary"
            size="large"
            :loading="store.busy"
            @click="store.nextQuestion()"
            >{{ store.game.interview.at === 2 ? '结束面试' : '继续下一问' }}</el-button
          >
        </div></template
      >
      <el-skeleton v-else :rows="4" />
      <div v-if="store.error" class="inline-error">
        <p>{{ store.error }}</p>
        <el-button @click="store.hydrate()">重新读取</el-button>
      </div>
    </template>
  </el-dialog>
</template>
