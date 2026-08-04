<script setup>
import SlButton from '../ui/SlButton.vue';
import {
  selected,
  refresh,
  toggleSelectAllVisible,
  startDownload,
} from '../store.js';
</script>

<template>
  <div class="dl-toolbar">
    <SlButton
      variant="tinted"
      size="small"
      label="全选"
      @click="toggleSelectAllVisible()"
    />
    <SlButton
      variant="tinted"
      size="small"
      icon="refresh"
      label="刷新"
      @click="refresh"
    />
    <div class="dl-toolbar-spacer" />
    <span class="dl-toolbar-info">已选 {{ selected.size }} 首</span>
    <SlButton
      variant="filled"
      size="small"
      icon="download"
      label="下载选中"
      :disabled="selected.size === 0"
      @click="startDownload"
    />
  </div>
</template>
