<script setup>
// 纵向滚动列表容器。
//
// WebF 分支用 <webf-list-view> —— 它是 **webf 包内建**的元素
// （src/html/listview.dart，标签名 WEBF-LISTVIEW 与 WEBF-LIST-VIEW 两个别名都注册了），
// 不依赖 webf_cupertino_ui，直接映射到 Flutter 的 ListView，自带 view 回收。
// 这也是本次重写绕开旧版最狠那两个坑的关键：
//   · grid `auto` 行高在 min-content 宽度下测量（CJK 每字都是断行点 → 实测一行 281px）
//   · position: sticky 全局不生效
// 走 ListView 之后行高由 Flutter 排版决定，跟 CSS grid 那套测量逻辑无关。
//
// ⚠️ 两条硬约束：
//
//   ① **列表项必须是本元素的直接子节点** —— Flutter ListView 靠此做回收。
//      Vue 的 <slot/> 不产生包裹元素，所以调用方写
//      `<SlListView><Row v-for=.../></SlListView>` 就是对的；**不要**在中间套 div。
//
//   ② **shrink-wrap 默认是 true，必须显式关掉**。true 时列表高度等于内容总高、
//      不在内部滚动，几百行会一路撑下去。关掉之后必须给它**确定的高度**
//      （见 style.css 的 .dl-listview），不能留无界约束 —— WebF 在无界约束下
//      解析 flex 会触发 `Infinity or NaN toInt`。
//
// 刻意**不接** loadmore / refresh 事件与 finishLoad / finishRefresh 方法：
// 歌曲是一次 limit=500 全量拉回的，没有分页，接了只是多一个失败面。将来若改分页，
// onLoadMore 里**必须**调 finishLoad('success'|'noMore'|'fail')，否则加载指示器
// 会永久转圈。
import { useNativeListView } from '../engine.js';
</script>

<template>
  <webf-list-view
    v-if="useNativeListView"
    class="dl-listview"
    shrink-wrap="false"
    scroll-direction="vertical"
  >
    <slot />
  </webf-list-view>
  <div v-else class="dl-listview">
    <slot />
  </div>
</template>
