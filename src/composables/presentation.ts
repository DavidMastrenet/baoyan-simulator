import { ref, watch } from 'vue';
import { readValue, setValue } from '../services/vault';
export const motion = ref(!matchMedia('(prefers-reduced-motion: reduce)').matches);
export const sound = ref(false);
let hydrated = false;
for (const [key, value] of [
  ['motion', motion],
  ['sound', sound],
] as const) {
  watch(
    value,
    (v) => {
      if (hydrated) void setValue('setting:' + key, v).catch(() => {});
      document.documentElement.setAttribute('data-' + key, String(v));
    },
    { immediate: true, flush: 'sync' },
  );
}
void (async () => {
  try {
    const values = await Promise.all([
      readValue<unknown>('setting:motion'),
      readValue<unknown>('setting:sound'),
    ]);
    if (typeof values[0] === 'boolean') motion.value = values[0];
    if (typeof values[1] === 'boolean') sound.value = values[1];
  } catch {
  } finally {
    hydrated = true;
  }
})();
let audio: AudioContext | undefined;
export function playClick(important = false) {
  if (!sound.value) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const at = audio.currentTime,
      osc = audio.createOscillator(),
      gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(important ? 520 : 740, at);
    osc.frequency.exponentialRampToValueAtTime(important ? 780 : 520, at + 0.07);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.035, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.1);
  } catch {}
}
