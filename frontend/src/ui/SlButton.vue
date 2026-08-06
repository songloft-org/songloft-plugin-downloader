<script setup>
import { computed, ref } from 'vue';
import { useNativeUI } from '../engine.js';
import { bindNativeProps } from './native-props.js';
import SlIcon from './SlIcon.vue';

const props = defineProps({
  /**
   * 'filled' | 'tinted' | 'plain'。
   *
   * ⚠️ **这个值不再透传给 cupertino 的 `variant` 属性**，只用来选 CSS 类。理由见下面
   * `nativeClass` 的注释：cupertino 的 filled / tinted 变体自带 iOS 配色且 filled 的底色
   * 压根改不了，与宿主的 M3 色板对不上。
   */
  variant: { type: String, default: 'plain' },
  /**
   * 'small' | 'large'。**当前两条分支都不消费它**（WebF 侧的尺寸由 CSS 的
   * `min-height` / `padding` 决定，见模板注释）。保留是为了不动调用方，
   * 也为了将来真需要区分尺寸时有现成的入口。
   */
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
  /**
   * 只画图标、不画文字（页头的齿轮 / 返回箭头）。
   *
   * `label` 仍然**必填**：它此时当 `aria-label` 用。图标按钮没有可读文字，
   * 不给无障碍名就是个空按钮 —— 宿主 common.js 的 `hideDecorationIcons()` 还会
   * 给图标补 `aria-hidden="true"`，那样连图标的隐含语义都没了。
   */
  iconOnly: { type: Boolean, default: false },
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

/*
 * WebF 分支的外观**整套由 CSS 给**，模板里刻意不传 cupertino 的 `variant` 属性。
 *
 * ── 为什么不用 cupertino 自己的 filled / tinted（读源码确证）──────────────────
 *
 * `button.dart` 的三个分支里，只有 `default`（即 variant=plain）与 `tinted` 会把
 * CSS 的 `background-color` 当自己的底色（`color: backgroundColor`）；
 * **`CupertinoButton.filled` 的构造器压根不接受 color**，它固定用
 * `CupertinoTheme.primaryColor` —— 插件侧无论怎么写 CSS 都改不动，画出来是 iOS 蓝/灰而
 * 不是宿主的 M3 primary。圆角同理：filled 分支在没有 CSS `border-radius` 时是
 * `BorderRadius.zero`（直角），tinted / plain 是固定 `circular(8)`，
 * 都不是 M3 的胶囊。
 *
 * 所以统一走 `plain` 分支，把底色 / 圆角 / 边框 / 前景色全部交给 CSS —— 与 HTML 回落分支
 * 共用同一套 M3 语义（见 style.css 的 .dl-btn-native*），两条分支的观感这才真的一致。
 *
 * 前景色必须由 CSS 给：文字与图标是 WebF 的 RenderTextBox / Icon，读的是 renderStyle，
 * Flutter 那侧 CupertinoButton 设的 DefaultTextStyle 到不了。
 */
const NATIVE_CLASS = {
  filled: 'dl-btn-native dl-btn-native-filled',
  tinted: 'dl-btn-native dl-btn-native-outlined',
  plain: 'dl-btn-native dl-btn-native-text',
};

// disabled 的变灰也只能靠 CSS：plain 分支的 `disabledColor` 是 `Colors.transparent`
// （button.dart 的 getDisabledColor 默认分支），挡不住 WebF 自己按 CSS 画的那层底色,
// 于是不加这个类的话 disabled 按钮看起来跟可用的一模一样。
// 用类而不是 `[disabled]` 属性选择器：disabled 是命令式赋的 **JS 属性**（见 native-props.js），
// 不会反映到 HTML 属性上，属性选择器匹配不到。
const nativeClass = computed(() => {
  let base = NATIVE_CLASS[props.variant] || NATIVE_CLASS.plain;
  // 图标按钮要方形、无左右 padding。WebF 侧的 padding 会被应用两次（见
  // .dl-btn-native 的注释），所以这个类里的值同样写目标值的一半。
  if (props.iconOnly) base += ' dl-btn-native-icon';
  return props.disabled ? base + ' dl-btn-native-disabled' : base;
});

const fallbackClass = computed(() => {
  // 图标按钮**刻意不带宿主的 `.btn`**：那个类是 `display:inline-flex`，而图标按钮
  // 的落点（页头 / 组标题行）都是 flex 容器 —— flex 子项自己也是 flex 容器会触发
  // 约束 ⑧（整个子树一个像素都不画）。`.dl-btn-icon` 是 inline-block，安全。
  if (props.iconOnly) return 'dl-btn-icon';
  return FALLBACK_CLASS[props.variant] || FALLBACK_CLASS.plain;
});
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
  <!--
    刻意不传 `variant` 与 `size`：
      · `variant` 见上面 nativeClass 的注释（cupertino 的配色/圆角对不上 M3，
        filled 的底色还改不了）；
      · `size` 只影响 `getDefaultMinSize()` 与 `getDefaultPadding()` 两个默认值，
        而 CSS 的 `min-height` / `padding` 会分别顶掉它们（`hasMinHeight` / `hasPadding`
        为真时 button.dart 优先用 renderStyle 的值），传了也不起作用。
  -->
  <flutter-cupertino-button
    v-if="useNativeUI"
    ref="el"
    :class="nativeClass"
    :aria-label="label"
  ><span class="dl-btn-inner">
      <SlIcon v-if="icon" :name="icon" />
      <span v-if="!iconOnly" class="dl-btn-label">{{ label }}</span>
      <SlIcon v-if="trailingIcon" :name="trailingIcon" />
    </span></flutter-cupertino-button>
  <button
    v-else
    type="button"
    :class="fallbackClass"
    :disabled="disabled"
    :aria-label="label"
  >
    <span class="dl-btn-inner">
      <SlIcon v-if="icon" :name="icon" />
      <span v-if="!iconOnly" class="dl-btn-label">{{ label }}</span>
      <SlIcon v-if="trailingIcon" :name="trailingIcon" />
    </span>
  </button>
</template>
