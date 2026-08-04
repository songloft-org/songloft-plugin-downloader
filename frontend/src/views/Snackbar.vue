<script setup>
import { state } from '../store.js';

// 刻意**不复用** common.css 的 .snackbar：那一份是
//   position: fixed; left: 50%; transform: translateX(-50%) translateY(100px)
// 而实测 **WebF 不对 position: fixed 的元素应用 transform 位移**（miot 插件曾因此
// 让一个遮罩永久盖在首页上）。在 WebF 下那个 snackbar 会停在 left:50% 处、
// 且不做入场位移。
//
// 这里改成「left/right 拉满 + 内层 margin auto」居中，显隐用 v-if + opacity，
// 全程不碰 transform，三条渲染路径行为一致。
</script>

<template>
  <div v-if="state.snackbar" class="dl-snackbar-layer">
    <div
      class="dl-snackbar"
      :class="state.snackbar.type ? `dl-snackbar-${state.snackbar.type}` : ''"
      role="status"
    >
      {{ state.snackbar.text }}
    </div>
  </div>
</template>
