/** 单选控件的选项。放在独立模块而不是 `EditableField.vue` 的具名导出里：
 * `global.d.ts:25-29` 把 `*.vue` 声明成只有 default 导出的 `DefineComponent`，
 * 从 `.vue` 取具名类型要靠 vue-tsc 的实文件解析压过这条通配声明，太吃工具链脸色。
 * 类型放在 `.ts` 里，谁来编都认。 */
export interface FieldOption {
  value: string | number;
  label: string;
}
