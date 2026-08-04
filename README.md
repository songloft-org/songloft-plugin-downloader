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

- **表单控件**用 `webf_cupertino_ui` 提供的原生元素（`<flutter-cupertino-button>`
  `<flutter-cupertino-input>` `<flutter-cupertino-switch>` `<flutter-cupertino-checkbox>`
  `<flutter-cupertino-icon>`）
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
`_controller.text != val` 就整段替换文本并把光标推到末尾），所以数字字段在 store 里
存字符串、提交时才 `parseInt`，不能在回写路径上做类型转换。

#### 内容与装饰的三个坑（首轮真机才暴露的）

上面那两条是读源码读出来的；下面这三条是**页面真的画出来之后**才发现的，共同点是
**画出了一个东西但不对**，不报错、不打日志：

1. **cupertino button 只渲染 `childNodes.first`（读源码可确证），且裸文本节点画不出来
   （实测现象，机理未查实）** —— 两条叠加表现为「按钮是个空盒子」。所以 `SlButton.vue`
   **不开放插槽**，把文字做成 `label` prop、图标做成 `icon` prop，由组件自己拼出「恰好一个
   子元素 + 文字再包一层」的结构，让调用方没机会违反。两条的证据与存疑之处都写在那个文件的
   模板注释里。
2. **cupertino input 的装饰来自 CSS，所以 CSS 上写 `border` 会画出两个框。**
   `CupertinoTextField` 直接把 `renderStyle.decoration` 当自己的 `decoration`，而 WebF 的
   render box 也画同一份。故 `.dl-input-native` **只写尺寸**，装饰留给 widget。
3. **HTML 回落分支也必须真机看一遍。** 本轮 M3 开关选中态的滑块位置算错了 2px 并溢出轨道 ——
   滑块的 `top/left` 是相对轨道的 **padding box** 算的，而轨道有 2px 边框，可用区是 48×28
   不是 52×32。这条跟 WebF 无关，纯 CSS。

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

### 本地反复构建时记得 `rm -rf build`

builder **不会在构建前清理 `build/` 目录**，而它往 `build/static/` 是用增量拷贝
（`cpSync`）。所以本地改过 CSS/JS 之后重新构建，上一次那份**带旧内容 hash 的文件会残留**并
一起被打进 zip —— 表现是包里出现两个 `style.<hash>.css`。`index.html` 引用的仍是新的那份，
功能不受影响，只是包白白变大、看着费解。

```bash
rm -rf build dist && npm run build   # 本地要产出干净的包时这么跑
```

CI 是全新 checkout、`build/` 不会预先存在，所以**正式发布不受影响**。

## License

Apache-2.0
