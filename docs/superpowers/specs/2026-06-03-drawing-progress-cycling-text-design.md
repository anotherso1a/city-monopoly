# drawing-progress 循环文案改造设计

## 背景

`components/drawing-progress/` 组件在 [pages/create/create.wxml:132](pages/create/create.wxml#L132) 中用于显示"AI 正在生成地图"的 loading 状态。当前只有一行静态文字 (`text` prop),用户等待时缺乏"在做事"的氛围感。

[docs/design/text-loading.html:234-238](docs/design/text-loading.html#L234-L238) 是一段值得借鉴的设计:headline 大字 + italic 小字副标题,headline 每 2.5s 切换下一条,带 0.3s 淡入淡出,5 条探索/翻阅主题的消息循环。

把同一套手法搬到 drawing-progress 上,让"AI 正在生成地图"从"等结果"变成"看你工作"。

## 改动范围

- [components/drawing-progress/drawing-progress.wxml](components/drawing-progress/drawing-progress.wxml) — 增加 2 行文字区
- [components/drawing-progress/drawing-progress.wxss](components/drawing-progress/drawing-progress.wxss) — 新增文字区样式
- [components/drawing-progress/drawing-progress.js](components/drawing-progress/drawing-progress.js) — 增加文案常量、循环 timer
- [pages/create/create.wxml:132](pages/create/create.wxml#L132) — 移除 `text` prop

仅此 4 处。无新增依赖,无新组件,无状态管理变化。

## 组件结构

### WXML ([drawing-progress.wxml](components/drawing-progress/drawing-progress.wxml))

在 `die-wrapper` 和 `progress-track` 之间插入文字区:

```xml
<view class="centerpiece">
  <view class="die-wrapper">...</view>

  <view class="text-block">
    <text class="headline" style="opacity: {{headlineOpacity}};">
      {{messages[currentIndex]}}
    </text>
    <text class="subtitle">正在为你绘制专属城市地图</text>
  </view>

  <view class="progress-track">...</view>
</view>
```

`messages` 字段在 `data` 里初始化为 `MESSAGES` 常量(WXML 只能访问 data,不能直接引用 JS 模块级常量)。

### 视觉规格

| 元素 | 字号 | 字重 | 颜色 | 其他 |
|------|------|------|------|------|
| Headline | 48rpx (24px) | 700 | `--on-surface-variant` | transition: opacity 0.3s ease |
| Subtitle | 32rpx (16px) | 400 | `--on-surface-variant` | font-style: italic, opacity 0.7, margin-top 8rpx |

文字区与骰子的间距: 沿用骰子现有的 `margin-bottom: 40rpx`,text-block 自身不加 margin-top。
文字区与进度条的间距: text-block 设 `margin-bottom: 16rpx`(与原 `.loading-text` 一致),进度条已有内边距和边框,自然留白足够。

颜色和透明度贴 [docs/design/text-loading.html:236-237](docs/design/text-loading.html#L236-L237) 的 `text-on-surface-variant` / `text-on-surface-variant/70`。

## 文案常量

固定在 [drawing-progress.js](components/drawing-progress/drawing-progress.js) 顶部,5 条消息按顺序循环:

```js
const MESSAGES = [
  '正在勾勒街道骨架...',
  '翻阅旧地图中...',
  '正在填充 POI 坐标...',
  '准备你的探索者笔记...',
  '正在为每个格子定价值...'
];
```

混搭来源:
- 旧 (来自 text-loading.html): "翻阅旧地图中..."、"准备你的探索者笔记..."
- 新 (drawing 主题): "正在勾勒街道骨架..."、"正在填充 POI 坐标..."、"正在为每个格子定价值..."

## 数据与 timer

### data 字段

```js
data: {
  // ... 现有 face, dotLayout, progress
  messages: MESSAGES,   // 镜像常量到 data,WXML 才能访问
  currentIndex: 0,
  headlineOpacity: 1
}
```

### timer 字段

复用现有 `_diceTimer` / `_progressTimer` 模式,新增:

```js
_messageTimer: null,
_fadeOutTimer: null
```

### 启动 / 停止

在 `_startTimers()` 末尾追加:

```js
this._messageTimer = setInterval(() => {
  this.setData({ headlineOpacity: 0 });
  this._fadeOutTimer = setTimeout(() => {
    if (!this.isAttached()) return;  // 避免组件已 detach 时触发
    this.setData({
      currentIndex: (this.data.currentIndex + 1) % MESSAGES.length,
      headlineOpacity: 1
    });
    this._fadeOutTimer = null;
  }, 300);
}, 2500);
```

在 `_stopTimers()` 里同步清理 `clearInterval` 和 `clearTimeout`。

`isAttached()` 检查处理 detach 期间 300ms 间隙里 setTimeout 触发的边界情况。

### 移除 `text` prop

`properties.text` 一并移除,组件完全自包含。理由:
- 5 条消息和 subtitle 都是 drawing 语境特有的硬编码
- 唯一调用方是 create.wxml,定制需求低
- 减少 API 表面,符合"做减法"原则 ([feedback_minimal_changes.md](../../.claude/projects/-Users-sunanchen-workspace-city-monapoly/memory/feedback_minimal_changes.md))

## create 页面改动

[create.wxml:132](pages/create/create.wxml#L132) 从:

```xml
<drawing-progress text="AI 正在生成地图..." />
```

改为:

```xml
<drawing-progress />
```

"请稍候，这可能需要几秒钟" 那一行 ([create.wxml:133](pages/create/create.wxml#L133)) 保留不动 — 它跟新 subtitle 表达的信息不同,互补。

## 验收

1. 触发 create 流程进入 step 4,`generating === true`
2. 观察 30s 以上:
   - Headline 按 1→2→3→4→5→1... 顺序循环
   - 每条之间 0.3s 淡入淡出 (肉眼明显)
   - Subtitle 始终显示 "正在为你绘制专属城市地图"
3. 骰子点数循环、进度条抖动行为不变
4. 生成完成后组件消失,无 console warning (timer 已清理)
5. 反复进入/离开 step 4 多次,无 timer 泄漏
