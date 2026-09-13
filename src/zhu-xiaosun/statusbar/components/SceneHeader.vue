<template>
  <header class="sh hud-surface">
    <div class="sh__bar">
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

      <button v-if="!editing" class="sh__edit hud-tap" type="button" title="编辑常显头部" @click="start">
        <i class="fa-solid fa-pen" aria-hidden="true"></i>
        编辑
      </button>
    </div>

    <div class="sh__rel">
      <EditableField
        label="关系"
        icon="fa-solid fa-link"
        type="select"
        :editing="editing"
        :options="stageOptions"
        :model-value="editing ? draft.关系 : store.data.关系._当前关系"
        hint="剧情层逐级 ±1 不跳段；面板是手动兜底，改动会照常派发解锁与她的上限派生"
        @update:model-value="value => (draft.关系 = value as Stage)"
      />
      <span v-if="!editing && reachedDiffers" class="sh__reached">
        历史最高 {{ store.data.关系.$已达最高关系阶段 }}
      </span>

      <EditableField
        v-if="editing"
        label="好感度"
        icon="fa-solid fa-heart"
        type="number"
        editing
        :min="0"
        :max="100"
        :model-value="draft.好感度"
        hint="0–100，面板直接改总值，不受模型每拍 ±5 的限制"
        @update:model-value="value => (draft.好感度 = Number(value))"
      />
      <StatBar
        v-else
        class="sh__affection"
        label="好感度"
        icon="fa-solid fa-heart"
        tone="affection"
        :value="store.data.关系.$好感度"
        :max="100"
        :low-at="0.1"
      />
    </div>

    <div v-if="editing" class="sh__actions">
      <button class="sh__btn sh__btn--primary hud-tap" type="button" @click="submit">
        <i class="fa-solid fa-check" aria-hidden="true"></i>
        提交
      </button>
      <button class="sh__btn hud-tap" type="button" @click="cancel">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        取消
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { STAGE_ORDER, type Stage } from '../data/stages';
import { relationPatch } from '../logic/derive';
import { useDataStore } from '../store';
import EditableField from './EditableField.vue';
import StatBar from './StatBar.vue';

/** 常显头部：场景时间地点 ＋ `关系._当前关系` ＋ `关系.$好感度`。
 *
 * 这三项常显、不随标签页切换，理由不是「重要」而是**它们是暗线的唯一出口**——
 * 好感度模型读不到总值（design-spec §5.6），界面是玩家唯一能看到它的地方（§5.8 信息优先级）。
 * 战斗态不渲染本组件，由 StatusBar 控制（§5.8 布局模式）。
 *
 * 编辑按§5.8「整块切换编辑态、不做逐字段小铅笔」：右上一个铅笔进编辑，草稿是本地 reactive 副本，
 * 提交时一次性 Object.assign 进 `store.data`，只触发那唯一一次 deep-watch 回写。
 */
const store = useDataStore();

const editing = ref(false);
const draft = reactive({
  时间: '',
  地点: '',
  关系: '恋人' as Stage,
  好感度: 0,
});

const stageOptions = STAGE_ORDER.map(stage => ({ value: stage, label: stage }));

const reachedDiffers = computed(() => store.data.关系.$已达最高关系阶段 !== store.data.关系._当前关系);

function start() {
  draft.时间 = store.data.场景.时间;
  draft.地点 = store.data.场景.地点;
  draft.关系 = store.data.关系._当前关系;
  draft.好感度 = store.data.关系.$好感度;
  editing.value = true;
}

function cancel() {
  editing.value = false; // 草稿直接丢弃，下次 start() 会整份重取
}

function submit() {
  // relationPatch 顺带派发「只增不减」的 $已达最高关系阶段、她的两项上限派生与满 100 解锁。
  const patch = relationPatch(store.data, { 关系: draft.关系, 好感度: draft.好感度 });
  Object.assign(store.data, {
    场景: { ...store.data.场景, 时间: draft.时间.trim(), 地点: draft.地点.trim() },
    ...patch,
  });
  editing.value = false;
  // 静默进行：不进正文、不告知模型（§5.5 九项⑥）。
  // 提交值被 schema 的 transform 规范化后与草稿不同是正常的，不要当 bug 修回（§5.8 重渲染时机）。
}
</script>

<style lang="scss" scoped>
.sh {
  padding: 8px 10px;
  margin-bottom: 8px;
}

.sh__bar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sh__scene {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
}

.sh__edit {
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

.sh__rel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--hud-rule);
}

.sh__reached {
  font-size: 11px;
  color: var(--hud-mute);
}

.sh__affection {
  flex: 1 1 160px;
  min-width: 140px;
}

.sh__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.sh__btn {
  border: 1px solid var(--hud-border);
  background: transparent;
  color: var(--hud-text);
  border-radius: 2px;
  padding: 2px 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--theme-soft);
  }
}

.sh__btn--primary {
  border-color: var(--theme-primary);
  color: var(--theme-accent);
  font-weight: 700;
}
</style>
