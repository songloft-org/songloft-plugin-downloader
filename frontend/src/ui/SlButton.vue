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
   * 按钮文字。**刻意是 prop 而不是默认插槽** —— cupertino button 只渲染第一个子节点
   * （见模板注释），用 prop 才能让调用方无法违反。
   */
  label: { type: String, required: true },
  /** 可选的前置图标，取值见 SlIcon 的 MAP */
  icon: { type: String, default: '' },
  /**
   * 可选的**后置**图标（放在文字之后），取值同 icon。
   * 做成 prop 而不是让调用方自己拼结构，理由与 label 一致 —— cupertino button
   * 只渲染第一个子节点，结构必须由本组件独占。
   */
  trailingIcon: { type: String, default: '' },
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
    按钮内容的 DOM 结构由本组件独占，**不开放插槽**。理由只有一条，但它是读源码确证的：

      **cupertino button 只渲染 `childNodes.first`。** 源码就是
      `childNodes.isEmpty ? SizedBox() : childNodes.first.toWidget()`（button.dart:154），
      官方 button.md 亦明写 "The first child is used as the primary content"。所以
      「图标 + 文字」两个并列子节点时，文字被整段丢弃 —— 无报错、无日志。

    落地：内容包成恰好一个子**元素**，文字再包一层元素。
    起始标签与 <span> 紧贴写在一行，是为了不在两者之间留下空白文本节点 —— 那会成为
    childNodes.first 而顶掉真正的内容。（condense 模式本会删掉它，这里只是不依赖它。）

    **裸文本子节点本身是可以用的**（upstream button.md 的快速上手示例就是
    `<FlutterCupertinoButton>Tap me</...>`）。这里一度记过「裸文本画不出来」的实测现象，
    后来查明那次复测看的是**进程内缓存的旧 bundle**（重装插件没重启客户端，见主仓
    docs/webf/handoff.md 第 14 条），已撤回。包一层元素仍是本组件的写法 —— 反正有图标时
    本来就必须包，统一成一种结构少一个分叉。
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
      <SlIcon v-if="trailingIcon" :name="trailingIcon" />
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
      <SlIcon v-if="trailingIcon" :name="trailingIcon" />
    </span>
  </button>
</template>
