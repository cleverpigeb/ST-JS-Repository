<template>
  <nav class="tb" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tb__item hud-tap"
      :class="{ 'tb__item--active': model === tab.id }"
      type="button"
      role="tab"
      :aria-selected="model === tab.id"
      @click="model = tab.id"
    >
      <i :class="tab.icon" aria-hidden="true"></i>
      <span class="tb__label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
/** 四页切换。切换时由 NormalPanel 改根节点的 `theme-*` 类名，
 * 各页的 `--theme-primary/soft/accent` 随之换一套（design-spec §5.8 组件树草图）。
 *
 * 与示例的 TabNav 不同：本卡**不允许折叠成无活跃页**（再点当前页不取消选中），
 * 因为常态面板任何时候都要有一页在显示。 */
defineProps<{
  tabs: readonly { id: string; label: string; icon: string }[];
}>();

const model = defineModel<string>({ required: true });
</script>

<style lang="scss" scoped>
.tb {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--hud-border);
}

.tb__item {
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: var(--hud-mute);
  font: inherit;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 3px 3px 0 0;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  i {
    margin-right: 4px;
  }

  &:hover {
    color: var(--theme-accent);
    background: var(--theme-soft);
  }
}

.tb__item--active {
  color: var(--theme-accent);
  background: var(--hud-bg-2);
  border-color: var(--hud-border);
  font-weight: 700;
  /* 压住下方那条描边，做出「这页是连着面板的」纸片感 */
  margin-bottom: -1px;
  padding-bottom: 5px;
}

/* 窄屏只留图标，四页不换行 */
@media (max-width: 340px) {
  .tb__label {
    display: none;
  }
}
</style>
