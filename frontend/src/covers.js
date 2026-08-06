// 歌曲封面加载：带鉴权 fetch → blob → data: URL，供 SongRow 显示真实封面。
//
// 逻辑参考 miot 插件 static/js/playlist.js 的 fetchCoverWithAuth + 并发队列：
//   · 封面走主程序 endpoint `/api/v1/songs/{id}/cover`（后端自动判定本地/远程并代理，
//     带 `?w=` 服务端缩略成缩略图）—— 与 miot 从 brief 模式拿到的 CoverURLPath 同形；
//   · endpoint 需要 Authorization 头（插件 token），`<img src>` 无法携带，只能 fetch；
//   · **WebF 没有 URL.createObjectURL / FileReader**，blob 只能转 data: URL 再喂给
//     `<img>`（见宿主 common.js 的 blobToDataURL 注释），故用 SongloftPlugin.blobToDataURL
//     而不是 miot 那边的 FileReader。
//
// 并发与缓存：native ListView 回收下每次进视口都会重新挂载 SongRow，用 id → dataURL
// 的进程内缓存让重挂载零请求；同时最多 MAX_CONCURRENCY 个在途，避免整页 500 首一次
// 拥进代理。SongRow 卸载（列表回收）时 cancel()，尚未开跑的任务会在 drain 时跳过。

const MAX_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 8000;
// 封面盒 48px 的 2x，走 endpoint 的 ?w= 服务端缩略，控制远程封面体积
const COVER_WIDTH = 96;

// song.id -> data: URL（仅成功才缓存；失败不缓存，允许下次重挂载重试）
const cache = new Map();
let active = 0;
const queue = [];

function coverEndpoint(id) {
  return '/api/v1/songs/' + id + '/cover?w=' + COVER_WIDTH;
}

function authHeaders() {
  const P = window.SongloftPlugin;
  const token = P && P.getAuthToken ? P.getAuthToken() : '';
  const headers = {};
  if (token) {
    headers['Authorization'] = token.indexOf('Bearer ') === 0 ? token : 'Bearer ' + token;
  }
  return headers;
}

function fetchCover(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const options = { headers: authHeaders() };
  let timer = null;
  if (controller) {
    options.signal = controller.signal;
    timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  }
  return fetch(url, options)
    .then((res) => {
      if (!res.ok) throw new Error('cover fetch failed: ' + res.status);
      return res.blob();
    })
    .then((blob) => {
      const P = window.SongloftPlugin;
      // WebF 无 createObjectURL/FileReader，转 data: URL 是唯一能喂给 <img> 的形态。
      if (P && P.blobToDataURL) return P.blobToDataURL(blob);
      // 非 WebF（浏览器/系统 WebView）兜底 —— 三条渲染路径其实都有 blobToDataURL，
      // 这里几乎走不到，仅防御性保留。
      if (typeof URL !== 'undefined' && URL.createObjectURL) return URL.createObjectURL(blob);
      throw new Error('no blob→url path available');
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

function drain() {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const task = queue.shift();
    if (task.cancelled) continue;
    active++;
    fetchCover(task.url)
      .then((src) => {
        cache.set(task.id, src);
        if (!task.cancelled) task.resolve(src);
      })
      .catch((e) => {
        if (!task.cancelled) task.reject(e);
      })
      .finally(() => {
        active--;
        drain();
      });
  }
}

/**
 * 加载某首歌的封面。
 *
 * @param {{id: number, cover_url?: string}} song
 * @returns {{promise: Promise<string|null>, cancel: () => void}}
 *   promise 成功时 resolve 一个 data: URL；无封面（cover_url 为空）时 resolve(null)；
 *   fetch 失败时 reject（调用方保持占位图标即可）。cancel() 用于 SongRow 卸载时退队。
 */
export function loadCover(song) {
  // remote 歌曲的 cover_url 是原始远程封面 URL，非空即代表有封面可展示；为空时不请求，
  // 避免对无封面歌发出注定 404 的请求（与主程序 CoverURLPath 的放行判据一致）。
  if (!song || !song.id || !song.cover_url) {
    return { promise: Promise.resolve(null), cancel() {} };
  }
  if (cache.has(song.id)) {
    return { promise: Promise.resolve(cache.get(song.id)), cancel() {} };
  }
  const task = { id: song.id, url: coverEndpoint(song.id), cancelled: false, resolve: null, reject: null };
  const promise = new Promise((resolve, reject) => {
    task.resolve = resolve;
    task.reject = reject;
  });
  queue.push(task);
  drain();
  return {
    promise,
    cancel() {
      task.cancelled = true;
    },
  };
}
