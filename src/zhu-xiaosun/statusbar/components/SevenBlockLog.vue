<template>
  <section class="sl">
    <header class="sl__head">
      <h4 class="sl__title">
        <i class="fa-solid fa-list-ol" aria-hidden="true"></i>
        本回合流水
      </h4>
      <button class="sl__reread hud-tap" type="button" title="重新从本层正文里摘一次" @click="emit('reread')">
        <i class="fa-solid fa-rotate" aria-hidden="true"></i>
        重读本层
      </button>
    </header>

    <p v-if="error" class="sl__error">
      <i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i>
      取不到本层正文：{{ error }}
    </p>

    <ol v-else-if="entries.length" class="sl__list">
      <li v-for="(entry, index) in entries" :key="index" class="sl__item" :class="sideClass(entry)">
        <span class="sl__kind">
          <i :class="KIND_ICON[entry.kind]" aria-hidden="true"></i>
          {{ entry.kind }}
        </span>
        <span class="sl__text">{{ entry.text }}</span>
      </li>
    </ol>

    <p v-else class="sl__empty">这一层没摘到可读的结算行。数值看上面的对局面板。</p>

    <p class="sl__note">
      <i class="fa-regular fa-circle-question" aria-hidden="true"></i>
      这一栏是从本层正文里<b>尽力摘取</b>的复读，不参与任何结算；摘漏了不影响生命、精力与状态。
    </p>
  </section>
</template>

<script setup lang="ts">
import type { LogEntry, LogKind } from '../logic/battle-log';

/** 七块输出的复读栏（design-spec §5.8 组件树：SevenBlockLog ← §11 七块输出，按先攻顺序）。
 *
 * **顺序不需要本组件排**：`世界书/阶段指导/决斗回合指导.txt` 写明「排列顺序跟随先攻，本回合 1D20
 * 点数高的那一方排在前面」，所以正文里的先后就是先攻顺序，按原序列出即可。
 *
 * 本组件是纯呈现件：正文的读取与摘取都在 BattlePanel，一层只读一次、两个消费者共用一份结果
 * （CommandBar 还要用它判「讲不出话」封的是哪一招）。`重读本层` 只把事件抛上去——
 * 没有挂任何宿主事件名，因为能确证的事件名一个都没验过，**不猜**。
 *
 * 末尾那句「尽力摘取」是必须留的：摘取会漏、也会误收，界面不得让人误以为这是权威流水。 */
const props = defineProps<{ entries: readonly LogEntry[]; error?: string }>();
const emit = defineEmits<{ reread: [] }>();

const entries = computed(() => props.entries);
const error = computed(() => props.error ?? '');

const KIND_ICON: Record<LogKind, string> = {
  先攻: 'fa-solid fa-dice-d20',
  行动: 'fa-solid fa-hand-fist',
  状态: 'fa-solid fa-circle-exclamation',
  命中: 'fa-solid fa-bullseye',
  例外: 'fa-solid fa-triangle-exclamation',
  回合结束: 'fa-solid fa-flag-checkered',
};

/** 归属摘不出来时不上色，不拿「大概是谁」糊过去。 */
function sideClass(entry: LogEntry): string {
  if (entry.side === '朱小笋') {
    return 'sl__item--her';
  }
  return entry.side === '主角' ? 'sl__item--you' : '';
}
</script>

<style lang="scss" scoped>
.sl {
  margin-top: 8px;
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

.sl__reread {
  border: 1px solid var(--hud-border);
  background: transparent;
  color: var(--hud-mute);
  border-radius: 2px;
  padding: 0 6px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }

  i {
    margin-right: 3px;
  }
}

.sl__list {
  margin-top: 4px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sl__item {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 2px 6px;
  font-size: 12px;
  line-height: 1.5;
  border-left: 2px solid transparent;
  background: var(--hud-bg-2);
}

.sl__item--her {
  border-left-color: var(--theme-primary);
}

.sl__item--you {
  border-left-color: var(--hud-mute);
}

.sl__kind {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--hud-mute);
  white-space: nowrap;

  i {
    margin-right: 3px;
  }
}

.sl__text {
  word-break: break-word;
}

.sl__empty,
.sl__error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--hud-mute);
}

.sl__error {
  color: var(--c-danger);

  i {
    margin-right: 3px;
  }
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
    color: var(--c-warning);
  }
}
</style>
