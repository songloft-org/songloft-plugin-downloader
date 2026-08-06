<script setup>
import { computed } from 'vue';

// 图标：语义名 → Material Symbols ligature。
//
// **单一 HTML 实现**（2026-08 混合重构）：不再走 <flutter-cupertino-icon> 双分支。
// Material Symbols 在 WebF 下也可用——宿主 plugin_render_fonts.dart 用 Flutter
// FontLoader 预注册了 'Material Symbols Outlined'（绕开 WebF 加载 woff2 失败的上游
// 缺陷），字体由宿主那份完整可变字体提供（非 subset），不会退化成字面文字。
// 尺寸/颜色由 CSS（.dl-icon + 落点的 color/font-size）控制。
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
