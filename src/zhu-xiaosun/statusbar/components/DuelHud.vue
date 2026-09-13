<template>
  <section class="dh">
    <!-- 她：靠右 -->
    <div class="dh__side dh__side--her hud-surface">
      <header class="dh__head">
        <span class="dh__who">朱小笋</span>
        <span class="dh__round hud-locked hud-num" :title="'回合数只读，由脚本推进（§5.8 九项①唯一例外）'">
          {{ roundLabel }}
        </span>
      </header>

      <StatBar label="生命" icon="fa-solid fa-heart" :value="d.$朱小笋生命" :max="herHpCap(store.data)" />
      <StatBar label="精力" icon="fa-solid fa-bolt" tone="energy" :value="d.$朱小笋精力" :max="herEpCap(store.data)" />

      <StateChip :name="d.$朱小笋状态" :rounds="d.$朱小笋状态剩余回合" />
    </div>

    <!-- 主角：靠左，与她斜向对立 -->
    <div class="dh__side dh__side--you hud-surface">
      <header class="dh__head">
        <span class="dh__who">你</span>
      </header>

      <StatBar label="生命" icon="fa-solid fa-heart" :value="d.$主角生命" :max="youHpCap(store.data)" />
      <StatBar label="精力" icon="fa-solid fa-bolt" tone="energy" :value="d.$主角精力" :max="youEpCap(store.data)" />

      <StateChip :name="d.$主角状态" :rounds="d.$主角状态剩余回合" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { herEpCap, herHpCap, youEpCap, youHpCap } from '../logic/duel';
import { useDataStore } from '../store';
import StatBar from './StatBar.vue';
import StateChip from './StateChip.vue';

/** 对局面板（design-spec §5.8 组件树：DuelHud ← 双方生命/精力/状态/回合数）。
 *
 * 两侧**斜向对立**：她靠右、主角靠左。这是「对局面板」这个交互人格的最低成本落地，
 * 不放立绘——§5.8「立绘占位」只给了两个位（她在朱小笋页顶部、主角背影在本面板**下方**），
 * 战斗态里她没有立绘位，由 BattlePanel 在本组件之后挂主角那一张。
 *
 * **回合数只在她这一侧列一次**：两侧各列一遍是同一个数字，重复占位且会让人误以为双方各有计数。
 * 它是九项①里唯一的只读例外，所以套 `.hud-locked` ——按 §5.8 语义配色，只读派生值必须一眼可辨，
 * 否则用户会去点。
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
.dh {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dh__side {
  padding: 6px 8px;
  width: 86%;
}

/* 斜向对立：她压右边线，主角压左边线 */
.dh__side--her {
  align-self: flex-end;
  border-right: 3px solid var(--theme-primary);
}

.dh__side--you {
  align-self: flex-start;
  border-left: 3px solid var(--hud-mute);
}

.dh__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.dh__who {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.dh__round {
  font-size: 11px;
}

/* 两条数值条之间留一点缝，别挤成一坨 */
.dh__side :deep(.sb + .sb) {
  margin-top: 4px;
}
</style>
