# Board 异形环状地图实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Board 组件实现两套异形环状地图模板（圆角矩形环 + 花瓣环），支持动态格子数量适配

**Architecture:** 新增 `pathCalculator.js` 计算格子位置，模板定义与渲染逻辑分离，Board 只负责调用路径计算并绘制

**Tech Stack:** 微信小程序 Canvas、纯 JS 路径算法

---

## 文件结构

```
components/
├── Board/
│   ├── board.js        # 重构 render()，调用 PathCalculator
│   └── board.wxml      # 不变

utils/
├── pathCalculator.js   # 新增：格子位置计算核心
└── templateDefs.js      # 新增：模板定义（圆角矩形环、花瓣环）
```

---

## 实现任务

### Task 1: 创建模板定义 `utils/templateDefs.js`

**Files:**
- Create: `utils/templateDefs.js`

- [ ] **Step 1: 创建文件**

```javascript
// templateDefs.js - 模板定义
// 模板选择规则：5-20格默认圆角矩形环，21-40格默认花瓣环

const TEMPLATES = {
  roundedRect: {
    id: 'roundedRect',
    name: '圆角矩形环',
    defaultForRange: [5, 20],
    calcCornerCount: (N) => {
      // 优先找整除的角数
      for (let c of [4, 6, 8, 10, 12]) {
        if (N % c === 0) return c;
      }
      // 查表兜底
      const table = { 5: 4, 9: 4, 13: 4, 17: 6, 21: 6, 25: 8, 29: 8 };
      for (let key of Object.keys(table).map(Number).sort((a, b) => b - a)) {
        if (N >= key) return table[key];
      }
      return 4;
    }
  },
  petal: {
    id: 'petal',
    name: '花瓣环',
    defaultForRange: [21, 40],
    calcPetalCount: (N) => {
      for (let p of [4, 6, 8, 10, 12]) {
        if (N % p === 0) return p;
      }
      // 找 N 最接近 k*p 的 p
      let bestP = 4, bestDiff = Infinity;
      for (let p of [4, 6, 8, 10, 12]) {
        const multiples = [p, 2*p, 3*p, 4*p];
        for (let m of multiples) {
          const diff = Math.abs(N - m);
          if (diff < bestDiff) { bestDiff = diff; bestP = p; }
        }
      }
      return bestP;
    }
  }
};

module.exports = { TEMPLATES };
```

- [ ] **Step 2: 验证文件存在**

```bash
ls -la utils/templateDefs.js
```

---

### Task 2: 创建路径计算器 `utils/pathCalculator.js`

**Files:**
- Create: `utils/pathCalculator.js`

- [ ] **Step 1: 创建基础路径计算器**

