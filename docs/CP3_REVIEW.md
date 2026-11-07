# V2 CP3 酒馆场景返修验收

2026-11-07，香港时间。当前状态为 `WAITING_USER_REVIEW`。

## 当前预览

公告组件追加预览已完成。2026-11-07 用户要求改用内置 imagegen，参照本项目现有栏目标题生成“酒馆公告 / ANNOUNCEMENT”，并将生成艺术字的视觉字号调整到与留言板相同一档。交付图为 288×96，标题容器为 80px 高，按可见轮廓消除 25px 左透明留边。

在场景验收页的“右栏预览”中选择酒馆留言板或酒馆公告，两者互斥显示。两平台的预览选择分别记录在页面查询参数中，刷新可恢复。公告正文使用临时示例文案，后台公告编辑、持久化与真实平台数据按 CP5、CP7 验收。

[公告组件预览](http://127.0.0.1:3000/scene/review?bilibiliBoard=announcement)

本次实际检查包括生产构建、11 项已有测试、两平台与评论/公告及歌词开/关共八种预览组合。所有组合的面板几何、互斥显示、标题左对齐和正文无溢出通过。两平台选择隔离、刷新恢复、UI 隐藏、375px 窄窗口、素材下载 SHA256 和中文字体覆盖检查通过。两直播源的四种平台/歌词组合回归通过，浏览器错误为零。

13 件 CP3 PNG 的最近邻采样、色板和二值透明检查通过，原有 12 件素材输出和记录数值一致。新公告标题包含 15,751 个全透明像素和 11,897 个不透明像素，可见轮廓为 (25,21,243,66)。检查数据见 `CP3_ASSET_CHECKS.json` 和 `CP3_ANNOUNCEMENT_CHECKS.json`。

追加文件为 `assets/generated/cp3/announcement-wordmark.png`、同名 `-source.png`、`assets/prompts/cp3/announcement-wordmark.md`、`CP3_ANNOUNCEMENT_CHECKS.json` 及下列截图。更新 `assets/manifest.json`、`src/Overlay.tsx`、`src/main.tsx`、`src/scene-review.css`、产品/视觉/素材/架构/检查点规范和本报告。提示词、输入参考、生成来源及待验收状态随清单保存。本地快照标签为 `checkpoint/cp3-announcement`，状态为 `WAITING_USER_REVIEW`。

- [公告叠加预览](screenshots/cp3/announcement-ui.png)
- [公告歌词关闭](screenshots/cp3/announcement-ui-lyrics-off.png)
- [公告验收页面](screenshots/cp3/announcement-review-page.png)
- [公告窄窗口](screenshots/cp3/announcement-narrow.png)

本轮追加双平台外观统一，抖音由任务公告改为与 B 站相同样式的留言板。两端各自展示本平台静态示例，分别保留专属路由。真实房间地址设置和采集连接按 CP5、CP7 验收，方案与当前接入限制见 `DANMAKU_SOURCES.md`。

[CP3 场景验收页](http://127.0.0.1:3000/scene/review)

本轮重做梁架与吧台组合，左右上角采用不同陈设，并制作三份独立标题图。留言板和播放区的中英文艺术字共同生成为透明图像，英文较小并与中文做轻微前后叠压。栏目正文使用本地 Fusion Pixel Font 10px 简中比例版。

右上陈设的可见宽度为 484px，最右端与留言板的 x=1880 对齐。留言板移除“02 / 留言”，艺术字上移并重新安排评论间距。留言板与播放区字样分别消除 15px、11px 的透明左留边，使可见左端对齐正文起始线 x=1384。吧台以三段同源素材延长中间木面，可见两端精确落在 x=40、x=1320。木框四条内边紧贴 (40,144,1280,720) 游戏窗口。

本版以六种底层模块、十二个图层组合无 UI 背景。吧台采用下缘延伸出画的构图，底部 40px 在画布外。主标题图按 384×128 像素置于 (768,12)，标题容器、右栏、歌词区及今日委托的 CP1 几何经过复核。

## 返修独立素材

| 素材 | 交付 PNG | 逻辑尺寸 |
| --- | --- | --- |
| 凌巽的酒馆 | `assets/generated/cp3/tavern-wordmark.png` | 384×128 |
| 梁架与悬挂陈设 | `assets/generated/cp3/tavern-canopy.png` | 320×80 |
| 连贯吧台与供酒陈设 | `assets/generated/cp3/tavern-counter.png` | 640×128 |
| 右上酒桶挂杯陈设 | `assets/generated/cp3/tavern-right-rack.png` | 256×80 |
| 酒馆留言板 / COMMENT | `assets/generated/cp3/comment-wordmark.png` | 288×96 |
| 正在播放 / NOW PLAYING | `assets/generated/cp3/playing-wordmark.png` | 240×80 |

使用内置 imagegen。六组完整提示词位于 `assets/prompts/cp3/` 的上述同名 Markdown 文件。生成源稿保存为对应 `*-source.png`，中英文组合字的原始中文输入保存为 `*-input.png`。来源、尺寸、SHA256 和待验收状态均登记在 `assets/manifest.json`。

素材经最近邻采样、V2 十色映射及二值 alpha 处理。背景位于 `assets/backgrounds/cp3-tavern.png`，离线布局位于 `assets/layouts/cp3-tavern.json`。`sourceRegion` 指定图层裁切矩形，吧台重复一段 10px 逻辑宽度的中间木面以精确延长，保持整数像素放大。

## 实际检查

| 检查 | 结果 |
| --- | --- |
| `npm run build` | 通过 |
| `npm test` | 11 项通过 |
| 十二件 CP3 独立 PNG | 固定十色、真实透明留边、0/255 alpha 通过 |
| 背景逐像素扫描 | 1920×1080，游戏区 921,600 像素全透明，其余区域不透明且属于固定十色 |
| 木框与吧台对齐 | 游戏相邻 4,000 个像素均为不透明木梁颜色，吧台可见跨度为 [40,1320) |
| 右上陈设 | 可见跨度为 [1396,1880)，全部可见内容位于顶栏 144px 高度内 |
| 字体覆盖 | 官方同版 OTF 的 25,910 字形映射中，当前中文标题及示例文案均有字形 |
| 字体加载与许可 | 本地 WOFF2 加载成功，四份许可链接可访问并随构建打包 |
| CP2 处理脚本回归 | 默认命令实际运行，三件已验收 PNG 哈希一致 |
| 配方复现 | 移动物件后哈希改变，恢复配方后与交付背景哈希一致 |
| 非法配置 | 八类非法布局及四类非法源区域被拒绝，已有输出保留 |
| 浏览器场景 | Edge 中 B 站/抖音和歌词开/关四种组合通过 |
| 双平台外观和示例 | 两端背景和标题样式一致，各自专属路由只展示本平台静态示例，四种组合通过 |
| 排版 | 四种组合的面板内容完整，今日委托和歌词文字处于容器内 |
| 下载 | 十二件素材及背景共十三个 PNG 的 SHA256 与仓库一致，布局 JSON 一致 |
| 375px 窄窗口 | 页面滚动宽度为 375px |
| 正式源并发回归 | 两源并发，四种平台/歌词组合的 CP1 几何和透明根层通过 |
| 浏览器错误 | 0 |

机器记录为 `CP3_ASSET_CHECKS.json`、`CP3_SCENE_CHECKS.json`、`CP3_ALIGNMENT_CHECKS.json`、`CP3_RECIPE_CHECKS.json`、`CP3_FONT_CHECKS.json`、`CP3_REVISION_BROWSER_CHECKS.json`。

## 截图

- [B 站最终叠加](screenshots/cp3/revision-bilibili-ui.png)
- [抖音最终叠加](screenshots/cp3/revision-douyin-ui.png)
- [B 站歌词关闭](screenshots/cp3/revision-bilibili-ui-lyrics-off.png)
- [抖音歌词关闭](screenshots/cp3/revision-douyin-ui-lyrics-off.png)
- [无 UI 背景](screenshots/cp3/revision-background-only.png)
- [完整验收页](screenshots/cp3/revision-review-page.png)
- [375px 窄窗口](screenshots/cp3/revision-narrow.png)

## 文件清单

- 六件返修 PNG、六件源稿、两件中文输入稿，位于 `assets/generated/cp3/`。
- 六份返修提示词，位于 `assets/prompts/cp3/`。
- `assets/fonts/fusion-pixel/` 中的 WOFF2、OFL、三份上游许可及来源记录。
- `assets/layouts/cp3-tavern.json`、`assets/backgrounds/cp3-tavern.png`、`assets/manifest.json`。
- `scripts/prepare-cp2-assets.ps1`、`scripts/compose-cp3-scene.ps1`。
- `src/Overlay.tsx`、`src/main.tsx`、`src/scene-review.css`。
- `AGENTS.md`、`README.md`、`docs/V2_BRIEF.md`、`docs/PROJECT_SPEC.md`、`docs/DESIGN_SYSTEM.md`、`docs/ASSET_POLICY.md`、`docs/ARCHITECTURE.md`、`docs/CHECKPOINTS.md`、`docs/DECISIONS.md`、`docs/TEST_PLAN.md`。
- 本报告、六份机器检查记录和七张返修截图。
- `docs/DANMAKU_SOURCES.md` 记录抖音官方及第三方接入方式、来源链接和待实测条件。

美术返修快照标签为 `checkpoint/cp3-revision`，双平台外观统一的追加快照为 `checkpoint/cp3-platforms`，提交号由聊天交付。下一检查点等待用户明确验收。直播客户端的透明显示和音画捕获等待 CP8 实机验收。
