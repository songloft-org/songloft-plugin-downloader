<script setup>
import { computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import SlListView from '../ui/SlListView.vue';
import StatusView from './StatusView.vue';
import SongRow from './SongRow.vue';
import {
  state,
  selected,
  visibleSongs,
  refresh,
  toggleSelect,
} from '../store.js';
import { measureListHeight, pageBottomGap, onResize } from '../layout.js';

const emptyText = computed(() =>
  state.songs.length === 0
    ? '没有可下载的网络歌曲'
    : '当前筛选条件下没有匹配的歌曲',
);

// ── 列表高度 ───────────────────────────────────────────────────────────────
//
// CSS 里的 `--dl-list-h` 是**兜底**（保证首帧就满足约束 ⑤：<webf-list-view> 必须有
// 确定高度）。但那套 `calc(100vh - 常量)` 是按标准布局核算的，筛选栏一 wrap、页头有无、
// 进度卡出现都会让它偏，所以以**实测**为权威值。
//
// 用 querySelector 而不是模板 ref：SlListView 的根在两条引擎分支间切换
// （<webf-list-view> / <div>），拿组件实例的 $el 在 WebF 下语义没验证过；
// 全页同时只存在一个 .dl-listview，选择器是最确定的拿法。
const MEASURE_RETRIES = 6;

function measure(attempt) {
  const el = document.querySelector('.dl-listview');
  if (measureListHeight(el, pageBottomGap())) return;
  // WebF 是异步渲染的：首帧可能还没 layout，getBoundingClientRect().top 是 0。
  // 退避重试；全都失败也不要紧 —— CSS 兜底值仍在，列表只是没那么贴合视口。
  const n = attempt || 0;
  if (n < MEASURE_RETRIES) {
    setTimeout(function () {
      measure(n + 1);
    }, 32 * (n + 1));
  }
}

function remeasure() {
  nextTick(function () {
    measure(0);
  });
}

let offResize = null;

onMounted(() => {
  remeasure();
  offResize = onResize(() => measure(0));
});

onUnmounted(() => {
  if (offResize) offResize();
});

// 任何会改变「列表顶边位置」的东西都要重量：进度卡的出现/消失、三态之间的切换、
// 筛选栏 wrap 行数变化（随视口宽度）。列表结构不再随宽窄切换，故不再 watch isWide。
watch(
  () => [!!state.progress, state.songsLoading, state.songsError, visibleSongs.value.length > 0],
  remeasure,
);
</script>

<template>
  <div>
    <!-- 错误优先于列表：失败时 state.songs 保留着上一次的旧数据，
         显示陈旧列表会让用户以为刷新成功了。 -->
    <StatusView
      v-if="state.songsError"
      variant="error"
      title="加载歌曲失败"
      :detail="state.songsError"
      retry
      @retry="refresh"
    />

    <StatusView v-else-if="state.songsLoading" variant="loading" title="正在加载歌曲…" />

    <!-- SongRow 必须是 SlListView 的直接子节点（Flutter ListView 的回收要求） -->
    <SlListView v-else-if="visibleSongs.length">
      <SongRow
        v-for="s in visibleSongs"
        :key="s.id"
        :song="s"
        :checked="selected.has(s.id)"
        :status="state.dlStatus[s.id] || null"
        @toggle="toggleSelect"
      />
    </SlListView>

    <StatusView v-else variant="empty" :title="emptyText" />
  </div>
</template>
