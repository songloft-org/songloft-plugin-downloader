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
  src/api.js         调用后端 /api/* 的薄封装
  src/store.js       全局状态与 actions
  src/layout.js      打开方式判定（tab/fullscreen/browser）与 resize 钩子
  src/ui/            表单控件薄包装（统一走宿主 components.css 组件类）
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
