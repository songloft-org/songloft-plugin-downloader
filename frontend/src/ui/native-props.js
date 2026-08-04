import { watchEffect } from 'vue';

/**
 * 把一组值**命令式**地写到 webf-ui 原生元素的 JS 属性上。
 *
 * ── 为什么不直接在模板里 `:checked="x"` ──────────────────────────────────────
 *
 * webf_cupertino_ui 的同一个逻辑属性有**两个语义不同的入口**：
 *
 *   HTML 属性（*_bindings_generated.dart）：
 *     attributes['checked'] = ElementAttributeProperty(
 *       setter: (value) => checked = value == 'true' || value == '',  // 认字符串
 *       deleter: () => checked = false)
 *
 *   JS 属性（同文件的 StaticDefinedBindingProperty → switch.dart）：
 *     set checked(value) { final bool next = value == true; ... }     // 认真布尔
 *
 * 也就是说：字符串 'true' 走 JS 属性会变成 **false**（Dart 里 'true' == true 为假），
 * 布尔 true 走 HTML 属性会被 Vue 序列化成 "true" 才勉强对上。而 Vue 3 对自定义元素
 * 是**启发式**决定走 prop 还是 attr 的（大致看 `key in el`），我们没法在插件侧确定
 * 它选了哪条 —— 选错就是「开关点了没反应」这种无声故障。
 *
 * 所以布尔类属性一律绕开模板绑定，直接赋 JS 属性并传**真布尔**，行为确定。
 * 字符串类属性（val / placeholder / type / variant / active-color）两条路都会
 * `toString()`，模板绑定是安全的，不必走这里。
 *
 * @param {import('vue').Ref<HTMLElement|null>} elRef 目标元素的模板 ref
 * @param {() => Record<string, unknown>} getter 每次依赖变化时返回要写入的属性表
 */
export function bindNativeProps(elRef, getter) {
  watchEffect(
    () => {
      const el = elRef.value;
      if (!el) return;
      const props = getter();
      for (const key of Object.keys(props)) {
        try {
          el[key] = props[key];
        } catch (e) {
          // 元素没注册上时是 _UnknownHTMLElement，其上没有这些属性。
          // 这种情形本该已被 engine.js 的 useNativeUI 挡在外面，这里只是兜底：
          // 宁可这一个属性不生效，也不要抛异常打断整个渲染。
        }
      }
    },
    // flush:'post' —— 必须等 DOM 更新完、元素真的挂上去了再写属性。
    { flush: 'post' },
  );
}
