<template>
  <div class="ef" :class="{ 'ef--editing': editing && !readonly, 'ef--block': block }">
    <span class="ef__label">
      <i v-if="icon" :class="icon" aria-hidden="true"></i>
      {{ label }}
    </span>

    <!-- 只读派生值：任何时候都不给控件（design-spec §5.8 字段落位表） -->
    <span v-if="readonly" class="ef__value hud-locked" :title="hint || '只读派生值，由脚本写入'">
      {{ display }}
    </span>

    <span v-else-if="!editing" class="ef__value" :class="{ 'hud-num': type === 'number' }">
      {{ display }}
    </span>

    <select v-else-if="type === 'select'" class="ef__control hud-tap" :value="String(modelValue)" @change="onSelect">
      <option v-for="opt in options" :key="String(opt.value)" :value="String(opt.value)">
        {{ opt.label }}
      </option>
    </select>

    <textarea
      v-else-if="type === 'textarea'"
      class="ef__control ef__control--area hud-tap"
      rows="3"
      :value="String(modelValue)"
      :placeholder="placeholder"
      @input="onTextInput"
    ></textarea>

    <input
      v-else-if="type === 'number'"
      class="ef__control hud-num hud-tap"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onNumberInput"
      @change="onNumberChange"
    />

    <input
      v-else
      class="ef__control hud-tap"
      type="text"
      :value="String(modelValue)"
      :placeholder="placeholder"
      @input="onTextInput"
    />

    <p v-if="hint && editing && !readonly" class="ef__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import type { FieldOption } from '../logic/field-option';

/** 草稿控件。**不直接绑 `store.data`**：`util/mvu.ts:45-60` 的 deep watch 会把任何深层写入
 * 立即回写 MVU，直绑等于每次按键写一次变量，且「取消」没有回滚路径（design-spec §5.8 草稿层）。
 * 所以本组件只吐 `update:modelValue`，由各页的本地 reactive 草稿接住，提交时统一 Object.assign。 */
const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: string | number;
    editing?: boolean;
    type?: 'text' | 'textarea' | 'number' | 'select';
    icon?: string;
    options?: readonly FieldOption[];
    min?: number;
    max?: number;
    step?: number;
    readonly?: boolean;
    hint?: string;
    placeholder?: string;
    /** 显示态覆盖文案（如把空串显示成「未装备」）。 */
    displayAs?: string;
    /** 标签与控件换行排列，供多行文本与长值使用。 */
    block?: boolean;
  }>(),
  {
    editing: false,
    type: 'text',
    icon: '',
    options: () => [],
    min: undefined,
    max: undefined,
    step: 1,
    readonly: false,
    hint: '',
    placeholder: '',
    displayAs: '',
    block: false,
  },
);

const emit = defineEmits<{ 'update:modelValue': [string | number] }>();

const display = computed(() => {
  if (props.displayAs) {
    return props.displayAs;
  }
  if (props.type === 'select') {
    const hit = props.options.find(opt => String(opt.value) === String(props.modelValue));
    if (hit) {
      return hit.label;
    }
  }
  const value = props.modelValue;
  return value === '' || value === null || value === undefined ? '—' : String(value);
});

function onSelect(event: Event) {
  const raw = (event.target as HTMLSelectElement).value;
  // 选项值可能是数字（如倍率四档），按字符串回查一次以保住原类型
  const hit = props.options.find(opt => String(opt.value) === raw);
  emit('update:modelValue', hit ? hit.value : raw);
}

function onTextInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value);
}

/** 上界在 @input 就夹。
 * 边界处理在输入时做、不得改成提交后校验（design-spec §5.8＝5.5 裁决④）；
 * 而「超过上限」在这些只增的正数字段里不可能是通往合法值的中间态，当场夹住不挡任何输入。 */
function onNumberInput(event: Event) {
  const element = event.target as HTMLInputElement;
  const parsed = Number(element.value);
  if (element.value === '' || Number.isNaN(parsed)) {
    return; // 清空重打的中间态，留到 change 收口
  }
  if (props.max !== undefined && parsed > props.max) {
    element.value = String(props.max);
    emit('update:modelValue', props.max);
    return;
  }
  emit('update:modelValue', parsed);
}

/** 下界与空值留到 @change（失焦或回车）才夹。
 * 下限 100 的字段里「1」是打到「100」的必经中间态，在 @input 就夹会把人钉死在下限上打不动字。
 * change 仍在输入阶段收口，草稿提交前就已合法，**不是**提交后校验。 */
function onNumberChange(event: Event) {
  const element = event.target as HTMLInputElement;
  const parsed = Number(element.value);
  const next =
    element.value === '' || Number.isNaN(parsed)
      ? (props.min ?? 0)
      : _.clamp(parsed, props.min ?? -Infinity, props.max ?? Infinity);
  element.value = String(next);
  emit('update:modelValue', next);
}
</script>

<style lang="scss" scoped>
.ef {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  min-width: 0;
  flex-wrap: wrap;
}

.ef--block {
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
}

.ef__label {
  font-size: 12px;
  color: var(--hud-mute);
  white-space: nowrap;
  flex: 0 0 auto;

  i {
    margin-right: 3px;
  }
}

.ef__value {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}

.ef__control {
  flex: 1 1 auto;
  min-width: 0;
  font: inherit;
  color: var(--hud-text);
  background: var(--hud-bg-1);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  padding: 1px 6px;

  &:focus {
    outline: none;
    border-color: var(--theme-primary);
    box-shadow: 0 0 0 2px var(--theme-soft);
  }
}

.ef__control--area {
  resize: vertical;
  line-height: 1.5;
  padding: 4px 6px;
}

.ef__hint {
  flex: 1 0 100%;
  font-size: 11px;
  color: var(--hud-mute);
}
</style>
