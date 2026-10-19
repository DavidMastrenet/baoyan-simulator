<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { cleanNickname } from '../services/nickname';

const props = withDefaults(
  defineProps<{ modelValue: boolean; busy?: boolean; error?: string; confirmLabel?: string }>(),
  { busy: false, error: '', confirmLabel: '开始游戏' },
);
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [nickname: string] }>();
const nickname = ref(''),
  message = ref(''),
  input = ref<HTMLInputElement | null>(null),
  composing = ref(false),
  id = useId();
const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    if (!props.busy) emit('update:modelValue', value);
  },
});
const formError = computed(() => message.value || props.error);
watch(
  () => props.modelValue,
  (value) => {
    if (value) message.value = '';
  },
);
function focus() {
  input.value?.focus({ preventScroll: true });
  input.value?.select();
}
function submit() {
  if (props.busy || composing.value) return;
  const name = cleanNickname(nickname.value);
  if (!name) {
    message.value = '请输入 2–20 个字，支持中英文、数字和常用分隔符。';
    focus();
    return;
  }
  message.value = '';
  emit('confirm', name);
}
</script>
<template>
  <el-dialog
    v-model="open"
    title="填写昵称"
    width="min(440px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @opened="focus"
  >
    <form class="nickname-form" :aria-busy="busy" @submit.prevent="submit">
      <label :for="id">昵称</label>
      <input
        :id="id"
        ref="input"
        v-model="nickname"
        class="nickname-field"
        maxlength="20"
        autocomplete="off"
        placeholder="2–20 个字"
        :disabled="busy"
        :aria-invalid="!!formError"
        :aria-describedby="formError ? id + '-error' : undefined"
        @input="message = ''"
        @compositionstart="composing = true"
        @compositionend="composing = false"
      />
      <p v-if="formError" :id="id + '-error'" class="nickname-error" role="alert">
        {{ formError }}
      </p>
      <div class="nickname-actions">
        <el-button :disabled="busy" @click="open = false">取消</el-button
        ><el-button native-type="submit" type="primary" :loading="busy">{{
          confirmLabel
        }}</el-button>
      </div>
    </form>
  </el-dialog>
</template>
<style scoped>
.nickname-form {
  display: grid;
  gap: 10px;
  padding-top: 4px;
}
.nickname-form label {
  font-weight: 600;
  color: #2b4c5e;
}
.nickname-field {
  box-sizing: border-box;
  width: 100%;
  min-height: 50px;
  padding: 12px 14px;
  border: 1px solid #b7c8d0;
  border-radius: 4px;
  background: #fff;
  color: #294a5b;
  font: inherit;
  font-size: 18px;
  outline: none;
}
.nickname-field:focus {
  border-color: #397c93;
  box-shadow: 0 0 0 2px #397c9320;
}
.nickname-field[aria-invalid='true'] {
  border-color: #b94343;
}
.nickname-error {
  margin: 0;
  color: #a23737;
  font-size: 14px;
  line-height: 1.7;
}
.nickname-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.nickname-actions .el-button + .el-button {
  margin-left: 0;
}
.nickname-actions .el-button {
  min-width: 100px;
  min-height: 44px;
}
</style>
