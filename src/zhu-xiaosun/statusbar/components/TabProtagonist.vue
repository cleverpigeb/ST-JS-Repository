<template>
  <section class="tp hud-split">
    <!-- 左栏：头像 ＋ 两条属性。 -->
    <div class="hud-split__side">
      <PortraitFrame
        who="you"
        alt="主角头像"
        ratio="3 / 4"
        :src="persona.src"
        :caption="persona.name || '主角'"
        class="hud-split__portrait"
      />

      <!-- 满值条，理由同朱小笋页：常态这两项只有上限、没有当前值字段。 -->
      <StatBar
        label="生命"
        icon="fa-solid fa-heart"
        tone="life"
        :value="editing ? draft.生命上限 : store.data.主角.生命上限"
        :max="editing ? draft.生命上限 : store.data.主角.生命上限"
        :low-at="0"
      />
      <StatBar
        label="精力"
        icon="fa-solid fa-bolt"
        tone="energy"
        :value="editing ? draft.精力上限 : store.data.主角.精力上限"
        :max="editing ? draft.精力上限 : store.data.主角.精力上限"
        :low-at="0"
      />

      <p class="tp__bars-note">常态不记录当前值，消耗只发生在对局里。</p>
    </div>

    <div class="hud-split__main">
      <SubTabs v-model="sub" :tabs="SUB_TABS" />

      <template v-if="sub === '体能'">
        <!-- 两项上限的编辑入口只在编辑态露出：左栏那两条已经把数字读出来了。 -->
        <template v-if="editing">
          <EditableField
            label="生命上限"
            icon="fa-solid fa-heart"
            type="number"
            editing
            :min="PROTAGONIST_FLOOR.生命上限"
            :model-value="draft.生命上限"
            :hint="`下限 ${PROTAGONIST_FLOOR.生命上限}（恋人开局初始值）；剧情层唯一的抬升渠道是专属任务`"
            @update:model-value="value => (draft.生命上限 = Number(value))"
          />
          <EditableField
            label="精力上限"
            icon="fa-solid fa-bolt"
            type="number"
            editing
            :min="PROTAGONIST_FLOOR.精力上限"
            :model-value="draft.精力上限"
            :hint="`下限 ${PROTAGONIST_FLOOR.精力上限}；同上，只有专属任务能抬`"
            @update:model-value="value => (draft.精力上限 = Number(value))"
          />
        </template>

        <p class="tp__recover">
          每回合精力恢复 <span class="hud-num">{{ epRecover }}</span
          >（上限的 {{ Math.round(EP_RECOVER_RATIO * 100) }}%）
        </p>
        <p v-if="!editing" class="tp__hint">
          两项上限在剧情层只由专属任务抬升，下限 {{ PROTAGONIST_FLOOR.生命上限 }}／{{ PROTAGONIST_FLOOR.精力上限 }}。
        </p>
      </template>

      <template v-else-if="sub === '装备'">
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
      </template>

      <BagGrid
        v-else
        :bag="editing ? draft.背包 : store.data.主角.背包"
        :editing="editing"
        owner="主角"
        @update:slot="setSlot"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { EQUIP_SLOTS } from '../data/skills';
import { EP_RECOVER_RATIO, PROTAGONIST_FLOOR } from '../data/stages';
import { normalizeBag, type Bag, type BagSlot } from '../logic/bag';
import { useEditMode } from '../logic/edit-mode';
import { useDataStore } from '../store';
import BagGrid from './BagGrid.vue';
import EditableField from './EditableField.vue';
import PortraitFrame from './PortraitFrame.vue';
import SkillLine from './SkillLine.vue';
import StatBar from './StatBar.vue';
import SubTabs from './SubTabs.vue';

/** 主角页（design-spec §5.8 字段落位表）：
 * `主角.生命上限`（下限 100）／`精力上限`（下限 50）／`背包` 3 格／`装备四槽`**只读展示**。
 * 上限两项是全卡少数可直接编辑的持久值；换装位在技能页——那边看，这边改。
 *
 * 布局与朱小笋页对称：左栏头像＋属性条常驻，右栏局部分页。 */
