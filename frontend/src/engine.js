// 渲染引擎能力探测 —— 决定 ui/ 下的包装组件走 webf-ui 原生元素还是 HTML 回落。
//
// ── 为什么是「特性探测」而不是「引擎探测」 ──────────────────────────────────
//
// 直觉写法是 `!!window.webf`，但那是错的。客户端与插件是**各自独立发版**的：
// plugin.json 的 minHostVersion 只约束**服务端**版本，没有任何字段能约束客户端。
// 于是「新插件 + 老客户端（还没有 webf_cupertino_ui）」这个组合必然出现，
// 那时 <flutter-cupertino-*> 会落到 WebF 的 _UnknownHTMLElement —— 一个空的
// display:block 盒子。用户看到的是**所有控件凭空消失**，而且不报任何错。
//
// 所以判据必须是「这些元素到底注册上了没有」，而不是「我是不是跑在 WebF 里」。
//
// ── 判据本身 ──────────────────────────────────────────────────────────────
//
// 元素注册上时，webf_cupertino_ui 的 bindings 会在实例上定义 `checked` 属性
// （switch_bindings_generated.dart 的 'checked': StaticDefinedBindingProperty）。
// 没注册上就是 _UnknownHTMLElement，其上没有这个属性 → undefined。
//
// 用 switch 做探针是因为它属性最少、行为最简单；任一 cupertino 元素注册失败都
// 是同一个 install 调用整体失败（宿主侧 installWebFCupertinoUI() 内部是 31 条
// 连续 defineCustomElement，**没有逐元素 try/catch**），所以探一个等于探全部。

/** 是否跑在 WebF 运行时里。判据与宿主 common.js 的 isWebFEngine() 一致。 */
export const isWebFRuntime = typeof window !== 'undefined' && !!window.webf;

function detectNativeUI() {
  if (!isWebFRuntime) return false;
  try {
    return document.createElement('flutter-cupertino-switch').checked !== undefined;
  } catch (e) {
    return false;
  }
}

/**
 * 是否使用 webf-ui 原生元素。
 *
 * 模块级常量：渲染引擎在页面生命周期内不会变，没必要做成响应式。
 * false 时全部包装组件走 HTML 分支 —— 覆盖浏览器 / 系统 WebView / Web iframe /
 * Linux arm64（拿不到 WebF 渲染面），以及上面说的「老客户端」情形。
 */
export const useNativeUI = detectNativeUI();

/**
 * webf-list-view 是 webf 包**内建**的（不依赖 webf_cupertino_ui），所以它的
 * 可用性与 cupertino 元素是两件事，单独探测。
 *
 * 判据同上：注册上时 listview 的 bindings 会定义 finishLoad 方法。
 */
function detectListView() {
  if (!isWebFRuntime) return false;
  try {
    return (
      typeof document.createElement('webf-list-view').finishLoad === 'function'
    );
  } catch (e) {
    return false;
  }
}

export const useNativeListView = detectListView();

// 探测结果落日志。这是真机上唯一能确认「页面到底走了哪条分支、跑的是哪份 bundle」
// 的取证手段：客户端把插件页的 console 转发成 `[plugin][console] …`
// （plugin_render_surface_webf.dart 里 `controller.onJSLog`）。
//
// **不要**用 `%s` 占位符：WebF 的转发是把参数按空格 join、不做 printf 替换
// （from_native.dart:751 附近的 `_onJSLogStructured`），写了只会把 `%s` 原样打出来。
//
// 末尾的 `build=` 是**产物指纹**：重装插件后没完全退出客户端时跑的是进程内缓存的
// 旧 controller（见 README 第 1 条），此时这个 token 会与当前源码不一致 —— 一眼
// 就能判掉「白测一轮」。
if (typeof console !== 'undefined' && console.log) {
  console.log(
    '[downloader] engine: webf=' +
      isWebFRuntime +
      ' nativeUI=' +
      useNativeUI +
      ' nativeListView=' +
      useNativeListView +
      ' build=inline-panel',
  );
}
