# 分享地图功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现地图 JSON 文件的导出/导入功能，用户可通过微信分享 .json 地图文件，好友点击文件后自动拉起小程序并导入地图。

**Architecture:** 分享时将地图序列化为 JSON 写入本地文件，通过 wx.shareFileMessage 分享；导入时在 app.js 的 onLaunch/onShow 中接收文件路径，解析后保存到 localStorage。

**Tech Stack:** 微信小程序 API (wx.getFileSystemManager, wx.shareFileMessage, onLaunch/onShow)

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `services/shareService.js` | 导出/导入地图的核心逻辑 |
| `pages/game/game.js` | 游戏页面调用分享功能 |
| `app.js` | 启动时处理文件打开逻辑 |
| `project.config.json` | 配置 .json 文件关联 |

---

## Task 1: 修复 shareService.js 的 exportMap 异步问题

**Files:**
- Modify: `services/shareService.js`

- [ ] **Step 1: 修改 exportMap 为同步返回**

原问题：`fs.writeFile` 是异步的，但直接 `return filePath` 导致文件还没写完就返回了。

修改 `exportMap` 使用 Promise 包装写入操作，确保写入完成后再返回路径。

```javascript
function exportMap(mapData) {
  return new Promise((resolve, reject) => {
    const jsonString = JSON.stringify(mapData);
    const fileName = `city-monopoly-map-${mapData.name || 'unnamed'}-${Date.now()}.json`;
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    fs.writeFile({
      filePath,
      data: jsonString,
      encoding: 'utf8',
      success: () => resolve(filePath),
      fail: (err) => reject(err)
    });
  });
}
```

- [ ] **Step 2: 修改 shareMapFile 为 async/await**

```javascript
async function shareMapFile(mapData) {
  try {
    const filePath = await exportMap(mapData);
    await wx.shareFileMessage({
      filePath,
      fileName: `${mapData.name || 'map'}.json`,
      success: () => { wx.showToast({ title: '分享成功', icon: 'success' }); },
      fail: (err) => { wx.showToast({ title: '分享失败', icon: 'none' }); }
    });
  } catch (err) {
    wx.showToast({ title: '分享失败：' + err.message, icon: 'none' });
  }
}
```

- [ ] **Step 3: 导出 handleOpenMapFile 增强**

确保 `handleOpenMapFile` 返回 Promise，可被 app.js 调用。

---

## Task 2: 修改 game.js 的 onShareMap

**Files:**
- Modify: `pages/game/game.js:357-382`

- [ ] **Step 1: 修改 onShareMap 调用 shareMapFile**

```javascript
onShareMap() {
  this.toggleSidebar();
  const mapId = this.data.mapId;
  if (!mapId) return;

  const map = StorageService.getMap(mapId);
  if (!map) return;

  shareMapFile(map);  // 调用分享服务
},
```

注意：引入 `shareMapFile` 从 services/shareService.js

---

## Task 3: 修改 app.js 处理文件打开

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 在 onLaunch 中处理文件路径**

微信小程序通过 `scene` 参数或启动参数传递文件路径。解析方式取决于微信的版本和配置，常见方式：

```javascript
onLaunch(options) {
  this.handleOpenMapFile(options);
},

onShow(options) {
  this.handleOpenMapFile(options);
},

handleOpenMapFile(options) {
  // 场景值判断：文件打开
  if (options.scene === 1044 || options.referrerInfo?.extraData?.filePath) {
    const filePath = options.referrerInfo?.extraData?.filePath;
    if (filePath) {
      const { importMapFromFile } = require('./services/shareService');
      importMapFromFile(filePath)
        .then((mapData) => {
          wx.showToast({ title: '地图导入成功', icon: 'success' });
        })
        .catch((err) => {
          wx.showToast({ title: err.message || '导入失败', icon: 'none' });
        });
    }
  }
}
```

- [ ] **Step 2: 处理 query 方式打开**

部分场景下文件路径通过 query 参数传递：

```javascript
handleOpenMapFile(options) {
  // 处理 scene 1044 文件分享场景
  if (options.scene === 1044 && options.referrerInfo) {
    const filePath = options.referrerInfo.extraData?.filePath;
    if (filePath) {
      this.doImportMap(filePath);
      return;
    }
  }

  // 处理 URL scheme 或其他方式传递的 file 参数
  if (options.query && options.query.file) {
    this.doImportMap(options.query.file);
  }
}

doImportMap(filePath) {
  const { importMapFromFile } = require('./services/shareService');
  importMapFromFile(filePath)
    .then(() => { wx.showToast({ title: '地图导入成功', icon: 'success' }); })
    .catch((err) => { wx.showToast({ title: err.message || '导入失败', icon: 'none' }); });
}
```

---

## Task 4: 配置 project.config.json 文件关联

**Files:**
- Modify: `project.config.json`

- [ ] **Step 1: 添加 fileAssociations 配置**

```json
{
  "extension": {
    "fileAssociations": [
      {
        "ext": "json",
        "mimeType": "application/json",
        "description": "City Monopoly Map"
      }
    ]
  }
}
```

---

## Task 5: 验证并测试

- [ ] **Step 1: 验证文件写入路径正确**

在开发者工具中调用 exportMap，检查文件是否写入到 `wx.env.USER_DATA_PATH`

- [ ] **Step 2: 验证分享面板调用成功**

点击分享地图按钮，检查是否弹出微信分享面板

- [ ] **Step 3: 验证导入流程**

在开发者工具中模拟 scene=1044 场景，验证地图能否正确导入并保存