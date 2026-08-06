<script setup>
import { computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import SlListView from '../ui/SlListView.vue';
import SlCheckbox from '../ui/SlCheckbox.vue';
import StatusView from './StatusView.vue';
import SongRow from './SongRow.vue';
import {
  state,
  selected,
  visibleSongs,
  allVisibleSelected,
  toggleSelect,
  toggleSelectAllVisible,
  refresh,
} from '../store.js';
import { isWide, measureListHeight, pageBottomGap, onResize } from '../layout.js';

const emptyText = computed(() =>
  state.songs.length === 0
    ? '没有可下载的网络歌曲'
    : '当前筛选条件下没有匹配的歌曲',
);

const showList = computed(
  () => !state.songsError && !state.songsLoading && visibleSongs.value.length > 0,
);

// ── 列表高度 ───────────────────────────────────────────────────────────────
//
// CSS 里的 `--dl-list-h` 是**兜底**（保证首帧就满足约束 ⑤：<webf-list-view> 必须有
// 确定高度）。但那套 `calc(100vh - 常量)` 是按标准布局核算的，筛选栏一 wrap、页头有无、
// 进度卡出现都会让它偏 —— 旧版那个手调的 `100vh - 420px` 就低估了约 280px，把表格顶到
// 视口以下。所以以**实测**为权威值。
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

// 任何会改变「列表顶边位置」的东西都要重量：进度卡的出现/消失（约 116px）、
// 表头的出现/消失（窄宽屏切换）、三态之间的切换、筛选栏 wrap 行数变化（跟着 isWide）。
watch(
  () => [showList.value, isWide.value, !!state.progress, state.songsLoading, state.songsError],
  remeasure,
);
</script>

<template>
  <div>
    <!--
      表头只在宽屏出现（窄屏是单行两层的 tile 形态，没有列的概念），
      也只在真的有列表时出现 —— 空态/错误态上方悬一排列名很怪。

      表头刻意**不用 position: sticky**（约束 ②：WebF 下压根不生效），它是列表容器的
      **兄弟**节点，待在纵向滚动区之外，因此不需要「贴住」。

      横向滚动壳（旧版的 .dl-list-wrap + .dl-list-inner，min-width:620px）已**整体删除**：
      主程序的歌曲列表是响应式双布局、从不横滚（song_list_tile.dart 的 LayoutBuilder），
      横滚正是这一页最不像原生的地方。
    -->
    <div v-if="isWide && showList" class="dl-row dl-head">
      <div class="dl-cell dl-col-cb">
        <SlCheckbox
          :model-value="allVisibleSelected"
          aria-label="全选"
          @update:model-value="toggleSelectAllVisible($event)"
        />
      </div>
      <div class="dl-cell dl-col-title">标题</div>
      <div class="dl-cell dl-col-artist">艺术家</div>
      <div class="dl-cell dl-col-album">专辑</div>
      <div class="dl-cell dl-col-source">来源</div>
      <div class="dl-cell dl-col-status">状态</div>
    </div>

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
