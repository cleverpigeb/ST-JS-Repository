<template>
  <section v-if="!editing" class="pb">
    <button class="pb__toggle hud-tap" type="button" :aria-expanded="open" @click="open = !open">
      <i class="fa-solid fa-hand-fist" aria-hidden="true"></i>
      发起亲密决斗
      <span class="pb__tease">把一件具体的事压上去</span>
      <i :class="open ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
    </button>

    <div v-if="open" class="pb__body">
      <label class="pb__ask" for="pb-petition">
        这一场你要她答应的是<b>哪一件事</b>？
      </label>
      <textarea
        id="pb-petition"
        v-model="petition"
        class="pb__input"
        rows="2"
        maxlength="200"
        placeholder="写你要的那件事。留空也能打——那就按上文里你刚说出口的那件事算"
      ></textarea>
      <p class="pb__hint">
        <template v-if="petition.trim()">
          <i class="fa-solid fa-quote-left" aria-hidden="true"></i>
          判档与之后的正文都以这段话为准。
        </template>
        <template v-else>
          <i class="fa-solid fa-comments" aria-hidden="true"></i>
          没写：从最近几句对话里认你刚说出口的那件事。认错了就会按错的东西判档——想准就写一句。
        </template>
      </p>

      <dl class="pb__stakes">
        <div class="pb__stake">
          <dt><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i> 赢</dt>
          <dd>请愿通过，正文接着依请愿往下走。</dd>
        </div>
        <div class="pb__stake pb__stake--bad">
          <dt><i class="fa-solid fa-arrow-trend-down" aria-hidden="true"></i> 输 / 认输</dt>
          <dd>请愿不通过。</dd>
        </div>
        <div class="pb__stake pb__stake--flat">
          <dt><i class="fa-solid fa-equals" aria-hidden="true"></i> 好感度</dt>
          <dd>不动。请愿决斗的胜负本身不改好感度。</dd>
        </div>
      </dl>

      <p class="pb__judge">
        点下去之后先静默问一次模型：这个请愿相对你们<b>现在</b>的关系超前多少，判出 0–3 档，
        她这一场的生命上限照档位放大——按当前数值，四档分别是
        <span class="hud-num">{{ capPreview }}</span>。<br />
        <b>档位只改难度，不改结果</b>：判到 3 档不表示这个请愿会被拒绝或者打折，打赢了就是通过。
      </p>

      <p v-if="herSkills.note" class="pb__warn">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        {{ herSkills.note }}。现在开局，对局里她没有可用招——这里不拦，只把话说在前面。
      </p>

      <p v-if="error" class="pb__err">
        <i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i>
        {{ error }}
      </p>

      <button class="pb__go hud-tap" type="button" :disabled="judging" @click="begin">
        <i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i>
        {{ judging ? '正在判档…' : '发起决斗' }}
      </button>

      <p class="pb__note">
        判档只是个默认值：开战之后进编辑态，「她的生命上限修正倍率」那一档随时能自己调（§11.4）。<br />
        没有门槛也没有冷却，这一场打完随时能再来一次。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { MULTIPLIER_TIERS } from '../data/stages';
import { herHpCap, openPetitionDuel } from '../logic/duel';
import { judgeTier, lastVerdict } from '../logic/duel-tier';
import { useEditMode } from '../logic/edit-mode';
import { yieldToGeneration } from '../logic/generation';
import { herSkillSet } from '../logic/skill-table';
import { useDataStore } from '../store';

/** 常态面板底部的**请愿决斗入口**。
 *
 * 裁定原文（`亲密决斗-规则草案.md:591`，2026-09-14 用户于 B-G10 实测后）指名了这个位置：
 * 「玩家在常态面板点『发起决斗』→ 前端以 `generateRaw` 静默调用……并用 `json_schema` 强制输出
 *   `{ 档位: 0|1|2|3 }` → 前端按档位表把 `决斗.$生命上限修正倍率` 写成 ×1.0／1.5／2.5／4.0，
 *   同场置 `$是否在战斗中 = true`、`$本场为质变决斗 = false`。」
 *
 * **请愿输入栏**（2026-09-24 用户裁定，草案 §10.1）：「在『发起决斗』下方添加一个请愿输入栏，
 * 并将栏中输入的内容当作本次决斗的请愿；只有当玩家没有输入内容时，才根据上下文自动判断请愿内容。」
 *
 * 这一条推翻了本组件第一版的设计——原注写的是「不给输入框：请愿本来就已经在聊天里了，
 * 再开一个文本框等于让人把同一件事写两遍，而且两份措辞不一致时判档会去判那份没进正文的」。
 * 真机实测证明这个推理的前提就不成立：玩家点「发起决斗」时上一句完全可能在说别的，
 * 「从最近几句里认出请愿」是一个赌注，而原来那句面板文案还向玩家保证了它一定认得出来
 *（那句话已按裁定删掉，它是错的）。**两份措辞不一致的顾虑反过来才对**：写下来的那份才是玩家想要的，
 * 上文那份可能压根不存在。留空这条路照旧保留，所以「懒得写但想开打」并没有被这一栏拦住。
 *
 * **本组件不做任何准入判断**：§10.3 line 624「请愿决斗不设准入门槛也没有冷却」。
 * 唯一的前置是「此刻在常态」——而常态本身就意味着 `$是否在战斗中` 为假，由 StatusBar 的 `mode` 保证，
 * 不在这里再判一次。
 *
 * **编辑态下整块撤掉**，与 BattlePanel 撤掉指令区同一个理由：编辑中途还能开战，
 * 会把「兜底」变成「改完再打」。用的是不传 hooks 的 `useEditMode()` ＝ 只读开关，不登记为参与者。
 *
 * ---
 * **一处如实记下的代价**：翻回旧楼层时那一份面板还活着，从旧楼层点「发起决斗」，判档拿到的仍是
 * **最新**几条聊天历史（`generateRaw` 读的是活的聊天，不是本 iframe 所在楼层），于是会拿新话去判旧请愿。
 * 这里不加「只在最新楼层能发」的闸，理由有二：一、邀请态那个同样写决斗变量的「接受」按钮没有这道闸，
 * 两条开战路的口径先保持一致；二、裁定 line 595 把「不挡住玩家发起决斗」摆在判对档之前。
 * 真判歪了，倍率在编辑态改得回来。
 * **这条代价现在只剩空栏那条路**：请愿栏里写了字的话，判档读的是那段话而不是聊天历史，
 * 翻旧楼层开战也判的是玩家写下的那件事。
 *
 * **附带后果，不是决定**：邀请态没有请愿入口——那时挂的是 InvitePanel，NormalPanel 整块不在。
 * 好感度刚满 100 的那一段里想发请愿，得先点「暂缓」退回常态。 */
