/** 道具档位（草案 §8.1）。「非战斗」不是档位，是给`永久提升上限`那类东西的标记：
 * 它不进背包 3 格、不在战斗中使用、没有当量核算，三档与堆叠规则都不管它（§8.4 末条）。 */
export type Tier = '常见' | '精良' | '稀有';

export interface ItemSpec {
  档位: Tier | '非战斗';
  效果: string;
  /** 每格数量上限；`null` ＝ 不适用堆叠规则。 */
  堆叠上限: number | null;
  备注?: string;
}

/** 三档堆叠上限（草案 §8.1）。 */
export const STACK_CAP: Record<Tier, number> = { 常见: 3, 精良: 2, 稀有: 1 };

/** 已登记道具（草案 §8.2 初始背包 ＋ §8.3 后续可获得示例）。效果逐字照抄。 */
export const ITEMS: Record<string, ItemSpec> = {
  随身的薄荷糖: { 档位: '常见', 效果: '自身回精力 20', 堆叠上限: 3 },
  口袋里的纸巾: { 档位: '常见', 效果: '解除自身状态 ＋ 自身回生命 10', 堆叠上限: 3 },
  课本里夹的书签: { 档位: '常见', 效果: '自身回生命 12', 堆叠上限: 3 },
  不知谁塞的情书: { 档位: '常见', 效果: '100% 给对方「乱了阵脚」', 堆叠上限: 3 },
  借来的红笔: {
    档位: '精良',
    效果: '造成 22 点必中伤害（不受浮动与命中影响）',
    堆叠上限: 2,
    备注: '必中固定伤害是道具唯一被允许突破的口径，技能不得有此性质（§8.4）',
  },
  那天的合照: { 档位: '稀有', 效果: '自身回满生命', 堆叠上限: 1 },
  她发来的那条语音: { 档位: '稀有', 效果: '100% 给对方「僵住」＋ 自身回生命 40', 堆叠上限: 1 },

  // 永久提升上限那一件：拿到即改写持久态（生命上限与精力上限一起抬），不是战斗消耗品。
  // 登记它是为了让面板在有人把它填进背包格时说清楚原因，而不是笼统显示「未登记」。
  她写的那张便条: {
    档位: '非战斗',
    效果: '永久抬升主角的生命上限与精力上限（专属任务第一版落点）',
    堆叠上限: null,
    备注: '不进背包 3 格、不在战斗中使用、没有当量核算（§8.4 末条）',
  },
};

/** 未登记道具在面板上的档位显示文案。 */
export const UNREGISTERED_TIER = '未登记';

/** 未登记道具的数量上限兜底。
 *
 * **这是前端的容错取值，不是草案规则**：`initvar.yaml` 给她背包格1 的「她自己画的漫画本」
 * 在草案 §8 里没有档位／效果／当量条目，`战斗叙事对照表` 的「道具的读法」也没有它。
 * 面板必须显示 名称／档位／剩余数量（§11.3），查不到就没有上限可用，故按最宽的常见档取 3，
 * 等这件道具补进 §8 后本兜底即可删除。不在此处替它编档位或效果。 */
export const UNREGISTERED_STACK_CAP = 3;

export function lookupItem(name: string): ItemSpec | null {
  return Object.hasOwn(ITEMS, name) ? ITEMS[name] : null;
}

/** 该道具格的数量上限，供面板编辑时夹取。 */
export function stackCap(name: string): number {
  const spec = lookupItem(name);
  if (!spec || spec.堆叠上限 === null) {
    return UNREGISTERED_STACK_CAP;
  }
  return spec.堆叠上限;
}

/** 稀有道具：整场战斗最多用一件，且不可堆叠（§8.1／§8.4）。 */
export function isRare(name: string): boolean {
  return lookupItem(name)?.档位 === '稀有';
}

/** 能不能在战斗里用。未登记的按可用处理（面板已标出「未登记」，不再二次封锁）；
 * 明确标了「非战斗」的不可用。 */
export function usableInBattle(name: string): boolean {
  return lookupItem(name)?.档位 !== '非战斗';
}
