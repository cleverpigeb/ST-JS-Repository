<template>
  <section class="tz">
    <EditToolbar title="朱小笋" :editing="editing" @start="start" @submit="submit" @cancel="cancel" />

    <PortraitFrame who="she" alt="朱小笋的正面立绘" ratio="3 / 4" :caption="portraitCaption" class="tz__portrait" />

    <EditableField
      label="心情"
      icon="fa-regular fa-face-meh"
      :editing="editing"
      :model-value="editing ? draft.心情 : store.data.朱小笋.心情"
      placeholder="她此刻的表情与情绪"
      @update:model-value="value => (draft.心情 = String(value))"
    />

    <!-- 心里话：明线之下的暗线出口。§5.8 要求「默认模糊、点击才显」，且视觉上是
         **被遮住的手写字**而非空白占位——所以文字照排、只加一层遮，不做空占位符。 -->
    <div class="tz__inner">
      <p class="tz__inner-head">
        <span>
          <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
          心里话
        </span>
        <button
          v-if="!editing"
          class="tz__toggle hud-tap"
          type="button"
          :aria-expanded="revealed"
          @click="revealed = !revealed"
        >
          {{ revealed ? '盖回去' : '点一下看' }}
        </button>
      </p>

      <textarea
        v-if="editing"
        class="tz__inner-edit hud-tap"
        rows="3"
        :value="draft.心里话"
        placeholder="她没说出口的那一句"
        @input="event => (draft.心里话 = (event.target as HTMLTextAreaElement).value)"
      ></textarea>

      <p
        v-else
        class="tz__inner-text"
        :class="{ 'tz__inner-text--veiled': !revealed }"
        :title="revealed ? '' : '点一下显示'"
        @click="revealed = true"
      >
        {{ store.data.朱小笋.心里话 }}
      </p>
    </div>

    <div class="tz__block">
      <h4 class="tz__h">
        <i class="fa-solid fa-gauge-simple" aria-hidden="true"></i>
        她的两项上限
        <span class="tz__note">只读派生</span>
      </h4>
      <EditableField
        label="生命上限"
        icon="fa-solid fa-heart"
        readonly
        :model-value="store.data.朱小笋.$生命上限"
        :hint="capHint"
      />
      <EditableField
        label="精力上限"
        icon="fa-solid fa-bolt"
        readonly
        :model-value="store.data.朱小笋.$精力上限"
        :hint="capHint"
      />
      <p v-if="capMismatch" class="tz__mismatch">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        当前值与「{{ store.data.关系.$已达最高关系阶段 }}」档的 {{ expected.她生命 }}／{{ expected.她精力 }}
        不一致。派生由脚本负责，面板不代写。
      </p>
    </div>

    <div class="tz__block">
      <h4 class="tz__h">
        <i class="fa-solid fa-hand-sparkles" aria-hidden="true"></i>
        她的当前四招
        <span class="tz__note">只读，按已达最高关系阶段查表</span>
      </h4>
      <ul v-if="herSkills.skills.length" class="tz__skills">
        <li v-for="skill in herSkills.skills" :key="skill" class="tz__skill">
          <SkillLine :id="skill" />
        </li>
      </ul>
      <p v-else class="tz__pending">{{ herSkills.note }}</p>
    </div>

    <div class="tz__block">
      <BagGrid
        :bag="editing ? draft.背包 : store.data.朱小笋.背包"
        :editing="editing"
        owner="朱小笋"
        @update:slot="setSlot"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { herSkillSet } from '../data/skills';
import { STAGE_CAPS } from '../data/stages';
import { normalizeBag, type Bag, type BagSlot } from '../logic/bag';
import { useDataStore } from '../store';
import BagGrid from './BagGrid.vue';
import EditableField from './EditableField.vue';
import EditToolbar from './EditToolbar.vue';
import PortraitFrame from './PortraitFrame.vue';
import SkillLine from './SkillLine.vue';

