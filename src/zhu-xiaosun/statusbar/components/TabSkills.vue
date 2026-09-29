<template>
  <section class="tk hud-split">
    <!-- 左栏：装备四槽。常驻，因为这一页的操作主体就是它。 -->
    <div class="hud-split__side">
      <h4 class="tk__h">
        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        装备四槽
        <span class="tk__note">恒 4 槽，只替换不增减</span>
      </h4>

      <ul class="tk__slots">
        <li v-for="slot in EQUIP_SLOTS" :key="slot" class="tk__slot">
          <!-- `editing` 恒为真：换装是正常交互，不进编辑态也能换（实测反馈）。
               编辑态只改变它往哪儿写——见 `setEquip`。 -->
          <EditableField
            :label="slot"
            type="select"
            editing
            block
            :options="equipOptions(slot)"
            :model-value="equip[slot]"
            @update:model-value="value => setEquip(slot, String(value))"
          />
          <SkillLine
            v-if="equip[slot] !== ''"
            :id="equip[slot]"
            :table="editing ? draft.技能表 : null"
            class="tk__slot-line"
          />
        </li>
      </ul>

      <p v-if="duplicated.length" class="tk__warn">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        「{{ duplicated.join('」「') }}」占了不止一个槽。这里不拦，只提醒一句。
      </p>
      <p v-if="benched.length" class="tk__bench">已获得没上槽的还有 {{ benched.length }} 招，见右侧「未上槽」。</p>
    </div>

    <div class="hud-split__main">
      <SubTabs v-model="sub" :tabs="SUB_TABS" />

      <!-- 数值表：`$技能表` 本体（草案 §6.1 line 268 裁定「面板可编、模型不可写」）。
           与另外三个子页**不是同一份数据**：那三页筛的是 `主角.技能库`（哪几招已获得），
           这一页改的是每一招的九个字段。合在一页里是因为玩家心里它们是同一件事。 -->
      <template v-if="sub === '数值表'">
        <template v-if="editing">
          <EditableField
            label="改哪一招"
            type="select"
            editing
            block
            :options="specOptions"
            :model-value="picked"
            @update:model-value="value => (picked = String(value))"
          />

          <div v-if="spec" class="tk__spec">
            <EditableField
              label="阵营"
              type="select"
              editing
              :options="FACTION_OPTIONS"
              :model-value="spec.阵营"
              hint="这一招算谁的。战斗流水按本字段反查是谁出的手，改错了流水会把人认反。"
              @update:model-value="value => setFaction(value)"
            />
            <EditableField
              label="适用段"
              type="select"
              editing
              :options="STAGE_OPTIONS"
              :model-value="spec.适用段"
              hint="她按段换招，主角的招写「通用」。第一版她只产出了恋人与亲密恋人两套（§6.4）。"
              @update:model-value="value => setStage(value)"
            />
            <EditableField
              label="类别"
              type="select"
              editing
              :options="KIND_OPTIONS"
              :model-value="spec.类别"
              hint="只改类别本身；威力与暴击不会被连带改动（§6.1 的形状约束由生成技能那一侧负责）。"
              @update:model-value="value => setKind(value)"
            />
            <EditableField
              label="威力"
              type="number"
              editing
              :min="SKILL_BOUNDS.min"
              :max="SKILL_BOUNDS.max"
              :step="SKILL_BOUNDS.step"
              :model-value="spec.威力"
              :hint="powerHint"
              @update:model-value="value => setNum('威力', value)"
            />
            <EditableField
              label="命中"
              type="number"
              editing
              :min="SKILL_BOUNDS.min"
              :max="SKILL_BOUNDS.max"
              :step="SKILL_BOUNDS.step"
              :model-value="spec.命中"
              :hint="hitHint"
              @update:model-value="value => setNum('命中', value)"
            />
            <EditableField
              label="暴击"
              type="number"
              editing
              :min="SKILL_BOUNDS.min"
              :max="SKILL_BOUNDS.max"
              :step="SKILL_BOUNDS.step"
              :model-value="spec.暴击"
              :hint="critHint"
              @update:model-value="value => setNum('暴击', value)"
            />
            <EditableField
              label="精力"
              type="number"
              editing
              :min="SKILL_BOUNDS.min"
              :max="SKILL_BOUNDS.max"
              :step="SKILL_BOUNDS.step"
              :model-value="spec.精力"
              hint="填什么就是什么，只拦负数；出手一次就扣这么多。"
              @update:model-value="value => setNum('精力', value)"
            />
            <EditableField
              label="附加效果"
              editing
              block
              :model-value="spec.附加效果"
              placeholder="留空＝没有附加效果"
              :hint="effectHint"
              @update:model-value="value => setText('附加效果', value)"
            />
            <EditableField
              label="叙事指导"
              type="textarea"
              editing
              block
              :model-value="spec.叙事指导"
              placeholder="这一招该被写成什么样"
              hint="世界书「战斗叙事对照表」用 EJS 从这一栏取，改完正文那边跟着变。"
              @update:model-value="value => setText('叙事指导', value)"
            />
          </div>
          <p v-else class="tk__empty">技能表里还没有任何一招，没有可改的对象。</p>
        </template>

        <ul v-else class="tk__lib">
          <li v-for="id in tableIds" :key="id" class="tk__row">
            <span class="tk__side" :class="table[id].阵营 === '朱小笋' ? 'tk__side--her' : 'tk__side--you'">
              {{ table[id].阵营 }}
            </span>
            <SkillLine :id="id" />
            <span class="tk__stage">{{ table[id].适用段 }}</span>
            <p v-if="table[id].叙事指导" class="tk__guide">{{ table[id].叙事指导 }}</p>
          </li>
          <li v-if="!tableIds.length" class="tk__empty">技能表是空的。</li>
        </ul>

        <p class="tk__hint">
          这一页改的是数值表本体（MVU 的 $技能表）：模型看不见也写不了它，只有面板能改。
          世界书「战斗叙事对照表」用 EJS 从同一份表渲染正文，所以改完两边一起变。
          <b>表里没有的招名这一版还不能在这里新登记</b>，算一处已知缺口。
        </p>
      </template>

      <template v-else>
        <ul class="tk__lib">
          <li v-for="id in shownIds" :key="id" class="tk__row" :class="{ 'tk__row--off': !library[id] }">
            <label v-if="editing" class="tk__own">
              <input type="checkbox" :checked="library[id]" @change="toggleOwned(id)" />
              已获得
            </label>
            <span v-else class="tk__own-flag" :class="library[id] ? 'tk__own-flag--yes' : 'tk__own-flag--no'">
              {{ library[id] ? '已获得' : '未获得' }}
            </span>

            <SkillLine :id="id" :table="editing ? draft.技能表 : null" />

            <span v-if="equippedIds.includes(id)" class="tk__equipped">在槽</span>

            <button v-if="editing" class="tk__del hud-tap" type="button" title="从技能库删掉" @click="removeSkill(id)">
              <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
            </button>
          </li>
          <li v-if="!shownIds.length" class="tk__empty">
            {{ libraryIds.length ? '这一类里现在没有技能。' : '技能库是空的。' }}
          </li>
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
          数值表之外的名字也收，只是数值查不到、会显示「未登记」，而且这一版还没法去「数值表」页把它补登记上。
          删掉一条时，占着槽的那一格会一起清空。
        </p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Schema } from '../../schema';
