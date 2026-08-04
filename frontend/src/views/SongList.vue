<script setup>
import { computed } from 'vue';
import SlListView from '../ui/SlListView.vue';
import SlCheckbox from '../ui/SlCheckbox.vue';
import SlIcon from '../ui/SlIcon.vue';
import SongRow from './SongRow.vue';
import {
  state,
  selected,
  visibleSongs,
  allVisibleSelected,
  toggleSelect,
  toggleSelectAllVisible,
} from '../store.js';

const emptyText = computed(() =>
  state.songs.length === 0
    ? '没有可下载的网络歌曲'
    : '当前筛选条件下没有匹配的歌曲',
);
</script>

<template>
  <!--
    结构：横向滚动壳 → 表头（列表容器的**兄弟**节点）+ 列表容器。
    表头刻意不放进滚动容器里，也不用 position: sticky —— sticky 在 WebF 下压根
    不生效（实测：页面级最标准的配置也会整量滚走）。让表头待在纵向滚动区之外，
    它就不需要「贴住」。横向滚动必须包住表头与列表两者，否则横滚到右侧会错列。
  -->
  <div class="dl-list-wrap">
    <div class="dl-list-inner">
      <div class="dl-row dl-head">
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

      <!-- SongRow 必须是 SlListView 的直接子节点（Flutter ListView 的回收要求） -->
      <SlListView v-if="visibleSongs.length">
        <SongRow
          v-for="s in visibleSongs"
          :key="s.id"
          :song="s"
          :checked="selected.has(s.id)"
          :status="state.dlStatus[s.id] || null"
          @toggle="toggleSelect"
        />
      </SlListView>

      <div v-else class="dl-empty">
        <SlIcon name="empty" />
        <p>{{ emptyText }}</p>
      </div>
    </div>
  </div>
</template>
