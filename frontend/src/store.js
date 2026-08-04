import { reactive, computed, ref } from 'vue';
import * as api from './api.js';

// 单页应用、单份全局状态、无跨路由复用 —— 刻意不引 Pinia，一个模块级 reactive 够了。

export const DEFAULT_TEMPLATE = 'downloads/{artist}-{album}/{title}';

export const state = reactive({
  settings: {
    pathTemplate: '',
    // 刻意存**字符串**而不是数字：这个值双向绑在输入框上，而 webf-ui 的
    // <flutter-cupertino-input> 是受控的（build() 里 `_controller.text != val`
    // 就整段替换文本并把光标塞到末尾）。若我们在回写时做 Number() 转换，
    // 用户输入 "1" 的中间态就会被改写、光标跳到末尾。提交时才 parseInt。
    downloadInterval: '0',
    embedMetadata: true,
    autoDownload: false,
  },
  playlists: [],
  songs: [],
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

export function showSnackbar(text, type) {
  state.snackbar = { text, type };
  setTimeout(() => {
    // 只清掉「还是这一条」的 snackbar，避免连续两条时前一条的定时器把后一条抹掉
    if (state.snackbar && state.snackbar.text === text) state.snackbar = null;
  }, 3000);
}

export async function loadSettings() {
  const r = await api.fetchSettings();
  if (!r) return;
  state.settings.pathTemplate = r.path_template || '';
  state.settings.embedMetadata = r.embed_metadata !== false;
  state.settings.downloadInterval = String(r.download_interval ?? 0);
  state.settings.autoDownload = !!r.auto_download;
  // 刚从服务端读回来的这份就是「已保存态」，登记上，否则首屏随便一次 blur
  // 就会把原样的值再 POST 回去（见 saveSettings）。
  savedFingerprint = settingsFingerprint();
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
  const r = await api.fetchSongs(state.filter.playlistId);
  state.songs = r && r.songs ? r.songs : [];
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
  state.filter.keyword = '';
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
