# edittest 页面调整实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据 design/edit.html 更新 edittest 页面布局和样式

**Architecture:** 移除圆形棋盘预览，改为垂直地块列表；更新工具栏和属性面板以匹配设计

**Tech Stack:** 微信小程序页面、WXML/WXSS/JS

---

## Task 1: 更新 edittest.wxml 结构

**Files:**
- Modify: `pages/edittest/edittest.wxml`

- [ ] **Step 1: 重写 wxml 结构**

移除圆形棋盘预览，改为垂直地块列表和属性面板：

```xml
<view class="edit-page">
  <!-- Header / TopAppBar -->
  <navigation-bar
    title="编辑地图: 伦敦雾"
    type="back"
    showAvatar="{{false}}"
  />

  <!-- Main Content -->
  <view class="main-content">
    <!-- Top Section: Tile List -->
    <view class="tile-list-section">
      <view class="tile-list-header">
        <text class="tile-list-title text-on-surface-variant">地块列表</text>
        <text class="tile-list-hint text-outline">滚动查看全部</text>
      </view>
      <scroll-view class="tile-list-scroll" scroll-y>
        <!-- Tile Item 1 (Active) -->
        <view class="tile-item tile-list-item node-active sticker-shadow" bindtap="onTileSelect" data-id="1">
          <view class="tile-number">1</view>
          <text class="tile-name text-on-surface">苏豪广场</text>
          <text class="iconfont tile-drag-icon icon-drag"></text>
        </view>
        <!-- Tile Item 2 -->
        <view class="tile-item tile-list-item" bindtap="onTileSelect" data-id="2">
          <view class="tile-number">2</view>
          <text class="tile-name text-on-surface">牛津街</text>
          <text class="iconfont tile-drag-icon icon-drag"></text>
        </view>
        <!-- Tile Item 3 -->
        <view class="tile-item tile-list-item" bindtap="onTileSelect" data-id="3">
          <view class="tile-number">3</view>
          <text class="tile-name text-on-surface">摄政街</text>
          <text class="iconfont tile-drag-icon icon-drag"></text>
        </view>
        <!-- Tile Item 4 -->
        <view class="tile-item tile-list-item" bindtap="onTileSelect" data-id="4">
          <view class="tile-number">4</view>
          <text class="tile-name text-on-surface">邦德街</text>
          <text class="iconfont tile-drag-icon icon-drag"></text>
        </view>
      </scroll-view>
    </view>

    <!-- Middle Section: Editor Toolbar -->
    <view class="editor-toolbar">
      <view class="toolbar-btn {{activeTool === 'add' ? 'active' : ''}}" bindtap="onToolSelect" data-tool="add">
        <text class="iconfont toolbar-icon icon-plus-circle"></text>
        <text class="toolbar-label">添加</text>
      </view>
      <view class="toolbar-btn {{activeTool === 'delete' ? 'active' : ''}}" bindtap="onToolSelect" data-tool="delete">
        <text class="iconfont toolbar-icon icon-delete"></text>
        <text class="toolbar-label">删除</text>
      </view>
      <view class="toolbar-btn {{activeTool === 'tune' ? 'active' : ''}}" bindtap="onToolSelect" data-tool="tune">
        <text class="iconfont toolbar-icon icon-edit-square"></text>
        <text class="toolbar-label">属性</text>
      </view>
    </view>

    <!-- Bottom Section: Properties Panel -->
    <view class="properties-panel">
      <view class="panel-header">
        <text class="iconfont panel-icon icon-edit-note"></text>
        <text class="panel-title text-primary">地块属性</text>
      </view>
      <view class="form-group">
        <label class="form-label text-on-surface-variant">名称</label>
        <input class="form-input" type="text" value="{{nodeName}}" placeholder="请输入地块名称" bindinput="onNameInput" />
      </view>
      <view class="form-group">
        <label class="form-label text-on-surface-variant">描述</label>
        <textarea class="form-textarea" placeholder="地块描述..." value="{{nodeDesc}}" bindinput="onDescInput"></textarea>
      </view>
      <view class="form-group">
        <label class="form-label text-on-surface-variant">地块类型</label>
        <view class="type-tags">
          <view class="type-tag {{nodeType === '商业' ? 'selected' : ''}}" bindtap="onTypeSelect" data-type="商业">商业</view>
          <view class="type-tag {{nodeType === '住宅' ? 'selected' : ''}}" bindtap="onTypeSelect" data-type="住宅">住宅</view>
          <view class="type-tag {{nodeType === '公园' ? 'selected' : ''}}" bindtap="onTypeSelect" data-type="公园">公园</view>
          <view class="type-tag {{nodeType === '机会' ? 'selected' : ''}}" bindtap="onTypeSelect" data-type="机会">机会</view>
        </view>
      </view>
      <view class="number-row">
        <view class="number-group">
          <label class="form-label text-on-surface-variant">金币奖励</label>
          <view class="number-input-wrapper">
            <text class="iconfont number-icon icon-moneycollect"></text>
            <input class="number-input" type="number" value="{{goldReward}}" bindinput="onGoldInput" />
          </view>
        </view>
        <view class="number-group">
          <label class="form-label text-on-surface-variant">税率 (%)</label>
          <view class="number-input-wrapper">
            <text class="iconfont number-icon icon-sync"></text>
            <input class="number-input" type="number" value="{{taxRate}}" bindinput="onTaxInput" />
          </view>
        </view>
      </view>
      <view class="btn-apply" bindtap="onApply">应用修改</view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 提交代码**

```bash
git add pages/edittest/edittest.wxml
git commit -m "refactor(edittest): replace board preview with tile list per design"
```

---

## Task 2: 更新 edittest.wxss 样式

**Files:**
- Modify: `pages/edittest/edittest.wxss`

- [ ] **Step 1: 重写 wxss 样式**

完全重写样式以匹配设计稿：

```css
/* edittest 页面样式 - 基于 design/edit.html */

