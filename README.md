# Songloft 歌曲下载插件

将用户自有网络存储（NAS、WebDAV、Subsonic 等）中的歌曲下载到 Songloft 服务端本地。

## 使用场景

Songloft 通过 WebDAV、Subsonic 等插件可以接入用户自己的网络音乐库。这些歌曲以 `remote` 类型存储在数据库中，播放时服务端从用户的网络存储实时拉取音频流。

本插件的作用是将这些**来自用户自有网络存储**的歌曲下载到服务端本地 `music_path` 目录，转为 `local` 类型。适用场景：

- 家里的 NAS 通过 WebDAV 挂载，希望将歌曲固化到 Songloft 服务端，脱离对 NAS 在线的依赖
- Subsonic 服务器上的音乐库，希望迁移到 Songloft 本地管理
- 网络存储不稳定或带宽有限，想避免每次播放都远程拉取

> **本插件仅适用于用户自有的本地网络资源**（WebDAV、Subsonic、SMB 等），不支持也不应用于第三方音乐平台的歌曲下载。

### 典型流程

```
用户的 NAS / WebDAV / Subsonic
        │
   (音源插件导入)
        │
        ▼
Songloft 数据库（type=remote, url 指向用户自有存储）
        │
  (歌曲下载插件)
        │
        ▼
Songloft 服务端 music_path 本地目录（type=local）
```

### 示例

假设你通过 DAV 插件挂载了家里 NAS 的 WebDAV 共享（`http://192.168.1.100:5005/dav/music`），导入了一批歌曲：

| 字段 | 值 |
|------|-----|
| title |Erta Strada |
| artist | My Band |
| album | Demo Album |
| type | remote |
| plugin_entry_path | dav |
| source_data | `{"configName":"家庭NAS","path":"/music/My Band/Terra Strada.flac"}` |

使用本插件下载后（路径模板 `{artist}-{album}/{title}`）：

| 字段 | 值 |
|------|-----|
| type | **local** |
| file_path | `/data/music/My Band-Demo Album/Terra Strada.flac` |
| plugin_entry_path | *(已清空)* |
| source_data | *(已清空)* |

歌曲文件已存储在服务端本地，不再依赖 NAS 在线。

又如通过 Subsonic 插件接入了另一台 Navidrome 服务器（`http://192.168.1.200:4533`），想把歌曲迁移到本机：

| 字段 | 下载前 | 下载后 |
|------|--------|--------|
| type | remote | **local** |
| plugin_entry_path | subsonic | *(清空)* |
| file_path | *(空)* | `/data/music/Artist-Album/Song.mp3` |

## 安装

从 Songloft 插件市场安装，或手动构建：

```bash
cd jsplugins-src/songloft-plugin-downloader
pnpm install
pnpm run build
# 产物：dist/song-downloader.jsplugin.zip
```

将 zip 文件上传到 Songloft 的「JS 插件」管理页面即可。

## 使用说明

1. 打开插件页面，页面会列出数据库中所有 `remote` 类型的歌曲
2. **设置**（页面顶部）：
   - **路径模板**：控制下载后的目录结构，默认 `{artist}-{album}/{title}`
     - 支持占位符：`{title}`（必填）、`{artist}`、`{album}`、`{year}`、`{genre}`
     - 示例：`{artist}/{album}/{title}` → `My Band/Demo Album/Terra Strada.flac`
   - **嵌入元数据**：是否将标题、艺术家、专辑、封面等写入音频文件标签（MP3/FLAC）
3. **筛选**（列表上方）：可按**歌单**（切换后从服务端拉取该歌单内的 remote 歌曲）、**艺术家**、**专辑**下拉或**关键字**搜索快速缩小范围，「全选/下载选中」仅作用于当前筛选结果
4. 勾选要下载的歌曲，点击「下载选中」
5. 批量下载时页面显示进度条和成功/失败计数

## 所需权限

| 权限 | 用途 |
|------|------|
| `storage` | 存储插件设置（路径模板、元数据开关） |
| `songs.read` | 读取歌曲列表 |
| `songs.write` | 下载后更新歌曲类型和路径 |
| `playlists.read` | 读取歌单列表及歌单内歌曲（用于按歌单筛选） |

## 注意事项

