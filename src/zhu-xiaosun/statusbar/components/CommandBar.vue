<template>
  <section class="cb">
    <!-- 下半屏。等玩家出手时是「左消息框 ＋ 右四格菜单」，已出手或已收场时整块都是消息框
         （§11.8 下半屏那张表）。`--solo` 就是后者。 -->
    <div class="cb__lower" :class="{ 'cb__lower--solo': !menuVisible }">
      <div class="cb__msg hud-surface">
        <p class="cb__say" :class="{ 'cb__say--warn': finished }">
          <i :class="sayIcon" aria-hidden="true"></i>
          {{ sayText }}
        </p>

        <p v-if="lockNote" class="cb__note cb__note--warn">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          {{ lockNote }}
        </p>

        <p v-if="sendError" class="cb__note cb__note--err">
          <i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i>
          {{ sendError }}
        </p>

        <!-- 心里话：§11.3 明文「常态状态栏被替代后，心里话入口必须保留在这里」，
             默认虚化也是那一条定的。它占掉消息框的正文位，所以与流水二选一。 -->
        <div v-if="menu === '心里话'" class="cb__inner">
          <p
            class="cb__inner-text"
            :class="{ 'cb__inner-text--veiled': !revealed }"
            :title="revealed ? '' : '点一下显示'"
            @click="revealed = true"
          >
            {{ store.data.朱小笋.心里话 }}
          </p>
          <button class="cb__toggle hud-tap" type="button" :aria-expanded="revealed" @click="revealed = !revealed">
            {{ revealed ? '盖回去' : '点一下看' }}
          </button>
        </div>

        <!-- 消息框的常驻内容就是这一回合的权威结算（§11.8 下半屏的「结算提示栏」）。 -->
        <ErrorBoundary v-else label="本回合流水">
          <SevenBlockLog />
        </ErrorBoundary>

        <button v-if="finished" class="cb__btn cb__btn--primary hud-tap" type="button" @click="close">
          <i class="fa-solid fa-door-open" aria-hidden="true"></i>
          收场，回到常态
        </button>
      </div>

      <!-- 四格指令菜单。**第一层恒为四格**，这本身就是这套布局的识别特征（§11.8 末段）。 -->
      <div v-if="menuVisible" class="cb__menu">
        <template v-if="pending">
          <button class="cb__cell cb__cell--go hud-tap" type="button" :disabled="sending" @click="send">
            <span class="cb__cell-name">
              <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
              {{ sending ? '发送中' : '确认' }}
            </span>
            <span class="cb__cell-sub">这一回合立刻算完</span>
          </button>
          <button class="cb__cell hud-tap" type="button" :disabled="sending" @click="pending = null">
            <span class="cb__cell-name">
              <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
              取消
            </span>
          </button>
        </template>

        <template v-else-if="menu === '根'">
          <button class="cb__cell hud-tap" type="button" @click="menu = '技能'">
            <span class="cb__cell-name">
              <i class="fa-solid fa-hand-fist" aria-hidden="true"></i>
              技能
            </span>
            <span class="cb__cell-sub">四槽</span>
          </button>
          <button class="cb__cell hud-tap" type="button" @click="menu = '背包'">
            <span class="cb__cell-name">
              <i class="fa-solid fa-box-open" aria-hidden="true"></i>
              背包
            </span>
            <span class="cb__cell-sub hud-num">{{ usableBagCount }} / 3 可用</span>
          </button>
          <button class="cb__cell cb__cell--give hud-tap" type="button" @click="ask('认输', { 种类: '认输' })">
            <span class="cb__cell-name">
              <i class="fa-solid fa-flag" aria-hidden="true"></i>
              认输
            </span>
            <span class="cb__cell-sub">这一场就到这里</span>
          </button>
          <button class="cb__cell hud-tap" type="button" @click="openInner">
            <span class="cb__cell-name">
              <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
              心里话
            </span>
            <span class="cb__cell-sub">她没说出口的</span>
          </button>
        </template>

        <template v-else-if="menu === '技能'">
          <button
            v-for="slot in EQUIP_SLOTS"
            :key="slot"
            class="cb__cell hud-tap"
            type="button"
            :disabled="skillGate(slot).disabled"
            :title="skillGate(slot).reason"
            @click="
              ask(`使出〈${store.data.主角.装备四槽[slot]}〉`, {
                种类: '技能',
                名称: store.data.主角.装备四槽[slot],
              })
            "
          >
            <SkillLine class="cb__cell-skill" :id="store.data.主角.装备四槽[slot]" empty="空槽（无法出手）" />
            <span v-if="skillGate(slot).reason" class="cb__why">{{ skillGate(slot).reason }}</span>
          </button>
          <button class="cb__cell cb__cell--back hud-tap" type="button" @click="menu = '根'">
            <span class="cb__cell-name">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
              返回
            </span>
          </button>
        </template>

        <template v-else-if="menu === '背包'">
          <button
            v-for="slot in BAG_SLOTS"
            :key="slot"
            class="cb__cell hud-tap"
            type="button"
            :disabled="itemGate(slot).disabled"
            :title="itemGate(slot).reason"
            @click="
              ask(`使用〈${store.data.主角.背包[slot].名称}〉`, {
                种类: '道具',
                名称: store.data.主角.背包[slot].名称,
                格位: slot,
              })
            "
          >
            <template v-if="store.data.主角.背包[slot].名称">
              <span class="cb__cell-name">{{ store.data.主角.背包[slot].名称 }}</span>
              <span class="cb__cell-sub">
                {{ tierOf(slot) }}　剩 <span class="hud-num">{{ store.data.主角.背包[slot].数量 }}</span>
              </span>
              <span class="cb__cell-sub cb__cell-sub--effect">{{ effectOf(slot) }}</span>
            </template>
            <span v-else class="cb__cell-name cb__cell-name--empty">{{ slot }}　空格</span>
            <span v-if="itemGate(slot).reason" class="cb__why">{{ itemGate(slot).reason }}</span>
          </button>
          <button class="cb__cell cb__cell--back hud-tap" type="button" @click="menu = '根'">
            <span class="cb__cell-name">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
              返回
            </span>
          </button>
        </template>

        <template v-else>
          <button class="cb__cell cb__cell--back hud-tap" type="button" @click="menu = '根'">
            <span class="cb__cell-name">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
              返回
            </span>
          </button>
        </template>
      </div>
    </div>

    <div class="cb__foot">
      <button class="cb__foot-btn hud-tap" type="button" title="改双方生命、精力、当前状态、本场请愿" @click="emit('edit')">
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
import { EQUIP_SLOTS } from '../data/skills';
import { BAG_SLOTS, type BagSlot } from '../logic/bag';
import { ledgerLastSkill, resolveTurn, type Move } from '../logic/battle';
import { closeDuel } from '../logic/duel';
import { lookupSkill } from '../logic/skill-table';
import { useDataStore } from '../store';
import ErrorBoundary from './ErrorBoundary.vue';
import SevenBlockLog from './SevenBlockLog.vue';
import SkillLine from './SkillLine.vue';

