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
        <template v-if="spec.暴击 > 0"> · 暴击 {{ spec.暴击 }}%</template>
        · 精力 {{ spec.精力 }}
      </span>

      <span v-if="spec && spec.附加效果" class="sl__extra">{{ spec.附加效果 }}</span>
      <span v-else-if="!spec" class="sl__extra">技能表里没有这一条，面板不替它补数值。</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { lookupSkill, type SkillTable } from '../logic/skill-table';
import { useDataStore } from '../store';

/** 一行技能的数值展示。数值来自 **MVU 根级 `$技能表`**（草案 §6.1 line 268 裁定），
 * 不再有前端静态表；`主角.技能库`／`装备四槽` 只存「是否已获得」与「装了哪四个」。
 * 暴击倍率全局固定 1.5×，不写进单招，所以这里不显示倍率。
 *
 * **变化招的暴击是 0 不是 `null`**：schema 注释逐字「变化类无暴击，写 0 表示没有这一项」，
 * 所以判空用 `> 0`，与 `战斗叙事对照表` 那句 `${s.暴击 ? s.暴击 + '%' : '—'}` 同口径。
 * 从前静态表里写的是 `null`，改表时这个判断跟着改过，别再改回 `!== null`——
 * 变化招的 `暴击: 0` 会当场变成「暴击 0%」显示出来。
 *
 * `table` 只在**技能页编辑态**传：那一页要拿草稿里的表渲染，否则左栏四槽显示的还是提交前的旧值。
 * 其余三处（战斗指令区、主角页、朱小笋页）不传，直接读 store。 */
const props = withDefaults(defineProps<{ id: string; empty?: string; table?: SkillTable | null }>(), {
  empty: '空槽',
  table: null,
});

const store = useDataStore();

const spec = computed(() => lookupSkill(props.table ?? store.data.$技能表, props.id));
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
