<script setup>
import { onMounted, onUnmounted } from 'vue';
import SettingsCard from './views/SettingsCard.vue';
import ProgressCard from './views/ProgressCard.vue';
import FilterBar from './views/FilterBar.vue';
import Toolbar from './views/Toolbar.vue';
import SongList from './views/SongList.vue';
import Snackbar from './views/Snackbar.vue';
import {
  loadSettings,
  loadPlaylists,
  loadSongs,
  checkActiveDownload,
  stopPolling,
} from './store.js';

onMounted(() => {
  loadSettings();
  loadPlaylists();
  loadSongs();
  // 刷新页面不丢进度：若服务端还有跑着的批次就续上轮询
  checkActiveDownload();
});

onUnmounted(stopPolling);
</script>

<template>
  <div class="dl-container">
    <SettingsCard />
    <ProgressCard />
    <div class="card dl-card">
      <FilterBar />
      <Toolbar />
      <SongList />
    </div>
  </div>
  <Snackbar />
</template>
