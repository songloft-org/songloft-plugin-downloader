<script setup>
const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
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
