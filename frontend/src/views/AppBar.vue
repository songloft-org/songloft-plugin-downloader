<script setup>
import SlButton from '../ui/SlButton.vue';

// 页面级页头，对齐主程序的 AppBarTheme（elevation:0 / centerTitle:false）——
// surface 底、无阴影、标题左对齐 22px/500。
//
// **刻意不复用宿主 common.css 的 `.app-bar`**：那一份是 M2 风格（--md-primary 底 +
// 阴影 + position:fixed），而且 `html.embed .app-bar { display:none !important }`
// 会在 tab 模式下把它整个隐藏 —— 正是最需要页头的那个模式。
//
// **用普通块盒而不是 position:fixed**：约束 ② 已排除 sticky；fixed 则要额外处理
// `--sl-safe-top`（本插件此前从未用过它），还会让列表高度计算与页头 padding 双重
// 耦合。设置页与主页都不长，页面几乎不滚动，块盒的观感与固定等价。

defineProps({
  title: { type: String, required: true },
  /** 是否显示返回箭头（设置页有，主页没有） */
  back: { type: Boolean, default: false },
  backLabel: { type: String, default: '返回' },
});

defineEmits(['back']);
</script>

<template>
  <div class="dl-appbar">
    <SlButton
      v-if="back"
      class="dl-appbar-back"
      icon-only
      icon="back"
      :label="backLabel"
      @click="$emit('back')"
    />
    <!-- flex:1 让标题吃掉中间空白，把插槽里的操作按钮顶到右侧。
         刻意不用 `margin-left:auto` —— flex 里的自动外边距在 WebF 下没验证过。 -->
    <span class="dl-appbar-title">{{ title }}</span>
    <slot />
  </div>
</template>
