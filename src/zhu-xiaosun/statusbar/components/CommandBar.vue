<template>
  <section class="cb">
    <header class="cb__head">
      <PortraitFrame class="cb__face" who="you" ratio="1 / 1" alt="你的背影，与对局面板下方那张同一形象" />
      <div class="cb__meta">
        <p class="cb__meta-line">
          <i class="fa-solid fa-bolt" aria-hidden="true"></i>
          精力 <span class="hud-num">{{ d.$主角精力 }}</span> / <span class="hud-num">{{ youEpCap(store.data) }}</span>
        </p>
        <p class="cb__meta-line cb__meta-line--dim">出手一次消耗精力；用道具不耗精力，但占掉整个回合。</p>
      </div>
    </header>

    <!-- 本场已结束：一方生命归零。`决斗回合指导.txt:40` 明文「结束那一次不再给行动选择面板」，
         所以四招／背包／认输整块撤掉，只留收场。 -->
    <div v-if="finished" class="cb__over">
      <p class="cb__over-text">
        <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i>
        {{ finishedText }}
      </p>
      <button class="cb__btn cb__btn--primary hud-tap" type="button" @click="close">
        <i class="fa-solid fa-door-open" aria-hidden="true"></i>
        收场，回到常态
      </button>
    </div>

    <template v-else>
      <p v-if="lockNote" class="cb__note cb__note--warn">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        {{ lockNote }}
      </p>

      <ul class="cb__skills">
        <li v-for="slot in EQUIP_SLOTS" :key="slot">
          <button
            class="cb__skill hud-tap"
            type="button"
            :disabled="skillGate(slot).disabled || sending"
            :title="skillGate(slot).reason"
            @click="ask(`使出〈${store.data.主角.装备四槽[slot]}〉`, `【行动选择】使出〈${store.data.主角.装备四槽[slot]}〉`)"
          >
            <SkillLine :id="store.data.主角.装备四槽[slot]" empty="空槽（无法出手）" />
            <span v-if="skillGate(slot).reason" class="cb__why">{{ skillGate(slot).reason }}</span>
          </button>
        </li>
      </ul>

      <button class="cb__bagtoggle hud-tap" type="button" :aria-expanded="bagOpen" @click="bagOpen = !bagOpen">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        背包
        <span class="cb__bagcount hud-num">{{ usableBagCount }} / 3 可用</span>
        <i :class="bagOpen ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
      </button>

      <ul v-if="bagOpen" class="cb__bag">
        <li v-for="slot in BAG_SLOTS" :key="slot">
          <button
            class="cb__item hud-tap"
            type="button"
            :disabled="itemGate(slot).disabled || sending"
            :title="itemGate(slot).reason"
            @click="ask(`使用〈${store.data.主角.背包[slot].名称}〉`, `【行动选择】使用〈${store.data.主角.背包[slot].名称}〉`)"
          >
            <span v-if="!store.data.主角.背包[slot].名称" class="cb__item-empty">{{ slot }}　空格</span>
            <template v-else>
              <span class="cb__item-name">{{ store.data.主角.背包[slot].名称 }}</span>
              <span class="cb__item-tier">{{ tierOf(slot) }}</span>
              <span class="cb__item-count hud-num">剩 {{ store.data.主角.背包[slot].数量 }}</span>
              <span class="cb__item-effect">{{ effectOf(slot) }}</span>
            </template>
            <span v-if="itemGate(slot).reason" class="cb__why">{{ itemGate(slot).reason }}</span>
          </button>
        </li>
      </ul>

      <button class="cb__btn cb__btn--give hud-tap" type="button" :disabled="sending" @click="ask('认输', '【行动选择】认输')">
        <i class="fa-solid fa-flag" aria-hidden="true"></i>
        认输
      </button>
    </template>

    <!-- 二次确认：一次误触就推掉一个回合，代价比多一次点击高得多 -->
    <div v-if="pending" class="cb__confirm">
      <p class="cb__confirm-text">确认这一手：<b>{{ pending.label }}</b>？</p>
      <div class="cb__confirm-row">
        <button class="cb__btn cb__btn--primary hud-tap" type="button" :disabled="sending" @click="send">
          <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          {{ sending ? '发送中…' : '确认' }}
        </button>
        <button class="cb__btn hud-tap" type="button" :disabled="sending" @click="pending = null">取消</button>
      </div>
    </div>

    <p v-if="sendError" class="cb__note cb__note--err">
      <i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i>
      {{ sendError }}
    </p>

    <!-- 心里话：§11.3 明文「常态状态栏被替代后，心里话入口必须保留在这里」。 -->
    <div class="cb__inner">
      <p class="cb__inner-head">
        <span>
          <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
          她的心里话
        </span>
        <button class="cb__toggle hud-tap" type="button" :aria-expanded="revealed" @click="revealed = !revealed">
          {{ revealed ? '盖回去' : '点一下看' }}
        </button>
      </p>
      <p
        class="cb__inner-text"
        :class="{ 'cb__inner-text--veiled': !revealed }"
        :title="revealed ? '' : '点一下显示'"
        @click="revealed = true"
      >
        {{ store.data.朱小笋.心里话 }}
      </p>
    </div>

    <div class="cb__foot">
      <button class="cb__foot-btn hud-tap" type="button" title="改双方生命、精力、当前状态" @click="emit('edit')">
        <i class="fa-solid fa-pen" aria-hidden="true"></i>
        战斗内编辑
      </button>
      <button
        v-if="!finished"
        class="cb__foot-btn hud-tap"
        type="button"
        title="认输或打完之后她已经收了尾，但面板还停在战斗态时，点这里回到常态"
        @click="close"
      >
        <i class="fa-solid fa-door-open" aria-hidden="true"></i>
        收场
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { isRare, lookupItem, UNREGISTERED_TIER, usableInBattle } from '../data/items';
import { EQUIP_SLOTS, lookupSkill } from '../data/skills';
import { BAG_SLOTS, type BagSlot } from '../logic/bag';
import { lastSkillOf, type LogEntry } from '../logic/battle-log';
import { closeDuel, youEpCap } from '../logic/duel';
import { useDataStore } from '../store';
import PortraitFrame from './PortraitFrame.vue';
import SkillLine from './SkillLine.vue';

