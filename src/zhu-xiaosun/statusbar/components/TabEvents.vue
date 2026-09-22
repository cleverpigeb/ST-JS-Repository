<template>
  <section class="te">
    <!-- ── 进行中 ── -->
    <div class="te__block">
      <h4 class="te__h">
        <i class="fa-regular fa-note-sticky" aria-hidden="true"></i>
        进行中
        <span class="te__note">{{ ongoingRows.length }} 条</span>
      </h4>

      <ul v-if="ongoingRows.length" class="te__list">
        <li v-for="row in ongoingRows" :key="row.index" class="te__item hud-surface">
          <template v-if="editing">
            <input
              v-model="draft.rows[row.index].事件名"
              class="te__name-input hud-tap"
              type="text"
              placeholder="事件名"
            />
            <textarea
              v-model="draft.rows[row.index].进度"
              class="te__progress-input hud-tap"
              rows="2"
              placeholder="进度"
            ></textarea>
            <div class="te__ops">
              <button class="te__op hud-tap" type="button" title="标记完成，移进历史区" @click="archive(row.index)">
                <i class="fa-solid fa-check" aria-hidden="true"></i>
                标记完成
              </button>
              <button class="te__op te__op--del hud-tap" type="button" title="删掉这条" @click="remove(row.index)">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                删除
              </button>
            </div>
          </template>

          <template v-else>
            <p class="te__name">{{ row.事件名 }}</p>
            <p class="te__progress">{{ row.进度 }}</p>
          </template>
        </li>
      </ul>
      <p v-else class="te__empty">这一段没有挂着的事。</p>

      <button v-if="editing" class="te__add hud-tap" type="button" @click="addRow">
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        添一条
      </button>

      <p v-if="editing && dupes.length" class="te__warn">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        「{{ dupes.join('」「') }}」重名了。事件按名字存，提交时同名只会留下第一条。
      </p>
    </div>

    <!-- ── 历史区：展开区，默认收起 ── -->
    <div class="te__block">
      <button class="te__fold hud-tap" type="button" :aria-expanded="historyOpen" @click="historyOpen = !historyOpen">
        <i :class="historyOpen ? 'fa-solid fa-caret-down' : 'fa-solid fa-caret-right'" aria-hidden="true"></i>
        历史区
        <span class="te__note">{{ historyRows.length }} 条 · 不进提示词</span>
      </button>

      <template v-if="historyOpen">
        <ul v-if="historyRows.length" class="te__list te__list--history">
          <li v-for="row in historyRows" :key="row.index" class="te__item te__item--done">
            <p class="te__name">{{ row.事件名 }}</p>
            <p class="te__progress">{{ row.进度 }}</p>
            <div v-if="editing" class="te__ops">
              <button class="te__op hud-tap" type="button" title="取回进行中" @click="restore(row.index)">
                <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
                取回
              </button>
              <button class="te__op te__op--del hud-tap" type="button" @click="remove(row.index)">
                <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                删除
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="te__empty">还没有归档过的事。</p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { duplicatedNames, toMaps, toRows, type EventRow } from '../logic/events';
import { useEditMode } from '../logic/edit-mode';
import { useDataStore } from '../store';

/** 事件页（design-spec §5.8 字段落位表）：
 * `事件.进行中`（增删改 ＋ 标记完成）／`事件.$历史区`（展开区 ＋ 取回）。
 *
 * 两张表在编辑期摊成一串行、用 `归档` 布尔区分，所以「标记完成」「取回」都只是翻一个布尔，
 * 不必在两个 record 之间搬键；搬移在提交时由 `toMaps()` 一次完成。
 *
 * 编辑开关是全局的（`logic/edit-mode.ts`），本页只登记三件套。 */
const store = useDataStore();

const historyOpen = ref(false);
const draft = reactive({ rows: [] as EventRow[] });

const editing = useEditMode({
  start: () => {
    draft.rows = toRows(store.data.事件.进行中, store.data.事件.$历史区);
  },
  submit: () => {
    const { 进行中, $历史区 } = toMaps(draft.rows);
    Object.assign(store.data, { 事件: { 进行中, $历史区 } });
  },
  cancel: () => {
    // 草稿直接丢弃，下次 start() 会整份重取
  },
});

/** 显示态直接从 store 摊行，编辑态读草稿。两边都带上 index，供编辑态回写草稿定位。 */
const rows = computed<(EventRow & { index: number })[]>(() => {
  const source = editing.value ? draft.rows : toRows(store.data.事件.进行中, store.data.事件.$历史区);
  return source.map((row, index) => ({ ...row, index }));
});

const ongoingRows = computed(() => rows.value.filter(row => !row.归档));
const historyRows = computed(() => rows.value.filter(row => row.归档));
const dupes = computed(() => duplicatedNames(draft.rows));

function addRow() {
  draft.rows.push({ 事件名: '', 进度: '', 归档: false });
}

function remove(index: number) {
  draft.rows.splice(index, 1);
}

function archive(index: number) {
  draft.rows[index].归档 = true;
  historyOpen.value = true; // 刚归档的那条得看得见，否则像是被删了
}

function restore(index: number) {
  draft.rows[index].归档 = false;
}
</script>

<style lang="scss" scoped>
.te__block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--hud-rule);

  &:first-of-type {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }
}

.te__h {
  font-size: 12px;
  font-weight: 700;
  color: var(--hud-mute);
  margin-bottom: 4px;

  i {
    margin-right: 4px;
  }
}

.te__note {
  font-weight: 400;
  font-size: 11px;
}

.te__list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 便利贴：左侧一道赭黄压边，和常态纸面拉开一层 */
.te__item {
  padding: 5px 8px;
  border-left: 3px solid var(--theme-primary);
}

.te__item--done {
  border-left-color: var(--c-success);
  opacity: 0.78;
}

.te__name {
  font-weight: 700;
  word-break: break-word;
}

.te__progress {
  font-size: 12px;
  color: var(--hud-mute);
  white-space: pre-wrap;
  word-break: break-word;
}

.te__empty {
  font-size: 12px;
  color: var(--hud-mute);
}

.te__name-input,
.te__progress-input {
  display: block;
  width: 100%;
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

.te__name-input {
  font-weight: 700;
}

.te__progress-input {
  margin-top: 3px;
  resize: vertical;
  line-height: 1.5;
  font-size: 12px;
}

.te__ops {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.te__op {
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

.te__op--del:hover {
  border-color: var(--c-danger);
  color: var(--c-danger);
}

.te__add {
  margin-top: 6px;
  border: 1px dashed var(--hud-border);
  background: transparent;
  color: var(--hud-mute);
  border-radius: 2px;
  padding: 1px 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--theme-primary);
    color: var(--theme-accent);
  }

  i {
    margin-right: 3px;
  }
}

.te__warn {
  margin-top: 4px;
  font-size: 11px;
  color: var(--c-warning);

  i {
    margin-right: 3px;
  }
}

.te__fold {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--hud-mute);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: var(--theme-accent);
  }

  i {
    margin-right: 4px;
    width: 9px;
  }
}

.te__list--history {
  margin-top: 6px;
}
</style>
