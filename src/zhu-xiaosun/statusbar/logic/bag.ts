import type { Schema } from '../../schema';
import { stackCap } from '../data/items';

/** 主角与朱小笋的背包结构一致：固定 3 格，每格 `{ 名称, 数量 }`。 */
export type Bag = Schema['主角']['背包'];

export const BAG_SLOTS = ['格1', '格2', '格3'] as const;

/** 背包格键。组件之间传格位时统一用这个别名，省得各处重写 `(typeof BAG_SLOTS)[number]`。 */
export type BagSlot = (typeof BAG_SLOTS)[number];

/** 背包草稿提交前的收口（草案 §8.1 堆叠上限、schema 的「空格写成名称空串、数量 0」）。
 *
 * 数量上限查 `stackCap()`：登记过的按其档位（常见 3／精良 2／稀有 1），
 * 没登记的走 `UNREGISTERED_STACK_CAP` 兜底——那是前端容错取值，不是替它定档位。
 *
 * 刻意不做的一条：**不拦「她拿到稀有道具」**。schema 注明「她不获得稀有道具」，
 * 但面板是玩家的手动兜底，硬拦会让人在真需要纠错时无路可走；朱小笋页改成显示一条提示。
 */
export function normalizeBag(bag: Bag): Bag {
  const next = {} as Bag;
  for (const slot of BAG_SLOTS) {
    const name = (bag[slot]?.名称 ?? '').trim();
    next[slot] =
      name === ''
        ? { 名称: '', 数量: 0 }
        : { 名称: name, 数量: _.clamp(Math.round(bag[slot]?.数量 ?? 1), 1, stackCap(name)) };
  }
  return next;
}