```javascript
// pathCalculator.js - 格子位置计算核心
const { TEMPLATES } = require('./templateDefs');

const GRID_SIZE = 70;        // 格子基准尺寸
const MIN_GAP = 8;           // 最小格子间距

class PathCalculator {
  /**
   * 根据格子数量选择模板并计算所有格子位置
   * @param {number} N - 格子总数
   * @param {number} canvasWidth - 画布宽度
   * @param {number} canvasHeight - 画布高度
   * @param {string} templateId - 可选，指定模板
   * @returns {Array<{x, y, angle, gridSize, isStart}>}
   */
  static calculate(N, canvasWidth, canvasHeight, templateId) {
    // 1. 选择模板
    const template = templateId
      ? TEMPLATES[templateId]
      : PathCalculator._selectTemplate(N);

    // 2. 计算路径点数列
    const points = templateId === 'roundedRect'
      ? PathCalculator._calcRoundedRectPath(N, canvasWidth, canvasHeight)
      : PathCalculator._calcPetalPath(N, canvasWidth, canvasHeight);

    // 3. 沿路径均分格子
    return PathCalculator._distributeGrids(points, N);
  }

  static _selectTemplate(N) {
    if (N <= 20) return TEMPLATES.roundedRect;
    return TEMPLATES.petal;
  }

  /**
   * 计算圆角矩形环路径点
   * 返回路径上均匀分布的 N 个点（含角度）
   */
  static _calcRoundedRectPath(N, width, height) {
    const cx = width / 2, cy = height / 2;
    // 根据格子数计算合适的圆角数
    const corners = TEMPLATES.roundedRect.calcCornerCount(N);
    const w = Math.min(width, height) * 0.7;
    const h = w;
    const cornerRadius = Math.min(w, h) * 0.15;

    // 路径总长近似
    const straightLen = 2 * (w + h) - 8 * cornerRadius;
    const arcLen = 2 * Math.PI * cornerRadius;
    const totalLen = 4 * straightLen + 4 * arcLen;

    const points = [];
    const steps = N * 20; // 每格取20个采样点保证精度

    for (let i = 0; i < N; i++) {
      const t = (i / N);
      const dist = t * totalLen;
      const { x, y, angle } = PathCalculator._pointAtDistanceRoundedRect(
        dist, cx, cy, w, h, cornerRadius
      );
      points.push({ x, y, angle });
    }
    return points;
  }

  static _pointAtDistanceRoundedRect(dist, cx, cy, w, h, r) {
    // 上边 → 右边 → 下边 → 左边 的顺时针路径
    const straightH = w - 2 * r;
    const straightV = h - 2 * r;
    const segmentLen = [straightH, Math.PI * r / 2, straightV, Math.PI * r / 2,
                        straightH, Math.PI * r / 2, straightV, Math.PI * r / 2];
    const cumLen = [0];
    for (let s of segmentLen) cumLen.push(cumLen[cumLen.length - 1] + s);
    const total = cumLen[cumLen.length - 1];
    dist = dist % total;

    let seg = 0;
    while (dist > cumLen[seg + 1]) seg++;

    const local = dist - cumLen[seg];
    let x, y, angle;

    const left = cx - w / 2, right = cx + w / 2;
    const top = cy - h / 2, bottom = cy + h / 2;

    if (seg === 0) { // 上边
      x = left + r + local;
      y = top;
      angle = 0;
    } else if (seg === 1) { // 右上圆角
      const theta = local / r;
      x = right - r + r * Math.sin(theta);
      y = top + r - r * (1 - Math.cos(theta));
      angle = theta;
    } else if (seg === 2) { // 右边
      x = right;
      y = top + r + local;
      angle = Math.PI / 2;
    } else if (seg === 3) { // 右下圆角
      const theta = local / r;
      x = right - r + r * (1 - Math.cos(theta));
      y = bottom - r + r * Math.sin(theta);
      angle = Math.PI / 2 + theta;
    } else if (seg === 4) { // 下边
      x = right - r - local;
      y = bottom;
      angle = Math.PI;
    } else if (seg === 5) { // 左下圆角
      const theta = local / r;
      x = left + r - r * Math.sin(theta);
      y = bottom - r + r * (1 - Math.cos(theta));
      angle = Math.PI + theta;
    } else if (seg === 6) { // 左边
      x = left;
      y = bottom - r - local;
      angle = -Math.PI / 2;
    } else { // 左上圆角
      const theta = local / r;
      x = left + r - r * (1 - Math.cos(theta));
      y = top + r - r * Math.sin(theta);
      angle = -Math.PI / 2 + theta;
    }

    return { x, y, angle };
  }

  /**
   * 计算花瓣环路径点
   * 使用极坐标 r(θ) = baseR * (1 + k * sin(P * θ))
   */
  static _calcPetalPath(N, canvasWidth, canvasHeight) {
    const cx = canvasWidth / 2, cy = canvasHeight / 2;
    const baseRadius = Math.min(canvasWidth, canvasHeight) * 0.35;
    const k = 0.15; // 振幅
    const petals = TEMPLATES.petal.calcPetalCount(N);

    const points = [];
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * 2 * Math.PI - Math.PI / 2;
      const r = baseRadius * (1 + k * Math.sin(pedals * theta));
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      // 切线角度
      const dr = baseRadius * k * petals * Math.cos(pedals * theta);
      const dtheta = 2 * Math.PI / N;
      const angle = Math.atan2(
        r * dtheta,
        dr * dtheta + r * (-Math.sin(theta) * dtheta)
      );
      points.push({ x, y, angle });
    }
    return points;
  }

  static _distributeGrids(points, N) {
    // 检查是否有余数需要填充起点格
    const results = points.map((p, i) => ({
      x: p.x,
      y: p.y,
      angle: p.angle,
      gridSize: GRID_SIZE,
      isStart: i === 0
    }));

    // 起点格放大逻辑在 Task 6 处理
    return results;
  }
}

module.exports = { PathCalculator };
```

