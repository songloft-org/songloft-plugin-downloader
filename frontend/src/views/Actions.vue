<script setup>
import { computed } from 'vue';
import SlButton from '../ui/SlButton.vue';
import {
  selected,
  refresh,
  toggleSelectAllVisible,
  startDownload,
  goSettings,
} from '../store.js';

// 顶栏动作区（对齐客户端曲库/歌单详情页：操作收进顶栏，不再单占一行工具栏）。
//
// ── 双落点 ────────────────────────────────────────────────────────────────
// 这一组按钮在 tab/browser 模式落在自绘页头（AppBar 右侧插槽），fullscreen 模式
// 宿主已自绘 AppBar（显示插件名）、插件不画页头，于是整组落到一条右对齐的动作行
// （.dl-action-row）。挂载位置由 MainPage 按 mode 决定，两处是同一组按钮。
//
// 「已选 N 首」不再单列文字：数量并进「下载」按钮的 label（0 时禁用、显示「下载」，
// >0 时显示「下载 N」），既省一处空间又让主操作自带选中反馈。
//
// 组件多根（fragment）：这些按钮直接作为页头/动作行 flex 容器的子项排布。
// 图标按钮是 .dl-btn-icon（inline-block，约束⑧安全）；filled 的下载按钮是宿主
// .btn（inline-flex），在 flex 容器里需降级 inline-block —— 由 style.css 的
// `.dl-appbar .btn / .dl-action-row .btn` 覆盖（与旧 .dl-toolbar>.btn 同理）。
const downloadLabel = computed(() =>
  selected.size > 0 ? `下载 ${selected.size}` : '下载',
);
</script>

<template>
  <SlButton icon-only icon="refresh" label="刷新" @click="refresh" />
  <SlButton icon-only icon="selectAll" label="全选" @click="toggleSelectAllVisible()" />
  <SlButton
    variant="filled"
    icon="download"
    :label="downloadLabel"
    :disabled="selected.size === 0"
    @click="startDownload"
  />
  <SlButton icon-only icon="settings" label="下载设置" @click="goSettings" />
</template>
