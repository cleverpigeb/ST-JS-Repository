<template>
  <section class="bp">
    <!-- 编辑态：整个面板一起切（开关在 StatusBar 右上角）。
         对局面板与指令区在编辑时一并撤掉——同一批数字不该同时以只读和输入两种形态出现，
         而且编辑中途还能出手会让「兜底」变成「改完再打」。 -->
    <template v-if="editing">
      <div class="bp__form">
        <h4 class="bp__h">朱小笋</h4>
        <EditableField
          label="生命"
          icon="fa-solid fa-heart"
          type="number"
          editing
          :min="0"
          :max="draftHerHpCap"
          :model-value="draft.朱小笋生命"
          :hint="`0…${draftHerHpCap}`"
          @update:model-value="value => (draft.朱小笋生命 = Number(value))"
        />
        <EditableField
          label="精力"
          icon="fa-solid fa-bolt"
          type="number"
          editing
          :min="0"
          :max="herEpCap(store.data)"
          :model-value="draft.朱小笋精力"
          :hint="`0…${herEpCap(store.data)}（精力上限不受倍率影响）`"
          @update:model-value="value => (draft.朱小笋精力 = Number(value))"
        />
        <EditableField
          label="当前状态"
          type="select"
          editing
          :options="stateOptions"
          :model-value="draft.朱小笋状态"
          hint="剩余回合随所选状态自动重置，不单独编辑（九项⑦）"
          @update:model-value="value => (draft.朱小笋状态 = value as StateName)"
        />
        <StateChip :name="draft.朱小笋状态" :rounds="resetRounds(draft.朱小笋状态)" />

        <h4 class="bp__h bp__h--gap">你</h4>
        <EditableField
          label="生命"
          icon="fa-solid fa-heart"
          type="number"
          editing
          :min="0"
          :max="youHpCap(store.data)"
          :model-value="draft.主角生命"
          :hint="`0…${youHpCap(store.data)}`"
          @update:model-value="value => (draft.主角生命 = Number(value))"
        />
        <EditableField
          label="精力"
          icon="fa-solid fa-bolt"
          type="number"
          editing
          :min="0"
          :max="youEpCap(store.data)"
          :model-value="draft.主角精力"
          :hint="`0…${youEpCap(store.data)}`"
          @update:model-value="value => (draft.主角精力 = Number(value))"
        />
        <EditableField
          label="当前状态"
          type="select"
          editing
          :options="stateOptions"
          :model-value="draft.主角状态"
          hint="同上，剩余回合自动重置"
          @update:model-value="value => (draft.主角状态 = value as StateName)"
        />
        <StateChip :name="draft.主角状态" :rounds="resetRounds(draft.主角状态)" />

        <h4 class="bp__h bp__h--gap">本场</h4>
        <EditableField
          label="回合数"
          icon="fa-solid fa-rotate-right"
          :model-value="store.data.决斗.$回合数"
          readonly
          hint="只读，由脚本推进（九项①唯一例外）"
        />
        <EditableField
          label="她的生命上限修正倍率"
          type="select"
          :editing="!isQualitative"
          :readonly="isQualitative"
          :options="multiplierOptions"
          :model-value="isQualitative ? 1.0 : draft.倍率"
          :hint="isQualitative ? '质变决斗中该字段无作用对象，恒 ×1.0' : '偏差四档（草案 §10.1）；只乘她的生命上限'"
          @update:model-value="value => (draft.倍率 = Number(value))"
        />
        <!-- 本场请愿：§12.4 逐字「面板可编——请愿措辞写错了要能改」。
             质变决斗里恒为空串（那条路没有请愿），所以那时只读、并把「为什么是空的」写在字面上。 -->
        <EditableField
          label="本场请愿"
          icon="fa-solid fa-hand-holding-heart"
          type="textarea"
          :editing="!isQualitative"
          :readonly="isQualitative"
          :model-value="isQualitative ? '' : draft.请愿"
          :display-as="isQualitative ? '—（质变决斗没有请愿）' : ''"
          placeholder="她赢了要你做的那件事"
          :hint="
            isQualitative
              ? '质变决斗不是为某件事打的，这一栏恒空'
              : '赢的一方兑现的就是这一句；改它不影响已经算过的回合'
          "
          @update:model-value="value => (draft.请愿 = String(value))"
        />
        <p v-if="isQualitative" class="bp__note">
          本场是质变决斗，不做偏差修正，这一档锁在 ×1.0（草案 §10.1 第六轮限定）。
        </p>
      </div>
    </template>

    <template v-else>
      <DuelHud />

      <!-- 本场的偏差判档结果。§10.1 line 595 要求兜底那一层「在面板上写明『判档没成，按 0 档开打，
           可自行调高』」——而按下「发起决斗」的那一瞬面板就翻成了战斗态，常态那块入口已经卸载，
           所以这句话只能由这里接着说。 -->
      <p v-if="verdict" class="bp__tier" :class="{ 'bp__tier--warn': verdict.warn }">
        <i
          :class="verdict.warn ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-scale-balanced'"
          aria-hidden="true"
        ></i>
        {{ verdict.text }}
      </p>

      <ErrorBoundary label="行动选择">
        <CommandBar @edit="startEditing" />
      </ErrorBoundary>
    </template>
  </section>
