<template>
  <div v-if="message" class="eb hud-surface">
    <p class="eb__title">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      {{ label }}渲染失败
    </p>
    <p class="eb__msg">{{ message }}</p>
    <button class="eb__retry hud-tap" type="button" @click="retry">重试</button>
  </div>

  <!-- display:contents 让这层不产生盒子，套上边界不改变原有布局；
       换 key 即可让插槽内容整棵重建，重试才有意义。 -->
  <div v-else :key="attempt" class="eb__pass"><slot /></div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ label?: string }>(), { label: '本页' });

const message = ref('');
const attempt = ref(0);

/** design-spec §5.8：分区抛错必须隔离——某页抛错时该页显示失败提示，
 * 其余三页与常显头部照常。返回 false 阻止继续向上冒泡，否则整面板一起空。 */
onErrorCaptured(error => {
  message.value = error instanceof Error ? error.message : String(error);
  console.error(`[朱小笋状态栏] ${props.label}渲染失败`, error);
  return false;
});

function retry() {
  message.value = '';
  attempt.value += 1;
}
</script>

<style lang="scss" scoped>
.eb {
  margin: 6px 0;
  padding: 10px 12px;
  border-left: 3px solid var(--c-danger);
}

.eb__title {
  font-weight: 700;
  color: var(--c-danger);
  margin-bottom: 4px;
}

.eb__msg {
  font-family: var(--font-num);
  font-size: 12px;
  line-height: 1.5;
  color: var(--hud-mute);
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 8px;
}

.eb__retry {
  border: 1px solid var(--hud-border);
  background: transparent;
  color: var(--hud-text);
  border-radius: 2px;
  padding: 2px 10px;
  font: inherit;
  cursor: pointer;

  &:hover {
    background: var(--theme-soft);
    border-color: var(--theme-primary);
  }
}

.eb__pass {
  display: contents;
}
</style>
