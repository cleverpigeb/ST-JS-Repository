<template>
  <section class="tz hud-split">
    <!-- 左栏：立绘 ＋ 三条属性。这一栏在任何子分页下都在，所以「她现在是什么状态」不需要翻页。 -->
    <div class="hud-split__side">
      <PortraitFrame
        who="she"
        alt="朱小笋的正面立绘"
        ratio="3 / 4"
        :caption="stageNow"
        class="hud-split__portrait"
      />

      <p v-if="reachedDiffers" class="tz__reached">
        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        历史最高 {{ store.data.关系.$已达最高关系阶段 }}
      </p>

      <!-- 生命／精力显示成满值条：常态下这两项**只有上限**、没有单独的当前值字段，
           恒等于满。写成 `480 / 480` 而不是光秃秃一个 480，是为了让它和对局面板里那条
           会掉的同一根条子长得一样——玩家一眼看出这是同一个量，只是现在满着。
           `low-at="0"` 关掉低位变红：满值永远不该是危险色。 -->
      <StatBar
        label="生命"
        icon="fa-solid fa-heart"
        tone="life"
        :value="store.data.朱小笋.$生命上限"
        :max="store.data.朱小笋.$生命上限"
        :low-at="0"
      />
      <StatBar
        label="精力"
        icon="fa-solid fa-bolt"
        tone="energy"
        :value="store.data.朱小笋.$精力上限"
        :max="store.data.朱小笋.$精力上限"
        :low-at="0"
      />
      <StatBar
        label="好感度"
        icon="fa-regular fa-heart"
        tone="affection"
        :value="editing ? draft.好感度 : store.data.关系.$好感度"
        :max="100"
        :low-at="0.1"
      />

      <p class="tz__bars-note">
        上限按「{{ store.data.关系.$已达最高关系阶段 }}」档派生（草案 §5 表），由脚本写入、面板不给编辑入口；
        常态不记录当前值，消耗只发生在对局里。
      </p>
      <p v-if="capMismatch" class="tz__mismatch">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        与该档的 {{ expected.她生命 }}／{{ expected.她精力 }} 不一致。派生是脚本职责，面板不代写。
      </p>
    </div>

    <!-- 右栏：局部分页。不套 KeepAlive，草稿在本组件手里，切子页不会丢。 -->
    <div class="hud-split__main">
      <SubTabs v-model="sub" :tabs="SUB_TABS" />

      <template v-if="sub === '近况'">
        <EditableField
          label="心情"
          icon="fa-regular fa-face-meh"
          :editing="editing"
          :model-value="editing ? draft.心情 : store.data.朱小笋.心情"
          placeholder="她此刻的表情与情绪"
          @update:model-value="value => (draft.心情 = String(value))"
        />

        <!-- 关系与好感度的编辑入口只在编辑态露出：常态下左栏那条好感度条与立绘题注已经是它们的读出口，
             再摆一份带标签的只读行就是同一个数说两遍。 -->
        <template v-if="editing">
          <EditableField
            label="关系"
            icon="fa-solid fa-link"
            type="select"
            editing
            :options="stageOptions"
            :model-value="draft.关系"
            hint="剧情层逐级 ±1 不跳段；面板是手动兜底，改动会照常派发解锁与她的上限派生"
            @update:model-value="value => (draft.关系 = value as Stage)"
          />
          <EditableField
            label="好感度"
            icon="fa-regular fa-heart"
            type="number"
            editing
            :min="0"
            :max="100"
            :model-value="draft.好感度"
            hint="0–100，面板直接改总值，不受模型每拍 ±5 的限制"
            @update:model-value="value => (draft.好感度 = Number(value))"
          />
        </template>

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
      </template>

      <template v-else-if="sub === '招式'">
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
      </template>

      <BagGrid
        v-else
        :bag="editing ? draft.背包 : store.data.朱小笋.背包"
        :editing="editing"
        owner="朱小笋"
        @update:slot="setSlot"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { STAGE_CAPS, STAGE_ORDER, type Stage } from '../data/stages';
import { normalizeBag, type Bag, type BagSlot } from '../logic/bag';
import { relationPatch } from '../logic/derive';
import { useEditMode } from '../logic/edit-mode';
import { herSkillSet } from '../logic/skill-table';
import { useDataStore } from '../store';
import BagGrid from './BagGrid.vue';
import EditableField from './EditableField.vue';
import PortraitFrame from './PortraitFrame.vue';
import SkillLine from './SkillLine.vue';
import StatBar from './StatBar.vue';
import SubTabs from './SubTabs.vue';

