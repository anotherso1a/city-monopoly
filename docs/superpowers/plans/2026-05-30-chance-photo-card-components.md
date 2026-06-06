# ChanceCard & PhotoCard 组件封装实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `pages/chancecard` 和 `pages/photocard` 封装为可复用组件

**Architecture:** 创建 `components/chance-card/` 和 `components/photo-card/` 两个独立组件，保留原页面作为调用方，通过属性传递数据、事件回调处理用户交互

**Tech Stack:** 微信小程序组件系统、WXML/WXSS/JS

---

## Task 1: 创建 ChanceCard 组件

**Files:**
- Create: `components/chance-card/chance-card.wxml`
- Create: `components/chance-card/chance-card.wxss`
- Create: `components/chance-card/chance-card.js`
- Create: `components/chance-card/chance-card.json`

- [ ] **Step 1: 创建组件目录和基础文件**

```bash
mkdir -p components/chance-card
touch components/chance-card/chance-card.{wxml,wxss,js,json}
```

- [ ] **Step 2: 编写 chance-card.json**

```json
{
  "component": true,
  "usingComponents": {
    "iconfont": "/utils/iconfont"
  }
}
```

- [ ] **Step 3: 编写 chance-card.wxml**

```xml
<view class="chance-card-page" wx:if="{{visible}}">
  <view class="overlay-backdrop" bindtap="onBackdropTap">
    <view class="opportunity-card">
      <view class="card-header">
        <text class="card-title headline-lg-mobile text-on-primary-container">获得机会卡!</text>
      </view>
      <view class="card-content">
        <view class="illustration-container hand-drawn-border">
          <image class="illustration-image" src="{{image}}" mode="aspectFill"></image>
        </view>
        <view class="card-text">
          <text class="description body-md text-on-surface-variant">{{description}}</text>
        </view>
        <button class="collect-btn hand-drawn-border ink-shadow active-press" bindtap="onCollect">
          <text class="headline-lg-mobile text-on-primary-container">收下</text>
        </button>
      </view>
      <view class="sticker-decoration">
        <text class="iconfont sticker-icon icon-check-circle"></text>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 编写 chance-card.wxss**

```css
@import '../../utils/iconfont.wxss';

.chance-card-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
}

