import type { Schema } from '../../schema';
import { MULTIPLIER_TIERS } from '../data/stages';

/** 请愿决斗的**判档**：开战那一刻额外调一次模型 API，要回一个 0–3 的整数。
 *
 * 裁定原文（`亲密决斗-规则草案.md:591`，2026-09-14 用户于 B-G10 实测后）：
 * 「判档由前端在开战那一刻额外调一次模型 API 完成，不再指望正文那一拍顺带报数。落地口径：
 *   玩家在常态面板点『发起决斗』→ 前端以 `generateRaw` 静默调用（`should_silence: true`，
 *   不进聊天楼层、不触发 MVU 解析），提示词只带本节三条锚点、当前『关系』段名与最近几条聊天历史
 *  （供模型认出请愿内容），并用 `json_schema` 强制输出 `{ 档位: 0|1|2|3 }` → 前端按档位表把
 *   `决斗.$生命上限修正倍率` 写成 ×1.0／1.5／2.5／4.0，同场置 `$是否在战斗中 = true`、
 *   `$本场为质变决斗 = false`。」
 *
 * **为什么要有这一次额外调用**（同文 line 593）：`决斗` 组十四个字段全带 `$`，模型既看不见也写不了；
 * 而正文那一拍发生时决斗尚未开始，两条决斗条目还被 `@@if` 挡在提示词外，模型手里根本没有判档
 * 所需的上下文。所以「由模型给出偏差档位」这句原本一直没有实现位——本模块是补上它，不是改规则。
 *
 * **判档不是质变决斗的事**：§10.1 第六轮限定「偏差修正只作用于请愿决斗，质变决斗一律 ×1.0」。
 * 邀请态那条路（`openQualitativeDuel`）不经过本模块一行代码。
 *
 * 本模块只负责「问出一个档位」。写变量、开战归 `logic/duel.ts` 的 `openPetitionDuel`，
 * 免得一次网络调用的失败路径和十三个字段的置位缠在一起。
 *
 * ---
 * **执行层面全部未验证**：本卡的沙箱自 2026-09-08 起不能跑构建、类型检查与真机，
 * 而 B-G12 真机核对被用户明确排除。下列几条是按 `@types/function/generate.d.ts` 的声明与
 * `ST-JS-Repository/AGENTS.md:88` 写的，**没有一条经过运行时确认**：
 *   - `should_silence: true` 是否真的不触发 MVU 解析（裁定如此断言；另有一层天然保险：
 *     本次回复里不含 `<UpdateVariable>`，即便被解析也没有可落的变量）；
 *   - `ordered_prompts` 的白名单语义是否真能挡住世界书条目——AGENTS.md:88 明说
 *     `generateRaw`「依旧会发送酒馆世界书条目等内容」，所以下面又用 `overrides` 加了一道保险；
 *   - `json_schema` 在用户实际使用的 provider 上是否生效。第三层兜底就是为它不生效而存在的。
 */

/** 偏差四档。取值范围由裁定写死，不接受别的数。 */
export type Tier = 0 | 1 | 2 | 3;

/** 这一档是怎么定下来的——对应 §10.1 line 595 的容错三层，按顺序。 */
export type TierSource = '结构化输出' | '回复里的数字' | '兜底';

export interface TierVerdict {
  档位: Tier;
  /** 档位表查出来的倍率，直接写进 `决斗.$生命上限修正倍率`。 */
  倍率: number;
  来源: TierSource;
  /** 判档没成时要**原样显示在面板上**的那句话（裁定逐字）；前两层为空串。 */
  提示: string;
}

/** 裁定 line 595 的逐字文案，不要改写成别的说法。 */
const FALLBACK_NOTE = '判档没成，按 0 档开打，可自行调高';

/** 最多带几条聊天历史。裁定只写了「最近几条」没给数，这里取 6（约三个来回）：
 * 够让模型认出玩家刚提的是什么，又不至于把整场戏塞进一次判档里。想调只改这一个数。 */
const JUDGE_CHAT_HISTORY = 6;

/** 固定的请求标识符，便于在酒馆一侧认出这一次静默生成（也可用 `stopGenerationById` 打断）。
 * 不怕重名：发起按钮在请求期间是禁用的，同一时刻不会有第二次判档在飞。 */
const JUDGE_GENERATION_ID = '朱小笋-请愿判档';

