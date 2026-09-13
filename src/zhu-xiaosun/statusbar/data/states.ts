import type { Schema } from '../../schema';

/** 状态取值（含「无」），从 schema 派生。 */
export type StateName = Schema['决斗']['$朱小笋状态'];
/** 十种异常／增益状态，不含「无」。 */
export type AbnormalName = Exclude<StateName, '无'>;

export interface StateSpec {
  权重: '轻' | '中' | '重';
  效果: string;
  解除: string;
  /** 选定该状态时 `$…状态剩余回合` 自动重置到的值；`null` ＝ 没有固定回合数，面板显示「—」。 */
  固定回合: number | null;
  /** 十种里九种施给对方，只有「面不改色」施给自身（草案 §7.3 末条）。 */
  施加对象: '对方' | '自身';
  /** FontAwesome 类名。可用性依据：`util/iframe_srcdoc.html:4` —— 酒馆助手 iframe 的
   * head 里加载了 `@fortawesome/fontawesome-free` 的 all.min.css，前端界面可直接用 `fa-*`。 */
  图标: string;
}

/** 十种状态（草案 §7.2 清单，效果与解除口径逐字照抄）。
 *
 * 两条呈现约束一并记在这里，组件不得违反：
 *   一、**状态在剧情里没有名字，也不被角色感知**；面板显示名称与图标，正文只表现对应的窘态。
 *   二、新状态覆盖旧状态（§7.3），所以「重新坐直」给自身上「面不改色」时自带解除作用，
 *       不要再额外写一条解除逻辑。
 */
export const STATES: Record<AbnormalName, StateSpec> = {
  越想越羞: {
    权重: '轻',
    效果: '回合结束掉生命，逐回合递增 4 / 8 / 12',
    解除: '3 回合后自动消退',
    固定回合: 3,
    施加对象: '对方',
    图标: 'fa-solid fa-face-flushed',
  },
  心跳失速: {
    权重: '轻',
    效果: '命中率 -20%',
    解除: '3 回合后自动消退',
    固定回合: 3,
    施加对象: '对方',
    图标: 'fa-solid fa-heart-pulse',
  },
  面不改色: {
    权重: '轻',
    效果: '自身增益：受到伤害 ×0.6，暴击率 +10%',
    解除: '3 回合后自动消退',
    固定回合: 3,
    施加对象: '自身',
    图标: 'fa-solid fa-shield-halved',
  },
  脸在烧: {
    权重: '中',
    效果: '回合结束掉 4 生命，造成的伤害 ×0.75',
    解除: '3 回合后自动消退',
    固定回合: 3,
    施加对象: '对方',
    图标: 'fa-solid fa-fire',
  },
  被拿住: {
    权重: '中',
    效果: '回合结束目标 -6 生命、施加者 +6 生命',
    解除: '不自动消退，只能靠「解除自身状态」或被新状态覆盖',
    固定回合: null,
    施加对象: '对方',
    图标: 'fa-solid fa-hand-holding-droplet',
  },
  讲不出话: {
    权重: '中',
    效果: '上一次使用的技能被封锁，不可选',
    解除: '2 回合后自动消退',
    固定回合: 2,
    施加对象: '对方',
    图标: 'fa-solid fa-comment-slash',
  },
  沉不住气: {
    权重: '中',
    效果: '只能选攻击类技能',
    解除: '2 回合后自动消退',
    固定回合: 2,
    施加对象: '对方',
    图标: 'fa-solid fa-face-angry',
  },
  乱了阵脚: {
    权重: '中',
    效果: '33% 概率技能作用到自己身上（伤害打自己、状态施给自己）',
    解除: '每回合结束 50% 自行解除',
    固定回合: null,
    施加对象: '对方',
    图标: 'fa-solid fa-hurricane',
  },
  腿软: {
    权重: '重',
    效果: '每回合 30% 概率无法行动',
    解除: '每回合结束 30% 自行解除，满 4 回合强制解除',
    固定回合: 4,
    施加对象: '对方',
    图标: 'fa-solid fa-person-falling',
  },
  僵住: {
    权重: '重',
    效果: '完全无法行动',
    解除: '固定 1 回合，回合结束必解',
    固定回合: 1,
    施加对象: '对方',
    图标: 'fa-solid fa-hourglass-half',
  },
};

/** 战斗态状态单选的选项：「无」＋十种（§5.8 字段落位表）。 */
export const STATE_OPTIONS = ['无', ...(Object.keys(STATES) as AbnormalName[])] as const satisfies readonly StateName[];

/** 面板选定某状态时，`$…状态剩余回合` 自动重置到的值（§5.8：剩余回合不单独编辑）。
 * 没有固定回合数的两种（被拿住、乱了阵脚）归 0，由面板显示「—」而不是数字。 */
export function resetRounds(name: StateName): number {
  return name === '无' ? 0 : (STATES[name].固定回合 ?? 0);
}

/** 该状态是否有回合倒数。用于决定剩余回合显示数字还是「—」。 */
export function hasCountdown(name: StateName): boolean {
  return name !== '无' && STATES[name].固定回合 !== null;
}
