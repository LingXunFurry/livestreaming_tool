# Windows 应用检查版

状态为 `WAITING_USER_REVIEW`。装潢已由用户通过，桌面应用等待本次用户检查后再上传 GitHub。

交付采用 Windows x64 免安装文件夹，入口为 `release/凌巽的酒馆-win32-x64/凌巽的酒馆.exe`，包含 Electron 45.2.3、已构建页面和 Python 3.14.3 桥接运行环境。整个文件夹一起使用。构建输出被 Git 忽略，代码和检查记录保存本地 Git 快照。

顶部菜单提供后台编辑、B 站/抖音实时预览、场景与素材预览、启动/停止/检查服务、复制直播源链接。后台沿用现有文本、字号、公告和音乐控制。实时预览窗口自动缩放 1920×1080 装修画面。

普通设置、备份与日志位于 `%APPDATA%/LingxunTavern/`。首次本机交付复制现有项目设置，原设置保留在 `data/`。应用运行资源和用户配置分开。

关闭应用可保留直播服务，也可停止服务并退出。再次打开时复用自己已运行的服务实例，端口冲突仍由统一运行入口报告。应用只加载本地页面，窗口隔离 Node 权限，服务仍仅监听回环地址。

## 实际检查

- 原服务与桥接从停止到启动，3000、18726 均先释放，重新启动后自动连接网易云，读到歌曲、歌手、暂停状态和歌词。
- 封装后的可执行程序在中文路径启动，自带 Python 的 Flask、pymem、requests、uiautomation 导入成功，自动启动桥接并收到真实歌曲与同步歌词。
- 原生应用后台修改今日委托并保存，实时 B 站预览收到更新；恢复原文本后刷新仍一致。
- 原生菜单打开实时画面、场景预览和独立素材页，页面无脚本错误。
- 通过后台真实播放/暂停按钮切换状态并回读，结束时恢复测试开始时的播放状态。
- 关闭窗口后保留服务，重新打开复用相同实例；选择停止并退出后健康端口释放。
- 构建通过，现有 24 项 Node.js 测试通过，生产依赖审计为 0 项漏洞，Git 差异检查通过。
- 自动隐藏回归采用明确的模拟 WebSocket 快照，每 500ms 更新一次；暂停 3 秒仍显示，5 秒后隐藏，恢复播放后立即显示。

机器记录为 `DESKTOP_COLD_START_CHECK.json`、`DESKTOP_APP_CHECKS.json` 与 `MUSIC_HIDE_CHECK.json`，截图为 `screenshots/desktop-admin.png` 和 `screenshots/desktop-art-preview.png`。

主要文件包括 `desktop/main.cjs`、`scripts/package-desktop.mjs`、`scripts/runtime.mjs`、`src/main.tsx`、`src/scene-review.css`、`assets/manifest.json`、本轮素材/布局/背景，以及上述规范和验证记录。

## 本机依赖与范围

网易云客户端需在本机安装和运行，当前验证对象为 Windows 网易云 3.1.41.205564。桥接沿用 `MUSIC_SETUP.md` 记录的第三方来源和本机依赖，包内携带其运行源码、来源说明及 Python/依赖许可证。客户端升级或第二台电脑需要重新验证。B 站互动继续等待官方授权，抖音固定使用公告。

构建命令为 `npm run package:desktop`。当前网络中 GitHub 下载返回 503，因此本次 Electron 二进制经 npmmirror 下载，并由 npm Electron 包内原始 SHA256 清单校验。需要同样镜像时，构建前设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 和 `ELECTRON_CUSTOM_DIR={{ version }}`。
