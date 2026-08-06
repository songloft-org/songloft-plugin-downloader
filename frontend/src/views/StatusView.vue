<script setup>
import SlIcon from '../ui/SlIcon.vue';
import SlButton from '../ui/SlButton.vue';

// 加载 / 空 / 错误三态，形制照抄主程序的 LoadingIndicator、EmptyState、ErrorView
// （songloft-player/lib/shared/widgets/）。
//
// **整体是块流 + text-align:center，不是竖向 flex**（约束 ⑧：竖向堆叠一律块流）。
// 旧版的 `.dl-empty` 是全文件唯一一处 `flex-direction:column`，而且它的子项里有
// WidgetElement 直接当 flex item —— 同时踩在约束 ⑦ 与 ⑧ 的射程上，只是侥幸没出事。

defineProps({
  /** 'loading' | 'empty' | 'error' */
  variant: { type: String, required: true },
  title: { type: String, default: '' },
  detail: { type: String, default: '' },
  /** 是否显示重试按钮 */
  retry: { type: Boolean, default: false },
  retryLabel: { type: String, default: '重试' },
});

defineEmits(['retry']);
</script>

<template>
  <div class="dl-status">
    <!-- 加载：36px 转圈 + 文案（LoadingIndicator 的形制）。
         转圈是 CSS @keyframes；WebF 下是否真的动没有验证过，**不动也无妨** ——
         退化成一个带主色缺口的静态圆环，仍然读得出「正在加载」，不是坏掉的样子。 -->
    <div v-if="variant === 'loading'" class="dl-spinner" />

    <!-- 空态：96px 圆底（primary 12%→4% 渐变）+ 48px 主色图标。
         圆底用 line-height 做垂直居中，不用 flex。 -->
    <div v-else-if="variant === 'empty'" class="dl-status-orb">
      <SlIcon name="empty" />
    </div>

    <!-- 错误态：64px error 色图标，无圆底（ErrorView 的形制） -->
    <div v-else class="dl-status-err">
      <SlIcon name="error" />
    </div>

    <p v-if="title" class="dl-status-title">{{ title }}</p>
    <p v-if="detail" class="dl-status-detail">{{ detail }}</p>
    <div v-if="retry" class="dl-status-action">
      <SlButton variant="filled" icon="refresh" :label="retryLabel" @click="$emit('retry')" />
    </div>
  </div>
</template>
