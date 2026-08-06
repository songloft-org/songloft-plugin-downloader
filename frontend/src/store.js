import { reactive, computed, ref, watch } from 'vue';
import * as api from './api.js';
import { openToken } from './ui/select-open-state.js';

// 单页应用、单份全局状态、无跨路由复用 —— 刻意不引 Pinia，一个模块级 reactive 够了。

export const DEFAULT_TEMPLATE = 'downloads/{artist}-{album}/{title}';

export const state = reactive({
  settings: {
    pathTemplate: '',
    // 刻意存**字符串**而不是数字：这个值绑在输入框上，若在回写时做 Number() 转换，
    // 用户输入 "1" 的中间态就会被改写。提交时才 parseInt。
    downloadInterval: '0',
    embedMetadata: true,
    autoDownload: false,
  },
  /**
   * 设置是否已从服务端读回。**用途不是显示 loading，而是非受控输入的正确性前提**：
   * WebF 原生输入挂载后**永不回写** val（回写会走 `RenderEditable.text=` →
   * `markNeedsLayout`，与同帧 MouseTracker 的 hit test 相撞出 `Text layout not
   * available` → `!_debugDuringDeviceUpdate` 每帧刷屏、整页白屏，2026-08-05 实测，
   * 机制见主仓 docs/webf/handoff.md 第 25 条）。挂载初值是唯一一次赋值机会 ——
   * 所以必须等值到齐再挂载，否则输入框会永久显示空值。
   * 详见 views/SettingsPage.vue 与 ui/SlInput.vue 的注释。
   */
  settingsLoaded: false,
  /**
   * 设置读取失败。与 `settingsLoaded` 是**两个**独立的标志，不能合并成三态枚举：
   * `settingsLoaded` 的语义是「值已到齐、可以挂载输入了」，它必须保持
   * 「只有真正拿到值才为 true」。以前失败时只是 `return`，于是 `settingsLoaded`
   * 永远 false → 两个输入框**永不挂载**，用户看到的是两块空白，且与「还在加载」
   * 完全无法区分。加这个字段就是为了把那个死角显式化成「失败 + 重试」。
   */
  settingsError: null,
  playlists: [],
  songs: [],
  /** 歌曲列表是否在首次加载中。用于区分「还没加载」与「真的没有歌」。 */
  songsLoading: true,
  /** 歌曲列表加载失败的消息。null = 没失败。 */
  songsError: null,
  /**
   * 插件内的两级页面。`'main'` 列表主体 / `'settings'` 独立设置页。
   *
   * 设置页是**全屏覆盖层**，主页始终挂载（App.vue 注释：v-if 换页的大规模拆除会撞
   * WebF 的 dispose 竞态 → 整页白屏）。覆盖层由 SettingsPage 的 v-if 挂卸，
   * 打开 = 纯挂载、关闭 = 小规模拆除，两条路径都已被实证安全。
   *
   * ⚠️ **刻意不用 `history.pushState` 表达这一层**。WebF 不实现 SPA history 路由，
   * 而宿主的 requestBack 是按 `history.length > 1` 判断「返回键已被消费」的 ——
   * pushState 之后宿主以为消费了、WebF 又不 fire popstate，页面毫无变化，
   * **返回键变成死键**。改用宿主提供的 `SongloftPlugin.onHostBack` 钩子
   * （见 App.vue），语义准确且无副作用。
   */
  page: 'main',
  /** songId -> {song_id, status, ...}，来自批量下载进度里的 results */
  dlStatus: {},
  filter: {
    playlistId: '', // '' = 全部歌曲；服务端筛选，改了要重新 loadSongs
    artist: '', // 以下三项都是纯客户端筛选
    album: '',
    keyword: '',
  },
  /** null = 无进行中的批次 */
  progress: null,
  snackbar: null, // { text, type }
});

// Set 在 Vue 3 里响应式是「方法级」的：add/delete 会触发依赖它的 computed，
// 但为了让模板里的 selected.has(id) 稳定地被追踪，统一用 ref + 整体替换。
export const selected = ref(new Set());

/**
 * 关键字输入框的**重挂载代数**。WebF 原生输入是非受控的（ui/SlInput.vue 注释：
 * 挂载后永不回写 val，回写会触发 RenderEditable 白屏崩溃链），所以「切歌单时清空
 * 关键字」这种**外部清空**没法靠 store → 绑定刷回去，只能让 FilterBar 的关键字
 * 输入框 `:key` 挂这个代数、清空时 +1，带着空值重挂载（mount 路径安全）。
 */
export const keywordGen = ref(0);

function replaceSelected(mutate) {
  const next = new Set(selected.value);
  mutate(next);
  selected.value = next;
}