/** 行动选择面板（design-spec §5.8 组件树 CommandBar：指令区，含心里话入口与战斗内编辑入口）。
 *
 * 五行字段逐条来自草案 §11.3：主角头像「与左下背影同一形象」／技能按钮 ×4「显示名称、威力、命中率、
 * 精力消耗；精力不足或被『讲不出话』封锁时置灰，并给出置灰原因」／背包按钮「点开显示 3 格，含名称、
 * 档位、剩余数量；不可用时置灰」／认输按钮「单独一格」／心里话入口「必须保留在这里，仍是默认虚化」。
 *
 * **为什么这块必须真的发消息**，而邀请态的「接受」只写变量：`决斗回合指导.txt:30` 写死了
 * 「战斗中只有从行动选择面板发出的行动才产生数值结算」，第 31 行接着说自由文本写成没做成、不推进回合。
 * 也就是说这个面板发出的东西必须能被模型认成「从行动选择面板发出的」——只写变量做不到这件事。
 * 于是这里走 `createChatMessages` ＋ `triggerSlash('/trigger')`，用 `【行动选择】` 前缀把来路标死。
 *
 * §11.6 的两条约束一并落地：**前端只给合法按钮，不加正则拦截**；置灰只是不给点，不去改模型输出。 */
const props = defineProps<{ entries: readonly LogEntry[] }>();
const emit = defineEmits<{ edit: [] }>();

const store = useDataStore();
const d = computed(() => store.data.决斗);

const bagOpen = ref(false);
const revealed = ref(false);
const sending = ref(false);
const sendError = ref('');
const pending = ref<{ label: string; message: string } | null>(null);

/** 「默认模糊」是每一句的默认，不是每个楼层只盖一次（§5.8）——她换一句就重新盖回去。 */
watch(
  () => store.data.朱小笋.心里话,
  () => (revealed.value = false),
);

/** 一方生命归零 ＝ 本场已结束（`决斗回合指导.txt:40`）。认输那一路**不在这里判**：
 * 认输只发消息、不动生命，面板看不出来，得靠玩家点下面那个「收场」——如实留成缺口，不猜。 */
const finished = computed(() => d.value.$朱小笋生命 <= 0 || d.value.$主角生命 <= 0);

const finishedText = computed(() =>
  d.value.$主角生命 <= 0 ? '你先撑不住了。这一场到这里。' : '她先撑不住了。这一场到这里。',
);

/** 「讲不出话」封的是**上一次使用的技能**（§7.2）。schema 的决斗组没有这个字段，
 * 只能从本层正文里摘（`logic/battle-log.ts` 的 `lastSkillOf`）；摘不到时不挑一招瞎封。 */
const blockedSkill = computed(() => (d.value.$主角状态 === '讲不出话' ? lastSkillOf(props.entries, '主角') : ''));

