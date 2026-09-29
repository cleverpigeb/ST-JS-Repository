<template>
  <section class="sl">
    <header class="sl__head">
      <h4 class="sl__title">
        <i class="fa-solid fa-list-ol" aria-hidden="true"></i>
        本回合流水
      </h4>
      <span v-if="sections.length" class="sl__badge">脚本已结算</span>
    </header>

    <div v-if="sections.length" class="sl__body">
      <section v-for="(section, index) in sections" :key="index" class="sl__block" :class="blockClass(section.head)">
        <h5 v-if="section.head" class="sl__block-head">
          <i :class="headIcon(section.head)" aria-hidden="true"></i>
          {{ section.head }}
        </h5>
        <ul class="sl__lines">
          <li v-for="(line, i) in section.lines" :key="i" class="sl__line">{{ line }}</li>
        </ul>
      </section>
    </div>

    <p v-else class="sl__empty">还没有出过手，这一场没有可读的结算。点四格菜单里的一招就会有。</p>

    <p class="sl__note">
      <i class="fa-regular fa-circle-question" aria-hidden="true"></i>
      这一栏是<b>本回合的权威结算</b>：面板在你点下那一手时就把整个回合算完了，同一份文本也一并发给了她。
      正文里的数字若与这里不符，以这里为准。
    </p>
  </section>
</template>

<script setup lang="ts">
import { splitLedger } from '../logic/battle';
import { useDataStore } from '../store';

/** 七块输出的流水栏（design-spec §5.8 组件树：SevenBlockLog ← §11 七块输出，按先攻顺序）。
 *
 * **这个组件换过一次数据来源，方向是反的**（2026-09-24 §11.7 裁定）。
 * 第一版从本层正文里正则摘取模型报的数（`logic/battle-log.ts` 的 `extractLog`），
 * 注释里写着「尽力摘取的复读，不参与任何结算」。那一版的前提是「数值由模型算」——
 * 而实测第五条「战斗实际上并没有发生」证明这条路走不通：模型既不知道先攻、也不知道她选了什么招，
 * 于是什么都没算，正文里压根没有可摘的行。
 *
 * §11.7 把结算收回前端之后，权威流水就在 `决斗.$本回合流水` 里，本组件直读它。
 * 于是：
 *   · 「重读本层」按钮撤掉——没有可重读的对象，流水不在正文里。
 *   · 「尽力摘取」那句免责撤掉，换成反向的一句：**正文与这里不符时以这里为准**。
 *     这不是自夸，是必须说的话：模型照抄时抄错一个数，玩家得知道该信哪边。
 *   · `error` 入参撤掉——读 MVU 不会失败，失败的是宿主取数，而这一层已经不取正文了。
 *
 * **顺序仍然不需要本组件排**：段头是 `logic/battle.ts` 按先攻顺序写下来的
 *（`【先攻】`→`【先手·某某】`→`【后手·某某】`→`【回合结束】`），按原序列出即是 §11.1 的块序。
 * 第 2、4、6 块是模型写的正文，不在流水里，所以这一栏只有三到四块。 */
const store = useDataStore();

const sections = computed(() => splitLedger(store.data.决斗.$本回合流水));

/** 段头配图标。段头里带名字（`先手·朱小笋`），所以按前缀认，不做全等匹配。 */
function headIcon(head: string): string {
  if (head === '先攻') {
    return 'fa-solid fa-dice-d20';
  }
  if (head === '回合结束') {
    return 'fa-solid fa-flag-checkered';
  }
  if (head === '本场结束') {
    return 'fa-solid fa-trophy';
  }
  return 'fa-solid fa-hand-fist';
}

/** 行动块按出手方上色，与对局面板两侧同一套色。判不出归属的块不上色，不拿「大概是谁」糊过去。 */
function blockClass(head: string): string {
  if (head.endsWith('朱小笋')) {
    return 'sl__block--her';
  }
  if (head.endsWith('主角')) {
    return 'sl__block--you';
  }
  return '';
}
</script>

<style lang="scss" scoped>
/* 这一栏现在住在下半屏的消息框里（§11.8），不再是面板上另起的一栏，所以外框由消息框给，
   本组件只留一点与上方旁白的间距。 */
.sl {
  margin-top: 6px;
}

.sl__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sl__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--hud-mute);

  i {
    margin-right: 4px;
  }
}

/* 「脚本已结算」是一枚事实标签，不是按钮：玩家得看出这些数不是模型编的 */
.sl__badge {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--theme-accent);
  border: 1px solid currentcolor;
  border-radius: 2px;
  padding: 0 5px;
  line-height: 1.5;
}

/* 三到四块加上双方的行，长回合能到十几行。消息框与右侧四格菜单是并排的，
   所以这里封一个上限让它自己滚——不封的话消息框会把菜单拉到屏外，那时玩家得先滚过整份流水才能出手。
   `44vh` 而不是固定 px：楼层高度随宿主窗口变，固定值在矮屏上一样会顶出去。 */
.sl__body {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 44vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sl__block {
  padding: 3px 6px;
  background: var(--hud-bg-2);
  border-left: 2px solid transparent;
}

.sl__block--her {
  border-left-color: var(--theme-primary);
}

.sl__block--you {
  border-left-color: var(--hud-mute);
}

.sl__block-head {
  font-size: 11px;
  font-weight: 700;
  color: var(--hud-mute);

  i {
    margin-right: 3px;
  }
}

.sl__lines {
  list-style: none;
}

.sl__line {
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.sl__empty {
  margin-top: 4px;
  font-size: 12px;
  color: var(--hud-mute);
}

.sl__note {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--hud-mute);

  i {
    margin-right: 3px;
  }

  b {
    color: var(--theme-accent);
  }
}
</style>
