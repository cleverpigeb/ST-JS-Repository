<template>
  <section class="tk">
    <EditToolbar title="技能" :editing="editing" @start="start" @submit="submit" @cancel="cancel" />

    <div class="tk__block">
      <h4 class="tk__h">
        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        装备四槽
        <span class="tk__note">恒 4 槽，只替换不增减</span>
      </h4>

      <ul class="tk__slots">
        <li v-for="slot in EQUIP_SLOTS" :key="slot" class="tk__slot">
          <EditableField
            v-if="editing"
            :label="slot"
            type="select"
            editing
            :options="equipOptions(slot)"
            :model-value="draft.装备四槽[slot]"
            @update:model-value="value => (draft.装备四槽[slot] = String(value))"
          />
          <template v-else>
            <span class="tk__slot-key">{{ slot }}</span>
            <SkillLine :id="store.data.主角.装备四槽[slot]" />
          </template>
        </li>
      </ul>

      <p v-if="duplicated.length" class="tk__warn">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        「{{ duplicated.join('」「') }}」占了不止一个槽。这里不拦，只提醒一句。
      </p>
      <p v-if="benched.length" class="tk__bench">
        已获得但没上槽：{{ benched.join('、') }}
      </p>
    </div>

    <div class="tk__block">
      <h4 class="tk__h">
        <i class="fa-solid fa-book-open" aria-hidden="true"></i>
        技能库
        <span class="tk__note">键＝技能名，值＝是否已获得</span>
      </h4>

      <ul class="tk__lib">
        <li v-for="id in libraryIds" :key="id" class="tk__row" :class="{ 'tk__row--off': !library[id] }">
          <label v-if="editing" class="tk__own">
            <input type="checkbox" :checked="library[id]" @change="toggleOwned(id)" />
            已获得
          </label>
          <span v-else class="tk__own-flag" :class="library[id] ? 'tk__own-flag--yes' : 'tk__own-flag--no'">
            {{ library[id] ? '已获得' : '未获得' }}
          </span>

          <SkillLine :id="id" />

          <span v-if="equippedIds.includes(id)" class="tk__equipped">在槽</span>

          <button v-if="editing" class="tk__del hud-tap" type="button" title="从技能库删掉" @click="removeSkill(id)">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
          </button>
        </li>
        <li v-if="!libraryIds.length" class="tk__empty">技能库是空的。</li>
      </ul>

      <div v-if="editing" class="tk__add">
        <input
          v-model="pending"
          class="tk__add-input hud-tap"
          type="text"
          list="tk-known-skills"
          placeholder="技能名，逐字输入"
          @keyup.enter="addSkill"
        />
        <datalist id="tk-known-skills">
          <option v-for="id in addable" :key="id" :value="id"></option>
        </datalist>
        <button class="tk__add-btn hud-tap" type="button" :disabled="!canAdd" @click="addSkill">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          加入
        </button>
      </div>
      <p v-if="editing" class="tk__hint">
        草案 §6 之外的名字也收，只是数值查不到、会显示「未登记」。删掉一条时，占着槽的那一格会一起清空。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Schema } from '../../schema';
import { EQUIP_SLOTS, SKILLS } from '../data/skills';
import type { FieldOption } from '../logic/field-option';
import { useDataStore } from '../store';
import EditableField from './EditableField.vue';
import EditToolbar from './EditToolbar.vue';
import SkillLine from './SkillLine.vue';

/** 技能页（design-spec §5.8 字段落位表）：
 * `主角.技能库`（可增删）／`装备四槽`**换装操作位**（只替换、仅战斗外）。
 *
 * 「仅战斗外」不需要在这里再判一次：常态面板本身只在 `决斗.$是否在战斗中 === false` 时挂载
 *（StatusBar 的三态单一 computed），战斗态根本进不到这一页。
 *
 * 换装与技能库要互查——删掉库里一条得把占着的槽一起清空——这正是 §5.8 定「整页编辑、
 * 不做逐字段小铅笔」的原因之一。 */
const store = useDataStore();

type Library = Schema['主角']['技能库'];
type Equip = Schema['主角']['装备四槽'];
type Slot = (typeof EQUIP_SLOTS)[number];

const editing = ref(false);
const pending = ref('');
const draft = reactive({ 技能库: {} as Library, 装备四槽: {} as Equip });

/** 显示态读 store，编辑态读草稿；下面所有派生都走这两个入口，避免两处各写一遍三元。 */
const library = computed<Library>(() => (editing.value ? draft.技能库 : store.data.主角.技能库));
const equip = computed<Equip>(() => (editing.value ? draft.装备四槽 : store.data.主角.装备四槽));

const libraryIds = computed(() => Object.keys(library.value));
const ownedIds = computed(() => libraryIds.value.filter(id => library.value[id]));
const equippedIds = computed(() => EQUIP_SLOTS.map(slot => equip.value[slot]).filter(id => id !== ''));