- [ ] **Step 2: 验证文件**

```bash
node -e "const { PathCalculator } = require('./utils/pathCalculator'); console.log('PathCalculator loaded');"
```

---

### Task 3: 重构 Board 组件使用 PathCalculator

**Files:**
- Modify: `components/Board/board.js`

- [ ] **Step 1: 引入 PathCalculator**

在 board.js 顶部添加：
```javascript
const { PathCalculator } = require('../../utils/pathCalculator');
```

- [ ] **Step 2: 重写 render() 方法**

替换现有 render() 方法：
```javascript
render() {
  if (!this.ctx) return;

  const ctx = this.ctx;
  const canvasWidth = this.canvas.width / this.dpr;
  const canvasHeight = this.canvas.height / this.dpr;
  const grids = this.properties.grids;
  const currentIndex = this.properties.currentGridIndex;
  const scale = this.properties.scale || 1;
  const offsetX = this.properties.offsetX || 0;
  const offsetY = this.properties.offsetY || 0;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

  // 使用 PathCalculator 计算所有格子位置
  const points = PathCalculator.calculate(
    grids.length,
    canvasWidth,
    canvasHeight
  );

  for (let i = 0; i < grids.length; i++) {
    const { x, y, angle, gridSize, isStart } = points[i];
    this.drawGrid(ctx, grids[i], i, x, y, currentIndex === i, gridSize, angle, isStart);
  }

  this.drawCenterInfo(ctx, canvasWidth / 2, canvasHeight / 2, currentIndex, grids[currentIndex]);
  ctx.restore();
},
```

- [ ] **Step 3: 更新 drawGrid 签名**

替换 drawGrid 方法：
```javascript
drawGrid(ctx, grid, index, x, y, isActive, gridSize, angle, isStart) {
  const halfSize = gridSize / 2;

  ctx.save();
  ctx.translate(x, y);

  // 格子形状跟随路径方向
  ctx.rotate(angle);

  // 根据 isStart 调整格子大小
  const size = isStart ? gridSize * 1.2 : gridSize;

  // ... 后续绘制逻辑（圆角矩形）保持不变，只需把 halfSize 换成 size/2
}
```

- [ ] **Step 4: 运行验证**

在模拟器中打开游戏页面，确认环形地图正常渲染

---

### Task 4: 实现模板选择与配置化

**Files:**
- Modify: `utils/templateDefs.js`
- Modify: `utils/pathCalculator.js`
- Modify: `components/Board/board.js`

- [ ] **Step 1: 为 Board 添加 templateId 属性**

在 board.js properties 中添加：
```javascript
templateId: {
  type: String,
  value: null  // null = 自动选择
},
```

- [ ] **Step 2: 更新 observer**

```javascript
observers: {
  'grids,currentGridIndex,scale,offsetX,offsetY,templateId': function() {
    this.render();
  }
},
```

- [ ] **Step 3: 传递 templateId 到 PathCalculator**

在 render() 中调用：
```javascript
const points = PathCalculator.calculate(
  grids.length,
  canvasWidth,
  canvasHeight,
  this.properties.templateId  // 新增
);
```

---

### Task 5: 实现花瓣环完整路径计算

**Files:**
- Modify: `utils/pathCalculator.js`

- [ ] **Step 1: 实现完整花瓣路径采样**

替换 `_calcPetalPath` 中的简化逻辑，使用更高精度采样：
```javascript
static _calcPetalPath(N, canvasWidth, canvasHeight) {
  const cx = canvasWidth / 2, cy = canvasHeight / 2;
  const baseRadius = Math.min(canvasWidth, canvasHeight) * 0.35;
  const k = 0.15;
  const petals = TEMPLATES.petal.calcPetalCount(N);

  // 采样因子：每格取 30 个采样点保证精度
  const sampleFactor = 30;
  const totalSamples = N * sampleFactor;
  const pathPoints = [];

  for (let s = 0; s < totalSamples; s++) {
    const t = s / totalSamples;
    const theta = t * 2 * Math.PI - Math.PI / 2;
    const r = baseRadius * (1 + k * Math.sin(pedals * theta));
    pathPoints.push({
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta)
    });
  }

  // 均匀抽取 N 个点
  const result = [];
  for (let i = 0; i < N; i++) {
    const sampleIdx = Math.round((i / N) * totalSamples);
    const p = pathPoints[sampleIdx];
    // 计算相邻点得到切线角度
    const nextIdx = (sampleIdx + 1) % totalSamples;
    const dx = pathPoints[nextIdx].x - p.x;
    const dy = pathPoints[nextIdx].y - p.y;
    const angle = Math.atan2(dy, dx);
    result.push({ x: p.x, y: p.y, angle });
  }

  return result;
}
```

