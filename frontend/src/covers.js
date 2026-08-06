// 歌曲封面 URL：直接拼给 `<img src>`，把 token 放 query 走服务端 access_token 兜底鉴权。
//
// 为什么不再 fetch → blob → base64（旧实现，见 git 历史）：
//   · 封面走主程序 endpoint `/api/v1/songs/{id}/cover?w=`（后端自动判定本地/远程并代理，
//     `?w=` 服务端缩略）。该 endpoint 需鉴权，`<img src>` 无法带 Authorization 头；
//   · 但 auth 中间件（internal/middleware/auth.go）支持 `?access_token=` query 兜底，
//     于是把 token 拼进 URL，`<img>` 就能原生加载 —— 无 fetch、无 blob、无 base64；
//   · 旧实现在 WebF（无 URL.createObjectURL/FileReader）下只能把 blob 转成 data: URL，
//     几百首歌的大 base64 字符串常驻内存 + 逐个解码，列表滚动明显卡顿。改直连后由渲染层
//     自己管理图片解码与内存，滚动顺滑。
//
// 为什么仍需并发闸门（acquireCoverSlot）：
//   · WebF 的 `<img>` 一旦被赋 src 会立即经 Dio 发起真实 GET，且**无内建并发上限**。
//     一屏十几行 + 快速滚动会瞬间把几十个请求全砸向本地后端；远程封面要代理+缩略，单个
//     就 7-9s，连接池被打爆后报 `NSURLErrorDomain -1005 network connection lost`。
//   · 故沿用旧实现的思路限制在途数量，只是节流点从「fetch」挪到「给 <img> 赋 src」：
//     SongRow 先申请槽位，拿到才赋 src；`<img>` load/error 后释放，放行下一个。

// 封面盒 48px 的 2x，走 endpoint 的 ?w= 服务端缩略，控制远程封面体积
const COVER_WIDTH = 96;
// 同时在途的封面请求上限。与旧 base64 实现一致，实测 3 并发下本地后端不再连接丢失。
const MAX_CONCURRENCY = 3;

let active = 0;
/** @type {Array<{cancelled: boolean, resolve: () => void}>} 等待槽位的任务 */
const queue = [];

function pump() {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const task = queue.shift();
    if (task.cancelled) continue;
    active++;
    task.resolve();
  }
}

/**
 * 计算某首歌的封面 URL，直接喂给 `<img src>`。
 *
 * @param {{id: number, cover_url?: string}} song
 * @returns {string} 有封面时返回带鉴权的 endpoint URL；无封面（cover_url 为空）返回 ''。
 *   remote 歌曲的 cover_url 是原始远程封面 URL，非空即代表有封面可展示；为空时返回 ''，
 *   避免对无封面歌发出注定 404 的请求（与主程序 CoverURLPath 的放行判据一致）。
 */
export function coverUrl(song) {
  if (!song || !song.id || !song.cover_url) return '';
  const P = window.SongloftPlugin;
  const token = P && P.getAuthToken ? P.getAuthToken() : '';
  let url = '/api/v1/songs/' + song.id + '/cover?w=' + COVER_WIDTH;
  if (token) url += '&access_token=' + encodeURIComponent(token);
  return url;
}

/**
 * 申请一个封面加载槽位，限制同时在途的 `<img>` 请求数量。
 *
 * @returns {{promise: Promise<void>, release: () => void}}
 *   promise 在拿到槽位时 resolve（此时才应给 `<img>` 赋 src）。release() 在图片
 *   load/error 或行卸载时调用：已占用则归还槽位并放行队列下一个；仍在排队则退队。
 *   release() 幂等。
 */
export function acquireCoverSlot() {
  const task = { cancelled: false, granted: false, resolve: null };
  const promise = new Promise((resolve) => {
    task.resolve = () => {
      task.granted = true;
      resolve();
    };
  });
  if (active < MAX_CONCURRENCY) {
    active++;
    task.resolve();
  } else {
    queue.push(task);
  }
  return {
    promise,
    release() {
      if (task.cancelled) return;
      task.cancelled = true;
      if (task.granted) {
        active--;
        pump();
      }
      // 未 granted：仍在 queue 里，标记 cancelled，pump 时跳过
    },
  };
}
