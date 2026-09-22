/** 全局编辑态：整个状态栏**只有一个**开关，挂在右上角。
 *
 * 实测反馈：四页各一个「编辑」按钮、互不相通，跨页改两处要点四次。改成唯一开关后，
 * 按下时所有**已挂载**的分区一起取草稿，提交／取消时一起落地或一起丢弃。
 *
 * design-spec §5.8 的「整页切换编辑态、不做逐字段小铅笔」照旧成立：那条规则禁的是逐字段小铅笔，
 * 这里只是把「页」的粒度放大到整个面板，方向一致。
 *
 * 草稿仍归各分区自己持有——本模块不碰任何字段，只管「什么时候取、什么时候写」。于是提交顺序无关：
 * 每个 `submit()` 都在执行的那一刻重读 `store.data`，两页写同一个顶层键（`主角` 被主角页与技能页
 * 分别写一半）也不会互相抹掉，只要各自照旧 `...store.data.主角` 展开再覆盖自己那几项。
 *
 * 为什么是模块级状态而不是 provide/inject：
 *   - 参与者跨越三态。常态四页在 `KeepAlive` 里，战斗态是另一套组件，开关要在它们之间连续存在。
 *   - 一个 iframe 只渲染一个面板，模块级状态天然唯一，不需要再找一个共同祖先来 provide。
 *
 * 刻意不做的一件事：面板态在编辑中途翻转（模型把 `$是否在战斗中` 写成真）时，常态四页会被卸载、
 * 未提交的草稿随之丢弃，**不**自动提交。半份草稿落库比丢弃更难收拾，而编辑态本身是兜底手段、
 * 不是常规流程（用户口径：编辑态留给修变量更新错误）。
 */

/** 一个分区的编辑三件套。三个函数都必须是同步的：开关按下后要在同一帧内完成。 */
export interface EditHooks {
  /** 进入编辑态：从 `store.data` 取一份深拷草稿。**不得**在这里翻开关。 */
  start: () => void;
  /** 提交：把草稿一次性 `Object.assign` 回 `store.data`。 */
  submit: () => void;
  /** 取消：丢掉草稿（通常是空实现，下次 `start()` 会整份重取）。 */
  cancel: () => void;
}

const state = ref(false);

/** 返回类型刻意不写 `ComputedRef<boolean>`：那个名字要靠 `unplugin-auto-import` 的类型补全，
 * 而 `auto-imports.d.ts` 只在 build 时生成，先跑 vue-tsc 会报「找不到名称」。由推导给出同样的类型。 */
const editing = computed(() => state.value);

/** 已挂载的参与者。`KeepAlive` 缓存的页只是 deactivate、没有 unmount，所以切页不会掉出这个集合——
 * 这正是「编辑态在所有页面保持」所需：切走的那页草稿还在，提交时一并写回。 */
const participants = new Set<EditHooks>();

/** 注册本分区并拿到共享的编辑态。
 *
 * 返回的是只读 computed：分区只能读，翻开关一律走下面三个函数，避免某一页偷偷退出编辑态、
 * 别的页还留在里面。
 *
 * 编辑态开着的时候才挂上来的页（编辑中切到一个从没看过的标签页）在注册时立刻 `start()`，
 * 否则它会以显示态渲染、看起来像开关漏了这一页。 */
export function useEditMode(hooks?: EditHooks) {
  if (hooks) {
    participants.add(hooks);
    if (state.value) {
      hooks.start();
    }
    onUnmounted(() => participants.delete(hooks));
  }
  return editing;
}

export function startEditing(): void {
  if (state.value) {
    return;
  }
  // 先让所有参与者取满草稿再翻开关：翻开关会触发重渲染，草稿没填的页会闪一下空控件。
  for (const hooks of participants) {
    hooks.start();
  }
  state.value = true;
}

/** 提交与取消都先判开关：非编辑态下调用会把各页**上一轮留下的**草稿写进 store，那是静默的数据覆盖。 */
export function submitEditing(): void {
  if (!state.value) {
    return;
  }
  for (const hooks of participants) {
    hooks.submit();
  }
  state.value = false;
}

export function cancelEditing(): void {
  if (!state.value) {
    return;
  }
  for (const hooks of participants) {
    hooks.cancel();
  }
  state.value = false;
}
