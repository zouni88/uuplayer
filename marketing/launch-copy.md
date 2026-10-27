# uuplayer 发布文案包

> 平台各有一篇，直接复制可用。发布前请确认：
> 1. GitHub Releases 已挂上 v1.0.0 安装包（链接是所有文案的落点）
> 2. 文中截图位建议换成**真实软件截图**，比示意图可信得多
> 3. 落地页部署后（Settings → Pages → main 分支 /docs），把「在线预览」链接换成实际 Pages 地址

- 仓库：https://github.com/zouni88/uuplayer
- 下载：https://github.com/zouni88/uuplayer/releases
- 一句话介绍：uuplayer —— 参照 QQ影音 体验设计的 Windows 本地视频播放器，内置 mpv + FFmpeg 内核，全格式通吃，纯离线，开源免费。

---

## 一、V2EX（节点：分享创造）

**标题**：折腾了一个本地视频播放器 uuplayer：Tauri 2 + mpv，参照 QQ影音 的思路做的，求轻喷

**正文**：

各位好，分享一个最近做完的小工具。

起因是现在市面上的播放器，要么广告多，要么越来越重，要么就是界面上塞满了用不到的东西。就很怀念当年 QQ影音 那种：打开、播放、结束，干干净净。索性自己写了一个，叫 uuplayer，Windows 本地播放器，现在 v1.0.0，开源在 GitHub：

仓库：https://github.com/zouni88/uuplayer
下载：https://github.com/zouni88/uuplayer/releases

几个设计决定说一下：

1. 解码不自己造轮子，直接内置 mpv（FFmpeg 8.x），格式支持和稳定性都是现成的，还带 --hwdec=auto-safe 硬解。为了便携，mpv.exe 和依赖 DLL 全部打包进应用，免安装。
2. 视频画面渲染用的是 Win32 子窗口方案：Rust 侧在主窗口里创建一个子窗口压在 z-order 底部，把句柄通过 --wid 交给 mpv 渲染；UI 是透明 WebView 悬浮在上面，控制栏、OSD、播放列表全是 React 自绘的。
3. 进程间通信用的是 Windows 命名管道上的 JSON IPC，mpv 属性变化（时间、音量、轨信息）实时广播给前端。
4. 桌面壳是 Tauri 2 + Rust，包体和内存占用都比 Electron 方案好看不少。

功能上：全格式 + HLS/RTSP 网络流、多音轨字幕轨切换、外挂字幕模糊匹配、批量导入文件夹、播放列表、最近记录、截图、倍速。

纯本地离线，无任何后端依赖，Apache-2.0。

求各位轻喷，尤其是 mpv IPC 和视频宿主窗口这两块，欢迎来 issue 区提意见。

---

## 二、掘金（技术向文章）

**标题**：用 Tauri 2 + mpv 做了个 Windows 视频播放器，聊聊 --wid 嵌入和命名管道 IPC 这两个坑

**正文**：

# 前言

前端党想做个桌面播放器，绕不开两个问题：解码内核用什么、UI 怎么叠在视频上面。最近我把自己的方案完整落地成了一个开源项目 uuplayer（https://github.com/zouni88/uuplayer ），这篇文章聊聊架构和几个关键实现点。

# 整体架构

```
┌─────────────────────────────────┐
│  React 19 + TS（透明 WebView）  │  ← 自绘控制栏 / OSD / 播放列表
├─────────────────────────────────┤
│  Tauri 2 + Rust                 │  ← 子窗口管理 / mpv 子进程 / IPC 桥
├─────────────────────────────────┤
│  mpv + FFmpeg 8.x（子进程）     │  ← 解封装 / 解码 / 渲染
└─────────────────────────────────┘
```

# 关键点 1：让 mpv 画在 WebView 的下面

WebView 是整块盖在窗口上的，视频如果也走 WebView 渲染，性能和色差都不理想。我的做法是：

1. Rust 侧用 Win32 API 在主窗口内部创建一个子窗口，放到 z-order 最底部；
2. 把这个子窗口的句柄通过 mpv 的 --wid 参数传进去，mpv 直接往里渲染；
3. WebView 保持透明背景，悬浮在上层只画 UI。

这样视频是 mpv 原生渲染，UI 是 Web 自绘，互不干扰。

# 关键点 2：命名管道上的 JSON IPC