page {
  box-sizing: border-box;
  overflow-x: hidden;
  --primary: #7c5800;
  --primary-container: #ffb800;
  --on-primary: #ffffff;
  --on-primary-container: #6b4c00;
  --secondary: #b71032;
  --on-secondary: #ffffff;
  --surface: #fff8f3;
  --surface-container: #f9ecdb;
  --surface-container-low: #fff2e1;
  --surface-container-lowest: #ffffff;
  --surface-container-high: #f3e6d6;
  --surface-container-highest: #ede1d0;
  --on-surface: #211b11;
  --on-surface-variant: #514532;
  --outline: #837560;
  --outline-variant: #d5c4ab;
  --background: #fff8f3;
  /* 纸张纹理背景 */
  background-image: radial-gradient(#d5c4ab 0.5px, transparent 0.5px);
  background-size: 24rpx 24rpx;
  background-color: var(--background);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 手绘边框效果 */
.hand-drawn-border {
  border-style: solid;
  border-width: 2px 2.5px 1.8px 2.2px;
  border-radius: 4px 10px 4px 12px;
}

.sticker-shadow {
  box-shadow: 4px 4px 0px 0px rgba(81, 69, 50, 0.15);
}

/* 主容器 */
.edit-page {
  min-height: 100vh;
  padding-bottom: 48rpx;
}

.main-content {
  padding-top: 160rpx;
  padding-left: 48rpx;
  padding-right: 48rpx;
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

/* Tile List Section */
.tile-list-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.tile-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 8rpx;
}

.tile-list-title {
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 2rpx;
}

.tile-list-hint {
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.tile-list-scroll {
  height: 440rpx;
  overflow-y: auto;
}

.tile-list-scroll::-webkit-scrollbar {
  display: none;
}

/* Tile Item */
.tile-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  background-color: var(--surface-container-low);
  border: 4rpx solid var(--outline);
  margin-bottom: 12rpx;
  transition: all 0.2s;
}

.tile-item:active {
  transform: scale(0.98);
}

.tile-number {
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 4rpx solid var(--outline);
  background-color: var(--surface-container-highest);
  color: var(--on-surface-variant);
  font-size: 18px;
  line-height: 24px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
}

.tile-item.node-active .tile-number {
  border-color: var(--primary);
  background-color: var(--primary-container);
  color: var(--on-primary-container);
}

.tile-name {
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
}

.tile-drag-icon {
  margin-left: auto;
  font-size: 32rpx;
  color: var(--primary);
  opacity: 0.6;
}

.tile-item.node-active .tile-drag-icon {
  opacity: 1;
}

/* Node Active State */
.node-active {
  border-color: var(--primary) !important;
  background-color: var(--primary-container) !important;
  filter: drop-shadow(0 0 8px rgba(255, 184, 0, 0.3));
}

/* Editor Toolbar */
.editor-toolbar {
  display: flex;
  overflow-x: auto;
  padding: 20rpx 0;
  gap: 16rpx;
}

.editor-toolbar::-webkit-scrollbar {
  display: none;
}

.toolbar-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  min-width: 144rpx;
  padding: 16rpx;
  background-color: var(--surface-container-high);
  border: 4rpx solid var(--outline);
  transition: all 0.2s;
}

.toolbar-btn:active {
  transform: scale(0.95);
}

.toolbar-btn.active {
  background-color: var(--primary-container);
  color: var(--on-primary-container);
  box-shadow: 4rpx 4rpx 0px 0px rgba(81, 69, 50, 0.15);
}

.toolbar-icon {
  font-size: 48rpx;
  color: var(--primary);
}

.toolbar-btn.active .toolbar-icon {
  font-weight: 700;
  color: var(--on-primary-container);
}

.toolbar-label {
  font-size: 10px;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  color: var(--on-surface-variant);
}

.toolbar-btn.active .toolbar-label {
  color: var(--on-primary-container);
}

/* Properties Panel */
.properties-panel {
  background-color: var(--surface-container-lowest);
  border: 4rpx solid var(--outline);
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  box-shadow: 4rpx 4rpx 0px 0px rgba(81, 69, 50, 0.15);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.panel-icon {
  font-size: 36rpx;
  color: var(--primary-fixed-dim);
}

.panel-title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
}

/* Form Groups */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.form-label {
  font-size: 12px;
  line-height: 16px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  margin-left: 16rpx;
  text-transform: uppercase;
  letter-spacing: 1rpx;
}

.form-input {
  background-color: transparent;
  border: 0;
  border-bottom: 4rpx solid var(--outline-variant);
  padding: 16rpx;
  font-size: 16px;
  line-height: 24px;
  color: var(--on-surface);
  transition: all;
}

.form-input:focus {
  border-color: var(--primary-container);
}

.form-textarea {
  background-color: transparent;
  border: 4rpx solid var(--outline-variant);
  padding: 16rpx;
  font-size: 16px;
  line-height: 24px;
  color: var(--on-surface);
  transition: all;
  min-height: 120rpx;
}

.form-textarea:focus {
  border-color: var(--primary-container);
}

/* Type Tags */
.type-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.type-tag {
  padding: 16rpx 32rpx;
  border-radius: 9999px;
  border: 4rpx dashed var(--outline-variant);
  font-size: 10px;
  font-family: 'Courier New', monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  color: var(--on-surface-variant);
  transition: all;
}

.type-tag:active {
  border-style: solid;
  border-color: var(--outline);
}

.type-tag.selected {
  border-style: solid;
  border-color: var(--primary-container);
  background-color: var(--primary-container);
  color: var(--on-primary-container);
}

/* Number Inputs Row */
.number-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32rpx;
  margin-top: 16rpx;
}

