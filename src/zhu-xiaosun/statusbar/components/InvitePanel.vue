<template>
  <section class="ip">
    <h3 class="ip__title">
      <i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i>
      亲密决斗 · 现在可以发起
    </h3>

    <p class="ip__lead">火候到了。发起的是<b>质变决斗</b>：不做偏差修正，她的血按当前段位原样算。</p>

    <dl class="ip__stakes">
      <div class="ip__stake">
        <dt><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i> 赢</dt>
        <dd>关系推进到「{{ nextStage || '——已经是最后一段' }}」，好感度清零重攒。</dd>
      </div>
      <div class="ip__stake ip__stake--bad">
        <dt><i class="fa-solid fa-arrow-trend-down" aria-hidden="true"></i> 输 / 认输</dt>
        <dd>关系不动，好感度 −5。</dd>
      </div>
    </dl>

    <dl class="ip__preview">
      <div class="ip__row">
        <dt>她</dt>
        <dd class="hud-num">生命 {{ store.data.朱小笋.$生命上限 }} · 精力 {{ store.data.朱小笋.$精力上限 }}</dd>
      </div>
      <div class="ip__row">
        <dt>你</dt>
        <dd class="hud-num">生命 {{ store.data.主角.生命上限 }} · 精力 {{ store.data.主角.精力上限 }}</dd>
      </div>
    </dl>

    <p v-if="herSkills.note" class="ip__warn">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      {{ herSkills.note }}。现在开局，对局里她没有可用招——这里不拦，只把话说在前面。
    </p>

    <div class="ip__actions">
      <button class="ip__btn ip__btn--accept hud-tap" type="button" @click="accept">
        <i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i>
        接受
      </button>
      <button class="ip__btn hud-tap" type="button" @click="defer">
        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        暂缓
      </button>
    </div>

    <p class="ip__note">
      点「接受」，这块面板立刻换成对局面板；从行动选择里出第一招，这一场才真正开始。<br />
      点「暂缓」，本段关系内不再提示；推进到下一段、火候再次攒满时会再提示一次。
    </p>
  </section>
</template>

<script setup lang="ts">
import { herSkillSet } from '../data/skills';
import { STAGE_ORDER } from '../data/stages';
import { deferInvite, openQualitativeDuel } from '../logic/duel';
import { useDataStore } from '../store';

/** 邀请态（design-spec §5.7.3）。
 *
 * 这块面板是整张卡里**唯一**说破「亲密决斗」这件事的地方：剧情侧一个字不提，模型也不知道它出现过。
 * 它由 StatusBar 的 `mode` 判定单独挂载，所以本组件不再自己判准入条件。
 *
 * 两个按钮各写一个字段，两个字段**都不提供控件**（§5.8 九项裁决，line 253：
 * 「前者由『暂缓／接受』两个按钮写，后者由开战时的脚本写」）：
 *   - 接受 → `logic/duel.ts` 的 `openQualitativeDuel()`，一次置位十三个决斗字段；
 *   - 暂缓 → `deferInvite()`，记下当前关系段名。
 * 两者写完后 `mode` 立即改判，本组件随即卸载，所以这里不需要任何「已点过」的本地态。
 *
 * **已知缺口，不在本门发明**：design-spec §5.7.3 末尾把「接受按钮怎么写变量才不被模型这一拍的
 * `<UpdateVariable>` 覆盖」「挂哪个事件」两项划给 B-G7 与实测，本组件只做最直接的写入；
 * 若实测发现被覆盖，改的是那两项，不是这里的按钮。
 *
 * 同样按 §5.7.3 的风险条：提示只有一次，误点「暂缓」后本段不再弹，**第一版不加「重新弹出」入口**。
 * 真误点了可以从常态面板把关系推一格再推回来（`$邀请暂缓于` 存的是段名），这是兜底不是设计。 */
const store = useDataStore();

/** 她的招表按「已达最高关系阶段」查，第一版只有恋人／亲密恋人两套；查不到时如实说明。 */
const herSkills = computed(() => herSkillSet(store.data.关系.$已达最高关系阶段));

/** 赢了往前走一格（草案 §10.2）。结婚段没有下一格，显示成一句话而不是空白。 */
const nextStage = computed<string>(() => {
  const index = STAGE_ORDER.indexOf(store.data.关系._当前关系);
  return index >= 0 && index + 1 < STAGE_ORDER.length ? STAGE_ORDER[index + 1] : '';
});

function accept() {
  Object.assign(store.data, openQualitativeDuel(store.data));
}

function defer() {
  Object.assign(store.data, deferInvite(store.data));
}
</script>

<style lang="scss" scoped>
/* 邀请态是常态纸面上的一张「递过来的条子」：主色压边 + 轻微抬起，
   但不用战斗态的暗底，因为这时还没开战。 */
.ip {
  padding: 8px 10px;
  background: var(--hud-bg-2);
  border: 1px solid var(--theme-primary);
  border-radius: 3px;
  box-shadow: 0 1px 0 var(--theme-soft);
}

.ip__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--theme-accent);

  i {
    margin-right: 5px;
  }
}

.ip__lead {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;

  b {
    color: var(--theme-accent);
  }
}

.ip__stakes {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ip__stake {
  display: flex;
  gap: 6px;
  font-size: 12px;
  line-height: 1.5;

  dt {
    flex: 0 0 auto;
    font-weight: 700;
    color: var(--c-success);
    white-space: nowrap;
  }

  dd {
    color: var(--hud-mute);
  }

  i {
    margin-right: 3px;
  }
}

.ip__stake--bad dt {
  color: var(--c-danger);
}

.ip__preview {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--hud-rule);
}

.ip__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;

  dt {
    color: var(--hud-mute);
  }
}

.ip__warn {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--c-warning);

  i {
    margin-right: 3px;
  }
}

.ip__actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.ip__btn {
  flex: 1 1 0;
  padding: 5px 0;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: var(--hud-text);
  background: var(--hud-bg-1);
  border: 1px solid var(--hud-border);
  border-radius: 2px;
  cursor: pointer;

  &:hover {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }

  i {
    margin-right: 4px;
  }
}

.ip__btn--accept {
  color: var(--hud-bg-1);
  background: var(--theme-primary);
  border-color: var(--theme-primary);

  &:hover {
    color: var(--hud-bg-1);
    background: var(--theme-accent);
    border-color: var(--theme-accent);
  }
}

.ip__note {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--hud-mute);
}
</style>
