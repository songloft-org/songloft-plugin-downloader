<script setup>
import { ref } from 'vue';
import { useNativeUI } from '../engine.js';
import { bindNativeProps } from './native-props.js';

const props = defineProps({
  /**
   * 值。**必须是字符串**，不要传数字 —— cupertino input 是受控的
   * （build() 里 `_controller.text != val` 就整段替换文本并把光标推到末尾），
   * 回写时做类型转换会在用户输入的中间态就改写内容、光标跳走。
   * 数字字段请在 store 里存字符串、提交时才 parseInt（见 store.js）。
   */
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  /** 'text' | 'password' | 'number' | 'tel' | 'email' | 'url' */
  type: { type: String, default: 'text' },
  disabled: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);

const el = ref(null);
bindNativeProps(el, () => ({
  disabled: props.disabled,
  clearable: props.clearable,
}));

// cupertino input 的 input 事件：CustomEvent('input', detail: string)
function onNativeInput(e) {
  emit('update:modelValue', e.detail == null ? '' : String(e.detail));
}
function onHtmlInput(e) {
  emit('update:modelValue', e.target.value);
}
</script>

<template>
  <!--
    val 是字符串属性，两条绑定路径（prop / attr）都会 toString()，所以模板绑定安全，
    不必走 bindNativeProps。注意属性名是 `val` 而不是 `value`。
    cupertino input **没有 change 事件**，只有 input/submit/blur —— 「change 即保存」
    的语义由调用方在 blur 或 input 去抖后自己触发（见 SettingsCard.vue）。
  -->
  <flutter-cupertino-input
    v-if="useNativeUI"
    ref="el"
    class="dl-input-native"
    :val="modelValue"
    :placeholder="placeholder"
    :type="type"
    @input="onNativeInput"
    @blur="emit('change')"
  />
  <input
    v-else
    class="dl-input"
    :value="modelValue"
    :placeholder="placeholder"
    :type="type"
    :disabled="disabled"
    :aria-label="ariaLabel || undefined"
    @input="onHtmlInput"
    @change="emit('change')"
  />
</template>
