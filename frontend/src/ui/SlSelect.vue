<script setup>
// 下拉选择。**这是全项目唯一一处「WebF 下必须换实现」的控件。**
//
// ── 为什么 `<select>` 在 WebF 下不能用（读源码确证）───────────────────────────
//
// WebF 的 `HTMLSelectElement`（webf/lib/src/html/form/select.dart）是一个
// `WidgetElement`，`initializeDynamicProperties` 只把这五个属性暴露给 JS：
//
//     value / selectedIndex / disabled / multiple / required
//
// **没有 `options`**，也没有 `selectedOptions`（Dart 侧 `grep "\['options'\]" lib/`
// 零命中；原生 libwebf 的绑定表里 `HTMLSelectElement` 附近同样只有类名注册）。
// 于是 Vue 的 `v-model` 走 `vModelSelect` 指令，而那个指令整个实现建立在
// `el.options` 上（change 监听器是 `Array.prototype.filter.call(el.options, …)`，
// `mounted`/`updated` 调的 `setSelected()` 里是 `el.options.length`），
// `filter.call(undefined, …)` 抛 TypeError —— **任何框架**的 `<select>` 双向绑定
// 都会踩。绕开 v-model、改成显式 `@change` 读 `el.value` 之后**真机实测仍然不通**，
// 剩下的断点在 Dart 侧且无法从 JS 观测。结论：这个元素不要碰。
//
// ⚠️ 判据陷阱：「下拉的标签显示更新了」**不能**当成「数据通了」。WebF 的 select 是
// WidgetElement，`_openOptionsMenu()` 先 `widgetElement.selectedIndex = result` 改自己
// 的内部态、再派发 `change`，显示的文字由 Flutter 侧维护（`_displayLabel`），与 JS
// 收不收到值完全无关。
//
// ── 为什么不用官方的 `<flutter-cupertino-action-sheet>` ──────────────────────
//
// 它确实是 webf-ui 给「从 N 个里选一个」的正解（31 个元素里没有任意选项的 picker，
// `flutter-cupertino-picker` 在 `installWebFCupertinoUI()` 里是注释掉的），而且
// `webf_cupertino_ui.dart:60` 确认注册了。但它有一个**从 JS 侧无法观测**的失败模式：
// `show()` 的实现是 `state?._showActionSheetImpl(args)` —— state 还没建立时是
// **静默 no-op**，不抛异常、不打日志。也就是「点了什么都不发生」与「正常工作」
// 在代码里无法区分，只能靠人肉试。同类的不确定还有：方法能否被 `typeof` 探到
// （属性与方法在 Dart 侧是两条独立查找路径），以及 `CustomEvent.detail` 过桥后
// 是对象还是字符串。
//
// 这些本可以用容器探针一次验完，但 `webf` 包只提供 **x86-64** 的 `libwebf.so`
// （`file linux/libwebf.so` 确认），本机是 Apple Silicon → 容器里 Flutter 编出 arm64
// 产物、加载不到原生库；而 `entrypoint.sh` 的 `BUNDLE=` 又硬编码 x64 路径，于是
// 跑起来的是镜像里烘进去的**旧二进制**，结论不可信（已记入 handoff）。
//
// 所以这里选**确定性优先**：只用「已经在本页跑通」的原语，让每一步都能从 JS 侧观测。
//
// ── 现在的实现 ──────────────────────────────────────────────────────────────
//
// 触发按钮（SlButton，即 `<flutter-cupertino-button>`，本页 Toolbar 已验证 click 可用）
// + **绝对定位的浮层面板**（`v-if` 展开，普通 `<div>` 行）。选中值从头到尾只在我们
// 自己的 JS 里流动：点哪一行就 emit 那一行的 value，不读写任何 WebF 元素属性。
//
// ⚠️ **2026-08-05 改为浮层，推翻了本文件原先的决策。** 原先是「常规流里的内联面板」，
// 刻意避开 `position: absolute`，理由是「浮层要赌 WebF 的层叠与命中测试（面板得盖在
// 歌曲列表这个 Flutter widget 上）」。那个顾虑没错，但内联块盒的代价是**一展开就把
// 工具栏和整张歌曲列表往下顶**，实际使用时比风险更难接受。层叠与命中的两条回归判据
// 写在 style.css 的 `.dl-select-panel` 注释里，改这块前先看它们。
//
// 仍然**不嵌** `<webf-list-view>`（要赌 tap 穿过 Flutter ListView 的手势竞技场），
// 选项行就是普通 `<div>` —— DOM click 由 WebF 唯一那个全局 tap recognizer 派发
// （见主仓 docs/webf/handoff.md）。选项多时面板会很长，靠页面自身滚动。
//
// 非 WebF 路径（浏览器 / 系统 WebView / Web iframe / 拿不到 WebF 渲染面的平台）
// 继续用原生 `<select>` —— 在真浏览器里它完全正常，而且是无障碍与键盘操作最好的形态。

