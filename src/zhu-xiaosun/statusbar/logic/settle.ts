import type { Schema } from '../../schema';
import { STAGE_ORDER, type Stage } from '../data/stages';

/** 好感度的**每拍结算**：把模型写的增量并进总值，并按草案 §1.3 维护回退。
 *
 * schema.ts 在 `好感度本轮增量` 上写着「脚本累加进 $好感度 后复位为 0」，而 `logic/derive.ts` 说
 * 「本卡的脚本就是这个面板」——所以这条通道归本文件。它与 `relationPatch` 是两条不同的路径：
 * `relationPatch` 是**玩家手改**（面板提交），本文件是**模型输出的结算**，两者刻意不共用。
 *
 * 草案的四条口径逐条落在下面：
 *   §1.1  增量夹在 −5…5（schema 的 transform 已经夹过，这里只防手改后的脏值）、
 *         总值夹在 0…100；正增量把 `$回退预备` 置假。
 *   §1.3 一 回退只有一个触发口：**结算前总值已经是 0、`$回退预备` 为真、这一拍又是负增量**
 *         → 关系退一级、总值置 100 − |减值|。减值超出总值但总值还没归 0 时只夹到 0、不回退，
 *         并把 `$回退预备` 置真（这就是草案说的「0 必须先占住一拍」）。
 *   §1.3 一 下界：已在「同学」时总值归 0 后再吃减值只停在 0，不再回退、不引入终局。
 *   §1.3 二 战斗侧一律不动：`$已达最高关系阶段` 不回落，她的两项上限也因此不动
 *         （上限派生锚的是历史最高段，不是当前段），所以本函数只碰「关系」这一组。
 *   §1.3 三 `_关系刚刚回退` 是**一次性**信号：回退那一拍置真，下一拍的结算复位为假。
 *
 * 幂等性：结算把 `好感度本轮增量` 复位为 0，所以同一楼层的面板重挂（切走再切回、重新渲染）
 * 读到的增量是 0，不会二次累加。但「下一拍复位」这一条没法只靠 stat_data 判断——重挂时看到的
 * 也是「增量 0 且信号为真」，与真正的下一拍无从区分。所以 `store.ts` 另存了一个
 * **楼层号水位线**（`affectionSettledHere()`／`markAffectionSettled()`，由 `App.vue` 在 setup 里调用），
 * 见那边的注释。本函数保持纯函数，不读写变量。
 *
 * `_质变决斗已解锁` 沿用 `relationPatch` 的口径**只置真不置假**。§1.3 一 写的「照旧按总值是否满 100
 * 重算，回退后落在 95–99 标志仍为假」描述的是标志本来就为假的情形；若改成每拍重算，§1.1 的软冷却
 * （败 → −5、可立刻重打）会连带失效，那是另一条已拍板的规则。此处按"不收回"实现，差异记在这里。
 */
export function affectionSettlement(data: Schema): Pick<Schema, '关系'> | null {
  const 关系 = data.关系;
  const delta = _.clamp(Math.round(关系.好感度本轮增量), -5, 5);

  let stage: Stage = 关系._当前关系;
  let affection = _.clamp(Math.round(关系.$好感度), 0, 100);
  let prepared = 关系.$回退预备;
  let regressed = false;

  if (delta > 0) {
    affection = Math.min(100, affection + delta);
    prepared = false;
  } else if (delta < 0) {
    const index = STAGE_ORDER.indexOf(stage);
    if (affection === 0 && prepared && index > 0) {
      stage = STAGE_ORDER[index - 1];
      affection = 100 - Math.abs(delta);
      prepared = false;
      regressed = true;
    } else if (affection + delta <= 0) {
      affection = 0;
      prepared = true;
    } else {
      affection += delta;
    }
  }

  const next: Schema['关系'] = {
    ...关系,
    _当前关系: stage,
    _关系刚刚回退: regressed,
    好感度本轮增量: 0,
    $好感度: affection,
    $回退预备: prepared,
    _质变决斗已解锁: 关系._质变决斗已解锁 || affection === 100,
  };

  return _.isEqual(next, 关系) ? null : { 关系: next };
}