.number-group {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex: 1;
}

.number-input-wrapper {
  display: flex;
  align-items: center;
  border: 4rpx solid var(--outline-variant);
  padding: 16rpx;
  background-color: rgba(237, 225, 208, 0.3);
}

.number-icon {
  font-size: 32rpx;
  color: var(--primary);
  margin-right: 8rpx;
}

.number-input {
  background-color: transparent;
  border: 0;
  font-size: 18px;
  line-height: 24px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: var(--on-surface);
  width: 100%;
}

/* Apply Button */
.btn-apply {
  width: 100%;
  padding: 32rpx;
  background-color: var(--secondary);
  color: var(--on-secondary);
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
  border: 4rpx solid var(--on-secondary-fixed-variant);
  box-shadow: 4rpx 4rpx 0px 0px rgba(81, 69, 50, 0.15);
  text-align: center;
  transition: all;
}

.btn-apply:active {
  transform: translateY(4rpx) translateX(4rpx);
  box-shadow: none;
}

/* Typography */
.headline-lg-mobile {
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
}

.text-primary { color: var(--primary); }
.text-on-primary { color: var(--on-primary); }
.text-on-primary-container { color: var(--on-primary-container); }
.text-on-surface { color: var(--on-surface); }
.text-on-surface-variant { color: var(--on-surface-variant); }
.text-outline { color: var(--outline); }
```

- [ ] **Step 2: 提交代码**

```bash
git add pages/edittest/edittest.wxss
git commit -m "style(edittest): update styles per design/edit.html"
```

---

## Task 3: 更新 edittest.js 逻辑

**Files:**
- Modify: `pages/edittest/edittest.js`

- [ ] **Step 1: 更新 js 逻辑**

添加 tile 数据和选择逻辑：

```javascript
// edittest 页面 - 基于 design/edit.html