- [ ] **Step 2: 验证花瓣形状**

用不同格子数测试（18、20、24格）观察花瓣效果

---

### Task 6: 实现起点格放大填补逻辑

**Files:**
- Modify: `utils/pathCalculator.js`

- [ ] **Step 1: 在 _distributeGrids 中实现放大**

替换 `static _distributeGrids`：
```javascript
static _distributeGrids(points, N) {
  // 计算理想格子间距
  const avgSpacing = this._calcAverageSpacing(points);
  const gapShortage = MIN_GAP - avgSpacing;

  // 若间距不足，说明格子太挤，启用起点格放大
  let startScale = 1;
  if (gapShortage > 0 && points.length > 0) {
    const shortageRatio = (MIN_GAP - avgSpacing) / avgSpacing;
    if (shortageRatio > 0.2) { // 超过20%短缺才放大
      startScale = 1 + shortageRatio * 0.5;
    }
  }

  return points.map((p, i) => ({
    x: p.x,
    y: p.y,
    angle: p.angle,
    gridSize: i === 0 ? GRID_SIZE * startScale : GRID_SIZE,
    isStart: i === 0
  }));
}

static _calcAverageSpacing(points) {
  if (points.length < 2) return Infinity;
  let totalDist = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    totalDist += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
  return totalDist / points.length;
}
```

- [ ] **Step 2: 更新 drawGrid 支持动态 gridSize**

drawGrid 已经接收 gridSize 参数，只需确保圆角和文字大小也相应缩放。

---

### Task 7: 更新 Game 页面适配新坐标系统

**Files:**
- Modify: `pages/game/game.js`

- [ ] **Step 1: 调整 setViewMode 逻辑**

之前的 focus 模式用线性偏移，需要改为根据当前格子角度计算：
```javascript
setViewMode(e) {
  const mode = e.currentTarget.dataset.mode;
  this.setData({ viewMode: mode });

  const N = this.data.grids.length;
  if (mode === 'focus') {
    const idx = this.data.currentGridIndex;
    // 计算当前格子的角度
    const angleStep = (2 * Math.PI) / N;
    const angle = idx * angleStep - Math.PI / 2;

    const boardScale = 2;
    const focusOffsetX = -Math.cos(angle) * 150 * (boardScale - 1);
    const focusOffsetY = -Math.sin(angle) * 150 * (boardScale - 1);

    this.setData({
      boardScale,
      boardOffsetX: focusOffsetX,
      boardOffsetY: focusOffsetY
    });
  } else {
    this.setData({
      boardScale: 1,
      boardOffsetX: 0,
      boardOffsetY: 0
    });
  }
},
```

- [ ] **Step 2: 测试全览/焦点切换**

在模拟器中测试两种模式的切换效果

---

### Task 8: 最终验证与调试

- [ ] **Step 1: 用不同格子数测试**

创建 15、18、20、24、30 格的地图，验证渲染效果

- [ ] **Step 2: 测试拖动和缩放**

确认新路径计算下拖动和缩放仍然正常

- [ ] **Step 3: 测试模板切换**

在 Board 属性中传入不同 templateId，验证渲染结果

---

## 验收标准

1. 20 格时完整环形排列，无重叠
2. 18 格时有可见间距，不拥挤
3. 圆角矩形环：四角圆润，格子沿路径分布
4. 花瓣环：花瓣形状明显，有凹凸感
5. 文字始终垂直朝上，弯道处可读
6. 全览/焦点切换正常，当前格居中
7. 拖动缩放正常

---

## 执行方式

**Two execution options:**

**1. Subagent-Driven (recommended)** -  dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** - Execute tasks in this session using executing-plans

Which approach?