# V2 CP3 模块化酒馆场景验收

2026-11-07，香港时间。状态为 `WAITING_USER_REVIEW`。CP0、CP1、CP2 已由用户验收通过。

## 交付与预览

场景验收页位于 <http://127.0.0.1:3000/scene/review>。页面提供 UI、平台、歌词、参考线和透明区底色切换，以及背景、物件与布局 JSON 下载。

六件新增模块分别通过内置 imagegen 使用文字提示词生成，再与 CP2 酒杯、木桌、蜡烛通过离线配方组合。原始源稿、提示词、独立交付 PNG、素材清单、布局与背景随项目保存。本阶段使用九个独立模块、18 个图层。游戏窗口位于 (40,144)，尺寸为 1280×720。

| 新增模块 | 文件 | 逻辑尺寸 | 透明像素 |
| --- | --- | --- | --- |
| 木墙纹理 | `assets/generated/cp3/tavern-wall-tile.png` | 64×64 | 0，底层平铺纹理 |
| 木地板纹理 | `assets/generated/cp3/tavern-floor-tile.png` | 64×64 | 0，底层平铺纹理 |
| 横向木梁 | `assets/generated/cp3/timber-beam.png` | 128×32 | 2524 |
| 挂灯 | `assets/generated/cp3/hanging-lantern.png` | 32×64 | 1360 |
| 酒瓶架 | `assets/generated/cp3/bottle-shelf.png` | 128×64 | 5386 |
| 酒桶 | `assets/generated/cp3/barrel.png` | 64×64 | 2005 |

无 UI 背景为 `assets/backgrounds/cp3-tavern.png`。可编辑布局为 `assets/layouts/cp3-tavern.json`。资产来源、提示词、源稿尺寸和 SHA256 位于 `assets/manifest.json`。CP2 三件标记为 `APPROVED`，CP3 新模块和组合背景标记为 `WAITING_USER_REVIEW`。

## 制作决定与待验收内容

全部交付 PNG 通过最近邻采样、固定十色映射和 0/255 alpha 处理。木墙把木棕映射到深蓝和石板蓝，以满足固定主题。纹理的末行、末列复制对应起始边像素，使边界一致。源稿完整保留，交付图的细节密度及重复纹理观感等待用户验收。

物件的位置、尺寸与重复方式属于本轮制作方案。场景预览将原有 CP1 UI 显示为深蓝 RPG 面板，透明标题区暂用金色系统楷体。正式五字艺术字需要独立制作和验收，系统字体的实际外观会受电脑安装字体影响。

## 实际检查

| 检查 | 结果 |
| --- | --- |
| 内置 imagegen | 六件独立源稿生成成功 |
| 六件模块尺寸、色板及 alpha | 通过，所有不透明像素属于 V2 十色，alpha 仅 0/255 |
| 纹理对边 | 横、纵对应边像素一致 |
| 背景逐像素扫描 | 1920×1080，921,600 个透明像素均位于游戏窗口，其他区域全部不透明且属于 V2 色板 |
| 离线配方重组 | 移动酒桶后背景哈希改变，恢复原配方后哈希一致 |
| 非法配方 | 改动游戏窗口、未知资产、非整数比例、负坐标、越界区域均被拒绝，原背景文件保留 |
| CP2 脚本回归 | 三件交付 PNG 的 SHA256 与已验收版本一致 |
| `npm run build` | 通过 |
| `npm test` | 11 项通过，0 失败 |
| Edge 桌面预览 | 背景及六件独立素材加载成功，素材以 2× 最近邻显示 |
| UI 与平台开关 | UI 可隐藏，B 站及抖音内容正确，歌词关闭后主面板扩展到 528×856 |
| 八项下载 | 六件 PNG 和背景哈希与仓库一致，布局 JSON 内容一致 |
| 375px 窄屏 | 页面滚动宽度等于 375px，无横向溢出 |
| 两个直播源并发 | 两个源同时打开，平台与歌词开关共四种状态的 CP1 几何和透明根层检查通过 |
| 浏览器日志 | 检查过程 0 错误、0 警告 |
| 服务实际状态 | `RUNNING`，检查点 CP3，页面与 WebSocket 可用 |

机器记录为 `CP3_ASSET_CHECKS.json`、`CP3_SCENE_CHECKS.json`、`CP3_RECIPE_CHECKS.json`、`CP3_BROWSER_CHECKS.json`。

## 截图

- [无 UI 背景，棋盘用于显示透明区](screenshots/cp3/background-only.png)
- [B 站 UI 叠加](screenshots/cp3/bilibili-ui.png)
- [抖音 UI 叠加](screenshots/cp3/douyin-ui.png)
- [抖音歌词关闭](screenshots/cp3/douyin-ui-lyrics-off.png)
- [完整验收页与独立素材](screenshots/cp3/review-page.png)
- [375px 窄屏](screenshots/cp3/narrow.png)

## 调整场景

修改 `assets/layouts/cp3-tavern.json` 的 `layers` 后运行以下命令。

```powershell
pwsh -File scripts/compose-cp3-scene.ps1
npm run build
```

`x`、`y` 为最终画布像素，`scale` 为 1–8 的整数倍。`rotation` 支持 0/90/180/270，`repeat` 指定可选平铺区域的宽高。图层按数组顺序绘制。脚本在暂存文件通过像素校验后替换交付背景。该配方用于离线制作，运行服务加载已生成的 PNG。

重新处理源稿可运行 `pwsh -File scripts/prepare-cp2-assets.ps1 -Checkpoint cp3`。制作脚本依赖 Windows 自带的 System.Drawing。服务运行依赖现有 Node.js 环境。

## 文件清单

- 六件交付 PNG、六件 `*-source.png`，位于 `assets/generated/cp3/`。
- 六份独立提示词，位于 `assets/prompts/cp3/`。
- `assets/backgrounds/cp3-tavern.png`、`assets/layouts/cp3-tavern.json`、`assets/manifest.json`。
- `scripts/compose-cp3-scene.ps1`、`scripts/prepare-cp2-assets.ps1`。
- `src/main.tsx`、`src/scene-review.css`、`src/AssetReview.tsx`、`src/Admin.tsx`。
- `server/index.mjs`、`tests/runtime.test.mjs`。
- `AGENTS.md`、`README.md`、`docs/PROJECT_SPEC.md`、`docs/DESIGN_SYSTEM.md`、`docs/ASSET_POLICY.md`、`docs/ARCHITECTURE.md`、`docs/CHECKPOINTS.md`、`docs/DECISIONS.md`、`docs/TEST_PLAN.md`、`docs/CP2_REVIEW.md`。
- 本报告、四份 CP3 检查 JSON、六张截图，位于 `docs/` 与 `docs/screenshots/cp3/`。

本地快照使用标签 `checkpoint/cp3-background`，提交号随聊天交付。下一检查点需用户明确批准。直播客户端透明显示、音画捕获与新电脑迁移留待 CP8 实机验收。
