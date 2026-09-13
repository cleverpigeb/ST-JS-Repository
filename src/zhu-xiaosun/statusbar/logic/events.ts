import type { Schema } from '../../schema';

/** 进行中与历史区结构一致：键＝事件名，值＝`{ 进度 }`。 */
export type EventMap = Schema['事件']['进行中'];

/** 编辑期的一行。**只存在于组件本地草稿里**，不进 MVU——
 * 全卡「零数组」的理由是模型能发 `remove /path/0` 把索引打错位（schema 头注释），
 * 那条约束管的是变量存储形态；本地草稿没有模型参与，用数组反而能干净地改名与排序。 */
export interface EventRow {
  事件名: string;
  进度: string;
  /** true ＝ 已归档（落在 `$历史区`）。「标记完成」与「取回」就是翻这一个布尔。 */
  归档: boolean;
}

/** 把两张表摊成一串行：进行中在前、历史区在后，各自保持原键序。 */
export function toRows(ongoing: EventMap, history: EventMap): EventRow[] {
  return [
    ...Object.entries(ongoing).map(([事件名, value]) => ({ 事件名, 进度: value.进度, 归档: false })),
    ...Object.entries(history).map(([事件名, value]) => ({ 事件名, 进度: value.进度, 归档: true })),
  ];
}

/** 提交前收口：去掉空名、同名只留第一条、按归档位拆回两张表。
 *
 * 「规范化后与草稿不同是正常的」（design-spec §5.8 提交口径），所以这里静默处理；
 * 重名与空名在编辑态就已经当场提示过，不靠提交时报错来兜。 */
export function toMaps(rows: readonly EventRow[]): { 进行中: EventMap; $历史区: EventMap } {
  const 进行中: EventMap = {};
  const $历史区: EventMap = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const name = row.事件名.trim();
    if (name === '' || seen.has(name)) {
      continue;
    }
    seen.add(name);
    (row.归档 ? $历史区 : 进行中)[name] = { 进度: row.进度.trim() };
  }
  return { 进行中, $历史区 };
}

/** 编辑态当场提示用：出现两次以上的非空事件名。 */
export function duplicatedNames(rows: readonly EventRow[]): string[] {
  const counts = _.countBy(rows.map(row => row.事件名.trim()).filter(name => name !== ''));
  return _.keys(_.pickBy(counts, count => count > 1));
}
