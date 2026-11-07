# 凌巽的酒馆

本地双平台直播装饰系统，使用 React、TypeScript、Vite 和 Node.js。
CP0 至 CP5 已通过验收；CP6 网易云播放与歌词功能等待用户验收。

## 首次初始化

安装 Node.js 22.12 或更新受支持版本，在项目目录运行一次 `npm ci`。正常启动过程中程序会按需构建网页资源。

## 日常入口

| 操作 | 中文入口 | 英文入口 |
| --- | --- | --- |
| 启动 | `启动直播间.bat` | `start.bat` |
| 关闭 | `关闭直播间.bat` | `stop.bat` |
| 状态 | `检查运行状态.bat` | `status.bat` |

脚本支持其他当前工作目录、中文路径和空格路径。启动后服务在后台运行，窗口可以关闭。重复启动复用现有实例。
默认三个页面如下，若修改端口，以启动器实际输出为准。

- B 站透明源为 <http://127.0.0.1:3000/live/bilibili>。
- 抖音透明源为 <http://127.0.0.1:3000/live/douyin>。
- 基础后台为 <http://127.0.0.1:3000/admin>。
- 线框预览为 <http://127.0.0.1:3000/preview>。
- CP2 素材展示板为 <http://127.0.0.1:3000/assets/review>。
- CP3 场景验收页为 <http://127.0.0.1:3000/scene/review>。

两个源均设为 1920×1080。游戏捕获由直播软件负责，游戏区域位于 X=40、Y=144，大小 1280×720。首次连接时在直播软件中把游戏源放到装修网页下层。

## 配置和日志

首次启动复制 `config/example.json` 的默认内容到 `data/settings.json`。修改 `server.port` 调整端口，修改 `server.openAdminOnStart` 控制启动时是否打开后台。配置由统一模块校验，保存使用原子替换及备份。

运行记录位于 `data/runtime/`，日志位于 `data/logs/`，设置备份位于 `data/backups/`。这些目录归本地用户数据管理。实际平台凭证后续与普通设置分开保存。

## 开发与验证

```powershell
npm run build
npm test
npm run test:migration
npm run start
npm run status -- --json
npm run stop
```

`npm run test:migration` 会在 `.cache/` 中创建含中文和空格的新目录，使用空缓存重新安装依赖，再实际调用 Windows 启动、状态和关闭入口。此项需要联网，测试服务结束后关闭。

开发热更新可用 `npm run dev`，地址为 `http://127.0.0.1:5173`。日常统一服务使用上方启动入口。开发页面的状态请求代理到本地 3000 端口。

## 规范与当前能力

项目要求见 `docs/PROJECT_SPEC.md`，固定视觉 Token 见 `docs/DESIGN_SYSTEM.md`，独立透明素材及用户原稿授权边界见 `docs/ASSET_POLICY.md`。
架构、运行、迁移、阶段、决策、测试和日常操作分别记录在 `docs/` 对应文件。

后台支持编辑两平台独立配置、底部公告和各区字号。CP6 使用单独运行的本机网易云桥接，安装和启动见 `docs/MUSIC_SETUP.md`；酒馆启动器不会自动启动该桥接。真实平台互动属于 CP7，实际直播客户端和第二台电脑等待 CP8 实机验收。

CP2 源稿、64×64 交付 PNG 和提示词分别位于 `assets/generated/cp2/`、`assets/prompts/cp2/`，清单位于 `assets/manifest.json`。离线制作命令 `pwsh -File scripts/prepare-cp2-assets.ps1` 通过 Windows 自带的 System.Drawing 统一像素与固定色板，并写出检查记录。日常服务直接使用已交付 PNG。验收结果和文件清单见 `docs/CP2_REVIEW.md`。

CP3 新素材及源稿位于 `assets/generated/cp3/`，完整生图提示词位于 `assets/prompts/cp3/`，无 UI 背景位于 `assets/backgrounds/cp3-tavern.png`。验收页可切换 UI、平台、歌词、参考线和透明区底色，并下载背景、独立 PNG 和布局 JSON。

修改 `assets/layouts/cp3-tavern.json` 中的 `layers` 后运行以下命令重组背景，再构建网页。`x`、`y` 使用最终画布像素坐标，`scale` 是 1–8 的整数，`rotation` 是 0/90/180/270，`repeat` 是可选的平铺区域宽高。图层按数组顺序绘制。画布和游戏窗口由脚本锁定为已验收尺寸。此文件属于离线美术配方，网页设置由现有配置模块管理。

```powershell
pwsh -File scripts/compose-cp3-scene.ps1
npm run build
```

重新处理 CP3 生图源稿时运行 `pwsh -File scripts/prepare-cp2-assets.ps1 -Checkpoint cp3`。脚本使用 Windows 自带的 System.Drawing。运行服务直接加载交付 PNG。实际检查及文件清单见 `docs/CP3_REVIEW.md`。

V2 前的美术草稿保存在本地 `data/backups/pre-v2-draft/`，旧规范保存在 `docs/history/`。
