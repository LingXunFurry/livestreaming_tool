# 双平台独立弹幕接入调研

2026-11-07，香港时间。当前已完成文档核查，真实直播间连接等待接口阶段实测。

## 用户确认的模式

两个平台使用同一套背景和装饰。B 站页面 `/live/bilibili` 保留官方互动接入位置，未获授权时显示公告；抖音页面 `/live/douyin` 固定显示公告，不再接入第三方弹幕。

直播间地址用于选择采集目标，网页源地址用于直播软件加载装饰画面。接入时需要将各平台原始数据解析为本项目事件格式，再投递至对应页面。

## 抖音可获取弹幕的方式

### 官方直播互动工具

官方文档列有全量评论、用户昵称/ID 等能力。当前接入指南页首注明暂时停止新插件准入，因此本项目能否获得权限仍需实际申请结果确认。涉及网络请求的互动工具另有抖音云部署要求，需结合最终工具形态确认适用条件。

[互动工具接入指南](https://partner.open-douyin.com/docs/resource/zh-CN/live-interactive-tools/introduction/interactive-tools-guide)

[直播互动工具接入抖音云指南](https://partner.open-douyin.com/docs/resource/zh-CN/live-interactive-tools/development/douyin-cloud/live-interaction-guide-dycloud)

官方直播小玩法的评论能力用于挂载玩法后的特殊评论指令，并有形态及提案要求，选择方案时需核对其适用范围。

[直播间评论互动能力](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/jierushuoming/hudongshuju/pinglunshuju/)

[直播玩法简介](https://partner.open-douyin.com/docs/resource/zh-CN/interaction/introduction/live-play/1)

### 第三方采集工具

`saermart/DouyinLiveWebFetcher` 的作者提供网页版直播弹幕与互动消息采集实现，README 记有 2026-08-26 的成功测试记录。仓库标记 AGPL-3.0，README 同时提出学习研究及商业使用相关声明，后续选型需核对这些条款。该项目可证明存在技术实现路径，其在本机和目标直播间的可用性仍需实测。平台接口或签名变化会影响可用性。

[项目原始仓库、README 及许可](https://github.com/saermart/DouyinLiveWebFetcher)

## 本项目的阶段安排

2026-11-08 用户提供 B 站分享链接，解析得到 `https://live.bilibili.com/14041317`；目前未确认获得 B 站开放平台授权。抖音分享短链和网页端连接测试均不能形成可靠的第三方接入，项目停止使用 Dycast。

用户随后提供网页端抖音地址 `https://live.douyin.com/523485074400` 并授权测试。Dycast 显示连接失败，项目随后出现 403；没有收到真实事件，因此不保留其转发地址、房间配置或运行状态。

基于上述结果，项目删除 Dycast 转发端点和规范化链路，抖音页面只保留公告展示。

B 站页面继续保留独立房间配置，但因尚未获得官方开放平台授权，状态显示为等待授权并自动使用公告，暂不把第三方库或网页抓取当作正式适配器。

CP3 统一两平台酒馆装饰。CP7 只等待 B 站官方授权；在授权前不显示模拟留言，抖音不再尝试第三方弹幕。
