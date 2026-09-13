import { defineMvuDataStore } from '@util/mvu';

import { Schema } from '../schema';

/** 状态栏读写本楼层的 MVU `stat_data`。
 *
 * `../schema` 是 AFV 卡根 `schema.ts` 的**单向副本**（design-spec §5.8）：改动在 AFV 侧发生，
 * 复制过来供前端编译，禁止反向覆盖 AFV。导入路径只上一层——中间那层中文「界面」目录已去掉，
 * 不要照抄 `示例/角色卡示例` 的 `../../schema`。
 *
 * `defineMvuDataStore` 的同步是双向的（`util/mvu.ts`）：
 *   - 每 2 秒把酒馆变量 `safeParse` 后**反向覆盖** `data`
 *   - 对 `data` 的深层改动会写回酒馆变量
 * 因此组件不得把编辑控件直接绑到 `store.data`——逐字符都会落库、取消也无处回滚。
 * 编辑一律走 `EditableField` 的草稿层，提交时一次性 `Object.assign`（§5.8 编辑态）。
 */
export const useDataStore = defineMvuDataStore(Schema, {
  type: 'message',
  message_id: getCurrentMessageId(),
});
