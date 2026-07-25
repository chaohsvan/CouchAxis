# CouchAxis

CouchAxis 是一款 Windows 本地独立运行、手柄优先的媒体文件浏览与播放应用。它直接展示磁盘目录，不建立媒体库，不进行影视信息刮削，也不依赖账户、服务器或在线服务。

## 文档

- [程序功能说明](docs/FUNCTIONAL_OVERVIEW.md)：用户流程、格式范围、视频/音乐/图片功能、逐页面手柄映射、设置、限制和验收清单。
- [技术架构与实现路径](docs/TECHNICAL_IMPLEMENTATION.md)：当前代码架构、IPC 契约、关键算法、构建测试，以及 libmpv、SDL2 和跨平台迁移路径。

## 当前能力

| 模块 | 已实现 |
| --- | --- |
| 文件浏览 | Windows 固定盘/可移动盘、高密度列表/网格、隐藏文件、可移除收藏夹、返回位置恢复 |
| 视频 | 播放暂停、跳转、音量、0.5x-4x 倍速、字幕、截图、全屏、专注模式 |
| 音乐 | 子目录递归队列、顺序/随机/单曲循环、内置歌词、内置封面、默认封面、频谱、黑屏 |
| 图片 | 完整适应窗口、持续缩放、平移、旋转、比例锁定、漫画起点、专注模式 |
| 设置 | 初始界面、隐藏文件、语言、截图目录、漫画起始方向、文件视图持久化 |
| 输入 | Xbox、PlayStation、Switch Pro 标准布局；页面级手柄帮助；键盘后备 |
| 打包 | 独立 EXE、NSIS 安装程序、MSI |

## 重要技术状态

当前视频和音频播放使用 WebView2 的 HTMLMediaElement，手柄使用浏览器 Gamepad API。文件能被识别并显示，不代表当前 Windows 媒体栈一定能解码其编码格式。

PRD 目标中的 libmpv 和 SDL2 尚未接入。对应迁移步骤、渲染表面决策和完成标准见[技术架构与实现路径](docs/TECHNICAL_IMPLEMENTATION.md)。

## 开发环境

Windows 开发需要：

- Node.js 和 pnpm
- Rust stable MSVC 工具链
- Visual Studio 2022 Build Tools，包含 Desktop development with C++
- Windows SDK
- Microsoft Edge WebView2 Runtime

## 常用命令

```powershell
# 安装前端依赖
pnpm install

# 浏览器演示模式，不访问真实磁盘
pnpm dev

# Tauri 桌面开发模式，访问真实本地文件
pnpm tauri dev

# 前端测试
pnpm test

# TypeScript 检查和前端生产构建
pnpm build

# Rust 测试
cargo test --manifest-path src-tauri/Cargo.toml

# Windows release 和安装包
pnpm tauri build
```

## 构建产物

```text
src-tauri/target/release/couchaxis.exe
src-tauri/target/release/bundle/nsis/CouchAxis_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/CouchAxis_0.1.0_x64_en-US.msi
```

## 项目边界

CouchAxis 不提供媒体库扫描、海报墙、影视刮削、在线播放、NAS/SMB 集成、文件删除、账户系统、云同步或自动字幕下载。浏览媒体时不修改源文件；只有偏好设置和用户主动截取的 PNG 会写入磁盘。