/** 战斗态的下半屏（design-spec §5.8 组件树 CommandBar；布局细则见草案 §11.8）。
 *
 * **本组件的版面整块重写过一次**（2026-09-24 §11.8 裁定），机制口径一字未改。
 * 上一版是一列竖排按钮（头像＋精力行／四招／背包折叠／认输／心里话／页脚），和常态面板同一副样子；
 * §11.8 把 §11 裁决里那句「下半部分在『结算提示栏』与『主角指令区』之间切换」写细成两态：
 *   等玩家出手      左半是消息框，右半是四格指令菜单
 *   已出手等模型回复 整个下半屏是消息框
 * 于是「结算提示栏」不再是页面上另起的一栏，它就是消息框里的内容——`SevenBlockLog` 搬进本组件，
 * BattlePanel 不再单独挂它。
 *
 * **菜单是两层的**（§11.8 末段）：第一层恒四格（技能／背包／认输／心里话），点「技能」换成四招、
 * 点「背包」换成三格，各带一个「返回」。第一层稳定在四格本身就是这套布局的识别特征。
 * §11.3 的五类字段照旧全给：四招显示名称、威力、命中、精力（`SkillLine`），置灰给原因；
 * 背包三格显示名称、档位、剩余数量；认输单独一格；心里话入口保留、仍是默认虚化。
 *
 * **主角头像那一格撤了**，不是丢了：§11.3 要的是「与左下背影同一形象」，而 §11.8 把主角立绘
 * 定在对战画面的左下角，那张就是同一个 `PortraitFrame who="you"`。精力数值同理搬去了右下的信息框——
 * 同一个数在一屏里出现两次，改动时必然有一处忘了跟。
 *
 * **为什么这块必须真的发消息**，而邀请态的「接受」只写变量：`决斗回合指导.txt` 写死了
 * 「战斗中只有从行动选择面板发出的行动才产生数值结算」，接着说自由文本写成想做没做成、不推进回合。
 * 也就是说这个面板发出的东西必须能被模型认成「从行动选择面板发出的」——只写变量做不到这件事。
 * 于是这里走 `createChatMessages` ＋ `triggerSlash('/trigger')`，用 `【行动选择】` 前缀把来路标死。
 *
 * **2026-09-24 §11.7 裁定改了这块的分工**：从前它只把「我选了哪一招」发出去，等模型去算数；
 * 实测第五条「战斗实际上并没有发生」证明模型算不了——它不知道先攻、不知道她选了什么招、
 * 也看不见 `$` 打头的决斗变量。现在改成**点下这一手就当场算完整个回合**（`logic/battle.ts`），
 * 落库、把流水一并写进那条用户消息、再触发生成。模型拿到的是既成事实，只负责把它写成正文。
 *
 * §11.6 的两条约束一并落地：**前端只给合法按钮，不加正则拦截**；置灰只是不给点，不去改模型输出。 */
