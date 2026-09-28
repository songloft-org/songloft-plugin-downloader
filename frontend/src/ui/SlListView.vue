<script setup>
// 纵向滚动列表容器。
//
// 刻意**不接** loadmore / refresh 一类的分页事件：歌单是一次 limit=500 全量拉回的，
// 没有分页，接了只是多一个失败面。
</script>

<template>
  <div class="dl-listview">
    <slot />
  </div>
</template>
