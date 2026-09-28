<script setup>
import { computed } from 'vue';
import SlSelect from '../ui/SlSelect.vue';
import SlInput from '../ui/SlInput.vue';
import { state, artistOptions, albumOptions, changePlaylist, keywordGen } from '../store.js';

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
  <!--
    `dl-filter-z4..z1` 是**递减**的层叠顺序，不是装饰性类名：展开时后面的筛选项
    与前面的浮层互有叠放约定。加/减/重排筛选项时这四个类要跟着调。
  -->
  <div class="dl-filter-bar">
    <div class="dl-filter-item dl-filter-z4">
      <SlSelect
        :model-value="state.filter.playlistId"
        :options="playlistOptions"
        placeholder="歌单"
        aria-label="按歌单筛选"
        @update:model-value="changePlaylist"
      />
    </div>
    <div class="dl-filter-item dl-filter-z3">
      <SlSelect
        v-model="state.filter.artist"
        :options="toOptions(artistOptions)"
        placeholder="艺术家"
        aria-label="按艺术家筛选"
      />
    </div>
    <div class="dl-filter-item dl-filter-z2">
      <SlSelect
        v-model="state.filter.album"
        :options="toOptions(albumOptions)"
        placeholder="专辑"
        aria-label="按专辑筛选"
      />
    </div>
    <div class="dl-filter-item dl-filter-grow dl-filter-z1">
      <!--
        `:key` 挂 keywordGen：切歌单清空关键字时（store.js changePlaylist）代数 +1，
        输入框带空值重挂载 —— 避免外部改值把光标推到末尾。
      -->
      <SlInput
        :key="'dl-kw-' + keywordGen"
        v-model="state.filter.keyword"
        placeholder="标题 / 艺术家 / 专辑"
        aria-label="关键字搜索"
      />
    </div>
  </div>
</template>
