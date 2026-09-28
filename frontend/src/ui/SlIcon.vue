<script setup>
import { computed } from 'vue';

// 图标：语义名 → Material Symbols ligature。
//
// Material Symbols 字体由宿主提供。尺寸/颜色由 CSS（.dl-icon + 落点的
// color/font-size）控制。
const MAP = {
  settings: 'settings',
  refresh: 'refresh',
  download: 'download',
  selectAll: 'select_all',
  empty: 'cloud_off',
  chevron: 'expand_more',
  back: 'arrow_back',
  error: 'error_outline',
  // 歌曲行封面占位图标（对齐主程序 CoverImage 的 placeholderIcon）。
  cloud: 'cloud',
  music: 'music_note',
};

const props = defineProps({
  name: { type: String, required: true },
});

const glyph = computed(() => MAP[props.name] || 'help');
</script>

<template>
  <span class="material-symbols-outlined dl-icon" aria-hidden="true">{{ glyph }}</span>
</template>