</template>

<script setup lang="ts">
import { MULTIPLIER_TIERS } from '../data/stages';
import { resetRounds, STATE_OPTIONS, type StateName } from '../data/states';
import { herEpCap, herHpCap, sideStatePatch, youEpCap, youHpCap } from '../logic/duel';
import { lastVerdict } from '../logic/duel-tier';
import { startEditing, useEditMode } from '../logic/edit-mode';
import type { FieldOption } from '../logic/field-option';
import { useDataStore } from '../store';
import CommandBar from './CommandBar.vue';
import DuelHud from './DuelHud.vue';
import EditableField from './EditableField.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import StateChip from './StateChip.vue';

/** 战斗态整块（design-spec §5.8：战斗态是独立布局，不是常态多一页）。
 *
 * 版面自上而下 ＝ **对战画面（上半屏）→ 判档说明 → 下半屏**，其中下半屏整块交给 `CommandBar`
 *（2026-09-24 §11.8 裁定）。§5.8 组件树那三个名字都还在，只是层级变了：
 * `SevenBlockLog` 不再由本组件平铺，它是下半屏消息框里的内容，挂在 `CommandBar` 里面。
 * 主角背影同理搬进了 `DuelHud` 的左下角——§5.8 那句「在战斗态对局面板下方」是第一版的落位，
 * §11.8 的表把它改到了画面之内，所以这里不再另挂一张；§11.3 的「主角头像＝与左下背影同一形象」
 * 仍然成立，而且比从前更强：现在**只有一张**。
 *
 * **本组件不再读本层正文**（2026-09-24 §11.7 裁定）。上一版在这里 `getChatMessages` 取正文、
 * 用 `extractLog()` 正则摘模型报的数，再把结果同时喂给 SevenBlockLog（显示）与 CommandBar
 *（判「讲不出话」封的是哪一招）。结算收回前端之后那条路整条退役：权威流水在 `决斗.$本回合流水` 里，
 * 两个子组件各自直读 store 即可——同一份 MVU 字段，不存在「读两次得出两份不一致结果」的问题，
 * 那正是上一版必须集中读一次的理由。 */
const store = useDataStore();

/** 草稿层：不直绑 `store.data`，理由见 `EditableField.vue` 注释（deep watch 会逐字符回写 MVU）。 */
const draft = reactive({
  朱小笋生命: 0,
  朱小笋精力: 0,
  朱小笋状态: '无' as StateName,
  主角生命: 0,
  主角精力: 0,
  主角状态: '无' as StateName,
  倍率: 1.0,
  请愿: '',
});

const isQualitative = computed(() => store.data.决斗.$本场为质变决斗);

/** 本场的偏差判档结果，读 `logic/duel-tier.ts` 的模块级 `lastVerdict`。
 *
 * **质变决斗一律不显示**：那条路根本不经过判档（§10.1 第六轮限定，倍率恒 ×1.0），
 * 而 `lastVerdict` 是模块级的、会留着上一场请愿的结果——不挡这一道，质变决斗里就会挂一句陈年提示。
 *
 * 刷新或换层后 `lastVerdict` 为空，这一行随之消失。代价在 `duel-tier.ts` 里已如实写下：
 * 丢的只是解释，倍率本身在 MVU 里，编辑态照旧改得动。
 *
 * 裁定只要求兜底那一层写在面板上，前两层是顺带显示的：她的血凭什么是 300，玩家有权当场看见。
 * 倍率文案取 `MULTIPLIER_TIERS` 的 `label`，不用 `${倍率}` 插值——`String(1.0)` 是 `"1"`，
 * 会把四档里的 ×1.0 显示成 ×1。 */
