<script setup>
import { state } from '../store.js';

// 刻意**不复用** common.css 的 .snackbar：那一份是
//   position: fixed; left: 50%; transform: translateX(-50%) translateY(100px)
// 依赖 transform 定位。这里改成「left/right 拉满 + 内层 margin auto」居中，
// 显隐用 v-if，全程不碰 transform —— 不依赖任何 transform 行为，稳妥。
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
