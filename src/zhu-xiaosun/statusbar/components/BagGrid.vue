<template>
  <div class="bg">
    <h4 class="bg__title">
      <i class="fa-solid fa-box-open" aria-hidden="true"></i>
      背包
      <span class="bg__note">固定 3 格，留空即空格</span>
    </h4>

    <ul class="bg__list">
      <li v-for="slot in BAG_SLOTS" :key="slot" class="bg__slot" :class="{ 'bg__slot--empty': !bag[slot].名称 }">
        <template v-if="editing">
          <EditableField
            :label="slot"
            editing
            :model-value="bag[slot].名称"
            placeholder="留空＝空格"
            @update:model-value="value => setName(slot, String(value))"
          />
          <EditableField
            label="数量"
            editing
            type="number"
            :min="bag[slot].名称 ? 1 : 0"
            :max="capOf(slot)"
            :model-value="bag[slot].数量"
            :hint="capHint(slot)"
            @update:model-value="value => setCount(slot, Number(value))"
          />
        </template>

        <template v-else>
          <span v-if="!bag[slot].名称" class="bg__empty">{{ slot }}　空格</span>
          <template v-else>
            <span class="bg__name">{{ bag[slot].名称 }}</span>
            <span class="bg__tier" :class="`bg__tier--${tierClass(slot)}`">{{ tierOf(slot) }}</span>
            <span class="bg__count hud-num">×{{ bag[slot].数量 }}</span>
            <span class="bg__effect">{{ effectOf(slot) }}</span>
          </template>
        </template>
      </li>
    </ul>

    <p v-if="rareWarning" class="bg__warn">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
      她按设定不获得稀有道具；此处不拦，只提醒一句。
    </p>
  </div>
</template>

<script setup lang="ts">
import { lookupItem, UNREGISTERED_TIER } from '../data/items';
import { BAG_SLOTS, type Bag } from '../logic/bag';
import EditableField from './EditableField.vue';

/** 背包三格。§11.3 要求显示 **名称／档位／剩余数量**，效果作为第四项补在后面。
 *
 * 本组件不持有草稿：编辑态下把改动 `update:slot` 抛回页面，由页面写进它自己的 reactive 草稿，
 * 提交时统一 Object.assign（design-spec §5.8 草稿层）。 */
const props = withDefaults(
  defineProps<{
    bag: Bag;
    editing: boolean;
    /** 她的背包多一条提示：设定上她不获得稀有道具。 */
    owner?: '主角' | '朱小笋';
  }>(),
  { owner: '主角' },
);

const emit = defineEmits<{ 'update:slot': [slot: (typeof BAG_SLOTS)[number], next: { 名称: string; 数量: number }] }>();

type Slot = (typeof BAG_SLOTS)[number];

function tierOf(slot: Slot) {
  return lookupItem(props.bag[slot].名称)?.档位 ?? UNREGISTERED_TIER;
}

function tierClass(slot: Slot) {
  const tier = tierOf(slot);
  return { 常见: 'common', 精良: 'fine', 稀有: 'rare', 非战斗: 'offfield' }[tier] ?? 'unknown';
}

function effectOf(slot: Slot) {
  return lookupItem(props.bag[slot].名称)?.效果 ?? '效果未登记（草案 §8 没有这一条）';
}

/** 空格的数量上限按 0 算，避免编辑时把空格填出个数量来。 */
function capOf(slot: Slot) {
  const name = props.bag[slot].名称;
  return name ? _.clamp(lookupItem(name)?.堆叠上限 ?? 3, 1, 3) : 0;
}

function capHint(slot: Slot) {
  const name = props.bag[slot].名称;
  if (!name) {
    return '';
  }
  const spec = lookupItem(name);
  return spec ? `${spec.档位}档，每格上限 ${capOf(slot)}` : '未登记道具，按常见档上限 3 兜底';
}

const rareWarning = computed(
  () => props.owner === '朱小笋' && BAG_SLOTS.some(slot => lookupItem(props.bag[slot].名称)?.档位 === '稀有'),
);

function setName(slot: Slot, name: string) {
  const trimmed = name.trim();
  if (trimmed === '') {
    emit('update:slot', slot, { 名称: '', 数量: 0 });
    return;
  }
  const cap = _.clamp(lookupItem(trimmed)?.堆叠上限 ?? 3, 1, 3);
  emit('update:slot', slot, { 名称: trimmed, 数量: _.clamp(props.bag[slot].数量 || 1, 1, cap) });
}

function setCount(slot: Slot, count: number) {
  emit('update:slot', slot, { 名称: props.bag[slot].名称, 数量: count });
}
</script>

<style lang="scss" scoped>
.bg__title {
  font-size: 12px;
  color: var(--hud-mute);
  font-weight: 700;
  margin-bottom: 4px;

  i {
    margin-right: 4px;
  }
}

.bg__note {
  font-weight: 400;
  font-size: 11px;
}

.bg__list {
  list-style: none;
}

.bg__slot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--hud-rule);

  &:last-child {
    border-bottom: none;
  }
}

.bg__slot--empty {
  color: var(--hud-mute);
}

.bg__empty {
  font-size: 12px;
}

.bg__name {
  font-weight: 700;
}

.bg__tier {
  font-size: 11px;
  border: 1px solid currentcolor;
  border-radius: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.bg__tier--common {
  color: var(--hud-mute);
}
.bg__tier--fine {
  color: var(--theme-accent);
}
.bg__tier--rare {
  color: var(--c-affection);
}
.bg__tier--offfield {
  color: var(--c-success);
}
.bg__tier--unknown {
  color: var(--c-warning);
}

.bg__count {
  font-size: 12px;
}

.bg__effect {
  flex: 1 1 100%;
  font-size: 11px;
  color: var(--hud-mute);
}

.bg__warn {
  margin-top: 4px;
  font-size: 11px;
  color: var(--c-warning);

  i {
    margin-right: 3px;
  }
}
</style>
