// 布局环境：打开方式、宽窄断点、列表可用高度。
//
// ⚠️ **必须是独立模块**（同 ui/select-open-state.js 的理由）：`<script setup>` 顶层的
// `const` 会被编译进 `setup()`，那是**每个组件实例一份**。这里的三样东西都必须全页唯一，
// 放进组件里会静默变成「各组件各看到一份」。

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
// 特征。`html.webf-engine` 标的是**渲染引擎**（由 plugin.json 的 renderEngine 决定），
// 与打开方式无关，用它区分是错的。
//
// fullscreen 与 browser 的 URL **逐字节相同**，唯一可靠判据是
// `SongloftPlugin.host.isAvailable()` —— 它把 WebF methodChannel / native callHandler /
// iframe parent 三条传输链路 OR 在一起，正好等于「有宿主」。已知宽松之处：插件页被
// 任意第三方页面用 iframe 套着在浏览器里打开时会误判成 fullscreen（宿主侧的
// isIframeHost 只判 `parent !== window`），那是上游的设计取舍，不是本插件能修的。
export const mode = ref('browser');

/** 有页头时是否由插件自绘。fullscreen 下宿主已经有 AppBar 了。 */
export function detectMode() {
    // embed class 由 common.js 在 <head> 同步阶段加上，任何时候读都准。
    if (document.documentElement.classList.contains('embed')) return 'tab';
    // isAvailable() 是每次调用现算的，但 window.webf / window.flutter_inappwebview
    // 的注入时序没有契约，所以调用点放在 mount 之后（见 App.vue），不在模块初始化时。
    try {
        const h = window.SongloftPlugin && window.SongloftPlugin.host;
        if (h && h.isAvailable()) return 'fullscreen';
    } catch (e) {
        /* 探测失败按「没有宿主」处理：多画一个页头比少一个入口好 */
    }
    return 'browser';
}

/**
 * 把判定结果同步到 `<html>` 的 class，供 CSS 分三套布局用（主要是 `--dl-list-h`）。
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

// ── 列表可用高度 ───────────────────────────────────────────────────────────
//
// 约束 ⑤ 要求 `<webf-list-view shrink-wrap="false">` 有**确定高度**（只能是 `height`，
// `max-height` 会把无界约束透进 hosted Flutter 子树，撞 `Infinity or NaN toInt`），
// 而约束 ⑧ 又不许用 `flex:1` 吃剩余高度（竖向 flex）。于是只能算。
//
// CSS 里有一套 `calc(100vh - 常量)` 的兜底值（见 style.css 的 `--dl-list-h`），保证
// 首帧就满足约束 ⑤；但那些常量是按「标准布局」核算的，筛选栏一 wrap、页头有无、
// 进度卡出现，都会让它偏。所以**以实测为权威**：量出列表顶边到视口底的距离。
//
// 旧版那个 `calc(100vh - 420px)` 就是纯手调常量，实测低估约 280px —— 表格顶端被顶到
// `y≈735`（视口 720），整张表默认在折叠线以下。
const MIN_LIST_HEIGHT = 240;

/** 容器下边距（16px + 底部安全区）。CSS 里写的是 calc()，这里要它**解析后**的值。 */
const FALLBACK_BOTTOM_PAD = 16;

/**
 * 列表下方到视口底的固定占位：容器的 padding-bottom + 主体卡的下边框与下外边距。
 *
 * padding-bottom 必须**读解析值**而不是写死 16 —— CSS 里它是
 * `calc(16px + var(--sl-safe-bottom))`，刘海屏 / 手势条上会大一截。
 * 读 `getComputedStyle` 的**标准属性**是可以的：WebF 只有对**自定义属性**才一律返回
 * 空串（所以 `--sl-safe-bottom` 本身读不到，只能读它参与计算后的 paddingBottom）。
 */
export function pageBottomGap() {
    // 列表下方已无卡片（主体改平铺 .dl-body，无边框/外边距），只剩容器 padding-bottom。
    const cardGap = 0;
    let pad = FALLBACK_BOTTOM_PAD;
    try {
        const el = document.querySelector('.dl-container');
        if (el && typeof window.getComputedStyle === 'function') {
            const v = parseFloat(window.getComputedStyle(el).paddingBottom);
            if (isFinite(v) && v >= 0) pad = v;
        }
    } catch (e) {
        /* 读不到就用兜底值：偏差只是页面末尾多/少几像素留白 */
    }
    return cardGap + pad;
}

/**
 * @param {HTMLElement|null} el 列表元素（`<webf-list-view>` 或 HTML 回落的 div）
 * @param {number} bottomGap 列表下方要留出的空白，见 pageBottomGap()
 */
export function measureListHeight(el, bottomGap) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    const top = el.getBoundingClientRect().top;
    // WebF 是**异步渲染**的，首帧可能还没 layout、量出来是 0。此时什么都不做，
    // 让 CSS 兜底值继续生效，由调用方在下一帧重试。
    // 也不能接受负值（元素已滚出视口上方时算出来的高度没有意义）。
    if (!(top > 0)) return false;
    const h = Math.round(window.innerHeight - top - bottomGap);
    // 只能写内联 style，**不能**读 CSS 变量再算：WebF 的 getComputedStyle 对自定义
    // 属性一律返回空串（docs/js-plugin-development-guide.md 记录）。
    el.style.height = Math.max(MIN_LIST_HEIGHT, h) + 'px';
    return true;
}

// ── 一次性安装 ─────────────────────────────────────────────────────────────
//
// resize 监听挂在模块级、只装一次：组件会随切页反复挂卸，装在组件里就会漏。
let installed = false;
const resizeHooks = [];

/** 注册一个 resize 回调（用于重量列表高度）。返回反注册函数。 */
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
