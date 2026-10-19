<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PlanKey } from '../engine/types';
import LineIcon from './LineIcon.vue';
type Activity = { id: PlanKey; title: string; days: number; description: string; cost?: number };
const props = defineProps<{ activities: Activity[]; disabled: boolean; budget: number }>();
const emit = defineEmits<{ choose: [id: PlanKey] }>();
const selected = ref<PlanKey>('study');
const sites: Record<PlanKey, { name: string; icon: string; x: number; y: number }> = {
  study: { name: '图书馆', icon: 'book', x: 17, y: 23 },
  english: { name: '外语楼', icon: 'english', x: 50, y: 17 },
  research: { name: '实验室', icon: 'research', x: 83, y: 23 },
  craft: { name: '机房', icon: 'craft', x: 14, y: 51 },
  social: { name: '活动中心', icon: 'people', x: 50, y: 49 },
  practice: { name: '实践基地', icon: 'work', x: 85, y: 54 },
  work: { name: '勤工岗位', icon: 'wallet', x: 18, y: 80 },
  rest: { name: '运动场', icon: 'moon', x: 50, y: 80 },
  prepare: { name: '教务楼', icon: 'archive', x: 82, y: 81 },
};
const current = computed(
  () => props.activities.find((a) => a.id === selected.value) ?? props.activities[0],
);
const trees = [
  [53, 58, 14],
  [65, 94, 11],
  [283, 58, 12],
  [308, 94, 14],
  [440, 42, 11],
  [667, 67, 14],
  [676, 148, 10],
  [56, 180, 12],
  [245, 160, 12],
  [455, 147, 13],
  [474, 227, 11],
  [678, 270, 14],
  [60, 330, 13],
  [247, 328, 11],
  [441, 339, 12],
  [650, 349, 10],
];
</script>
<template>
  <div class="campus-explorer">
    <div class="campus-map">
      <svg
        class="campus-plan"
        viewBox="0 0 720 390"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <g id="map-tree">
            <ellipse cy="7" rx="15" ry="7" fill="#9bb7a5" opacity=".2" />
            <path d="M0 0v14" stroke="#8b9b83" stroke-width="4" />
            <circle cy="-3" r="14" fill="#a5c3a6" />
            <circle cx="-4" cy="-8" r="10" fill="#bdd2b1" />
          </g>
          <g id="map-block">
            <path d="M-58-19 42-34 61-14-40 2Z" fill="#8ca9b0" />
            <path d="M-40 2 61-14v48L-40 49Z" fill="#e9efeb" />
            <path d="M-58-19-40 2v47l-18-23Z" fill="#bfd0cb" />
            <path
              d="m-27 10 73-11m-73 22 73-11m-73 22 73-11"
              stroke="#99b6ba"
              stroke-width="5"
              stroke-dasharray="7 6"
            />
            <path d="M-5 30v13l17-2V27Z" fill="#789da4" />
          </g>
        </defs>
        <rect width="720" height="390" rx="18" fill="#e9f0e8" />
        <path
          d="M0 284 720 120M345 0 351 390M3 125 717 307"
          stroke="#fff"
          stroke-width="35"
          opacity=".6"
        />
        <path d="M0 284 720 120M345 0 351 390M3 125 717 307" stroke="#d6dfd6" stroke-width="22" />
        <path d="M0 284 720 120M345 0 351 390M3 125 717 307" stroke="#e8e9de" stroke-width="17" />
        <ellipse cx="358" cy="205" rx="67" ry="37" fill="#c9d7cd" />
        <ellipse cx="358" cy="200" rx="57" ry="30" fill="#f6f7e9" />
        <ellipse cx="358" cy="199" rx="30" ry="17" fill="#9dc5c5" />
        <ellipse cx="358" cy="195" rx="21" ry="11" fill="#c1dcdc" />
        <path d="M358 194v-25" stroke="#d9eded" stroke-width="3" />
        <rect
          x="288"
          y="277"
          width="142"
          height="83"
          rx="40"
          fill="#b7c9b4"
          stroke="#d9e4d7"
          stroke-width="4"
        />
        <rect x="300" y="287" width="118" height="63" rx="30" stroke="#edf2df" stroke-width="2" />
        <rect
          x="319"
          y="293"
          width="80"
          height="52"
          rx="2"
          fill="#9fbe9e"
          stroke="#eff4e1"
          stroke-width="2"
        />
        <path d="M359 293v52" stroke="#eff4e1" stroke-width="2" />
        <circle cx="359" cy="319" r="10" stroke="#eff4e1" stroke-width="2" />
        <use href="#map-block" transform="translate(125 87)" />
        <use href="#map-block" transform="translate(354 59) scale(.9)" />
        <use href="#map-block" transform="translate(593 91) scale(1.1)" />
        <use href="#map-block" transform="translate(107 198) scale(.85)" />
        <use href="#map-block" transform="translate(603 225) scale(.9)" />
        <use href="#map-block" transform="translate(133 319) scale(.8)" />
        <use href="#map-block" transform="translate(580 327) scale(.85)" />
        <g
          v-for="(t, i) in trees"
          :key="i"
          :transform="`translate(${t[0]} ${t[1]}) scale(${t[2]! / 14})`"
        >
          <use href="#map-tree" />
        </g>
        <path
          d="m224 248 12-2m253-57 12-2M296 127l11 3m202 167 10 3"
          stroke="#acbcb1"
          stroke-width="5"
          stroke-linecap="round"
        />
      </svg>
      <button
        v-for="a in activities"
        :key="a.id"
        class="map-site"
        :class="{ selected: current?.id === a.id }"
        :style="{ left: sites[a.id].x + '%', top: sites[a.id].y + '%' }"
        :aria-pressed="current?.id === a.id"
        :disabled="disabled"
        @click="selected = a.id"
      >
        <LineIcon :name="sites[a.id].icon" :size="17" /><span>{{ sites[a.id].name }}</span>
      </button>
    </div>
    <div v-if="current" class="map-action" :key="current.id">
      <span class="map-action-emblem"><LineIcon :name="sites[current.id].icon" :size="31" /></span>
      <h3>{{ current.title }}</h3>
      <p>{{ current.description }}</p>
      <div class="map-action-duration">
        <LineIcon name="clock" :size="16" /><strong
          >{{ current.days }} 天<span v-if="current.cost">
            / 交通 {{ current.cost }} 元</span
          ></strong
        >
      </div>
      <el-button
        type="primary"
        :disabled="disabled || budget < (current.cost ?? 0)"
        @click="emit('choose', current.id)"
        >{{ budget < (current.cost ?? 0) ? '余额不足' : '开始这项行动'
        }}<LineIcon name="arrow" :size="17"
      /></el-button>
    </div>
  </div>
</template>
