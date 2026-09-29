<template>
  <div class="ib hud-surface" :class="`ib--${side}`">
    <header class="ib__head">
      <span class="ib__who">{{ who }}</span>
      <!-- 回合数只在她那一侧出现一次（§11.1／§11.8 右下那格「不带回合数」）。 -->
      <span v-if="round !== ''" class="ib__round hud-locked hud-num" title="回合数只读，由脚本推进（§5.8 九项①唯一例外）">
        {{ round }}
      </span>
    </header>

    <StatBar label="生命" icon="fa-solid fa-heart" :value="hp" :max="hpCap" :warn-at="0.5" />
    <StatBar label="精力" icon="fa-solid fa-bolt" tone="energy" :value="ep" :max="epCap" :low-at="0" />

    <!-- 无状态时 StateChip 自己整块不渲染（§11.8「无状态留空」）。 -->
    <StateChip :name="state" :rounds="rounds" />
  </div>
</template>

<script setup lang="ts">
import type { StateName } from '../data/states';
import StatBar from './StatBar.vue';
import StateChip from './StateChip.vue';

/** 对战画面里的一个信息框（§11.8 上半屏表格的左上与右下两格）。
 *
 * 字段逐条来自那张表：「名字、生命数值 + 血条（颜色随比例变）、精力条、状态名 + 图标（无状态留空）、
 * 回合数」，右下那格「字段同上，但**不带回合数**」——所以回合数是可选的 `round` 而不是必填数字，
 * 传空串即不出现，**由调用方决定给不给**，本组件不去判「你是哪一侧所以不给」：
 * 那样会把 §11.1 的一条口径藏进一个 `v-if="side === 'her'"` 里，改起来找不到。
 *
 * 血条「颜色随比例变」用 `StatBar` 的两级阈值做（`warnAt` 0.5、`lowAt` 默认 0.25），
 * 于是一条血条有三段色：满血段走分区主色、过半后转警示色、四分之一以下转危险色。
 * **精力条关掉低位变色**（`lowAt: 0`）：精力见底是每回合的常态，也不是败因，染成危险色会让两条条同时报警、
 * 把真正要紧的那条淹掉。
 *
 * 上限一律由调用方算好传进来。`logic/duel.ts` 那四个派生函数里她的生命上限要乘
 * `$生命上限修正倍率`、精力上限不乘，这个非对称只在那一处写。 */
withDefaults(
  defineProps<{
    /** her ／ you：只用来取边线颜色与对齐方向，不参与任何字段判断。 */
    side: 'her' | 'you';
    who: string;
    hp: number;
    hpCap: number;
    ep: number;
    epCap: number;
    state: StateName;
    rounds: number;
    /** 回合数那一枚徽标的文案。空串＝这一格不带回合数。 */
    round?: string;
  }>(),
  { round: '' },
);
</script>

<style lang="scss" scoped>
.ib {
  padding: 5px 7px;
  min-width: 0;
}

/* 两侧各压一条边线，与对面那一格的立绘遥相呼应：她的框压右边线（人在右上），
   主角的框压左边线（人在左下），两条线连起来就是那两条对角线的端点。 */
.ib--her {
  border-right: 3px solid var(--theme-primary);
}

.ib--you {
  border-left: 3px solid var(--hud-mute);
}

.ib__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
}

.ib__who {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ib__round {
  flex: 0 0 auto;
  font-size: 10px;
}

/* 两条数值条之间留一点缝，别挤成一坨 */
.ib :deep(.sb + .sb) {
  margin-top: 3px;
}

/* 信息框比常态窄得多，两条条的标签与数字都收一号，否则「生命 300 / 300」会折行 */
.ib :deep(.sb__label) {
  font-size: 11px;
}

.ib :deep(.sb__num) {
  font-size: 12px;
}
</style>
