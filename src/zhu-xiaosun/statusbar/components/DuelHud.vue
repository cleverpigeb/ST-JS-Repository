<template>
  <section class="dh hud-ruled" aria-label="对战画面">
    <!-- 上排：她的信息框在左，她的人在右、并压低一截（§11.8「右上偏下」）。 -->
    <div class="dh__row">
      <DuelInfoBox
        class="dh__box"
        side="her"
        who="朱小笋"
        :hp="d.$朱小笋生命"
        :hp-cap="herHpCap(store.data)"
        :ep="d.$朱小笋精力"
        :ep-cap="herEpCap(store.data)"
        :state="d.$朱小笋状态"
        :rounds="d.$朱小笋状态剩余回合"
        :round="roundLabel"
      />
      <PortraitFrame class="dh__art dh__art--her" who="she" alt="朱小笋，正面朝着你" />
    </div>

    <!-- 下排：主角的人在左、并抬高一截（§11.8「左下偏上」），信息框在右。 -->
    <div class="dh__row dh__row--lower">
      <PortraitFrame class="dh__art dh__art--you" who="you" alt="你的背影，背对着看不见的那一侧" />
      <DuelInfoBox
        class="dh__box"
        side="you"
        who="你"
        :hp="d.$主角生命"
        :hp-cap="youHpCap(store.data)"
        :ep="d.$主角精力"
        :ep-cap="youEpCap(store.data)"
        :state="d.$主角状态"
        :rounds="d.$主角状态剩余回合"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { herEpCap, herHpCap, youEpCap, youHpCap } from '../logic/duel';
import { useDataStore } from '../store';
import DuelInfoBox from './DuelInfoBox.vue';
import PortraitFrame from './PortraitFrame.vue';

/** 对战画面 ＝ 战斗态的上半屏（design-spec §5.8 组件树 DuelHud；布局细则见草案 §11.8）。
 *
 * **本组件整块重写过一次**（2026-09-24 §11.8 裁定）。第一版是「两个竖排数值块斜着错开」——
 * 用户 B-G10 实测第四条逐字：「战斗态前端并不符合我的实际预期；我预期的是类似经典 2D 宝可梦
 * 对战界面的前端，而非你给出的这份与常态状态栏类似的战斗态前端」。§11.8 那句说得很准：
 * 「斜向对立与两个信息框只剩字面意思」。
 *
 * 四格落位逐条照 §11.8 的表：
 *   左上     她的信息框（名字、生命数值＋血条、精力条、状态、**回合数**）
 *   右上偏下 她的立绘位（正面朝向玩家）
 *   左下偏上 主角的立绘位（背向玩家）
 *   右下     主角的信息框（字段同上，**不带回合数**）
 * 「对角错开」是这套布局的全部要点：框与自己那一侧的人分处两角，两条对角线交叉、画面中心留空。
 * 实现上不用 CSS grid 而用两行 flex：两侧的宽度比在上下两排是镜像的（框宽人窄），
 * 同一个 grid 的列宽却是全表共用的，非要用 grid 就得把两排拆成两个 grid——那还不如两行 flex 直白。
 * 「偏下／偏上」由 `align-self` 做：上排的人贴行底、下排的人贴行顶，于是两张脸往画面中间挤，
 * 两个框被推到最外侧的两角。
 *
 * **§11.5 的禁令在这里全程有效**：不得使用宝可梦的任何素材。本组件借的只有「信息框对角摆」
 * 这套布局语言；配色全走本卡自己的 `--theme-*`／`--hud-*`，底纹用的是 `global.css` 里
 * 战斗态那套网格（`.hud-ruled` 在 `.hud--battle` 下变成纵横双向格线），立绘仍是 `PortraitFrame`
 * 的 CSS/SVG 抽象轮廓（§11.5 第一版 CSS 占位）。
 *
 * **她在战斗态也有立绘位了**：上一版的注释写着「战斗态里她没有立绘位」，那是照 §5.8 只给两个位
 * 读出来的；§11.8 的表明确给了「右上偏下 她的立绘位」，所以那句话作废。主角那张也从 BattlePanel
 * 搬进本组件——它现在是画面的一部分，不再是面板下方挂着的一张插图。
 *
 * 上限一律走 `logic/duel.ts` 的四个派生函数，**组件不自己乘倍率**：她的生命上限要乘
 * `$生命上限修正倍率`，精力上限不乘，这个非对称只在那一处写，散到组件里必然漏。 */
const store = useDataStore();

/** 决斗组读得很频，取个短名；`store.data` 是 ref 的解包，这里仍是响应式的。 */
const d = computed(() => store.data.决斗);

/** 开战时 `$回合数` 置 0，第一次行动结算后才是第 1 回合，所以 0 不显示成「第 0 回合」。 */
const roundLabel = computed(() => (d.value.$回合数 > 0 ? `第 ${d.value.$回合数} 回合` : '还没出手'));
</script>

<style lang="scss" scoped>
/* 画面是一整块场地，不是两张卡片：所以底纹与描边给在外层，四格自己只带各自的边线。
   战斗态下 `.hud-ruled` 是纵横双向格线（global.css），正好是「格线／卡带感」那一路。 */
.dh {
  padding: 8px 8px 10px;
  border: 1px solid var(--hud-border);
  border-radius: 3px;
  background-color: var(--hud-bg-1);
  overflow: hidden;
}

.dh__row {
  display: flex;
  align-items: flex-end; /* 上排：人贴行底 ＝ 「右上偏下」 */
  gap: 8px;
}

.dh__row--lower {
  margin-top: 10px;
  align-items: flex-start; /* 下排：人贴行顶 ＝ 「左下偏上」 */
}

/* 框宽人窄。框要容下「生命 300 / 300」这一行，所以给它 flex 的可伸缩位；
   人是固定比例的一块，占位就行——第一版没有图，它主要是在画面上占住那一角。 */
.dh__box {
  flex: 1 1 auto;
  min-width: 0;
}

.dh__art {
  flex: 0 0 30%;
  max-width: 96px;
}

/* 两张脸各自往画面中心侧让一点，对角线才交叉得出来；同时压暗一档，
   免得抽象轮廓比信息框还抢眼——这块暗线叙事不该有庆祝型的视觉重量。 */
.dh__art--her {
  margin-bottom: -4px;
  opacity: 0.9;
}

.dh__art--you {
  margin-top: -4px;
  opacity: 0.9;
}

/* 很窄的楼层里（约 300px 以下）30% 的立绘会把信息框挤成每词一行。
   这时把人收到 22%，**不改左右次序**：对角关系是这套布局的识别特征，换成纵排就没了。 */
@media (max-width: 330px) {
  .dh__art {
    flex: 0 0 22%;
  }

  .dh__row {
    gap: 5px;
  }
}
</style>
