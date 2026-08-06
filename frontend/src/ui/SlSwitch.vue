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
 * 取值三级回落：
 *   ① `SongloftPlugin.getColorScheme().primary` —— **宿主下推的真实 ColorScheme**，
 *      含用户自定义 ThemePack。这是唯一在 WebF 下也拿得到真值的途径。
 *   ② `getComputedStyle` 读 `--md-primary` —— 只在浏览器 / WebView 下有用（WebF 对
 *      **自定义**属性一律返回空串），留着是为了老客户端还没下推色板时也别退到字面值。
 *   ③ 字面值 —— 与 common.css 的静态兜底一致（由默认 seed #415F91 导出）。
 *
 * **主题切换与色板下推都要重算** —— 值本身是随主题变的。
 */
const PRIMARY_FALLBACK = { light: '#415F91', dark: '#AAC7FF' };

function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function readPrimaryHex() {
  try {
    const P = window.SongloftPlugin;
    if (P && typeof P.getColorScheme === 'function') {
      const cs = P.getColorScheme();
      if (cs && typeof cs.primary === 'string' && cs.primary.charAt(0) === '#') {
        return cs.primary;
      }
    }
  } catch (e) {
    // 老客户端的 common.js 没有这个 API，继续往下回落
  }
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      '--md-primary',
    );
    const hex = (raw || '').trim();
    if (hex.charAt(0) === '#') return hex;
  } catch (e) {
    // WebF 的 CSSOM 读不到自定义属性，落到下面的字面值
  }
  return PRIMARY_FALLBACK[currentTheme()];
}

const activeColor = ref(readPrimaryHex());

function onThemeChange() {
  activeColor.value = readPrimaryHex();
}

// ⚠️ **必须挂在 `document` 上，不是 `window`。** common.js 派发的是
// `document.dispatchEvent(new CustomEvent('songloft-theme-change', {detail}))` ——
// 没有 `bubbles: true`，所以**不会**冒泡到 window。以前这里监听的是 window，
// 于是开关主色在切主题时从未更新过（静默失效，只有对比截图才看得出来）。
//
// 两个事件都听：色板下推（`songloft-color-scheme-change`）保证在
// `songloft-theme-change` **之前**落地，所以只听后者其实也够 —— 但换主题包时
// 亮暗没变、只有色板变，那种情况只有前者会派发。
onMounted(() => {
  document.addEventListener('songloft-theme-change', onThemeChange);
  document.addEventListener('songloft-color-scheme-change', onThemeChange);
});
onUnmounted(() => {
  document.removeEventListener('songloft-theme-change', onThemeChange);
  document.removeEventListener('songloft-color-scheme-change', onThemeChange);
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