import { EQUIP_SLOTS } from '../data/skills';
import { CRIT_MULTIPLIER, STAGE_ORDER } from '../data/stages';
import { useEditMode } from '../logic/edit-mode';
import type { FieldOption } from '../logic/field-option';
import {
  SKILL_BOUNDS,
  skillBrief,
  type Faction,
  type SkillKind,
  type SkillSpec,
  type SkillStage,
  type SkillTable,
} from '../logic/skill-table';
import { useDataStore } from '../store';
import EditableField from './EditableField.vue';
import SkillLine from './SkillLine.vue';
import SubTabs from './SubTabs.vue';

/** 技能页（design-spec §5.8 字段落位表）：
 * `主角.技能库`（可增删）／`装备四槽`**换装操作位**（只替换、仅战斗外）。
 *
 * 「仅战斗外」不需要在这里再判一次：常态面板本身只在 `决斗.$是否在战斗中 === false` 时挂载
 *（StatusBar 的三态单一 computed），战斗态根本进不到这一页。
 *
 * **换装不再需要先进编辑态**（实测反馈）：编辑态是「变量更新出错时的兜底」，换装是正常玩法动作，
 * 两者不该共用一个闸门。于是这一页有两条写入路径：
 *   常  态 —— 选一次下拉立刻落库（`setEquip`），没有草稿也没有取消。
 *   编辑态 —— 写草稿，跟着全局开关一起提交／丢弃。
 * 技能库的增删与「已获得」勾选仍然锁在编辑态里：那是修数据，不是玩法。
 *
 * 删掉库里一条要把占着的槽一起清空（互查），这是 §5.8 定「整页编辑、不做逐字段小铅笔」的原因之一。
 *
 * **第四个子页「数值表」是 2026-09-14 裁定新增的**（草案 §6.1 line 268：「本表落成 MVU 的根级
 * `$技能表`，面板可编、模型不可写」）。它针对的是实测第五条「编辑状态无法更改技能的描述与数值」：
 * 从前数值在 `data/skills.ts` 的静态表里、叙事指导在世界书正文里，编辑态碰不到任何一半。
 * 现在九个字段全在这一页改，`战斗叙事对照表` 用 EJS 从同一个变量渲染正文。
 *
 * **只改不建**：裁定说的是「可编」，实测抱怨的是「无法更改」，所以这一版不提供新登记一招的入口，
 * 也不提供从数值表删一招。手输表外名字仍然显示「未登记」——那是出厂行为（见下方 `addSkill` 的提示文案），
 * 不是本次要修的东西；真要新建得先有裁定，**不得在这里代为发明规则**。 */
