// 与插件后端（src/main.ts 的 router）通信。
//
// 走宿主注入的 window.SongloftPlugin.apiGet / apiPost —— 它们负责补 baseURL、
// 带上 access_token、以及在 WebF / WebView / iframe 三条路径上统一行为。
// 刻意不用裸 fetch：鉴权与 base path 的处理都在宿主那一层。
//
// 端点与字段名与 src/main.ts **一一对应**，本次重写没有改动任何后端契约。

const P = () => window.SongloftPlugin;

export const EP = {
  settings: '/api/settings',
  playlists: '/api/playlists',
  songs: '/api/songs',
  batch: '/api/download-batch',
  batchProgress: '/api/download-batch/progress',
  batchClear: '/api/download-batch/clear',
};

/** GET，失败返回 null（宿主的 apiGet 已经吞掉网络错误并返回 null）。 */
export function get(path) {
  return P().apiGet(path);
}

export function post(path, body) {
  return P().apiPost(path, body);
}

export function fetchSettings() {
  return get(EP.settings);
}

/**
 * 把间隔输入框里的原始字符串收敛成合法秒数（为什么存字符串见 store.js）。
 *
 * 负数与非数字一律归 0。后端对 `download_interval` 不做范围校验，负值会被原样
 * 存下来（实测截图里出现过 `-4`），而它最终进的是批量下载的 sleep 参数。
 * 这里是唯一收口点：`store.js` 算指纹和本文件拼提交体都用它，所以不会出现
 * 「指纹按 -4 算、提交的是 0」这种永远判定为「有改动」的死循环。
 */
export function normalizeInterval(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function saveSettings(s) {
  return post(EP.settings, {
    path_template: s.pathTemplate,
    embed_metadata: s.embedMetadata,
    // 输入框里存的是原始字符串（见 store.js 的说明），提交时才转数字
    download_interval: normalizeInterval(s.downloadInterval),
    auto_download: s.autoDownload,
  });
}

export function fetchPlaylists() {
  return get(EP.playlists);
}

/** playlistId 为空串表示「全部歌曲」，此时按 limit=500 拉一页。 */
export function fetchSongs(playlistId) {
  const path = playlistId
    ? `${EP.songs}?playlist_id=${encodeURIComponent(playlistId)}`
    : `${EP.songs}?limit=500&offset=0`;
  return get(path);
}

export function clearBatch() {
  return post(EP.batchClear);
}

export function startBatch(songIds) {
  return post(EP.batch, { song_ids: songIds });
}

export function fetchProgress() {
  return get(EP.batchProgress);
}
