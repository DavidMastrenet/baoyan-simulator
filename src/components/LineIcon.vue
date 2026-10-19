<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const paths: Record<string, string> = {
  crest: 'M12 2 21 7v9l-9 6-9-6V7l9-5Zm-6 6 6-3 6 3-6 3-6-3Zm2 3v5l4 3 4-3v-5M12 11v8',
  campus: 'M3 21h18M5 21V9m14 12V9M3 9l9-6 9 6H3Zm6 4v4m6-4v4M10 21v-3h4v3',
  share:
    'M8 12 16 7M8 12l8 5M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14-7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 14a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  chart: 'M4 21V11m8 10V3m8 18V7',
  settings:
    'm9 3-.5 3-2 1L4 6 2 10l2 2v2l-2 2 2 4 2.5-1 2 1 .5 3h5l.5-3 2-1 2.5 1 2-4-2-2v-2l2-2-2-4-2.5 1-2-1L14 3H9Zm7 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  energy: 'm13 2-8 12h6l-1 8 9-13h-6l0-7Z',
  stress: 'M3 12h4l3-8 4 16 3-8h4',
  wallet: 'M4 7V5a2 2 0 0 1 2-2h13v4M3 7h18v14H3V7Zm18 5h-6v4h6m-3-2h.1',
  target: 'M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12l9-9m-5 0h5v5',
  research: 'M9 3h6m-5 0v6l-6 10a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V3M7 15h10',
  craft: 'm8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18',
  work: 'M3 7h18v14H3V7Zm5 0V3h8v4M3 12l9 3 9-3m-9 2v3',
  people:
    'M10 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4 14v-3a6 6 0 0 0-12 0v3m14-18a4 4 0 0 1 0 8m4 10v-3a6 6 0 0 0-4-6',
  english: 'M3 5h10M8 3v2m-3 2c1 5 3 7 8 9M11 5c0 5-3 9-8 11m10 5 5-13 5 13m-8-4h6',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l4 2',
  book: 'M4 4h6a3 3 0 0 1 2 2v15a4 4 0 0 0-4-2H4V4Zm16 0h-6a3 3 0 0 0-2 2v15a4 4 0 0 1 4-2h4V4Z',
  day: 'M5 4h14v17H5V4Zm3-2v4m8-4v4M5 9h14M8 13h3m3 0h2m-8 4h3',
  growth: 'M4 20h17M6 16v-5m6 5V6m6 10V3',
  applications: 'M3 6h18v14H3V6Zm0 0 9 7 9-7M8 3h8',
  history: 'M4 6v5h5M4 11a8 8 0 1 1 1 6m7-11v6l4 2',
  archive: 'M5 8h14v13H5V8ZM3 3h18v5H3V3Zm6 9h6',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  check: 'M5 12l4 4L19 6',
  leaf: 'M19 4C8 3 3 8 5 15s14 7 14-11ZM6 19 16 9',
  location: 'M12 22s8-9 8-14A8 8 0 0 0 4 8c0 5 8 14 8 14Zm0-17a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  refresh: 'M20 7V2l-3 3A8 8 0 0 0 4 9m0 8v5l3-3a8 8 0 0 0 13-4',
  close: 'm5 5 14 14M19 5 5 19',
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] ?? paths.book" />
  </svg>
</template>
