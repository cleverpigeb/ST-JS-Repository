<template>
  <div class="et">
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

    <button v-else class="et__btn hud-tap" type="button" title="整页切换为编辑态" @click="emit('start')">
      <i class="fa-solid fa-pen" aria-hidden="true"></i>
      编辑
    </button>
  </div>
</template>

<script setup lang="ts">
/** 各页右上的编辑入口。
 *
 * design-spec §5.8：**整页**切换编辑态、**不做逐字段小铅笔**——九项②③⑦⑧都含跨字段联动
 * （选状态要自动重置剩余回合、换装要与技能库互查），逐字段编辑承载不了。
 * 本组件只发信号，草稿与提交由各页自己持有。 */
defineProps<{ title: string; editing: boolean }>();

const emit = defineEmits<{ start: []; submit: []; cancel: [] }>();
</script>

<style lang="scss" scoped>
.et {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--hud-rule);
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
</style>
