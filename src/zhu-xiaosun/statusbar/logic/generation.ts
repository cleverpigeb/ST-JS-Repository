/** 生成态闸：发前等它让路，发后拿它对账。
 *
 * **为什么需要这个模块**（2026-10-02 用户实测第四批，本项目第三十四处）。用户逐字：
 * 「在战斗面板点击技能并发送后，酒馆弹出提示『无法在生成回复时使用 /trigger 命令』；
 *   并且本次回复虽然正常生成，但没能正常发送」，补充实况是「用户消息在，她没回复」、
 *   「是，开战后第一手」。
 *
 * 根因链条是三段，这个模块负责后两段：
 *   一、`/trigger` 在酒馆正在生成时会被挡掉。它弹 toastr 警告而**不抛错**（这一条沙箱读不到
 *       酒馆源码，置信度中），于是 `await triggerSlash('/trigger')` 正常 resolve、
 *       `CommandBar.send()` 的 `catch` 不进，面板接着说「这一手已经发出去了」——面板撒谎。
 *   二、`/trigger` 的 `await` **默认是 `false`**（`slash_command.txt:262`），所以那句 `await`
 *       等的只是 slash 管道，从来不是生成。本地指南 `C5_同层前端.md:404` 把这件事点名禁止过：
 *       「不要仅依赖 `triggerSlash` Promise 的返回时机解除 busy；以生成结束/停止事件和真实消息
 *       重读为准，并准备事件漏收后的超时对账。」
 *   三、整个前端此前**一个酒馆事件都没订阅**（`eventOn|tavern_events|iframe_events` 全仓零命中），
 *       所以它结构性地无法知道一次触发有没有落地。
 *
 * **「开战后第一手」这条实况否掉了一个看似显然的假设**：判档那次 `generateRaw` 并没有还在飞——
 * `PetitionBar.begin()` 是 `await judgeTier(...)` 之后才 `openDuel`，战斗态渲染时那个 promise
 * 已经 resolve 了。所以更可能的情形是**酒馆那边的生成锁在流式收尾里晚一步才放**，而开战后第一手
 * 恰恰是玩家手最快的那一下。这一条同样没有本地可证的来源，所以本模块不赌某一个持锁者：
 * 让路用事件判、剩下的交给发后对账，**不管锁在谁手里都能解**。
 *
 * 两族事件都要订阅，少一族就漏一半：
 *   - `tavern_events.GENERATION_*` 是酒馆自己那条正常回合（`/trigger` 触发的就是它）。
 *   - `iframe_events.GENERATION_*`（`js_generation_*`）是**我们自己**调 `generate`／`generateRaw`
 *     那条路，判档走的正是它。而判档带 `should_silence: true`，按 `duel-tier.ts:162` 的注
 *     「不占用酒馆的停止按钮」——那就不能指望它在 `tavern_events` 里露面。
 *
 * 符号全部取自本仓 `@types/`（置信度 high `[类型声明]`）：
 *   `@types/iframe/event.d.ts:42` `eventOn`、`:139` `eventRemoveListener`、`:172` `iframe_events`、
 *   `:190` `tavern_events`、`:288/:291` iframe 两事件签名、`:344/:360/:361` 酒馆三事件签名；
 *   `@types/function/util.d.ts:18` `getLastMessageId`。
 * **声明只证拼写与形状，不证时序、不证真机可达**——本模块的时序行为至今未经真机验证。
 *
 * **一处已知未证的事**：本模块的监听是模块级的、装一次就不摘（`waitForTurnStart` 自己那条除外）。
 * 每个消息楼层各渲染一个 iframe，所以每层都会装一套；这些监听会不会随 iframe 销毁而自动解除，
 * 沙箱读不到酒馆助手的实现、无从判断。若真机上看到监听器堆积的告警，处置是在 `App.vue` 的
 * `onUnmounted` 里加一次显式摘除，而不是改这里的判据。
 */

