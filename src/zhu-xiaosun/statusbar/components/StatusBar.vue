<template>
  <div class="hud" :class="{ 'hud--battle': mode === '战斗态' }">
    <!-- 场景信息在战斗态不显示：战斗态是独立布局，首屏让给双方生命／精力／状态／回合数，
         场景时间地点在对局中无信息价值，战斗结束回到常态自然恢复（design-spec §5.8 布局模式）。 -->
    <ErrorBoundary v-if="mode !== '战斗态'" label="常显头部">
      <SceneHeader />
    </ErrorBoundary>

    <ErrorBoundary :label="mode">
      <BattlePanel v-if="mode === '战斗态'" />
      <InvitePanel v-else-if="mode === '邀请态'" />
      <NormalPanel v-else />
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { useDataStore } from '../store';
import BattlePanel from './BattlePanel.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import InvitePanel from './InvitePanel.vue';
import NormalPanel from './NormalPanel.vue';
import SceneHeader from './SceneHeader.vue';

const store = useDataStore();

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
</script>

<style lang="scss" scoped>
.hud {
  padding: 8px;
  background: var(--hud-bg-1);
  color: var(--hud-text);
}
</style>