.overlay-backdrop {
  width: 100%;
  height: 100%;
  background-color: rgba(33, 27, 17, 0.4);
  backdrop-filter: blur(12rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.opportunity-card {
  width: 100%;
  max-width: 500rpx;
  background-color: #ffffff;
  border-style: solid;
  border-width: 4rpx 5rpx 3rpx 4rpx;
  border-radius: 8rpx 16rpx 6rpx 20rpx;
  border-color: #514532;
  box-shadow: 8rpx 8rpx 0rpx 0rpx rgba(81, 69, 50, 0.15);
  position: relative;
  overflow: hidden;
  animation: fadeInZoom 0.3s ease-out;
}

@keyframes fadeInZoom {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.card-header {
  background-color: #ffb800;
  padding: 20rpx 32rpx;
  border-bottom: 4rpx solid #514532;
}

.card-title {
  text-align: center;
}

.card-content {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.illustration-container {
  width: 256rpx;
  height: 256rpx;
  border-style: solid;
  border-width: 4rpx;
  border-radius: 8rpx 16rpx 6rpx 20rpx;
  border-color: #d5c4ab;
  background-color: #fff2e1;
  transform: rotate(4deg);
  overflow: hidden;
}

.illustration-image {
  width: 100%;
  height: 100%;
}

.description {
  line-height: 1.5;
}

.collect-btn {
  width: 100%;
  margin-top: 16rpx;
  padding: 20rpx 32rpx;
  background-color: #ffb800;
  border-style: solid;
  border-width: 4rpx;
  border-color: #514532;
  box-shadow: 8rpx 8rpx 0rpx 0rpx rgba(81, 69, 50, 0.15);
}

.collect-btn:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 0px 0rpx 0rpx 0rpx rgba(0, 0, 0, 0);
}

.sticker-decoration {
  position: absolute;
  bottom: -32rpx;
  right: -32rpx;
  width: 96rpx;
  height: 96rpx;
  background-color: rgba(183, 16, 50, 0.1);
  border: 4rpx dashed #b71032;
  border-radius: 50%;
  transform: rotate(-24deg);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
}

.sticker-icon {
  font-size: 40rpx;
  color: #b71032;
  transform: rotate(24deg);
}

.hand-drawn-border {
  border-style: solid;
  border-width: 4rpx 5rpx 3rpx 4rpx;
  border-radius: 8rpx 16rpx 6rpx 20rpx;
}

.ink-shadow {
  box-shadow: 8rpx 8rpx 0rpx 0rpx rgba(81, 69, 50, 0.15);
}

.active-press:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 0px 0rpx 0rpx 0rpx rgba(0, 0, 0, 0);
}

.headline-lg-mobile { font-size: 24px; line-height: 32px; font-weight: 700; }
.body-md { font-size: 16px; line-height: 24px; }
.text-on-primary-container { color: #6b4c00; }
.text-on-surface-variant { color: #514532; }
```

- [ ] **Step 5: 编写 chance-card.js**

```javascript
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    image: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    goldChange: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onCollect() {
      this.triggerEvent('collect', {
        goldChange: this.data.goldChange
      });
    },

    onBackdropTap() {
      this.triggerEvent('close');
    }
  }
});
```

- [ ] **Step 6: 提交代码**

```bash
git add components/chance-card/
git commit -m "feat: add ChanceCard component"
```

---

## Task 2: 创建 PhotoCard 组件

**Files:**
- Create: `components/photo-card/photo-card.wxml`
- Create: `components/photo-card/photo-card.wxss`
- Create: `components/photo-card/photo-card.js`
- Create: `components/photo-card/photo-card.json`

- [ ] **Step 1: 创建组件目录和基础文件**

```bash
mkdir -p components/photo-card
touch components/photo-card/photo-card.{wxml,wxss,js,json}
```

- [ ] **Step 2: 编写 photo-card.json**

```json
{
  "component": true,
  "usingComponents": {
    "iconfont": "/utils/iconfont"
  }
}
```

- [ ] **Step 3: 编写 photo-card.wxml**

```xml
<view class="photo-card-page" wx:if="{{visible}}">
  <view class="event-popup">
    <view class="popup-header">
      <text class="header-title headline-lg text-primary">发现新地标!</text>
      <view class="header-divider"></view>
    </view>

    <view class="polaroid-container">
      <view class="polaroid-frame hand-drawn-border sketch-shadow">
        <view class="photo-frame">
          <image class="landmark-photo" src="{{image}}" mode="aspectFill"></image>
        </view>
        <view class="photo-caption">
          <text class="caption-text body-sm text-on-surface-variant italic">{{photoDate}} 于 {{locationName}}</text>
        </view>
        <view class="tape-decoration"></view>
      </view>
    </view>

    <view class="content-body">
      <text class="description body-md text-on-surface">{{description}}</text>
      <view class="stats-chip">
        <text class="iconfont chip-icon icon-trophy" style="font-variation-settings: 'FILL' 1;"></text>
        <text class="chip-text label-caps text-on-surface">成就点 +{{achievementPoint}}</text>
      </view>
    </view>

    <view class="action-buttons">
      <button class="btn-primary pressed-state" bindtap="onContinue">
        <text class="btn-text headline-lg-mobile text-on-primary">继续前进</text>
        <text class="iconfont btn-icon icon-forward"></text>
      </button>
      <button class="btn-secondary pressed-state" bindtap="onViewDetails">
        <text class="btn-text body-md text-primary">查看详情</text>
      </button>
    </view>
  </view>
</view>
```

- [ ] **Step 4: 编写 photo-card.wxss**

```css
@import '../../utils/iconfont.wxss';

.photo-card-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}

.event-popup {
  max-width: 500rpx;
  width: 100%;
  background-color: #ffffff;
  border-style: solid;
  border-width: 4rpx 4rpx 5rpx 4rpx;
  border-radius: 8rpx 24rpx 12rpx 28rpx;
  border-color: #514532;
  box-shadow: 12rpx 12rpx 0rpx 0rpx rgba(81, 69, 50, 0.15);
  padding: 48rpx;
  animation: fadeInZoom 0.3s ease-out;
}

@keyframes fadeInZoom {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.popup-header {
  margin-bottom: 48rpx;
}

.header-title {
  margin-bottom: 16rpx;
}

.header-divider {
  width: 96rpx;
  height: 4rpx;
  background-color: #ffb800;
  border-radius: 999rpx;
}

.polaroid-container {
  margin-bottom: 48rpx;
}

.polaroid-frame {
  position: relative;
  background-color: #ffffff;
  padding: 12rpx 12rpx 32rpx;
  border-style: solid;
  border-width: 4rpx;
  border-color: #d5c4ab;
  box-shadow: 12rpx 12rpx 0rpx 0rpx rgba(81, 69, 50, 0.15);
}

.photo-frame {
  aspect-ratio: 4/3;
  overflow: hidden;
  background-color: #e5d8c8;
  border: 4rpx solid #514532;
  margin-bottom: 16rpx;
}

.landmark-photo {
  width: 100%;
  height: 100%;
}

.photo-caption {
  display: flex;
  justify-content: center;
}

.caption-text {
  font-style: italic;
}

.tape-decoration {
  position: absolute;
  top: -24rpx;
  left: 50%;
  transform: translateX(-50%) rotate(-4deg);
  width: 64rpx;
  height: 48rpx;
  background-color: rgba(124, 88, 0, 0.2);
  backdrop-filter: blur(12rpx);
  border: 2rpx solid rgba(131, 117, 96, 0.2);
}

.content-body {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 48rpx;
}

.description {
  line-height: 1.5;
}

.stats-chip {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 24rpx;
  background-color: #f3e6d6;
  border-radius: 999rpx;
  border: 4rpx dashed #d5c4ab;
  align-self: flex-start;
}

.chip-icon {
  font-size: 18px;
  color: #7c5800;
}

.chip-text {
  text-transform: uppercase;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.btn-primary,
.btn-secondary {
  width: 100%;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  border-radius: 12rpx;
}

.btn-primary {
  background-color: #7c5800;
  border-style: solid;
  border-width: 4rpx;
  border-color: #514532;
}

.btn-primary:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 0px 0rpx 0rpx 0rpx rgba(0, 0, 0, 0);
}

.btn-secondary {
  background-color: #f9ecdb;
  border-style: dashed;
  border-width: 4rpx;
  border-color: #837560;
}

.btn-secondary:active {
  background-color: #f3e6d6;
}

.btn-text {
  text-align: center;
}

.btn-icon {
  font-size: 20px;
  color: #ffffff;
}

.hand-drawn-border {
  border-style: solid;
  border-width: 4rpx 4rpx 5rpx 4rpx;
  border-radius: 8rpx 24rpx 12rpx 28rpx;
}

.sketch-shadow {
  box-shadow: 12rpx 12rpx 0rpx 0rpx rgba(81, 69, 50, 0.15);
}

.pressed-state:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 0px 0rpx 0rpx 0rpx rgba(0, 0, 0, 0);
}

