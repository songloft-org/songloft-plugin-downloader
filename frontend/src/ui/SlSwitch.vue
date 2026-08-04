<script setup>
import { ref } from 'vue';
import { useNativeUI } from '../engine.js';
import { bindNativeProps } from './native-props.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

const el = ref(null);
bindNativeProps(el, () => ({
  checked: props.modelValue,
  disabled: props.disabled,
}));

// cupertino 的 change 事件把新值放在 event.detail（CustomEvent('change', detail: bool)）
function onNativeChange(e) {
  emit('update:modelValue', !!e.detail);
}

function onHtmlChange(e) {
  emit('update:modelValue', e.target.checked);
}
</script>

<template>
  <flutter-cupertino-switch
    v-if="useNativeUI"
    ref="el"
    class="dl-switch-native"
    @change="onNativeChange"
  />
  <!--
    非 WebF 分支：自绘 M3 风格开关。刻意不复用 common.css 的 .switch/.switch-track
    —— 那套依赖特定的 DOM 嵌套，改动它的结构风险高于自己写这十几行。
  -->
  <label v-else class="dl-switch">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || undefined"
      @change="onHtmlChange"
    />
    <span class="dl-switch-track"><span class="dl-switch-thumb" /></span>
  </label>
</template>