/** 收尾余波：任何一侧生成结束之后，再多等这么久才认为锁真的放了。
 *
 * **这是一个未经测量的经验值，不是查到的事实。** 酒馆什么时候放 `is_send_press` 没有任何
 * 可从 iframe 读到的字段（`@types/iframe/exported.sillytavern.d.ts` 暴露了 `streamingProcessor`、
 * `stopGeneration` 等等，但没有一个可读的「正在生成」布尔），所以这里只能给一个保守的等待。
 * 它只在「刚生成完就点」这一种情形下让玩家多等一下，正常节奏下一次都不会触发。
 * 真机上若仍见到那句 toastr，把它往上调；若觉得出手发涩，往下调。 */
export const TAIL_MS = 1_500;

/** 让路的总上限。超过就按「让不开」处理，**不会**无限等下去——
 * 判档那条路若真的挂住不 resolve，`iframe_events.GENERATION_ENDED` 永远不来，
 * 没有这个上限玩家就再也出不了手。 */
export const YIELD_CAP_MS = 20_000;

/** 对账窗口：触发之后等多久还没见到「这一拍起跑了」，就认定触发没落地。
 *
 * 取 8 秒是因为酒馆挡掉 `/trigger` 时自己也会先等一会儿锁；窗口太短会把「等到了锁、起跑慢」
 * 误判成「被拒」，然后多发一次触发。宁可慢一点也不要误判——误判的代价是重复生成。 */
export const SETTLE_WINDOW_MS = 8_000;

/** 我们自己发起的生成，按 `generation_id` 记。
 *
 * 用集合而不是计数器：`iframe_events.GENERATION_ENDED` 若因为任何原因重复到达，
 * 计数器会被减成负数、从此永远「空闲」；集合是幂等的。 */
const localIds = new Set<string>();

/** 酒馆那条正常回合是否在飞。 */
const tavernBusy = ref(false);

/** 本地集合的变化要能驱动 `computed`，所以额外留一个版本号——`Set` 本身不是响应式的。 */
const localVersion = ref(0);

/** 任何一侧最近一次生成结束的墙钟时刻；0 表示本层挂载以来还没见过生成结束。 */
const lastEndedAt = ref(0);

/** 返回类型刻意不写出来：`ComputedRef` 这个名字要靠 `unplugin-auto-import` 的类型补全，
 * 而 `auto-imports.d.ts` 只在 build 时生成，先跑 vue-tsc 会报「找不到名称」。
 * 与 `logic/edit-mode.ts:34` 同一个理由、同一个处置。 */
const generating = computed(() => {
  void localVersion.value;
  return tavernBusy.value || localIds.size > 0;
});

let installed = false;

/** 装监听。**幂等**，而且允许在酒馆助手还没注入全局时被调到：
 * 模块级副作用会在 `index.ts` 的 `waitGlobalInitialized` 之前就跑，那时候 `eventOn` 可能还不在。
 * 所以装载是惰性的，并且装不上就当这个闸不存在（降级成旧行为，而不是整块炸掉）。 */
function install(): void {
  if (installed || typeof eventOn !== 'function') {
    return;
  }
  installed = true;

  // —— 酒馆自己那条回合 ——
  // `dry_run` 为真时酒馆只是在试跑提示词、没有真的要生成，不能算占锁。
  eventOn(tavern_events.GENERATION_STARTED, (_type, _option, dry_run) => {
    if (!dry_run) {
      tavernBusy.value = true;
    }
  });
  eventOn(tavern_events.GENERATION_ENDED, () => {
    tavernBusy.value = false;
    lastEndedAt.value = Date.now();
  });
  eventOn(tavern_events.GENERATION_STOPPED, () => {
    tavernBusy.value = false;
    lastEndedAt.value = Date.now();
  });

  // —— 我们自己调的 generate／generateRaw（判档走这条） ——
  eventOn(iframe_events.GENERATION_STARTED, generation_id => {
    localIds.add(generation_id);
    localVersion.value += 1;
  });
  eventOn(iframe_events.GENERATION_ENDED, (_text, generation_id) => {
    localIds.delete(generation_id);
    localVersion.value += 1;
    lastEndedAt.value = Date.now();
  });
}

