# CP6 验收记录

状态：`WAITING_USER_REVIEW`。CP0 至 CP5 已由用户通过；CP7 尚未开始。

## 交付

- 酒馆服务读取本地网易云桥接，向两个页面同步歌曲、进度与歌词；后台可播放/暂停、上一首、下一首。两平台独立配置歌词与暂停或未连接时自动隐藏。
- 保留双桌面，右桌改为各平台独立的“公告”，后台可编辑内容和字号。旧福利文字保留在旧配置中，但不会展示或自动迁移。
- 右栏固定显示留言板，旧右栏公告各自迁移到底部公告，保留现有底部内容、先备份且仅迁移一次。底部公告支持加粗与固定色板文字，最多显示两行。
- 自动启动已安装的默认本机网易云桥接；仅关闭由酒馆服务启动的桥接。安装、启动和限制见 `MUSIC_SETUP.md`。
- 复用已有像素素材丰富桌面和右栏，并放大原有标题图；新增美术调整等待用户验收。

## 实际检查

- `npm run check`、`npm run build`、`npm test`：通过，其中 Node.js 测试 23 项通过，包含公告迁移和桥接生命周期测试。
- 本机真实网易云客户端 `3.1.41.205564`、第三方桥接提交 `4efc61a733ad9939f21bd5c7211abb4b78078fe3`：读取真实曲目及 99 行歌词，播放进度增长，暂停后进度不变，下一首及上一首成功。原始记录见 `CP6_REAL_MUSIC_CHECKS.json`。
- Playwright 使用隔离服务与模拟协议桥接：1920×1080 双平台公告和字号隔离、像素标题、布局、暂停隐藏、播放和切歌、无歌词、协议异常及恢复、刷新后保存；375px 宽后台无横向溢出，页面无脚本异常。音乐操作在此组检查中作用于模拟桥接，不代表真实平台测试。
- 截图：`screenshots/cp6/bilibili.png`、`douyin.png`、`bilibili-paused.png`、`no-lyrics.png`、`admin-narrow.png`。截图内容使用测试文案。
- 追加隔离浏览器测试：后台保存、两平台公告隔离、加粗及颜色渲染、WebSocket 实时更新、刷新恢复和右栏留言板通过。新截图为 `screenshots/cp6/announcement-update.png`、`art-update-preview.png`、`art-update-mobile.png`，使用测试或预览内容。
- 背景合成检查游戏区完全透明及固定色板；TokenFlux 生图请求返回流内错误，本轮未采用新生成素材。

## 文件

主要实现：`server/music.mjs`、`server/music-bridge.mjs`、`server/index.mjs`、`server/config.mjs`、`scripts/music-bridge.py`、`scripts/runtime.mjs`、`src/MusicPanel.tsx`、`src/music.ts`、`src/Admin.tsx`、`src/Overlay.tsx`、`src/main.tsx` 和样式；场景配方及背景、配置示例、测试、规范和截图随检查点提交。个人设置、第三方源码和 Python 环境不提交。

## 尚未验证

真实 B 站和抖音互动属于 CP7；直播客户端加载、第二台电脑迁移和长期稳定性属于 CP8。第三方桥接依赖 Windows 网易云客户端内部结构，版本变化可能需要适配。