/** 判档规则提示词。
 *
 * 四档含义与三条锚点照搬草案 §10.1（档位表 line 572-577、三条锚点 line 585），只把
 * 「不写剧情、只给一个数」这类操作说明加在外面——那不是新规则，是这次调用的用法说明。
 *
 * **第三条锚点的措辞有过作废史**：2026-09-02 第六轮校正把旧表述「人前失策」作废，
 * 现用的是「要求她在熟人圈之外的人面前露出那一面」。别照旧稿写。
 *
 * **「档位只改难度，不改结果」在系统提示词与 user_input 里各钉一遍**，这是 §10.1 line 597
 * 的明文要求：「模型极易把『偏差大』误读成『可以拒绝』或『可以打折执行』，这条要在提示词里反复钉住」。 */
const JUDGE_RULES = `你现在不写剧情、不扮演任何人，只做一件事：给玩家刚刚提出的「请愿」判一个偏差档位，输出一个 0–3 的整数。

四档的含义：
0＝请愿与当前剧情、关系阶段吻合
1＝略微超前，但铺垫够
2＝明显超前，缺铺垫
3＝与当前关系阶段严重脱节

判档看三条锚点：
一、当前关系阶段允许的亲密程度。
二、本次请愿在最近几幕里有没有铺垫——看可追踪事件与她的心情。
三、请愿是否要求她在熟人圈之外的人面前露出那一面。那是她的核心怕点，命中即 +1 档。

必须记住：档位只改难度，不改结果。判到 3 档不表示这个请愿会被拒绝，也不表示可以打折执行——主角只要打赢了，正文就必须依请愿继续。所以你不要评价这个请愿该不该被接受，也不要试图拦下它，只给一个数。`;

/** 强制结构化输出。裁定指名 `json_schema` 且只要一个字段，所以这里不留任何别的口子
 *（`additionalProperties: false` 是 OpenAI 严格模式的硬要求，对别的 provider 无害）。 */
const TIER_SCHEMA = {
  name: '偏差档位',
  description: '亲密决斗请愿的偏差档位判定结果',
  value: {
    type: 'object',
    properties: {
      档位: {
        type: 'integer',
        enum: [0, 1, 2, 3],
        description: '0 吻合／1 略微超前但铺垫够／2 明显超前缺铺垫／3 与当前关系阶段严重脱节',
      },
    },
    required: ['档位'],
    additionalProperties: false,
  },
} as const;

/** 本次判档的取证材料。
 *
 * **三条锚点各自的取证来源**：第一条是当前关系段名（裁定 line 591 点名要带），第二条是
 * 可追踪事件与她的心情（锚点自己在 line 585 点名要看），第三条从聊天历史里的请愿内容本身判。
 * 裁定那句「提示词只带……」挡的是整张卡（角色描述、世界书、预设），不是锚点自己点名的取证材料——
 * 不给第二条锚点这两样东西，它就成了一条死条文。**这是一处读法，用户一句话即可推翻**。
 *
 * **第一条锚点必须取 `_当前关系`，不是 `$已达最高关系阶段`**。§10.1 line 587 为此单立了一条
 * （方向与上一节的换锚点相反，最容易混）：判档属正文侧，与行为上界同一把尺子；换到历史最高段的
 * 只有战斗侧的派生（她的上限、招表、清醒度 k、背包件数）。`schema.ts:44` 也写着「两条锚不可互换」。
 * 写错这一处的后果与裁定正好相反：关系回退后请愿反而更容易过。 */
function judgeInput(data: Schema): string {
  const ongoing = Object.entries(data.事件.进行中);
  const events = ongoing.length
    ? ongoing.map(([name, item]) => `- ${name}：${item.进度}`).join('\n')
    : '（没有进行中的事件）';

  return `当前关系阶段：${data.关系._当前关系}
她此刻的心情：${data.朱小笋.心情 || '（没记）'}
进行中的可追踪事件：
${events}

请愿内容见上面最近几条对话——玩家刚说出口的那件事就是本次请愿。

再说一遍：档位只改难度、不改结果，你只判难度，不做取舍。
只回一个 JSON：{"档位": 0}，档位取 0、1、2、3 之一，不要写任何别的内容。`;
}

/** 问一次模型，拿回这一场的档位与倍率。**任何一层失败都不抛异常**——
 * 裁定 line 595：「任何一层都不阻塞开战——挡住玩家发起决斗比判错档更糟」。 */
