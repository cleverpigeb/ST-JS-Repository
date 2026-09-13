<template>
  <div class="np" :class="activeTab.theme">
    <TabBar v-model="active" :tabs="TABS" />

    <div class="np__body hud-surface">
      <!-- 懒渲染：首屏只 mount 活跃页，其余页首次切入才 mount、之后由 KeepAlive 缓存，不做预渲染
           （design-spec §5.8：ST-C2 的 requestIdleCallback 分批是原生 JS 方案，本卡按 Vue 转译）。

           四个分支**必须各带一个 key**：KeepAlive 的缓存键是 `vnode.key ?? vnode.type`，
           而这四支的组件类型都是 ErrorBoundary，不给 key 会被折成同一个缓存项、四页共用一个实例。

           每页各套一层 ErrorBoundary：某页抛错时只有该页显示失败提示，
           其余三页与常显头部照常（§5.8 分区抛错必须隔离）。 -->
      <KeepAlive>
        <ErrorBoundary v-if="active === 'protagonist'" key="protagonist" label="主角页">
          <TabProtagonist />
        </ErrorBoundary>
        <ErrorBoundary v-else-if="active === 'zhuxiaosun'" key="zhuxiaosun" label="朱小笋页">
          <TabZhuXiaosun />
        </ErrorBoundary>
        <ErrorBoundary v-else-if="active === 'skills'" key="skills" label="技能页">
          <TabSkills />
        </ErrorBoundary>
        <ErrorBoundary v-else key="events" label="事件页">
          <TabEvents />
        </ErrorBoundary>
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import ErrorBoundary from './ErrorBoundary.vue';
import TabBar from './TabBar.vue';
import TabEvents from './TabEvents.vue';
import TabProtagonist from './TabProtagonist.vue';
import TabSkills from './TabSkills.vue';
import TabZhuXiaosun from './TabZhuXiaosun.vue';

/** 常态：仪表型布局＝常显头部（在 StatusBar 里）＋ 四标签页分区。 */
const TABS = [
  { id: 'protagonist', label: '主角', icon: 'fa-solid fa-user', theme: 'theme-protagonist' },
  { id: 'zhuxiaosun', label: '朱小笋', icon: 'fa-solid fa-face-smile', theme: 'theme-zhuxiaosun' },
  { id: 'skills', label: '技能', icon: 'fa-solid fa-list-check', theme: 'theme-skills' },
  { id: 'events', label: '事件', icon: 'fa-solid fa-note-sticky', theme: 'theme-events' },
] as const;

const active = ref<string>(TABS[0].id);

/** 切页即换 `--theme-*` 一套取值：类名挂在本组件根节点上，四页与页内组件都吃这套变量。 */
const activeTab = computed(() => TABS.find(tab => tab.id === active.value) ?? TABS[0]);
</script>

<style lang="scss" scoped>
.np__body {
  border-top: none;
  border-radius: 0 0 3px 3px;
  padding: 10px;
}
</style>
