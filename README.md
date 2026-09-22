# ST-JS-Repository

创建自模板的个人前端界面和脚本库。

## 使用方法

无论哪种方式, 请阅读[教程文档](https://stagedog.github.io/青空莉/工具经验/实时编写前端界面或脚本/)来了解如何使用.

### 仅本地使用

你可以点击网页右上角的绿色 `Code` 按钮-`Download ZIP` 下载本模板的压缩包来只在本地使用

### 作为 Github 仓库

你可以通过以下两种方式中的一种来创建仓库:

- 点击网页右上角绿色 `Use this template` 按钮;
- 或者点击网页右上角的 `fork` 按钮, 但需要手动去 fork 所得仓库的 `Actions` 页面启用自动工作流.

在创建好仓库后, 你需要配置工作流的权限: 前往仓库 `Settings -> Actions -> General` 中将 `Workflow permissions` 设置为 `Read and write permissions`, 并勾选 `Allow GitHub Actions to create and approve pull requests`

## 如果只在本地使用

这意味着:

- 你将不能利用 jsdelivr 实现前端界面或脚本的自动更新;
- 也不能享受本模板提供的自动打包、自动更新功能:
  - 上传代码后, 自动打包 `src` 文件夹中的代码到 `dist` 文件夹中;
  - 自动更新成最新的编写模板, 自动更新酒馆和酒馆助手的参考文件……

但你本地依旧能很方便地使用这个模板.

## 如果创建为新仓库

在创建好仓库后, 你可以把仓库网址发给 AI, 问 AI 该**怎么启用 `core.symlinks`**, 然后克隆到本地使用; 或者, 你可以游玩 [Learn Git Branching](https://learngitbranching.js.org/?locale=zh_CN) 来学习 git 分支和合并.

#### `.vscode/launch.json` 文件

由于 `.vscode/launch.json` 文件中填写了你的酒馆地址, 你可能需要运行命令来忽略这个更改, 避免你的云酒馆 ip 地址暴露:

```bash
git update-index --skip-worktree .vscode/launch.json
```

### 示例文件夹

请不要删除`示例`文件夹, AI 需要参考其中的代码; 但你可以在 `webpack.config.ts` 中将 54 行左右的 `{示例,src}/` 改为 `src/` 来避免打包它们.

#### 利用 jsdelivr 实现前端界面或脚本的自动更新

由于你所制作的前端界面或脚本将被打包在 github 仓库中, 你将能用 jsdelivr 链接来访问它们, 而这个链接可以在前端界面或脚本中直接使用.

由此你就可以为用户创建这样一个自动更新的前端界面:

```html
<body>
  <script>
    $('body').load('https://testingcf.jsdelivr.net/gh/lolo-desu/lolocard/dist/日记络络/界面/介绍页/index.html')
  </script>
</body>
```

或一个自动更新的脚本:

```typescript
import 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/酒馆助手/场景感/index.js'
```

更多请见于[文档](https://stagedog.github.io/青空莉/工具经验/实时编写前端界面或脚本/进阶技巧).

### 自动打包、自动更新功能

本仓库在 `.github/workflows` 文件夹中设置了几个 CI 工作流来为你带来自动打包、自动更新功能, 你也可以在网页上方的 `Actions` 中手动运行它们:

**`bundle.yaml`**

- 自动打包 `src` 文件夹中的代码到 `dist` 文件夹中, 并自动递增版本号从而让 jsdelivr 更快更新缓存;
- 自动将 `tavern_sync.yaml` 中[已经配置好了的角色卡、世界书或预设](https://stagedog.github.io/青空莉/工具经验/实时编写角色卡、世界书或预设/)打包成可以被酒馆导入的文件.

**`bump_deps.yaml`**

- 每三天一次, 自动更新第三方库依赖和酒馆助手 `@types` 文件夹.

**`sync_template.yaml`**

- 在你基于模板仓库创建新仓库后, 你的新仓库将不再和模板仓库有关联, 因此我设置了这个工作流用于同步模板仓库的更新 (如编程助手编写规则、MCP、slash_command.txt 文件等):
  - 发现模板仓库更新后, 这个工作流将会自动创建一个 pull request 来同步更新, 而**你需要手动批准 pull request, 因此建议你时常查看 github 的邮件通知;**
  - 如果模板仓库中有文件是你不想继续同步的, 可以在 `.github/.templatesyncignore` 中添加它.

### 打包冲突问题

为了自动更新和打包一些东西, 本项目直接打包源代码在 `dist/` 文件夹中并随仓库上传, 而这会让开发时经常出现分支冲突.

为了解决这一点, 仓库在 `.gitattribute` 中设置了对于 `dist/` 文件夹中的冲突总是使用当前版本. 这不会有什么问题: 在上传后, ci 会将 `dist/` 文件夹重新打包成最新版本, 因而你上传的 `dist/` 文件夹内容如何无关紧要.

为了启用这个功能, 请执行一次以下命令:

```bash
git config --global merge.ours.driver true
```

## 许可证

[Aladdin](LICENSE)

## 朱小笋项目接入约定（2026-09-08）

本仓是通过 Use this template 创建的自有源码、编译和 CDN 仓，不再是旧的独立产物仓。角色卡设计与 forge 工程仍在本地 AFV 治理仓，AFV 永不推远程；本仓不接管角色卡正文、世界书或验收。`src/` 是前端源码真源，`dist/` 是可重建的 Git 跟踪产物，旧 `character_cards/` 布局和跨仓 junction／robocopy 中转不再使用。

本卡路径按其 AFV `design-spec.md` §5.8 约定：源码 `src/zhu-xiaosun/statusbar/`，入口为 `index.ts` 与 `index.html`，输出 `dist/zhu-xiaosun/statusbar/index.html`。沿用当前 webpack 原生映射，不需要改输出配置。`opening-form` 只是后续界面名预留，不代表本轮新增功能。`schema.ts` 的维护真源在 AFV；编码时单向复制到 `src/zhu-xiaosun/schema.ts` 并随前端源码维护版本，状态栏从 `../schema` 导入，禁止反向覆盖 AFV。

本地命令均在本仓根目录执行：`pnpm watch` 开发监听，`pnpm build` 生产构建；两者默认都扫描 `示例/` 与 `src/`，不是本卡隔离构建。保留示例。正式交付不用 watch 的开发产物，build 前先停止 watcher。首次及后续编译应以 webpack 无错误和目标文件生成判定，不能只凭进程存活或「推送更新事件」提示判定成功。

Live Server 在本仓根目录提供文件，5500 为示例端口；状态栏本地地址是 `http://localhost:5500/dist/zhu-xiaosun/statusbar/index.html`。Socket.IO 实时通知端口是 6621，酒馆助手需开启「允许监听」。若实际服务器缺跨端口 CORS 响应头，需在开发配置中处理；本轮没有启动服务器或验证酒馆链接。

正式 CDN 使用 `https://testingcf.jsdelivr.net/gh/cleverpigeb/ST-JS-Repository@main/dist/zhu-xiaosun/statusbar/index.html`。`@main` 跟随分支，不锁定 tag 或 commit；仅本卡采用此约定，上文模板示例保持原样。根据 [jsDelivr 官方说明](https://github.com/jsdelivr/jsdelivr#github)，省略 ref 会优先取最新 semver tag（无 tag 才回退默认分支），不能将其等同于 main；Branches 缓存约 12 小时，版本别名约 7 天，另有镜像和浏览器缓存，推送不等于立即更新。

按当前 `bundle.yaml`，推送 main/master 的非纯 dist 变更可触发 Node 24 + pnpm 10 的构建、bot 回写产物及自动 tag；正常流程是推源码、等工作流成功、同步 bot 提交，再核对 dist。自动 tag 流程还可能删除前一个 tag，不据此把 tag 当本卡不可变归档。远程 Actions 的读写和 PR 权限仍需按上文 README 配置；配置文件存在不表示已启用或已运行成功。`sync_template.yaml` 通过 PR 提出模板更新，接受前核对项目差异；`.github/.templatesyncignore` 是排除同步的入口。

构建的附带动作也属于写入范围：`pnpm dump` 会导出 schema，生产模式会调用 `pnpm sync bundle all`，watch 会启动 `pnpm sync watch all -f`；当前 `tavern_sync.yaml` 只有模板示例。本卡不在这里注册，不把同步器路径指向 AFV，不与 tavern-cards/forge 并行维护角色卡。

本轮只登记接入约定，`src/` 尚只有占位文件、没有朱小笋实现，`dist/` 尚未生成；当前公共链接不能视为已交付。没有运行 install/watch/build、修改全局 Git 配置、提交或推送。开发时沿用用户 Windows 环境，不用 Linux 依赖覆盖现有 Windows node_modules。