export async function judgeTier(data: Schema): Promise<TierVerdict> {
  try {
    const reply = await generateRaw({
      generation_id: JUDGE_GENERATION_ID,
      // 静默：不进聊天楼层，也不占用酒馆的停止按钮（裁定指名的口径）
      should_silence: true,
      max_chat_history: JUDGE_CHAT_HISTORY,
      // 两道保险都冲着「只带三样东西」去：`ordered_prompts` 是白名单，没列进去的内置提示词不发；
      // 而 AGENTS.md:88 说 generateRaw「依旧会发送酒馆世界书条目等内容」，故再把三处世界书注入
      // 显式清空。这张卡是零绿灯、条目全常驻，漏一处就是整本世界书陪着判一个整数。
      overrides: {
        world_info_before: '',
        world_info_after: '',
        chat_history: { with_depth_entries: false },
      },
      ordered_prompts: [{ role: 'system', content: JUDGE_RULES }, 'chat_history', 'user_input'],
      user_input: judgeInput(data),
      json_schema: TIER_SCHEMA,
    });

    // 传了 json_schema 就不会走 tool_calls 那条分支，但返回类型是联合类型，这里照样收一手。
    const text = typeof reply === 'string' ? reply : reply.content;
    const parsed = parseTier(text);
    if (parsed) {
      return verdict(parsed.tier, parsed.source, '');
    }
  } catch (error) {
    // 断网、模型报错、接口压根不在——都归第三层。不往上抛：开战不能被这一步挡住。
    console.warn('[朱小笋状态栏] 判档调用失败，按 0 档开打', error);
  }
  return verdict(0, '兜底', FALLBACK_NOTE);
}

/** 容错三层的前两层（§10.1 line 595）：先按 JSON 解析；失败则从回复里抓第一个 0–3 的数字。
 * 两层都没抓到时返回 `null`，由调用方落第三层。
 *
 * 单独导出是为了它可被单测直接喂字符串——**本卡至今没有前端单测，所以这一条同样未验证**。 */
export function parseTier(reply: string): { tier: Tier; source: TierSource } | null {
  // 第一层：按 JSON 解析
  try {
    const parsed: unknown = JSON.parse(stripFence(reply));
    const raw = (parsed as { 档位?: unknown } | null)?.档位;
    const tier = typeof raw === 'string' ? Number(raw) : raw;
    if (isTier(tier)) {
      return { tier, source: '结构化输出' };
    }
  } catch {
    // 不是合法 JSON，落第二层。这是预料之内的路径，不记日志。
  }

  // 第二层：抓第一个 0–3 的**数字**。加数字边界是因为「0–3 的数字」指的是取值在 0–3 的数，
  // 裸 /[0-3]/ 会从「2026」里抓出个 2 来。
  const matched = /(?<![0-9])[0-3](?![0-9])/.exec(reply)?.[0];
  if (matched !== undefined) {
    return { tier: Number(matched) as Tier, source: '回复里的数字' };
  }

  return null;
}

/** 去掉模型爱加的 ``` 围栏。不是新规则，只是让第一层更可能命中：
 * 围栏没去掉时第二层照样抓得到同一个数字，区别只在 `来源` 那一栏是否诚实。 */
function stripFence(reply: string): string {
  return reply
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}

function isTier(value: unknown): value is Tier {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

/** 档位 → 倍率只走 `MULTIPLIER_TIERS` 的下标，不在这里再抄一遍 1.0／1.5／2.5／4.0：
 * 那张表的顺序就是档位顺序（`data/stages.ts`，草案 §10.1 四档表）。 */
function verdict(tier: Tier, source: TierSource, note: string): TierVerdict {
  return { 档位: tier, 倍率: MULTIPLIER_TIERS[tier].value, 来源: source, 提示: note };
}

/** 最近一次判档的结果，供开战后的**对局面板**接着显示那句「判档没成……」。
 *
 * 为什么不落 MVU：`决斗` 组是裁定定死的十四个字段，加一个「判档来源」等于动 schema 真源，
 * 超出本门授权；而这句提示的寿命只需要覆盖「点下发起决斗 → 看见对局面板」这一瞬。
 * **如实写下代价**：换层或刷新后这句提示就没了。倍率本身已经写进 MVU，照旧能在编辑态改，
 * 所以丢的只是解释，不是能力。 */
export const lastVerdict = ref<TierVerdict | null>(null);
