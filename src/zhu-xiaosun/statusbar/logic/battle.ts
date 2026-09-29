import type { Schema } from '../../schema';
import { isRare, lookupItem, usableInBattle } from '../data/items';
import { CRIT_MULTIPLIER, EP_RECOVER_RATIO, LUCIDITY_K, type Stage } from '../data/stages';
import { resetRounds, type StateName } from '../data/states';
import { BAG_SLOTS, type Bag, type BagSlot } from './bag';
import { herEpCap, herHpCap, youEpCap, youHpCap } from './duel';
import {
  canCleanseSelf,
  canHealSelf,
  canInflictStatus,
  isRecoveryEffect,
  parseEffect,
  type ParsedEffect,
} from './effect';
import { herSkillSet, lookupSkill, type SkillSpec, type SkillTable } from './skill-table';

/** **回合结算引擎**：玩家点下这一手的那一刻，把整个回合算完。
 *
 * 裁定原文（`亲密决斗-规则草案.md:744` §11.7，2026-09-24 用户于 B-G10 实测后）：
 * 「结算发生在发出这一手的那一刻，不在模型回复之后。玩家点下技能／道具／认输 → 面板当场把这一回合
 *   整个算完（先攻、她的选招、命中、伤害、暴击、附加效果、硬控判定、回合结束的状态掉血与吸血、
 *   状态自解、精力恢复）→ 写进 `决斗` 组 → 把算出来的事实**一并写进发出去的那条用户消息里** →
 *   再触发生成。」
 *
 * **为什么这个模块现在才出现**：用户实测第五条「战斗实际上并没有发生」的根因是这一层规则从头到尾
 * 没有实现位。全卡口径始终是「数值由脚本算、模型只叙事」，而 `决斗` 组十六个字段全带 `$`、
 * 模型看不见也写不了，于是「脚本」这个词在第一版指向空处。§11.7 裁定那个脚本就是这套注入面板——
 * 与 2026-09-14 好感度结算那次同一个先例。**这是补实现位，不是改规则**：本模块每一条数值口径
 * 都能在草案里逐字对上，对不上的地方一律在注释里标成「读法，可推翻」。
 *
 * **纯函数、不碰宿主 API、不抓 store**：`resolveTurn()` 收一份 `Schema` 与玩家这一手，
 * 返回补丁与流水，由 `CommandBar` 负责落库、发消息、触发生成。随机数从 `rng` 入参进来，
 * 单测可以喂一个确定序列把整局跑成可复现的。
 *
 * **`logic/battle-log.ts` 随本模块退役**（§11.7 第五条）：那是为「模型报数」那套架构写的
 * 启发式抓取器，从正文反向猜数已无意义，而且它会在模型措辞一变时静默失灵。
 */

/** 对局两侧。取值与 `$技能表` 的 `阵营` 字段逐字一致，所以查表判归属不需要任何映射。
 *
 * **流水里主角那一侧写「主角」而不是 `<user>`，是一处实现读法**（§11.7，用户一句话即可推翻）。
 * `世界书/阶段指导/决斗回合指导.txt` 通篇用 `<user>` 指主角，而本模块不知道玩家的 persona 叫什么；
 * 两边措辞不一致会让模型把「主角」两个字照抄进正文，所以那份条目的「数值的唯一来源」块里加了一条
 * 明码对照（「流水里写「主角」的那一方就是 `<user>`」）。**别把这里改成 `<user>` 了事**：
 * 那需要先核实酒馆对用户消息正文里的 `<user>` 做不做宏替换（本版没核实过），而且段头同时是
 * `SevenBlockLog` 的 `blockClass()` 与本模块 `ledgerLastSkill()` 的匹配面，改一处漏一处就是静默失灵。 */
export type Side = '主角' | '朱小笋';

/** 一方这一回合做的事。`无可用行动` 是她那一侧的真实可能——§6.4 只产出了恋人与亲密恋人两套招，
 * 面板能把关系推到订婚／结婚，那时她名下一招也没有。如实空过，**不就地编一套招**。 */
export type Move =
  | { 种类: '技能'; 名称: string }
  | { 种类: '道具'; 名称: string; 格位: BagSlot }
  | { 种类: '认输' }
  | { 种类: '无可用行动' };

/** 一个 0–1 的随机源。默认 `Math.random`，单测喂确定序列。 */
export type Rng = () => number;

