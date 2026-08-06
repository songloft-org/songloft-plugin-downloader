<script setup>
// 分组标题行 —— 对齐主程序 SectionCard 的形制：标题在**卡片外面上方**，
// 全大写 + letter-spacing 1.5 的 11px labelSmall。
// （section_card.dart:26-39；宿主 common.css 的 `.card-title` 是卡内 16px，不是这个。）
//
// 插槽用于右侧操作（主页 fullscreen 模式下的齿轮就落在这里 —— 那个模式宿主已经有
// AppBar，插件不画页头，齿轮需要另一个落点）。

defineProps({
  title: { type: String, required: true },
});
</script>

<template>
  <div class="dl-section-head">
    <!-- flex:1 顶开右侧插槽，理由同 AppBar（不依赖 flex 的自动外边距） -->
    <span class="dl-section-title">{{ title }}</span>
    <slot />
  </div>
</template>
