<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  /** 'text' | 'password' | 'number' | 'tel' | 'email' | 'url' */
  type: { type: String, default: 'text' },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'change']);

function onHtmlInput(e) {
  emit('update:modelValue', e.target.value);
}
</script>

<template>
  <input
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
