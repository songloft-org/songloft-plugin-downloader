<script setup>
import { computed, ref } from 'vue';
import { useNativeUI } from '../engine.js';
import { bindNativeProps } from './native-props.js';
import SlIcon from './SlIcon.vue';

const props = defineProps({
  /** webf-ui 语义：'filled' | 'tinted' | 'plain'（cupertino 的 variant 取值） */
  variant: { type: String, default: 'plain' },
  /** 'small' | 'large'；不传则用 cupertino 默认 */
  size: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /**
   * 按钮文字。**刻意是 prop 而不是默认插槽** —— cupertino button 对子节点有两条
   * 会静默吞掉内容的约束（见模板注释），用 prop 才能让调用方无法违反。
   */
  label: { type: String, required: true },
  /** 可选的前置图标，取值见 SlIcon 的 MAP */
  icon: { type: String, default: '' },
});

const el = ref(null);
// disabled 是布尔属性，必须命令式赋 JS 属性 —— 理由见 native-props.js
bindNativeProps(el, () => ({ disabled: props.disabled }));

// 非 WebF 分支映射到 common.css 已有的 M3 按钮样式，观感与宿主一致。
const FALLBACK_CLASS = {
  filled: 'btn btn-filled',
  tinted: 'btn btn-outlined',
  plain: 'btn btn-text',
};

// WebF 分支里文字与图标的颜色**只能由 CSS 给** —— 它们是 WebF 的 RenderTextBox /
// Icon，读的是 renderStyle，Flutter 那侧 CupertinoButton 设的 DefaultTextStyle 到不了。
// 所以 filled 变体要自己把前景翻成 on-primary，否则是深色字压在实心主色上。
// **disabled 时不能翻**：cupertino 会把背景换成浅灰（systemGrey4），白字压上去等于看不见。
const nativeClass = computed(() =>
  props.variant === 'filled' && !props.disabled ? 'dl-btn-native-filled' : null,
);
</script>

<template>
  <!--
    按钮内容的 DOM 结构由本组件独占，**不开放插槽**。cupertino button 有两条会
    「静默画出一个空盒子」（无报错、无日志）的约束：

      ① **只渲染 `childNodes.first`。** 源码就是
         `childNodes.isEmpty ? SizedBox() : childNodes.first.toWidget()`
         （button.dart:154），官方 button.md 亦明写 "The first child is used as the
         primary content"。所以「图标 + 文字」两个子节点时，文字被整段丢弃。
      ② **裸文本节点画不出来。** 这条是 2026-08-04 在 macOS 客户端上实测到的现象：
         `<flutter-cupertino-button>全选</flutter-cupertino-button>`（唯一子节点是文本）
         渲染成一个 minimumSize（small = 32px）的空盒子。**机理没查实** —— 读 webf 的
         `RenderTextBox` 反而显示脱离 IFC 的文本应当自绘（`paintsSelf` 在找不到
         建立 IFC 的祖先时默认返回 true），所以别把「必须是元素」当成已解释的结论，
         它目前只是经验规则。upstream 自己的例子也一律把内容包进元素
         （如 form_section.md 的 `<span>English</span>`）。

    所以：内容包成恰好一个子**元素**，文字再包一层元素。
    起始标签与 <span> 紧贴写在一行，是为了不在两者之间留下空白文本节点 —— 那会成为
    childNodes.first 而重新触发约束 ①。（condense 模式本会删掉它，这里只是不依赖它。）
  -->
  <flutter-cupertino-button
    v-if="useNativeUI"
    ref="el"
    :variant="variant"
    :size="size || undefined"
    :class="nativeClass"
  ><span class="dl-btn-inner">
      <SlIcon v-if="icon" :name="icon" />
      <span class="dl-btn-label">{{ label }}</span>
    </span></flutter-cupertino-button>
  <button
    v-else
    type="button"
    :class="FALLBACK_CLASS[variant] || FALLBACK_CLASS.plain"
    :disabled="disabled"
  >
    <span class="dl-btn-inner">
      <SlIcon v-if="icon" :name="icon" />
      <span class="dl-btn-label">{{ label }}</span>
    </span>
  </button>
</template>
