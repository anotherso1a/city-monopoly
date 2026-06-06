# drawing-progress 循环文案改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `drawing-progress` 组件的单行静态文字升级为"headline 5 条消息循环 + 静态 subtitle"的动态结构,贴 `docs/design/text-loading.html:234-238` 的视觉手法。

**Architecture:** 改造范围仅 4 个文件,1 个组件 (`drawing-progress`) + 1 行页面清理 (`create.wxml`)。JS 端硬编码 `MESSAGES` 数组镜像到 data,新增第三个 timer (复用现有 timer 管理模式) 控制 headline 淡入淡出与索引切换。WXSS 用 `transition: opacity 0.3s ease` 让 JS 端只负责 toggle data,不承担动画细节。

**Tech Stack:** WeChat Mini Program (WXML/WXSS/JS),无新依赖。

**Note on TDD:** 项目 `package.json` 的 `test` script 仅 echo 错误,无测试框架,无现有 UI 组件测试。验证方式改为"微信开发者工具里手动观察",见 Task 5。

---

## File Structure

| 文件 | 改动 | 责任 |
|------|------|------|
| `components/drawing-progress/drawing-progress.js` | 修改 | MESSAGES 常量、data 字段、timer 启动/停止、移除 `text` prop |
| `components/drawing-progress/drawing-progress.wxml` | 修改 | 在 die 和 progress 之间插入 `text-block`(headline + subtitle) |
| `components/drawing-progress/drawing-progress.wxss` | 修改 | `.text-block` 容器、`.headline` 字号+过渡、`.subtitle` 斜体+透明 |
| `pages/create/create.wxml` | 修改 | 移除 `<drawing-progress>` 的 `text` prop |

无新文件,无新依赖,无新组件。

---

## Task 1: 改造 drawing-progress.js

**Files:**
- Modify: `components/drawing-progress/drawing-progress.js` (整个文件重写)

- [ ] **Step 1: 重写 drawing-progress.js**

完整重写为以下内容(把现有文件覆盖):

```js
// drawing-progress 组件 - loading 状态展示
// 内部自管理: 骰子点数循环 (750ms) + 进度条抖动 (300ms, 58-62%) +
//            headline 5 条消息循环 (2500ms 切换, 0.3s 淡入淡出)

const DOT_LAYOUTS = {
  1: [true,  false, false, false],
  2: [true,  false, false, true ],
  3: [true,  true,  true,  false],
  4: [true,  true,  true,  true ]
};

const MESSAGES = [
  '正在勾勒街道骨架...',
  '翻阅旧地图中...',
  '正在填充 POI 坐标...',
  '准备你的探索者笔记...',
  '正在为每个格子定价值...'
];

const BASE_PROGRESS = 60;
const PROGRESS_JITTER_RANGE = 2;
const MESSAGE_INTERVAL_MS = 2500;
const MESSAGE_FADE_MS = 300;

Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  data: {
    face: 4,
    dotLayout: DOT_LAYOUTS[4],
    progress: BASE_PROGRESS,
    messages: MESSAGES,
    currentIndex: 0,
    headlineOpacity: 1
  },

  _diceTimer: null,
  _progressTimer: null,
  _messageTimer: null,
  _fadeOutTimer: null,

  lifetimes: {
    attached() {
      this._startTimers();
    },
    detached() {
      this._stopTimers();
    }
  },

  methods: {
    _startTimers() {
      this._diceTimer = setInterval(() => {
        const face = Math.floor(Math.random() * 4) + 1;
        this.setData({
          face,
          dotLayout: DOT_LAYOUTS[face]
        });
      }, 750);

      this._progressTimer = setInterval(() => {
        const jitter = (Math.random() - 0.5) * (PROGRESS_JITTER_RANGE * 2);
        const next = Math.min(
          Math.max(this.data.progress + jitter, BASE_PROGRESS - PROGRESS_JITTER_RANGE),
          BASE_PROGRESS + PROGRESS_JITTER_RANGE
        );
        this.setData({ progress: Math.round(next) });
      }, 300);

      this._messageTimer = setInterval(() => {
        this.setData({ headlineOpacity: 0 });
        this._fadeOutTimer = setTimeout(() => {
          if (!this.isAttached()) return;
          this.setData({
            currentIndex: (this.data.currentIndex + 1) % MESSAGES.length,
            headlineOpacity: 1
          });
          this._fadeOutTimer = null;
        }, MESSAGE_FADE_MS);
      }, MESSAGE_INTERVAL_MS);
    },

    _stopTimers() {
      if (this._diceTimer)     { clearInterval(this._diceTimer);     this._diceTimer = null; }
      if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null; }
      if (this._messageTimer)  { clearInterval(this._messageTimer);  this._messageTimer = null; }
      if (this._fadeOutTimer)  { clearTimeout(this._fadeOutTimer);   this._fadeOutTimer = null; }
    }
  }
});
```

