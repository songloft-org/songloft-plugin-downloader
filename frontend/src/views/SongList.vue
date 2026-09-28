<script setup>
import { computed } from 'vue';
import StatusView from './StatusView.vue';
import SongRow from './SongRow.vue';
import SlListView from '../ui/SlListView.vue';
import {
  state,
  selected,
  visibleSongs,
  refresh,
  toggleSelect,
} from '../store.js';

const emptyText = computed(() =>
  state.songs.length === 0
    ? '没有可下载的网络歌曲'
    : '当前筛选条件下没有匹配的歌曲',
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
