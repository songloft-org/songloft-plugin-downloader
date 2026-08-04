<script setup>
import { computed } from 'vue';
import SlCheckbox from '../ui/SlCheckbox.vue';

// 一行 = 6 个用 flex 排的单元格。
//
// **刻意用 flex 而不是 CSS Grid。** 旧版用双 grid 容器共享 grid-template-columns，
// 那条路上踩到 WebF 的 grid `auto` 行高缺陷（在 min-content 宽度下测量子项高度，
// CJK 每个字都是断行点 → 实测一行 281px，自然高只有 41px）。flex 行不经过那段
// 测量逻辑，列宽由 CSS 变量在表头与行之间共享（见 style.css 的 --dl-col-*）。
//
// 行是真实的行元素（不像旧版把单元格展平成 grid 子项），所以整行 hover 与
// 「选择这一行」的无障碍上下文都回来了。

const props = defineProps({
  song: { type: Object, required: true },
  checked: { type: Boolean, default: false },
  /** 下载结果：{ status: 'ok' | 其它 } | undefined */
  status: { type: Object, default: null },
});
const emit = defineEmits(['toggle']);

const source = computed(() => props.song.plugin_entry_path || 'URL');
const statusText = computed(() => {
  if (!props.status) return '';
  return props.status.status === 'ok' ? '已下载' : '失败';
});
</script>

<template>
  <div class="dl-row">
    <div class="dl-cell dl-col-cb">
      <SlCheckbox
        :model-value="checked"
        :aria-label="`选择 ${song.title}`"
        @update:model-value="emit('toggle', song.id, $event)"
      />
    </div>
    <!--
      单元格保留 nowrap + ellipsis，长内容全文放 title 属性。
      这不只是观感取舍：可换行的 CJK 文本在 WebF 的若干测量路径上会被算成
      「每字一行」，nowrap 让 min-content == max-content，从根上避开那类问题。
    -->
    <div class="dl-cell dl-col-title" :title="song.title">{{ song.title }}</div>
    <div class="dl-cell dl-col-artist" :title="song.artist || ''">
      {{ song.artist || '' }}
    </div>
    <div class="dl-cell dl-col-album" :title="song.album || ''">
      {{ song.album || '' }}
    </div>
    <div class="dl-cell dl-col-source" :title="source">
      <span class="dl-source-chip">{{ source }}</span>
    </div>
    <div class="dl-cell dl-col-status">
      <span v-if="statusText" :class="status.status === 'ok' ? 'dl-ok' : 'dl-fail'">
        {{ statusText }}
      </span>
    </div>
  </div>
</template>
