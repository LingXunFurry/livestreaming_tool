# 网易云本地桥接

CP6 通过第三方 CloudMusic Local API 读取 Windows 网易云客户端。第三方源码不随项目分发，安装在 Git 忽略的 `.cache/` 内。

## 安装

需要 Windows、Git、Python 3.10 或更新版本及网易云桌面客户端。在项目根目录的 PowerShell 中执行：

```powershell
git clone https://github.com/hanbinhsh/NetEase_Cloud_Music_Local_API.git .cache/netease-bridge
git -C .cache/netease-bridge checkout 4efc61a733ad9939f21bd5c7211abb4b78078fe3
py -3 -m venv .cache/netease-venv
.\.cache\netease-venv\Scripts\python.exe -m pip install flask flask-cors pymem requests uiautomation
```

## 启动与使用

先启动网易云客户端，在后台“网易云音乐”勾选“启用本地网易云连接”，桥接地址使用 `http://127.0.0.1:18726` 并保存。之后运行酒馆启动脚本时会自动尝试启动已安装的桥接；在运行期间首次启用该设置也会尝试启动。两平台的歌词与自动隐藏选项分别设置；歌曲由同一本机播放器提供。

需要单独运行时，可在项目根目录执行：

```powershell
.\.cache\netease-venv\Scripts\python.exe scripts\music-bridge.py
```

保持该窗口运行，关闭窗口或按 Ctrl+C 会停止桥接。包装脚本仅监听 `127.0.0.1:18726`，并检查请求的 Host 和 Origin。

后台会显示连接、播放及歌词状态，并提供播放/暂停和切歌按钮。缺少依赖或端口已被占用时酒馆服务仍可使用；请检查安装、端口和后台状态及 `data/logs/runtime.log`。停止酒馆服务时只关闭由该服务启动的桥接，原先已运行的外部进程不会被关闭。非默认桥接地址需自行管理。

本次实测使用网易云 Windows 客户端 `3.1.41.205564` 和上述第三方提交。该工具依赖 Windows 客户端内部结构及内存偏移，客户端更新、权限或第三方依赖变化可能导致失效；更新后需要重新验证。第二台电脑的安装和兼容性尚未实测。
