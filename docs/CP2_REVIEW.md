# V2 CP2 像素素材样板验收

2026-11-07，香港时间。状态为 `WAITING_USER_REVIEW`。

## 交付

酒杯、木桌、蜡烛各自通过内置 imagegen 独立生成，源稿和提示词随项目保存。交付 PNG 使用 64×64 逻辑画布、V2 十个固定色值及 0/255 alpha。三件素材的造型、描边密度、视角、左上光照和质感交给用户逐件验收。

展示板地址为 <http://127.0.0.1:3000/assets/review>，提供棋盘、深蓝与浅色底，原尺寸与四倍整数放大，以及三个 PNG 的独立下载。

| 素材 | 交付文件 | 逻辑画布 | 实际非透明边界 | 透明像素 |
| --- | --- | --- | --- | --- |
| 酒杯 | `assets/generated/cp2/tavern-mug.png` | 64×64 | 46×52 | 2252 |
| 木桌 | `assets/generated/cp2/wooden-table.png` | 64×64 | 52×51 | 2558 |
| 蜡烛 | `assets/generated/cp2/candle.png` | 64×64 | 33×40 | 3438 |

## 制作与来源

本轮选择 64×64 逻辑尺寸与离线色板映射，落实 V2 的像素尺度和色彩统一流程。生图源稿实际为 1254×1254，带有半透明边缘且 RGB 偏离固定 Token。`scripts/prepare-cp2-assets.ps1` 以中心点最近邻采样归一到 64×64，将颜色映射到最接近的 V2 RGB，并以 128 阈值生成硬透明边缘。这个步骤减少了源稿的细节层次，最终细节密度仍须用户确认。

源稿是同目录下三个 `*-source.png` 文件。每件的 `sourcePath`、`promptFile`、`postprocess`、源稿尺寸、交付 SHA256 和用户确认状态登记在 `assets/manifest.json`。源稿及交付稿的哈希位于 `CP2_ASSET_CHECKS.json`。此次生成仅使用文字提示词。

## 实际检查

| 检查 | 结果 |
| --- | --- |
| 内置 imagegen | 三个独立源稿生成成功 |
| 离线制作与逐像素断言 | 三件通过，64×64、透明留边、alpha 仅 0/255 |
| 固定色板 | 所有不透明像素均属于 V2 十色 |
| 生产构建 | `npm run build` 通过 |
| Node.js 测试 | `npm test`，11 项通过，0 失败 |
| 1440px 展示板 | 3 件素材、10 个色板色块、6 张图像全部加载 |
| 像素显示 | 原尺寸 64×64，四倍图 256×256，`image-rendering: pixelated` |
| 底色切换 | 三个窗口同步切换棋盘、深蓝与浅色 |
| PNG 下载 | 三件下载成功，文件 SHA256 与仓库文件一致 |
| 375px 窄窗口 | 页面宽度与滚动宽度均为 375px |
| 浏览器控制台 | 0 错误，0 警告 |
| 双直播源并发回归 | 两页同时打开，1920×1080、区域几何和透明根层通过 |

机器记录为 `CP2_ASSET_CHECKS.json` 和 `CP2_BROWSER_CHECKS.json`。深浅底色截图用于观察边缘残留，造型及透视的一致性属于美术验收。

## 截图

- [展示板](screenshots/cp2/asset-board.png)
- [深蓝底边缘检查](screenshots/cp2/dark-edges.png)
- [浅色底边缘检查](screenshots/cp2/light-edges.png)
- [375px 窄窗口](screenshots/cp2/narrow.png)

## 文件清单

- 三个交付 PNG、三个生图源稿和三份独立提示词。
- `assets/manifest.json`、`scripts/prepare-cp2-assets.ps1`。
- `src/AssetReview.tsx`、`src/asset-review.css` 和 `src/main.tsx` 的展示板入口及阶段标记。
- `server/index.mjs` 的展示板路由与阶段状态，`src/Admin.tsx` 的状态等待提示。
- `tests/runtime.test.mjs` 的阶段断言和展示板路由检查。
- `AGENTS.md`、`README.md`、`docs/PROJECT_SPEC.md`、`docs/DESIGN_SYSTEM.md`、`docs/ASSET_POLICY.md`、`docs/ARCHITECTURE.md`、`docs/CHECKPOINTS.md`、`docs/DECISIONS.md`、`docs/TEST_PLAN.md`、`docs/CP1_V2_REVIEW.md`。
- 本报告、两个 CP2 检查 JSON 和 `docs/screenshots/cp2/`。

本地快照使用标签 `checkpoint/cp2-assets`，提交号随聊天交付。用户确认状态全部为 `false`，当前等待 CP2 美术验收。
