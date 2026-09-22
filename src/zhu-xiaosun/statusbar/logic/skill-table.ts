import type { Schema } from '../../schema';
import type { Stage } from '../data/stages';

/** 技能表的读法与编辑边界。**表本体在 MVU 的根级 `$技能表`，前端不再留静态副本。**
 *
 * 草案 §6.1 line 268 裁定逐字：「本表落成 MVU 的根级 `$技能表`，面板可编、模型不可写」。
 * 此前数值在 `data/skills.ts`、叙事指导在世界书 `战斗叙事对照表` 条目正文里，两份各存一处，
 * 于是编辑态碰不到任何一半——用户实测第五条「编辑状态无法更改技能的描述与数值」说的就是这件事。
 * 现在两边同源：本模块读它渲染面板，`战斗叙事对照表` 用 EJS 从同一个变量渲染正文。
 *
 * **所有函数都把表当参数收**，不在这里抓 store：技能页编辑态要拿**草稿**里的表渲染，
 * 而 `logic/battle-log.ts` 明文「纯函数，不碰宿主 API」。谁持有表谁传进来。
 */

export type SkillTable = Schema['$技能表'];
export type SkillSpec = SkillTable[string];
export type Faction = SkillSpec['阵营'];
export type SkillStage = SkillSpec['适用段'];
export type SkillKind = SkillSpec['类别'];

/** 查一招的数值。表里没有这个 id 时返回 `null`，由组件显示「未登记」。
 *
 * 表外 id 是正常状态而不是错误：`主角.技能库`／`装备四槽` 允许面板手输库外名字
 *（`TabSkills` 的「草案 §6 之外的名字也收」），此时**不补默认值也不崩**。 */
export function lookupSkill(table: SkillTable, id: string): SkillSpec | null {
  return id !== '' && Object.hasOwn(table, id) ? table[id] : null;
}

/** 按招名反查归属。
 *
 * 用途是 `logic/battle-log.ts` 从本层正文摘「某某使出〈技能名〉」时判断这一招是谁出的——
 * 正文里 `<user>` 的名字面板并不知道，按招名查表比在句子里认人名可靠。
 * 从前这靠「两方招表互不相交」这条巧合，现在直接读 `阵营` 字段，表被改过也不会错判。
 * 表外的招返回 `未知`，由组件如实显示而不是随便归给一方。 */
export function skillOwner(table: SkillTable, id: string): Faction | '未知' {
  return lookupSkill(table, id)?.阵营 ?? '未知';
}

/** 表里属于某一方的全部招 id。 */
export function idsOf(table: SkillTable, faction: Faction): string[] {
  return Object.keys(table).filter(id => table[id]?.阵营 === faction);
}

/** 她当前该用哪一套：按 `关系.$已达最高关系阶段` 筛 `适用段`。
 *
 * **锚点是「已达最高关系阶段」不是「当前关系」**（草案 §6.4 第八轮换锚点）：关系回退后她
 * 不换回低段套。这是战斗侧派生，与正文侧那把尺子不可互换（§10.1 第八轮「别混」）。
 *
 * 查不到时返回空表与说明，由组件**原样显示**——第一版只产出了恋人与亲密恋人两套
 *（§6.4 第二条，其余五段推迟到第二版），面板编辑「关系」能把锚点推到订婚／结婚，
 * 那时这里如实说没有，**不得就地编一套招**。
 *
 * 与 `战斗叙事对照表` 的一处已知分歧（留痕已记，未裁定）：那条 EJS 把 0–3 段折成「恋人」、
 * 4–6 段折成「亲密恋人」，本函数按 `适用段` 精确匹配、不折。第一版两者结果相同
 *（`$已达最高关系阶段` 只增不减、开局即恋人，订婚／结婚要手改关系才到），故不在此处自行统一。 */
export function herSkillSet(table: SkillTable, highest: Stage): { skills: string[]; note: string } {
  const skills = idsOf(table, '朱小笋').filter(id => table[id]?.适用段 === highest);
  return skills.length > 0
    ? { skills, note: '' }
    : {
        skills: [],
        note: `「${highest}」段她名下没有登记招（草案 §6.4 只产出了恋人与亲密恋人两套）`,
      };
}

/** 面板编辑时的维度边界（草案 §6.1 字段表逐字）。
 *
 * 这些边界**只在前端生效**：schema 侧 `$技能表` 的注释明文「只保形状不夹范围」，
 * 与 §11.4「夹取是前端提交时的职责」同口径。夹取的**时机**按 §5.5 裁决④在**输入时**做，
 * 由 `EditableField` 的上界 @input／下界 @change 两段完成，这里只提供数字。
 *
 * 威力**刻意不给上限**：§6.1 只写了「攻击类 ≥ 10」。§6.2 的 100 分预算是**生成**技能时的
 * 规则，不是面板的夹取范围；按预算反推一个 33 之类的天花板属于自己发明规则，而且
 * 面板的定位是「模型漏更新变量时的手动兜底」，兜底优先于结算约束力（§11.4）。 */
export const HIT_BOUNDS = { min: 50, max: 100, step: 5 } as const;
export const EP_BOUNDS = { min: 0, max: 25, step: 5 } as const;

/** 威力：攻击类 ≥ 10、无上限；变化类固定 0（§6.1），于是 min = max = 0 把它钉死。 */
export function powerBounds(kind: SkillKind): { min: number; max: number | undefined; step: number } {
  return kind === '攻击' ? { min: 10, max: undefined, step: 1 } : { min: 0, max: 0, step: 1 };
}

/** 暴击：攻击类 5–25、5 一档；变化类无暴击，写 0 表示没有这一项（§6.1 与 schema 注释同口径）。 */
export function critBounds(kind: SkillKind): { min: number; max: number; step: number } {
  return kind === '攻击' ? { min: 5, max: 25, step: 5 } : { min: 0, max: 0, step: 5 };
}

/** 改「类别」时把两个随类别变的字段就地拉回合法区间。
 *
 * 这仍是**输入时**的边界处理（§5.5 裁决④），不是提交后校验：切到变化类要当场把
 * 威力与暴击归零（§6.1「变化类威力固定 0」「变化类无暴击」），切回攻击类则把 0 抬到各自下限，
 * 否则草稿里会留下「攻击类威力 0」这种 §6.2 硬约束不允许的形状。
 *
 * 直接改传进来的对象：调用方给的是本页草稿，不是 `store.data`。 */
export function applyKind(spec: SkillSpec, kind: SkillKind): void {
  spec.类别 = kind;
  if (kind === '变化') {
    spec.威力 = 0;
    spec.暴击 = 0;
    return;
  }
  spec.威力 = Math.max(spec.威力, powerBounds('攻击').min);
  spec.暴击 = _.clamp(spec.暴击, critBounds('攻击').min, critBounds('攻击').max);
}

/** 一招的单行摘要，供「改哪一招」下拉与列表分组用。 */
export function skillBrief(spec: SkillSpec): string {
  const numbers =
    spec.类别 === '攻击'
      ? `威力 ${spec.威力}／命中 ${spec.命中}%／暴击 ${spec.暴击}%`
      : `命中 ${spec.命中}%`;
  return `${spec.类别}｜${numbers}／精力 ${spec.精力}`;
}