const store = useDataStore();

/** 只读开关。这一块在编辑态整块不渲染，所以不需要草稿、也不需要登记三件套。 */
const editing = useEditMode();

/** 默认收起。常态是日常仪表盘，不该常年挂着一个喊「决斗」的按钮——
 * 展开之后才是完整的赌注与判档说明。
 *
 * 顺带记一句：InvitePanel 的注释原本写着「整张卡里唯一说破『亲密决斗』这件事的地方」，
 * 本组件落地后那句话不再成立，已同步改掉。剧情侧一个字不提这件事的口径没变。 */
const open = ref(false);

const judging = ref(false);

/** 判档前给上一拍生成让路的上限。**只有 3 秒**，而且超时照样往下走。
 *
 * 为什么不用 `generation.ts` 的 20 秒默认值：那个值是给「发出一手已结算的回合」用的，
 * 那边宁可等也不能错发。这边按草案 §10.1 line 595 不许挡住开战，等太久等于挡住，
 * 所以只给一个「刚好够上一拍收个尾」的短窗口，等不到就让判档自己走容错。 */
const PETITION_YIELD_MS = 3_000;

/** 请愿输入栏的内容。
 *
 * **为什么是组件本地的 ref，而不是直接绑 `store.data.决斗.$本场请愿`**：`util/mvu.ts` 的
 * `defineMvuDataStore` 是双向同步——每 2 秒反向覆盖一次 `store.data`，同时深监听写回 MVU。
 * 直接绑变量的后果有两个，都在别处踩过：一是玩家打字打到一半被反向覆盖，光标跳回去；
 * 二是每敲一个字就往 MVU 写一次。所以照本卡既有的编辑控件口径办——草稿在本地，
 * 提交那一刻一次性落进 `openPetitionDuel()` 返回的那份补丁里。
 *
 * 开战前它压根不进 MVU：战斗外的 `$本场请愿` 永远是空串，这与 `决斗` 组其余字段同口径
 *（schema 注释：「战斗外这些值无意义」）。
 *
 * **`maxlength="200"` 是我加的，裁定里没有这个数，用户一句话即可去掉**：请愿会经
 * `决斗回合指导` 在本场每一拍都注入提示词，写成一段几百字的小作文时它会一直占着 token；
 * 而「一件具体的事」本来就一两句话说得完。200 字是「够写清一件事、又不至于变成设定」的估计值，
 * 不是量出来的阈值。 */
const petition = ref('');
const error = ref('');

/** 她的招表按「已达最高关系阶段」查（战斗侧锚点），与邀请态同一把尺子。
 * 空表时如实提示，**不拦**——§6.4 只产出了恋人与亲密恋人两套，是已知欠账不是错误。 */
const herSkills = computed(() => herSkillSet(store.data.$技能表, store.data.关系.$已达最高关系阶段));

/** 四档分别把她打成多少血。倍率公式不在这里重算，喂一份换过倍率的数据视图给 `herHpCap()`。
 * 摆出这四个数是为了让「档位只改难度」有个具体形状：恋人开局就是 120／180／300／480。 */
const capPreview = computed(() =>
  MULTIPLIER_TIERS.map(tier =>
    herHpCap({ ...store.data, 决斗: { ...store.data.决斗, $生命上限修正倍率: tier.value } }),
  ).join(' / '),
);