- [ ] **Step 2: 提交组件逻辑改动**

```bash
git add components/drawing-progress/drawing-progress.js
git commit -m "feat(drawing-progress): headline 5 条消息循环 + 静态 subtitle

- 新增 MESSAGES 数组镜像到 data.messages,WXML 可访问
- 新增 _messageTimer / _fadeOutTimer,2500ms 切下一条,300ms 淡出
- isAttached() 检查处理 detach 间隙里 setTimeout 触发的边界
- 移除 properties.text,组件完全自包含"
```

---

## Task 2: 改造 drawing-progress.wxml

**Files:**
- Modify: `components/drawing-progress/drawing-progress.wxml`

- [ ] **Step 1: 在 die-wrapper 和 progress-track 之间插入 text-block**

完整重写文件:

```xml
<view class="centerpiece">
  <view class="die-wrapper">
    <view class="die-box">
      <view class="die-dots">
        <view wx:for="{{dotLayout}}"
              wx:key="index"
              class="dot {{item ? '' : 'dot-hidden'}} {{face === 1 && index === 0 ? 'dot-wide' : ''}}"></view>
      </view>
    </view>
  </view>

  <view class="text-block">
    <text class="headline" style="opacity: {{headlineOpacity}};">
      {{messages[currentIndex]}}
    </text>
    <text class="subtitle">正在为你绘制专属城市地图</text>
  </view>

  <view class="progress-track">
    <view class="progress-fill" style="width: {{progress}}%;"></view>
  </view>
</view>
```

- [ ] **Step 2: 提交 WXML 改动**

```bash
git add components/drawing-progress/drawing-progress.wxml
git commit -m "feat(drawing-progress): WXML 插入 text-block(2 行文字)"
```

---

## Task 3: 改造 drawing-progress.wxss

**Files:**
- Modify: `components/drawing-progress/drawing-progress.wxss`

- [ ] **Step 1: 删除原 `.loading-text` 样式,在文件末尾追加新样式**

完整重写文件:

