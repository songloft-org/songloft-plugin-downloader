<script setup>
import { onMounted, onUnmounted } from 'vue';
import MainPage from './views/MainPage.vue';
import SettingsPage from './views/SettingsPage.vue';
import Snackbar from './views/Snackbar.vue';
import {
  state,
  loadSettings,
  loadPlaylists,
  loadSongs,
  checkActiveDownload,
  stopPolling,
} from './store.js';

// 打开方式（tab / fullscreen / browser）的判定在 `layout.js` 的 detectMode()：
// fullscreen 与 browser 的 URL 逐字节相同，唯一可靠判据是
// `SongloftPlugin.host.isAvailable()`。调用点必须放在 mount 之后 ——
// `window.flutter_inappwebview` 的注入时序没有契约。
import { applyMode, installLayout } from './layout.js';

onMounted(() => {
  applyMode();
  installLayout();

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
    <!--
      主页**始终挂载**，设置页是全屏覆盖层（见 SettingsPage.vue 与 style.css 的
      `.dl-page-overlay`）。覆盖层形态的附带收益：主页的滚动位置与筛选状态
      不因进出设置而丢失。
    -->
    <MainPage />
  </div>
  <SettingsPage v-if="state.page === 'settings'" />
  <Snackbar />
</template>
