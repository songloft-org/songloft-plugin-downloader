<script setup>
import SlInput from '../ui/SlInput.vue';
import SlSwitch from '../ui/SlSwitch.vue';
import SlIcon from '../ui/SlIcon.vue';
import { state, saveSettings, DEFAULT_TEMPLATE } from '../store.js';
import { normalizeInterval } from '../api.js';

// 设置项没有保存按钮，改完即存（与旧版一致）。
// 文本框用 change 语义（HTML 分支是 change 事件，webf-ui 分支是 blur），不是每敲
// 一个字符就发一次请求。开关是即时的。
//
// 注意 webf-ui 分支的 blur **会重复触发**（原因见 store.js 里 saveSettings 的注释），
// 所以这里可以放心地在每次 change 上调 saveSettings —— 值没变它自己会跳过。

function onSwitch(key, value) {
  state.settings[key] = value;
  saveSettings();
}

// 间隔字段在**提交时机**把显示值也一起收敛，否则会出现「框里显示 -4、服务端存的是 0」。
// 刻意不在输入过程中做：受控输入被外部改写会把光标推到末尾，打字打不下去。
//
// ⚠️ 这里的赋值是**仅剩的一条**「从外部改写受控输入」路径，也就是下面 v-if 规避的那个
// 崩溃的残余触发面：值真的需要被纠正时（如 -4 → 0）仍会 markNeedsLayout。没法再消除
// —— 纠正显示值是这个函数存在的意义。触发概率低（要求同一帧鼠标正停在输入框上），
// 且只在 debug 构建里会烂成白屏（那两个抛出点都是 assert）。
function onIntervalCommit() {
  state.settings.downloadInterval = String(
    normalizeInterval(state.settings.downloadInterval),
  );
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
      <!--
        ⚠️ **两个输入框都必须等 `settingsLoaded` 才挂载**，这不是 loading 态的美化。
        `<flutter-cupertino-input>` 是受控的，`val` 从空变成服务端值会走 Flutter 的
        `_Editable.updateRenderObject` → `RenderEditable.text=` → `markNeedsLayout`；
        若那一帧鼠标正停在插件页上，MouseTracker 的 hit test 会对同一个 RenderEditable
        调 `getClosestGlyphForOffset` 撞上 `Text layout not available` 断言，接着
        `!_debugDuringDeviceUpdate` 无限刷屏、帧循环烂掉 → **整页白屏**（2026-08-05 实测，
        日志里紧跟在四个 /api/* 响应之后）。等值到齐再挂载，首次赋值就走 mount 而不是
        update，这条路径消失。`state.settingsLoaded` 在 store 里**最后**置位。
        残余触发面见上面 onIntervalCommit 的注释。
      -->
      <div v-if="state.settingsLoaded" class="dl-field">
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

      <div v-if="state.settingsLoaded" class="dl-field">
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