- 下载目标目录固定为服务端的 `music_path`（通过 Songloft 设置页配置的音乐目录）
- 下载后歌曲变为 `local` 类型，原有的插件来源信息会被清除
- 如果服务端已有该歌曲的透明缓存，下载时会直接复制缓存文件，无需重新拉取
- 仅支持 `remote` 类型歌曲，`local` 和 `radio` 类型不可下载
- M4A/OGG 格式的元数据嵌入暂不支持，会自动跳过（不影响下载本身）

### 关于前端实现（webf-ui 原生组件 + 引擎分叉）

本插件声明了 `"renderEngine": "webf"`，插件页在支持的原生客户端上由
[WebF](https://openwebf.com/) 渲染（纯 Flutter 渲染的 W3C 运行时），其余路径
（Web 端 iframe、系统 WebView、拿不到 WebF 渲染面的 Linux arm64 等）仍走普通 HTML。

前端因此用 **Vue 3 + Vite** 重写（源码在 `frontend/`，产物输出到 `static/`），
并按 **webf-ui** 规范组织：

- **表单控件**按宿主能力选择原生元素：按钮、输入框和图标使用 `webf_cupertino_ui`
  （`<flutter-cupertino-button>` `<flutter-cupertino-input>` `<flutter-cupertino-icon>`），
  开关与歌曲选择框使用标准 `<input type=checkbox>`。WebF 会将后者映射为宿主 Material
  控件，使复选框外观与主程序曲库保持一致；浏览器模式也复用同一套结构。
- **下拉选择**是 `<flutter-cupertino-button>` 触发 + **常规流里的内联面板**（普通 `div` 行）。
  webf-ui 里没有任意选项的 picker，原生 `<select>` 在 WebF 下选中值传不回 JS，
  而官方的 action sheet 有一个从 JS 侧无法观测的静默失败模式 —— 三者的取舍见下方
  「内容与装饰的坑」第 6 条
- **歌曲列表**用 `webf` 包内建的 `<webf-list-view>`（映射到 Flutter 的 ListView，自带 view 回收）

#### 一套业务代码 + 叶子级引擎分叉

webf-ui 的元素只在 WebF 下是真组件，在浏览器里是未知标签。为了让页面在**所有**路径
功能完整，分叉全部收敛在 `frontend/src/ui/` 的薄包装组件里 —— 业务代码只写一套：

```
frontend/src/ui/SlSwitch.vue          ← 唯一分叉点
    ├── webf-ui 可用   → <flutter-cupertino-switch>
    └── 否            → <label class="dl-switch"><input type=checkbox>…

frontend/src/views/SettingsCard.vue   ← 业务代码，只见 <SlSwitch>
```

**判据是「特性探测」而不是「引擎探测」**（`frontend/src/engine.js`）。不能只写
`!!window.webf`：客户端与插件各自独立发版，`minHostVersion` 只约束**服务端**版本，
所以「新插件 + 还没有 `webf_cupertino_ui` 的老客户端」这个组合必然出现。那时
`<flutter-cupertino-*>` 会落到 WebF 的 `_UnknownHTMLElement`（一个空的 display:block
盒子），用户看到的是**所有控件凭空消失且不报错**。所以探的是「元素到底注册上了没有」：

```js
document.createElement('flutter-cupertino-switch').checked !== undefined
```

`<webf-list-view>` 来自 `webf` 包本身、与 cupertino 元素是两件事，因此单独探测。

#### 属性契约的两个坑

1. **HTML 属性是 kebab-case，JS 属性才是 camelCase**（`active-color` ↔ `activeColor`）。
   模板里写 `activeColor` 会变成 `activecolor` 属性而静默失效。
2. **同一个逻辑属性有两个语义不同的入口**：HTML 属性 setter 认字符串
   （`value == 'true' || value == ''`），JS 属性 setter 认真布尔（`value == true`）。
   而 Vue 对自定义元素走 prop 还是 attr 是启发式的 —— 选错就是「开关点了没反应」。
   所以布尔属性一律绕开模板绑定，命令式赋 JS 属性并传真布尔，见
   `frontend/src/ui/native-props.js`。

另外：输入框的值属性叫 **`val`** 不是 `value`，且它是**受控**的（内部
`_controller.text != val` 就整段替换文本并把光标推到末尾）——对已挂载的输入框回写 val
会触发白屏崩溃链（下表倒数第二条），所以本插件原生分支按**非受控**用：挂载时给一次
初值，之后只读事件不回写（`ui/SlInput.vue`）。数字字段在 store 里存字符串、提交时才
`parseInt`。

#### 内容与装饰的坑（真机才暴露的）

上面那两条是读源码读出来的；下面这几条是**页面真的画出来之后**才发现的，共同点是
**画出了一个东西但不对**（或者干脆是别处的 bug 冒充成本页的），不报错、不打日志：

1. **⚠️ 重装插件后必须完全退出并重启客户端，否则你看到的还是旧 bundle。** 这条放第一位，
   因为它会让你把已经改对的东西当成没生效。WebF 渲染面用
   `WebF.fromControllerName(controllerName: 'plugin:<URL>')`，controller 由
   `WebFControllerManager` 按名字缓存到**进程结束**，命中缓存时**不重新取 bundle**
   （日志里那句 `evaluated: true, status: PreloadingStatus.done` 就是它）。退出页面再进、
   切 Tab、切主题都不会重取。不是 HTTP 缓存（客户端已 `enableHttpCache: false`），
   所以重启就够、不用清缓存目录。取证办法见主仓 `docs/webf/handoff.md` 第 14 条。
2. **cupertino button 只渲染 `childNodes.first`（读源码可确证）。** 「图标 + 文字」两个并列
   子节点时文字被整段丢弃。所以 `SlButton.vue` **不开放插槽**，把文字做成 `label` prop、
   图标做成 `icon` prop，由组件自己拼出「恰好一个子元素 + 文字再包一层」的结构，让调用方
   没机会违反。（曾经还记过一条「裸文本子节点画不出来」，后来查明那次观察取自第 1 条说的
   旧 bundle，已撤回 —— upstream `button.md` 的快速上手示例就是裸文本。）
3. **cupertino input 的装饰来自 CSS，所以 CSS 上写 `border` 会画出两个框。**
   `CupertinoTextField` 直接把 `renderStyle.decoration` 当自己的 `decoration`，而 WebF 的
   render box 也画同一份。故 `.dl-input-native` **只写尺寸**，装饰留给 widget。
4. **HTML 回落分支也必须真机看一遍。** 本轮 M3 开关选中态的滑块位置算错了 2px 并溢出轨道 ——
   滑块的 `top/left` 是相对轨道的 **padding box** 算的，而轨道有 2px 边框，可用区是 48×28
   不是 52×32。这条跟 WebF 无关，纯 CSS。
5. **`blur` 会重复派发，所以「改完即存」必须自带「值真的变了才提交」的守卫。**
   `<flutter-cupertino-input>` 的 blur 是
   `_focusNode.addListener(() { hasFocus ? dispatch('focus') : dispatch('blur') })` ——
   **不记上一次的焦点态**，未聚焦状态下任何一次 FocusNode 通知都会再派发一个 `blur`。
   实测是十几条内容完全相同的 `POST /api/settings` 且界面发卡。守卫在 `store.js` 的
   `saveSettings()`：按**提交后**的语义算指纹，与已保存的一致就直接返回。
   指纹和提交体共用 `api.js` 的 `normalizeInterval()`，否则「指纹按 `-4` 算、提交的是 `0`」
   会让守卫永远判定「有改动」。
6. **⛔ WebF 下的 `<select>` 不能用来做双向绑定，下拉最终改成了自绘的内联面板。**
   症状是「换歌单/艺术家/专辑都不重筛列表，只有关键字搜索正常」，不报错不打日志。
   根因：WebF 的 `HTMLSelectElement` 只暴露 `value` / `selectedIndex` / `disabled` /
   `multiple` / `required`，**没有 `options`**，于是 Vue 的 `vModelSelect` 指令
   （`Array.prototype.filter.call(el.options, o => o.selected)`）直接抛 TypeError——
   **任何框架**的 `<select>` 双向绑定都会踩。绕开 v-model 改成显式 `@change` 读 `el.value`
   **实测仍然不通**（剩下的断点在 Dart 侧、从 JS 观测不到）。
   **这个坑返工了三轮**，每一轮的教训都不一样，按顺序记：
   - ①「下拉显示更新了」**不等于**「数据通了」。WebF 的 select 是 WidgetElement，
     `_openOptionsMenu()` 先 `widgetElement.selectedIndex = result` 改自己的内部态、
     再派发 `change`，显示的文字由 Flutter 侧的 `_displayLabel` 维护，与 JS 收不收到值无关。
   - ② 找到一个足以解释症状的断点，**不等于**找到了全部断点。第二轮只修了 `options`
     缺失（改成显式 `@change`），真机照旧不通。
   - ③ 官方的 `<flutter-cupertino-action-sheet>` 是 webf-ui 给「从 N 个里选一个」的正解
     （31 个元素里没有 picker，`flutter-cupertino-picker` 在 `installWebFCupertinoUI()`
     里是注释掉的），但它 `show()` 的实现是 `state?._showActionSheetImpl(args)` ——
     state 还没建立时是**静默 no-op**，「点了什么都不发生」与「正常工作」在 JS 侧
     无法区分。同类不确定还有：方法能否被 `typeof` 探到（属性与方法在 Dart 侧是两条
     独立查找路径）、`CustomEvent.detail` 过桥后是对象还是字符串。
   现在的实现只用**已经在本页跑通**的原语：cupertino button 的 click + 常规流块盒 +
   普通 `div` 的 click（DOM click 由 WebF 唯一那个全局 tap recognizer 派发）。
   刻意**不用**浮层（要赌层叠与命中测试，面板得盖在歌曲列表那个 Flutter widget 上）、
   **不嵌** `<webf-list-view>`（要赌 tap 穿过 Flutter ListView 的手势竞技场）、
   **不靠 overflow 滚动**（选项多时由页面自身滚动）。代价是展开时把下方内容顶下去。
   非 WebF 路径继续用原生 `<select>`（浏览器里完全正常，且无障碍最好）。
7. **图标画成 `?` 方框是客户端缺字体，不是图标名写错。**
   `webf_cupertino_ui` 没有依赖 `cupertino_icons`，而它的图标全是
   `IconData(..., fontPackage: 'cupertino_icons')` —— 客户端不补这条依赖就没有那个 ttf。
   判据：**看得见问号 = 名字对、字体缺；什么都看不见 = 名字错**（`icon.dart` 对查不到的
   `type` 返回 `SizedBox.shrink()`）。已在 `songloft-player/pubspec.yaml` 补上。

#### 规避掉的 WebF 缺陷

上一版（v2026.8.3）用 CSS Grid 伪表格，为此踩了一串 WebF 缺陷。改用 webf-ui 后，
其中和布局相关的整批不再命中；剩下几条仍然要主动规避，改代码前请先读：

| 缺陷 | 现在怎么处理 |
|---|---|
| `<table>` 家族标签**一个都没注册**（退化成 `display:block`）；`display:table` 更糟（`CSSDisplay` 无 table 取值，落到 `inline`） | 不用 table。列表是 `<webf-list-view>` + flex 行 |
| grid `auto` 行高**在 min-content 宽度下**测量子项高度（CJK 每字都是断行点 → 实测一行 281px，自然高 41px） | 行内布局用 **flex 不用 grid**；单元格仍保留 `white-space: nowrap` + 省略号，且**必须写在随页面加载的 CSS 里** |
| `position: sticky` **全局不生效**（不限 grid，页面级最标准的配置也整量滚走） | 表头是列表容器的**兄弟**节点，结构上不需要贴住 |
| `display: none` 的元素**仍会挂一个 0 尺寸 RenderConstrainedBox** | 隐藏一律用 `v-if` 条件渲染 |
| **不对 `position: fixed` 元素应用 `transform` 位移** | snackbar 用「外层拉满 + 内层 margin auto」居中，不碰 transform；也因此**没有**复用宿主 `common.css` 的 `.snackbar`（那一份靠 transform 定位） |
| 无界约束下解析 flex 会触发 `Infinity or NaN toInt` | `<webf-list-view>` 关掉 `shrink-wrap` 后给了确定高度；flex spacer 带 `min-width` |
| `max()` / `min()` 未实现（`clamp()` 可用，参数里能塞 `var()`） | 列表高度用 `clamp()` |
| `<base href>` 不被采纳 | 资源引用一律 `static/xxx` 形式（由 `frontend/vite.config.js` 的 html-transform 保证） |
| **`flex-wrap: wrap` 容器里子项的 flex base size 被测成容器宽度** → 每项独占一行并铺满（2026-08-05 实测）。WebF 给这个 bug 打过补丁（源码里直接引 CSS Flexbox §9.2），但入口条件是 `child is RenderFlowLayout` —— **WidgetElement（`RenderWidget`）与嵌套 flex 容器（`RenderFlexLayout`）都不在覆盖范围内** | 见 `style.css` 约束 ⑦：WidgetElement 内部的内容层用 `inline-flex`（`.dl-btn-inner`）；嵌套 flex 容器给显式 `width`（`.dl-filter-item`）。**不能**用 `max-width` 去夹（那会把无界约束透进 hosted Flutter 子树，撞上面那条 `Infinity or NaN toInt`），也**不能**只改成 `nowrap`（base size 照旧，按钮会等宽铺开）。列表行 `.dl-row` 免疫，因为它是 `nowrap` + 每列显式 flex 比例 |
| **`[plugin][console]` 转发在 controller 命中缓存时静默失效**（`onJSLog` 在 `createController` 里赋值，而那条路径不跑） | 别把「日志里没有」当成「代码没跑」。布局问题用**截图量像素**取证；`engine.js` 末尾的 `build=` 指纹仍保留，但它只有在日志真能出来时才有用 |
| **cupertino button 的 `variant` 配色与宿主 M3 对不上**：`CupertinoButton.filled` 的底色固定是 `CupertinoTheme.primaryColor`（构造器不接受 color），圆角默认还是直角 | 模板里**不传** `variant`，一律走 `plain` 分支，底色/圆角/边框/前景色全由 CSS 给（`.dl-btn-native*`），与 `common.css` 的 `.btn-*` 语义对齐 |
| **`padding` 在 WidgetElement 上被应用两次**（WebF 内缩 content box + button.dart 又交给 CupertinoButton）；**`min-height` 不决定盒子高度**（只喂给 widget 自绘的 `minimumSize`，盒子高度是 `getBoxSize(childSize)`） | `padding` 写目标值的**一半**（M3 的 24px → `0 12px`）；高度用 `height` 不用 `min-height`。两者都靠量像素校准，见 `style.css` 的 `.dl-btn-native` 注释 |
| **`width: 100%` 在 shrink-to-fit 的绝对定位父盒里解不出来**，静默退回内容宽度 —— 表现是下拉面板里选中行的背景只染了文字那么宽 | 让**父盒**的宽度先变确定：`position:absolute` 上同时写 `left:0` + `right:0` + `width:auto`，WebF 会按 CSS abs-non-replaced 算法从包含块 padding box 解出宽度（`css/render_style.dart:3203`）。之后子项用 `width:auto` 的块级 fill-available 撑满即可，**不要**再写百分比 |
| **浮层的祖先链上不能有 `overflow: hidden`** —— 会把 `position:absolute` 的下拉面板在那个盒子边界整段切掉 | `.dl-card` 刻意不写 overflow（留空规则 + 注释防止加回来）；面板另加 `max-height` + `overflow-y` 作降级保护 |
| **⚠️ flex 容器里再套 flex 容器 → 整个子树一个像素都不画**（同上那个 base size 缺陷的另一副面孔，但后果严重得多）。机制：Flutter 的 `RenderObject._paintWithContext` 开头就是 `if (_needsLayout) return;`，**停在 needsLayout 的 render object 被静默跳过绘制**；WebF 的 flex 用「以放松约束试排一遍」测 base size，嵌套 flex 子项（`RenderFlexLayout`）不在它 §9.2 补丁覆盖范围内。**无异常、无日志**，且 DOM 与 `getBoundingClientRect()` 全部正常，光看结构完全查不出来 | 见 `style.css` 约束 ⑧：**竖向堆叠一律用块流**（`display:block` + `margin`），不用 `flex-direction:column` + `gap` —— 两者视觉等价，但块流不碰那套测量。横向 flex 行（`.dl-filter-bar` / `.dl-toolbar` / `.dl-switch-row` / `.dl-row`）保留，问题从来在**子节点**也是 flex 容器 |
| **受控文本框被外部改写会让整页白屏**（debug 构建）：`val` 变化 → `RenderEditable.text=` → `markNeedsLayout`，而同一帧 MouseTracker 的 hit test 打到同一个 `RenderEditable` → `Text layout not available` → 异常把 `_debugDuringDeviceUpdate` 永久置位 → 每帧刷 `mouse_tracker.dart:199` 断言。**触发要求鼠标正停在页面上**，所以截图脚本永远撞不到 | `ui/SlInput.vue` 原生分支**非受控**：`val` 只在挂载时给一次初值，之后只读 `input` 事件、永不回写；外部改显示值（间隔规范化、切歌单清关键字）改 `:key` **重挂载**，新值走 mount 不走 update。输入框仍等 `state.settingsLoaded` 后再挂载（非受控下挂载初值是唯一一次赋值机会）。换 HTML `<input>` 绕不开——WebF 的 `<input>` 底下同样是 Flutter `TextField` |
| **大规模 DOM 拆除 + 鼠标停在页面上 = 同一类白屏的另一张脸**（debug 构建，2026-08-05 实测）：v-if 换页把整张主页（含 `<webf-list-view>` 与全部行）同一帧卸载，WebF 留下已 dispose 却仍被引用的 render object —— paint 访问到（`object.dart` 的 `!_debugDisposed`）、样式对象查不到盒子（`transform.dart` 的 `hasRenderBox()`）、MouseTracker hit test 打到它们，异常同样把 `_debugDuringDeviceUpdate` 置位 → 每帧刷断言 | 设置页改为**全屏覆盖层**（`.dl-page-overlay`），主页始终挂载：打开设置是纯挂载（无拆除），关闭只卸载设置页几件控件（与下拉面板开合同规模，从未出事）。见 `App.vue` 注释 |

#### 相比上一版恢复的两处

上一版的 CSS Grid 把单元格展平、DOM 里不存在「行」，因此丢掉了整行 hover 与选择项的
无障碍上下文。现在行是真实的行元素，两者都回来了。

## 开发

```bash
npm install
npm run dev    # 开发模式（热重载）
npm run build  # 构建生产版本 → dist/downloader.jsplugin.zip
```

### 目录结构

```
src/main.ts          后端插件逻辑（QuickJS 沙盒内运行，注册 /api/* 路由）
frontend/            前端源码（Vue 3 + Vite）
  src/engine.js      引擎特性探测（useNativeUI / useNativeListView）
  src/api.js         调用后端 /api/* 的薄封装
  src/store.js       全局状态与 actions
  src/ui/            webf-ui 包装层 —— 引擎分叉只在这一层
  src/views/         业务区块
  public/icon.svg    插件图标（Vite 原样拷到产物根）
static/              ⚠️ Vite 产物（build.outDir），**已 gitignore，不要手改**
```

**`static/` 不再手写。** `npm run build` 时 `@songloft/plugin-builder` 会先在 `frontend/`
里跑 `npm install`（仅当 `node_modules` 缺失）+ `npm run build`，Vite 把产物写进 `static/`，
然后 builder 继续处理（esbuild 重打成 IIFE、注入内容 hash）。

因此 **`@songloft/plugin-builder` 必须 ≥ 2.13.1** —— `frontend/` 构建钩子是那个版本才有的。
更早的版本会**静默跳过**整个前端构建，产出一个没有前端资源的包。

`frontend/vite.config.js` 里有三条不能改的约束（产物必须是单个 `js/app.js`、文件名不带
hash、HTML 引用必须是 `static/xxx` 形式），每条的理由都写在那个文件的头注释里。

### 本地反复构建时记得 `rm -rf dist`

builder 的临时目录是 `dist/_build/`（`@songloft/plugin-builder` 2.13.1 的
`buildDir = join(outDir, '_build')`），它只 `mkdirSync(recursive)` **不清理**，而往
`dist/_build/static/` 是用增量拷贝（`cpSync`）。所以本地改过 CSS/JS 之后重新构建，
上一次那份**带旧内容 hash 的文件会残留**并一起被打进 zip —— 表现是包里出现两个
`style.<hash>.css`。`index.html` 引用的仍是新的那份，功能不受影响，只是包白白变大、看着费解。

```bash
rm -rf dist && npm run build   # 本地要产出干净的包时这么跑
```

CI 是全新 checkout、`dist/` 不会预先存在，所以**正式发布不受影响**。

## License

Apache-2.0
