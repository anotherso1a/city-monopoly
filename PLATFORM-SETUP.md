# City Monopoly 平台接入清单

> **状态:** 当前项目已就绪运行所需的全部配置项
> **最后更新:** 2026-06-05
> **AppID:** `wxb94eadd71f2651bf`

本清单覆盖两件事:
1. 项目用到了哪些能力和 API(代码层面的依赖)
2. 在「微信公众平台」和第三方服务商控制台要做的配置

---

## 一、微信原生 API 使用清单

按能力分组,标注实际使用位置。

### 1.1 位置 / 地图 UI

| API | 用途 | 使用位置 |
|---|---|---|
| `wx.getLocation` | 获取用户当前定位 | `pages/create/create.js` |
| `wx.chooseLocation` | 让用户手动选一个位置 | `pages/search/search.js` |
| `wx.openLocation` | 在内置地图打开某个坐标 | (代码可见,具体位置 grep) |
| `wx.getSystemInfoSync` | 拿状态栏高度/屏幕宽 | `components/NavigationBar/navigation-bar.js`,各页面 |
| `wx.getMenuButtonBoundingClientRect` | 右上角胶囊位置,自定 nav bar 用 | `components/NavigationBar/navigation-bar.js` |

> **2022+ 隐私要求:** `chooseLocation` / `getLocation` 必须在 `app.json` 的 `requiredPrivateInfos` 声明,否则运行时静默失败。本项目已声明 ✅

### 1.2 文件系统

| API | 用途 |
|---|---|
| `wx.getFileSystemManager` | 文件系统句柄(读/写/删本地文件) |
| `wx.saveFile` / `wx.getSavedFileInfo` / `wx.getSavedFileList` / `wx.removeSavedFile` | 持久化保存(超过本地缓存大小限制后仍留存) |
| `wx.downloadFile` | 下载远程文件到本地(用于 painter 缓存图片) |
| `wx.getFileInfo` | 文件元信息 |
| `wx.env.USER_DATA_PATH` | 用户数据目录(写分享文件用) |

### 1.3 分享 / 文件传输

| API | 用途 |
|---|---|
| `wx.shareFileMessage` | 分享 .json 地图文件给好友 — `pages/game/game.js` |
| `wx.chooseMessageFile` | 从聊天会话里选 .json 文件导入地图 — `pages/game/game.js` |

### 1.4 网络请求

| API | 用途 |
|---|---|
| `wx.request` | 包装在 `utils/request.js`,用于调高德/MiniMax 的 HTTPS API |

### 1.5 本地存储

| API | 用途 |
|---|---|
| `wx.setStorage` / `wx.getStorage` / `wx.removeStorage` | 异步接口 |
| `wx.setStorageSync` / `wx.getStorageSync` / `wx.getStorageInfoSync` | 同步接口,`app.js` / `utils/storage.js` 用 |

### 1.6 媒体 / 画布 / 相册

| API | 用途 |
|---|---|
| `wx.createCanvasContext` | 画布上下文(painter 内部用) |
| `wx.canvasToTempFilePath` | 画布 → 临时图片 |
| `wx.chooseImage` | 选择图片(头像/上传等) |
| `wx.saveImageToPhotosAlbum` | 海报保存到相册 — `components/poster-share/poster-share.js` |
| `wx.getImageInfo` | 读图片宽高 |

### 1.7 UI 提示 / 路由 / 设置

| API | 用途 |
|---|---|
| `wx.showToast` / `wx.showModal` / `wx.showLoading` / `wx.hideLoading` | 通用提示 |
| `wx.navigateTo` / `wx.navigateBack` / `wx.redirectTo` / `wx.reLaunch` / `wx.switchTab` | 路由 |
| `wx.openSetting` / `wx.getSetting` | 打开设置页 / 查授权状态 |
| `wx.exitMiniProgram` | 退出小程序 |
| `wx.createSelectorQuery` | 选 DOM 节点查尺寸 |