const emit = defineEmits<{ edit: [] }>();

const store = useDataStore();
const d = computed(() => store.data.决斗);

type MenuLevel = '根' | '技能' | '背包' | '心里话';

const menu = ref<MenuLevel>('根');
const revealed = ref(false);
const sending = ref(false);
const sendError = ref('');
const pending = ref<{ label: string; move: Move } | null>(null);

/** 这一层已经出过手。**只latch、不复位**：一层楼只出一手，出完这一份面板就作废了
 * （发出去的用户消息与随后的回复各是新楼层，各自挂新面板）。
 * 用一个本地 latch 而不是去轮询 `getLastMessageId()`：轮询要么等不够、要么把出手卡住。 */
const spent = ref(false);

/** 挂载那一刻本层是不是最新层。**只用来决定要不要摆出菜单**，不当闸门——
 * 真正的闸门在 `send()` 里，每次点击现取一次。
 *
 * 取不到就当最新层：拦错了会让人没法出手，而误开的代价只是点下去收到一句「这是旧楼层」。
 * 这个值不随聊天增长更新，所以有一种已知的错态：别处发了消息使本层变旧，菜单还摆着。
 * 那时点下去由 `send()` 如实拦住，与上一版行为一致。 */
const atLatest = (() => {
  try {
    return getCurrentMessageId() === getLastMessageId();
  } catch {
    return true;
  }
})();

/** 一方生命归零 ＝ 本场已结束（`决斗回合指导.txt`「结束那一次不再给行动选择面板」）。
 *
 * **认输也走这一条**：`resolveTurn()` 把认输编码成「认输方生命归零」（理由见该函数里的注释）。 */
const finished = computed(() => d.value.$朱小笋生命 <= 0 || d.value.$主角生命 <= 0);

/** 菜单在三种情形下整块撤掉，下半屏只剩消息框：本场已结束、正在发、这一层已经出过手／已经不是最新层。 */
const menuVisible = computed(() => !finished.value && !sending.value && !spent.value && atLatest);

/** 消息框最上面那一句。经典 2D 对战界面里这一格是旁白位，所以它按当下该说的话换，
 * 不做成一个恒定标题——「你要怎么做？」只在真的等玩家出手时才对。 */
