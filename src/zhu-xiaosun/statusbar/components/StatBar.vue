<template>
  <div class="sb" :class="[`sb--${tone}`, { 'sb--low': isLow }]">
    <div class="sb__head">
      <span class="sb__label">
        <i v-if="icon" :class="icon" aria-hidden="true"></i>
        {{ label }}
      </span>
      <span class="sb__num hud-num">
        {{ shown }}<span class="sb__max"> / {{ Math.round(max) }}</span>
      </span>
    </div>

    <div
      class="sb__track"
      role="meter"
      :aria-label="label"
      :aria-valuenow="shown"
      aria-valuemin="0"
      :aria-valuemax="Math.round(max)"
    >
      <div class="sb__fill" :style="{ width: percent }"></div>
    </div>

    <p v-if="hint" class="sb__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    value: number;
    max: number;
    icon?: string;
    /** 语义色：life 取分区主色、energy 取分区强调色、affection 取全局好感度色。 */
    tone?: 'life' | 'energy' | 'affection';
    /** 低位阈值（占上限的比例），到此比例及以下条色转 --c-danger；传 0 关闭。 */
    lowAt?: number;
    hint?: string;
  }>(),
  { icon: '', tone: 'life', lowAt: 0.25, hint: '' },
);

const shown = computed(() => Math.round(props.value));
/** 上限为 0（战斗外的决斗字段 prefault 全是 0）时按空条画，不做除零。 */
const ratio = computed(() => (props.max > 0 ? _.clamp(props.value / props.max, 0, 1) : 0));
const percent = computed(() => `${(ratio.value * 100).toFixed(1)}%`);
const isLow = computed(() => props.lowAt > 0 && props.max > 0 && ratio.value <= props.lowAt);
</script>

<style lang="scss" scoped>
/* 语义取色。--sb-color 由下面四条改写，.sb--low 写在最后所以低位优先。 */
.sb--life {
  --sb-color: var(--theme-primary);
}
.sb--energy {
  --sb-color: var(--theme-accent);
}
.sb--affection {
  --sb-color: var(--c-affection);
}
.sb--low {
  --sb-color: var(--c-danger);
}

.sb {
  min-width: 0;
}

.sb__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.sb__label {
  font-size: 12px;
  color: var(--hud-mute);
  white-space: nowrap;

  i {
    color: var(--sb-color);
    margin-right: 3px;
  }
}

.sb__num {
  font-size: 13px;
  color: var(--hud-text);
}

.sb__max {
  color: var(--hud-mute);
  font-size: 11px;
}

.sb__track {
  height: 6px;
  border-radius: 3px;
  background: var(--c-locked);
  border: 1px solid var(--hud-border);
  overflow: hidden;
}

/* 只过渡宽度与颜色，且短：暗线数值不得做庆祝型动效（design-spec §5.8 双线叙事） */
.sb__fill {
  height: 100%;
  background: var(--sb-color);
  transition: width 0.18s ease, background-color 0.12s ease;
}

@media (prefers-reduced-motion: reduce) {
  .sb__fill {
    transition: none;
  }
}

.sb__hint {
  margin-top: 2px;
  font-size: 11px;
  color: var(--hud-mute);
}
</style>
