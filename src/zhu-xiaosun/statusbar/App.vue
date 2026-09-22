<template>
  <StatusBar />
</template>

<script setup lang="ts">
import StatusBar from './components/StatusBar.vue';
import { affectionSettlement } from './logic/settle';
import { affectionSettledHere, markAffectionSettled, useDataStore } from './store';

/** 每层挂载时把模型这一拍写的好感度增量结算掉（草案 §1.1／§1.3，落点见 `logic/settle.ts`）。
 *
 * 放在 setup 而不是 `onMounted`：结算要在首帧之前改完，否则 `StatusBar` 的三态判定与好感度条
 * 会先按未结算的旧值画一遍再跳变。
 *
 * 写完再打水位线，且**必须等 store 的深层 watch 把 `stat_data` 落库之后**（`nextTick`）：
 * 水位线走 `insertOrAssignVariables`，那是一次「读整张变量表 → 合并 → 整表写回」，
 * 若抢在 store 落库之前跑完，store 随后的写回读到的是旧表，本拍的增量会被抹掉一次。
 * 反过来先落 stat_data 再打水位线就没有这个窗口。
 */
const store = useDataStore();

if (!affectionSettledHere()) {
  const patch = affectionSettlement(store.data);
  if (patch) {
    Object.assign(store.data, patch);
  }
  void nextTick(markAffectionSettled);
}
</script>