export interface TurnOutcome {
  /** 一次 `Object.assign(store.data, patch)` 就能落库。只带真正动过的组。 */
  patch: { 决斗: Schema['决斗'] } & Partial<Pick<Schema, '主角' | '朱小笋'>>;
  /** 本回合结算流水。**它与写进用户消息里的是同一份文本**（§11.7 第四条）：
   * 一份给模型照抄，一份进 `决斗.$本回合流水` 给面板渲染 §11.1 的第 1、3、5 块。 */
  ledger: string;
  /** 一方生命归零（含认输）＝ 本场已结束。 */
  finished: boolean;
  winner: Side | null;
}

// ────────────────────────────── 随机

/** 1D20。先攻专用（§5「双方各投 1D20，高者先行，平局重投」）。 */
function d20(rng: Rng): number {
  return Math.floor(rng() * 20) + 1;
}

/** 百分比判定。`percent <= 0` 恒假、`>= 100` 恒真，不再多投一次浪费随机序列。 */
function chance(rng: Rng, percent: number): boolean {
  if (percent <= 0) {
    return false;
  }
  if (percent >= 100) {
    return true;
  }
  return rng() * 100 < percent;
}

/** 伤害浮动 0.85–1.00（§5 伤害公式）。 */
function swing(rng: Rng): number {
  return 0.85 + rng() * 0.15;
}

// ────────────────────────────── 流水的段头

/** 段头是**给面板切块用的**，同时也给模型指路。四个头与 §11.1 的七块一一对应：
 * `先攻` 与先手方的行动合起来是第 1 块、后手方是第 3 块、`回合结束` 是第 5 块。
 * 第 2、4、6 块是模型写的正文，流水里没有。
 *
 * 用中括号而不是 Markdown 标题：它要同时活在用户消息里和 MVU 字符串里，
 * 前者会被酒馆按 Markdown 渲染，`#` 开头会变成一行大标题。 */
export const LEDGER_HEADS = {
  先攻: '【先攻】',
  回合结束: '【回合结束】',
  本场结束: '【本场结束】',
} as const;

function actionHead(order: '先手' | '后手', side: Side): string {
  return `【${order}·${side}】`;
}

// ────────────────────────────── 场上两侧的工作态

interface Fighter {
  side: Side;
  hp: number;
  hpCap: number;
  ep: number;
  epCap: number;
  state: StateName;
  rounds: number;
}

function readFighters(data: Schema): { 主角: Fighter; 朱小笋: Fighter } {
  const d = data.决斗;
  return {
    主角: {
      side: '主角',
      hp: d.$主角生命,
      hpCap: youHpCap(data),
      ep: d.$主角精力,
      epCap: youEpCap(data),
      state: d.$主角状态,
      rounds: d.$主角状态剩余回合,
    },
    朱小笋: {
      side: '朱小笋',
      hp: d.$朱小笋生命,
      // 她的上限走 `herHpCap()`：偏差倍率只乘她的生命上限，这个非对称全卡只写在那一处
      hpCap: herHpCap(data),
      ep: d.$朱小笋精力,
      epCap: herEpCap(data),
      state: d.$朱小笋状态,
      rounds: d.$朱小笋状态剩余回合,
    },
  };
}

function writeFighters(base: Schema['决斗'], you: Fighter, her: Fighter): Schema['决斗'] {
  return {
    ...base,
    $主角生命: you.hp,
    $主角精力: you.ep,
    $主角状态: you.state,
    $主角状态剩余回合: you.rounds,
    $朱小笋生命: her.hp,
    $朱小笋精力: her.ep,
    $朱小笋状态: her.state,
    $朱小笋状态剩余回合: her.rounds,
  };
}

// ────────────────────────────── 她的选招（§9）

/** 算权重那一步能看到的**全部**信息。
 *
 * **这个类型里没有「玩家这一手」，是故意的**：§9.3「脚本必须在不知道玩家本回合选择的前提下算权重。
 * 同时选招是节点 A 的已定项，实现时若让她读到玩家的选择就是作弊」，§11.7 第三条把它落成了
 * 「实现上体现为算权重的函数拿不到玩家的选择这个入参」。**给本类型加一个玩家行动字段就是违规**，
 * 不要为了「顺手用一下」把 `Schema` 整份传进来——那等于把 `决斗` 组以外的东西也一并递给了她。 */
export interface HerContext {
  生命: number;
  生命上限: number;
  精力: number;
  精力上限: number;
  状态: StateName;
  对方生命: number;
  对方状态: StateName;
  招表: SkillTable;
  已达最高关系阶段: Stage;
  背包: Bag;
  本场已用道具: boolean;
  /** 上一回合她实际使出的那一招。「讲不出话」封的就是它（§11.7 的实现读法）。 */
  上一手: string;
}

