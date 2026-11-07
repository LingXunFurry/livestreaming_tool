# CP5 底栏双桌面追加验收

2026-11-07 完成直播后追加调整，状态为 `WAITING_USER_REVIEW`。

## 交付

- 底部采用两个 628px 桌面，中间 24px 间距。左桌位于 x=40，右桌位于 x=692，整体覆盖至游戏区右边线 x=1320。
- 按用户对文字偏高的反馈，文字区域统一下移 24px 至 y=912，两侧栏目文字行位于 y=928，正文从 y=960 开始。
- 左桌显示共用今日委托，正文为 34px 单行，超长省略。
- 右桌 B 站显示“上舰福利”，抖音显示“灯牌福利”。正文使用 24px 像素字，支持换行，最多两行，超长省略。
- 后台新增“底部酒桌”独立区域，集中编辑全局委托和两平台福利正文。福利正文初始为空，填写后点击“保存设置”同步。
- 背景以既有木桌模块离线重组。左桌采用干净桌面，右桌保留供酒陈设。像素色板与透明游戏窗口经过逐像素校验。
- 配置支持旧文件缺少福利字段的情况。旧版后台保存时保留已有福利，服务重连后直播页重新读取配置。

## 实际验证

- `npm run check`、`npm run build`、`npm test` 通过，Node.js 测试共 15 项。
- `scripts/compose-cp3-scene.ps1` 校验 1920×1080 画布、固定色板、二值透明度与 921,600 个透明游戏像素。
- Edge 浏览器同时打开后台和两个直播页，通过后台填写和保存两平台独立正文，实际检查实时同步及平台隔离。
- 实际检查了两行换行、长文省略、纯文本保护、空内容、刷新持久化、歌词开启与关闭的右栏几何，以及 375px 窄屏后台。
- 对独立的 3001 测试服务执行停止、离线保存和重启，已打开的直播页通过重连自动恢复最新福利。停止期间后台产生两条预期的连接拒绝日志，服务恢复后页面正常。
- 常用服务已运行于 127.0.0.1 的 3000 端口。启动前后用户设置文件 SHA256 均为 `bccdf91ff0a07581c1e65211231775fd817b2464fe6a7f6a187574eadcba11c5`。真实配置中的福利正文为空，原委托为“唱歌聊天回~~~”。
- 3001 端口和 `.cache/benefits-runtime` 为独立验收实例。截图中的福利排版文案仅用于验收。
- 浏览器机器结果见 `CP5_BENEFITS_CHECKS.json`，场景像素检查见 `CP3_SCENE_CHECKS.json`。

## 预览

- 管理后台为 `http://127.0.0.1:3000/admin`。
- B 站页面为 `http://127.0.0.1:3000/live/bilibili`。
- 抖音页面为 `http://127.0.0.1:3000/live/douyin`。
- 截图位于 `screenshots/cp5-benefits/`，包含双平台、底栏局部、歌词开启、后台、后台窄屏和常用服务的实际 B 站画面。
- 直播软件内的加载与实际编码画面由用户实播验收。

## 文件清单

- `src/Overlay.tsx`、`src/main.tsx`、`src/Admin.tsx`、`src/styles.css`、`src/scene-review.css`。
- `server/config.mjs`、`server/index.mjs`、`config/example.json`。
- `assets/layouts/cp3-tavern.json`、`assets/backgrounds/cp3-tavern.png`、`assets/manifest.json`。
- `tests/config.test.mjs`、`tests/runtime.test.mjs`。
- `AGENTS.md`、`docs/PROJECT_SPEC.md`、`docs/DESIGN_SYSTEM.md`、`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/CHECKPOINTS.md`、`docs/TEST_PLAN.md`。
- 本验收记录、`docs/CP5_BENEFITS_CHECKS.json`、`docs/CP3_SCENE_CHECKS.json` 和 `docs/screenshots/cp5-benefits/`。

本轮通过本地 Git 快照保存，后续等待用户确认此追加调整。
