<script setup>
import AppBar from './AppBar.vue';
import SectionHead from './SectionHead.vue';
import ProgressCard from './ProgressCard.vue';
import FilterBar from './FilterBar.vue';
import Toolbar from './Toolbar.vue';
import SongList from './SongList.vue';
import SlButton from '../ui/SlButton.vue';
import { goSettings } from '../store.js';
import { mode } from '../layout.js';

// 主页：列表是页面主体，设置收进齿轮（跳独立设置页）。
//
// ── 齿轮的双落点 ──────────────────────────────────────────────────────────
//
// tab / browser 模式插件自绘页头，齿轮放页头右侧；
// fullscreen 模式宿主已经有 AppBar（插件名 / 返回 / 关闭 / 在浏览器打开）且插件动不了它，
// 于是插件不画页头 —— 那时齿轮落到「待下载歌曲」组标题行的右端。
// 两处是同一个按钮，只是挂载位置由 mode 决定，保证三种模式下设置都进得去。
</script>

<template>
  <div>
    <AppBar v-if="mode !== 'fullscreen'" title="歌曲下载">
      <SlButton icon-only icon="settings" label="下载设置" @click="goSettings" />
    </AppBar>

    <ProgressCard />

    <SectionHead title="待下载歌曲">
      <SlButton
        v-if="mode === 'fullscreen'"
        icon-only
        icon="settings"
        label="下载设置"
        @click="goSettings"
      />
    </SectionHead>

    <!--
      主体卡**不加 `overflow: hidden`**（因此也没照抄原生 SectionCard 的
      clipBehavior: antiAlias）：筛选栏的下拉浮层是 position:absolute，祖先链上任何
      overflow:hidden 都会把它在那个盒子边界整段切掉。而这里本来也没有需要裁剪的东西
      —— 卡内子节点的背景都是透明的（继承卡片底色），唯一有独立底色的表头不在卡片
      首尾边缘（上面还有筛选栏与工具栏）。详见 style.css 的 .dl-card 注释。
    -->
    <div class="card dl-card">
      <FilterBar />
      <Toolbar />
      <SongList />
    </div>
  </div>
</template>
