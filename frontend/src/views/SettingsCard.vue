<script setup>
import SlInput from '../ui/SlInput.vue';
import SlSwitch from '../ui/SlSwitch.vue';
import SlIcon from '../ui/SlIcon.vue';
import { state, saveSettings, DEFAULT_TEMPLATE } from '../store.js';

// 设置项没有保存按钮，改完即存（与旧版一致）。
// 文本框用 change 语义（HTML 分支是 change 事件，webf-ui 分支是 blur），不是每敲
// 一个字符就发一次请求。开关是即时的。

function onSwitch(key, value) {
  state.settings[key] = value;
  saveSettings();
}
</script>

<template>
  <div class="card dl-card">
    <div class="dl-card-header">
      <SlIcon name="settings" />
      <span>下载设置</span>
    </div>
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

      <div class="dl-field">
        <label class="dl-label">批量下载间隔（秒）</label>
        <SlInput
          v-model="state.settings.downloadInterval"
          type="number"
          placeholder="0"
          aria-label="批量下载间隔"
          @change="saveSettings"
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
          :model-value="state.settings.autoDownload"
          aria-label="播放时自动下载"
          @update:model-value="onSwitch('autoDownload', $event)"
        />
      </div>
    </div>
  </div>
</template>
