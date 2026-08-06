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
    `dl-filter-z4..z1` 是**递减**的层叠顺序，不是装饰性类名：展开的下拉面板必须压住
    它后面那些筛选项（WebF 按子树绘制、z-index 只在同父兄弟间排序）。加/减/重排筛选项
    时这四个类要跟着调，理由与两种层叠模型的判据写在 style.css 的 `.dl-filter-item` 上。
  -->
  <div class="dl-filter-bar">
    <div class="dl-filter-item dl-filter-z4">
      <label class="dl-filter-label">歌单</label>
      <SlSelect
        :model-value="state.filter.playlistId"
        :options="playlistOptions"
        placeholder="全部歌曲"
        aria-label="按歌单筛选"
        @update:model-value="changePlaylist"
      />
    </div>
    <div class="dl-filter-item dl-filter-z3">
      <label class="dl-filter-label">艺术家</label>
      <SlSelect
        v-model="state.filter.artist"
        :options="toOptions(artistOptions)"
        aria-label="按艺术家筛选"
      />
    </div>
    <div class="dl-filter-item dl-filter-z2">
      <label class="dl-filter-label">专辑</label>
      <SlSelect
        v-model="state.filter.album"
        :options="toOptions(albumOptions)"
        aria-label="按专辑筛选"
      />
    </div>
    <div class="dl-filter-item dl-filter-grow dl-filter-z1">
      <label class="dl-filter-label">搜索</label>
      <!--
        `:key` 挂 keywordGen：切歌单清空关键字时（store.js changePlaylist）代数 +1，
        输入框带空值重挂载 —— 原生输入是非受控的，这是外部清空唯一能落到 DOM 的通道
        （机制见 ui/SlInput.vue 注释与主仓 docs/webf/handoff.md 第 25 条）。
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