export function herContext(data: Schema): HerContext {
  return {
    生命: data.决斗.$朱小笋生命,
    生命上限: herHpCap(data),
    精力: data.决斗.$朱小笋精力,
    精力上限: herEpCap(data),
    状态: data.决斗.$朱小笋状态,
    对方生命: data.决斗.$主角生命,
    对方状态: data.决斗.$主角状态,
    招表: data.$技能表,
    已达最高关系阶段: data.关系.$已达最高关系阶段,
    背包: data.朱小笋.背包,
    本场已用道具: data.决斗.$本场朱小笋已用道具,
    上一手: ledgerLastSkill(data.决斗.$本回合流水, '朱小笋'),
  };
}

/** 单招的情境倍率连乘（§9.1 七条）。返回 `null` ＝ 精力不足，该招权重 0、不可选。
 *
 * 第四条与第五条按条件本就互斥（对方「无状态」对「已有状态」），所以这里不需要额外排他。
 * 第五条原文「该招只是再施一个状态」里的「只是」按**「它能施状态、而对方已经有一个」**读，
 * 不再追究这一招是否同时还有别的效果——**这是一处读法，用户一句话即可推翻**。 */
export function situationMultiplier(spec: SkillSpec, effect: ParsedEffect, ctx: HerContext): number | null {
  if (spec.精力 > ctx.精力) {
    return null; // 第七条：精力不足以支付该招 → 权重 0
  }
  let multiplier = 1;
  if (spec.威力 * 0.85 >= ctx.对方生命) {
    multiplier *= 6; // 第一条：该招最低伤害 ≥ 对方当前生命
  }
  if (ctx.生命 < ctx.生命上限 * 0.4 && canHealSelf(effect)) {
    multiplier *= 3; // 第二条
  }
  if (ctx.状态 !== '无' && canCleanseSelf(effect)) {
    multiplier *= 2.5; // 第三条
  }
  if (canInflictStatus(effect)) {
    multiplier *= ctx.对方状态 === '无' ? 1.8 : 0.3; // 第四、五条
  }
  if (ctx.精力 < ctx.精力上限 / 3 && spec.精力 >= 15) {
    multiplier *= 0.5; // 第六条（恋人档阈值 60 ÷ 3 = 20，与草案括注对得上）
  }
  return multiplier;
}

/** §9.2 收紧：`最终权重 = 10 × (1 + (情境倍率 − 1) × k)`。
 * k = 0 时恒为 10（纯随机），k = 1 时等于 `10 × 情境倍率`。
 * 夹到 0 以上：倍率 0.3 × 0.5 = 0.15 配 k = 1 仍是正数，但玩家改过数值后未必，负权重会毒化抽样。 */
function finalWeight(multiplier: number, k: number): number {
  return Math.max(0, 10 * (1 + (multiplier - 1) * k));
}

/** 按权重随机抽一个下标（§9.1「**按权重随机抽取**（不取最大值）」）。全零时返回 −1。 */
function drawByWeight(weights: readonly number[], rng: Rng): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return -1;
  }
  let point = rng() * total;
  for (let index = 0; index < weights.length; index += 1) {
    point -= weights[index];
    if (point < 0) {
      return index;
    }
  }
  return weights.length - 1; // 浮点误差兜底
}

/** 她这一回合做什么。**入参里没有玩家的选择**，见 `HerContext` 的注释。 */
export function pickHerMove(ctx: HerContext, rng: Rng): Move {
  // 道具优先（§9.3）：生命低于上限 30%、整场最多一次、第一版不用稀有。
  if (!ctx.本场已用道具 && ctx.生命 < ctx.生命上限 * 0.3) {
    for (const slot of BAG_SLOTS) {
      const cell = ctx.背包[slot];
      const name = (cell?.名称 ?? '').trim();
      if (name === '' || (cell?.数量 ?? 0) <= 0 || isRare(name) || !usableInBattle(name)) {
        continue;
      }
      const item = lookupItem(name);
      if (item && isRecoveryEffect(parseEffect(item.效果))) {
        return { 种类: '道具', 名称: name, 格位: slot };
      }
    }
  }

  // 招表按「已达最高关系阶段」筛（§6.4 第八轮换锚点，战斗侧口径）
  const candidates = herSkillSet(ctx.招表, ctx.已达最高关系阶段).skills.filter(id => {
    const spec = lookupSkill(ctx.招表, id);
    if (!spec) {
      return false;
    }
    // 「讲不出话」封上一手、「沉不住气」只剩攻击类。这两条与玩家那一侧的置灰同源（§7.2），
    // 差别只在她这边没有按钮可灰，只能在候选里剔掉。
    if (ctx.状态 === '讲不出话' && id === ctx.上一手) {
      return false;
    }
    if (ctx.状态 === '沉不住气' && spec.类别 !== '攻击') {
      return false;
    }
    return true;
  });

  const k = LUCIDITY_K[ctx.已达最高关系阶段];
  const weights = candidates.map(id => {
    const spec = lookupSkill(ctx.招表, id)!;
    const multiplier = situationMultiplier(spec, parseEffect(spec.附加效果), ctx);
    return multiplier === null ? 0 : finalWeight(multiplier, k);
  });

  const picked = drawByWeight(weights, rng);
  return picked < 0 ? { 种类: '无可用行动' } : { 种类: '技能', 名称: candidates[picked] };
}