const store = useDataStore();

type Library = Schema['主角']['技能库'];
type Equip = Schema['主角']['装备四槽'];
type Slot = (typeof EQUIP_SLOTS)[number];

const SUB_TABS = [
  { id: '全部', label: '全部', icon: 'fa-solid fa-list-ul' },
  { id: '已获得', label: '已获得', icon: 'fa-solid fa-circle-check' },
  { id: '未上槽', label: '未上槽', icon: 'fa-solid fa-inbox' },
  { id: '数值表', label: '数值表', icon: 'fa-solid fa-table' },
] as const;

/** 三个枚举的选项表。取值必须与 schema `$技能表` 的 `z.enum` 逐字一致，
 * 适用段那一串直接拿 `通用` ＋ `STAGE_ORDER` 拼，免得七段名字在这里再抄一遍。 */
const FACTION_OPTIONS: readonly FieldOption[] = [
  { value: '主角', label: '主角' },
  { value: '朱小笋', label: '朱小笋' },
];

const STAGE_OPTIONS: readonly FieldOption[] = [
  { value: '通用', label: '通用（不分段，主角的招）' },
  ...STAGE_ORDER.map(stage => ({ value: stage, label: stage })),
];

const KIND_OPTIONS: readonly FieldOption[] = [
  { value: '攻击', label: '攻击' },
  { value: '变化', label: '变化' },
];

const sub = ref<string>(SUB_TABS[0].id);
const pending = ref('');
/** 正在改哪一招。留在草稿外面：它是本页的视图状态，不参与提交也不该被取消回滚。 */
const picked = ref('');
const draft = reactive({ 技能库: {} as Library, 装备四槽: {} as Equip, 技能表: {} as SkillTable });

const editing = useEditMode({
  start: () => {
    draft.技能库 = klona(store.data.主角.技能库);
    draft.装备四槽 = klona(store.data.主角.装备四槽);
    draft.技能表 = klona(store.data.$技能表);
    pending.value = '';
    // 选中项沿用上一次，那一招已经不在表里（或首次进入）才落到第一招
    if (!Object.hasOwn(draft.技能表, picked.value)) {
      picked.value = Object.keys(draft.技能表)[0] ?? '';
    }
  },
  submit: () => {
    // 只覆盖本页那两项：主角页在同一次提交里写 `主角` 的另外三项，各自重读当下的 store，互不抹掉。
    // `$技能表` 是根级键，与 `主角` 平级，一次 Object.assign 一起落。
    Object.assign(store.data, {
      主角: { ...store.data.主角, 技能库: klona(draft.技能库), 装备四槽: klona(draft.装备四槽) },
      $技能表: klona(draft.技能表),
    });
  },
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});

/** 显示态读 store，编辑态读草稿；下面所有派生都走这三个入口，避免各处重写一遍三元。 */
const library = computed<Library>(() => (editing.value ? draft.技能库 : store.data.主角.技能库));
const equip = computed<Equip>(() => (editing.value ? draft.装备四槽 : store.data.主角.装备四槽));
const table = computed<SkillTable>(() => (editing.value ? draft.技能表 : store.data.$技能表));

const tableIds = computed(() => Object.keys(table.value));

const libraryIds = computed(() => Object.keys(library.value));
const ownedIds = computed(() => libraryIds.value.filter(id => library.value[id]));
const equippedIds = computed(() => EQUIP_SLOTS.map(slot => equip.value[slot]).filter(id => id !== ''));

