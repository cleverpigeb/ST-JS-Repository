<template>
  <section class="tp">
    <EditToolbar title="主角" :editing="editing" @start="start" @submit="submit" @cancel="cancel" />

    <div class="tp__caps">
      <EditableField
        label="生命上限"
        icon="fa-solid fa-heart"
        type="number"
        :editing="editing"
        :min="PROTAGONIST_FLOOR.生命上限"
        :model-value="editing ? draft.生命上限 : store.data.主角.生命上限"
        :hint="`下限 ${PROTAGONIST_FLOOR.生命上限}（恋人开局初始值）；剧情层唯一的抬升渠道是专属任务`"
        @update:model-value="value => (draft.生命上限 = Number(value))"
      />
      <EditableField
        label="精力上限"
        icon="fa-solid fa-bolt"
        type="number"
        :editing="editing"
        :min="PROTAGONIST_FLOOR.精力上限"
        :model-value="editing ? draft.精力上限 : store.data.主角.精力上限"
        :hint="`下限 ${PROTAGONIST_FLOOR.精力上限}；同上，只有专属任务能抬`"
        @update:model-value="value => (draft.精力上限 = Number(value))"
      />
      <p class="tp__recover">
        每回合精力恢复 <span class="hud-num">{{ epRecover }}</span
        >（上限的 {{ Math.round(EP_RECOVER_RATIO * 100) }}%）
      </p>
    </div>

    <div class="tp__block">
      <h4 class="tp__h">
        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        装备四槽
        <span class="tp__note">只读展示，换装在技能页</span>
      </h4>
      <ul class="tp__slots">
        <li v-for="slot in EQUIP_SLOTS" :key="slot" class="tp__slot">
          <span class="tp__slot-key">{{ slot }}</span>
          <SkillLine :id="store.data.主角.装备四槽[slot]" />
        </li>
      </ul>
    </div>

    <div class="tp__block">
      <BagGrid :bag="editing ? draft.背包 : store.data.主角.背包" :editing="editing" owner="主角" @update:slot="setSlot" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { EQUIP_SLOTS } from '../data/skills';
import { EP_RECOVER_RATIO, PROTAGONIST_FLOOR } from '../data/stages';
import { normalizeBag, type Bag, type BagSlot } from '../logic/bag';
import { useDataStore } from '../store';
import BagGrid from './BagGrid.vue';
import EditableField from './EditableField.vue';
import EditToolbar from './EditToolbar.vue';
import SkillLine from './SkillLine.vue';

/** 主角页（design-spec §5.8 字段落位表）：
 * `主角.生命上限`（下限 100）／`精力上限`（下限 50）／`背包` 3 格／`装备四槽`**只读展示**。
 * 上限两项是全卡少数可直接编辑的持久值；换装位在技能页——那边看，这边改。 */
const store = useDataStore();

const editing = ref(false);
const draft = reactive({
  生命上限: PROTAGONIST_FLOOR.生命上限,
  精力上限: PROTAGONIST_FLOOR.精力上限,
  背包: {} as Bag,
});

/** 每回合精力恢复 ＝ 该方精力上限的 20%（草案 §5）。显示态跟随已提交值，编辑态跟随草稿。 */
const epRecover = computed(() =>
  Math.floor((editing.value ? draft.精力上限 : store.data.主角.精力上限) * EP_RECOVER_RATIO),
);

function start() {
  draft.生命上限 = store.data.主角.生命上限;
  draft.精力上限 = store.data.主角.精力上限;
  // klona 深拷一份纯对象：草稿不能是 store.data 的引用，否则每次按键都会被 deep watch 回写 MVU
  draft.背包 = klona(store.data.主角.背包);
  editing.value = true;
}

function cancel() {
  editing.value = false;
}

function setSlot(slot: BagSlot, next: { 名称: string; 数量: number }) {
  draft.背包[slot] = next;
}

function submit() {
  Object.assign(store.data, {
    主角: {
      ...store.data.主角,
      // 下限由前端把关：schema 明说这两项不夹（`主角.生命上限` 注释）
      生命上限: Math.max(PROTAGONIST_FLOOR.生命上限, Math.round(draft.生命上限)),
      精力上限: Math.max(PROTAGONIST_FLOOR.精力上限, Math.round(draft.精力上限)),
      背包: normalizeBag(draft.背包),
    },
  });
  editing.value = false;
}
</script>

<style lang="scss" scoped>
.tp__caps {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tp__recover {
  font-size: 11px;
  color: var(--hud-mute);
}

.tp__block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);
}

.tp__h {
  font-size: 12px;
  font-weight: 700;
  color: var(--hud-mute);
  margin-bottom: 4px;

  i {
    margin-right: 4px;
  }
}

.tp__note {
  font-weight: 400;
  font-size: 11px;
}

.tp__slots {
  list-style: none;
}

.tp__slot {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--hud-rule);

  &:last-child {
    border-bottom: none;
  }
}

.tp__slot-key {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--hud-mute);
}
</style>
