<template>
  <header class="sh hud-surface">
    <div class="sh__scene">
      <EditableField
        label="时间"
        icon="fa-solid fa-clock"
        :editing="editing"
        :model-value="editing ? draft.时间 : store.data.场景.时间"
        placeholder="YYYY/MM/DD-HH:MM"
        hint="格式 YYYY/MM/DD-HH:MM"
        @update:model-value="value => (draft.时间 = String(value))"
      />
      <EditableField
        label="地点"
        icon="fa-solid fa-location-dot"
        :editing="editing"
        :model-value="editing ? draft.地点 : store.data.场景.地点"
        placeholder="校内或校外地点"
        @update:model-value="value => (draft.地点 = String(value))"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { useEditMode } from '../logic/edit-mode';
import { useDataStore } from '../store';
import EditableField from './EditableField.vue';

/** 常显头部上半：只剩场景时间地点。战斗态不渲染本组件，由 StatusBar 控制
 * （design-spec §5.8 布局模式「场景信息在战斗态不显示」，该条只约束这一项）。
 *
 * 头部下半（关系段 ＋ 好感度）在 `RelationStrip.vue`，两者显隐条件**互补**：本组件只在战斗态退场，
 * 那个只在常态退场（常态那两项迁进了朱小笋页，2026-09-14 裁定，已回写 §5.8）。
 * **不要把两者合回一个组件**——合了就得在内部再写一层 v-if 并把面板态传进来。
 *
 * 编辑态不再由本组件持有，只登记 hooks 到全局开关（`logic/edit-mode.ts`）。 */
const store = useDataStore();

const draft = reactive({
  时间: '',
  地点: '',
});

const editing = useEditMode({
  start: () => {
    draft.时间 = store.data.场景.时间;
    draft.地点 = store.data.场景.地点;
  },
  submit: () => {
    Object.assign(store.data, {
      场景: { ...store.data.场景, 时间: draft.时间.trim(), 地点: draft.地点.trim() },
    });
    // 静默进行：不进正文、不告知模型（§5.5 九项⑥）。
    // 提交值被 schema 的 transform 规范化后与草稿不同是正常的，不要当 bug 修回（§5.8 重渲染时机）。
  },
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});
</script>

<style lang="scss" scoped>
.sh {
  padding: 8px 10px;
  margin-bottom: 8px;
}

.sh__scene {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  min-width: 0;
}
</style>
