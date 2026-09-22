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
/** 本楼层号。`getCurrentMessageId()` 在酒馆助手的 iframe 里返回该界面所属的那一层。 */
export const CURRENT_FLOOR = getCurrentMessageId();

const VARIABLE_OPTION: VariableOption = { type: 'message', message_id: CURRENT_FLOOR };

export const useDataStore = defineMvuDataStore(Schema, VARIABLE_OPTION);

/** 好感度结算的**楼层水位线**，存在本层变量表里、`stat_data` **之外**。
 *
 * 为什么必须多存一个：结算把 `好感度本轮增量` 复位为 0，累加因此天然幂等；但草案 §1.3 三还要求
 * `_关系刚刚回退` 在**下一拍**复位为假，而「同一层重挂」与「真正的下一拍」在 stat_data 里长得一模一样
 * （都是增量 0＋信号为真）。只有楼层号能区分，所以记一条水位线。
 *
 * 它不是 MVU 变量：不在 schema 的 37 项里、不在 `变量列表` 的 `{{format_message_variable::stat_data}}`
 * 覆盖范围内，因此既不进提示词也不参与变量更新，纯属前端记账。MVU 若把整张变量表复制到下一层，
 * 水位线会是上一层的层号、与本层不等，照样判为「未结算」——两种复制口径下都成立。
 */
const SETTLED_AT = '状态栏好感度结算于';

export function affectionSettledHere(): boolean {
  return _.get(getVariables(VARIABLE_OPTION), SETTLED_AT) === CURRENT_FLOOR;
}

export function markAffectionSettled(): void {
  insertOrAssignVariables({ [SETTLED_AT]: CURRENT_FLOOR }, VARIABLE_OPTION);
}
