<template>
  <div class="hud" :class="{ 'hud--battle': mode === '战斗态' }">
    <!-- 整个面板唯一的编辑开关，钉在最上面一行的右端。放在 ErrorBoundary 外：
         它是修数据的兜底入口，某个分区渲染崩了反而更需要它还在。 -->
    <EditToolbar
      :title="MODE_TITLE[mode]"
      :editing="editing"
      @start="startEditing"
      @submit="submitEditing"
      @cancel="cancelEditing"
    />

    <!-- 常显头部的两半，显隐条件互补（design-spec §5.8 组件树 line 410 把头部定义成
         「场景时间地点 ＋ 关系段 ＋ 好感度」，line 392 只让**场景信息**在战斗态退场）：
           · 场景时间地点：战斗态不显示，首屏让给双方生命／精力／状态／回合数；
           · 关系段＋好感度：战斗态与邀请态常显，常态迁进朱小笋页（实测反馈第三条）。
         两者都退场的态不存在，所以头部不会整块空着。 -->
    <ErrorBoundary v-if="mode !== '战斗态'" label="常显头部">
      <SceneHeader />
    </ErrorBoundary>

    <!-- 放在 BattlePanel 之前不只是版面顺序：`participants` 按挂载序遍历，本条先提交，
         BattlePanel 的血量夹取才能读到已经更新的生命上限（见 RelationStrip 注释末段）。 -->
    <ErrorBoundary v-if="mode !== '常态'" label="关系与好感度">
      <RelationStrip />
    </ErrorBoundary>

    <ErrorBoundary :label="mode">
      <BattlePanel v-if="mode === '战斗态'" />
      <InvitePanel v-else-if="mode === '邀请态'" />
      <NormalPanel v-else />
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { cancelEditing, startEditing, submitEditing, useEditMode } from '../logic/edit-mode';
import { useDataStore } from '../store';
import BattlePanel from './BattlePanel.vue';
import EditToolbar from './EditToolbar.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import InvitePanel from './InvitePanel.vue';
import NormalPanel from './NormalPanel.vue';
import RelationStrip from './RelationStrip.vue';
import SceneHeader from './SceneHeader.vue';

const store = useDataStore();

/** 不传 hooks ＝ 只读开关，不登记为参与者：面板本身没有草稿。 */
const editing = useEditMode();

/** 三态互斥，**必须写成单个 computed 返回态名**，不是三个独立 `v-if`——
 * 后者可能同时成立或同时落空（design-spec §5.8 三种面板态与切换条件）。
 *
 * | 战斗态 | `决斗.$是否在战斗中 === true`（优先级最高） |
 * | 邀请态 | 非战斗 且 `_质变决斗已解锁` 且 `$好感度 === 100` 且 `$邀请暂缓于 !== _当前关系` |
 * | 常态   | 其余 |
 *
 * 邀请态不需要额外的「下一次回复」字段：`$好感度` 由模型该拍的更新写入、面板读的是本楼层快照，
 * 「看到 100」与「下一次回复」天然同一拍。`$邀请暂缓于` 存关系段名，
 * 于是「推进到下一段又满则再弹」自动成立（§5.7.3）。
 */
const mode = computed<'战斗态' | '邀请态' | '常态'>(() => {
  const data = store.data;
  if (data.决斗.$是否在战斗中) {
    return '战斗态';
  }
  if (data.关系._质变决斗已解锁 && data.关系.$好感度 === 100 && data.关系.$邀请暂缓于 !== data.关系._当前关系) {
    return '邀请态';
  }
  return '常态';
});

/** 开关那一行的标题。三态各给一个词，让「我现在在编辑什么」有个落点；
 * 不用态名本身（「常态」当标题读起来像系统日志）。 */
const MODE_TITLE = {
  战斗态: '对局',
  邀请态: '邀请',
  常态: '日常',
} as const;
</script>

<style lang="scss" scoped>
.hud {
  padding: 8px;
  background: var(--hud-bg-1);
  color: var(--hud-text);
}
</style>