### 1.8 未使用但已规划的 API

| API | 计划用途 | 备注 |
|---|---|---|
| `wx.getWeRunData` | city-walk 步数成绩 | 还在规划阶段,接入时需要云函数解密(数据是加密的) |

---

## 二、第三方服务清单

### 2.1 高德地图 (AMap)

- **用途:** POI 搜索(inputtips)、地理编码/逆编码、POI 周边搜索、staticmap 静态图、路径规划
- **代码位置:** `utils/lib/amap-wx.130.js` + `services/poiService.js`
- **API Key 申请:** https://lbs.amap.com/dev/key/app
- **Key 配置:** `config.local.js` 的 `AMAP_KEY`
- **请求域名:** `https://restapi.amap.com`
- **关键操作:** 申请时**必须绑定本项目 AppID** (`wxb94eadd71f2651bf`),否则 key 在小程序里用不了
- **高德控制台白名单:** 把 AppID 加到「应用 → 小程序 Key」的白名单里

### 2.2 MiniMax LLM

- **用途:** 「生成地图」时让 LLM 设计 20 个 POI 格子 + 机会卡
- **代码位置:** `services/aiService.js`
- **API Key 申请:** https://platform.minimaxi.com/
- **Key / Endpoint / Model 配置:** `config.local.js` 的 `LLM_API_KEY` / `LLM_API_BASE_URL` / `LLM_MODEL`
- **请求域名:** `https://api.minimaxi.com`(国际) 或 `https://api.MiniMax.chat`(国内)
- **协议:** OpenAI 兼容(`POST /chat/completions`, `response_format: json_object`)

### 2.3 阿里云 OSS (静态资源)

- **用途:** 头像、首页背景图、海报二维码、地图缩略图等静态资源
- **Bucket:** `anothersola`(北京 region)
- **域名:** `https://anothersola.oss-cn-beijing.aliyuncs.com`
- **权限:** 公开读,不需要 key
- **代码引用:** 散落在 WXML/CSS 里(如 `https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png`)
- **上传工具:** `scripts/upload-oss.js`(本地 `npm run upload:oss`)

---

## 三、请求域名清单(微信公众平台 → 开发管理 → 开发设置 → 服务器域名)

### 3.1 request 合法域名

| 域名 | 用途 |
|---|---|
| `https://restapi.amap.com` | 高德地图 API |
| `https://api.minimaxi.com` | MiniMax 国际版(如果用国内版 `https://api.MiniMax.chat` 替换,这个就删) |

### 3.2 downloadFile 合法域名

| 域名 | 用途 |
|---|---|
| `https://anothersola.oss-cn-beijing.aliyuncs.com` | 阿里云 OSS 静态图(被 `wx.downloadFile` 缓存到本地) |
| `https://restapi.amap.com` | 高德 staticmap(被 `wx.downloadFile` 拉下来) |

### 3.3 uploadFile 合法域名

- **目前没用到** — 项目所有数据都存在本地 storage 或写到 `USER_DATA_PATH`,没有上传到服务器的动作。先不配。

### 3.4 注意事项

- 小程序里 `<image src="https://...">` 直接渲染远程图,**不需要** downloadFile 域名(只有用 `wx.downloadFile` 才需要)
- `project.config.json` 当前 `urlCheck: false`,**只在开发期绕过校验**。**上线前必须改回 `true`**,否则生产环境会被微信拦截
- 国内/海外版本域名要分别配置(海外不绑国内域名)

---

## 四、用户隐私保护指引(微信公众平台 → 设置 → 服务内容声明)

按使用到的 API 声明,需在线填写「用户隐私保护指引」审核通过才能上线。

