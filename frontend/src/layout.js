// 布局环境：打开方式与窗口 resize 钩子。
//
// ⚠️ **必须是独立模块**：`<script setup>` 顶层的 `const` 会被编译进 `setup()`，
// 那是**每个组件实例一份**。这里的东西必须全页唯一，放进组件里会静默变成
// 「各组件各看到一份」。

import { ref } from 'vue';

// ── 打开方式 ───────────────────────────────────────────────────────────────
//
// 插件页有三种打开方式，宿主给的 chrome 完全不同，页头要不要自己画取决于它：
//
//   tab        注册成主程序 tab（URL 带 `embed`）。宿主**没有** AppBar，
//              底部是 Flutter 的 NavigationBar。→ 页头要自己画。
//   fullscreen 从首页点进的全屏页。宿主**有** AppBar（插件名 / 返回 / 关闭 /
//              在浏览器打开）。→ 页头不能自己画，否则双标题。
//   browser    从上面那个全屏页的「在浏览器中打开」跳出去。完全裸页面。
//              → 页头必须自己画。
//
// ── 判据 ──────────────────────────────────────────────────────────────────
//
// `embed` 是**唯一活到运行期的 query 参数**：`access_token` 被后端注入的 authBridge
// 用完就 `history.replaceState` 删掉，`theme` 被 common.js 删掉，所以这两个都不能当
// 特征。
//
// fullscreen 与 browser 的 URL **逐字节相同**，唯一可靠判据是
// `SongloftPlugin.host.isAvailable()` —— 它把 native callHandler / iframe parent
// 两条传输链路 OR 在一起，正好等于「有宿主」。已知宽松之处：插件页被任意第三方页面
// 用 iframe 套着在浏览器里打开时会误判成 fullscreen（宿主侧的 isIframeHost 只判
// `parent !== window`），那是上游的设计取舍，不是本插件能修的。
export const mode = ref('browser');

/** 有页头时是否由插件自绘。fullscreen 下宿主已经有 AppBar 了。 */
export function detectMode() {
    // embed class 由 common.js 在 <head> 同步阶段加上，任何时候读都准。
    if (document.documentElement.classList.contains('embed')) return 'tab';
    // isAvailable() 是每次调用现算的，但 window.flutter_inappwebview 的注入时序
    // 没有契约，所以调用点放在 mount 之后（见 App.vue），不在模块初始化时。
    try {
        const h = window.SongloftPlugin && window.SongloftPlugin.host;
        if (h && h.isAvailable()) return 'fullscreen';
    } catch (e) {
        /* 探测失败按「没有宿主」处理：多画一个页头比少一个入口好 */
    }
    return 'browser';
}

/**
 * 把判定结果同步到 `<html>` 的 class，供 CSS 分布局用（主要是 `--dl-list-h`）。
 * 用自定义的 `sl-mode-*` 而不是复用宿主的类：宿主 `html.embed` 那一段全带
 * `!important`，自己的类不带才好覆盖。
 */
export function applyMode() {
    const m = detectMode();
    mode.value = m;
    const de = document.documentElement;
    de.classList.remove('sl-mode-tab', 'sl-mode-fullscreen', 'sl-mode-browser');
    de.classList.add('sl-mode-' + m);
    return m;
}

// ── 一次性安装 ─────────────────────────────────────────────────────────────
//
// resize 监听挂在模块级、只装一次：组件会随切页反复挂卸，装在组件里就会漏。
let installed = false;
const resizeHooks = [];

/** 注册一个 resize 回调。返回反注册函数。 */
export function onResize(fn) {
    resizeHooks.push(fn);
    return () => {
        const i = resizeHooks.indexOf(fn);
        if (i >= 0) resizeHooks.splice(i, 1);
    };
}

export function installLayout() {
    if (installed) return;
    installed = true;
    window.addEventListener('resize', () => {
        for (let i = 0; i < resizeHooks.length; i++) {
            try {
                resizeHooks[i]();
            } catch (e) {
                /* 单个回调出错不该连带打掉其它的 */
            }
        }
    });
}
