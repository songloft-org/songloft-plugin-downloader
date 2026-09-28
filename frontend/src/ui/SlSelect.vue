<script setup>
// 下拉选择。原生 `<select>` 在浏览器与系统 WebView 下完全正常，且是无障碍与
// 键盘操作最好的形态。
</script>

<script>
const props = defineProps({
  modelValue: { type: String, default: '' },
  /** [{ value, label }]，不含「全部」占位项 */
  options: { type: Array, default: () => [] },
  /** 空值那一项的文案 */
  placeholder: { type: String, default: '全部' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

function onChange(e) {
  const node = e && e.target;
  if (node) emit('update:modelValue', node.value == null ? '' : node.value);
}
</script>

<template>
  <select
    class="dl-select"
    :value="modelValue"
    :aria-label="ariaLabel || undefined"
    @change="onChange"
  >
    <option value="">{{ placeholder }}</option>
    <option v-for="o in options" :key="o.value" :value="o.value">
      {{ o.label }}
    </option>
  </select>
</template>
