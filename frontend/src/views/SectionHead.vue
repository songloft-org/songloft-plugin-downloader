<script setup>
// 分组标题行 —— 对齐主程序 SectionCard：标题在**卡片外面上方**，大写小字 labelSmall。
// 文字样式复用宿主 components.css 的 `.section-title`（section_card.dart 同款形制）；
// 外层 `.dl-section-head` 只提供 flex 布局与右侧插槽，并在 style.css 里把 `.section-title`
// 的块级 margin/padding 归零（由 head 统一管间距）。
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
    <span class="section-title">{{ title }}</span>
    <slot />
  </div>
</template>
