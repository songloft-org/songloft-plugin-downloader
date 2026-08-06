<script setup>
import { computed } from 'vue';
import { useNativeUI } from '../engine.js';

// 图标名映射：语义名 → (cupertino 图标名, Material Symbols ligature)。
//
// cupertino 侧共 1322 个名字（webf_cupertino_ui 的 cupertino_icons_map_generated.dart），
// 下面用到的都已逐个确认存在。尺寸与颜色两条路径都由 CSS 控制：
// flutter-cupertino-icon 的实现直接读 renderStyle.fontSize / renderStyle.color
// （icon.dart:58-59），与 Material Symbols 字体图标的行为一致，所以样式无需分叉。
const MAP = {
  settings: ['gear', 'settings'],
  refresh: ['arrow_clockwise', 'refresh'],
  download: ['arrow_down_to_line', 'download'],
  empty: ['slash_circle', 'cloud_off'],
  // 下拉触发按钮的箭头（SlSelect 的 webf-ui 分支）。cupertino 侧 'chevron_down'
  // 已在 map 里核对过；Material Symbols 侧 'expand_more' 由宿主那份 315 KB 的
  // 完整可变字体提供（不是 subset），不会退化成字面文字。
  chevron: ['chevron_down', 'expand_more'],
  // 设置页页头的返回箭头。cupertino 侧 'chevron_left' 已在 map 里核对过。
  back: ['chevron_left', 'arrow_back'],
  // 错误态。'exclamationmark_circle' 同样已核对。
  error: ['exclamationmark_circle', 'error_outline'],
};

const props = defineProps({
  name: { type: String, required: true },
});

const pair = computed(() => MAP[props.name] || ['circle', 'help']);
</script>

<template>
  <flutter-cupertino-icon
    v-if="useNativeUI"
    class="dl-icon"
    :type="pair[0]"
    aria-hidden="true"
  />
  <!--
    Material Symbols 在 WebF 下也是可用的（宿主 plugin_render_fonts.dart 用
    Flutter FontLoader 预注册了 'Material Symbols Outlined'，绕开了 WebF 加载
    woff2 失败的上游缺陷），所以这个分支并非「只在浏览器里能看」。
  -->
  <span v-else class="material-symbols-outlined dl-icon" aria-hidden="true">{{
    pair[1]
  }}</span>
</template>
