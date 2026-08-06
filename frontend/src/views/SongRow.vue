<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import SlCheckbox from '../ui/SlCheckbox.vue';
import SlIcon from '../ui/SlIcon.vue';
import { loadCover } from '../covers.js';

// 歌曲行：**统一的 ListTile 形态**（2026-08 重做，对齐主程序 SongTile）。
// 不再有「宽屏多列表格 / 窄屏两层」双布局——所有宽度都是单行：
//   复选框 + 48 封面占位 + [标题 / 艺术家·专辑·来源] + 状态。
//
// ⚠️ WebF 约束（style.css 文件头）：
//   · 横向 flex 行合规；竖排两层文本用**块流**（.dl-title/.dl-sub 都是 block），
//     不是竖向 flex（约束 ⑧：flex 套 flex 整个子树不绘制）。
//   · 复选框(WidgetElement)与封面被块盒包一层，不直接当 flex item（约束 ⑦）。
//   · 标题/副标题 nowrap + ellipsis（约束 ①：可换行 CJK 在 min-content 下被按每字一行
//     测量）。

const props = defineProps({
  song: { type: Object, required: true },
  checked: { type: Boolean, default: false },
  /** 下载结果：{ status: 'ok' | 其它 } | undefined */
  status: { type: Object, default: null },
});
const emit = defineEmits(['toggle']);

const source = computed(() => props.song.plugin_entry_path || 'URL');

// 封面占位图标：远程歌曲用 cloud，其余 music（对齐主程序 CoverImage.placeholderIcon）。
const coverIcon = computed(() => (props.song.type === 'remote' ? 'cloud' : 'music'));

// 副标题：艺术家 · 专辑 · 来源。空段过滤掉，避免前导 " · "（后端 artist 列
// NOT NULL DEFAULT ''，拿到的是空串不是 null）。来源放最后，nowrap 从右截断先丢最次要的。
const subtitle = computed(() =>
  [props.song.artist, props.song.album, source.value].filter(Boolean).join(' · '),
);

const statusText = computed(() => {
  if (!props.status) return '';
  return props.status.status === 'ok' ? '已下载' : '失败';
});

// 真实封面：带鉴权 fetch → data: URL（见 covers.js）。拿到前/失败时保持占位图标。
// native ListView 回收时行会卸载，onUnmounted 里 cancel 退队；缓存命中则重挂载零请求。
const coverSrc = ref('');
let coverReq = null;

onMounted(() => {
  coverReq = loadCover(props.song);
  coverReq.promise
    .then((src) => {
      if (src) coverSrc.value = src;
    })
    .catch(() => {
      // 保持占位图标，不打断整行渲染
    });
});

onUnmounted(() => {
  if (coverReq) coverReq.cancel();
});
</script>

<template>
  <div class="dl-row">
    <SlCheckbox
      class="dl-row-cb"
      :model-value="checked"
      :aria-label="`选择 ${song.title}`"
      @update:model-value="emit('toggle', song.id, $event)"
    />

    <!-- 封面：拿到真实封面显示 <img>，否则圆角方块 + 类型图标占位（对齐主程序 leading） -->
    <div class="dl-cover">
      <img v-if="coverSrc" class="dl-cover-img" :src="coverSrc" :alt="song.title" />
      <SlIcon v-else :name="coverIcon" />
    </div>

    <!-- 标题 + 副标题，块流两层（约束 ⑧） -->
    <div class="dl-main">
      <div class="dl-title" :title="song.title">{{ song.title }}</div>
      <div class="dl-sub" :title="subtitle">{{ subtitle }}</div>
    </div>

    <span
      v-if="statusText"
      class="dl-status-tag"
      :class="status.status === 'ok' ? 'dl-ok' : 'dl-fail'"
    >{{ statusText }}</span>
  </div>
</template>
