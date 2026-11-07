# V2 CP0 验收报告

交付日期为 2026-11-07，香港时间。阶段状态为 `WAITING_USER_REVIEW`。

## 本次修正

完整读取 V2 任务书后，将当前范围收回到 CP0。保留 React、TypeScript 和 Vite，加入一个 Node.js HTTP/WebSocket 服务，以及统一运行入口、配置模块和日志。

活动直播页恢复无背景灰度线框，保持历史已确认的游戏窗口和右栏比例。美术草稿备份到本地 `data/backups/pre-v2-draft/`，此前根目录规范移入 `docs/history/`，当前根目录保留规范导航入口。V2 固定 Token 已写入设计系统。资产清单为空，当前运行资源使用线框。

## 规范文件

以下文件均有实际内容。

| 文件 | 内容 |
| --- | --- |
| `AGENTS.md` | 当前 CP0 范围、每次必读规范、用户确认与阶段边界 |
| `README.md` | 初始化、日常三个入口、配置与验证命令 |
| `docs/PROJECT_SPEC.md` | 双平台、横屏、产品边界、已确认布局 |
| `docs/DESIGN_SYSTEM.md` | V2 十个固定 Token、像素尺度、字体和风格 |
| `docs/ASSET_POLICY.md` | 独立透明素材、三个美术样板、用户原稿授权 |
| `docs/ARCHITECTURE.md` | 单服务路由、WebSocket、配置与适配器边界 |
| `docs/RUNTIME.md` | 生命周期、后台进程、锁、端口、状态、日志与恢复 |
| `docs/MIGRATION.md` | 开发版迁移、数据保留、便携发行版目标和验收 |
| `docs/CHECKPOINTS.md` | V2 阶段划分和当前验收状态 |
| `docs/DECISIONS.md` | 历史确认、V2 新决定和本次恢复线框的记录 |
| `docs/TEST_PLAN.md` | 各阶段的自动化及实机检查 |
| `docs/OPERATIONS.md` | 启动、关闭、更新、备份、诊断和迁移 |

V2 原任务书另保存于 `docs/V2_BRIEF.md`。

## 日常运行

首次安装 Node.js 22.12 或更新受支持版本，执行一次 `npm ci`。之后双击 `启动直播间.bat`，或使用英文入口 `start.bat`。启动器检查配置和文件，按需构建网页并等待实际就绪。服务在独立后台进程运行。

关闭使用 `关闭直播间.bat` 或 `stop.bat`。状态检查使用 `检查运行状态.bat` 或 `status.bat`。JSON 输出可在英文入口之后传入 `--json`。

| 页面或接口 | 当前实际地址 |
| --- | --- |
| B 站透明测试页 | <http://127.0.0.1:3000/live/bilibili> |
| 抖音透明测试页 | <http://127.0.0.1:3000/live/douyin> |
| 基础系统后台 | <http://127.0.0.1:3000/admin> |
| 线框预览 | <http://127.0.0.1:3000/preview> |
| 就绪检查 | <http://127.0.0.1:3000/health> |
| 实际运行状态 | <http://127.0.0.1:3000/api/runtime/status> |

服务当前监听本机 127.0.0.1，端口为 3000。配置可调整端口，所有页面 URL 随实际端口输出。普通设置位于 `data/settings.json`，进程记录位于 `data/runtime/`，日志位于 `data/logs/`。

## 实际验证结果

