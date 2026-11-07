# CP6 验收记录

状态：`WAITING_USER_REVIEW`。CP0 至 CP5 已由用户通过；CP7 尚未开始。

## 交付

- 酒馆服务读取本地网易云桥接，向两个页面同步歌曲、进度与歌词；后台可播放/暂停、上一首、下一首。两平台独立配置歌词与暂停或未连接时自动隐藏。
- 保留双桌面，右桌改为各平台独立的“公告”，后台可编辑内容和字号。旧福利文字保留在旧配置中，但不会展示或自动迁移。
- 右侧“酒馆公告”标题改用本地像素字体，保留主标题和其他已验收艺术字。原公告图片保留作历史素材。
- 桥接安装、启动和限制见 `MUSIC_SETUP.md`；桥接是独立进程，酒馆启动器不会自动启动它。

## 实际检查

- `npm run check`、`npm run build`、`npm test`：通过，其中 Node.js 测试 20 项通过。
- 本机真实网易云客户端 `3.1.41.205564`、第三方桥接提交 `4efc61a733ad9939f21bd5c7211abb4b78078fe3`：读取真实曲目及 99 行歌词，播放进度增长，暂停后进度不变，下一首及上一首成功。原始记录见 `CP6_REAL_MUSIC_CHECKS.json`。
- Playwright 使用隔离服务与模拟协议桥接：1920×1080 双平台公告和字号隔离、像素标题、布局、暂停隐藏、播放和切歌、无歌词、协议异常及恢复、刷新后保存；375px 宽后台无横向溢出，页面无脚本异常。音乐操作在此组检查中作用于模拟桥接，不代表真实平台测试。
- 截图：`screenshots/cp6/bilibili.png`、`douyin.png`、`bilibili-paused.png`、`no-lyrics.png`、`admin-narrow.png`。截图内容使用测试文案。

## 文件

主要实现：`server/music.mjs`、`server/index.mjs`、`server/config.mjs`、`scripts/music-bridge.py`、`scripts/runtime.mjs`、`src/MusicPanel.tsx`、`src/music.ts`、`src/Admin.tsx`、`src/Overlay.tsx`、`src/main.tsx` 和样式。配置示例、测试、规范、运行说明、截图和本报告随检查点提交；个人设置、第三方源码和 Python 环境不提交。

## 尚未验证

真实 B 站和抖音互动属于 CP7；直播客户端加载、第二台电脑迁移和长期稳定性属于 CP8。第三方桥接依赖 Windows 网易云客户端内部结构，版本变化可能需要适配。