// ────────────────────────────── 单侧行动

interface ActContext {
  lines: string[];
  rng: Rng;
  /** 本场已用稀有道具／她本场已用道具两个标记，随行动修改。 */
  flags: { 稀有已用: boolean; 她已用道具: boolean };
  /** 两侧背包，用道具时就地扣数量。 */
  bags: { 主角: Bag; 朱小笋: Bag };
}

/** 给一方套上一个状态。新状态覆盖旧状态（§7.3），剩余回合按 §7.2 的固定值重置。 */
function applyState(target: Fighter, name: StateName, ctx: ActContext) {
  const 覆盖 = target.state !== '无' && target.state !== name;
  target.state = name;
  target.rounds = resetRounds(name);
  ctx.lines.push(`${target.side}陷入〈${name}〉${覆盖 ? '，原先那个状态被顶掉了' : ''}。`);
}

/** 效果里的回复与解除一律落在**出手方自己**身上。
 *
 * 「乱了阵脚」的反噬只改伤害与状态的落点（§7.2 逐字「伤害打自己、状态施给自己」），
 * 自身回复本来就在自己身上，没有可反的方向。 */
function applySelfPart(actor: Fighter, effect: ParsedEffect, ctx: ActContext) {
  if (effect.回满生命) {
    const 回了 = actor.hpCap - actor.hp;
    actor.hp = actor.hpCap;
    ctx.lines.push(`${actor.side}回满生命，回了 ${回了} 点（${actor.hp}/${actor.hpCap}）。`);
  } else if (effect.回生命 > 0) {
    const 回了 = Math.min(effect.回生命, actor.hpCap - actor.hp);
    actor.hp += 回了;
    ctx.lines.push(`${actor.side}回生命 ${回了} 点（${actor.hp}/${actor.hpCap}）。`);
  }
  if (effect.回精力 > 0) {
    const 回了 = Math.min(effect.回精力, actor.epCap - actor.ep);
    actor.ep += 回了;
    ctx.lines.push(`${actor.side}回精力 ${回了} 点（${actor.ep}/${actor.epCap}）。`);
  }
  if (effect.解除自身状态) {
    if (actor.state === '无') {
      ctx.lines.push(`${actor.side}身上本来就没有状态，这一下的解除没有对象。`);
    } else {
      ctx.lines.push(`${actor.side}解除了自身的〈${actor.state}〉。`);
      actor.state = '无';
      actor.rounds = 0;
    }
  }
}

/** 一方的一次技能行动：硬控判定 → 精力 → 反噬 → 命中 → 伤害与暴击 → 附加效果。
 * 顺序与 §11.2 提示栏六步对齐，流水就是按这个顺序写下来的。 */
