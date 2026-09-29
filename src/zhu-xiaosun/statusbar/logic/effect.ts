import { STATES, type AbnormalName } from '../data/states';

/** 把「附加效果」那一栏的**自然语言**读成结构化的几件事。
 *
 * **为什么必须解析自然语言**：草案 §6.1 的字段表里，`附加效果` 就是一个字符串栏位，
 * 落进 MVU 的 `$技能表` 之后玩家还能在技能页逐字改（2026-09-24 裁定「填什么就是什么」）。
 * §8 的道具表同理，`data/items.ts` 的 `效果` 也是一句话。结算引擎要按它生效，就只能读这句话。
 * 另一条路是给每一招再加一组结构化字段——那要动 schema 真源、要改 initvar、要改条目正文，
 * 而且玩家从此得在面板上填两遍同一件事（一遍给人看、一遍给脚本读），两遍对不上时以哪边为准
 * 又是一个新问题。所以这一版选择解析，**解析不出来的部分如实带出去**，不静默当成没有。
 *
 * **语法是从现有的十三条技能与八件道具里归纳出来的，不是新发明的一套 DSL**：
 *   `30% 给对方「脸在烧」`／`100% 给自身「面不改色」`
 *   `自身回生命 20`／`自身回精力 15`／`自身回满生命`
 *   `解除自身状态`
 *   `造成 22 点必中伤害（不受浮动与命中影响）`
 * 各片段之间用全角 `＋` 连接。**不按 `＋` 切片再逐片匹配**，而是把六条正则各自在整句上跑一遍：
 * 切片对连接符的写法（`＋`／`+`／`、`／空格）敏感，玩家手改时换个符号就整条失效；
 * 整句匹配只在乎那几个关键词在不在。
 *
 * 纯函数、不碰宿主 API、不抓 store，可直接喂字符串做单测。
 */

/** 一条效果读出来的全部内容。每一项都有「没有」这个取值，不用可选属性——
 * 调用方拿到的形状恒定，少一处 `?.`。 */
export interface ParsedEffect {
  /** 施加状态。`目标` 是效果文本里写的「对方」还是「自身」，**不是**结算时的最终落点
   *（「乱了阵脚」的反噬改的是最终落点，在引擎里算，不在这里）。 */
  状态: { 概率: number; 目标: '对方' | '自身'; 名称: AbnormalName } | null;
  回生命: number;
  回精力: number;
  回满生命: boolean;
  解除自身状态: boolean;
  /** 必中固定伤害。§8.4 明文这是**道具唯一被允许突破的口径，技能不得有此性质**——
   * 本解析器不区分来源，拦截那一条由引擎负责（技能带了它会被如实提示，不是静默生效）。 */
  固定伤害: number;
  /** 六条正则都没认出来的残余文字。空串 ＝ 整句都读懂了。
   * 面板要把它显示出来：玩家自己写的效果没生效时，不给提示等于骗人。 */
  未识别: string;
}

const EMPTY: ParsedEffect = {
  状态: null,
  回生命: 0,
  回精力: 0,
  回满生命: false,
  解除自身状态: false,
  固定伤害: 0,
  未识别: '',
};

/** 状态名的四种括号都收：玩家手写时用「」『』【】〈〉的都有，initvar 里统一是「」。 */
const 状态正则 = /(\d+)\s*[%％]\s*给\s*(对方|自身)\s*[「『【〈]([^」』】〉]{1,12})[」』】〉]/;
const 回生命正则 = /(?:自身)?回生命\s*(\d+)/;
const 回精力正则 = /(?:自身)?回精力\s*(\d+)/;
const 回满生命正则 = /(?:自身)?回满生命/;
const 解除正则 = /解除自身状态/;
const 固定伤害正则 = /造成\s*(\d+)\s*点必中伤害/;

/** 判残余时要忽略的连接符与标点。留下的若只有这些，就算整句读懂了。 */
const 无意义残余 = /^[\s＋+、，,。．.；;（）()「」『』【】〈〉/／-]*$/;

export function parseEffect(text: string): ParsedEffect {
  const raw = (text ?? '').trim();
  if (raw === '') {
    return { ...EMPTY };
  }

  const result: ParsedEffect = { ...EMPTY };
  /** 逐条把认出来的片段从残余里挖掉，剩下的就是没读懂的部分。 */
  let rest = raw;
  const consume = (matched: string) => {
    rest = rest.replace(matched, ' ');
  };

  const 状态命中 = 状态正则.exec(raw);
  if (状态命中) {
    const 名称 = 状态命中[3].trim();
    // 表外的状态名不认：§7.2 的十种是封闭清单，认一个表外名字等于就地发明一种状态。
    // 不认的后果是它留在「未识别」里被如实显示，而不是被悄悄当成某种近似状态。
    if (Object.hasOwn(STATES, 名称)) {
      result.状态 = {
        概率: _.clamp(Number(状态命中[1]), 0, 100),
        目标: 状态命中[2] as '对方' | '自身',
        名称: 名称 as AbnormalName,
      };
      consume(状态命中[0]);
    }
  }

  const 回生命命中 = 回生命正则.exec(raw);
  if (回生命命中) {
    result.回生命 = Number(回生命命中[1]);
    consume(回生命命中[0]);
  }

  const 回精力命中 = 回精力正则.exec(raw);
  if (回精力命中) {
    result.回精力 = Number(回精力命中[1]);
    consume(回精力命中[0]);
  }

  const 回满命中 = 回满生命正则.exec(raw);
  if (回满命中) {
    result.回满生命 = true;
    consume(回满命中[0]);
  }

  const 解除命中 = 解除正则.exec(raw);
  if (解除命中) {
    result.解除自身状态 = true;
    consume(解除命中[0]);
  }

  const 固伤命中 = 固定伤害正则.exec(raw);
  if (固伤命中) {
    result.固定伤害 = Number(固伤命中[1]);
    consume(固伤命中[0]);
  }

  // 括注（例如「（不受浮动与命中影响）」）属于给人看的说明，不算没读懂
  rest = rest.replace(/[（(][^）)]*[）)]/g, ' ');
  result.未识别 = 无意义残余.test(rest) ? '' : rest.replace(/\s+/g, ' ').trim();
  return result;
}

/** 这一招／这件道具能不能回自身生命（§9.1 第二条情境倍率要问的就是它）。 */
export function canHealSelf(effect: ParsedEffect): boolean {
  return effect.回生命 > 0 || effect.回满生命;
}

/** 能不能解除自身状态（§9.1 第三条）。 */
export function canCleanseSelf(effect: ParsedEffect): boolean {
  return effect.解除自身状态;
}

/** 能不能给**对方**施加状态（§9.1 第四、五条）。
 * 施给自身的增益（「面不改色」）不算——那两条情境说的是「对方当前无／有状态」。 */
export function canInflictStatus(effect: ParsedEffect): boolean {
  return effect.状态 !== null && effect.状态.目标 === '对方';
}

/** 回复类道具：她的用药阈值（§9.3「生命低于上限 30% 且背包里有回复类道具」）只认这一类。
 * 回精力也算回复——§9.3 只写了「回复类」，没有限定回哪一项。**这是一处读法，可推翻**。 */
export function isRecoveryEffect(effect: ParsedEffect): boolean {
  return canHealSelf(effect) || effect.回精力 > 0;
}
