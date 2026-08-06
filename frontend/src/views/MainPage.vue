<script setup>
import AppBar from './AppBar.vue';
import ProgressCard from './ProgressCard.vue';
import FilterBar from './FilterBar.vue';
import SongList from './SongList.vue';
import Actions from './Actions.vue';
import { mode } from '../layout.js';

// 主页：列表是页面主体，操作全部收进顶栏（对齐客户端曲库/歌单详情页），
// 不再有单独的工具栏行与「待下载歌曲」组标题 —— 把顶部尽量压扁，给列表让位。
//
// ── 动作区的双落点（由 Actions.vue 承载，见其注释）──────────────────────────
//
// tab / browser 模式插件自绘页头，标题「歌曲下载」在左、动作区在右侧插槽；
// fullscreen 模式宿主已有 AppBar（显示插件名）且插件动不了它，于是不画页头，
// 动作区落到一条右对齐的独立动作行。两处是同一组 <Actions />。
</script>

<template>
  <div>
    <AppBar v-if="mode !== 'fullscreen'" title="歌曲下载">
      <Actions />
    </AppBar>
    <div v-else class="dl-action-row">
      <Actions />
    </div>

    <ProgressCard />

    <!--
      主体**平铺、不套卡片**（对齐客户端：筛选栏 + 分隔线 + 列表直接铺在页面 surface
      上，无 surface-container 灰底圆角盒）。`.dl-body` 不给背景/边框/圆角，也刻意不加
      `overflow: hidden`：筛选栏下拉浮层是 position:absolute，祖先链上任何
      overflow:hidden 都会把它整段切掉。
    -->
    <div class="dl-body">
      <FilterBar />
      <SongList />
    </div>
  </div>
</template>
