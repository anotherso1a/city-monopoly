# 分享地图功能设计

## 概述

实现地图 JSON 文件的导出/导入功能，用户可以通过微信分享 `.json` 地图文件给好友，好友点击文件后自动拉起小程序并导入地图。

## 导出流程

1. 用户在游戏页面点击"分享地图"
2. 将地图数据序列化为 JSON 字符串
3. 生成文件名格式：`city-monopoly-map-{地图名}-{时间戳}.json`
4. 调用 `wx.getFileSystemManager().writeFile()` 写入用户数据目录
5. 调用 `wx.shareFileMessage()` 弹出微信分享面板
6. 用户选择好友发送文件

## 导入流程

1. 好友在微信聊天中点击 `.json` 文件
2. 微信自动拉起小程序，传递启动参数（包含文件路径）
3. 小程序在 `app.js` 的 `onLaunch`/`onShow` 中获取文件路径
4. 调用 `shareService.importMapFromFile()` 读取并解析 JSON
5. 验证地图格式，保存到 localStorage
6. 提示用户"地图导入成功"

## 文件关联配置

在 `project.config.json` 中配置 `.json` 文件关联：

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

## 数据流

```
分享：
mapData → JSON.stringify → writeFile → wx.shareFileMessage → 微信对话

导入（自动）：
微信打开 .json → 小程序 onLaunch(scene) → 解析 filePath → importMapFromFile → saveMap → 提示成功
```

## 改动点

| 文件 | 改动内容 |
|------|----------|
| `services/shareService.js` | 修复 `exportMap` 异步 bug，使用 Promise 包装写入操作；`shareMapFile` 改为 async/await 流程 |
| `pages/game/game.js` | `onShareMap` 调用 `shareMapFile()` 而非复制链接 |
| `app.js` | 在 `onLaunch`/`onShow` 中处理 `scene` 参数，解析文件路径并调用 `importMapFromFile` |
| `project.config.json` | 添加 `.json` 文件关联配置 |
| `app.json` | 确保 `setting` 中配置了 `urlQueryDecode` 等基础配置 |

## 错误处理

| 场景 | 处理 |
|------|------|
| 文件写入失败 | toast 提示"分享失败" |
| JSON 解析失败 | toast 提示"文件格式无效" |
| 缺少必要字段（grids） | toast 提示"地图数据不完整" |
| 读取文件失败 | toast 提示"读取文件失败" |