Page({
  data: {
    // 地块列表数据
    tiles: [
      { id: 1, name: '苏豪广场', desc: '伦敦市中心的繁华地带。', type: '商业', goldReward: 1200, taxRate: 5 },
      { id: 2, name: '牛津街', desc: '著名的商业街道。', type: '商业', goldReward: 800, taxRate: 4 },
      { id: 3, name: '摄政街', desc: '遍布奢华商店。', type: '商业', goldReward: 1500, taxRate: 6 },
      { id: 4, name: '邦德街', desc: '最贵的商业地产之一。', type: '商业', goldReward: 2000, taxRate: 8 }
    ],
    activeTileId: 1,
    activeTool: 'tune',
    nodeName: '苏豪广场',
    nodeDesc: '伦敦市中心的繁华地带。',
    nodeType: '商业',
    goldReward: 1200,
    taxRate: 5
  },

  onLoad() {
    // 初始化选中第一个地块
    this.selectTile(1);
  },

  onTileSelect(e) {
    const tileId = e.currentTarget.dataset.id;
    this.selectTile(tileId);
  },

  selectTile(id) {
    const tile = this.data.tiles.find(t => t.id === id);
    if (tile) {
      this.setData({
        activeTileId: id,
        nodeName: tile.name,
        nodeDesc: tile.desc,
        nodeType: tile.type,
        goldReward: tile.goldReward,
        taxRate: tile.taxRate
      });
    }
  },

  onToolSelect(e) {
    const tool = e.currentTarget.dataset.tool;
    this.setData({ activeTool: tool });
  },

  onNameInput(e) {
    this.setData({ nodeName: e.detail.value });
    // 更新tiles数据
    const tiles = this.data.tiles.map(t =>
      t.id === this.data.activeTileId ? { ...t, name: e.detail.value } : t
    );
    this.setData({ tiles });
  },

  onDescInput(e) {
    this.setData({ nodeDesc: e.detail.value });
    const tiles = this.data.tiles.map(t =>
      t.id === this.data.activeTileId ? { ...t, desc: e.detail.value } : t
    );
    this.setData({ tiles });
  },

  onTypeSelect(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ nodeType: type });
    const tiles = this.data.tiles.map(t =>
      t.id === this.data.activeTileId ? { ...t, type } : t
    );
    this.setData({ tiles });
  },

  onGoldInput(e) {
    const goldReward = parseInt(e.detail.value) || 0;
    this.setData({ goldReward });
    const tiles = this.data.tiles.map(t =>
      t.id === this.data.activeTileId ? { ...t, goldReward } : t
    );
    this.setData({ tiles });
  },

  onTaxInput(e) {
    const taxRate = parseInt(e.detail.value) || 0;
    this.setData({ taxRate });
    const tiles = this.data.tiles.map(t =>
      t.id === this.data.activeTileId ? { ...t, taxRate } : t
    );
    this.setData({ tiles });
  },

  onApply() {
    wx.showToast({
      title: '修改已应用',
      icon: 'success'
    });
  }
});
```

- [ ] **Step 2: 提交代码**

```bash
git add pages/edittest/edittest.js
git commit -m "refactor(edittest): update logic with tile list selection"
```

---

## Task 4: 更新 edittest.json

**Files:**
- Modify: `pages/edittest/edittest.json`

- [ ] **Step 1: 更新 json**

```json
{
  "navigationStyle": "custom",
  "disableScroll": true,
  "usingComponents": {
    "navigation-bar": "/components/NavigationBar/navigation-bar"
  }
}
```

- [ ] **Step 2: 提交代码**

```bash
git add pages/edittest/edittest.json
git commit -m "chore(edittest): update config (no changes needed)"
```

---

## 验证步骤

1. 运行微信开发者工具
2. 检查页面标题显示"编辑地图: 伦敦雾"
3. 检查地块列表显示4个地块，可滚动
4. 点击地块，高亮选中并更新属性面板
5. 修改属性后点击"应用修改"，显示成功 toast
6. 检查工具栏按钮样式和选中状态