function actSkill(actor: Fighter, opponent: Fighter, id: string, table: SkillTable, ctx: ActContext) {
  const spec = lookupSkill(table, id);
  if (!spec) {
    ctx.lines.push(`技能表里没有〈${id}〉，${actor.side}这一手落空，本回合没出成。`);
    return;
  }
  if (spec.精力 > actor.ep) {
    ctx.lines.push(`${actor.side}精力不够（要 ${spec.精力}，只有 ${actor.ep}），〈${id}〉没能使出。`);
    return;
  }
  actor.ep -= spec.精力;

  // 「乱了阵脚」：33% 把这一招打到自己身上（§7.2）
  let target = opponent;
  if (actor.state === '乱了阵脚' && chance(ctx.rng, 33)) {
    target = actor;
    ctx.lines.push(`${actor.side}「乱了阵脚」，这一招打到了自己身上。`);
  }

  // 命中。「心跳失速」命中率 −20%（§7.2），落在**出手方**身上
  const 命中率 = spec.命中 - (actor.state === '心跳失速' ? 20 : 0);
  if (!chance(ctx.rng, 命中率)) {
    ctx.lines.push(`${actor.side}使出〈${id}〉，未命中。`);
    return;
  }

  // 伤害。**只看威力，不看类别**：2026-09-24 裁定去掉了「变化类威力只读」，
  // 玩家给变化招填了威力就该打出来（「填什么就是什么」）。类别现在只管「沉不住气」的选招限制。
  if (spec.威力 > 0) {
    const 暴击 = chance(ctx.rng, spec.暴击 + (actor.state === '面不改色' ? 10 : 0));
    let 伤害 = spec.威力 * swing(ctx.rng);
    if (暴击) {
      伤害 *= CRIT_MULTIPLIER;
    }
    if (actor.state === '脸在烧') {
      伤害 *= 0.75; // 「脸在烧」造成的伤害 ×0.75
    }
    if (target.state === '面不改色') {
      伤害 *= 0.6; // 「面不改色」受到伤害 ×0.6
    }
    const 落值 = Math.max(0, Math.round(伤害));
    target.hp = Math.max(0, target.hp - 落值);
    ctx.lines.push(
      `${actor.side}使出〈${id}〉，造成 ${落值} 点伤害${暴击 ? '，暴击' : ''}。${target.side} ${target.hp}/${target.hpCap}。`,
    );
  } else {
    ctx.lines.push(`${actor.side}使出〈${id}〉，命中。`);
  }

  // 附加效果。施给对方那一路吃反噬（`target` 已经被改过），回复与解除恒落自己
  const effect = parseEffect(spec.附加效果);
  if (effect.固定伤害 > 0) {
    // §8.4：必中固定伤害是道具唯一被允许突破的口径，技能不得有此性质。如实提示而不是静默生效。
    ctx.lines.push(`〈${id}〉写了必中固定伤害，但那是道具才有的口径（§8.4），这一条没有生效。`);
  }
  if (effect.状态) {
    const 落点 = effect.状态.目标 === '自身' ? actor : target;
    if (chance(ctx.rng, effect.状态.概率)) {
      applyState(落点, effect.状态.名称, ctx);
    } else {
      ctx.lines.push(`〈${id}〉的附加效果没有触发。`);
    }
  }
  applySelfPart(actor, effect, ctx);
  if (effect.未识别 !== '') {
    ctx.lines.push(`〈${id}〉的附加效果里有一段脚本没读懂、也没有结算：「${effect.未识别}」。`);
  }
}

/** 一方的一次道具行动。**占掉整个回合、不消耗精力、仍参与先攻**（§8.4／`决斗回合指导.txt:49`）。 */
function actItem(actor: Fighter, opponent: Fighter, name: string, slot: BagSlot, ctx: ActContext) {
  const bag = ctx.bags[actor.side];
  const cell = bag[slot];
  if (!cell || cell.名称 !== name || cell.数量 <= 0) {
    ctx.lines.push(`${actor.side}想用〈${name}〉，但背包 ${slot} 里已经没有了，这一手落空。`);
    return;
  }
  const item = lookupItem(name);
  if (!item) {
    ctx.lines.push(`〈${name}〉不在草案 §8 的道具表里，脚本不替它发明效果，这一手落空。`);
    return;
  }
  if (!usableInBattle(name)) {
    ctx.lines.push(`〈${name}〉不是战斗道具，对局里用不上。`);
    return;
  }

  bag[slot] = { 名称: cell.数量 > 1 ? name : '', 数量: cell.数量 - 1 };
  if (isRare(name)) {
    ctx.flags.稀有已用 = true;
  }
  if (actor.side === '朱小笋') {
    ctx.flags.她已用道具 = true;
  }
  ctx.lines.push(`${actor.side}用了〈${name}〉。`);

  const effect = parseEffect(item.效果);
  if (effect.固定伤害 > 0) {
    // 必中固定伤害：不投命中、不吃浮动、不吃暴击（§8.4）。减伤仍然生效——
    // 「必中固定」说的是这一侧不浮动，没说对面的「面不改色」失效。**读法，可推翻**。
    let 伤害 = effect.固定伤害;
    if (opponent.state === '面不改色') {
      伤害 = Math.round(伤害 * 0.6);
    }
    opponent.hp = Math.max(0, opponent.hp - 伤害);
    ctx.lines.push(`必中，造成 ${伤害} 点伤害。${opponent.side} ${opponent.hp}/${opponent.hpCap}。`);
  }
  if (effect.状态) {
    const 落点 = effect.状态.目标 === '自身' ? actor : opponent;
    if (chance(ctx.rng, effect.状态.概率)) {
      applyState(落点, effect.状态.名称, ctx);
    } else {
      ctx.lines.push(`〈${name}〉的效果没有触发。`);
    }
  }
  applySelfPart(actor, effect, ctx);
  if (effect.未识别 !== '') {
    ctx.lines.push(`〈${name}〉的效果里有一段脚本没读懂、也没有结算：「${effect.未识别}」。`);
  }
}

