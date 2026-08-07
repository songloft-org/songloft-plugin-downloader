<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import AppBar from './AppBar.vue';
import SectionHead from './SectionHead.vue';
import StatusView from './StatusView.vue';
import SlInput from '../ui/SlInput.vue';
import SlSwitch from '../ui/SlSwitch.vue';
import { state, saveSettings, loadSettings, goMain, DEFAULT_TEMPLATE } from '../store.js';
import { normalizeInterval } from '../api.js';
import { fillParentWidth, onResize } from '../layout.js';

// ── 开关行宽度 ─────────────────────────────────────────────────────────────
//
// WebF 下带元素子节点的块级行不 fill-available（退化成 max-content），且**百分比宽度
// 不解析、只有 px 被采纳** —— 完整实测表见 layout.js 的 fillParentWidth 头注释。
// 后果是开关（`right: 0` 挂在行上）跟着变窄的行一起左移，而且两行文案长度不同、
// 左移量还不一样。所以这里量出父容器内容宽、以 px 钉住行宽。
//
// 用 querySelector 而不是模板 ref：与 SongList 同理，选择器最确定，且这两行同属
// 「下载行为」那张卡的 .dl-card-body，父容器一致。
const WIDTH_RETRIES = 6;

function measureRows(attempt) {
  const els = document.querySelectorAll('.dl-switch-row');
  if (fillParentWidth(els)) return;
  // 异步渲染首帧可能还没 layout。退避重试；全失败也只是回到「开关偏左」的老样子，
  // 不会更糟，所以不抛错。
  const n = attempt || 0;
  if (n < WIDTH_RETRIES) {
    setTimeout(function () {
      measureRows(n + 1);
    }, 32 * (n + 1));
  }
}

let offResize = null;

onMounted(() => {
  nextTick(function () {
    measureRows(0);
  });
  offResize = onResize(() => measureRows(0));
});

onUnmounted(() => {
  if (offResize) offResize();
});

// 独立设置页（原先是主页顶部的一张卡）。拆成两个语义分组，对齐主程序设置页
// 「一页多个 SectionCard」的形态。
//
// 页头**三种打开方式都画**：设置页必须有返回入口。fullscreen 模式下宿主 AppBar 显示
// 的是插件名「歌曲下载」，这里显示「下载设置」—— 文本不同，构成面包屑而不是双标题。
//
// 设置项没有保存按钮，改完即存（与旧版一致）。文本框用 change 语义（HTML 分支是
// change 事件，webf-ui 分支是 blur），不是每敲一个字符发一次请求；开关是即时的。
// webf-ui 分支的 blur **会重复触发**（原因见 store.js 里 saveSettings 的注释），
// 所以这里可以放心地在每次 change 上调 saveSettings —— 值没变它自己会跳过。

// 间隔输入框的**重挂载代数**。WebF 原生输入是非受控的（SlInput.vue 注释：挂载后
// 任何 val 回写都会走 RenderEditable.text= → 与 MouseTracker 同帧 hit test 相撞 →
// 整页白屏），所以「把显示值 -4 纠正成 0」**不能**靠回写 store 让绑定刷新，
// 只能换 `:key` 让输入框带着纠正后的值**重挂载**（mount 路径安全）。
const intervalGen = ref(0);

function onSwitch(key, value) {
  state.settings[key] = value;
  saveSettings();
}

// 间隔字段在**提交时机**把显示值也一起收敛，否则会出现「框里显示 -4、服务端存的是 0」。
// 刻意不在输入过程中做：受控输入被外部改写会把光标推到末尾，打字打不下去。
//
// 收敛真的改了显示值时（如 -4 → 0）：store 更新 + 代数 +1 → `:key` 变化 →
// SlInput 重挂载、以纠正后的值走 mount 而不是 update。这是非受控输入下唯一
// 安全的「外部改显示值」通道（机制见主仓 docs/webf/handoff.md 第 25 条）。
function onIntervalCommit() {
  const normalized = String(normalizeInterval(state.settings.downloadInterval));
  if (normalized !== state.settings.downloadInterval) {
    state.settings.downloadInterval = normalized;
    intervalGen.value++;
  }
  saveSettings();
}
</script>