/** 当前客户端筛选条件下可见的歌曲。与旧版 visibleSongs() 语义逐条一致。 */
export const visibleSongs = computed(() => {
  const kw = state.filter.keyword.trim().toLowerCase();
  return state.songs.filter((s) => {
    if (state.filter.artist && (s.artist || '') !== state.filter.artist) {
      return false;
    }
    if (state.filter.album && (s.album || '') !== state.filter.album) {
      return false;
    }
    if (kw) {
      const hay = `${s.title || ''} ${s.artist || ''} ${s.album || ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
});

// 筛选条件 → 可见歌曲数，落一行日志。
//
// 为什么值得常驻：这一页的下拉在 WebF 下换过两次实现，症状每次都是「点了没反应」
// 且**不报错**。而「控件把值 emit 出来了」与「列表真的重筛了」是两件事，只有这一行
// 能同时证明两者 —— 它既覆盖三个下拉，也覆盖关键字输入（后者一直是好的，正好当对照组）。
// 日志经客户端 `onJSLog` 转发成 `[plugin][console] …`，是真机上唯一的取证通道。
watch(
  () => [
    state.filter.playlistId,
    state.filter.artist,
    state.filter.album,
    state.filter.keyword,
  ],
  ([playlistId, artist, album, keyword]) => {
    if (typeof console === 'undefined' || !console.log) return;
    console.log(
      '[downloader] filter changed: playlist=' +
        JSON.stringify(playlistId) +
        ' artist=' +
        JSON.stringify(artist) +
        ' album=' +
        JSON.stringify(album) +
        ' keyword=' +
        JSON.stringify(keyword) +
        ' → visible=' +
        visibleSongs.value.length +
        '/' +
        state.songs.length,
    );
  },
);

/** 依据当前 songs 去重排序出的艺术家选项 */
export const artistOptions = computed(() =>
  [...new Set(state.songs.map((s) => s.artist).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh'),
  ),
);

export const albumOptions = computed(() =>
  [...new Set(state.songs.map((s) => s.album).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'zh'),
  ),
);

/** 表头全选复选框的态：当前可见歌曲是否已全选 */
export const allVisibleSelected = computed(() => {
  const list = visibleSongs.value;
  return list.length > 0 && list.every((s) => selected.value.has(s.id));
});

// ── actions ────────────────────────────────────────────────────────────────

/**
 * 切页。切之前先收起可能展开的下拉浮层：设置覆盖层会把主页整个盖住，
 * 留着展开的面板在底下，返回主页时会看到一个无主的悬浮面板；且 `openToken`
 * 是**模块级**互斥标记，不清就会继续挡其它下拉的展开。
 */
function navigate(page) {
  openToken.value = null;
  state.page = page;
}

export function goSettings() {
  navigate('settings');
}

export function goMain() {
  navigate('main');
}

export function showSnackbar(text, type) {
  state.snackbar = { text, type };
  setTimeout(() => {
    // 只清掉「还是这一条」的 snackbar，避免连续两条时前一条的定时器把后一条抹掉
    if (state.snackbar && state.snackbar.text === text) state.snackbar = null;
  }, 3000);
}

export async function loadSettings() {
  state.settingsError = null;
  const r = await api.fetchSettings();
  // 宿主的 apiGet 已经吞掉网络错误并返回 null，所以 null 就是「失败」。
  // 以前这里是裸 `return`，`settingsLoaded` 于是永远 false、输入框永不挂载（见字段注释）。
  if (!r) {
    state.settingsError = '读取设置失败，请检查网络后重试';
    return;
  }
  state.settings.pathTemplate = r.path_template || '';
  state.settings.embedMetadata = r.embed_metadata !== false;
  state.settings.downloadInterval = String(r.download_interval ?? 0);
  state.settings.autoDownload = !!r.auto_download;
  // 刚从服务端读回来的这份就是「已保存态」，登记上，否则首屏随便一次 blur
  // 就会把原样的值再 POST 回去（见 saveSettings）。
  savedFingerprint = settingsFingerprint();
  // 必须**最后**置位：输入框以它为挂载条件，早于赋值置位就又变成 update 路径了。
  state.settingsLoaded = true;
}

/// 已持久化那一份的指纹。null = 还没读到过服务端的值。
let savedFingerprint = null;

/** 按**提交后的语义**取指纹：间隔字段存的是字符串，'1' 与 '01' 提交出去是同一个值。 */
function settingsFingerprint() {
  const s = state.settings;
  return JSON.stringify([
    s.pathTemplate,
    api.normalizeInterval(s.downloadInterval),
    s.embedMetadata,
    s.autoDownload,
  ]);
}

/**
 * 保存设置。**值没变就不发请求。**
 *
 * 这个守卫不是省流量，是修 bug：文本框的「改完即存」在 webf-ui 分支上挂在
 * `blur` 事件上，而 `<flutter-cupertino-input>` 的 blur 是这样派发的
 * （webf_cupertino_ui 0.4.1 `input.dart` 的 `initState`）：
 *
 *     _focusNode!.addListener(() {
 *       if (_focusNode!.hasFocus) dispatchEvent(CustomEvent('focus'));
 *       else                      dispatchEvent(CustomEvent('blur'));
 *     });
 *
 * 注意它**没有记住上一次的焦点态** —— FocusNode 只要在未聚焦状态下发出任何一次
 * 通知，就会再派发一个 `blur`。所以「blur == 用户改完了一个值」这个前提不成立，
 * 实测日志里出现过十几次内容完全相同的 `POST /api/settings`。
 * 与其去猜 FocusNode 什么时候会通知，不如让「值没变」这件事本身变得无害。
 *
 * 顺带覆盖了开关与 startDownload 两条调用路径，它们同样不该重复提交。
 */
export function saveSettings() {
  const fp = settingsFingerprint();
  if (fp === savedFingerprint) return Promise.resolve(null);
  // 乐观登记：请求还在飞的时候又来一次 blur 不该重复提交。失败则回滚，
  // 让下一次改动（或下一次 blur）能重试。
  const prev = savedFingerprint;
  savedFingerprint = fp;
  return Promise.resolve(api.saveSettings(state.settings)).catch((e) => {
    savedFingerprint = prev;
    throw e;
  });
}

export async function loadPlaylists() {
  const r = await api.fetchPlaylists();
  state.playlists = r && r.playlists ? r.playlists : [];
}

export async function loadSongs() {
  state.songsLoading = true;
  state.songsError = null;
  const r = await api.fetchSongs(state.filter.playlistId);
  // null = 请求失败（宿主的 apiGet 吞了错误）。区分「失败」与「真的没有歌」，
  // 否则断网时用户看到的是「没有可下载的网络歌曲」这种误导性空态。
  if (!r) {
    state.songsError = '加载歌曲失败，请检查网络后重试';
    state.songsLoading = false;
    return;
  }
  state.songs = r.songs || [];
  state.songsLoading = false;
  selected.value = new Set();
  // 选项集合变了，把已失效的筛选值清掉（旧版 rebuildFacets 的同一段语义）
  if (!artistOptions.value.includes(state.filter.artist)) {
    state.filter.artist = '';
  }
  if (!albumOptions.value.includes(state.filter.album)) {
    state.filter.album = '';
  }
}

export function toggleSelect(id, on) {
  replaceSelected((set) => (on ? set.add(id) : set.delete(id)));
}

/** 全选/取消全选，作用范围是**当前可见**歌曲（与旧版一致） */
export function toggleSelectAllVisible(on) {
  const list = visibleSongs.value;
  const target = on === undefined ? !allVisibleSelected.value : on;
  replaceSelected((set) => {
    for (const s of list) {
      if (target) set.add(s.id);
      else set.delete(s.id);
    }
  });
}

export async function changePlaylist(id) {
  state.filter.playlistId = id;
  // 换歌单时清掉客户端筛选：选项集合整体变了，留着旧值只会得到空列表
  state.filter.artist = '';
  state.filter.album = '';
  if (state.filter.keyword !== '') {
    state.filter.keyword = '';
    // 原生输入是非受控的，清空必须靠重挂载才能反映到 DOM（见 keywordGen 注释）
    keywordGen.value++;
  }
  await loadSongs();
}

export async function refresh() {
  state.dlStatus = {};
  await loadSongs();
}

let pollTimer = null;

/**
 * 轮询批量下载进度。
 *
 * @param {boolean} autoClearSelection 完成后是否清空选中。首屏「续上正在跑的批次」
 *   时传 false —— 那个批次不是本次会话发起的，选中集本来就是空的，清它没有意义，
 *   而如果用户此时已经勾了新的歌，清掉就是数据丢失。
 */
export function startPolling(autoClearSelection = true) {
  stopPolling();
  pollTimer = setInterval(async () => {
    const r = await api.fetchProgress();
    if (!r || !r.active) {
      stopPolling();
      return;
    }
    state.progress = {
      current: r.current,
      total: r.total,
      success: r.success,
      failed: r.failed,
      done: !!r.done,
    };
    if (r.results) {
      const next = { ...state.dlStatus };
      for (const res of r.results) next[res.song_id] = res;
      state.dlStatus = next;
    }
    if (r.done) {
      stopPolling();
      showSnackbar(
        `下载完成：${r.success} 成功，${r.failed} 失败`,
        r.failed > 0 ? 'error' : 'success',
      );
      setTimeout(() => {
        state.progress = null;
        if (autoClearSelection) selected.value = new Set();
        loadSongs();
      }, 2000);
    }
  }, 800);
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function startDownload() {
  if (selected.value.size === 0) return;
  const ids = [...selected.value];
  await saveSettings();
  await api.clearBatch();
  await api.startBatch(ids);
  state.progress = { current: 0, total: ids.length, success: 0, failed: 0, done: false };
  startPolling(true);
}

/** 首屏检查是否有正在跑的批次 —— 刷新页面不丢进度。 */
export async function checkActiveDownload() {
  const r = await api.fetchProgress();
  if (r && r.active && !r.done) {
    state.progress = {
      current: r.current,
      total: r.total,
      success: r.success,
      failed: r.failed,
      done: false,
    };
    startPolling(false);
  }
}
