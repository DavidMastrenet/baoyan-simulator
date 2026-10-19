import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [vue(), Components({ resolvers: [ElementPlusResolver()], dts: 'src/components.d.ts' })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { 'vue-core': ['vue', 'pinia'], 'motion-core': ['gsap'] } },
    },
  },
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api/': { target: 'http://127.0.0.1:8081' } } },
});