/** 一方的一次行动，含硬控前置。
 *
 * §7.3／§11.3 line 676：被「腿软」「僵住」的一方**照样选招**，只是判定为无法行动；
 * 动不了的那一手**不扣精力**——精力在 `actSkill` 里扣，走不到那里就没扣。 */
function act(actor: Fighter, opponent: Fighter, move: Move, table: SkillTable, ctx: ActContext) {
  if (actor.state === '僵住') {
    ctx.lines.push(`${actor.side}「僵住」，整个回合动不了。`);
    return;
  }
  if (actor.state === '腿软' && chance(ctx.rng, 30)) {
    ctx.lines.push(`${actor.side}「腿软」，这一手没能出去。`);
    return;
  }
  if (move.种类 === '技能') {
    actSkill(actor, opponent, move.名称, table, ctx);
  } else if (move.种类 === '道具') {
    actItem(actor, opponent, move.名称, move.格位, ctx);
  } else if (move.种类 === '无可用行动') {
    ctx.lines.push(`${actor.side}这一段名下没有登记可用的招（§6.4 只产出了恋人与亲密恋人两套），这一回合空过。`);
  }
}

// ────────────────────────────── 回合结束（§11.1 第 5 块）

/** 回合结束三件事，顺序固定：状态掉血／吸血 → 状态自解判定 → 精力恢复（§11.2）。 */
function endOfRound(first: Fighter, second: Fighter, ctx: ActContext) {
  ctx.lines.push(LEDGER_HEADS.回合结束);

  for (const fighter of [first, second]) {
    const other = fighter === first ? second : first;
    if (fighter.state === '越想越羞') {
      // 4 / 8 / 12 逐回合递增。剩余回合 3→2→1 正好倒着对上，不需要额外记「第几跳」
      const 掉 = (4 - fighter.rounds) * 4;
      fighter.hp = Math.max(0, fighter.hp - 掉);
      ctx.lines.push(`${fighter.side}「越想越羞」掉 ${掉} 生命（${fighter.hp}/${fighter.hpCap}）。`);
    }
    if (fighter.state === '脸在烧') {
      fighter.hp = Math.max(0, fighter.hp - 4);
      ctx.lines.push(`${fighter.side}「脸在烧」掉 4 生命（${fighter.hp}/${fighter.hpCap}）。`);
    }
    if (fighter.state === '被拿住') {
      // 「回合结束目标 −6 生命、施加者 +6 生命」。**施加者按「对侧」读**：
      // `决斗` 组没有「谁施加了这个状态」这个字段，加一个要动 schema 真源。
      // 代价是「乱了阵脚」把「被拿住」反噬到自己身上时，这 6 点会算到对面头上。
      // **这是一处读法，用户一句话即可推翻**（推翻的代价是 schema 加字段，走门禁）。
      fighter.hp = Math.max(0, fighter.hp - 6);
      other.hp = Math.min(other.hpCap, other.hp + 6);
      ctx.lines.push(
        `${fighter.side}「被拿住」掉 6 生命（${fighter.hp}/${fighter.hpCap}），${other.side}回 6 生命（${other.hp}/${other.hpCap}）。`,
      );
    }
  }

  for (const fighter of [first, second]) {
    clearStateIfDue(fighter, ctx);
  }

  for (const fighter of [first, second]) {
    const 回了 = Math.min(Math.round(fighter.epCap * EP_RECOVER_RATIO), fighter.epCap - fighter.ep);
    fighter.ep += 回了;
    ctx.lines.push(`${fighter.side}恢复精力 ${回了} 点（${fighter.ep}/${fighter.epCap}）。`);
  }
}