/** 有些限制只能整块提示，不能落到某个按钮上，那就把话说在按钮外面。 */
const lockNote = computed(() => {
  if (d.value.$主角状态 === '讲不出话' && blockedSkill.value === '') {
    return '你正「讲不出话」，但这一层没摘到你上一手用的是哪一招，所以四个按钮都没置灰——被封的那一招点了会被判无效，自己留意一下。';
  }
  if (d.value.$主角状态 === '僵住') {
    return '你正「僵住」：按钮照常可点，能不能动是结算时才判的（§7.3）。';
  }
  if (d.value.$主角状态 === '腿软') {
    return '你正「腿软」：按钮照常可点，每回合三成概率动不了，结算时才判。';
  }
  return '';
});

interface Gate {
  disabled: boolean;
  reason: string;
}

/** 四个技能格的置灰判定。**顺序即优先级**：先说不存在，再说被封，再说选不了，最后说不够用。 */
function skillGate(slot: (typeof EQUIP_SLOTS)[number]): Gate {
  const id = store.data.主角.装备四槽[slot];
  if (!id) {
    return { disabled: true, reason: '这一槽是空的' };
  }
  const spec = lookupSkill(id);
  if (!spec) {
    return { disabled: true, reason: '草案 §6 没有这一招，面板不替它补数值' };
  }
  if (blockedSkill.value === id) {
    return { disabled: true, reason: '「讲不出话」：上一手就是这招，本轮封锁' };
  }
  // 只能选攻击类（§7.2「沉不住气」）。「腿软」「僵住」刻意不进这个判定：§11.3 line 676
  // 明文「被『腿软』『僵住』时按钮照常可点」，硬控是结算时判失败，不是选不了。
  if (d.value.$主角状态 === '沉不住气' && spec.类别 !== '攻击') {
    return { disabled: true, reason: '「沉不住气」：这一轮只能选攻击类' };
  }
  if (spec.精力 > d.value.$主角精力) {
    return { disabled: true, reason: `精力不够：要 ${spec.精力}，你只有 ${d.value.$主角精力}` };
  }
  return { disabled: false, reason: '' };
}

function tierOf(slot: BagSlot): string {
  return lookupItem(store.data.主角.背包[slot].名称)?.档位 ?? UNREGISTERED_TIER;
}

function effectOf(slot: BagSlot): string {
  return lookupItem(store.data.主角.背包[slot].名称)?.效果 ?? '效果未登记（草案 §8 没有这一条）';
}

/** 三个背包格的置灰判定。**不查精力**：`决斗回合指导.txt:38`「用道具占掉整个回合，不消耗精力」。 */
function itemGate(slot: BagSlot): Gate {
  const cell = store.data.主角.背包[slot];
  if (!cell.名称) {
    return { disabled: true, reason: '' };
  }
  if (cell.数量 <= 0) {
    return { disabled: true, reason: '用完了' };
  }
  if (!usableInBattle(cell.名称)) {
    return { disabled: true, reason: '非战斗道具，对局里用不上' };
  }
  if (isRare(cell.名称) && d.value.$本场已用稀有道具) {
    return { disabled: true, reason: '本场已经用过一件稀有道具了（§8.1）' };
  }
  // 「僵住」「腿软」同上不拦；「沉不住气」限的是技能类别，草案没说它封道具，所以这里也不拦。
  return { disabled: false, reason: '' };
}

const usableBagCount = computed(() => BAG_SLOTS.filter(slot => !itemGate(slot).disabled).length);

function ask(label: string, message: string) {
  sendError.value = '';
  pending.value = { label, message };
}

/** 发出这一手：建一条 user 消息，再触发一次生成。
 *
 * **只在最新楼层能发**：状态栏是按楼层渲染的，翻回旧楼层时那一份面板还活着，从那儿发一手
 * 会把当时的选择接到现在的对局后面。`getCurrentMessageId()` 是本 iframe 所在楼层，
 * 每次点击都现取一次 `getLastMessageId()` 比对，不缓存——聊天在增长，缓存下来就是错的。 */
async function send() {
  const action = pending.value;
  if (!action || sending.value) {
    return;
  }
  sending.value = true;
  sendError.value = '';
  try {
    if (getCurrentMessageId() !== getLastMessageId()) {
      sendError.value = '这是旧楼层的面板，不能从这里出手。回到最新一层再点。';
      return;
    }
    await createChatMessages([{ role: 'user', message: action.message }]);
    pending.value = null;
    await triggerSlash('/trigger');
  } catch (error) {
    // 如实回显失败原因，不静默吞掉：吞掉的话玩家会以为发出去了，然后重复点。
    sendError.value = `没发出去：${error instanceof Error ? error.message : String(error)}`;
  } finally {
    sending.value = false;
  }
}

