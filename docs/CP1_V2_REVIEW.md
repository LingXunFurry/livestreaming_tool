# V2 CP1 横屏布局线框验收

日期：2026-11-07（香港时间）。状态：`WAITING_USER_REVIEW`。

CP0 已获用户明确验收。本轮只复核 V2 CP1 的 1920×1080 横屏线框，保留历史已确认的布局位置与比例。没有添加正式背景、像素素材或场景美术。

## 预览

- 布局验收页：<http://127.0.0.1:3000/preview>
- B 站直播源：<http://127.0.0.1:3000/live/bilibili>
- 抖音直播源：<http://127.0.0.1:3000/live/douyin>
- 服务状态：<http://127.0.0.1:3000/api/runtime/status>

## 几何复核

| 区域 | 实测位置与尺寸 |
| --- | --- |
| 直播画布 | 0 / 0，1920 × 1080 |
| 标题 | 40 / 40，1840 × 72 |
| 透明游戏区 | 40 / 144，1280 × 720，16:9 |
| 右栏主面板，歌词开 | 1352 / 144，528 × 576 |
| 歌词面板 | 1352 / 744，528 × 256 |
| 右栏主面板，歌词关 | 1352 / 144，528 × 856 |
| 今日委托 | 40 / 888，1280 × 112 |

Playwright 在 1920×1080 页面逐一测量 B 站和抖音的歌词开启/关闭状态。四种状态均保持画布、标题、游戏区和今日委托尺寸一致。B 站呈现酒馆留言板；抖音呈现公会告示板、任务与公告。直播源的 `html`、`body`、`#root` 和装饰主层背景均透明，不含预览辅助标记。

两条直播源同时存在于浏览器的两个标签页中；服务状态为 `RUNNING`，B 站、抖音和后台的 HEAD 检查成功，WebSocket 可连接。四个直播源状态的控制台均无错误。

## 截图与检查数据

- [CP1 布局验收页](screenshots/cp1/preview.png)
- [B 站 1920×1080 源](screenshots/cp1/bilibili.png)
- [抖音 1920×1080 源](screenshots/cp1/douyin.png)
- [浏览器几何与透明性检查](CP1_V2_BROWSER_CHECKS.json)

## 实际测试

- `npm run build`：通过。
- `npm test`：11 项通过，0 失败。
- `npm run status -- --json`：`RUNNING`，两个直播页和后台可用，WebSocket 可连接。
- Playwright：两平台 × 歌词开/关共四种状态；几何、平台内容、透明层及错误日志检查通过。
- Playwright：两个直播路由在同一浏览器会话内同时打开。

## 修改文件

- `AGENTS.md`、`README.md`、`index.html`
- `docs/PROJECT_SPEC.md`、`docs/DESIGN_SYSTEM.md`、`docs/TEST_PLAN.md`、`docs/CHECKPOINTS.md`、`docs/DECISIONS.md`、`docs/CP0_REVIEW.md`
- `docs/CP1_V2_REVIEW.md`、`docs/CP1_V2_BROWSER_CHECKS.json`、`docs/screenshots/cp1/`
- `src/main.tsx`、`src/Admin.tsx`、`server/index.mjs`、`tests/runtime.test.mjs`

本地快照标签：`checkpoint/cp1-layout`。提交 ID 随交付信息提供。没有推送 GitHub，也没有执行直播客户端实机测试。

当前停在 CP1 等待用户验收。CP2 美术、真实平台事件和播放器接入仍未开始。