| 检查 | 结果 |
| --- | --- |
| TypeScript 与 Vite 构建 | 通过 |
| Node.js 自动化测试 | 11 项通过，0 失败 |
| 启动、就绪、重复启动复用实例 | 通过 |
| 两个启动命令并发执行 | 通过，仅一个服务实例 |
| 两个直播页和后台并发 HTTP 访问 | 通过 |
| 实际 WebSocket 快照与关闭码 1001 | 通过 |
| 正常关闭、端口释放、重复关闭 | 通过 |
| 端口被无关服务占用 | 返回 ERROR，无关服务继续运行 |
| 失效启动锁及进程记录 | 通过恢复测试 |
| 非法配置 | 返回 ERROR |
| 已启用但尚未接入的适配器 | 返回 DEGRADED，基础页面可访问 |
| 配置校验、并发保存、原子替换和备份 | 通过 |
| 日志大小轮换与敏感字段过滤 | 通过 |
| 无控制令牌的停止请求、跨来源停止请求 | 被拒绝 |
| 运行状态中的令牌与绝对路径检查 | 未暴露 |
| 静态目录边界与未知 API | 正确返回拒绝或未找到 |
| 含中文和空格的新目录、空缓存安装 | 通过 |
| 从其他当前目录调用三个中文 Windows 入口 | 通过 |
| 新目录配置标题读取 | 通过，读取迁移验收酒馆 |
| 当前项目英文入口启动、停止、状态 | STOPPED → RUNNING，三页及 WebSocket 可访问 |
| 浏览器中两个源的画布、透明区与控件隔离 | 通过 |
| 后台断开与自动重连 | 停服显示 ERROR，重启恢复 RUNNING 与 CONNECTED |

浏览器源保持 1920×1080，游戏区无装饰交叠。html、body、root 和装饰主层背景均透明。JPG 截图会将透明区域合成为白色，透明性由页面背景及几何检查另行核实。

## 证据与截图

- 运行入口记录位于 `CP0_RUNTIME_CHECK.json`。
- 中文与空格目录迁移记录位于 `CP0_MIGRATION_CHECK.json`。
- 浏览器与重连检查位于 `CP0_BROWSER_CHECKS.json`。
- [系统后台截图](screenshots/cp0/admin.jpg)
- [B 站透明测试页截图](screenshots/cp0/bilibili-source.jpg)
- [抖音透明测试页截图](screenshots/cp0/douyin-source.jpg)

## 环境依赖和交付边界

开发版依赖 Node.js 与 npm。首次安装和空缓存迁移测试需要网络下载锁定依赖。日常运行采用本地构建产物和一个 Node.js 服务。

后台目前是只读系统状态页。完整设置编辑、场景控制、业务状态同步与持久化交互属于 CP5。基础配置模块和运行状态 WebSocket 已实现。

网易云适配器显示 `DISCONNECTED`，B 站事件显示 `NOT_CONFIGURED`，真实接入分别在 CP6 和 CP7。Windows 安装程序、捆绑运行环境的免安装发行版和自动守护属于后续工作。

本次迁移结果覆盖当前 Windows 电脑的新目录。第二台电脑、直播姬、抖音直播伴侣、音频和游戏捕获、长时间直播稳定性等待 CP8 实机验收。

## 修改文件范围

- 规范与历史保存，包括 `AGENTS.md`、`README.md`、根目录导航文件、`docs/` 规范和验收记录。
- 运行代码包括 `server/config.mjs`、`server/logger.mjs`、`server/index.mjs`、`scripts/runtime.mjs` 和 `scripts/verify-migration.mjs`。
- Windows 三个中文与三个英文入口，以及旧预览入口的兼容转接。
- `config/example.json`、空 `assets/manifest.json`、目录边界、依赖锁文件和忽略规则。
- 前端基础后台、灰度线框恢复和开发代理设置。
- 配置、日志与运行管理测试，以及 CP0 实际截图。

## 版本与下一步

本次使用本地标签 `checkpoint/cp0-runtime` 标记，精确提交号在聊天交付中给出，也可执行 `git rev-parse checkpoint/cp0-runtime` 查询。

当前停止等待 CP0 确认。下一步 CP1 复核已确认的 1280×720 游戏区、528px 右栏、标题和委托位置，检查 V2 统一服务下的两端线框。美术仍单独验收，后续 CP2 从酒杯、木桌、蜡烛三个独立透明像素样板开始。
