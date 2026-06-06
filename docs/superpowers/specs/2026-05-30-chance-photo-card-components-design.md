# ChanceCard & PhotoCard 组件封装设计

## 背景

`pages/chancecard` 和 `pages/photocard` 是两个弹窗页面，分别用于显示"机会卡"和"拍照打卡"信息。需要封装为可复用组件。

## 组件设计

### 1. ChanceCard 组件 (`components/chance-card/`)

**用途：** 显示机会卡弹窗（如获得金币、道具等）

**Props:**
- `visible` (Boolean): 是否显示弹窗
- `image` (String): 卡片图片URL
- `description` (String): 卡片描述文字
- `goldChange` (Number): 金币变化量（可为负数）
- `onCollect` (Function): 点击"收下"按钮回调

**事件：**
- `bind:collect` - 用户点击收下按钮时触发

**样式特征：**
- 黄色顶部 (#ffb800)
- 手绘风格边框
- 右上角装饰图标

---

### 2. PhotoCard 组件 (`components/photo-card/`)

**用途：** 显示发现新地标的打卡弹窗

**Props:**
- `visible` (Boolean): 是否显示弹窗
- `image` (String): 地标照片URL
- `locationName` (String): 地点名称
- `photoDate` (String): 拍照日期
- `description` (String): 描述文字
- `achievementPoint` (Number): 成就点数
- `onContinue` (Function): 点击"继续前进"回调
- `onViewDetails` (Function): 点击"查看详情"回调

**事件：**
- `bind:continue` - 用户点击继续前进
- `bind:viewdetails` - 用户点击查看详情

**样式特征：**
- 宝丽来相框风格
- 透明胶带装饰
- 深棕色主题色 (#7c5800)

---

## 文件结构

```
components/
├── chance-card/
│   ├── chance-card.wxml
│   ├── chance-card.js
│   ├── chance-card.json
│   └── chance-card.wxss
└── photo-card/
    ├── photo-card.wxml
    ├── photo-card.js
    ├── photo-card.json
    └── photo-card.wxss
```

## 迁移策略

1. 创建组件目录和4个文件
2. 将页面样式移到组件WXSS
3. 将页面逻辑移到组件JS
4. 使用 `triggerEvent` 替代 `bindtap` 事件冒泡
5. 保留页面作为调用方，传入数据并处理回调

## 使用示例

```xml
<!-- chance-card.wxml -->
<ChanceCard
  visible="{{showChanceCard}}"
  image="{{cardImage}}"
  description="{{cardDescription}}"
  goldChange="{{goldChange}}"
  bind:collect="onChanceCollect"
/>

<!-- photo-card.wxml -->
<PhotoCard
  visible="{{showPhotoCard}}"
  image="{{landmarkImage}}"
  locationName="{{locationName}}"
  photoDate="{{photoDate}}"
  description="{{description}}"
  achievementPoint="{{achievementPoint}}"
  bind:continue="onPhotoContinue"
  bind:viewdetails="onPhotoViewDetails"
/>
```

## 注意事项

- 组件需要处理自己的动画（fadeInZoom）
- 弹窗遮罩层由组件内部实现
- 组件关闭后通过事件通知调用方更新 `visible`