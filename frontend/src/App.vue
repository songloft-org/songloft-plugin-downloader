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
  goMain,
} from './store.js';
import { applyMode, installLayout } from './layout.js';
import { isWebFRuntime } from './engine.js';

/**
 * 把「插件内还有上一级页面」这件事告诉宿主，让**硬件返回键**也能先退回主页。
 *
 * ── 为什么不用 history.pushState ──────────────────────────────────────────
 *
 * WebF 不实现 SPA history 路由（官方方案是 `@openwebf/*-router` 的原生屏栈）。而宿主
 * WebF 链路的返回键是这么走的：`PopScope` → `goBackIfPossible()` → methodChannel
 * `requestBack` → common.js 判断 **`history.length > 1`** → `history.back()` → 回报
 * 「已消费」。所以一旦 pushState，宿主就认定返回键已被消费，可 WebF 又不 fire
 * `popstate` —— 页面毫无变化，**返回键变成死键**（既回不去也退不出）。
 *
 * 宿主为此提供了 `SongloftPlugin.onHostBack`：优先级在 history 判断之前，返回 true
 * 表示本次返回由页面消费。不碰 history，没有死键风险。
 *
 * ── 只对 WebF 生效，这是上游的形状 ────────────────────────────────────────
 *
 * 宿主的 `registerWebFBackHandler` 有 `isWebFHost()` 闸门；系统 WebView / iframe /
 * 浏览器三条链路的宿主走各自 `controller.canGoBack()`，那是真实浏览历史，JS 侧拦不到。
 * 那些环境下硬件 / 浏览器返回键会直接离开插件页 —— 与重构前（单页插件）的行为一致，
 * 不是回退。**页头上的返回按钮在所有模式下都在**，功能不缺。
 * 刻意不为那三条链路补 pushState + popstate：收益只是「返回键顺带能用」，代价是
 * 双压历史 / 状态错位一整类新问题，不值当。
 */
function installBackIntegration() {
  if (!isWebFRuntime) return;
  const P = window.SongloftPlugin;
  // 老客户端的 common.js 可能还没有这个钩子 —— 优雅降级成「只有页头返回按钮」。
  if (!P || typeof P.onHostBack !== 'function') return;
  P.onHostBack(() => {
    if (state.page !== 'main') {
      goMain();
      return true;
    }
    return false;
  });
}

onMounted(() => {
  // 判定打开方式要在 mount 之后：`window.webf` / `window.flutter_inappwebview` 的
  // 注入时序没有契约，`<head>` 同步阶段问 `host.isAvailable()` 不可靠。
  applyMode();
  installLayout();
  installBackIntegration();

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
      `.dl-page-overlay`）。以前是 v-if 两级页面，切到设置会把整张主页（含
      `<webf-list-view>` 与全部歌曲行）同一帧卸载，而 WebF 的大规模拆除会留下
      已 dispose 却仍被引用的 render object：同帧 paint 访问到（object.dart 的
      `!_debugDisposed`）、样式对象失去 render box（transform.dart 的 `hasRenderBox()`）、
      MouseTracker 的 hit test 打到它们 —— 异常在 `_deviceUpdatePhase` 内抛出后
      `_debugDuringDeviceUpdate` 永久置位，每帧刷断言、帧循环烂掉、整页白屏
      （2026-08-05 实测；输入框那条同源链见主仓 docs/webf/handoff.md 第 25 条）。
      改覆盖层后：打开设置是**纯挂载**（无任何拆除），关闭设置只卸载设置页那几件
      控件 —— 与下拉面板开合同规模，后者从未出事。
      附带收益：主页的滚动位置与筛选状态不再因进出设置而丢失。
    -->
    <MainPage />
  </div>
  <SettingsPage v-if="state.page === 'settings'" />
  <Snackbar />
</template>