/** 收场。清空战斗态由 `logic/duel.ts` 的 `closeDuel()` 统一做，
 * §10.2 的关系 +1／好感度清零／−5 **不在这里写**（理由见该函数注释）。 */
function close() {
  Object.assign(store.data, closeDuel(store.data));
}
</script>

<style lang="scss" scoped>
.cb {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);
}

.cb__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.cb__face {
  flex: 0 0 44px;
  width: 44px;
}

.cb__meta {
  flex: 1 1 auto;
  min-width: 0;
}

.cb__meta-line {
  font-size: 12px;

  i {
    margin-right: 4px;
    color: var(--c-warning);
  }
}

.cb__meta-line--dim {
  margin-top: 2px;
  font-size: 11px;
  color: var(--hud-mute);
}

.cb__note {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;

  i {
    margin-right: 3px;
  }
}

.cb__note--warn {
  color: var(--c-warning);
}

.cb__note--err {
  color: var(--c-danger);
}

.cb__skills {
  margin-top: 6px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cb__skill,
.cb__item {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  color: var(--hud-text);
  background: var(--hud-bg-2);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 4px 6px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--theme-primary);
    background: var(--theme-soft);
  }

  /* 置灰要一眼看出「不是我没点中，是它不给点」，所以降透明度＋换指针，边框同时收暗 */
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    border-style: dashed;
  }
}

/* 置灰原因必须显示，不能只放 title：手机上没有悬停（§11.3「并给出置灰原因」） */
.cb__why {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--c-warning);
}

.cb__bagtoggle {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font: inherit;
  font-size: 12px;
  color: var(--hud-text);
  background: transparent;
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 3px 6px;
  cursor: pointer;

  &:hover {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }
}

.cb__bagcount {
  flex: 1 1 auto;
  text-align: right;
  font-size: 11px;
  color: var(--hud-mute);
}

.cb__bag {
  margin-top: 4px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cb__item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.cb__item-empty {
  font-size: 12px;
  color: var(--hud-mute);
}

.cb__item-name {
  font-weight: 700;
}

.cb__item-tier {
  font-size: 11px;
  color: var(--hud-mute);
  border: 1px solid currentcolor;
  border-radius: 2px;
  padding: 0 4px;
  line-height: 1.4;
}

.cb__item-count {
  font-size: 12px;
  color: var(--hud-mute);
}

.cb__item-effect {
  flex: 1 1 100%;
  font-size: 11px;
  color: var(--hud-mute);
}

.cb__btn {
  font: inherit;
  font-size: 12px;
  color: var(--hud-text);
  background: var(--hud-bg-1);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 3px 10px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  i {
    margin-right: 4px;
  }
}

/* 认输单独一格（§11.3），且与四招之间留出空隙——它不该看起来像第五个选项 */
.cb__btn--give {
  margin-top: 8px;
  width: 100%;
  color: var(--hud-mute);

  &:hover:not(:disabled) {
    border-color: var(--c-danger);
    color: var(--c-danger);
  }
}

.cb__btn--primary {
  border-color: var(--theme-primary);
  color: var(--theme-accent);
  font-weight: 700;
}

.cb__over {
  margin-top: 8px;
  padding: 8px;
  background: var(--hud-bg-2);
  border: 1px solid var(--theme-primary);
  border-radius: 3px;
  text-align: center;
}

.cb__over-text {
  font-size: 13px;
  margin-bottom: 6px;

  i {
    margin-right: 4px;
    color: var(--theme-accent);
  }
}

.cb__confirm {
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--hud-bg-2);
  border: 1px solid var(--theme-primary);
  border-radius: 2px;
}

.cb__confirm-text {
  font-size: 12px;

  b {
    color: var(--theme-accent);
  }
}

.cb__confirm-row {
  margin-top: 5px;
  display: flex;
  gap: 8px;
}

.cb__inner {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);
}

.cb__inner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--hud-mute);

  i {
    margin-right: 4px;
  }
}

.cb__toggle {
  border: none;
  background: transparent;
  color: var(--theme-accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.cb__inner-text {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.6;
}

/* 遮住而不是留空：她那句话照排，只加一层模糊——空占位符会让人以为她没想什么 */
.cb__inner-text--veiled {
  filter: blur(4px);
  cursor: pointer;
  user-select: none;
}

.cb__foot {
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px solid var(--hud-rule);
  display: flex;
  gap: 8px;
}

.cb__foot-btn {
  flex: 1 1 0;
  font: inherit;
  font-size: 11px;
  color: var(--hud-mute);
  background: transparent;
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 2px 0;
  cursor: pointer;

  &:hover {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }

  i {
    margin-right: 3px;
  }
}
</style>