/** 同一招占了多个槽：不拦，只提醒（同 BagGrid 对「她拿到稀有道具」的处理口径）。 */
const duplicated = computed(() => _.keys(_.pickBy(_.countBy(equippedIds.value), count => count > 1)));

/** 已获得却没上槽的招。4→5 质变拿到第 5 招时，这一行就是「该换装了」的提示。 */
const benched = computed(() => ownedIds.value.filter(id => !equippedIds.value.includes(id)));

/** 右栏三个子页只是同一份库的三种筛法，不是三份数据——所以切页不用担心草稿分叉。 */
const shownIds = computed(() => {
  if (sub.value === '已获得') {
    return ownedIds.value;
  }
  if (sub.value === '未上槽') {
    return benched.value;
  }
  return libraryIds.value;
});

/** 补全候选：数值表里登记过、库里还没有的。手输表外名字也允许，只是数值查不到。 */
const addable = computed(() => tableIds.value.filter(id => !Object.hasOwn(library.value, id)));

const canAdd = computed(() => {
  const name = pending.value.trim();
  return name !== '' && !Object.hasOwn(draft.技能库, name);
});

/** 「改哪一招」下拉。带上单行摘要，免得只看名字分不清改的是哪一条。 */
const specOptions = computed<FieldOption[]>(() =>
  tableIds.value.map(id => ({ value: id, label: `${id}　${skillBrief(table.value[id])}` })),
);

/** 正在改的那一招，**只指向草稿**。
 *
 * 直接把 `store.data.$技能表[id]` 交给控件会被 `util/mvu.ts` 的 deep watch 逐字符回写 MVU，
 * 且「取消」没有回滚路径（design-spec §5.8 草稿层）——这是整张卡所有编辑位的统一口径。
 * 下面几个 setter 改的都是这个对象，提交时随 `draft.技能表` 整份落库。 */
const spec = computed<SkillSpec | null>(() =>
  Object.hasOwn(draft.技能表, picked.value) ? draft.技能表[picked.value] : null,
);

/** 四个数值字段共用同一条边界：下限 0、无上限、无档位（草案 §6.1 line 274，2026-09-24 裁定）。
 * 不再随「类别」变——变化类的威力与暴击也照样能填，规则与理由都在 `SKILL_BOUNDS` 的注释里。 */
const powerHint =
  '填什么就是什么，只拦负数。§6.1 的「攻击类 ≥ 10、变化类固定 0」管的是生成技能时该给出什么招，不是这一栏的闸。';

const critHint = `填什么就是什么，只拦负数；暴击倍率全局固定 ${CRIT_MULTIPLIER}×，不写进单招。`;

/** 命中那一栏的提示**改过一次**（2026-09-24 §11.7 落地后）。
 *
 * 旧文案写的是「变化招的命中率就是它附加效果的判定率」。那句话在「数值由模型算」的年代无从验证，
 * 结算收回前端之后它变成了一句明确的假话：`logic/battle.ts` 先按本栏投一次命中，过了才去读附加效果，
 * 附加效果自带的「NN%」是**第二次独立判定**。也就是说命中 90、效果 30% 的一招，
 * 实际触发概率是 0.9 × 0.3 ＝ 27%，不是 30%。界面得把这件事说清楚，否则玩家按错的模型调数值。 */
const hitHint =
  '填什么就是什么，只拦负数。这一栏管「这一手有没有打中」；附加效果里自带的「NN%」是打中之后的第二次判定，两次都得过才触发。';

/** 附加效果那一栏的提示**也改过一次**，同样是因为 §11.7 让这一栏真的被读了。
 *
 * 旧文案举的例子是「令对方陷入「僵住」1 回合」——那个句式 `logic/effect.ts` 读不出来，
 * 按它写的效果会整条落进「未识别」、一点都不生效。旧文案在「模型照句子自由发挥」的年代没错，
 * 现在得换成引擎认得的那套语法。回合数也从例子里去掉了：状态持续几回合由 §7.2 的状态表定，
 * 不在这一栏里填（`data/states.ts` 的 `固定回合`）。 */
const effectHint =
  '引擎真的会读这一栏，请按现成十三招的写法来：「30% 给对方「脸在烧」」「自身回生命 20」「自身回精力 15」「自身回满生命」「解除自身状态」，多段用「＋」连。状态名必须是十种里的一个，持续回合由状态表定、这里不填。读不懂的部分会在流水里如实报出来、不生效。';

