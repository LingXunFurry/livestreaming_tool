# 凌巽的酒馆

本地双平台直播装饰系统，使用 React、TypeScript、Vite 和 Node.js。
CP0 已通过验收，当前复核 V2 CP1 横屏线框。活动页面保持无背景灰度线框，已确认的布局位置和比例不变，美术等待后续独立验收。

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

CP0 提供统一运行管理、健康接口、基础状态 WebSocket、双平台透明测试页和只读系统后台。完整管理编辑、真实网易云与 B 站事件分别在后续检查点实现。实际直播姬、抖音直播伴侣和第二台电脑等待 CP8 实机验收。

V2 前的美术草稿保存在本地 `data/backups/pre-v2-draft/`，旧规范保存在 `docs/history/`。本轮工作完成后停止等待 CP1 验收。
