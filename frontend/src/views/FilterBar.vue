<script setup>
import { computed } from 'vue';
import SlSelect from '../ui/SlSelect.vue';
import SlInput from '../ui/SlInput.vue';
import { state, artistOptions, albumOptions, changePlaylist } from '../store.js';

// 歌单是**服务端**筛选（换了要重新拉歌），艺术家/专辑/关键字是纯客户端筛选。
const playlistOptions = computed(() =>
  state.playlists.map((p) => ({
    value: String(p.id),
    label: `${p.name} (${p.song_count})`,
  })),
);

const toOptions = (values) => values.map((v) => ({ value: v, label: v }));
</script>

<template>
  <div class="dl-filter-bar">
    <div class="dl-filter-item">
      <label class="dl-filter-label">歌单</label>
      <SlSelect
        :model-value="state.filter.playlistId"
        :options="playlistOptions"
        placeholder="全部歌曲"
        aria-label="按歌单筛选"
        @update:model-value="changePlaylist"
      />
    </div>
    <div class="dl-filter-item">
      <label class="dl-filter-label">艺术家</label>
      <SlSelect
        v-model="state.filter.artist"
        :options="toOptions(artistOptions)"
        aria-label="按艺术家筛选"
      />
    </div>
    <div class="dl-filter-item">
      <label class="dl-filter-label">专辑</label>
      <SlSelect
        v-model="state.filter.album"
        :options="toOptions(albumOptions)"
        aria-label="按专辑筛选"
      />
    </div>
    <div class="dl-filter-item dl-filter-grow">
      <label class="dl-filter-label">搜索</label>
      <SlInput
        v-model="state.filter.keyword"
        placeholder="标题 / 艺术家 / 专辑"
        aria-label="关键字搜索"
      />
    </div>
  </div>
</template>
