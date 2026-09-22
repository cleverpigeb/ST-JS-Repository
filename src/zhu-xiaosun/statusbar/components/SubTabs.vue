<template>
  <div class="sub" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="sub__item hud-tap"
      :class="{ 'sub__item--active': model === tab.id }"
      type="button"
      role="tab"
      :aria-selected="model === tab.id"
      :title="tab.label"
      @click="model = tab.id"
    >
      <i :class="tab.icon" aria-hidden="true"></i>
      <span class="sub__label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
/** 分区内部的局部分页，用在左右布局的右栏顶部。
 *
 * 与 `TabBar` 刻意做成两种观感：TabBar 是「纸片文件夹舌」、活跃页与下方面板连成一体，一眼看出是
 * 顶层四页；本组件是一条分段控件，整条压在右栏里，读起来是「这一页内部的小抽屉」。层级靠形状区分，
 * 不靠缩进，窄屏下也不会误读成又一排顶层标签。
 *
 * 不允许折叠成无活跃项，理由同 TabBar：右栏任何时候都要有内容。
 * 内容由父组件用 `v-if` 分支渲染、**不套 KeepAlive**——编辑态的草稿在父组件手里，
 * 子分页只是模板分支，切来切去不会丢草稿。 */
defineProps<{
  tabs: readonly { id: string; label: string; icon: string }[];
}>();

const model = defineModel<string>({ required: true });
</script>

<style lang="scss" scoped>
.sub {
  display: flex;
  gap: 1px;
  padding: 1px;
  margin-bottom: 8px;
  border: 1px solid var(--hud-border);
  border-radius: 3px;
  background: var(--hud-bg-1);
}

.sub__item {
  flex: 1 1 0;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--hud-mute);
  font: inherit;
  font-size: 12px;
  line-height: 1.7;
  padding: 0 4px;
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  i {
    margin-right: 4px;
  }

  &:hover {
    color: var(--theme-accent);
  }
}

.sub__item--active {
  background: var(--theme-soft);
  color: var(--theme-accent);
  font-weight: 700;
}

/* 右栏本来就窄，装不下三个词时只留图标。
 * 断点比 TabBar 的 340px 高：右栏只占整宽的六成左右，先于整体到达极限。 */
@media (max-width: 460px) {
  .sub__label {
    display: none;
  }

  .sub__item i {
    margin-right: 0;
  }
}
</style>
