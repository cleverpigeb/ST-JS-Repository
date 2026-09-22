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

      <!-- 主角背面剪影：§5.8 立绘占位明写「在**战斗态对局面板下方**」。
           指令区里那张小头像是同一个组件、同一个 CSS 变量，于是 §11.3 的
           「主角头像＝与左下背影同一形象」自动成立，不需要两套素材。 -->
      <PortraitFrame class="bp__silhouette" who="you" alt="你的背影" caption="你，背对着看不见的那一侧" />

      <ErrorBoundary label="本回合流水">
        <SevenBlockLog :entries="log" :error="logError" @reread="readLog" />
      </ErrorBoundary>

      <ErrorBoundary label="行动选择">
        <CommandBar :entries="log" @edit="startEditing" />
      </ErrorBoundary>
    </template>
  </section>
</template>

<script setup lang="ts">
import { MULTIPLIER_TIERS } from '../data/stages';
import { resetRounds, STATE_OPTIONS, type StateName } from '../data/states';
import { extractLog, type LogEntry } from '../logic/battle-log';
import { herEpCap, herHpCap, sideStatePatch, youEpCap, youHpCap } from '../logic/duel';
import { lastVerdict } from '../logic/duel-tier';
import { startEditing, useEditMode } from '../logic/edit-mode';
import type { FieldOption } from '../logic/field-option';
import { useDataStore } from '../store';
import CommandBar from './CommandBar.vue';
import DuelHud from './DuelHud.vue';
import EditableField from './EditableField.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import PortraitFrame from './PortraitFrame.vue';
import SevenBlockLog from './SevenBlockLog.vue';
import StateChip from './StateChip.vue';

/** 战斗态整块（design-spec §5.8：战斗态是独立布局，不是常态多一页）。
 *
 * 版面自上而下 ＝ 对局面板 → 主角背影 → 本回合流水 → 行动选择，
 * 与 §5.8 组件树（DuelHud／SevenBlockLog／CommandBar）和立绘两个位的落位一致。
 *
 * **本层正文只读一次**：读取与摘取都放在这里，`log` 同时喂给 SevenBlockLog（显示）
 * 与 CommandBar（判「讲不出话」封的是哪一招）。放到两个子组件各读一遍会读两次、
 * 还可能因为摘取时机不同得出两份不一致的结果。 */
const store = useDataStore();

const log = ref<LogEntry[]>([]);
const logError = ref('');

/** 取本层正文再摘流水。
 *
 * `getChatMessages` 是同步函数（`@types/function/chat_message.d.ts`），所以 setup 里直接调；
 * 用的是 tavern-ui 明许的第二条取数路径「消息原文：`getChatMessages(getCurrentMessageId())[0]`
 * 再在代码里 `.match()` 分析」，没有动任何正则。
 *
 * 失败原样抛给 SevenBlockLog 显示，不 fallback 成空数组假装读到了——摘不到和读不到
 * 对玩家是两件事：前者是本层没有结算行，后者是宿主接口没给东西。 */
function readLog() {
  try {
    const message = getChatMessages(getCurrentMessageId())[0]?.message ?? '';
    log.value = extractLog(message, store.data.$技能表);
    logError.value = '';
  } catch (error) {
    log.value = [];
    logError.value = error instanceof Error ? error.message : String(error);
  }
}

readLog();

/** 草稿层：不直绑 `store.data`，理由见 `EditableField.vue` 注释（deep watch 会逐字符回写 MVU）。 */
const draft = reactive({
  朱小笋生命: 0,
  朱小笋精力: 0,
  朱小笋状态: '无' as StateName,
  主角生命: 0,
  主角精力: 0,
  主角状态: '无' as StateName,
  倍率: 1.0,
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
      // `$回合数` 不写：只读，由脚本推进。
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
.bp__silhouette {
  margin: 8px auto 0;
  width: 38%;
  max-width: 120px;
}

/* 判档结果贴着对局面板走：它解释的就是上面那条血条的分母 */
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
