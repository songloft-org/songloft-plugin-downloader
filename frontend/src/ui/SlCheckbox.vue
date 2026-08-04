<script setup>
import { ref } from 'vue';
import { useNativeUI } from '../engine.js';
import { bindNativeProps } from './native-props.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** 无障碍标签。列表展平后复选框失去「所在行」上下文，必须自带。 */
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const el = ref(null);
bindNativeProps(el, () => ({
  checked: props.modelValue,
  disabled: props.disabled,
  // cupertino checkbox 支持 semanticLabel（HTML 属性名是 semantic-label），
  // 这是它对应 aria-label 的入口
  semanticLabel: props.ariaLabel || null,
}));

function onNativeChange(e) {
  emit('update:modelValue', !!e.detail);
}
function onHtmlChange(e) {
  emit('update:modelValue', e.target.checked);
}
</script>

<template>
  <flutter-cupertino-checkbox
    v-if="useNativeUI"
    ref="el"
    class="dl-cb-native"
    @change="onNativeChange"
  />
  <input
    v-else
    type="checkbox"
    class="dl-cb"
    :checked="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel || undefined"
    @change="onHtmlChange"
  />
</template>
