# CP5 后台分区字号调节

2026-11-07 交付完成，状态为 `WAITING_USER_REVIEW`。

## 使用方式

打开 `http://127.0.0.1:3000/admin`。在“底部酒桌”调节今日委托、底栏栏目名及两平台的福利字号。在各平台设置内调节评论文字、公告正文、歌曲信息和歌词字号。滑块显示当前 px 数值，点击“保存设置”后实时应用到直播页面。

| 区域 | 默认 | 可选范围 | 保存范围 |
| --- | --- | --- | --- |
| 今日委托 | 34px | 16–56px | 全局 |
| 底栏栏目名 | 20px | 12–32px | 全局 |
| 评论正文、用户信息与标签 | 20px | 12–36px | 各平台独立 |
| 公告正文 | 20px | 12–40px | 各平台独立 |
| 歌曲信息 | 20px | 12–24px | 各平台独立 |
| 歌词 | 20px | 12–24px | 各平台独立 |
| 福利正文 | 24px | 12–40px | 各平台独立 |

歌曲信息与歌词的范围按 256px 高播放组件确定，时间按歌曲信息字号的 0.8 倍显示，评论事件附加信息按评论字号的 0.9 倍显示。公告正文可滚动，福利最多两行、超长省略，委托为单行省略。

## 实际检查

- 类型检查、生产构建和 16 项 Node.js 测试通过。
- 实际 HTTP/WebSocket 测试覆盖字号非法类型、非整数、越界和未知字段拒绝，旧配置默认值、部分更新、旧后台保存保留已有字号、全局双平台广播、平台独立同步与服务重启后的持久化。
- Edge 同时打开后台、B 站与抖音，使用滑块的键盘操作逐一调节 7 类文字到最大值和最小值，点击保存并核对实际计算字号。
- 最大字号下委托底边约 y=1053，福利底边约 y=1070，均处于 1080px 画布内。左右栏目和正文起始线分别对齐，歌词最后一行处于播放面板内，最新消息完整可见。
- 40px 公告超长后可滚动，刷新后台保留已保存字号。375px 窄屏后台正常。浏览器页面错误为 0。
- 常用 3000 服务已更新启动。字号检查在独立 3001 测试实例进行，截图使用测试字号和测试福利文案。
- 浏览器详细数据见 `CP5_FONT_SIZE_CHECKS.json`，截图在 `screenshots/cp5-font-sizes/`。

## 文件清单

- `config/example.json`、`config/font-sizes.json`、`server/config.mjs`、`server/index.mjs`、`scripts/runtime.mjs`。
- `src/Admin.tsx`、`src/Overlay.tsx`、`src/main.tsx`、`src/styles.css`、`src/scene-review.css`。
- `tests/config.test.mjs`、`tests/runtime.test.mjs`。
- `AGENTS.md`、`docs/PROJECT_SPEC.md`、`docs/DESIGN_SYSTEM.md`、`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/CHECKPOINTS.md`、`docs/TEST_PLAN.md`。
- 本记录、`docs/CP5_FONT_SIZE_CHECKS.json`、`docs/screenshots/cp5-font-sizes/`。

后续由用户在直播软件中验收实际显示效果。
