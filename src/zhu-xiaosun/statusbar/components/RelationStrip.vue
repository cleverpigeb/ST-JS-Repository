<template>
  <div class="rs hud-surface" :class="{ 'rs--editing': editing }">
    <template v-if="editing">
      <EditableField
        label="关系"
        icon="fa-solid fa-link"
        type="select"
        editing
        :options="stageOptions"
        :model-value="draft.关系"
        hint="逐级 ±1 不跳段；改动会照常派发解锁与她的上限派生"
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

    <template v-else>
      <span class="rs__stage">
        <i class="fa-solid fa-link" aria-hidden="true"></i>
        {{ store.data.关系._当前关系 }}
      </span>
      <StatBar
        class="rs__bar"
        label="好感度"
        icon="fa-regular fa-heart"
        tone="affection"
        :value="store.data.关系.$好感度"
        :max="100"
        :low-at="0.1"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { STAGE_ORDER, type Stage } from '../data/stages';
import { relationPatch } from '../logic/derive';
import { useEditMode } from '../logic/edit-mode';
import { useDataStore } from '../store';
import EditableField from './EditableField.vue';
import StatBar from './StatBar.vue';

/** 关系段 ＋ 好感度的常显条。**只在战斗态与邀请态挂载**，常态由朱小笋页承担这两项。
 *
 * 为什么是单独一个组件而不是塞回 `SceneHeader`：两者的显隐条件是**互补**的——
 * 场景时间地点在战斗态不显示（§5.8 布局模式那条可否决项），而本条恰恰要在战斗态显示。
 * 合在一个组件里就得在内部再写一层 `v-if`，还得把面板态传进来，不如各自独立。
 *
 * 落位的来龙去脉：§5.8 组件树 line 410 把常显头部定义成「场景时间地点 ＋ 关系段 ＋ 好感度」，
 * 而 line 392 只说**场景信息**在战斗态不显示。此前的实现把整个 `SceneHeader` 一起藏了，
 * 于是关系与好感度在对局中也跟着消失——那是实现比设计多藏了两项。
 * 实测反馈后用户把常态的这两项迁进朱小笋页、**战斗态保持顶部常显**，本组件承接后半句。
 *
 * 编辑态给控件而不是只读：编辑态是「修变量更新错误」的兜底（用户口径），而 §10.2 的胜负后果
 * （关系 +1／好感度清零／−5）至今没有实现位（`logic/duel.ts` 的 closeDuel 注释记着这笔欠账），
 * 第一版要靠玩家手改兜底。若本条在对局里只读，那笔兜底在战斗态就没有入口。
 *
 * **已知的小瑕疵，不修**：战斗态编辑时改「关系」会让她的生命上限派生变化，而同屏 `BattlePanel`
 * 表单里那个「生命」输入框的上界是用**当前** store 算的，要等提交后才跟上。提交顺序本身是对的——
 * `participants` 是插入序，`StatusBar` 的本组件先于 `BattlePanel` 挂载，所以先写关系、
 * 后夹血量，`BattlePanel.submit()` 读到的是已经更新过的上限。只有编辑途中的提示数字会短暂偏旧。 */
const store = useDataStore();

const draft = reactive({
  关系: '恋人' as Stage,
  好感度: 0,
});

const stageOptions = STAGE_ORDER.map(stage => ({ value: stage, label: stage }));

const editing = useEditMode({
  start: () => {
    draft.关系 = store.data.关系._当前关系;
    draft.好感度 = store.data.关系.$好感度;
  },
  submit: () => {
    // 与朱小笋页同一条通道：`relationPatch` 顺带派发 `$已达最高关系阶段`（只增不减）、
    // 她的两项上限派生与满 100 解锁。本组件不碰 `朱小笋` 下的其它键，所以整份用它的返回值。
    Object.assign(store.data, relationPatch(store.data, { 关系: draft.关系, 好感度: draft.好感度 }));
  },
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});
</script>

<style lang="scss" scoped>
.rs {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  margin-bottom: 8px;
}

/* 编辑态是两行带标签的控件，横排会把 select 压太窄 */
.rs--editing {
  display: block;
  padding: 8px 10px;
}

.rs__stage {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-accent);
  white-space: nowrap;

  i {
    margin-right: 4px;
  }
}

.rs__bar {
  flex: 1 1 auto;
}
</style>