<template>
  <!--
    全屏覆盖层：主页保持在底下挂载（App.vue 注释：v-if 换页的大规模拆除会撞
    WebF 的 dispose 竞态 → 整页白屏）。`.dl-page-overlay` 负责 fixed 定位与底色，
    `.dl-overlay-body` 负责与 `.dl-container` 相同的宽度/内边距（含底部安全区）。
  -->
  <div class="dl-page-overlay">
    <div class="dl-overlay-body">
      <AppBar title="下载设置" back @back="goMain" />

    <!--
      读取失败与「还没读到」必须分开显示。以前 loadSettings 遇到 null 是裸 return，
      于是 settingsLoaded 永远 false、两个输入框永不挂载，用户看到两块空白 —— 与
      加载中完全无法区分（见 store.js 的 settingsError 注释）。
    -->
    <template v-if="state.settingsError">
      <div class="card dl-card">
        <StatusView
          variant="error"
          title="读取设置失败"
          :detail="state.settingsError"
          retry
          @retry="loadSettings"
        />
      </div>
    </template>

    <template v-else-if="!state.settingsLoaded">
      <div class="card dl-card">
        <StatusView variant="loading" title="正在读取设置…" />
      </div>
    </template>

    <!--
      ⚠️ **两个输入框都必须等 `settingsLoaded` 才挂载**，这不是 loading 态的美化。
      WebF 原生输入是**非受控**的（SlInput.vue 注释：挂载后永不回写 val —— 回写会走
      `RenderEditable.text=` → `markNeedsLayout`，与同帧 MouseTracker 的 hit test 相撞
      出 `Text layout not available` → `!_debugDuringDeviceUpdate` 每帧刷屏 → 整页白屏，
      2026-08-05 实测、栈已确证）。非受控意味着挂载时拿到的就是**唯一一次**初值 ——
      所以必须等值从服务端到齐再挂载，否则输入框会永久显示空值。
      `state.settingsLoaded` 在 store 里**最后**置位。

      设置独立成页之后这条护栏更稳了：页面是按需 v-if 挂载的，用户点进来时值早已到齐。
    -->
    <template v-else>
      <SectionHead title="路径与命名" />
      <div class="card dl-card">
        <div class="dl-card-body">
          <div class="dl-field">
            <label class="dl-label">路径模板</label>
            <SlInput
              v-model="state.settings.pathTemplate"
              :placeholder="DEFAULT_TEMPLATE"
              aria-label="路径模板"
              @change="saveSettings"
            />
            <div class="dl-hint">
              相对音乐库目录的保存路径，无需写扩展名（系统自动补全）。可用变量：{title}
              标题（必填）、{artist} 艺术家、{album} 专辑、{year} 年份、{genre}
              流派。留空则使用默认值 {{ DEFAULT_TEMPLATE }}。提示：可用变量取决于歌曲来源，部分歌曲的
              {album}/{year}/{genre} 可能为空。
            </div>
          </div>
        </div>
      </div>

      <SectionHead title="下载行为" />
      <div class="card dl-card">
        <div class="dl-card-body">
          <div class="dl-field">
            <label class="dl-label">批量下载间隔（秒）</label>
            <!--
              `:key` 挂着代数 intervalGen：规范化纠正显示值时（-4 → 0）代数 +1，
              输入框带新值重挂载 —— 非受控输入下唯一安全的外部改值通道，
              见上面 onIntervalCommit 的注释。
            -->
            <SlInput
              :key="'dl-interval-' + intervalGen"
              v-model="state.settings.downloadInterval"
              type="number"
              placeholder="0"
              aria-label="批量下载间隔"
              @change="onIntervalCommit"
            />
            <div class="dl-hint">0 表示无间隔（默认），建议 1-5 秒以减少服务器负载</div>
          </div>

          <div class="dl-switch-row">
            <div class="dl-switch-label">
              <span class="dl-switch-title">嵌入元数据</span>
              <span class="dl-switch-sub">写入标题/艺术家/封面等到音频文件标签</span>
            </div>
            <!--
              刻意不写 `v-model` + `@update:model-value` 的组合：两者会编译成同一个
              `onUpdate:modelValue` key，合并行为不确定、有静默丢掉一个处理器的风险。
              显式 :model-value + 单个处理器最稳。
            -->
            <SlSwitch
              class="dl-switch-control"
              :model-value="state.settings.embedMetadata"
              aria-label="嵌入元数据"
              @update:model-value="onSwitch('embedMetadata', $event)"
            />
          </div>

          <div class="dl-switch-row">
            <div class="dl-switch-label">
              <span class="dl-switch-title">播放时自动下载</span>
              <span class="dl-switch-sub">播放网络歌曲时自动保存到本地（仅限插件来源歌曲）</span>
            </div>
            <SlSwitch
              class="dl-switch-control"
              :model-value="state.settings.autoDownload"
              aria-label="播放时自动下载"
              @update:model-value="onSwitch('autoDownload', $event)"
            />
          </div>
        </div>
      </div>
    </template>
    </div>
  </div>
</template>