/** 朱小笋页（design-spec §5.8 字段落位表）：
 * `心情`／`心里话`（默认模糊）／`背包` 3 格／`$生命上限`·`$精力上限`**只读派生**；她的当前四招**只读**。
 *
 * 布局改成左右两栏（实测反馈）：左栏立绘＋属性条常驻，右栏局部分页。
 * `关系`／`好感度` 也从常显头部搬到这里——见 `SceneHeader.vue` 顶部那段关于偏离 §5.8 的说明。 */
const store = useDataStore();

const SUB_TABS = [
  { id: '近况', label: '近况', icon: 'fa-regular fa-face-meh' },
  { id: '招式', label: '招式', icon: 'fa-solid fa-hand-sparkles' },
  { id: '随身', label: '随身', icon: 'fa-solid fa-box-open' },
] as const;

const sub = ref<string>(SUB_TABS[0].id);
const revealed = ref(false);
const draft = reactive({
  心情: '',
  心里话: '',
  背包: {} as Bag,
  关系: '恋人' as Stage,
  好感度: 0,
});

const stageOptions = STAGE_ORDER.map(stage => ({ value: stage, label: stage }));

/** 编辑三件套登记在计算属性之前：`useEditMode` 在编辑态已开着时会**当场**调用 `start()`，
 * 而 `start()` 只碰 `draft` 与 `store`（都在上面），所以放这儿是安全的；
 * 反过来把它放在末尾，下面那些读 `editing.value` 的 computed 就成了引用尚未初始化的绑定——
 * 惰性求值下能跑通，但没有理由留这个坑。 */
const editing = useEditMode({
  start: () => {
    draft.心情 = store.data.朱小笋.心情;
    draft.心里话 = store.data.朱小笋.心里话;
    draft.背包 = klona(store.data.朱小笋.背包);
    draft.关系 = store.data.关系._当前关系;
    draft.好感度 = store.data.关系.$好感度;
  },
  submit: () => {
    // relationPatch 顺带派发「只增不减」的 $已达最高关系阶段、她的两项上限派生与满 100 解锁。
    // 它返回的 `朱小笋` 已经是「原值 ＋ 新上限」，所以必须在它上面展开写本页那三项，不能反过来。
    const patch = relationPatch(store.data, { 关系: draft.关系, 好感度: draft.好感度 });
    Object.assign(store.data, {
      ...patch,
      朱小笋: {
        ...patch.朱小笋,
        心情: draft.心情.trim(),
        心里话: draft.心里话.trim(),
        背包: normalizeBag(draft.背包),
        // $生命上限／$精力上限 不从草稿带：它们是派生只读，页面上也没有控件
      },
    });
    // 静默进行：不进正文、不告知模型（§5.5 九项⑥）。
    // 提交值被 schema 的 transform 规范化后与草稿不同是正常的，不要当 bug 修回（§5.8 重渲染时机）。
  },
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});

/** 编辑态下题注跟草稿走，否则改了关系要等提交才看得见变化。 */
const stageNow = computed(() => (editing.value ? draft.关系 : store.data.关系._当前关系));

const reachedDiffers = computed(() => store.data.关系.$已达最高关系阶段 !== store.data.关系._当前关系);

/** 她的招表锚在 `$已达最高关系阶段`（历史最高段）而非 `_当前关系`：
 * 关系回退后她不换回低段套（草案 §6.4 第八轮换锚点）。 */
const herSkills = computed(() => herSkillSet(store.data.$技能表, store.data.关系.$已达最高关系阶段));

const expected = computed(() => STAGE_CAPS[store.data.关系.$已达最高关系阶段]);

/** 派生值与查表值对不上时只说一句，不自动改写：派生是脚本职责，面板越权写会掩盖脚本的故障。 */
const capMismatch = computed(
  () =>
    store.data.朱小笋.$生命上限 !== expected.value.她生命 || store.data.朱小笋.$精力上限 !== expected.value.她精力,
);

/** 她换了一句心里话就重新盖上：§5.8 的「默认模糊」是每一句的默认，不是每个楼层只盖一次。 */
watch(
  () => store.data.朱小笋.心里话,
  () => (revealed.value = false),
);

function setSlot(slot: BagSlot, next: { 名称: string; 数量: number }) {
  draft.背包[slot] = next;
}
</script>

<style lang="scss" scoped>
.tz__reached {
  font-size: 11px;
  color: var(--hud-mute);
  text-align: center;

  i {
    margin-right: 3px;
  }
}

.tz__bars-note {
  font-size: 11px;
  line-height: 1.45;
  color: var(--hud-mute);
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

.tz__inner-edit {
  width: 100%;
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  background: var(--hud-bg-2);
  color: var(--hud-text);
  font: inherit;
  font-size: 13px;
  padding: 3px 6px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--theme-primary);
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
  line-height: 1.45;
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
