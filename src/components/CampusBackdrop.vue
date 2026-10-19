<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { motion } from '../composables/presentation';
const host = ref<HTMLElement | null>(null);
let dispose: (() => void) | undefined,
  revision = 0;
async function render() {
  const ticket = ++revision;
  dispose?.();
  dispose = undefined;
  if (!motion.value || !host.value || document.hidden) return;
  try {
    const { Application, Graphics, Sprite, Assets } = await import('pixi.js');
    if (ticket !== revision) return;
    const app = new Application();
    await app.init({
      resizeTo: window,
      backgroundAlpha: 0,
      antialias: false,
      resolution: Math.min(devicePixelRatio, 1.5),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'low-power',
      autoStart: false,
    });
    if (ticket !== revision) {
      app.destroy(true, { children: true });
      return;
    }
    dispose = () => app.destroy(true, { children: true });
    const texture = await Assets.load(import.meta.env.BASE_URL + 'art/campus-evening.webp');
    if (ticket !== revision) return;
    const scene = new Sprite(texture);
    scene.anchor.set(0.5);
    app.stage.addChild(scene);
    const specks = Array.from({ length: innerWidth < 700 ? 7 : 16 }, (_, i) => {
      const dot = new Graphics()
        .circle(0, 0, i % 3 === 0 ? 1.6 : 0.9)
        .fill({ color: 0xe9cb91, alpha: 0.35 });
      app.stage.addChild(dot);
      return { dot, x: (i * 0.618033) % 1, y: (i * 0.381966) % 1, phase: i * 2.4 };
    });
    let elapsed = 0;
    app.ticker.maxFPS = 24;
    app.ticker.add((t) => {
      elapsed += t.deltaMS / 1000;
      const w = app.screen.width,
        h = app.screen.height,
        scale = Math.max(w / texture.width, h / texture.height) * 1.025;
      scene.scale.set(scale);
      scene.position.set(
        w / 2 + Math.sin(elapsed * 0.035) * 5,
        h / 2 + Math.cos(elapsed * 0.028) * 3,
      );
      for (const p of specks) {
        p.dot.x = p.x * w + Math.sin(elapsed * 0.12 + p.phase) * 18;
        p.dot.y = (p.y * h - elapsed * (2 + (p.phase % 3))) % (h + 20);
        if (p.dot.y < 0) p.dot.y += h + 20;
        p.dot.alpha = 0.15 + Math.sin(elapsed * 0.4 + p.phase) * 0.1;
      }
    });
    host.value?.appendChild(app.canvas);
    app.start();
  } catch {
    dispose?.();
    dispose = undefined;
  }
}
function visibility() {
  if (document.hidden) {
    ++revision;
    dispose?.();
    dispose = undefined;
  } else void render();
}
watch(motion, () => void render());
onMounted(() => {
  void render();
  document.addEventListener('visibilitychange', visibility);
});
onUnmounted(() => {
  ++revision;
  dispose?.();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <div class="campus-backdrop" aria-hidden="true">
    <div ref="host" class="campus-canvas" />
    <div class="campus-shade" />
  </div>
</template>
