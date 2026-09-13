import { skillOwner } from '../data/skills';

/** 从**本层正文**里摘战斗流水。
 *
 * 为什么是「摘」而不是「读」：`世界书/阶段指导/决斗回合指导.txt` 把七块输出定义成**纯结构化散文**，
 * 没有任何机读标记或分隔符；提示栏与描写靠句式区分，不靠标签。所以面板拿不到结构化数据，
 * 只能按那份指导已经钉死的句式去匹配。
 *
 * 这条路是 tavern-ui 明许的第二种取数方式：「**消息原文**：通过 `getChatMessages(getCurrentMessageId())[0]`
 * 取整条消息，再在代码里 `.match()` 分析」，与「前端界面正则只定位不解析」不冲突——
 * 正则那条管的是替换串里不要用 `$1` 取字段，这里根本没动正则。
 *
 * **本模块只复读，不参与任何结算**：摘漏一条不影响任何数值，DuelHud 的血条与状态全部读 MVU。
 * 组件必须把「尽力摘取」如实写在界面上，不得让人以为这是权威流水。
 *
 * 纯函数，不碰宿主 API：取原文在组件里做，方便单独喂字符串验证。
 */

export type LogKind = '先攻' | '行动' | '状态' | '命中' | '例外' | '回合结束';

export interface LogEntry {
  text: string;
  kind: LogKind;
  /** 由招名反查归属（双方招表互不相交）；摘不出招名时为 `null`，不猜人名。 */
  side: '主角' | '朱小笋' | null;
  /** 〈…〉里的名字，可能是技能名也可能是状态名；没有则空串。 */
  name: string;
}

/** 面板一次最多列这么多条，防止超长对局或误匹配把楼层撑爆。 */
const MAX_ENTRIES = 80;

/** 〈〉是指导里的写法；《》一并收，模型换括号是常见偏差。 */
const BRACKET = /[〈《]([^〉》]{1,24})[〉》]/;

/** 提示栏专用词。`决斗回合指导.txt:28` 明文「两人的描写里一个数字都不出现，不点名状态、
 * 不点名技能」，所以这些机制词出现在正文描写里的可能性很低，可以不带数字直接放行。 */
const STRONG = /先攻|未命中|暴击|无法行动|打到了?自己/;

/** 分类按这个顺序取首个命中项：一条「甲使出〈X〉，造成 25 点伤害」既是行动也含命中信息，
 * 归「行动」更贴近提示栏六步的分块。 */
const KINDS: readonly { kind: LogKind; test: RegExp }[] = [
  { kind: '先攻', test: /先攻|1[dD]20/ },
  { kind: '例外', test: /无法行动|打到了?自己/ },
  { kind: '行动', test: /使出|使用了?[〈《]/ },
  { kind: '状态', test: /陷入|状态|解除/ },
  { kind: '命中', test: /命中/ },
  { kind: '回合结束', test: /回合结束|自行解除|自动消退|恢复|回精力|回生命|掉生命|吸血/ },
];

/** 去掉不该参与匹配的部分：代码块（状态栏自己就在里面）、变量更新块、思维链、残留标签。
 *
 * 不用正则的后行断言（`(?<=…)`）：iOS 16.4 以前的 Safari 解析到就直接抛 SyntaxError，
 * 会连累整个包加载不了，而酒馆有相当一部分玩家在 iOS 上。 */
function stripNoise(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<(update|UpdateVariable|thinking|think)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ');
}

/** 按换行与句末标点切片，保留标点。 */
function toFragments(text: string): string[] {
  return text
    .replace(/([。；！？])/g, '$1\n')
    .split(/\r?\n/)
    .map(line => line.replace(/^[\s>*\-+#|]+/, '').replace(/[|\s]+$/, ''))
    .filter(line => line !== '');
}

export function extractLog(raw: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let previous = '';

  for (const fragment of toFragments(stripNoise(raw))) {
    // 三选一的准入闸：带〈技能名／状态名〉、带数字、或含提示栏专用词。
    // 描写块三样都不该有，于是绝大多数正文在这里就被挡住了。
    const bracket = BRACKET.exec(fragment);
    if (!bracket && !/\d/.test(fragment) && !STRONG.test(fragment)) {
      continue;
    }

    const hit = KINDS.find(candidate => candidate.test.test(fragment));
    if (!hit) {
      continue;
    }

    if (fragment === previous) {
      continue; // 提示栏与回合结束面板偶尔会重复同一句，连着的重复只留一条
    }
    previous = fragment;

    const name = bracket ? bracket[1].trim() : '';
    const owner = name ? skillOwner(name) : '未知';
    entries.push({
      text: fragment,
      kind: hit.kind,
      side: owner === '未知' ? null : owner,
      name,
    });

    if (entries.length >= MAX_ENTRIES) {
      break;
    }
  }

  return entries;
}

/** 这一层里某一方最后使出的招。
 *
 * 用途是「讲不出话」的置灰：草案 §7.2 的效果是「上一次使用的技能被封锁，不可选」，
 * 而 schema 的决斗组**没有「上一次使用的技能」这个字段**，面板只能从正文里摘。
 * 摘不到时返回空串，由 CommandBar 退回整条提示，不得随便挑一招置灰。 */
export function lastSkillOf(entries: readonly LogEntry[], side: '主角' | '朱小笋'): string {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.kind === '行动' && entry.side === side && entry.name !== '') {
      return entry.name;
    }
  }
  return '';
}