mpv 自带 JSON IPC 能力，在 Windows 上挂在命名管道上。Rust 侧做三件事：

- 命令下发：播放/暂停/seek/切轨，全部序列化成 JSON 命令写进管道；
- 属性监听：observe_property 订阅 time-pos、volume、track-list 等属性；
- 事件回传：属性一变就通过 Tauri event 广播到前端，控制栏的时间轴就是这么实时刷新的。

# 关键点 3：便携化

mpv.exe + FFmpeg 全套 DLL 直接打进应用包，用户机器上不需要装任何解码器，解压即用。

# 功能清单

全格式播放、HLS/RTSP 网络流、硬解（auto-safe）、音轨/字幕轨切换、外挂字幕模糊匹配、批量导入、播放列表、最近记录、截图、倍速。

# 最后

项目开源（Apache-2.0），下载在 Releases：https://github.com/zouni88/uuplayer/releases
对 Tauri 嵌入原生渲染这种玩法感兴趣的，欢迎 star / fork / 提 issue。

---

## 三、知乎（适配「Windows 上有哪些好用的视频播放器」类回答）

**回答正文**：

自荐一个刚开源的：uuplayer。

推荐理由很朴素：

1. **干净**。打开就是播放器，没有广告、没有资讯流、没有会员弹窗，关掉就什么都没了——全程离线运行，不联网。
2. **格式全**。内核是内置的 mpv + FFmpeg 8.x，MKV、AVI、FLV 这些老格式和各种冷门编码基本通吃，还支持直接贴 URL 播 HLS / RTSP 网络流。
3. **够轻**。Tauri 2 + Rust 的壳，没有捆绑运行时、不吃内存，老电脑也能用；硬解默认开启。
4. **该有的都有**。多音轨/字幕切换、外挂字幕自动匹配、批量导入文件夹、播放列表、最近播放、截图、倍速。

设计上致敬的是当年 QQ影音 那种"打开-播放-关掉"的纯粹感，界面是自绘的，比较清爽。

开源免费（Apache-2.0），Windows 10/11 可用，下载：
https://github.com/zouni88/uuplayer/releases
仓库：https://github.com/zouni88/uuplayer

轻量党、离线党可以试试，有问题欢迎去 issue 区反馈。

---

## 四、微博

**正文**：

自己写了个 Windows 视频播放器 uuplayer，今天正式开源 🎬

 mpv + FFmpeg 内核，格式通吃，硬解流畅，还能直接播 HLS/RTSP 网络流。没有广告、不联网、纯离线，就是干干净净放个视频——致敬当年的 QQ影音。

免费开源，戳这下载：https://github.com/zouni88/uuplayer/releases
求个 star ⭐ 求转发 🙏

#开源项目# #程序员# #Windows软件#

---

## 五、小红书

**标题**：受不了广告弹窗，程序员男友让我自己写了个播放器😭结果还真挺好用

**正文**：

谁懂啊，以前用的播放器不是开头广告就是会员弹窗📢

然后就有了这个 uuplayer：

✨ 完全免费！开源的！界面干干净净
✨ 什么格式都能放，MKV/AVI/老电影资源不挑
✨ 直接贴链接就能看直播源/网络视频（HLS、RTSP）
✨ 硬件加速，4K 也不卡，笔记本不烫了
✨ 双语字幕、多音轨随便切，外挂字幕拖进去自动加载
✨ 追剧神器：整个文件夹拖进去自动排片单，上次看到哪它记着
✨ 不联网！不联网！不联网！隐私安全感拉满

就是那种"打开→播放→沉浸"的老派体验，像小时候用的 QQ影音💫

免费下载（GitHub 搜 uuplayer 或戳评论区链接）
Windows 10/11 都能用～

#软件推荐 #Windows软件 #播放器推荐 #程序员日常 #效率工具 #开源项目

**评论区自留**：下载链接 👉 https://github.com/zouni88/uuplayer/releases （点 Releases 里的 .exe 就行）有问题评论区喊我～

---

## 六、即时通讯 / 群聊短版

自己做了个 Windows 播放器，mpv 内核，格式全、硬解、零广告、纯离线，还能播网络流，开源免费的，像以前的 QQ影音。求帮顶个 star ⭐
👉 https://github.com/zouni88/uuplayer
