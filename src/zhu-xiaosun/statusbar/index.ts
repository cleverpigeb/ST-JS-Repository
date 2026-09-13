import { prettifyErrorWithInput } from '@util/common';
import { waitUntil } from 'async-wait-until';

import { Schema } from '../schema';
import App from './App.vue';
import './global.css';

const VARIABLE_OPTION = { type: 'message', message_id: getCurrentMessageId() } as const;

/** 只读降级视图（design-spec §5.8 残余风险二的兜底）。
 *
 * `util/mvu.ts:23` 初始化用的是 `schema.parse` 而不是 `safeParse`，楼层变量一旦不符合结构
 * 就会直接抛错，整个面板白屏。所以挂载前先自己 `safeParse` 探一次：不通过就渲染这张说明卡，
 * **不创建 store、不做任何写入**，免得反手把楼层数据改坏。
 */
function mountDegraded(reason: string): void {
  $('#app')
    .empty()
    .append(
      $('<div>')
        .addClass('hud hud-degraded hud-surface')
        .append(
          $('<p>').addClass('hud-degraded__title').text('状态栏已进入只读降级视图'),
          $('<p>')
            .addClass('hud-degraded__desc')
            .text('本楼层的变量表与当前变量结构对不上。面板不显示数据、也不写入任何变量，以免覆盖楼层原数据。'),
          $('<pre>').addClass('hud-degraded__reason').text(reason),
        ),
    );
}

async function init(): Promise<void> {
  try {
    await waitGlobalInitialized('Mvu');
    await waitUntil(() => _.has(getVariables(VARIABLE_OPTION), 'stat_data'), {
      timeout: 15_000,
      intervalBetweenAttempts: 100,
    });

    const probe = Schema.safeParse(_.get(getVariables(VARIABLE_OPTION), 'stat_data', {}), { reportInput: true });
    if (!probe.success) {
      console.error('[朱小笋状态栏] 变量表不符合结构，转入只读降级视图');
      mountDegraded(prettifyErrorWithInput(probe.error));
      return;
    }

    createApp(App).use(createPinia()).mount('#app');
    console.info('[朱小笋状态栏] 已挂载，楼层', VARIABLE_OPTION.message_id);
  } catch (error) {
    // 走到这里通常是 Mvu 未就绪或等待 stat_data 超时，同样给降级视图而不是白屏。
    console.error('[朱小笋状态栏] 初始化失败', error);
    mountDegraded(error instanceof Error ? error.message : String(error));
  }
}

$(() => {
  errorCatched(init)();
});
