<script setup>
// 下拉选择 —— **两条路径都用原生 <select>，刻意不分叉。**
//
// webf_cupertino_ui 的 31 个元素里没有任意选项列表的 select/picker（只有
// date-picker），所以「用 webf-ui 重写」在这一处没有对应物。而 <select> 本身在
// WebF 下是可用的（docs/webf/handoff.md §3.3「已排除的伪阻塞」里明确列了它）。
//
// 后续若要更原生的观感，可以在 WebF 下换成
// flutter-cupertino-button + flutter-cupertino-action-sheet 的组合；本次不做，
// 因为那会引入一个「浏览器分支永远跑不到」的第二套交互，属于文档里反复警告过的
// 双份实现腐化风险。

import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** [{ value, label }]，不含「全部」占位项 */
  options: { type: Array, default: () => [] },
  /** 空值那一项的文案 */
  placeholder: { type: String, default: '全部' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

// 用 v-model 而不是 `:value` + `@change`，是为了拿到 Vue 的 vModelSelect 指令 ——
// 它在 mounted/updated 钩子里设 el.value，**晚于子节点 patch**。裸 `:value` 走的是
// 普通 prop patch，在「选项与选中值同一帧变化」时（换歌单会同时重建艺术家/专辑选项）
// 有可能先设 value、后插 option，导致选中值落空、下拉显示成占位项。
const inner = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<template>
  <select
    v-model="inner"
    class="dl-select"
    :aria-label="ariaLabel || undefined"
  >
    <option value="">{{ placeholder }}</option>
    <option v-for="o in options" :key="o.value" :value="o.value">
      {{ o.label }}
    </option>
  </select>
</template>