| 声明项 | 触发的 API | 备注 |
|---|---|---|
| 位置信息 | `wx.getLocation` / `wx.chooseLocation` / `wx.openLocation` | 已在 `app.json` 的 `requiredPrivateInfos` 声明 ✅ |
| 相册(仅写入) | `wx.saveImageToPhotosAlbum` | 海报保存功能用到,需要声明 |
| 文件(读写) | `wx.shareFileMessage` / `wx.chooseMessageFile` / `wx.getFileSystemManager` | 地图文件分享/导入用到,需要声明 |

> 审核时需提交「与第三方共享个人信息清单」,如果用 MiniMax LLM 涉及把 POI 数据发给第三方,可能也要声明(待确认)。

---

## 五、微信公众平台操作清单(用户需要做的)

按上线顺序排列。

### 5.1 必做(功能跑起来)

- [ ] **AppID 检查**: 确认 `wxb94eadd71f2651bf` 是你拥有的 AppID(项目 `project.config.json` 已写)
- [ ] **配置 request 合法域名**: 把 §3.1 的域名填到「开发管理 → 开发设置 → 服务器域名」
- [ ] **配置 downloadFile 合法域名**: 把 §3.2 的域名填到同上位置
- [ ] **用户隐私保护指引**: 把 §4 的「位置/相册/文件」三项声明提交审核

### 5.2 推荐做(避免上线后才发现)

- [ ] **`urlCheck` 改回 `true`**: 上线前改 `project.config.json` 里的 `urlCheck: false` → `true`,在 WeChat dev tools 复测一遍所有 API
- [ ] **小程序类目**: 设置 → 基本设置 → 服务类目,选「工具 / 出行」相关(影响可用 API,选错可能导致审核被拒)
- [ ] **业务域名**: 暂未用到,先不配
- [ ] **服务器域名白名单**: 如果高德 Key 没绑 AppID 也要补

### 5.3 后续可加(规划中的 city-walk 等)

- [ ] `wx.getWeRunData` 接入时,要在「用户隐私保护指引」**新增「步数」声明**,且 LLM / 云函数架构要先 ready(步数是加密的,需云函数解密)

---

## 六、第三方平台操作清单(不在微信公众平台)

| 平台 | 操作 |
|---|---|
| **高德 LBS 控制台** | 1) 申请 Web Service API Key (https://lbs.amap.com/dev/key/app) ; 2) Key 详情里绑本项目 AppID `wxb94eadd71f2651bf`; 3) 复制 key 填到 `config.local.js` 的 `AMAP_KEY` |
| **MiniMax 控制台** | 1) 创建 API Key (https://platform.minimaxi.com/) ; 2) 填到 `config.local.js` 的 `LLM_API_KEY`; 3) 选模型填到 `LLM_MODEL`(常用 MiniMax-M2) |
| **阿里云 OSS** | 1) 确认 bucket `anothersola` 公开读; 2) `scripts/upload-oss.js` 的 AK/SK 配到 `.env`(gitignore 不进 git); 3) `npm run upload:oss` 即可上传图片 |

---

## 七、自检清单(给实施者 / 上线前 review)

- [x] `app.json` 的 `requiredPrivateInfos` 已包含 `chooseLocation` / `getLocation`
- [x] `app.json` 的 `permission.scope.userLocation` 已声明用途
- [x] `config.example.js` 包含全部配置项注释,`config.local.js` gitignore 不会泄露
- [x] 所有外网请求都走 `utils/request.js`(统一超时/错误处理)
- [ ] **公众平台 request/downloadFile 域名已配**(实施者确认)
- [ ] **用户隐私保护指引已审核通过**(实施者确认)
- [ ] **高德 Key 已在高德控制台绑本项目 AppID**(实施者确认)
- [ ] **MiniMax Key 已填 `config.local.js` 且 rotate 过一次**(明文传过 chat,必须 rotate)
- [ ] **小程序类目已选且审核通过**(实施者确认)
- [ ] **上线前 `urlCheck: true` 复测全流程**(实施者确认)
