<script setup>
import SlButton from '../ui/SlButton.vue';

// 页面级页头，对齐主程序的 AppBarTheme（elevation:0 / centerTitle:false）——
// surface 底、无阴影、标题左对齐，使用 Material 3 titleLarge（22px/400/28px）。
//
// **刻意不复用宿主 common.css 的 `.app-bar`**：那一份是 M2 风格（--md-primary 底 +
// 阴影 + position:fixed），而且 `html.embed .app-bar { display:none !important }`
// 会在 tab 模式下把它整个隐藏 —— 正是最需要页头的那个模式。
//
// **组件本身保持普通块盒**：主页直接参与常规布局；设置页由 SettingsPage 的固定外壳
// 承载它，组件无需感知打开方式或滚动容器，也不会把 fixed 逻辑带到主页列表高度计算中。

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
