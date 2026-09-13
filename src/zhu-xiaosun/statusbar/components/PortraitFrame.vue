<template>
  <figure class="pf" :class="`pf--${who}`">
    <div class="pf__box" :style="{ aspectRatio: ratio }">
      <!-- 第一版没有图时显示的抽象轮廓：不是空白灰块，留白会让人以为没加载完
           （design-spec §5.8 立绘占位）。stroke 走 currentColor，随常态／战斗态换色。 -->
      <svg class="pf__outline" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
        <circle cx="24" cy="18" r="9.5" />
        <path d="M7 54c0-9.6 7.6-15.5 17-15.5S41 44.4 41 54" />
      </svg>

      <!-- 图片源走一个 CSS 变量：后续接图只改 global.css 里 --portrait-she／--portrait-you，
           不动布局也不改本组件。变量为 none 时这层透明，轮廓透出来。 -->
      <div class="pf__img" role="img" :aria-label="alt"></div>
    </div>
    <figcaption v-if="caption" class="pf__caption">{{ caption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** she ＝ 她的正面立绘（朱小笋页顶部）；you ＝ 主角背面剪影（战斗态对局面板下方）。 */
    who: 'she' | 'you';
    alt: string;
    /** 固定长宽比，CSS aspect-ratio 语法。 */
    ratio?: string;
    caption?: string;
  }>(),
  { ratio: '3 / 4', caption: '' },
);
</script>

<style lang="scss" scoped>
.pf {
  min-width: 0;
}

.pf__box {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--hud-border);
  border-radius: 3px;
  background: var(--c-locked);
  color: var(--hud-border); /* 供轮廓 currentColor 取用 */
}

.pf__outline,
.pf__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.pf__outline {
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  padding: 8%;
}

.pf__img {
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

.pf--she .pf__img {
  background-image: var(--portrait-she);
}

/* 主角是背面剪影：没有图时把轮廓压暗一档，和她的正面框区分开 */
.pf--you .pf__img {
  background-image: var(--portrait-you);
}

.pf--you .pf__box {
  color: var(--hud-mute);
}

.pf__caption {
  margin-top: 4px;
  font-size: 11px;
  color: var(--hud-mute);
  text-align: center;
}
</style>