const sayText = computed(() => {
  if (finished.value) {
    return d.value.$主角生命 <= 0 ? '你先撑不住了。这一场到这里。' : '她先撑不住了。这一场到这里。';
  }
  if (pending.value) {
    return `确认这一手：${pending.value.label}？点「确认」这一回合立刻算完，然后连同结果一起发给她。`;
  }
  if (sending.value) {
    return '这一手正在发出去……';
  }
  if (spent.value) {
    return '这一手已经发出去了，上面就是它算出来的结果。等她的回应。';
  }
  if (!atLatest) {
    return '这是旧楼层的面板，不能从这里出手。回到最新一层再点。';
  }
  if (menu.value === '技能') {
    return '出哪一招？出手一次要扣精力。';
  }
  if (menu.value === '背包') {
    return '用哪一件？道具不耗精力，但占掉整个回合。';
  }
  if (menu.value === '心里话') {
    return '她没说出口的那一句。';
  }
  return '你要怎么做？';
});

const sayIcon = computed(() => {
  if (finished.value) {
    return 'fa-solid fa-flag-checkered';
  }
  if (pending.value) {
    return 'fa-regular fa-circle-question';
  }
  if (sending.value || spent.value) {
    return 'fa-solid fa-hourglass-half';
  }
  return 'fa-solid fa-angle-right';
});

/** 「默认模糊」是每一句的默认，不是每个楼层只盖一次（§5.8）——她换一句就重新盖回去。 */
watch(
  () => store.data.朱小笋.心里话,
  () => (revealed.value = false),
);

/** 「讲不出话」封的是**上一次使用的技能**（§7.2）。
 *
 * 取自上一回合的结算流水（`ledgerLastSkill`）。上一版是从本层正文里正则摘的，
 * 那要赌模型把「你使出〈某招〉」照原样写出来；现在流水是脚本自己写的，措辞由我们定，不会摘不到。
 * 仍然可能是空串——本场第一回合就带着「讲不出话」进来（编辑态手动设的，或上一场的状态没清）时
 * 确实没有上一手。空串时不挑一招瞎封，改为整块提示（见 `lockNote`）。 */
const blockedSkill = computed(() =>
  d.value.$主角状态 === '讲不出话' ? ledgerLastSkill(d.value.$本回合流水, '主角') : '',
);