function setFaction(value: string | number) {
  if (spec.value) {
    spec.value.阵营 = value as Faction;
  }
}

function setStage(value: string | number) {
  if (spec.value) {
    spec.value.适用段 = value as SkillStage;
  }
}

/** 改类别**只改类别**，不再连带动威力与暴击。
 *
 * 上一版在这里调 `applyKind()`：切到「变化」当场把两项归零、切回「攻击」把 0 抬到下限。
 * 那是 2026-09-24 裁定要去掉的「变化类只读」的另一半——归零虽然只发生在切换那一下，
 * 但玩家刚填好的威力 30 会因为改了个类别而消失，同样不是「填什么就是什么」。
 * §6.1 的形状约束照旧由**生成**技能那一侧负责，面板不替它执行。 */
function setKind(value: string | number) {
  if (spec.value) {
    spec.value.类别 = value as SkillKind;
  }
}

/** 四个数值字段共用一个写入口。夹取交给 `EditableField` 的上界 @input／下界 @change 两段，
 * 这里只负责落值——同一套边界在两处各写一遍迟早对不上。 */
function setNum(field: '威力' | '命中' | '暴击' | '精力', value: string | number) {
  if (spec.value) {
    spec.value[field] = Number(value);
  }
}

function setText(field: '附加效果' | '叙事指导', value: string | number) {
  if (spec.value) {
    spec.value[field] = String(value);
  }
}

function equipOptions(slot: Slot): FieldOption[] {
  const options: FieldOption[] = [{ value: '', label: '空槽' }];
  for (const id of ownedIds.value) {
    options.push({ value: id, label: id });
  }
  const current = equip.value[slot];
  // 当前值可能是库里没有或标了「未获得」的招：保留成一个选项，免得一进这一页就被静默换掉
  if (current !== '' && !ownedIds.value.includes(current)) {
    options.push({ value: current, label: `${current}（不在已获得列表）` });
  }
  return options;
}

function setEquip(slot: Slot, id: string) {
  if (editing.value) {
    draft.装备四槽[slot] = id;
    return;
  }
  // 常态即时落库。一次选择一次写，正好一次 deep-watch 回写，不存在按键级抖动
  //（这也是它能脱离草稿机制的原因：下拉没有「输入中」的中间态）。
  const next = klona(store.data.主角.装备四槽);
  next[slot] = id;
  Object.assign(store.data, { 主角: { ...store.data.主角, 装备四槽: next } });
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
</script>

<style lang="scss" scoped>
/* 这一页左栏装的是四个下拉＋技能行，比两张脸那两页宽一点才不会每招都折行。 */
.hud-split__side {
  flex-basis: 46%;
  max-width: 250px;
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

.tk__slot {
  padding: 3px 0;
  border-bottom: 1px dashed var(--hud-rule);

  &:last-child {
    border-bottom: none;
  }
}

/* 只加缩进，**不动 display**：SkillLine 的根是 flex，`.sl__extra` 靠 `flex: 1 1 100%` 换行，
   在这里改成 block 会把附加效果挤回同一行。 */
.tk__slot-line {
  margin-top: 1px;
  padding-left: 2px;
}

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

/* 数值表：九个字段竖排。`EditableField` 自己是一行 flex，这里只管间距与顶上那条分隔线 */
.tk__spec {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--hud-rule);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 阵营徽标沿用「在槽」那枚的形状，只换颜色：同一行里两枚形状一致才不显得杂 */
.tk__side {
  flex: 0 0 auto;
  font-size: 11px;
  border: 1px solid currentcolor;
  border-radius: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.tk__side--her {
  color: var(--theme-accent);
}
.tk__side--you {
  color: var(--hud-mute);
}

.tk__stage {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--hud-mute);
}

/* 叙事指导整行独占：它是一段话，挤在数值后面会把每一行都撑成两行 */
.tk__guide {
  flex: 1 1 100%;
  font-size: 11px;
  line-height: 1.45;
  color: var(--hud-mute);
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
  line-height: 1.45;
  color: var(--hud-mute);
}

.tk__bench {
  margin-top: 4px;
}

.tk__hint {
  margin-top: 6px;

  /* 缺口那句要能被一眼捞出来，但不该重到像警告：只换色不加粗 */
  b {
    color: var(--c-warning);
    font-weight: 400;
  }
}

.tk__warn {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.45;
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
