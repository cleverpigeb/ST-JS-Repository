import type { Schema } from '../../schema';
import { STAGE_CAPS, STAGE_ORDER, type Stage } from '../data/stages';

/** 面板改「关系」组时必须一并派发的联动。
 *
 * schema 顶部写明三类跨字段约束「由脚本负责，本文件只注明、不实现」。本卡的脚本就是这个面板，
 * 所以其中两条落在这里；第三条（事件.进行中 → $历史区 搬移）在事件页自己做。
 *
 *   只增不减 —— `关系.$已达最高关系阶段` 只在新段更靠后时前移，关系回退不动它（草案 §1.3 第二条）。
 *   派  生   —— 她的 `$生命上限`／`$精力上限` 查草案 §5 表，锚点是**历史最高段**而不是当前段；
 *                所以关系回退后她的血量不跟着掉，与「战斗侧派生一律查 $已达最高关系阶段」一致。
 *
 * 另外补一条 schema 注明的脚本职责：`_质变决斗已解锁` 在好感度满 100 时置真。此处**只置真不置假**——
 * 草案没有「跌破 100 就收回解锁」的条文，回退与再邀请由 `$邀请暂缓于` 承担（§5.7.3）。
 *
 * 刻意不动的三个字段：`好感度本轮增量`（模型侧唯一入口，面板改它等于替模型发言）、
 * `$回退预备` 与 `_关系刚刚回退`（§1.3 描述的是增量结算路径上的信号，面板手动改总值不是那条路径）。
 * design-spec §5.8 的字段落位表也没给这三项控件。**这三项由 `logic/settle.ts` 在每层结算时维护**——
 * 那是模型输出的结算通道，与本文件的手改通道刻意分开，不要合并。
 */
export function relationPatch(
  data: Schema,
  next: { 关系?: Stage; 好感度?: number },
): Pick<Schema, '关系' | '朱小笋'> {
  const stage = next.关系 ?? data.关系._当前关系;
  const reached =
    STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(data.关系.$已达最高关系阶段)
      ? stage
      : data.关系.$已达最高关系阶段;

  const affection = _.clamp(Math.round(next.好感度 ?? data.关系.$好感度), 0, 100);
  const caps = STAGE_CAPS[reached];

  return {
    关系: {
      ...data.关系,
      _当前关系: stage,
      $已达最高关系阶段: reached,
      $好感度: affection,
      _质变决斗已解锁: data.关系._质变决斗已解锁 || affection === 100,
    },
    朱小笋: {
      ...data.朱小笋,
      $生命上限: caps.她生命,
      $精力上限: caps.她精力,
    },
  };
}