/** 状态自解判定（§7.2 的「解除」栏，十种逐条）。 */
function clearStateIfDue(fighter: Fighter, ctx: ActContext) {
  const name = fighter.state;
  if (name === '无') {
    return;
  }
  const clear = (why: string) => {
    fighter.state = '无';
    fighter.rounds = 0;
    ctx.lines.push(`${fighter.side}的〈${name}〉${why}。`);
  };

  switch (name) {
    case '被拿住':
      // 不自动消退，只能靠「解除自身状态」或被新状态覆盖
      return;
    case '僵住':
      clear('固定 1 回合，回合结束必解');
      return;
    case '乱了阵脚':
      if (chance(ctx.rng, 50)) {
        clear('自行解除了（每回合 50%）');
      } else {
        ctx.lines.push(`${fighter.side}的〈乱了阵脚〉没解除，继续。`);
      }
      return;
    case '腿软': {
      if (chance(ctx.rng, 30)) {
        clear('自行解除了（每回合 30%）');
        return;
      }
      fighter.rounds -= 1;
      if (fighter.rounds <= 0) {
        clear('满 4 回合，强制解除');
      } else {
        ctx.lines.push(`${fighter.side}的〈腿软〉还剩 ${fighter.rounds} 回合。`);
      }
      return;
    }
    default: {
      // 越想越羞／心跳失速／面不改色／脸在烧／讲不出话／沉不住气：按固定回合倒数
      fighter.rounds -= 1;
      if (fighter.rounds <= 0) {
        clear('到期消退');
      } else {
        ctx.lines.push(`${fighter.side}的〈${name}〉还剩 ${fighter.rounds} 回合。`);
      }
    }
  }
}

// ────────────────────────────── 主入口

/** 把这一回合整个算完。**这是 §11.7 第一条那个「当场算完」的落点。**
 *
 * 次序与裁定逐字对齐：先攻 → 她的选招 → 命中 → 伤害 → 暴击 → 附加效果 → 硬控判定 →
 * 回合结束的状态掉血与吸血 → 状态自解 → 精力恢复。实现上硬控判定提到了每一方行动的最前面，
 * 因为「动不动得了」在「出不出得了这一招」之前——裁定那一句是**清单**不是**流程图**。
 *
 * 她的选招排在先攻之前：先攻结果不能影响她选什么（同时选招，§4），把它放在前面就不可能写错。 */