/** 有些限制只能整块提示，不能落到某个按钮上，那就把话说在菜单外面。 */
const lockNote = computed(() => {
  if (!menuVisible.value) {
    return '';
  }
  if (d.value.$主角状态 === '讲不出话' && blockedSkill.value === '') {
    return '你正「讲不出话」，但上一回合的流水里没有你使出过的招（本场第一手，或上一手根本没出去），所以这一轮没有可封的对象，四格里的招都照常可点。';
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
  const spec = lookupSkill(store.data.$技能表, id);
  if (!spec) {
    return { disabled: true, reason: '技能表里没有这一招，面板不替它补数值' };
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

/** 三个背包格的置灰判定。**不查精力**：`决斗回合指导.txt`「用道具占掉整个回合，不消耗精力」。 */
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

/** 心里话那一格：进这一层时先盖回去，免得上一次看过之后这一层一进来就是明文。 */
function openInner() {
  revealed.value = false;
  menu.value = '心里话';
}

function ask(label: string, move: Move) {
  sendError.value = '';
  pending.value = { label, move };
}

/** 发出这一手：**当场把整个回合算完**，落库，把流水一并写进那条用户消息，再触发一次生成。
 *
 * 次序是 §11.7 第一条逐字定的：「玩家点下技能／道具／认输 → 面板当场把这一回合整个算完 →
 * 写进 `决斗` 组 → 把算出来的事实一并写进发出去的那条用户消息里 → 再触发生成。」
 *
 * **只在最新楼层能发**：状态栏是按楼层渲染的，翻回旧楼层时那一份面板还活着，从那儿发一手
 * 会把当时的选择接到现在的对局后面。`getCurrentMessageId()` 是本 iframe 所在楼层，
 * 每次点击都现取一次 `getLastMessageId()` 比对，不缓存——聊天在增长，缓存下来就是错的。
 * 这一道闸现在更要紧：从前发错楼层只是多一条没用的消息，现在它会真的改动生命与精力。
 * 所以**比对放在结算之前**，拦住了就一个字节都不动。
 *
 * **`await nextTick()` 那一句是必须的，不是保险**：`util/mvu.ts` 的 `defineMvuDataStore` 用
 * `watchIgnorable(data, …, { deep: true })` 回写 MVU，而 Vue 的 watcher 默认 `flush: 'pre'` ＝ 异步。
 * `Object.assign` 之后立刻 `triggerSlash('/trigger')` 的话，生成可能在回写落地之前就起跑，
 * 模型读到的会是上一回合的变量。`nextTick()` 让 watcher 先跑完。
 *
 * **仍有一段如实记下的残余竞态**：`updateVariablesWith` 在那个 watcher 回调里是发射即忘的，
 * `nextTick()` 只保证回调被调用、不保证宿主那一侧写完。真撞上了后果是可控的——模型需要的事实
 * 全都在这条用户消息的正文里（这正是 §11.7 要求「一并写进用户消息」的理由之一），
 * 而面板每 2 秒的反向同步会把 MVU 重新读回来。**不加轮询去等它**：轮询要么等不够、要么把出手卡住。 */
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
    const outcome = resolveTurn(store.data, action.move);
    Object.assign(store.data, outcome.patch);
    pending.value = null;
    await nextTick();
    await createChatMessages([
      { role: 'user', message: `【行动选择】${action.label}\n\n【本回合结算·脚本已算完】\n${outcome.ledger}` },
    ]);
    // latch 放在触发生成之前：消息已经进聊天了，这一层就已经作废，不该再摆出菜单。
    spent.value = true;
    await triggerSlash('/trigger');
  } catch (error) {
    // 如实回显失败原因，不静默吞掉：吞掉的话玩家会以为发出去了，然后重复点。
    // **结算已经落库、消息没发出去**是这里最难受的一种失败：回合数与血量都动了，正文却没推进。
    // 不做回滚——回滚要撤的是一次已经被反向同步撞见的写入，撤不干净反而更乱。把话说清楚让玩家自己决定。
    sendError.value = `没发出去：${error instanceof Error ? error.message : String(error)}。上面的流水已经算进面板了，要么再点一次「确认」把这一手补发出去（会重算一个回合），要么进「战斗内编辑」把数字改回去。`;
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
  margin-top: 10px;
}

/* 下半屏：左消息框 ＋ 右菜单。两半都不给固定高度——消息框里的流水长度每回合都不同，
   对齐顶边即可，拉平高度只会在短回合里留一大片空白。 */
.cb__lower {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.cb__msg {
  flex: 1 1 0;
  min-width: 0;
  padding: 6px 8px;
}

/* 「已出手、等模型回复」那一态：菜单整块不渲染，消息框自然吃满整宽（flex: 1 1 0）。
   这条留着是为了在只剩一半内容时给它一点呼吸——旁白那句会明显变长。 */
.cb__lower--solo .cb__msg {
  padding: 8px 10px;
}

/* 旁白位。经典 2D 对战界面里这一格是全屏最靠下那条框，这里是消息框最上面一行 */
.cb__say {
  font-size: 12px;
  line-height: 1.55;

  i {
    margin-right: 5px;
    color: var(--theme-accent);
  }
}

.cb__say--warn i {
  color: var(--c-warning);
}

.cb__note {
  margin-top: 5px;
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

/* ── 四格菜单 ──
   恒两列。第一层正好填满 2×2；技能层是四招＋一个横跨两列的返回；背包层是三格＋返回占第四格。 */
.cb__menu {
  flex: 0 0 46%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  align-content: start;
}

.cb__cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  text-align: left;
  font: inherit;
  color: var(--hud-text);
  background: var(--hud-bg-2);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 4px 5px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--theme-primary);
    background: var(--theme-soft);
  }

  /* 置灰要一眼看出「不是我没点中，是它不给点」，所以降透明度＋换指针，边框同时改虚线 */
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    border-style: dashed;
  }
}

/* 返回横跨两列：它不是第五个选项，摆成同样大的一格会让人以为它跟四招同级 */
.cb__cell--back {
  grid-column: 1 / -1;
  align-items: center;
  color: var(--hud-mute);
  background: transparent;
}

.cb__cell--give:hover:not(:disabled) {
  border-color: var(--c-danger);
  background: transparent;

  .cb__cell-name {
    color: var(--c-danger);
  }
}

.cb__cell--go {
  border-color: var(--theme-primary);

  .cb__cell-name {
    color: var(--theme-accent);
  }
}

.cb__cell-name {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  word-break: break-word;

  i {
    margin-right: 4px;
    font-weight: 400;
  }
}

.cb__cell-name--empty {
  font-weight: 400;
  color: var(--hud-mute);
}

.cb__cell-sub {
  font-size: 10px;
  line-height: 1.4;
  color: var(--hud-mute);
  word-break: break-word;
}

/* 道具效果那一行可以很长，格子里最多两行，剩下的交给 title——格子高度不齐会把 2×2 拉歪 */
.cb__cell-sub--effect {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* SkillLine 原样复用，只把它在窄格里的换行点掰正——**不另写一份技能行**：
   §11.3 要的五类字段（名称／威力／命中／精力／附加效果）在那个组件里已经齐了，
   这里再抄一遍就会在改数值口径时漏掉一处。它本身是 `flex-wrap: wrap`，所以只需要
   把「威力 24 · 命中 90% · 精力 8」那一段顶到自己那一行，别跟名字挤在一行里断成两截。 */
.cb__cell-skill {
  font-size: 11px;
  gap: 1px 5px;
}

.cb__cell-skill :deep(.sl__nums) {
  flex: 1 1 100%;
  font-size: 10px;
}

/* 附加效果最多两行，与道具效果同一处理：格子高度不齐会把 2×2 拉歪 */
.cb__cell-skill :deep(.sl__extra) {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 10px;
}

/* 置灰原因必须显示，不能只放 title：手机上没有悬停（§11.3「并给出置灰原因」） */
.cb__why {
  font-size: 10px;
  line-height: 1.4;
  color: var(--c-warning);
  word-break: break-word;
}

/* ── 心里话 ── */
.cb__inner {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--hud-rule);
}

.cb__inner-text {
  font-size: 12px;
  line-height: 1.6;
}

/* 遮住而不是留空：她那句话照排，只加一层模糊——空占位符会让人以为她没想什么 */
.cb__inner-text--veiled {
  filter: blur(4px);
  cursor: pointer;
  user-select: none;
}

.cb__toggle {
  margin-top: 3px;
  border: none;
  background: transparent;
  color: var(--theme-accent);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

.cb__btn {
  margin-top: 8px;
  font: inherit;
  font-size: 12px;
  color: var(--hud-text);
  background: var(--hud-bg-1);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 3px 10px;
  cursor: pointer;

  i {
    margin-right: 4px;
  }
}

.cb__btn--primary {
  border-color: var(--theme-primary);
  color: var(--theme-accent);
  font-weight: 700;
}

.cb__foot {
  margin-top: 8px;
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

/* 窄楼层：左右两半各剩不到 160px 时，四格里的「威力 24／命中 90%／精力 8」会被挤成每词一行，
   §11.3 要求的那五类字段就等于没显示。所以到点后改成上下两段——**消息框在上、菜单在下**，
   菜单仍是 2×2 的四格（这才是 §11.8 说的识别特征所在），只是不再与消息框并排。
   340px 不是猜的：菜单占 46% 时 340 × 0.46 ≈ 156px，一格 74px，正好是那一行开始折断的宽度，
   往上留一点余量取 380。 */
@media (max-width: 380px) {
  .cb__lower {
    flex-direction: column;
  }

  .cb__menu {
    flex: 1 1 auto;
  }
}
</style>
