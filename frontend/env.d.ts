// webf-ui 的类型声明。
//
// 这两个包**没有运行时**（cupertino 那个只含 index.d.ts）：webf-ui 的用法就是
// 在模板里直接写自定义标签，由 WebF 侧的 Dart 实现接管渲染。引用它们的唯一目的
// 是让编辑器/tsc 认识 <flutter-cupertino-*> 与 <webf-list-view> 的属性与事件，
// 避免靠记忆写错属性名。
//
// ⚠️ 属性名大小写是个真坑：**HTML 属性是 kebab-case，JS 属性才是 camelCase**
// （webf_cupertino_ui 的 *_bindings_generated.dart 里
//  `attributes['active-color']` 对应 JS 侧 `'activeColor'`）。模板里一律写
// kebab-case —— 写 activeColor 会被当成 activecolor 属性而静默失效。
// 另外输入框的值属性叫 `val`，不是 `value`。
/// <reference types="@openwebf/vue-cupertino-ui" />
/// <reference types="@openwebf/vue-core-ui" />