.headline-lg { font-size: 28px; line-height: 36px; font-weight: 700; }
.headline-lg-mobile { font-size: 24px; line-height: 32px; font-weight: 700; }
.body-md { font-size: 16px; line-height: 24px; }
.body-sm { font-size: 14px; line-height: 20px; }
.label-caps { font-size: 12px; line-height: 16px; font-weight: 700; text-transform: uppercase; }

.text-primary { color: #7c5800; }
.text-on-primary { color: #ffffff; }
.text-on-surface { color: #211b11; }
.text-on-surface-variant { color: #514532; }
```

- [ ] **Step 5: 编写 photo-card.js**

```javascript
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    image: {
      type: String,
      value: ''
    },
    locationName: {
      type: String,
      value: ''
    },
    photoDate: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    achievementPoint: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onContinue() {
      this.triggerEvent('continue', {
        achievementPoint: this.data.achievementPoint
      });
    },

    onViewDetails() {
      this.triggerEvent('viewdetails');
    }
  }
});
```

- [ ] **Step 6: 提交代码**

```bash
git add components/photo-card/
git commit -m "feat: add PhotoCard component"
```

---

## Task 3: 更新原页面使用组件

**Files:**
- Modify: `pages/chancecard/chancecard.wxml`
- Modify: `pages/chancecard/chancecard.js`
- Modify: `pages/chancecard/chancecard.json`
- Modify: `pages/photocard/photocard.wxml`
- Modify: `pages/photocard/photocard.js`
- Modify: `pages/photocard/photocard.json`

- [ ] **Step 1: 更新 chancecard 页面**

修改 `chancecard.json`:
```json
{
  "usingComponents": {
    "ChanceCard": "/components/chance-card/chance-card"
  }
}
```

修改 `chancecard.wxml`:
```xml
<ChanceCard
  visible="{{true}}"
  image="{{landmarkImage}}"
  description="{{cardDescription}}"
  goldChange="{{goldChange}}"
  bind:collect="onCollect"
/>
```

修改 `chancecard.js`:
```javascript
onCollect(e) {
  const { goldChange } = e.detail;
  const pages = getCurrentPages();
  const previousPage = pages[pages.length - 2];

  if (previousPage && previousPage.data.engine) {
    const engine = previousPage.data.engine;
    if (goldChange !== 0) {
      engine.state.currentGold += goldChange;
      previousPage.syncFromEngine && previousPage.syncFromEngine();
    }
  }

  wx.navigateBack();
}
```

- [ ] **Step 2: 更新 photocard 页面**

修改 `photocard.json`:
```json
{
  "usingComponents": {
    "PhotoCard": "/components/photo-card/photo-card"
  }
}
```

修改 `photocard.wxml`:
```xml
<PhotoCard
  visible="{{true}}"
  image="{{landmarkImage}}"
  locationName="{{locationName}}"
  photoDate="{{photoDate}}"
  description="{{description}}"
  achievementPoint="{{achievementPoint}}"
  bind:continue="onContinue"
  bind:viewdetails="onViewDetails"
/>
```

- [ ] **Step 3: 提交代码**

```bash
git add pages/chancecard pages/photocard
git commit -m "refactor: update pages to use component variants"
```

---

## 验证步骤

1. 运行 `npm run dev` 或微信开发者工具
2. 测试 chancecard 页面显示和"收下"按钮功能
3. 测试 photocard 页面显示和"继续前进"/"查看详情"按钮功能
4. 确认组件事件正确触发并返回上一页更新游戏状态