import { computed, onUnmounted } from 'vue';
import { useNativeUI } from '../engine.js';
import SlButton from './SlButton.vue';
import { openToken, nextSelectToken } from './select-open-state.js';

/*
 * ── 同时只允许一个面板展开 ──────────────────────────────────────────────────
 *
 * 展开状态**不是**每个实例自己的 `open` 布尔（那样三个下拉能同时张开并互相盖住），
 * 而是共享的「当前归属于谁」—— 展开新的自然把旧的收起。
 *
 * ⚠️ 那份共享状态必须放在 `select-open-state.js` 里，**不能写在本文件的
 * `<script setup>` 顶层** —— `<script setup>` 会整体编译进 `setup()`，顶层 `const`
 * 是**每实例一份**的，互斥会静默失效。这个坑本轮踩过一次，理由写在那个模块的注释里。
 *
 * 刻意**不做**「点面板外收起」：WebF 的 DOM click 由全局唯一那个 tap recognizer 派发，
 * document 级监听与触发按钮自身的 click 谁先到、会不会同一次点击既展开又立刻收起，
 * 都还没验证过。少一个未验证的交互，好过多一个可能自锁的交互。
 */

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** [{ value, label }]，不含「全部」占位项 */
  options: { type: Array, default: () => [] },
  /** 空值那一项的文案 */
  placeholder: { type: String, default: '全部' },
  ariaLabel: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue']);

/** 触发按钮上显示的文字：命中选项就显示它的 label，否则显示占位文案。 */
const currentLabel = computed(() => {
  const hit = props.options.find((o) => o.value === props.modelValue);
  return hit ? hit.label : props.placeholder;
});

/** 面板里的行 = 占位项（空值）+ 全部选项。 */
const rows = computed(() => [
  { value: '', label: props.placeholder },
  ...props.options,
]);

/** 本实例的身份（从共享模块领取，见文件头说明）。 */
const myToken = nextSelectToken();
const open = computed(() => openToken.value === myToken);

// 卸载时若展开的是自己就让权。不清理也不会显示错东西（组件都没了），
// 但留着一个指向已死实例的 token 会让下一次 `openToken.value === myToken` 的判断
// 依赖「seq 不会回绕」这种隐含前提，不值得省这三行。
onUnmounted(() => {
  if (openToken.value === myToken) openToken.value = null;
});

// 日志前缀统一 `[downloader]`：客户端把插件页的 console 转发成
// `[plugin][console] …`（plugin_render_surface_webf.dart 的 onJSLog），是这一页
// 唯一能从真机取证的通道。**不要**用 `%s` 占位符 —— WebF 的转发是把参数按空格
// join，不做 printf 替换（from_native.dart:751），写了只会打出字面量。
function logStep(msg) {
  if (typeof console !== 'undefined' && console.log) {
    console.log('[downloader] select ' + (props.ariaLabel || '?') + ' ' + msg);
  }
}

function toggle() {
  // 赋 token 而不是翻布尔：展开自己的同时把别人收起来，是同一个动作。
  openToken.value = open.value ? null : myToken;
  logStep('toggle open=' + open.value + ' rows=' + rows.value.length);
}

function pick(row) {
  openToken.value = null;
  logStep('pick value=' + JSON.stringify(row.value));
  emit('update:modelValue', row.value);
}

// ── HTML 回落分支：原生 <select> ────────────────────────────────────────────

function onChange(e) {
  const node = e && e.target;
  if (node) emit('update:modelValue', node.value == null ? '' : node.value);
}
</script>

<template>
  <div v-if="useNativeUI" class="dl-select-wrap">
    <SlButton
      class="dl-select-btn"
      variant="tinted"
      :label="currentLabel"
      trailing-icon="chevron"
      @click="toggle"
    />
    <!--
      面板用 v-if 而不是 CSS 隐藏：WebF 里 display:none 的元素仍会挂一个 0 尺寸
      RenderConstrainedBox（见 README 的缺陷表）。**这一条在浮层形态下更要紧** ——
      常驻一个 0 尺寸的绝对定位盒子，命中测试的表现是另一件没验过的事。
      选项行是普通 div —— 见本文件头注释里「为什么不嵌 webf-list-view」。
    -->
    <div v-if="open" class="dl-select-panel">
      <div
        v-for="row in rows"
        :key="row.value"
        class="dl-select-option"
        :class="{ 'dl-select-option-on': row.value === modelValue }"
        @click="pick(row)"
      >
        {{ row.label }}
      </div>
    </div>
  </div>
  <select
    v-else
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
