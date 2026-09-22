<template>
  <div class="et">
    <div class="et__row">
      <h3 class="et__title">{{ title }}</h3>

      <template v-if="editing">
        <button class="et__btn et__btn--primary hud-tap" type="button" @click="emit('submit')">
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          提交
        </button>
        <button class="et__btn hud-tap" type="button" @click="emit('cancel')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          取消
        </button>
      </template>

      <button v-else class="et__btn hud-tap" type="button" title="整个面板切换为编辑态" @click="emit('start')">
        <i class="fa-solid fa-pen" aria-hidden="true"></i>
        编辑
      </button>
    </div>

    <p v-if="editing" class="et__note">
      <i class="fa-solid fa-screwdriver-wrench" aria-hidden="true"></i>
      兜底修正：所有分页一起处在编辑态，提交一次性写回，取消则全部丢弃。
    </p>
  </div>
</template>

<script setup lang="ts">
/** 面板右上角**唯一**的编辑入口。
 *
 * design-spec §5.8：**整页**切换编辑态、**不做逐字段小铅笔**——九项②③⑦⑧都含跨字段联动
 * （选状态要自动重置剩余回合、换装要与技能库互查），逐字段编辑承载不了。
 *
 * 实测反馈后粒度从「每页一个」放大到「整个面板一个」：本组件仍然只发信号，
 * 状态与参与者登记在 `logic/edit-mode.ts`，草稿照旧由各分区自己持有。
 * 所以这里保持成一个纯哑组件——由 `StatusBar` 接到全局开关上，方便单独看它的渲染。 */
defineProps<{ title: string; editing: boolean }>();

const emit = defineEmits<{ start: []; submit: []; cancel: [] }>();
</script>

<style lang="scss" scoped>
.et {
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--hud-rule);
}

.et__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.et__title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-accent);
}

.et__btn {
  flex: 0 0 auto;
  border: 1px solid var(--hud-border);
  background: transparent;
  color: var(--hud-mute);
  border-radius: 2px;
  padding: 1px 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--theme-soft);
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }
}

.et__btn--primary {
  border-color: var(--theme-primary);
  color: var(--theme-accent);
  font-weight: 700;
}

/* 只在编辑态露出的一行说明。压成灰小字，免得比它上面那行标题还抢眼。 */
.et__note {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--hud-mute);

  i {
    margin-right: 3px;
  }
}
</style>
