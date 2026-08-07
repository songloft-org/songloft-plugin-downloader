<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import SlCheckbox from '../ui/SlCheckbox.vue';
import SlIcon from '../ui/SlIcon.vue';
import { coverUrl, acquireCoverSlot } from '../covers.js';

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

// 真实封面：带 access_token 的 endpoint URL，直接喂 `<img src>`（见 covers.js）。
// 无封面（cover_url 为空）时为 ''，保持占位图标。
//
// 并发闸门：WebF 的 <img> 赋 src 即发真实请求且无并发上限，故先申请槽位、拿到才赋 src，
// load/error 或行卸载时释放槽位（见 covers.js 头注释）。native ListView 回收会卸载本行，
// onUnmounted 里释放；未拿到槽位则退队。
const coverSrc = ref('');
let slot = null;

function releaseSlot() {
  if (slot) {
    slot.release();
    slot = null;
  }
}

onMounted(() => {
  const url = coverUrl(props.song);
  if (!url) return; // 无封面，不占槽位
  slot = acquireCoverSlot();
  slot.promise.then(() => {
    coverSrc.value = url;
  });
});

onUnmounted(releaseSlot);

// 图片 load/error 后归还槽位，放行队列下一行。error（如 404）额外回落占位图标避免裂图。
function onCoverLoad() {
  releaseSlot();
}
function onCoverError() {
  coverSrc.value = '';
  releaseSlot();
}
</script>

<template>
  <div class="dl-row">
    <!-- 与主程序 SongTile 的 leading 复选框保持 32px 槽位，避免封面和标题随控件实现漂移。 -->
    <div class="dl-row-checkbox">
      <SlCheckbox
        class="dl-row-cb"
        :model-value="checked"
        :aria-label="`选择 ${song.title}`"
        @update:model-value="emit('toggle', song.id, $event)"
      />
    </div>

    <!-- 封面：拿到真实封面显示 <img>，否则圆角方块 + 类型图标占位（对齐主程序 leading） -->
    <div class="dl-cover">
      <img v-if="coverSrc" class="dl-cover-img" :src="coverSrc" :alt="song.title" @load="onCoverLoad" @error="onCoverError" />
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