/** 只读的生成态，给界面显示用。调用它同时完成惰性装载。 */
export function useGenerationGate() {
  install();
  return generating;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function lastIdOrNaN(): number {
  try {
    return getLastMessageId();
  } catch {
    return Number.NaN;
  }
}

/** 发前让路：等到没有生成在飞、且距上一次生成结束已过 `TAIL_MS`。
 *
 * 返回 `'clear'` 表示可以发了，`'timeout'` 表示等到上限还没让开。
 *
 * **调用方必须把它排在结算之前。** 草案 §11.7 一要求「结算发生在发出这一手的那一刻」，
 * 而先结算再发现发不出去，是这一批里最难受的那种失败：回合数与血量都动了、正文一个字没推进。
 * 让路排在前面，超时那条路上面板一个数都不会动。
 *
 * 装不上监听时（`eventOn` 不可用）本函数**立刻放行**：那种情况下闸本来就不存在，
 * 挡住玩家不如让他发出去、再由发后对账兜一手。 */
export async function yieldToGeneration(capMs: number = YIELD_CAP_MS): Promise<'clear' | 'timeout'> {
  install();
  if (!installed) {
    return 'clear';
  }
  const deadline = Date.now() + capMs;
  for (;;) {
    if (!generating.value) {
      const tail = lastEndedAt.value === 0 ? 0 : lastEndedAt.value + TAIL_MS - Date.now();
      if (tail <= 0) {
        return 'clear';
      }
      if (Date.now() + tail > deadline) {
        return 'timeout';
      }
      await sleep(Math.min(tail, 120));
      continue;
    }
    if (Date.now() >= deadline) {
      return 'timeout';
    }
    await sleep(120);
  }
}

/** 发后对账：触发之后确认这一拍真的起跑了。
 *
 * `floor_id` 传**刚刚建出来的那条用户楼层的 id**（即 `createChatMessages` 之后的
 * `getLastMessageId()`）。起跑的判据取两条里先到的那一条：
 *   一、`tavern_events.GENERATION_STARTED` 且 `dry_run` 为假；
 *   二、`getLastMessageId()` 越过了 `floor_id`——事件漏收时还有这一条兜着
 *      （`C5_同层前端.md:404` 要的「事件漏收后的超时对账」就是这个意思）。
 *
 * 返回 `'started'` 或 `'timeout'`。**它不等生成结束**：这里要答的问题只是「触发落地了没有」，
 * 等不等她说完是界面的事，不是对账的事。 */
export function waitForTurnStart(
  floor_id: number,
  timeoutMs: number = SETTLE_WINDOW_MS,
): Promise<'started' | 'timeout'> {
  install();
  return new Promise(resolve => {
    let settled = false;
    const onStarted = (_type: string, _option: unknown, dry_run: boolean) => {
      if (!dry_run) {
        finish('started');
      }
    };
    const poll = setInterval(() => {
      const id = lastIdOrNaN();
      if (!Number.isNaN(id) && id > floor_id) {
        finish('started');
      }
    }, 150);
    const bail = setTimeout(() => finish('timeout'), timeoutMs);

    function finish(result: 'started' | 'timeout') {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(poll);
      clearTimeout(bail);
      if (installed && typeof eventRemoveListener === 'function') {
        // 监听器留着不摘会在后面的回合里继续 resolve 已经结束的 promise（无害但会堆积）。
        eventRemoveListener(tavern_events.GENERATION_STARTED, onStarted as never);
      }
      resolve(result);
    }

    if (installed && typeof eventOn === 'function') {
      eventOn(tavern_events.GENERATION_STARTED, onStarted as never);
    }
  });
}