```css
/* drawing-progress 组件 - loading 状态展示 (骰子 + 文字 + 进度条) */

.centerpiece {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 600rpx;
}

.die-wrapper {
  position: relative;
  width: 144rpx;
  height: 144rpx;
  margin-bottom: 40rpx;
  animation: hand-drawn-spin 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
  transform-origin: 50% 50%;
}

.die-box {
  position: absolute;
  inset: 0;
  background-color: var(--primary-container, #ffb800);
  border-style: solid;
  border-width: 4rpx 3rpx 4rpx 4rpx;
  border-color: var(--on-primary-container, #6b4c00);
  border-radius: 6rpx 14rpx 6rpx 16rpx / 16rpx 6rpx 14rpx 6rpx;
  box-shadow: 6rpx 6rpx 0px 0px var(--shadow-color, rgba(0, 0, 0, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
}

.die-dots {
  display: grid;
  grid-template-columns: repeat(2, 12rpx);
  grid-template-rows: repeat(2, 12rpx);
  gap: 10rpx;
  justify-content: center;
  align-items: center;
  width: 34rpx;
  height: 34rpx;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: var(--on-primary-container, #6b4c00);
}

.dot-hidden {
  visibility: hidden;
}

.dot-wide {
  grid-column: span 2;
  justify-self: center;
}

@keyframes hand-drawn-spin {
  0%   { transform: rotate(0deg) scale(1); }
  25%  { transform: rotate(90deg) scale(1.1) translateX(4rpx); }
  50%  { transform: rotate(180deg) scale(1) translateY(-4rpx); }
  75%  { transform: rotate(270deg) scale(1.1) translateX(-4rpx); }
  100% { transform: rotate(360deg) scale(1); }
}

/* text-block: headline 循环 + subtitle 静态 */
.text-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-bottom: 16rpx;
}

.headline {
  font-size: 48rpx;
  line-height: 56rpx;
  font-weight: 700;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--on-surface-variant, #514532);
  transition: opacity 0.3s ease;
  text-align: center;
}

.subtitle {
  font-size: 32rpx;
  line-height: 40rpx;
  font-style: italic;
  color: var(--on-surface-variant, #514532);
  opacity: 0.7;
  margin-top: 8rpx;
  text-align: center;
}

.progress-track {
  width: 100%;
  height: 48rpx;
  background-color: var(--surface-container-low, #fff2e1);
  border-style: solid;
  border-width: 4rpx 3rpx 5rpx 4rpx;
  border-color: var(--outline, #837560);
  border-radius: 8rpx 20rpx 8rpx 24rpx / 24rpx 8rpx 20rpx 8rpx;
  padding: 4rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--primary-container, #ffb800);
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10rpx,
    rgba(255, 255, 255, 0.2) 10rpx,
    rgba(255, 255, 255, 0.2) 20rpx
  );
  transition: width 0.7s ease-out;
  border-radius: 4rpx;
  opacity: 0.8;
}
```

- [ ] **Step 2: 提交样式改动**

```bash
git add components/drawing-progress/drawing-progress.wxss
git commit -m "feat(drawing-progress): text-block 样式 (headline 48rpx + italic subtitle)"
```

---

## Task 4: 更新 create 页面

**Files:**
- Modify: `pages/create/create.wxml:132`

- [ ] **Step 1: 移除 `<drawing-progress>` 的 `text` prop**

把 [pages/create/create.wxml:132](pages/create/create.wxml#L132) 从:

```xml
        <drawing-progress text="AI 正在生成地图..." />
```

改为:

```xml
        <drawing-progress />
```

- [ ] **Step 2: 提交页面改动**

```bash
git add pages/create/create.wxml
git commit -m "refactor(create): drawing-progress 不再传 text prop,组件自包含"
```

---

## Task 5: 手动验证

**Files:** 无

- [ ] **Step 1: 打开微信开发者工具,加载项目**

预期: 控制台无编译错误,WXML 解析无 warning。

- [ ] **Step 2: 进入 create 页面,触发"开始生成"流程,等待 step 4 出现 drawing-progress**

预期: 骰子照常自旋、点数循环;进度条照常抖动 (58-62%)。

- [ ] **Step 3: 观察 headline 循环**

预期: headline 文字按以下顺序切换,每条停留约 2.5s,切换瞬间有 0.3s 淡出→换字→淡入:

1. 正在勾勒街道骨架...
2. 翻阅旧地图中...
3. 正在填充 POI 坐标...
4. 准备你的探索者笔记...
5. 正在为每个格子定价值...
(回到 1,无限循环)

- [ ] **Step 4: 观察 subtitle**

预期: subtitle 始终显示 "正在为你绘制专属城市地图",不循环,不变。

- [ ] **Step 5: 观察页面级 "请稍候" 文字**

预期: 仍在 subtitle 下方显示 "请稍候，这可能需要几秒钟"。

- [ ] **Step 6: 等待生成完成,观察组件消失**

预期: drawing-progress 随 step 4 切换到 preview 一起消失,无 console warning (无 timer 泄漏)。

- [ ] **Step 7: 反复进出 step 4 多次 (≥3 次)**

预期: 每次进入都能看到 headline 从第 1 条开始循环,无残留状态,无 console warning。
