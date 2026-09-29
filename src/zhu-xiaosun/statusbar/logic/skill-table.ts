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
 * 而 `logic/battle.ts` 明文「纯函数、不碰宿主 API、不抓 store」。谁持有表谁传进来。
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
 * **现在没有调用方**（2026-09-24 §11.7）：它原本给 `logic/battle-log.ts` 从本层正文摘
 * 「某某使出〈技能名〉」时判断这一招是谁出的用——正文里 `<user>` 的名字面板并不知道，
 * 按招名查表比在句子里认人名可靠。结算收回前端之后流水是脚本自己写的，出手方直接写在句子里，
 * 不需要反查。函数留着不删是因为「按招名问归属」是这张表的基本读法，删掉等于把这个问题
 * 交给每个调用点各自 `table[id].阵营` 一遍；但**它现在确实没人用**，别当成还在服役的路径去理解。
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

/** 面板编辑九个字段时的数值边界——**只剩一条下限 0，没有上限、没有档位步长**。
 *
 * 裁定原文（`亲密决斗-规则草案.md:274`，2026-09-24 用户于 B-G10 实测后）：
 * 「面板对技能九个字段一律不夹取，玩家填什么就是什么。……去掉全部上限、去掉 5 一档的步长、
 *   去掉变化类的只读，只保留下限 0。」
 *
 * **上一版错在哪**：§6.1 的字段表（命中 50–100、精力 0–25、暴击 5–25 且 5 一档）被本模块当成了
 * **输入夹取范围**，于是命中填 33 会在失焦时被抬回 50、精力填 40 会在敲键时被压回 25，
 * 变化类的威力与暴击更是直接只读。用户实测第一条「技能数值**还是**无法任意修改」说的就是这个——
 * 「还是」二字指向 2026-09-14 那次改判只做对了一半：表体确实落进了 `$技能表`、编辑态确实碰得到，
 * 但碰到的每一个数都会被拉回去。
 *
 * **这不是放弃 §6.1／§6.2**（草案 line 278）：那两节管的是**生成**技能时的合法性，
 * 管出厂与剧情解锁时该给出什么招；而面板的定位是 §11.4 拍板的「模型漏更新变量时的手动兜底，
 * 兜底优先于结算约束力」。把生成规则当成编辑闸，等于让兜底手段先通过一次出厂审核。
 * 结算照旧读表里的数，**脚本不因为一个数越界就拒绝结算**。
 *
 * **下限 0 是一处读法，用户一句话即可推翻**（草案 line 276）：负数在结算里没有定义——
 * 负威力等于给对方回血、负精力消耗等于出手回精力，而这两件事都由「附加效果」承担、不走这两个字段。
 *
 * `step: 1` 不是一个新闸，它只管数字输入框上下箭头一次跳多少；键盘照样能输任意整数。
 * `max: undefined` 传给 `EditableField` 后那一侧的上界夹取整段跳过（见该组件的 `onNumberInput`）。 */
export const SKILL_BOUNDS = { min: 0, max: undefined, step: 1 } as const;

/** 一招的单行摘要，供「改哪一招」下拉与列表分组用。 */
export function skillBrief(spec: SkillSpec): string {
  const numbers =
    spec.类别 === '攻击'
      ? `威力 ${spec.威力}／命中 ${spec.命中}%／暴击 ${spec.暴击}%`
      : `命中 ${spec.命中}%`;
  return `${spec.类别}｜${numbers}／精力 ${spec.精力}`;
}
