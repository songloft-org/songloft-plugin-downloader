<script setup>
import { computed } from 'vue';
import { state } from '../store.js';

// 进度条用宿主 components.css 的 .progress-linear/.progress-linear-bar（与主程序一致），
// CSS 的 width% + transition 在 WebF 下可用。
const pct = computed(() => {
  const p = state.progress;
  if (!p || !p.total) return 0;
  return Math.min(100, Math.max(0, (p.current / p.total) * 100));
});
</script>

<template>
  <!--
    用 v-if 而不是 CSS 切显隐：WebF 下把内联 style.display 写回空串不可靠，而
    display:none 的元素在 WebF 里仍会挂一个 0 尺寸的 RenderConstrainedBox。
    条件渲染没有这两个问题。
  -->
  <div v-if="state.progress" class="card dl-card">
    <div class="dl-card-body">
      <div class="dl-prog-header">
        <span>批量下载中...</span>
        <span class="dl-prog-num">{{ state.progress.current }}/{{ state.progress.total }}</span>
      </div>
      <div class="progress-linear">
        <div class="progress-linear-bar" :style="{ width: pct + '%' }" />
      </div>
      <div class="dl-prog-stats">
        <span>成功: <span class="dl-ok">{{ state.progress.success }}</span></span>
        <span>失败: <span class="dl-fail">{{ state.progress.failed }}</span></span>
      </div>
    </div>
  </div>
</template>
