<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useNativeUI } from '../engine.js';
import { bindNativeProps } from './native-props.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

/*
 * ── 开关的主色必须由 JS 算出来喂进去，CSS 到不了 ─────────────────────────────
 *
 * `switch.dart` 里是
 *   activeTrackColor: _parseColor(widgetElement.activeColor) ?? CupertinoColors.systemBlue
 * 而 `_parseColor` 第一步就是 `if (!v.startsWith('#')) return null` —— 它只认 hex 字面量，
 * **`var(--md-primary)` 会被整条丢掉**，于是回落成 iOS 的 systemBlue（这就是 WebF 下开关
 * 是蓝色、webview 下是紫色的原因）。CupertinoSwitch 也不读 renderStyle，所以这一个
 * 属性不像按钮那样能用 CSS 绕过去。
 *
 * 取值优先读 CSS 变量（宿主改色板时自动跟随），WebF 的 CSSOM 读不到自定义属性时
 * 回落到 common.css 里的两个字面值。**主题切换要重算** —— 值本身是随主题变的。
 */
const PRIMARY_FALLBACK = { light: '#595b94', dark: '#C7BFFF' };

function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function readPrimaryHex() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      '--md-primary',
    );
    const hex = (raw || '').trim();
    if (hex.charAt(0) === '#') return hex;
  } catch (e) {
    // WebF 的 CSSOM 未必支持读自定义属性，落到下面的字面值
  }
  return PRIMARY_FALLBACK[currentTheme()];
}

const activeColor = ref(readPrimaryHex());

// 宿主在主题变化时派发这个事件（common.js 的主题桥），见主仓 AGENTS.md 的 JS 插件一节
function onThemeChange() {
  activeColor.value = readPrimaryHex();
}

onMounted(() => {
  window.addEventListener('songloft-theme-change', onThemeChange);
});
onUnmounted(() => {
  window.removeEventListener('songloft-theme-change', onThemeChange);
});

const el = ref(null);
bindNativeProps(el, () => ({
  checked: props.modelValue,
  disabled: props.disabled,
  // 字符串属性，不是布尔 —— 但同样必须命令式赋值，理由见 native-props.js
  activeColor: activeColor.value,
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