/** 同一招占了多个槽：不拦，只提醒（同 BagGrid 对「她拿到稀有道具」的处理口径）。 */
const duplicated = computed(() => _.keys(_.pickBy(_.countBy(equippedIds.value), count => count > 1)));

/** 已获得却没上槽的招。4→5 质变拿到第 5 招时，这一行就是「该换装了」的提示。 */
const benched = computed(() => ownedIds.value.filter(id => !equippedIds.value.includes(id)));

/** 补全候选：草案 §6 登记过、库里还没有的。手输库外名字也允许。 */
const addable = computed(() => Object.keys(SKILLS).filter(id => !Object.hasOwn(library.value, id)));

const canAdd = computed(() => {
  const name = pending.value.trim();
  return name !== '' && !Object.hasOwn(draft.技能库, name);
});

function equipOptions(slot: Slot): FieldOption[] {
  const options: FieldOption[] = [{ value: '', label: '空槽' }];
  for (const id of ownedIds.value) {
    options.push({ value: id, label: id });
  }
  const current = draft.装备四槽[slot];
  // 当前值可能是库里没有或标了「未获得」的招：保留成一个选项，免得一进编辑态就被静默换掉
  if (current !== '' && !ownedIds.value.includes(current)) {
    options.push({ value: current, label: `${current}（不在已获得列表）` });
  }
  return options;
}

function start() {
  draft.技能库 = klona(store.data.主角.技能库);
  draft.装备四槽 = klona(store.data.主角.装备四槽);
  pending.value = '';
  editing.value = true;
}

function cancel() {
  editing.value = false;
}

function addSkill() {
  if (!canAdd.value) {
    return;
  }
  draft.技能库[pending.value.trim()] = true;
  pending.value = '';
}

/** 删库里一条时连带清空占着的槽（互查）。留着会变成一个指向已删技能的空壳槽。 */
function removeSkill(id: string) {
  delete draft.技能库[id];
  unequip(id);
}

/** 标成「未获得」时同样下槽：没获得的招不该还挂在身上。 */
function toggleOwned(id: string) {
  const next = !draft.技能库[id];
  draft.技能库[id] = next;
  if (!next) {
    unequip(id);
  }
}

function unequip(id: string) {
  for (const slot of EQUIP_SLOTS) {
    if (draft.装备四槽[slot] === id) {
      draft.装备四槽[slot] = '';
    }
  }
}

function submit() {
  Object.assign(store.data, {
    主角: { ...store.data.主角, 技能库: klona(draft.技能库), 装备四槽: klona(draft.装备四槽) },
  });
  editing.value = false;
}
</script>

<style lang="scss" scoped>
.tk__block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);

  &:first-of-type {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
}

.tk__h {
  font-size: 12px;
  font-weight: 700;
  color: var(--hud-mute);
  margin-bottom: 4px;

  i {
    margin-right: 4px;
  }
}

.tk__note {
  font-weight: 400;
  font-size: 11px;
}

.tk__slots,
.tk__lib {
  list-style: none;
}

.tk__slot,
.tk__row {
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

.tk__slot-key {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--hud-mute);
}

.tk__row--off {
  opacity: 0.62;
}

.tk__own {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--hud-mute);
  cursor: pointer;
  user-select: none;

  input {
    margin-right: 3px;
    vertical-align: -1px;
  }
}

.tk__own-flag {
  flex: 0 0 auto;
  font-size: 11px;
}

.tk__own-flag--yes {
  color: var(--c-success);
}
.tk__own-flag--no {
  color: var(--hud-mute);
}

.tk__equipped {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--theme-accent);
  border: 1px solid currentcolor;
  border-radius: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.tk__del {
  flex: 0 0 auto;
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--hud-mute);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;

  &:hover {
    color: var(--c-danger);
  }
}

.tk__empty,
.tk__bench,
.tk__hint {
  font-size: 11px;
  color: var(--hud-mute);
}

.tk__bench {
  margin-top: 4px;
}

.tk__warn {
  margin-top: 4px;
  font-size: 11px;
  color: var(--c-warning);

  i {
    margin-right: 3px;
  }
}

.tk__add {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.tk__add-input {
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  color: var(--hud-text);
  background: var(--hud-bg-1);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 1px 6px;

  &:focus {
    outline: none;
    border-color: var(--theme-primary);
    box-shadow: 0 0 0 2px var(--theme-soft);
  }
}

.tk__add-btn {
  flex: 0 0 auto;
  border: 1px solid var(--hud-border);
  background: transparent;
  color: var(--hud-mute);
  border-radius: 2px;
  padding: 1px 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &:not(:disabled):hover {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }
}
</style>