/** 判档 → 开战，一次点击走完。
 *
 * `judgeTier()` 自己兜住三层容错、任何一层失败都返回 ×1.0 而不抛（裁定 line 595：
 * 「任何一层都不阻塞开战——挡住玩家发起决斗比判错档更糟」），所以这里的 `catch` 只可能接到
 * 写变量那一步的失败。那一步失败要**如实回显**：静默吞掉的话玩家会以为没点上，然后反复点。
 *
 * `lastVerdict` 先于开战写：`Object.assign` 一落地 `mode` 就翻成战斗态、本组件随即卸载，
 * 对局面板接手显示那句「判档没成……」。顺序反过来就赶不上了。
 *
 * **判档读的是一份「已经填好请愿」的数据视图，而不是先写库再判**：`judgeTier()` 从
 * `data.决斗.$本场请愿` 取请愿（见 `logic/duel-tier.ts`），而此刻库里那一栏还是空的。
 * 拿视图喂它，判档失败或写变量失败时库里干净得像没点过这个按钮——真写进去再回滚，
 * 中间那一下会被 2 秒一次的反向同步撞见，战斗外的 MVU 里会留下一条孤零零的请愿。
 * 与 `capPreview` 同一个手法。
 *
 * **判档前让一次路，但不看结果**（2026-10-02 实测第四批）。让路是因为判档走
 * `generateRaw`，上一拍还在飞的时候再叠一次生成请求没有好处；**不看结果**是因为
 * 草案 §10.1 line 595「任何一层都不阻塞开战——挡住玩家发起决斗比判错档更糟」：
 * 让不开就照样往下走，由 `judgeTier()` 那三层容错兜到 ×1.0。
 * 这一条与 `CommandBar.send()` 里那次让路**刻意不同**——那边超时就不发，因为那边
 * 一旦发出去就是一个已结算的回合；这边最坏结果只是档位判成 ×1.0。
 * 上限也因此另给一个短得多的值（`PETITION_YIELD_MS`）：等 20 秒跟挡住他没区别。 */
async function begin() {
  if (judging.value) {
    return;
  }
  judging.value = true;
  error.value = '';
  // 只 trim 前后空白，中间的换行原样留着：玩家分两行写清一件事是合理的。
  const text = petition.value.trim();
  try {
    await yieldToGeneration(PETITION_YIELD_MS);
    const verdict = await judgeTier({ ...store.data, 决斗: { ...store.data.决斗, $本场请愿: text } });
    lastVerdict.value = verdict;
    Object.assign(store.data, openPetitionDuel(store.data, verdict.倍率, text));
  } catch (e) {
    error.value = `没能开战：${e instanceof Error ? e.message : String(e)}`;
  } finally {
    // 正常路径上本组件已经卸载，这一句是给写变量失败那条路把按钮放回来用的。
    judging.value = false;
  }
}
</script>

<style lang="scss" scoped>
.pb {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);
}

/* 收起态是一条窄行，不是一个主按钮：常态面板的主角是四页数据，不是这个入口 */
.pb__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font: inherit;
  font-size: 12px;
  color: var(--hud-mute);
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

.pb__tease {
  flex: 1 1 auto;
  text-align: right;
  font-size: 11px;
  color: var(--hud-mute);
}

.pb__body {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--hud-bg-2);
  border: 1px solid var(--theme-primary);
  border-radius: 3px;
}

.pb__ask {
  display: block;
  font-size: 12px;
  line-height: 1.6;

  b {
    color: var(--theme-accent);
  }
}

/* 输入栏：两行起，纵向可拉。不做自动增高——本卡的输入控件一律靠原生 resize，
   少一处 JS 就少一处在 iframe 里量错高度的可能 */
.pb__input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 4px;
  padding: 4px 6px;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--hud-text);
  background: var(--hud-bg-1);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  resize: vertical;

  &::placeholder {
    color: var(--hud-mute);
  }

  &:focus {
    outline: none;
    border-color: var(--theme-primary);
  }
}

.pb__hint {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--hud-mute);

  i {
    margin-right: 3px;
  }
}

.pb__stakes {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pb__stake {
  display: flex;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;

  dt {
    flex: 0 0 auto;
    font-weight: 700;
    color: var(--c-success);
    white-space: nowrap;
  }

  dd {
    color: var(--hud-mute);
  }

  i {
    margin-right: 3px;
  }
}

.pb__stake--bad dt {
  color: var(--c-danger);
}

.pb__stake--flat dt {
  color: var(--hud-mute);
}

.pb__judge {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--hud-rule);
  font-size: 11px;
  line-height: 1.6;
  color: var(--hud-mute);

  b {
    color: var(--theme-accent);
  }
}

.pb__warn {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--c-warning);

  i {
    margin-right: 3px;
  }
}

.pb__err {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--c-danger);

  i {
    margin-right: 3px;
  }
}

.pb__go {
  margin-top: 8px;
  width: 100%;
  padding: 5px 0;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--hud-bg-1);
  background: var(--theme-primary);
  border: 1px solid var(--theme-primary);
  border-radius: 2px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
  }

  &:disabled {
    cursor: progress;
    opacity: 0.6;
  }

  i {
    margin-right: 4px;
  }
}

.pb__note {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--hud-mute);
}
</style>
