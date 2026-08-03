const P = window.SongloftPlugin;
const $ = s => document.querySelector(s);

let songs = [];              // 当前歌单范围内的全部 remote 歌曲（服务端筛选结果）
let selected = new Set();
let dlStatus = {};
let playlistId = '';         // 当前歌单筛选（'' = 全部歌曲）
let filterArtist = '';       // 客户端艺术家筛选
let filterAlbum = '';        // 客户端专辑筛选
let filterKeyword = '';      // 客户端关键字筛选

// 按客户端筛选条件（艺术家/专辑/关键字）计算可见歌曲
function visibleSongs() {
    const kw = filterKeyword.trim().toLowerCase();
    return songs.filter(s => {
        if (filterArtist && (s.artist || '') !== filterArtist) return false;
        if (filterAlbum && (s.album || '') !== filterAlbum) return false;
        if (kw) {
            const hay = `${s.title || ''} ${s.artist || ''} ${s.album || ''}`.toLowerCase();
            if (!hay.includes(kw)) return false;
        }
        return true;
    });
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// 属性位置的转义。esc() 走 textContent -> innerHTML，**不会转义引号**，只能用在文本位置；
// 拼进 attr="..." 时必须用这个，否则含双引号的标题会把属性截断。
function escAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function showSnackbar(msg, type) {
    const el = $('#snackbar');
    el.textContent = msg;
    el.className = 'snackbar show' + (type ? ' ' + type : '');
    setTimeout(() => { el.className = 'snackbar'; }, 3000);
}

async function loadSettings() {
    const r = await P.apiGet('/api/settings');
    if (r) {
        $('#tpl').value = r.path_template || '';
        $('#embed').checked = r.embed_metadata !== false;
        $('#interval').value = r.download_interval ?? 0;
        $('#auto-dl').checked = !!r.auto_download;
    }
}

async function saveSettings() {
    await P.apiPost('/api/settings', {
        path_template: $('#tpl').value,
        embed_metadata: $('#embed').checked,
        download_interval: parseInt($('#interval').value) || 0,
        auto_download: $('#auto-dl').checked,
    });
}

async function loadPlaylists() {
    const r = await P.apiGet('/api/playlists');
    const playlists = r && r.playlists ? r.playlists : [];
    const sel = $('#f-playlist');
    sel.innerHTML = '<option value="">全部歌曲</option>' +
        playlists.map(p => `<option value="${p.id}">${esc(p.name)} (${p.song_count})</option>`).join('');
    sel.value = playlistId;
}

async function loadSongs() {
    let url = '/api/songs?limit=500&offset=0';
    if (playlistId) url = `/api/songs?playlist_id=${encodeURIComponent(playlistId)}`;
    const r = await P.apiGet(url);
    songs = r && r.songs ? r.songs : [];
    selected.clear();
    rebuildFacets();
    render();
}

// 依据当前 songs 重建艺术家/专辑下拉选项（去重排序），并保留仍存在的选中值
function rebuildFacets() {
    const artists = [...new Set(songs.map(s => s.artist).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
    const albums = [...new Set(songs.map(s => s.album).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
    if (!artists.includes(filterArtist)) filterArtist = '';
    if (!albums.includes(filterAlbum)) filterAlbum = '';
    fillSelect('#f-artist', artists, filterArtist);
    fillSelect('#f-album', albums, filterAlbum);
}

function fillSelect(sel, values, current) {
    $(sel).innerHTML = '<option value="">全部</option>' +
        values.map(v => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

// 表头与数据区是两个独立的 grid 容器（理由见 style.css 的「列表」一节）。数据区自带纵向
// 滚动，占位式滚动条（桌面浏览器）会吃掉它的内容宽度，而表头在滚动容器外面吃不到 ——
// 于是 6 列整体偏移一个滚动条宽度。这个宽度在 CSS 里拿不到，只能实测。
//
// 三个必须这么写的点：
//   ① 用 getBoundingClientRect() 的差值，而不是 offsetWidth - clientWidth：
//      前者在三条渲染路径上都确定可用，后者在 WebF 下的语义没有验证过。
//   ② **必须跨帧测**：WebF 的 layout 是异步的，刚写完 innerHTML 立刻量到的是改之前的
//      布局。调用方一律包 setTimeout(..., 0)。
//   ③ 结果夹在 [0, 40]：量不到（NaN / 负数 / 荒谬值）就当 0 —— 那恰好是覆盖式滚动条
//      （WebF、移动端、macOS 默认）的正确答案，属于安全的降级方向。
function syncScrollbarGutter() {
    const scroll = $('#tbl-scroll');
    const body = $('#tbl-body');
    if (!scroll || !body) return;
    let gutter = 0;
    try {
        const outer = scroll.getBoundingClientRect().width;
        const inner = body.getBoundingClientRect().width;
        const d = Math.round(outer - inner);
        if (isFinite(d) && d > 0 && d <= 40) gutter = d;
    } catch (e) { gutter = 0; }
    document.documentElement.style.setProperty('--sl-sbw', gutter + 'px');
}

// 视口变化会改 .tbl-scroll 的 max-height（calc(100vh - …)），进而改「有没有滚动条」。
// WebF 里 resize 事件不一定派发，那种情况下就靠每次 render 后那一次同步兜着。
window.addEventListener('resize', () => setTimeout(syncScrollbarGutter, 0));

function render() {
    const body = $('#tbl-body');
    const list = visibleSongs();
    if (list.length === 0) {
        body.innerHTML = '';
        $('#empty-text').textContent = songs.length === 0 ? '没有可下载的网络歌曲' : '当前筛选条件下没有匹配的歌曲';
        $('#empty').classList.remove('is-hidden');
        updateSelInfo();
        setTimeout(syncScrollbarGutter, 0);
        return;
    }
    $('#empty').classList.add('is-hidden');
    // 一行 = 连续 6 个 .tbl-td，由 grid 的自动放置换行（grid-auto-flow: row 默认值）。
    // 刻意**没有**行包裹元素：列宽跨行共享是 grid 的定义性行为，一旦每行自己成为一个
    // grid 容器，各行的 fr 就各算一次，内容不同就会错位；而 display:contents 这个在
    // 浏览器里透明化行元素的标准招数在 WebF 下不支持（CSSDisplay 无该取值 -> 退化成 inline）。
    body.innerHTML = list.map(s => {
        const src = s.plugin_entry_path || 'URL';
        const st = dlStatus[s.id];
        const stHtml = st
            ? (st.status === 'ok'
                ? '<span class="status-ok">已下载</span>'
                : '<span class="status-fail">失败</span>')
            : '';
        // 展平后复选框失去了「所在行」这个无障碍上下文，所以自带 aria-label 说清选的是哪首歌。
        // title 属性：单元格是 white-space:nowrap + ellipsis（理由见 style.css 的「列表」一节），
        // 长歌名/艺术家/专辑会被截断，桌面端靠原生 tooltip 看全文。
        // ⚠️ 属性位置一律 escAttr，**不能用 esc** —— esc 走 textContent -> innerHTML，
        // 不转义引号，含双引号的歌名会把 title="..." 就地截断。
        return `<div class="tbl-td"><input type="checkbox" class="cb row-cb" data-id="${s.id}" aria-label="选择 ${escAttr(s.title)}" ${selected.has(s.id) ? 'checked' : ''}></div>`
            + `<div class="tbl-td song-title" title="${escAttr(s.title)}">${esc(s.title)}</div>`
            + `<div class="tbl-td song-artist" title="${escAttr(s.artist || '')}">${esc(s.artist || '')}</div>`
            + `<div class="tbl-td song-album" title="${escAttr(s.album || '')}">${esc(s.album || '')}</div>`
            + `<div class="tbl-td"><span class="song-source" title="${escAttr(src)}">${esc(src)}</span></div>`
            + `<div class="tbl-td">${stHtml}</div>`;
    }).join('');
    // 事件委托靠 .row-cb + 复选框自己的 dataset.id，与行结构无关 —— 这段在改成 grid 后一行未动。
    document.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('change', e => {
            const id = parseInt(e.target.dataset.id);
            e.target.checked ? selected.add(id) : selected.delete(id);
            updateSelInfo();
        });
    });
    updateSelInfo();
    // 行数变了 -> 滚动条可能出现/消失 -> 表头要重新补偿。跨帧，见 syncScrollbarGutter 注释②。
    setTimeout(syncScrollbarGutter, 0);
}

function updateSelInfo() {
    const list = visibleSongs();
    const visSelected = list.filter(s => selected.has(s.id)).length;
    $('#sel-info').textContent = `已选 ${selected.size} 首`;
    $('#btn-dl').disabled = selected.size === 0;
    $('#cb-all').checked = list.length > 0 && visSelected === list.length;
}

// Header checkbox（作用于当前可见歌曲）
$('#cb-all').addEventListener('change', e => {
    const list = visibleSongs();
    if (e.target.checked) list.forEach(s => selected.add(s.id));
    else list.forEach(s => selected.delete(s.id));
    render();
});

// Select all button（作用于当前可见歌曲）
$('#btn-sel-all').addEventListener('click', () => {
    const list = visibleSongs();
    const allSelected = list.length > 0 && list.every(s => selected.has(s.id));
    if (allSelected) list.forEach(s => selected.delete(s.id));
    else list.forEach(s => selected.add(s.id));
    render();
});

// 筛选交互
$('#f-playlist').addEventListener('change', e => {
    playlistId = e.target.value;
    filterArtist = filterAlbum = filterKeyword = '';
    $('#f-keyword').value = '';
    loadSongs();
});
$('#f-artist').addEventListener('change', e => { filterArtist = e.target.value; render(); });
$('#f-album').addEventListener('change', e => { filterAlbum = e.target.value; render(); });
$('#f-keyword').addEventListener('input', e => { filterKeyword = e.target.value; render(); });

// Refresh
$('#btn-refresh').addEventListener('click', () => {
    dlStatus = {};
    loadSongs();
});

// Settings auto-save
$('#tpl').addEventListener('change', saveSettings);
$('#embed').addEventListener('change', saveSettings);
$('#interval').addEventListener('change', saveSettings);
$('#auto-dl').addEventListener('change', saveSettings);

// 开始下载轮询
function startPolling(autoClose = true) {
    const prog = $('#progress');
    prog.classList.add('active');

    const poll = setInterval(async () => {
        const r = await P.apiGet('/api/download-batch/progress');
        if (!r || !r.active) { clearInterval(poll); return; }
        const pct = r.total > 0 ? (r.current / r.total * 100) : 0;
        $('#prog-bar').style.width = pct + '%';
        $('#prog-num').textContent = r.current + '/' + r.total;
        $('#prog-ok').textContent = r.success;
        $('#prog-fail').textContent = r.failed;

        if (r.results) r.results.forEach(res => { dlStatus[res.song_id] = res; });
        render();

        if (r.done) {
            clearInterval(poll);
            showSnackbar(`下载完成：${r.success} 成功，${r.failed} 失败`, r.failed > 0 ? 'error' : 'success');
            setTimeout(() => {
                prog.classList.remove('active');
                if (autoClose) selected.clear();
                loadSongs();
            }, 2000);
        }
    }, 800);
}

// Download
$('#btn-dl').addEventListener('click', async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    await saveSettings();

    await P.apiPost('/api/download-batch/clear');
    await P.apiPost('/api/download-batch', { song_ids: ids });

    startPolling(true);
});

loadSettings();
loadPlaylists();
loadSongs();

// 页面加载时检查是否有正在进行的下载
checkActiveDownload();

async function checkActiveDownload() {
    const r = await P.apiGet('/api/download-batch/progress');
    if (r && r.active && !r.done) {
        startPolling(false);
    }
}
