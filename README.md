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

### 关于歌曲列表的实现（CSS Grid，不是 `<table>`）

本插件声明了 `"renderEngine": "webf"`，插件页在部分客户端上由 WebF 渲染。WebF 的元素注册表里
`table` / `thead` / `tbody` / `tr` / `th` / `td` **一个都没有**，会全部退化成 `display:block`
的未知元素 —— 6 列表格竖排成 6 行、几十首歌变成几百行无标题文本。因此歌曲列表改用 **CSS Grid**
实现（普通浏览器、系统 WebView、WebF 三条渲染路径共用同一套 HTML/CSS/JS，无引擎分叉）。

**表头留在纵向滚动容器外面，刻意不用 `position: sticky`。** 实测 WebF 下
`position: sticky` **压根不生效**（不限于 grid 路径：页面级最标准的配置也整量滚走），
所以结构上干脆让它不需要 sticky —— `.table-wrap` 管横向滚动（表头与数据区**都**在里面，
横向必须一起滚才不会错列），`.tbl-scroll` 管纵向滚动且**只包数据区**。
这个结构在浏览器 / 系统 WebView 下同样正确（甚至更简单），仍是一套代码通吃三条路径。
代价是数据区的纵向滚动条只吃它自己的内容宽度、表头吃不到（桌面浏览器差十几像素，
WebF 与移动端是覆盖式滚动条、差 0），由 `app.js` 的 `syncScrollbarGutter()` 量出真值写进
`--sl-sbw`、表头 `padding-right` 抵掉。

**单元格是 `white-space: nowrap` + 省略号，不再换行。** 除了「这才是表格该有的观感」，
它在 WebF 下还是**必要条件**：WebF 的 grid `auto` 行高是**在 min-content 宽度下**测量子项
高度的，可换行时 CJK 每个字都成断行点 —— 实测一行占 281px（同内容自然高 41px）、表头 72px，
可见区只装得下 1 行，用户看到的是一张几乎空的表。长内容的完整文本放在单元格的 `title` 属性上
（桌面端悬停可见）。

改造带来两处**明确的降级**，如实记录：

1. **hover 高亮从「整行」降级为「单个单元格」**。Grid 展平后 DOM 里不存在「行」这个元素，
   纯 CSS 无法表达整行高亮。移动端本来没有 hover，桌面端仅影响观感。
2. **表格的无障碍语义丢失**。屏幕阅读器不再能按表格模式导航（行 / 列 / 表头关联）。
   缓解：每行的复选框补了 `aria-label="选择 <歌名>"`，选择操作本身仍能被独立朗读；
   列表容器带 `role="group" aria-label="下载列表"`。
   注意在 WebF 路径下这些语义**本来就已经全丢了**（未注册标签没有任何表格语义），
   所以这一条只相对「浏览器 / WebView 路径」算回退。

列宽机制、滚动条补偿、以及「为什么不用 `<webf-table>`、不用 `display:table`、为什么表头必须是
独立容器、为什么不用 sticky」的完整判据写在 `static/css/style.css` 的「列表」一节注释里，
改那段 CSS 前请先读。

## 开发

```bash
pnpm install
pnpm run dev   # 开发模式（热重载）
pnpm run build # 构建生产版本
```

## License

Apache-2.0