export function resolveTurn(data: Schema, playerMove: Move, rng: Rng = Math.random): TurnOutcome {
  const { 主角: you, 朱小笋: her } = readFighters(data);
  const lines: string[] = [];
  const ctx: ActContext = {
    lines,
    rng,
    flags: { 稀有已用: data.决斗.$本场已用稀有道具, 她已用道具: data.决斗.$本场朱小笋已用道具 },
    bags: { 主角: klona(data.主角.背包), 朱小笋: klona(data.朱小笋.背包) },
  };

  // 认输：不受先攻影响，立即生效并结束战斗（§5）。她那一手根本不投。
  if (playerMove.种类 === '认输') {
    // **把认输写成「主角生命归零」是一处实现读法**：`决斗` 组没有「谁认输了」这个字段，
    // 而 §10.2 把「败」与「认输」归成同一种后果，面板判胜负本来就只看生命是否归零。
    // 代价是流水里的血量与正文里的「他自己把话收住」对不上一点——所以流水第一行就写明是认输。
    // **用户一句话即可推翻**（推翻的代价是 schema 加字段，走门禁）。
    you.hp = 0;
    lines.push(`${LEDGER_HEADS.本场结束}主角认输，本场立即结束，不投先攻、双方都不出手。朱小笋胜。`);
    lines.push('主角的生命在面板上记为 0，那是「这一场输了」的记法，不是他真被打空了。');
    return {
      patch: { 决斗: writeFighters({ ...data.决斗, $本回合流水: lines.join('\n') }, you, her) },
      ledger: lines.join('\n'),
      finished: true,
      winner: '朱小笋',
    };
  }

  // 她先选。入参不含玩家这一手（§9.3／§11.7 第三条）
  const herMove = pickHerMove(herContext(data), rng);

  // 先攻：双方各投 1D20，高者先行，平局重投，不加修正、不设优先度（§5）
  let youRoll = 0;
  let herRoll = 0;
  lines.push(LEDGER_HEADS.先攻);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    youRoll = d20(rng);
    herRoll = d20(rng);
    if (youRoll !== herRoll) {
      break;
    }
    // §11.2 第一条：平局重投也如实列出
    lines.push(`主角 1D20＝${youRoll}，朱小笋 1D20＝${herRoll}，平局，重投。`);
  }
  const youFirst = youRoll >= herRoll; // 50 次仍平局时给主角，概率约 20^-50，写出来只为不留悬空分支
  lines.push(`主角 1D20＝${youRoll}，朱小笋 1D20＝${herRoll}，${youFirst ? '主角' : '朱小笋'}先行。`);

  const first = youFirst ? you : her;
  const second = youFirst ? her : you;
  const firstMove = youFirst ? playerMove : herMove;
  const secondMove = youFirst ? herMove : playerMove;

  lines.push(actionHead('先手', first.side));
  act(first, second, firstMove, data.$技能表, ctx);

  // §11.2：先手方把对方打到归零就宣告胜负，不再输出后一方的面板与正文
  const 先手就结束了 = first.hp <= 0 || second.hp <= 0;
  if (!先手就结束了) {
    lines.push(actionHead('后手', second.side));
    act(second, first, secondMove, data.$技能表, ctx);
  }

  // 一方已经归零就不再跑回合结束：那一块属于「这一回合还要继续」的结算。
  // **读法**：§11.2 只写了「不再输出后一方的面板与正文」，没写第 5 块。跑它的唯一后果是
  // 让一个已经倒下的人再掉一次状态血，对结果没有影响，却会让流水读起来像战斗还在继续。
  const 有人倒下 = you.hp <= 0 || her.hp <= 0;
  if (!有人倒下) {
    endOfRound(first, second, ctx);
  }

  const 回合数 = data.决斗.$回合数 + 1;
  lines.push(`本回合是第 ${回合数} 回合。`);

  const finished = you.hp <= 0 || her.hp <= 0;
  let winner: Side | null = null;
  if (finished) {
    winner = you.hp <= 0 ? '朱小笋' : '主角';
    lines.push(`${LEDGER_HEADS.本场结束}${winner === '主角' ? '朱小笋' : '主角'}的生命归零，${winner}胜，本场到此结束。`);
  }

  const ledger = lines.join('\n');
  return {
    patch: {
      决斗: writeFighters(
        {
          ...data.决斗,
          $回合数: 回合数,
          $本场已用稀有道具: ctx.flags.稀有已用,
          $本场朱小笋已用道具: ctx.flags.她已用道具,
          $本回合流水: ledger,
        },
        you,
        her,
      ),
      主角: { ...data.主角, 背包: ctx.bags.主角 },
      朱小笋: { ...data.朱小笋, 背包: ctx.bags.朱小笋 },
    },
    ledger,
    finished,
    winner,
  };
}

// ────────────────────────────── 流水的读取

/** 某一方在这份流水里**实际使出**的最后一招。
 *
 * 用途是「讲不出话」的封锁（§7.2「上一次使用的技能被封锁，不可选」）。§11.7 给的实现读法是
 * 「该方最近一次实际使出的技能，每回合重新取——从 `$本回合流水` 里读」，**用户一句话即可推翻**。
 *
 * 「实际使出」按流水里有没有 `使出〈…〉` 那一句算：被「僵住」「腿软」判为动不了、或精力不够
 * 没出成的那几条，流水里写的是「没能出去」，不带 `使出`，于是天然不算。
 * 这与从前 `battle-log.ts` 的 `lastSkillOf()` 形状相同，区别是**这份文本是脚本自己写的**，
 * 不再赌模型的措辞。 */
export function ledgerLastSkill(ledger: string, side: Side): string {
  if (!ledger) {
    return '';
  }
  const pattern = new RegExp(`${side}使出[〈《]([^〉》]+)[〉》]`, 'g');
  let last = '';
  for (const match of ledger.matchAll(pattern)) {
    last = match[1];
  }
  return last;
}

/** 把流水切成面板能逐块渲染的几段（§11.1 的第 1、3、5 块）。
 * 段头以外的行原样归到上一个段头底下；没有段头的流水整份归进一段无名块。 */
export function splitLedger(ledger: string): { head: string; lines: string[] }[] {
  const sections: { head: string; lines: string[] }[] = [];
  for (const raw of (ledger ?? '').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    const matched = /^【([^】]+)】(.*)$/.exec(line);
    if (matched) {
      sections.push({ head: matched[1], lines: matched[2].trim() ? [matched[2].trim()] : [] });
    } else if (sections.length) {
      sections[sections.length - 1].lines.push(line);
    } else {
      sections.push({ head: '', lines: [line] });
    }
  }
  return sections;
}