const verdict = computed(() => {
  const result = isQualitative.value ? null : lastVerdict.value;
  if (!result) {
    return null;
  }
  return result.来源 === '兜底'
    ? { warn: true, text: `${result.提示}——从下面的「战斗内编辑」改「她的生命上限修正倍率」。` }
    : {
        warn: false,
        text: `本场偏差 ${result.档位} 档，她的生命上限 ${MULTIPLIER_TIERS[result.档位].label}（档位只改难度，不改结果）。`,
      };
});

const stateOptions: FieldOption[] = STATE_OPTIONS.map(name => ({ value: name, label: name }));

const multiplierOptions: FieldOption[] = MULTIPLIER_TIERS.map(tier => ({ value: tier.value, label: tier.label }));

/** 她的生命上限跟着草稿里的倍率走，否则改完倍率、血量输入框的上界还是旧的。
 * 倍率公式只在 `logic/duel.ts` 写一次，这里喂一份改过倍率的数据视图给它，不在组件里重算。 */
const draftHerHpCap = computed(() =>
  herHpCap({ ...store.data, 决斗: { ...store.data.决斗, $生命上限修正倍率: nextMultiplier() } }),
);

/** 质变决斗恒 ×1.0：这不是「界面不给改」，是这个字段在质变决斗里没有作用对象（§10.1 第六轮限定）。 */
function nextMultiplier(): number {
  return store.data.决斗.$本场为质变决斗 ? 1.0 : draft.倍率;
}

function start() {
  const duel = store.data.决斗;
  draft.朱小笋生命 = duel.$朱小笋生命;
  draft.朱小笋精力 = duel.$朱小笋精力;
  draft.朱小笋状态 = duel.$朱小笋状态;
  draft.主角生命 = duel.$主角生命;
  draft.主角精力 = duel.$主角精力;
  draft.主角状态 = duel.$主角状态;
  draft.倍率 = duel.$生命上限修正倍率;
  draft.请愿 = duel.$本场请愿;
}

/** 提交。夹取在输入时已由 `EditableField` 做过一遍，这里再夹一次是收口：
 * schema 明说「生命与精力一律不加 min/max/clamp……夹取是前端提交时的职责」。
 *
 * 状态与剩余回合成对写入，走 `sideStatePatch()`（九项⑦）。 */
function submit() {
  const multiplier = nextMultiplier();
  const herCap = herHpCap({ ...store.data, 决斗: { ...store.data.决斗, $生命上限修正倍率: multiplier } });
  const her = sideStatePatch(draft.朱小笋状态);
  const you = sideStatePatch(draft.主角状态);

  Object.assign(store.data, {
    决斗: {
      ...store.data.决斗,
      $朱小笋生命: _.clamp(Math.round(draft.朱小笋生命), 0, herCap),
      $朱小笋精力: _.clamp(Math.round(draft.朱小笋精力), 0, herEpCap(store.data)),
      $朱小笋状态: her.状态,
      $朱小笋状态剩余回合: her.剩余回合,
      $主角生命: _.clamp(Math.round(draft.主角生命), 0, youHpCap(store.data)),
      $主角精力: _.clamp(Math.round(draft.主角精力), 0, youEpCap(store.data)),
      $主角状态: you.状态,
      $主角状态剩余回合: you.剩余回合,
      $生命上限修正倍率: multiplier,
      // 请愿先 `trim()` 再落库：下游（`决斗回合指导.txt` 的 `|| '…'` 兜底、以及自动推断那条路）
      // 一律按「空串＝没有请愿」判，全是空格的一句在那些判断里会假装自己有内容。
      $本场请愿: isQualitative.value ? '' : draft.请愿.trim(),
      // `$回合数` 与 `$本回合流水` 都不写：这两个是本组唯一的两个不可编字段，
      // 面板连编辑控件都不给（§12.4）。它们靠上面那一行 `...store.data.决斗` 原样留存。
    },
  });
}

/** 指令区那个「改数据」按钮发的是同一个全局开关（`@edit="startEditing"`），
 * 所以战斗态里从指令区进编辑，与从右上角进是同一条路。 */
const editing = useEditMode({
  start,
  submit,
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});
</script>

<style lang="scss" scoped>
/* 判档结果贴着对战画面走：它解释的就是画面里那条血条的分母 */
.bp__tier {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--hud-mute);

  i {
    margin-right: 3px;
  }
}

/* 兜底那一层是要人动手的，不能跟普通说明一个颜色 */
.bp__tier--warn {
  color: var(--c-warning);
}

.bp__form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bp__h {
  font-size: 12px;
  font-weight: 700;
  color: var(--theme-accent);
}

.bp__h--gap {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);
}

.bp__note {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--hud-mute);
}
</style>
