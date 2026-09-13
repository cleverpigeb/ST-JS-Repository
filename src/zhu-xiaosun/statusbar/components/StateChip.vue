<template>
  <!-- 无状态时整块不渲染：§5.8 要求留空，不显示「无」——那会让一行噪音常驻首屏。 -->
  <p v-if="spec" class="sc" :class="`sc--${spec.权重}`" :title="tip">
    <i :class="spec.图标" aria-hidden="true"></i>
    <span class="sc__name">{{ name }}</span>
    <span class="sc__rounds hud-num">{{ roundsLabel }}</span>
  </p>
</template>

<script setup lang="ts">
import { hasCountdown, STATES, type StateName } from '../data/states';

/** 一枚状态徽标。战斗态两侧各一枚，战斗内编辑态也复用它做所选状态的预览。
 *
 * 两条呈现约束来自 `data/states.ts`：状态在剧情里没有名字、也不被角色感知——所以这块只在
 * 面板上出现，正文里那一侧的窘态由模型自己写，面板不替它解释。
 *
 * 剩余回合**不给编辑入口**（§5.8 九项⑦），所以这里只显示；「被拿住」「乱了阵脚」没有固定回合数，
 * 显示「—」而不是 0，否则看起来像是下一回合就会解除。 */
const props = defineProps<{ name: StateName; rounds: number }>();

const spec = computed(() => (props.name === '无' ? null : STATES[props.name]));

const roundsLabel = computed(() => (hasCountdown(props.name) ? `${Math.max(0, Math.round(props.rounds))} 回合` : '—'));

const tip = computed(() => (spec.value ? `${spec.value.效果}；${spec.value.解除}` : ''));
</script>

<style lang="scss" scoped>
.sc {
  margin-top: 5px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  font-size: 11px;
  border: 1px solid currentcolor;
  border-radius: 10px;
  cursor: help;
}

/* 权重三档用功能色分层，不另立调色：轻＝弱化字、中＝状态异常色、重＝危险色。 */
.sc--轻 {
  color: var(--hud-mute);
}
.sc--中 {
  color: var(--c-warning);
}
.sc--重 {
  color: var(--c-danger);
}

.sc__name {
  font-weight: 700;
}

.sc__rounds {
  color: var(--hud-mute);
}
</style>
