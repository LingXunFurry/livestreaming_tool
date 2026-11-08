# 装潢追加记录

状态为 `APPROVED`。2026-11-08 用户确认当前效果可用并要求继续。

四件新生成的像素模块分别为留言板框、播放框、留声机、左桌地图账本。酒桶架复用原生成源稿，以更大逻辑尺寸归一化。标题上新增的窗龛已按反馈移除。

左桌陈设的不透明底边位于 y=942，与桌沿接触。右上酒桶架承托横板下边位于 y=152，与公告框中段上边接触。播放框下移 24px 至 y=768，留声机底座叠在播放框上沿，喇叭允许覆盖少量公告框底边。

歌曲信息和歌词采用 1.4 行高，修复英文下伸笔画裁切。20px 和最大 24px 下的文字边界与面板内布局均经过浏览器断言。

素材使用内置 imagegen 生成，提示词位于 `assets/prompts/cp3-art/`，源稿和归一化素材位于 `assets/generated/cp3-art/`。放大酒桶架沿用 `assets/prompts/cp3/tavern-right-rack.md` 和对应既有源稿。素材来源、尺寸和摘要登记在 manifest。

实际验证包括五件素材固定十色与二值 alpha、1920×1080 背景、游戏区 921,600 个透明像素、双平台留言/公告及歌词开/关共八种预览组合、最新消息可见性、375px 页面无横向溢出、歌曲信息与歌词最大字号。

检查记录为 `CP3-ART_ASSET_CHECKS.json`、`CP3-ART_SCENE_CHECKS.json` 和 `CP3-ART_BROWSER_CHECKS.json`。截图为 `screenshots/art-revision-*.png` 及 `screenshots/music-descenders-fixed.png`。
