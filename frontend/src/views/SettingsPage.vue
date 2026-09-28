<script setup>
import AppBar from './AppBar.vue';
import SectionHead from './SectionHead.vue';
import StatusView from './StatusView.vue';
import SlInput from '../ui/SlInput.vue';
import SlSwitch from '../ui/SlSwitch.vue';
import { state, saveSettings, loadSettings, goMain, DEFAULT_TEMPLATE } from '../store.js';
import { normalizeInterval } from '../api.js';

// 独立设置页（原先是主页顶部的一张卡）。拆成两个语义分组，对齐主程序设置页
// 「一页多个 SectionCard」的形态。
//
// 页头**三种打开方式都画**：设置页必须有返回入口。fullscreen 模式下宿主 AppBar 显示
// 的是插件名「歌曲下载」，这里显示「下载设置」—— 文本不同，构成面包屑而不是双标题。
//
// 设置项没有保存按钮，改完即存（与旧版一致）。文本框用 change 语义（change 事件），
// 不是每敲一个字符发一次请求；开关是即时的。

function onSwitch(key, value) {
  state.settings[key] = value;
  saveSettings();
}

// 间隔字段在**提交时机**把显示值也一起收敛，否则会出现「框里显示 -4、服务端存的是 0」。
// 刻意不在输入过程中做：受控输入被外部改写会把光标推到末尾，打字打不下去。
function onIntervalCommit() {
  const normalized = String(normalizeInterval(state.settings.downloadInterval));
  if (normalized !== state.settings.downloadInterval) {
    state.settings.downloadInterval = normalized;
  }
  saveSettings();
}
</script>

<template>
  <div class="dl-page-overlay">
    <!--
      设置内容可超过一屏，返回入口必须始终可见，页头单独放进 fixed 外壳；
      正文由 .dl-overlay-body 预留同高空间。
    -->
    <div class="dl-settings-appbar">
      <div class="dl-settings-appbar-inner">
        <AppBar title="下载设置" back @back="goMain" />
      </div>
    </div>

    <div class="dl-overlay-body">
    <!--
      读取失败与「还没读到」必须分开显示。以前 loadSettings 遇到 null 是裸 return，
      于是 settingsLoaded 永远 false、两个输入框永不挂载，用户看到的是两块空白 —— 与
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
            <SlInput
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
