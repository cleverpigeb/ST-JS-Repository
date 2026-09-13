<template>
  <div class="sl">
    <span v-if="!id" class="sl__empty">{{ empty }}</span>

    <template v-else>
      <span class="sl__name">{{ id }}</span>

      <span v-if="spec" class="sl__kind" :class="spec.类别 === '攻击' ? 'sl__kind--atk' : 'sl__kind--sup'">
        {{ spec.类别 }}
      </span>
      <span v-else class="sl__kind sl__kind--unknown">未登记</span>

      <span
        v-if="spec"
        class="sl__nums hud-num"
        :title="spec.类别 === '变化' ? '变化招的命中率就是它附加效果的判定率：没命中则状态与自身回精力一并不结算' : ''"
      >
        <template v-if="spec.类别 === '攻击'">威力 {{ spec.威力 }} · </template>
        命中 {{ spec.命中 }}%
        <template v-if="spec.暴击 !== null"> · 暴击 {{ spec.暴击 }}%</template>
        · 精力 {{ spec.精力 }}
      </span>

      <span v-if="spec && spec.附加效果" class="sl__extra">{{ spec.附加效果 }}</span>
      <span v-else-if="!spec" class="sl__extra">草案 §6 没有这一条，面板不替它补数值。</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { lookupSkill } from '../data/skills';

/** 一行技能的静态数值展示。数值来自 `data/skills.ts` 静态表，**不进 MVU**：
 * 变量里只存「是否已获得」与「装了哪四个」（schema `主角.技能库`／`装备四槽` 注释）。
 * 暴击倍率全局固定 1.5×，不写进单招，所以这里不显示倍率。 */
const props = withDefaults(defineProps<{ id: string; empty?: string }>(), { empty: '空槽' });

const spec = computed(() => (props.id ? lookupSkill(props.id) : null));
</script>

<style lang="scss" scoped>
.sl {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.sl__empty {
  color: var(--hud-mute);
  font-size: 12px;
}

.sl__name {
  font-weight: 700;
}

.sl__kind {
  font-size: 11px;
  border: 1px solid currentcolor;
  border-radius: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.sl__kind--atk {
  color: var(--c-danger);
}
.sl__kind--sup {
  color: var(--theme-accent);
}
.sl__kind--unknown {
  color: var(--c-warning);
}

.sl__nums {
  font-size: 12px;
  color: var(--hud-mute);
}

.sl__extra {
  flex: 1 1 100%;
  font-size: 11px;
  color: var(--hud-mute);
}
</style>
