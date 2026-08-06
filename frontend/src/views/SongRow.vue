<script setup>
import { computed } from 'vue';
import SlCheckbox from '../ui/SlCheckbox.vue';
import { isWide } from '../layout.js';

// 一行 = 用 flex 排的若干单元格。**响应式双布局**，照抄主程序
// `song_list_tile.dart:51-62`：窄屏（<600）单行两层「标题 / 艺术家·专辑·来源」，
// 宽屏多列表格。旧版那个 `min-width:620px` + `overflow-x:auto` 的横向滚动已删除
// —— 主程序的歌曲列表从不横滚。
//
// **刻意用 flex 而不是 CSS Grid。** 旧版用双 grid 容器共享 grid-template-columns，
// 那条路上踩到 WebF 的 grid `auto` 行高缺陷（在 min-content 宽度下测量子项高度，
// CJK 每个字都是断行点 → 实测一行 281px，自然高只有 41px）。flex 行不经过那段测量逻辑。
//
// ⚠️ 窄屏那两层文字是**块流**（`.dl-row-title` / `.dl-row-sub` 都是 block），不是竖向
// flex —— 约束 ⑧：flex 容器里再套 flex 容器会整个子树不绘制。这里的形状是
// 「flex 行 → 块盒单元格 → 块流文本」，合规。所有 WidgetElement（复选框）也都被块盒
// `.dl-cell` 包了一层，没有直接当 flex item（约束 ⑦）。
//
// 切结构用 v-if 而不是媒体查询 + display:none（约束 ④）。

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

// 窄屏副标题。空段直接过滤掉，避免出现前导的 " · "（同主程序 SongTile._subtitleText
// 处理 artist 为空串的那段 —— 后端该列 NOT NULL DEFAULT ''，拿到的是空串不是 null）。
// 来源放在最后：nowrap + ellipsis 从右侧截断，先丢掉的是最次要的信息。
const subtitle = computed(() =>
  [props.song.artist, props.song.album, source.value].filter(Boolean).join(' · '),
);
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
    <template v-if="isWide">
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
    </template>

    <div v-else class="dl-cell dl-col-main">
      <div class="dl-row-title" :title="song.title">{{ song.title }}</div>
      <div class="dl-row-sub" :title="subtitle">{{ subtitle }}</div>
    </div>

    <div class="dl-cell dl-col-status">
      <span v-if="statusText" :class="status.status === 'ok' ? 'dl-ok' : 'dl-fail'">
        {{ statusText }}
      </span>
    </div>
  </div>
</template>
