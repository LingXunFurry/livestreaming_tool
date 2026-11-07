# 双平台独立弹幕接入调研

2026-11-07，香港时间。当前已完成文档核查，真实直播间连接等待接口阶段实测。

## 用户确认的模式

两个平台使用同一套背景、留言板排版和艺术字。B 站页面 `/live/bilibili` 显示 B 站事件，抖音页面 `/live/douyin` 显示抖音事件。每个平台单独保存直播间地址及适配器连接参数，分别管理状态和重连。后台修改一个平台的房间时，仅该平台重新连接。事件保留平台标识，两个页面的订阅分别过滤。

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

CP3 统一两平台留言板外观，并各自展示本平台静态示例。CP5 提供分平台房间和连接设置。CP7 根据可获得的官方权限或已核验的外部采集器，分别验证 B 站与抖音的真实消息、断线重连、重复消息和互不串台。连接成功以实际收到对应直播间事件为准。
