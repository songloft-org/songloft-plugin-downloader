<script setup>
// **单一 HTML 实现**：统一用宿主 components.css 的 `.switch` 结构，与主程序
// M3 Switch 一致。track/thumb 是标准 <span> + `var(--md-*)`，CSS 变量自动跟随
// 主题，无需任何 JS。
//
// ⚠️ 宿主 `.switch` 三条写法（display:inline-block + flex-shrink:0、把手 transform:
//    translateX、选中态 `~` 兄弟选择器）是对齐 miot 已验证可用的写法，勿改。
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

function onChange(e) {
  emit('update:modelValue', e.target.checked);
}
</script>

<template>
  <label class="switch">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || undefined"
      @change="onChange"
    />
    <span class="switch-track"></span>
    <span class="switch-thumb"></span>
  </label>
</template>