const store = useDataStore();

const SUB_TABS = [
  { id: '体能', label: '体能', icon: 'fa-solid fa-gauge-simple' },
  { id: '装备', label: '装备', icon: 'fa-solid fa-shield-halved' },
  { id: '随身', label: '随身', icon: 'fa-solid fa-box-open' },
] as const;

const sub = ref<string>(SUB_TABS[0].id);
const draft = reactive({
  // 两项初值取下限。**`as number` 不能省**：`PROTAGONIST_FLOOR` 带 `as const`，直接取值会把
  // 草稿字段推成字面量类型 `100`／`50`，之后赋任何别的数字都报 TS2322。
  生命上限: PROTAGONIST_FLOOR.生命上限 as number,
  精力上限: PROTAGONIST_FLOOR.精力上限 as number,
  背包: {} as Bag,
});

/** 主角头像直接取酒馆当前 persona 的头像，不另设卡内字段：玩家换 persona 时面板跟着换才对。
 *
 * 只在 setup 里读一次——楼层重渲染时组件本来就会重建，中途换 persona 属于罕见操作，
 * 为它挂个轮询不值当。返回的是相对路径（`User Avatars/…`），iframe 继承宿主的 base URL，
 * 所以拼进 `url()` 能解析到酒馆自己的源。
 *
 * 两层保护：接口可能在旧版酒馆助手里不存在（`typeof` 判），也可能抛（try）。
 * 取不到就空串，`PortraitFrame` 会落回内置轮廓，不会出现裂图。 */
function readPersona(): { src: string; name: string } {
  try {
    const src = typeof getPersonaAvatarPath === 'function' ? getPersonaAvatarPath('current') : null;
    const name = typeof getCurrentPersonaName === 'function' ? getCurrentPersonaName() : null;
    return { src: src ?? '', name: name ?? '' };
  } catch {
    return { src: '', name: '' };
  }
}

const persona = readPersona();

const editing = useEditMode({
  start: () => {
    draft.生命上限 = store.data.主角.生命上限;
    draft.精力上限 = store.data.主角.精力上限;
    // klona 深拷一份纯对象：草稿不能是 store.data 的引用，否则每次按键都会被 deep watch 回写 MVU
    draft.背包 = klona(store.data.主角.背包);
  },
  submit: () => {
    // 只展开 `store.data.主角` 再覆盖本页那三项：技能页写的是同一个顶层键的 `装备四槽`，
    // 两页在同一次提交里先后执行，各自重读当下的 store，所以互不覆盖。
    Object.assign(store.data, {
      主角: {
        ...store.data.主角,
        // 下限由前端把关：schema 明说这两项不夹（`主角.生命上限` 注释）
        生命上限: Math.max(PROTAGONIST_FLOOR.生命上限, Math.round(draft.生命上限)),
        精力上限: Math.max(PROTAGONIST_FLOOR.精力上限, Math.round(draft.精力上限)),
        背包: normalizeBag(draft.背包),
      },
    });
  },
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});

/** 每回合精力恢复 ＝ 该方精力上限的 20%（草案 §5）。显示态跟随已提交值，编辑态跟随草稿。 */
const epRecover = computed(() =>
  Math.floor((editing.value ? draft.精力上限 : store.data.主角.精力上限) * EP_RECOVER_RATIO),
);

function setSlot(slot: BagSlot, next: { 名称: string; 数量: number }) {
  draft.背包[slot] = next;
}
</script>

<style lang="scss" scoped>
.tp__bars-note {
  font-size: 11px;
  line-height: 1.45;
  color: var(--hud-mute);
}

.tp__recover,
.tp__hint {
  font-size: 11px;
  line-height: 1.45;
  color: var(--hud-mute);
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
