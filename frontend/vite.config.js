import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// downloader 插件前端构建配置。
//
// 产物直接写进 ../static，由 @songloft/plugin-builder 的 frontend/ 钩子调用
// （它在 build 时先 `npm install`（仅当 node_modules 缺失）再 `npm run build`），
// 然后 builder 会把 ../static 拷进 build/static 继续处理。
//
// ⚠️ 三条不能改的约束，都是 builder 与 WebF 的硬要求：
//
//   ① **必须只产出一个 JS 文件，且文件名恰好是 js/app.js**。
//      builder 的 [3.1] 步会把 build/static/js/app.js 用 esbuild 重打成 IIFE 的
//      app.bundle.js，然后**删掉 js/ 下其它所有 .js**，并用正则把 index.html 里
//      `src="static/js/app.js"` 换成 app.bundle.js —— 正则匹配不到会直接 throw。
//      所以既不能改名，也不能让 rollup 分出 chunk。
//
//   ② **产物文件名不要自带 hash**。builder 的 [3.1.1] 步会给 static/ 下的
//      JS/CSS/字体/图片注入内容 hash 并改写引用；它会跳过「看起来已经 hash 过」
//      的文件名，我们自己带 hash 只会让那一步失效。
//
//   ③ **HTML 里的资源引用必须是 `static/xxx` 形式**（见下面的 html-transform）。
//      WebF **不采纳 `<base href>`**（已确诊的上游缺陷），插件页 URL 形如
//      `/api/v1/jsplugin/downloader/`，相对路径 `./js/app.js` 在那里解析不对。
export default defineConfig({
  base: './',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // webf-ui 的原生元素是**自定义标签**，Vue 默认会当成未注册组件而告警。
          // 三个前缀分别是：flutter-cupertino-*（webf_cupertino_ui）、
          // webf-*（webf 包内建，如 webf-list-view）、songloft-*（宿主自有元素）。
          isCustomElement: (tag) =>
            tag.startsWith('flutter-') ||
            tag.startsWith('webf-') ||
            tag.startsWith('songloft-'),
        },
      },
    }),
    {
      name: 'html-transform',
      apply: 'build',
      transformIndexHtml(html) {
        // ./xxx → static/xxx（约束 ③）
        let out = html.replace(/"\.\//g, '"static/');
        // Vite 会给注入的 <script>/<link> 加 crossorigin（为 module 脚本准备的）。
        // 插件资源与页面同源，不需要 CORS 模式；而 WebF 的 fetch 实现对这个属性的
        // 处理没有验证过，去掉是零成本的保险。
        // （script 标签稍后会被 builder 整个替换掉，这里主要是为了那个 <link>。）
        out = out.replace(/\s+crossorigin(?==|\s|>)/g, '');
        // 把 script 标签挪到 </body> 之前：宿主注入的 common.js 是 render-blocking
        // 且在 <head>，我们的脚本必须在它之后跑（window.SongloftPlugin 才存在），
        // 放 body 末尾同时保证 DOM 已就绪。
        const m = out.match(
          /<script\b[^>]*\bsrc="static\/js\/app\.js"[^>]*><\/script>/,
        );
        if (!m) {
          throw new Error(
            'html-transform: 没找到 <script src="static/js/app.js">，' +
              'builder 的 [3.1] 步会因此 throw。检查 entryFileNames 是否仍是 js/app.js。',
          );
        }
        out = out.replace(m[0], '');
        out = out.replace('</body>', `${m[0]}\n  </body>`);
        return out;
      },
    },
  ],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    // WebF 的 CSS 支持面接近 chrome61，别让 Vite 产出更新的语法
    cssTarget: 'chrome61',
    rollupOptions: {
      output: {
        // 约束 ①：单文件 + 固定名
        inlineDynamicImports: true,
        entryFileNames: 'js/app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/style.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  server: {
    proxy: {
      // 本地起 vite dev 时把 API 打到后端。插件页真实运行时是同源的，不走这里。
      '/api': {
        target: 'http://127.0.0.1:58091',
        changeOrigin: true,
      },
    },
  },
});