/** 朱小笋页（design-spec §5.8 字段落位表）：
 * `心情`／`心里话`（默认模糊）／`背包` 3 格／`$生命上限`·`$精力上限`**只读派生**；她的当前四招**只读**。
 * 页顶固定长宽比框内是她的正面立绘（§5.8 立绘落位）。 */
const store = useDataStore();

const editing = ref(false);
const revealed = ref(false);
const draft = reactive({ 心情: '', 心里话: '', 背包: {} as Bag });

/** 她的招表锚在 `$已达最高关系阶段`（历史最高段）而非 `_当前关系`：
 * 关系回退后她不换回低段套（草案 §6.4 第八轮换锚点）。 */
const herSkills = computed(() => herSkillSet(store.data.关系.$已达最高关系阶段));

const expected = computed(() => STAGE_CAPS[store.data.关系.$已达最高关系阶段]);

const capHint = computed(
  () => `按 关系.$已达最高关系阶段（${store.data.关系.$已达最高关系阶段}）查草案 §5 表派生，由脚本写入，面板不给编辑入口`,
);

/** 派生值与查表值对不上时只说一句，不自动改写：派生是脚本职责，面板越权写会掩盖脚本的故障。 */
const capMismatch = computed(
  () =>
    store.data.朱小笋.$生命上限 !== expected.value.她生命 || store.data.朱小笋.$精力上限 !== expected.value.她精力,
);

const portraitCaption = computed(() => `${store.data.关系._当前关系}　${store.data.朱小笋.心情}`);

/** 她换了一句心里话就重新盖上：§5.8 的「默认模糊」是每一句的默认，不是每个楼层只盖一次。 */
watch(
  () => store.data.朱小笋.心里话,
  () => (revealed.value = false),
);

function start() {
  draft.心情 = store.data.朱小笋.心情;
  draft.心里话 = store.data.朱小笋.心里话;
  draft.背包 = klona(store.data.朱小笋.背包);
  editing.value = true;
}

function cancel() {
  editing.value = false;
}

function setSlot(slot: BagSlot, next: { 名称: string; 数量: number }) {
  draft.背包[slot] = next;
}

function submit() {
  Object.assign(store.data, {
    朱小笋: {
      ...store.data.朱小笋,
      心情: draft.心情.trim(),
      心里话: draft.心里话.trim(),
      背包: normalizeBag(draft.背包),
      // $生命上限／$精力上限 刻意不带进提交：它们是派生只读，页面上也没有控件
    },
  });
  editing.value = false;
}
</script>

<style lang="scss" scoped>
.tz__portrait {
  width: 42%;
  max-width: 148px;
  min-width: 96px;
  margin: 0 auto 8px;
}

.tz__inner {
  margin-top: 6px;
}

.tz__inner-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--hud-mute);

  i {
    margin-right: 3px;
  }
}

.tz__toggle {
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
}

/* 手写体感：斜体 ＋ 稍宽字距 ＋ 一条压在字上的荧光笔痕。
 * 遮住状态只加模糊，不改字号也不换成占位符，才读得出「有话但被盖着」。 */
.tz__inner-text {
  margin-top: 2px;
  padding: 3px 6px;
  font-style: italic;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
  word-break: break-word;
  border-left: 2px solid var(--theme-primary);
  background: var(--theme-soft);
  transition: filter 0.14s ease;
}

.tz__inner-text--veiled {
  filter: blur(3.6px);
  user-select: none;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .tz__inner-text {
    transition: none;
  }
}

.tz__block {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);
}

.tz__h {
  font-size: 12px;
  font-weight: 700;
  color: var(--hud-mute);
  margin-bottom: 4px;

  i {
    margin-right: 4px;
  }
}

.tz__note {
  font-weight: 400;
  font-size: 11px;
}

.tz__mismatch {
  font-size: 11px;
  color: var(--c-warning);

  i {
    margin-right: 3px;
  }
}

.tz__skills {
  list-style: none;
}

.tz__skill {
  padding: 3px 0;
  border-bottom: 1px dashed var(--hud-rule);

  &:last-child {
    border-bottom: none;
  }
}

.tz__pending {
  font-size: 12px;
  color: var(--c-warning);
}
</style>
