<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** 无障碍标签。列表展平后复选框失去「所在行」上下文，必须自带。 */
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

// WebF maps input[type=checkbox] to the host Material Checkbox, so both engines
// share the same themed control instead of diverging on a Cupertino widget.
function onChange(e) {
  emit('update:modelValue', e.target.checked);
}
</script>

<template>
  <input
    type="checkbox"
    class="dl-cb"
    :checked="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel || undefined"
    @change="onChange"
  />
</template>
